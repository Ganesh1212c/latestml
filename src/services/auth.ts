import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';

// Custom error types for better error handling
export enum AuthErrorType {
  POPUP_BLOCKED = 'POPUP_BLOCKED',
  REDIRECT_IN_PROGRESS = 'REDIRECT_IN_PROGRESS',
  SIGN_IN_CANCELLED = 'SIGN_IN_CANCELLED',
  UNAUTHORIZED_DOMAIN = 'UNAUTHORIZED_DOMAIN',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ACCOUNT_EXISTS = 'ACCOUNT_EXISTS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  GENERIC_ERROR = 'GENERIC_ERROR'
}

// Convert Firebase user to our User type
const convertFirebaseUser = async (firebaseUser: FirebaseUser): Promise<User | null> => {
  if (!firebaseUser) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    const userData = userDoc.data();

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || userData?.displayName || '',
      role: userData?.role || 'student',
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: userData?.createdAt || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      emailVerified: true,
    };
  } catch (error) {
    console.error('Error converting Firebase user:', error);
    return null;
  }
};

// Enhanced error handling for Google Sign-In
const handleGoogleSignInError = (error: any): never => {
  console.error('Google Sign-In Error Details:', {
    code: error.code,
    message: error.message,
    customData: error.customData,
    stack: error.stack
  });

  if (error && typeof error.code === 'string') {
    switch (error.code) {
      case 'auth/cancelled-popup-request':
      case 'auth/popup-closed-by-user':
        throw new Error(AuthErrorType.SIGN_IN_CANCELLED);
      
      case 'auth/popup-blocked':
        throw new Error(AuthErrorType.POPUP_BLOCKED);
      
      case 'auth/network-request-failed':
        throw new Error(AuthErrorType.NETWORK_ERROR);
      
      case 'auth/operation-not-allowed':
        throw new Error(AuthErrorType.OPERATION_NOT_ALLOWED);
      
      case 'auth/unauthorized-domain':
        throw new Error(AuthErrorType.UNAUTHORIZED_DOMAIN);
      
      case 'auth/account-exists-with-different-credential':
        throw new Error(AuthErrorType.ACCOUNT_EXISTS);
      
      case 'auth/invalid-api-key':
      case 'auth/invalid-oauth-client-id':
        throw new Error(AuthErrorType.CONFIGURATION_ERROR);
      
      case 'auth/user-disabled':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-email':
        throw new Error(AuthErrorType.INVALID_CREDENTIALS);
      
      default:
        throw new Error(`${AuthErrorType.GENERIC_ERROR}: ${error.message}`);
    }
  }
  
  throw new Error(`${AuthErrorType.GENERIC_ERROR}: ${error.message || 'Unknown error occurred'}`);
};

export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = await convertFirebaseUser(userCredential.user);

    if (!user) {
      throw new Error('Failed to get user data');
    }

    // Update last login
    await setDoc(doc(db, 'users', user.uid), {
      lastLogin: new Date().toISOString()
    }, { merge: true });

    return user;
  } catch (error: any) {
    console.error('Email sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
};

export const signInWithGoogle = async (useRedirect: boolean = false): Promise<User> => {
  try {
    const provider = new GoogleAuthProvider();

    // Configure Google Auth Provider with proper scopes and parameters
    provider.addScope('email');
    provider.addScope('profile');
    provider.addScope('openid');

    // Set custom parameters for better UX
    provider.setCustomParameters({
      prompt: 'select_account',
      access_type: 'online',
      include_granted_scopes: 'true'
    });

    let firebaseUser: FirebaseUser;

    if (useRedirect) {
      // Use redirect method (better for mobile and when popups are blocked)
      await signInWithRedirect(auth, provider);
      throw new Error(AuthErrorType.REDIRECT_IN_PROGRESS);
    } else {
      // Use popup method (better UX for desktop)
      const result = await signInWithPopup(auth, provider);
      firebaseUser = result.user;

      // Get additional user info from Google
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        console.log('Google Access Token:', credential.accessToken);
        console.log('Google ID Token:', credential.idToken);
      }
    }

    // Handle user data
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    let userData: User;

    if (!userDoc.exists()) {
      // New user - create profile
      userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        role: 'student', // Default role for Google sign-in
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        emailVerified: true,
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    } else {
      // Existing user - update profile
      const existingData = userDoc.data();
      userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || existingData?.displayName || '',
        role: existingData?.role || 'student',
        photoURL: firebaseUser.photoURL || existingData?.photoURL || undefined,
        createdAt: existingData?.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        emailVerified: true,
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        lastLogin: new Date().toISOString(),
        photoURL: firebaseUser.photoURL || existingData?.photoURL,
        displayName: firebaseUser.displayName || existingData?.displayName
      }, { merge: true });
    }

    return userData;
  } catch (error: any) {
    console.error('Google sign in error:', error);
    handleGoogleSignInError(error);
  }
};

// Check for redirect result on app initialization
export const checkRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const firebaseUser = result.user;

      // Get Google credential info
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        console.log('Google Redirect Access Token:', credential.accessToken);
        console.log('Google Redirect ID Token:', credential.idToken);
      }

      // Handle user data (same logic as popup)
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      let userData: User;

      if (!userDoc.exists()) {
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          role: 'student',
          photoURL: firebaseUser.photoURL || undefined,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          emailVerified: true,
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), userData);
      } else {
        const existingData = userDoc.data();
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || existingData?.displayName || '',
          role: existingData?.role || 'student',
          photoURL: firebaseUser.photoURL || existingData?.photoURL || undefined,
          createdAt: existingData?.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          emailVerified: true,
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          lastLogin: new Date().toISOString(),
          photoURL: firebaseUser.photoURL || existingData?.photoURL,
          displayName: firebaseUser.displayName || existingData?.displayName
        }, { merge: true });
      }

      return userData;
    }
    return null;
  } catch (error: any) {
    console.error('Error checking redirect result:', error);
    handleGoogleSignInError(error);
  }
};

export const signUp = async (
  email: string,
  password: string,
  displayName: string,
  role: 'admin' | 'student' = 'student'
): Promise<{ user: User }> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCredential.user, {
      displayName: displayName
    });

    const userData = {
      uid: userCredential.user.uid,
      email: userCredential.user.email || '',
      displayName,
      role,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      emailVerified: true,
    };

    await setDoc(doc(db, 'users', userCredential.user.uid), userData);

    // Sign out immediately after account creation
    await firebaseSignOut(auth);

    return { user: userData };
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(error.message || 'Failed to create account');
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();
      if (firebaseUser) {
        const user = await convertFirebaseUser(firebaseUser);
        resolve(user);
      } else {
        resolve(null);
      }
    });
  });
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const user = await convertFirebaseUser(firebaseUser);
      callback(user);
    } else {
      callback(null);
    }
  });
};