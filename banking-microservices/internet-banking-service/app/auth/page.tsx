'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: 'Abcd@1234' // Default password
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Call our local API which will forward through OC to Core Banking
      const response = await axios.post('/api/auth/login', formData);
      
      if (response.data.success) {
        // Store token, customer data, and authenticated account info
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('customer', JSON.stringify(response.data.customer));
        localStorage.setItem('authenticatedAccount', JSON.stringify(response.data.authenticatedAccount));
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        setError(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.error || 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-xl p-8 border-t-4 border-orange-500">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4">
                            <img 
                src="/A.png" 
                alt="Allied Bank Limited Logo" 
                className="w-12 h-10 object-contain mb-4"
              />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-700 bg-clip-text text-transparent mb-2">
              ABL Internet Banking
            </h1>
            <p className="text-gray-600">Secure access to your digital banking</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>🔐 Secure Sign In</span>
                </>
              )}
            </button>
          </form>

          
          {/* Quick Login Examples */}
          <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-blue-50 rounded-lg border">
            <div className="text-center mb-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">🛡️ Security Features</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  256-bit SSL
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  2FA Ready
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                  Real-time Monitoring
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  Fraud Protection
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center border-t pt-3">
              Username format: [email_prefix]_[iban_last4]_[random2digits]
            </p>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              © 2025 Allied Bank Limited. Your trusted banking partner.
            </p>
          </div>
        </div>  
      </div>
    </div>
  );
}
