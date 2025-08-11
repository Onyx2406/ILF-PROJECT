'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface AccountForm {
  name: string;
  email: string;
  currency: string;
  initial_balance: string;
  account_type: string; // Add this field
}

export default function CreateAccountPage() {
  const [formData, setFormData] = useState<AccountForm>({
    name: '',
    email: '',
    currency: 'PKR',
    initial_balance: '0.00',
    account_type: 'SAVINGS' // Add default value
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Account created successfully! IBAN: ${result.data.iban}`
        });
        
        // Reset form
        setFormData({ name: '', email: '', currency: 'PKR', initial_balance: '0.00', account_type: 'SAVINGS' });
        
        // Redirect to accounts view after 2 seconds
        setTimeout(() => {
          router.push('/accounts-view');
        }, 2000);
      } else {
        setMessage({
          type: 'error',
          text: result.error?.message || 'Failed to create account'
        });
      }
    } catch (error) {
      console.error('Error creating account:', error);
      setMessage({
        type: 'error',
        text: 'An error occurred while creating the account'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="bg-gradient-to-br from-green-50 to-blue-50 py-12 min-h-screen">
        <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-800 mb-2">🏦 Create ABL Account</h1>
          <p className="text-gray-600">Allied Bank Limited - New Account Registration</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter customer name"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter email address"
              />
            </div>

            {/* Account Type */}
            <div>
              <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-2">
                Account Type *
              </label>
              <select
                id="account_type"
                name="account_type"
                value={formData.account_type}
                onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="SAVINGS">Savings Account</option>
                <option value="CHECKING">Checking Account</option>
                <option value="BUSINESS">Business Account</option>
                <option value="FIXED_DEPOSIT">Fixed Deposit</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </div>
              ) : (
                'Create ABL Account'
              )}
            </button>
          </form>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <div className="flex items-center">
                {message.type === 'success' ? (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {message.text}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="text-center mt-6">
          <a 
            href="/accounts-view"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← View All Accounts
          </a>
        </div>
      </div>
      </div>
    </SidebarLayout>
  );
}
