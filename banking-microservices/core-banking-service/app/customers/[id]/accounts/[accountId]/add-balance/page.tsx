'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface Customer {
  c_id: number;
  name: string;
  email: string;
}

interface Account {
  id: number;
  name: string;
  email: string;
  iban: string;
  currency: string;
  balance: string;
  account_type: string;
  status: string;
  username?: string;
  created_at: string;
}

export default function AddBalancePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const accountId = params.accountId as string;
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState<string>('0.00');
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [customerId, accountId]);

  const fetchData = async () => {
    try {
      // Fetch customer data
      const customerResponse = await fetch(`/api/customers/${customerId}`);
      const customerData = await customerResponse.json();
      
      if (customerData.success) {
        setCustomer(customerData.data);
      }

      // Fetch account data
      const accountResponse = await fetch(`/api/accounts/${accountId}`);
      const accountData = await accountResponse.json();
      
      if (accountData.success) {
        setAccount(accountData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description: `Initial deposit for ${account?.account_type} account opening`
        })
      });

      const result = await response.json();

      if (result.success) {
        // Redirect back to customer page
        router.push(`/customers/${customerId}`);
      } else {
        alert(result.error?.message || 'Failed to add balance');
      }
    } catch (error) {
      console.error('Error adding balance:', error);
      alert('Failed to add balance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip adding balance and go back to customer page
    router.push(`/customers/${customerId}`);
  };

  if (pageLoading || !customer || !account) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <Link href={`/customers/${customerId}`}>
                    <button className="text-gray-600 hover:text-gray-900">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </Link>
                  <h1 className="text-3xl font-bold text-gray-900">Add Initial Balance</h1>
                </div>
                <p className="text-gray-600 mt-1">Step 2 of 2: Add initial balance to the account</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Account Created Successfully */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-green-900">Account Created Successfully!</h3>
                <p className="text-green-800 mt-1">
                  Account <span className="font-mono">{account.iban}</span> has been created for {customer.name}
                </p>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Account Details:</h3>
            <div className="text-blue-800 space-y-1">
              <p><span className="font-medium">Customer:</span> {customer.name}</p>
              <p><span className="font-medium">Account Type:</span> {account.account_type}</p>
              <p><span className="font-medium">IBAN:</span> <span className="font-mono">{account.iban}</span></p>
              <p><span className="font-medium">Currency:</span> {account.currency}</p>
              <p><span className="font-medium">Current Balance:</span> {account.currency} {parseFloat(account.balance).toLocaleString()}</p>
            </div>
          </div>

          {/* Internet Banking Credentials */}
          {account.username && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-8">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-purple-900">Internet Banking Credentials</h3>
              </div>
              <div className="text-purple-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:space-x-6">
                  <div className="mb-2 sm:mb-0">
                    <span className="font-medium">Username:</span>
                    <span className="ml-2 font-mono bg-white px-2 py-1 rounded border text-purple-900">
                      {account.username}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Password:</span>
                    <span className="ml-2 font-mono bg-white px-2 py-1 rounded border text-purple-900">
                      Abcd@1234
                    </span>
                  </div>
                </div>
                <p className="text-sm text-purple-700 mt-3">
                  💡 Use these credentials to login to Internet Banking. Please change your password after first login.
                </p>
              </div>
            </div>
          )}

          {/* Add Balance Form */}
          <div className="bg-white rounded-lg shadow p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Initial Balance</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Balance Amount ({account.currency})
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Enter the amount to deposit into this account. This will create an initial transaction record.
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-yellow-900 mb-2">What happens next?</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      <li>• A credit transaction will be created for the specified amount</li>
                      <li>• The account balance will be updated to reflect this deposit</li>
                      <li>• This transaction will appear in the account's transaction history</li>
                      <li>• You can skip this step and add balance later if needed</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex space-x-4 pt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {isLoading ? 'Adding Balance...' : 'Add Balance & Complete'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Skip for Now
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
