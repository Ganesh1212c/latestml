import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, BookOpen, Chrome, AlertCircle, ExternalLink, CheckCircle, Settings } from 'lucide-react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import { useAuth } from '../../hooks/useAuth';
import { AuthErrorType } from '../../services/auth';
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
        
        setSuccessEmail(data.email);
        setShowSuccessMessage(true);
        reset();
        
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
      console.error('Google Sign-In Error:', error);
      
      switch (error.message) {
        case AuthErrorType.POPUP_BLOCKED:
          toast.error('Pop-up blocked! Please allow pop-ups for this site.');
          break;
        
        case AuthErrorType.SIGN_IN_CANCELLED:
          toast.error('Sign-in was cancelled. Please try again.');
          break;
        
        case AuthErrorType.NETWORK_ERROR:
          toast.error('Network error. Please check your connection and try again.');
          break;
        
        case AuthErrorType.OPERATION_NOT_ALLOWED:
          setShowConfigHelp(true);
          toast.error('Google Sign-In is not enabled. Please contact support.');
          break;
        
        case AuthErrorType.UNAUTHORIZED_DOMAIN:
          setShowConfigHelp(true);
          toast.error('This domain is not authorized for Google Sign-In.');
          break;
        
        case AuthErrorType.CONFIGURATION_ERROR:
          setShowConfigHelp(true);
          toast.error('Google Sign-In configuration error. Please contact support.');
          break;
        
        case AuthErrorType.ACCOUNT_EXISTS:
          toast.error('An account with this email already exists. Please use your existing sign-in method.');
          break;
        
        default:
          if (error.message.includes(AuthErrorType.GENERIC_ERROR)) {
            const actualError = error.message.replace(`${AuthErrorType.GENERIC_ERROR}: `, '');
            toast.error(`Google Sign-In failed: ${actualError}`);
          } else {
            toast.error('Google Sign-In failed. Please try again or use email/password.');
          }
          break;
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
                        className="mt-3 p-4 bg-orange-900/20 border border-orange-600/30 rounded-lg"
                      >
                        <div className="flex items-start space-x-3">
                          <Settings className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-orange-200">
                            <p className="font-medium mb-2">Google Cloud Setup Required</p>
                            <p className="text-orange-300/80 mb-3">
                              To enable Google Sign-In, please configure:
                            </p>
                            <ul className="text-xs text-orange-300/70 space-y-1 mb-3">
                              <li>• Google Cloud Console OAuth 2.0 credentials</li>
                              <li>• Firebase Authentication Google provider</li>
                              <li>• Authorized domains in both platforms</li>
                              <li>• Proper API keys and client IDs</li>
                            </ul>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => setShowConfigHelp(false)}
                                className="text-orange-400 hover:text-orange-300 text-xs underline"
                              >
                                Dismiss
                              </button>
                              <a
                                href="https://console.cloud.google.com/apis/credentials"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-400 hover:text-orange-300 text-xs underline flex items-center"
                              >
                                Google Cloud Console <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                              <a
                                href="https://console.firebase.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-400 hover:text-orange-300 text-xs underline flex items-center"
                              >
                                Firebase Console <ExternalLink className="h-3 w-3 ml-1" />
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

                {/* Google Cloud Setup Info */}
                {isSignUp && (
                  <div className="mt-6 p-4 bg-dark-700 rounded-lg">
                    <div className="text-sm text-dark-300">
                      <p className="font-medium text-white mb-2">Authentication Options:</p>
                      <ul className="space-y-1">
                        <li>• Email/Password authentication</li>
                        <li>• Google Cloud Sign-In (when configured)</li>
                        <li>• Instant account creation</li>
                        <li>• Secure Firebase authentication</li>
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