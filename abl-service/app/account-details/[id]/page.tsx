'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface Account {
  id: string;
  name: string;
  email: string;
  iban: string;
  balance: string;
  status: 'active' | 'inactive' | 'deleted';
  wallet_address_id?: string;
  wallet_address_url?: string;
  wallet_public_name?: string;
  asset_id?: string;
  created_at: string;
  updated_at: string;
}

export default function AccountDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (accountId) {
      fetchAccountDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const fetchAccountDetails = async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`);
      const result = await response.json();

      if (result.success) {
        setAccount(result.data);
      } else {
        setMessage({
          type: 'error',
          text: result.error?.message || 'Account not found'
        });
      }
    } catch (error) {
      console.error('Error fetching account:', error);
      setMessage({
        type: 'error',
        text: 'An error occurred while fetching account details'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">Loading account details...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (!account) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Account not found</h3>
            <p className="text-gray-500 mb-6">The requested account does not exist.</p>
            <a 
              href="/accounts-view"
              className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              ← Back to Accounts
            </a>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-green-800">📋 Account Details</h1>
                <p className="text-gray-600 mt-2">View account information</p>
              </div>
              <a
                href="/accounts-management"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to All Accounts
              </a>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className={`px-4 py-3 rounded-md ${
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
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-8 flex items-center">
              <span className="mr-3">👤</span>
              Account Information
            </h2>
            <div className="space-y-6">
              {/* Customer Name */}
              <div className="border-b border-gray-100 pb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Customer Name</p>
                <p className="text-xl font-semibold text-gray-900">{account.name}</p>
              </div>
              
              {/* Email */}
              <div className="border-b border-gray-100 pb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Email Address</p>
                <p className="text-lg font-medium text-gray-900 break-all">{account.email}</p>
              </div>
              
              {/* IBAN */}
              <div className="border-b border-gray-100 pb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">IBAN</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-lg font-mono font-semibold text-gray-900 break-all">{account.iban}</p>
                </div>
              </div>
              
              {/* Balance */}
              <div className="border-b border-gray-100 pb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Account Balance</p>
                <p className="text-3xl font-bold text-green-600">PKR {parseFloat(account.balance || '0').toFixed(2)}</p>
              </div>
              
              {/* Status */}
              <div className="border-b border-gray-100 pb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Account Status</p>
                <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${
                  account.status === 'active' ? 'bg-green-100 text-green-800' :
                  account.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                </span>
              </div>
              
              {/* Created Date */}
              <div className="pb-2">
                <p className="text-sm font-medium text-gray-500 mb-2">Account Created</p>
                <p className="text-lg font-medium text-gray-900">{new Date(account.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>

              {/* Wallet Information (if exists) */}
              {account.wallet_address_url && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">💳</span>
                    Wallet Information
                  </h3>
                  <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div>
                      <p className="text-sm font-medium text-blue-700 mb-2">Payment Pointer</p>
                      <div className="bg-white border border-blue-300 rounded-lg p-3">
                        <p className="text-sm font-mono text-blue-900 break-all">
                          {account.wallet_address_url}
                        </p>
                      </div>
                    </div>
                    {account.wallet_public_name && (
                      <div>
                        <p className="text-sm font-medium text-blue-700 mb-1">Wallet Public Name</p>
                        <p className="text-sm font-medium text-blue-900">{account.wallet_public_name}</p>
                      </div>
                    )}
                    {account.asset_id && (
                      <div>
                        <p className="text-sm font-medium text-blue-700 mb-1">Asset ID</p>
                        <p className="text-sm font-mono text-blue-900">{account.asset_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Account Actions */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Account Management</h4>
                <div className="flex space-x-3">
                  <button
                    onClick={() => router.push(`/edit-account/${account.id}`)}
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
