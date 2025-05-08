'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { registerUser } from './auth/signup/actions';
import React from 'react';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { status } = useSession();

  // Redirect when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      console.log('Session authenticated, redirecting to /home');
      router.push('/home');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Client-side validation
    if (!email || !password || (isSignUp && !name)) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('password', password);

        console.log('Attempting sign-up:', { name, email });
        const result = await registerUser(formData);
        console.log('Sign-up result:', result);

        if (!result) {
          setError('Sign-up failed: Invalid or incomplete data');
          setLoading(false);
          return;
        }

        if (result.success) {
          console.log('Sign-up successful, attempting sign-in');
          const signInRes = await signIn('credentials', {
            redirect: false,
            email,
            password,
          });
          console.log('Credentials sign-in response:', signInRes);

          if (signInRes?.error) {
            setError(`Sign-up successful, but failed to sign in: ${signInRes.error}`);
            setLoading(false);
            return;
          }

          if (signInRes?.url) {
            console.log('Detected redirect URL:', signInRes.url);
            // Wait for session to update before clearing loading
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          if (!signInRes?.ok) {
            setError('Sign-in failed: Server did not respond correctly');
            setLoading(false);
            return;
          }
        } else {
          setError('Sign-up failed: Unable to create account');
          setLoading(false);
          return;
        }
      } else {
        console.log('Attempting credentials sign-in:', { email });
        const res = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });
        console.log('Credentials sign-in response:', res);

        if (res?.error) {
          setError(
            res.error === 'CredentialsSignin'
              ? 'Invalid email or password'
              : `Sign-in failed: ${res.error}`
          );
          setLoading(false);
          return;
        }

        if (res?.url) {
          console.log('Detected redirect URL:', res.url);
          // Wait for session to update before clearing loading
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!res?.ok) {
          setError('Sign-in failed: Server did not respond correctly');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(
        err instanceof Error
          ? err.message === 'User already exists'
            ? 'An account with this email already exists'
            : err.message
          : 'An unexpected error occurred during sign-up'
      );
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const startTime = Date.now();
    try {
      const res = await signIn('google', { redirect: false, callbackUrl: '/home' });
      const endTime = Date.now();
      console.log('Google sign-in response:', {
        res,
        duration: `${endTime - startTime}ms`,
      });
      if (res?.error) {
        setError(
          res.error === 'AccessDenied'
            ? 'Google sign-in was blocked. Please allow popups and try again.'
            : `Failed to sign in with Google: ${res.error}`
        );
      } else if (res?.url) {
        console.log('Detected Google redirect URL:', res.url);
        // Wait for session to update
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('An error occurred during Google sign-in');
    } finally {
      setLoading(false);
    }
  };

  const toggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setEmail('');
    setPassword('');
    setName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-indigo-100">
      <div className={`container ${isSignUp ? 'right-panel-active' : ''} relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl h-[520px] transition-all duration-600 ease-in-out`}>
        {/* Sign-Up Form */}
        <div className="form-container sign-up-container absolute top-0 left-0 w-1/2 h-full opacity-0 transition-all duration-600 ease-in-out">
          <form onSubmit={handleSubmit} className="bg-white flex flex-col items-center justify-center h-full p-10 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Create Account</h1>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full p-3 bg-gray-100 border-none rounded-lg mb-3 focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300"
              required
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full p-3 bg-gray-100 border-none rounded-lg mb-3 focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3 bg-gray-100 border-none rounded-lg mb-3 focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300"
              required
            />
            {error && (
              <div className="bg-red-100 text-red-700 p-2 rounded mb-3 w-full text-center text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-3 rounded-lg hover:from-indigo-600 hover:to-blue-600 disabled:bg-indigo-300 transition-all duration-300 transform hover:scale-105"
            >
              {loading ? 'Processing...' : 'Sign Up'}
            </button>
          </form>
        </div>

        {/* Sign-In Form */}
        <div className="form-container sign-in-container absolute top-0 left-0 w-1/2 h-full z-10 transition-all duration-600 ease-in-out">
          <form onSubmit={handleSubmit} className="bg-white flex flex-col items-center justify-center h-full p-10 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Sign In</h1>
            <div className="social-container flex justify-center mb-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="social flex items-center justify-center w-10 h-10 border border-gray-300 rounded-full mx-2 hover:bg-gray-100 transition-all duration-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </button>
            </div>
            <span className="text-sm text-gray-500 mb-4">or use your account</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full p-3 bg-gray-100 border-none rounded-lg mb-3 focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3 bg-gray-100 border-none rounded-lg mb-3 focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300"
              required
            />
            {error && (
              <div className="bg-red-100 text-red-700 p-2 rounded mb-3 w-full text-center text-sm">
                {error}
              </div>
            )}
            <a href="#" className="text-sm text-indigo-500 hover:underline mb-4">Forgot your password?</a>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white py-3 rounded-lg hover:from-indigo-600 hover:to-blue-600 disabled:bg-indigo-300 transition-all duration-300 transform hover:scale-105"
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Overlay Container */}
        <div className="overlay-container absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-600 ease-in-out z-50">
          <div className="overlay bg-gradient-to-r from-indigo-500 to-blue-500 text-white relative left-[-100%] h-full w-[200%] transform transition-transform duration-600 ease-in-out">
            <div className="overlay-panel overlay-left absolute top-0 flex flex-col items-center justify-center h-full w-1/2 text-center p-10 transform -translate-x-5 transition-transform duration-600 ease-in-out">
              <h1 className="text-3xl font-bold mb-4">Welcome Back!</h1>
              <p className="text-sm mb-6">To keep connected with us, please login with your personal info</p>
              <button
                onClick={toggleSignUp}
                className="ghost bg-transparent border-2 border-white text-white py-2 px-8 rounded-lg hover:bg-white hover:text-indigo-500 transition-all duration-300 transform hover:scale-105"
              >
                Sign In
              </button>
            </div>
            <div className="overlay-panel overlay-right absolute top-0 right-0 flex flex-col items-center justify-center h-full w-1/2 text-center p-10 transform transition-transform duration-600 ease-in-out">
              <h1 className="text-3xl font-bold mb-4">Hello, Friend!</h1>
              <p className="text-sm mb-6">Enter your personal details and start your journey with us</p>
              <button
                onClick={toggleSignUp}
                className="ghost bg-transparent border-2 border-white text-white py-2 px-8 rounded-lg hover:bg-white hover:text-indigo-500 transition-all duration-300 transform hover:scale-105"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for Animations */}
      <style jsx>{`
        .container {
          transition: all 0.6s ease-in-out;
        }
        .sign-up-container {
          transform: translateX(0);
        }
        .container.right-panel-active .sign-up-container {
          transform: translateX(100%);
          opacity: 1;
          z-index: 5;
        }
        .sign-in-container {
          transform: translateX(0);
        }
        .container.right-panel-active .sign-in-container {
          transform: translateX(100%);
          opacity: 0;
          z-index: 1;
        }
        .container.right-panel-active .overlay-container {
          transform: translateX(-100%);
        }
        .overlay {
          transform: translateX(0);
        }
        .container.right-panel-active .overlay {
          transform: translateX(50%);
        }
        .overlay-left {
          transform: translateX(-20%);
        }
        .container.right-panel-active .overlay-left {
          transform: translateX(0);
        }
        .overlay-right {
          transform: translateX(0);
        }
        .container.right-panel-active .overlay-right {
          transform: translateX(20%);
        }
      `}</style>
    </div>
  );
}