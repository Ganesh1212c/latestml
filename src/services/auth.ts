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
  FirebaseAuthError, // <-- IMPORTANT: Added FirebaseAuthError import
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; // Assumes './firebase' points to your firebase.ts
import { User } from '../types'; // Assumes '../types' points to your User type definition

// Define a custom error enum for better handling in UI components
export enum CustomAuthError {
  PopupBlocked = 'POPUP_BLOCKED',
  RedirectInProgress = 'REDIRECT_IN_PROGRESS',
  SignInCancelled = 'SIGN_IN_CANCELLED',
  UnauthorizedDomain = 'UNAUTHORIZED_DOMAIN',
  ConfigurationError = 'CONFIGURATION_ERROR',
  NetworkFailed = 'NETWORK_FAILED',
  AccountExistsWithDifferentCredential = 'ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL',
  OperationNotAllowed = 'OPERATION_NOT_ALLOWED',
  InvalidAPIKey = 'INVALID_API_KEY', // Though auth/invalid-api-key handles this
  InternalError = 'INTERNAL_ERROR',
  GenericGoogleSignInFailure = 'GENERIC_GOOGLE_SIGN_IN_FAILURE', // For unhandled Firebase/Google SDK errors
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

/**
 * Centralized function to handle and throw Google Sign-In errors with user-friendly messages.
 * This function is designed to be called within a catch block for Google Sign-In operations.
 * It will re-throw a more specific or user-friendly error.
 * @param error The error object from Firebase or Google Sign-In SDK.
 * @throws {Error} A new Error object with a specific message or CustomAuthError code.
 */
const handleGoogleSignInError = (error: any): never => { // : never indicates it always throws
  let userFriendlyMessage = "An unexpected error occurred during Google Sign-In.";
  let documentationLink: string | null = null; // Prepare for potential documentation links

  // Check if it's a Firebase Auth specific error
  if (error instanceof FirebaseAuthError) {
    switch (error.code) {
      case 'auth/cancelled-popup-request':
      case 'auth/popup-closed-by-user':
        throw new Error(CustomAuthError.SignInCancelled);
      case 'auth/popup-blocked':
        throw new new Error(CustomAuthError.PopupBlocked);
      case 'auth/network-request-failed':
        throw new Error(CustomAuthError.NetworkFailed);
      case 'auth/operation-not-allowed':
        // This means Google Sign-In is not enabled in Firebase Console
        userFriendlyMessage = "Google Sign-In is not enabled for this app. Please enable it in Firebase Console > Authentication > Sign-in method.";
        documentationLink = "https://firebase.google.com/docs/auth/web/google-signin#enable_google_sign-in_for_your_firebase_project";
        throw new Error(CustomAuthError.OperationNotAllowed); // Throw custom code for UI to interpret
      case 'auth/unauthorized-domain':
        // Your domain is not listed in Firebase Auth settings
        userFriendlyMessage = "This domain is not authorized for Google Sign-In. Please add it to your Firebase Console > Authentication > Sign-in method > Google Provider settings > Authorized domains.";
        documentationLink = "https://firebase.google.com/docs/auth/web/google-signin#authorize_your_domain";
        throw new Error(CustomAuthError.UnauthorizedDomain);
      case 'auth/account-exists-with-different-credential':
        // User tried to sign in with Google, but an account with that email already exists
        // via another method (e.g., email/password)
        userFriendlyMessage = `An account with this email (${error.customData?.email || 'N/A'}) already exists with a different sign-in method. Please use your existing method (e.g., email/password) or link your Google account after signing in.`;
        documentationLink = "https://firebase.google.com/docs/auth/web/link-multiple-accounts";
        throw new Error(CustomAuthError.AccountExistsWithDifferentCredential);
      case 'auth/invalid-api-key':
        userFriendlyMessage = "Google Sign-In is not properly configured. Check your Firebase API Key and Google Cloud Console settings.";
        documentationLink = "https://firebase.google.com/docs/web/setup#config-object"; // General Firebase setup
        throw new Error(CustomAuthError.InvalidAPIKey);
      case 'auth/internal-error':
        userFriendlyMessage = "An internal authentication error occurred. This might be a temporary issue. Please try again later.";
        throw new Error(CustomAuthError.InternalError);
      case 'auth/invalid-oauth-client-id':
        userFriendlyMessage = "Invalid Google OAuth client ID. Please ensure your OAuth client ID is correct in Google Cloud Console and matches your Firebase configuration.";
        documentationLink = "https://firebase.google.com/docs/auth/web/google-signin#before_you_begin";
        throw new Error(CustomAuthError.ConfigurationError); // Using a more general config error
      default:
        // Catch any other specific Firebase Auth errors
        userFriendlyMessage = `Google Sign-In failed: ${error.message}. Please check your configuration or try again.`;
        documentationLink = "https://firebase.google.com/docs/auth/web/google-signin#handle_errors";
        throw new Error(CustomAuthError.GenericGoogleSignInFailure); // Or re-throw with generic message if you prefer
    }
  } else {
    // For non-FirebaseAuth errors (e.g., network issues before Firebase's error handling kicks in, or unexpected JS errors)
    userFriendlyMessage = `An unexpected error occurred: ${error.message}. Please try again.`;
    throw new Error(userFriendlyMessage); // Re-throw with generic user-friendly message
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

    let firebaseUser: FirebaseUser;

    if (useRedirect) {
      // Initiate redirect. The page will reload, and checkRedirectResult will handle the response.
      await signInWithRedirect(auth, provider);
      // This line means a redirect was successfully initiated.
      // The calling function should typically exit or show a loading state.
      throw new Error(CustomAuthError.RedirectInProgress);
    } else {
      // Attempt sign-in using a popup window.
      const result = await signInWithPopup(auth, provider);
      firebaseUser = result.user;
    }

    // --- Common logic for both popup and redirect results ---
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

    let userData: User;

    if (!userDoc.exists()) {
      // New user - create profile in Firestore
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
      // Existing user - update last login and potentially photoURL
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

      // Update last login and photoURL (if changed)
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        lastLogin: new Date().toISOString(),
        photoURL: firebaseUser.photoURL || existingData?.photoURL
      }, { merge: true });
    }

