'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  status: string;
  accountCount: number;
}

interface Account {
  id: number;
  name: string;
  iban: string;
  currency: string;
  balance: string;
  account_type: string;
  status: string;
  wallet_address?: string;
  wallet_id?: string;
  created_at: string;
}

interface AuthenticatedAccount {
  id: number;
  username: string;
  iban: string;
}

interface Transaction {
  id: number;
  amount: string;
  currency: string;
  transaction_type: string;
  status: string;
  description: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authenticatedAccount, setAuthenticatedAccount] = useState<AuthenticatedAccount | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [walletLoading, setWalletLoading] = useState<Record<number, boolean>>({});
  const [walletError, setWalletError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'receive'>('overview');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showIbanModal, setShowIbanModal] = useState(false);
  const [copied, setCopied] = useState<string>('');

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    const customerData = localStorage.getItem('customer');
    const authenticatedAccountData = localStorage.getItem('authenticatedAccount');
    
    if (!token || !customerData || !authenticatedAccountData) {
      router.push('/');
      return;
    }

    try {
      const parsedCustomer = JSON.parse(customerData);
      const parsedAuthAccount = JSON.parse(authenticatedAccountData);
      
      setCustomer(parsedCustomer);
      setAuthenticatedAccount(parsedAuthAccount);
      
      // Fetch only the authenticated account instead of all customer accounts
      fetchAuthenticatedAccount(parsedCustomer.id, parsedAuthAccount.id);
    } catch (error) {
      console.error('Error parsing stored data:', error);
      router.push('/');
    }
  }, [router]);

  const fetchAuthenticatedAccount = async (customerId: number, accountId: number) => {
    try {
      setIsLoading(true);
      // Fetch only the authenticated account using the new accountId parameter
      const response = await axios.get(`/api/accounts?customerId=${customerId}&accountId=${accountId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setAccounts(response.data.data || []);
        if (response.data.data && response.data.data.length > 0) {
          // Also fetch transactions for this account
          await fetchTransactions(response.data.data[0].id);
        }
      } else {
        setError('Failed to load account details');
      }
    } catch (error: any) {
      console.error('Error fetching account:', error);
      setError('Failed to load account details');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async (accountId: number) => {
    try {
      // This will fetch recent transactions for the account
      const response = await axios.get(`/api/transactions?accountId=${accountId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setTransactions(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      // Don't set error here, just log it as transactions are not critical
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareWalletAddress = () => {
    if (accounts[0]?.wallet_address) {
      setShowAddressModal(true);
    }
  };

  const shareIban = () => {
    if (accounts[0]?.iban) {
      setShowIbanModal(true);
    }
  };

  const fetchAccounts = async (customerId: number) => {
    try {
      setIsLoading(true);
      // This will go through OC Service to Core Banking - for all accounts (admin view)
      const response = await axios.get(`/api/accounts?customerId=${customerId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setAccounts(response.data.data || []);
      } else {
        setError('Failed to load accounts');
      }
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      setError('Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('customer');
    localStorage.removeItem('authenticatedAccount');
    router.push('/');
  };

  const createWalletAddress = async (accountId: number) => {
    try {
      setWalletLoading(prev => ({ ...prev, [accountId]: true }));
      setWalletError('');

      // Call the Core Banking service through OC Service
      const response = await axios.post(
        `/api/wallets`,
        { accountId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // Refresh account to show the new wallet address
        if (customer && authenticatedAccount) {
          await fetchAuthenticatedAccount(customer.id, authenticatedAccount.id);
        }
        
        // Show success message
        alert(`Wallet address created successfully: ${response.data.data.walletAddress}`);
      } else {
        setWalletError(response.data.error?.message || 'Failed to create wallet address');
      }
    } catch (error: any) {
      console.error('Error creating wallet address:', error);
      let errorMessage = 'Failed to create wallet address';
      
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setWalletError(errorMessage);
    } finally {
      setWalletLoading(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const formatBalance = (balance: string, currency: string) => {
    const amount = parseFloat(balance || '0');
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAccountTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'savings':
        return 'bg-blue-100 text-blue-800';
      case 'checking':
        return 'bg-purple-100 text-purple-800';
      case 'business':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance || '0'), 0);

  if (isLoading && !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-orange-500 to-blue-700 shadow-lg border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src="/A.png" 
                alt="Allied Bank Limited Logo" 
                className="w-12 h-10 object-contain bg-white rounded-lg p-2 shadow-lg"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  ABL Digital Wallet
                </h1>
                <p className="text-sm text-orange-200">Welcome back, {customer?.name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-sm text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-br from-orange-500 to-blue-700 rounded-3xl p-8 text-white shadow-2xl mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-orange-200 text-sm font-medium">Total Balance</p>
              <h2 className="text-4xl font-bold mt-2">
                {accounts.length > 0 ? formatBalance(accounts[0].balance, accounts[0].currency) : 'Loading...'}
              </h2>
              <p className="text-orange-200 text-sm mt-2">
                Account: {authenticatedAccount?.username}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex space-x-4">
            <button
              onClick={shareIban}
              className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-all duration-200 hover:scale-105"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Share IBAN</span>
              </div>
            </button>
            
            {accounts[0]?.wallet_address ? (
              <button
                onClick={shareWalletAddress}
                className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-all duration-200 hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                  </svg>
                  <span className="font-medium">Share Wallet</span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => accounts[0] && createWalletAddress(accounts[0].id)}
                disabled={accounts[0] && walletLoading[accounts[0].id]}
                className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-all duration-200 hover:scale-105 disabled:opacity-50"
              >
                <div className="flex items-center justify-center space-x-2">
                  {accounts[0] && walletLoading[accounts[0].id] ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                  <span className="font-medium">Create Wallet</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-6">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: '🏠' },
              { id: 'transactions', label: 'Transactions', icon: '📊' },
              { id: 'receive', label: 'Receive Money', icon: '💰' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Account Details */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Account Details</h3>
              {accounts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Holder</label>
                      <p className="text-lg font-semibold text-gray-900">{accounts[0].name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">IBAN</label>
                      <p className="text-lg font-mono text-gray-900">{accounts[0].iban}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Type</label>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getAccountTypeColor(accounts[0].account_type)}`}>
                        {accounts[0].account_type}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Current Balance</label>
                      <p className="text-2xl font-bold text-gray-900">{formatBalance(accounts[0].balance, accounts[0].currency)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Wallet Status</label>
                      <div className="flex items-center space-x-2">
                        {accounts[0].wallet_address ? (
                          <>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Connected
                            </span>
                            <p className="text-xs text-gray-500 font-mono">
                              {accounts[0].wallet_address.substring(0, 20)}...
                            </p>
                          </>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⚠ Not Connected
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Created</label>
                      <p className="text-gray-900">{formatDate(accounts[0].created_at)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions yet</h3>
                <p className="mt-1 text-sm text-gray-500">When you receive money, transactions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => {
                  console.log('Transaction debug:', transaction.transaction_type, transaction.amount, transaction.description);
                  return (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.transaction_type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {transaction.transaction_type === 'CREDIT' ? '↓' : '↑'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-sm text-gray-500">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        transaction.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.transaction_type === 'CREDIT' ? '+' : '-'}{transaction.currency} {Math.abs(parseFloat(transaction.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'receive' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Receive Money</h3>
            <p className="text-gray-600 mb-6">Share your payment details to receive money from others</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* IBAN Sharing */}
              <div className="border border-gray-200 rounded-xl p-6 hover:border-orange-300 transition-colors">
                <h4 className="font-semibold text-gray-900 mb-3">Bank Transfer (IBAN)</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Account Holder</label>
                    <p className="font-medium">{accounts[0]?.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">IBAN</label>
                    <p className="font-mono text-sm bg-gray-50 p-2 rounded">{accounts[0]?.iban}</p>
                  </div>
                  <button
                    onClick={shareIban}
                    className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Share IBAN Details
                  </button>
                </div>
              </div>

              {/* Wallet Sharing */}
              <div className="border border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors">
                <h4 className="font-semibold text-gray-900 mb-3">Digital Wallet</h4>
                {accounts[0]?.wallet_address ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500">Wallet Address</label>
                      <p className="font-mono text-sm bg-gray-50 p-2 rounded break-all">{accounts[0].wallet_address}</p>
                    </div>
                    <button
                      onClick={shareWalletAddress}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Share Wallet Address
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                    </svg>
                    <p className="text-gray-500 mb-4">No wallet connected</p>
                    <button
                      onClick={() => accounts[0] && createWalletAddress(accounts[0].id)}
                      disabled={accounts[0] && walletLoading[accounts[0].id]}
                      className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {accounts[0] && walletLoading[accounts[0].id] ? 'Creating...' : 'Create Wallet'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {walletError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">Wallet Error: {walletError}</p>
          </div>
        )}
      </div>

      {/* IBAN Share Modal */}
      {showIbanModal && accounts[0] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Share IBAN Details</h3>
              <p className="text-gray-600">Share these details to receive bank transfers</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-gray-500">Account Holder</label>
                <p className="font-semibold text-gray-900">{accounts[0].name}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-sm font-medium text-gray-500">IBAN</label>
                    <p className="font-mono text-gray-900">{accounts[0].iban}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(accounts[0].iban, 'iban')}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    {copied === 'iban' ? '✓' : '📋'}
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-gray-500">Bank</label>
                <p className="font-semibold text-gray-900">Allied Bank Limited (ABL)</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowIbanModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const shareText = `Send money to:\nName: ${accounts[0].name}\nIBAN: ${accounts[0].iban}\nBank: Allied Bank Limited (ABL)`;
                  if (navigator.share) {
                    navigator.share({ text: shareText });
                  } else {
                    copyToClipboard(shareText, 'details');
                  }
                }}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Share Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Address Share Modal */}
      {showAddressModal && accounts[0]?.wallet_address && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Share Wallet Address</h3>
              <p className="text-gray-600">Share this address to receive digital payments</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-500">Wallet Address</label>
                  <p className="font-mono text-sm text-gray-900 break-all">{accounts[0].wallet_address}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(accounts[0].wallet_address!, 'address')}
                  className="ml-2 text-blue-600 hover:text-blue-700"
                >
                  {copied === 'address' ? '✓' : '📋'}
                </button>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAddressModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const shareText = `Send digital payment to:\nWallet: ${accounts[0].wallet_address}\nName: ${accounts[0].name}`;
                  if (navigator.share) {
                    navigator.share({ text: shareText });
                  } else {
                    copyToClipboard(shareText, 'wallet');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Share Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
