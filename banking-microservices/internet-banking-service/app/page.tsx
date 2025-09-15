'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading and then redirect to auth
    const timer = setTimeout(() => {
      router.push('/auth');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-blue-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <img 
                src="/A.png" 
                alt="Allied Bank Limited Logo" 
                className="w-12 h-10 object-contain mx-auto mb-4"
              />
              <h1 className="text-3xl font-bold text-white">Allied Bank Limited</h1>
              <p className="text-orange-200 font-medium">Internet Banking Portal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="text-center max-w-md mx-auto px-6">
          {/* Loading Animation */}
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto relative">
              <div className="absolute inset-0 rounded-full border-4 border-orange-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-2 bg-gradient-to-br from-orange-500 to-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-orange-500">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-700 bg-clip-text text-transparent mb-4">
              Welcome to ABL Internet Banking
            </h2>
            <p className="text-gray-600 mb-6">
              Secure, fast, and convenient banking at your fingertips. 
              Redirecting you to our secure login portal...
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                24/7 Banking
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                Fund Transfers
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                Bill Payments
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Account Management
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 bg-gradient-to-r from-orange-100 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-center text-sm">
              <svg className="w-4 h-4 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-gray-700">🔒 Secured with 256-bit SSL Encryption</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-orange-600 to-blue-700 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-white/90 text-sm">
            © 2025 Allied Bank Limited. Your trusted banking partner since 1942.
          </p>
          <p className="text-white/70 text-xs mt-1">
            🏆 Pakistan's Leading Digital Banking Solution
          </p>
        </div>
      </div>
    </div>
  );
}
