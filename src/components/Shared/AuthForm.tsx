import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, BookOpen, Chrome, AlertCircle, ExternalLink, CheckCircle } from 'lucide-react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface AuthFormData {
  email: string;
  password: string;
  displayName?: string;
  role?: 'admin' | 'student';
}

const AuthForm: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');
  
  const { signIn, signInWithGoogle, signUp, loading } = useAuth();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<AuthFormData>();

  const onSubmit = async (data: AuthFormData) => {
    try {
      if (isSignUp) {
        await signUp(data.email, data.password, data.displayName!, data.role || 'student');
        
        // Show success message and redirect to login
        setSuccessEmail(data.email);
        setShowSuccessMessage(true);
        reset();
        
        // Auto-switch to login after showing success message
        setTimeout(() => {
          setShowSuccessMessage(false);
          setIsSignUp(false);
          toast.success('Account created! Please sign in with your new credentials.');
        }, 3000);
      } else {
        await signIn(data.email, data.password);
        toast.success('Welcome back!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast.success('Welcome to MathLearn!');
    } catch (error: any) {
      if (error.message === 'POPUP_BLOCKED') {
        toast.error('Pop-up blocked! Please allow pop-ups for this site or try the alternative method below.');
      } else if (error.message.includes('not properly configured') || 
                 error.message.includes('not authorized') ||
                 error.message.includes('configuration error')) {
        setShowConfigHelp(true);
        toast.error('Google sign-in is not available. Please use email/password sign-in.');
      } else {
        toast.error(error.message || 'Google sign-in failed');
      }
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setShowSuccessMessage(false);
    reset();
    setShowConfigHelp(false);
  };

  const goToLogin = () => {
    setShowSuccessMessage(false);
    setIsSignUp(false);
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <BookOpen className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">MathLearn</h1>
          <p className="text-dark-300">Your journey to mathematical excellence</p>
        </div>

        <Card className="p-8">
          <AnimatePresence mode="wait">
            {showSuccessMessage ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-6"
              >
                <div className="w-16 h-16 bg-accent-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-2">Account Created!</h2>
                  <p className="text-dark-300 mb-4">
                    Welcome to MathLearn! Your account has been successfully created.
                  </p>
                  <p className="text-primary-400 font-medium mb-4">{successEmail}</p>
                  <p className="text-dark-300 text-sm">
                    You can now sign in with your credentials to start your learning journey.
                  </p>
                </div>

                <div className="bg-dark-700 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-accent-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-dark-300">
                      <p className="font-medium text-white mb-1">What's Next:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Sign in with your new credentials</li>
                        <li>Explore available courses</li>
                        <li>Start your first lesson</li>
                        <li>Track your progress</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button 
                    onClick={goToLogin}
                    className="w-full"
                    icon={<Mail className="h-4 w-4" />}
                  >
                    Continue to Sign In
                  </Button>
                  
                  <p className="text-dark-400 text-sm">
                    Redirecting to sign in automatically in a few seconds...
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                  </h2>
                  <p className="text-dark-300">
                    {isSignUp ? 'Join thousands of learners' : 'Sign in to your account'}
                  </p>
                </div>

                {/* Google Sign In Button */}
                <div className="mb-6">
                  <Button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    loading={loading}
                    variant="outline"
                    className="w-full border-dark-600 hover:border-dark-500 hover:bg-dark-700"
                    size="lg"
                    icon={<Chrome className="h-5 w-5" />}
                  >
                    Continue with Google
                  </Button>
                  
                  {/* Configuration Help Message */}
                  <AnimatePresence>
                    {showConfigHelp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg"
                      >
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-blue-200">
                            <p className="font-medium mb-1">Google Sign-in Setup Required</p>
                            <p className="text-blue-300/80 mb-2">
                              To enable Google sign-in, the Firebase project needs to be configured with:
                            </p>
                            <ul className="text-xs text-blue-300/70 space-y-1 mb-2">
                              <li>• Google OAuth client ID</li>
                              <li>• Authorized domains</li>
                              <li>• Proper Firebase configuration</li>
                            </ul>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setShowConfigHelp(false)}
                                className="text-blue-400 hover:text-blue-300 text-xs underline"
                              >
                                Dismiss
                              </button>
                              <a
                                href="https://firebase.google.com/docs/auth/web/google-signin"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs underline flex items-center"
                              >
                                Setup Guide <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-dark-800 text-dark-400">Or continue with email</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {isSignUp && (
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-dark-400" />
                        <input
                          type="text"
                          {...register('displayName', { required: isSignUp })}
                          className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Enter your full name"
                        />
                      </div>
                      {errors.displayName && (
                        <p className="mt-1 text-sm text-red-400">Name is required</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-dark-400" />
                      <input
                        type="email"
                        {...register('email', { required: true, pattern: /^\S+@\S+$/i })}
                        className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter your email"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-400">Valid email is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-dark-400" />
                      <input
                        type="password"
                        {...register('password', { required: true, minLength: 6 })}
                        className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter your password"
                      />
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-400">Password must be at least 6 characters</p>
                    )}
                  </div>

                  {isSignUp && (
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Account Type
                      </label>
                      <select
                        {...register('role')}
                        className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="student">Student</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    loading={loading}
                  >
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-dark-300">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                    >
                      {isSignUp ? 'Sign in' : 'Sign up'}
                    </button>
                  </p>
                </div>

                {/* Additional Info for Sign Up */}
                {isSignUp && (
                  <div className="mt-6 p-4 bg-dark-700 rounded-lg">
                    <div className="text-sm text-dark-300">
                      <p className="font-medium text-white mb-2">Quick Setup:</p>
                      <ul className="space-y-1">
                        <li>• No email verification required</li>
                        <li>• Instant account creation</li>
                        <li>• Choose your account type</li>
                        <li>• Sign in immediately after creation</li>
                      </ul>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
};

export default AuthForm;