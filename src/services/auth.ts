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
  getRedirectResult
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';

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
      emailVerified: true, // Always true since we're removing email verification
    };
  } catch (error) {
    console.error('Error converting Firebase user:', error);
    return null;
  }
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
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
};

export const signInWithGoogle = async (useRedirect: boolean = false): Promise<User> => {
  try {
    const provider = new GoogleAuthProvider();
    
    // Configure the provider with proper scopes and parameters
    provider.addScope('email');
    provider.addScope('profile');
    
    // Set custom parameters to ensure proper OAuth flow
    provider.setCustomParameters({
      prompt: 'select_account',
      access_type: 'online'
    });
    
    let result;
    let firebaseUser: FirebaseUser;
    
    if (useRedirect) {
      // Use redirect method as fallback
      await signInWithRedirect(auth, provider);
      // The actual result will be handled by checkRedirectResult
      throw new Error('REDIRECT_IN_PROGRESS');
    } else {
      // Try popup method first
      try {
        result = await signInWithPopup(auth, provider);
        firebaseUser = result.user;
      } catch (popupError: any) {
        // Handle specific popup errors
        if (popupError.code === 'auth/popup-blocked') {
          throw new Error('POPUP_BLOCKED');
        } else if (popupError.code === 'auth/popup-closed-by-user') {
          throw new Error('Sign-in was cancelled. Please try again.');
        } else if (popupError.code === 'auth/unauthorized-domain') {
          throw new Error('This domain is not authorized for Google sign-in. Please contact support.');
        } else if (popupError.code === 'auth/invalid-api-key') {
          throw new Error('Google sign-in is not properly configured. Please contact support.');
        }
        throw popupError;
      }
    }
    
    // Check if user exists in Firestore
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
      
      // Save to Firestore
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    } else {
      // Existing user - update last login
      const existingData = userDoc.data();
      userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || existingData.displayName || '',
        role: existingData.role || 'student',
        photoURL: firebaseUser.photoURL || existingData.photoURL || undefined,
        createdAt: existingData.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        emailVerified: true,
      };
      
      // Update last login
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        lastLogin: new Date().toISOString(),
        photoURL: firebaseUser.photoURL || existingData.photoURL
      }, { merge: true });
    }

    return userData;
  } catch (error: any) {
    console.error('Google sign in error:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/popup-blocked') {
      throw new Error('POPUP_BLOCKED');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized for Google sign-in. Please add your domain to the Firebase Console.');
    } else if (error.code === 'auth/invalid-api-key') {
      throw new Error('Google sign-in configuration error. Please check your Firebase settings.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Google sign-in is not enabled. Please enable it in the Firebase Console.');
    } else if (error.code === 'auth/invalid-oauth-client-id') {
      throw new Error('Invalid Google OAuth client ID. Please check your Firebase configuration.');
    }
    
    if (error.message === 'REDIRECT_IN_PROGRESS') {
      throw error;
    }
    
    // For any other errors, provide a helpful message
    if (error.message.includes('request access is invalid')) {
      throw new Error('Google sign-in is not properly configured. Please contact support or try email/password sign-in.');
    }
    
    throw new Error(error.message || 'Failed to sign in with Google');
  }
};

// Check for redirect result on app initialization
export const checkRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const firebaseUser = result.user;
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      let userData: User;
      
      if (!userDoc.exists()) {
        // New user - create profile
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
        // Existing user - update last login
        const existingData = userDoc.data();
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || existingData.displayName || '',
          role: existingData.role || 'student',
          photoURL: firebaseUser.photoURL || existingData.photoURL || undefined,
          createdAt: existingData.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          emailVerified: true,
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          lastLogin: new Date().toISOString(),
          photoURL: firebaseUser.photoURL || existingData.photoURL
        }, { merge: true });
      }

      return userData;
    }
    return null;
  } catch (error) {
    console.error('Error checking redirect result:', error);
    return null;
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
    
    // Update the user's display name
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
      emailVerified: true, // No email verification required
    };

    // Save user data to Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), userData);

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

// Real-time auth state listener
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