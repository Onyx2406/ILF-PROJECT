'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function AccountsViewPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/accounts');
      const result = await response.json();

      if (result.success) {
        setAccounts(result.data);
      } else {
        setError('Failed to fetch accounts');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('An error occurred while fetching accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountClick = (accountId: string) => {
    router.push(`/account-details/${accountId}`);
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) {
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Remove from local state or refetch
        setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
      } else {
        alert('Failed to delete account: ' + result.error?.message);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('An error occurred while deleting the account');
    }
  };

  const handleEditAccount = (accountId: string) => {
    // Navigate to edit page or open modal
    router.push(`/edit-account/${accountId}`);
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">Loading accounts...</p>
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
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-green-800">
                  👥 All ABL Accounts
                </h1>
                <p className="text-gray-600 mt-2">
                  Click on any account to view details and create wallet address
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-700">
                    {accounts.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Accounts</div>
                </div>
                <a
                  href="/create-account"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  + New Account
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {error}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Loading accounts...
              </h3>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Error loading accounts
              </h3>
              <p className="text-gray-500 mb-6">{error}</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏦</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                No accounts found
              </h3>
              <p className="text-gray-500 mb-6">
                Create your first ABL account to get started.
              </p>
              <a
                href="/create-account"
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Create First Account
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                  <div className="col-span-2">Customer Name</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-3">IBAN</div>
                  <div className="col-span-1">Balance</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Wallet</div>
                  <div className="col-span-1">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="px-6 py-4 hover:bg-blue-50 cursor-pointer transition-colors group"
                    onClick={() => handleAccountClick(account.id)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Customer Name */}
                      <div className="col-span-2 font-medium text-gray-900 group-hover:text-blue-600 truncate">
                        {account.name}
                      </div>

                      {/* Email */}
                      <div className="col-span-3 text-sm text-gray-600 truncate" title={account.email}>
                        {account.email}
                      </div>

                      {/* IBAN */}
                      <div className="col-span-3 font-mono text-xs bg-gray-100 px-2 py-1 rounded group-hover:bg-blue-100 truncate" title={account.iban}>
                        {account.iban}
                      </div>

                      {/* Balance */}
                      <div className="col-span-1 text-sm font-medium ">
                        PKR {parseFloat(account.balance || '0').toFixed(2)}
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            account.status.toLowerCase() === 'active'
                              ? 'bg-green-100 text-green-800'
                              : account.status.toLowerCase() === 'inactive'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {account.status}
                        </span>
                      </div>

                      {/* Wallet */}
                      <div className="col-span-1 text-sm text-center">
                        {account.wallet_address_url ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-1">
                        <div className="flex justify-end">
                          <div className="relative group/actions">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="text-gray-400 hover:text-gray-600 p-1"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            
                            {/* Dropdown Menu */}
                            <div className="absolute right-0 top-6 w-32 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover/actions:opacity-100 group-hover/actions:visible transition-all duration-200 z-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/account-details/${account.id}`);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditAccount(account.id);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAccount(account.id);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          {accounts.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">🏦</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">
                      Total Accounts
                    </p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {accounts.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">
                      Active Accounts
                    </p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {accounts.filter(
                        (acc) => acc.status.toLowerCase() === 'active'
                      ).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
