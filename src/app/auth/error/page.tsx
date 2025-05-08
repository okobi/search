'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthError({ searchParams }: { searchParams: { error?: string } }) {
  const router = useRouter();
  const error = searchParams.error || 'Unknown error';

  useEffect(() => {
    console.log('Auth error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
        <p className="text-gray-700 mb-6">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="bg-indigo-500 text-white py-2 px-4 rounded-lg hover:bg-indigo-600 transition-all"
        >
          Return to Sign-In
        </button>
      </div>
    </div>
  );
}