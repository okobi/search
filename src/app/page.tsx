'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser } from './auth/signup/actions';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp) {
      // Handle Sign-Up
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('password', password);

      try {
        await registerUser(formData);
        // After successful sign-up, attempt to sign in the user
        const signInRes = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });
        if (signInRes?.error) {
          setError('Sign-up successful, but failed to sign in: ' + signInRes.error);
        } else {
          router.push('/home'); // Changed to /home for consistency
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred during sign-up');
      } finally {
        setLoading(false);
      }
    } else {
      // Handle Sign-In
      try {
        const res = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });
        if (res?.error) {
          setError('Invalid email or password');
        } else {
          router.push('/home');
        }
      } catch (err) {
        setError('An error occurred during sign-in');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/home' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </h1>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-blue-300 transition-all"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full mt-4 bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300 disabled:bg-gray-300 transition-all"
        >
          Sign in with Google
        </button>
        <p className="mt-4 text-center text-gray-600">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setEmail('');
              setPassword('');
              setName('');
            }}
            className="text-blue-500 hover:underline focus:outline-none"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}