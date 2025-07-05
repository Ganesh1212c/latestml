import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User } from '../types';
import { 
  signIn as authSignIn, 
  signUp as authSignUp, 
  signOut as authSignOut, 
  onAuthStateChange,
  signInWithGoogle as authSignInWithGoogle,
  checkRedirectResult
} from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role?: 'admin' | 'student') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for redirect result first (for Google sign-in fallback)
    const handleRedirectResult = async () => {
      try {
        const redirectUser = await checkRedirectResult();
        if (redirectUser) {
          setUser(redirectUser);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error handling redirect result:', error);
      }
      
      // Set up real-time auth state listener
      const unsubscribe = onAuthStateChange((user) => {
        setUser(user);
        setLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribe = handleRedirectResult();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userData = await authSignIn(email, password);
      setUser(userData);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      // First try popup method
      const userData = await authSignInWithGoogle(false);
      setUser(userData);
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      // If popup is blocked, try redirect method
      if (error.message === 'POPUP_BLOCKED') {
        try {
          await authSignInWithGoogle(true);
          // Don't set loading to false here as redirect will reload the page
          return;
        } catch (redirectError: any) {
          if (redirectError.message !== 'REDIRECT_IN_PROGRESS') {
            setLoading(false);
            throw new Error('Google sign-in failed. Please try again or use email/password.');
          }
          // If redirect is in progress, don't set loading to false
          return;
        }
      }
      
      setLoading(false);
      throw error;
    }
    setLoading(false);
  };

  const signUp = async (email: string, password: string, displayName: string, role: 'admin' | 'student' = 'student') => {
    setLoading(true);
    try {
      const result = await authSignUp(email, password, displayName, role);
      setUser(result.user);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authSignOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signInWithGoogle,
      signUp, 
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};