    return userData;
  } catch (error: any) {
    console.error('Google sign in error in signInWithGoogle:', error);
    // Delegate to the centralized error handler. This function will re-throw.
    handleGoogleSignInError(error);
    // The line below will technically not be reached if handleGoogleSignInError always re-throws,
    // but it's good practice to have a final catch-all if you were to modify handleGoogleSignInError
    throw new Error('An unhandled error occurred during Google sign-in.');
  }
};


// Check for redirect result on app initialization/page load
export const checkRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const firebaseUser = result.user;

      // --- Common logic from signInWithGoogle for user profile handling ---
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
          photoURL: firebaseUser.photoURL || existingData?.photoURL
        }, { merge: true });
      }
      // --- End common logic ---

      return userData;
    }
    return null; // No redirect result found or user was null
  } catch (error: any) {
    console.error('Error checking redirect result:', error);
    // Delegate to the centralized error handler for consistency. This function will re-throw.
    handleGoogleSignInError(error);
    // The line below will technically not be reached if handleGoogleSignInError always re-throws,
    // but it's good practice to have a final catch-all.
    throw new Error('An unhandled error occurred after Google redirect.');
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

    // Sign out the user immediately after account creation
    // This forces them to sign in manually with their new credentials
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
      unsubscribe(); // Unsubscribe after the first call
      if (firebaseUser) {
        const user = await convertFirebaseUser(firebaseUser);
        resolve(user);
      } else {
        resolve(null);
      }
    });
  });
};

// Real-time auth state listener for continuous observation
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