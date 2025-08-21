'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface Customer {
  c_id: number;
  name: string;
  email: string;
  phone_number: string;
  address: string;
  cnic: string;
  dob: string;
  status: string;
  created_at: string;
}

interface Account {
  id: number;
  name: string;
  email: string;
  iban: string;
  currency: string;
  balance: string;
  status: string;
  username?: string;
  created_at: string;
}

interface Transaction {
  id: number;
  account_id: number;
  transaction_type: string;
  amount: string;
  currency: string;
  balance_after: string;
  description: string;
  reference_number: string;
  status: string;
  created_at: string;
  related_account_name?: string;
  related_account_iban?: string;
}

type TabType = 'accounts' | 'transactions';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('accounts');

  useEffect(() => {
    if (customerId) {
      fetchCustomer();
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId && customer) {
      fetchCustomerAccounts();
    }
  }, [customerId, customer]);

  useEffect(() => {
    if (activeTab === 'transactions' && transactions.length === 0 && !transactionsLoading) {
      fetchCustomerTransactions();
    }
  }, [activeTab]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      const data = await response.json();
      
      if (data.success) {
        setCustomer(data.data);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerAccounts = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}/accounts`);
      const data = await response.json();
      
      if (data.success) {
        setAccounts(data.data);
      }
    } catch (error) {
      console.error('Error fetching customer accounts:', error);
    } finally {
      setAccountsLoading(false);
    }
  };

  const fetchCustomerTransactions = async () => {
    setTransactionsLoading(true);
    try {
      let allTransactions: Transaction[] = [];
      
      // Fetch transactions for all accounts
      for (const account of accounts) {
        const response = await fetch(`/api/accounts/${account.id}/transactions`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Add account info to each transaction
            const accountTransactions = result.data.transactions.map((t: Transaction) => ({
              ...t,
              account_name: account.name,
              account_iban: account.iban
            }));
            allTransactions = [...allTransactions, ...accountTransactions];
          }
        }
      }
      
      // Sort by date (newest first)
      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Update the useEffect to fetch transactions when accounts change and when transactions tab is selected
  useEffect(() => {
    if (activeTab === 'transactions' && accounts.length > 0) {
      fetchCustomerTransactions();
    }
  }, [activeTab, accounts]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateTotalBalance = () => {
    return accounts.reduce((sum, account) => sum + parseFloat(account.balance || '0'), 0);
  };

  const handleDeleteClick = () => {
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customer) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/customers/${customer.c_id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        router.push('/customers');
      } else {
        alert('Failed to delete customer');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Error deleting customer');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading customer details...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (!customer) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Customer not found</p>
            <Link href="/customers">
              <button className="mt-4 text-green-600 hover:text-green-800">
                ← Back to Customers
              </button>
            </Link>
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
                  <Link href="/customers">
                    <button className="text-gray-600 hover:text-gray-900">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </Link>
                  <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    customer.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {customer.status}
                  </span>
                </div>
                <p className="text-gray-600 mt-1">Customer ID: {customer.c_id}</p>
              </div>
              <div className="flex space-x-3">
                <Link href={`/customers/${customerId}/accounts/create`}>
                  <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add Account</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Customer Information */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Customer Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Full Name</label>
                    <p className="text-gray-900">{customer.name}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{customer.email}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-gray-900">{customer.phone_number}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">CNIC</label>
                    <p className="text-gray-900">{customer.cnic}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Date of Birth</label>
                    <p className="text-gray-900">{formatDate(customer.dob)}</p>
                  </div>
                  
                  {customer.address && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Address</label>
                      <p className="text-gray-900">{customer.address}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Customer Since</label>
                    <p className="text-gray-900">{formatDate(customer.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Account Summary */}
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Summary</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{accounts.length}</div>
                    <div className="text-sm text-gray-600">Total Accounts</div>
                  </div>
                </div>
              </div>

              {/* Customer Actions */}
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Actions</h2>
                <div className="space-y-3">
                  <Link href={`/customers/${customerId}/edit`}>
                    <button className="w-full flex items-center justify-center px-4 py-3 border border-blue-300 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors group">
                      <svg className="w-5 h-5 mr-3 text-blue-600 group-hover:text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="font-medium">Edit Customer Information</span>
                    </button>
                  </Link>
                  
                  <button 
                    onClick={handleDeleteClick}
                    className="w-full flex items-center justify-center px-4 py-3 border border-red-300 rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors group"
                  >
                    <svg className="w-5 h-5 mr-3 text-red-600 group-hover:text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="font-medium">Delete Customer</span>
                  </button>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 text-center">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Deleting a customer will also remove all associated accounts
                  </p>
                </div>
              </div>
            </div>

            {/* Accounts & Transactions Tabs */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                      onClick={() => setActiveTab('accounts')}
                      className={`py-4 px-6 border-b-2 font-medium text-sm ${
                        activeTab === 'accounts'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Accounts ({accounts.length})
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className={`py-4 px-6 border-b-2 font-medium text-sm ${
                        activeTab === 'transactions'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Transactions
                      </div>
                    </button>
                  </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'accounts' && (
                  <div>
                    {accountsLoading ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2">Loading accounts...</p>
                      </div>
                    ) : accounts.length === 0 ? (
                      <div className="p-8 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts yet</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by creating a new account for this customer.</p>
                        <div className="mt-6">
                          <Link href={`/customers/${customerId}/accounts/create`}>
                            <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                              + Add Account
                            </button>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IBAN</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {accounts.map((account) => (
                              <tr key={account.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">Account #{account.id}</div>
                                    <div className="text-sm text-gray-500">{account.currency} Account</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 font-mono">{account.iban}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {account.username ? (
                                    <div className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                      {account.username}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400">No username</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {account.currency} {parseFloat(account.balance).toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    account.status === 'active' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {account.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(account.created_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'transactions' && (
                  <div>
                    {transactionsLoading ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2">Loading transactions...</p>
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="p-8 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions yet</h3>
                        <p className="mt-1 text-sm text-gray-500">Transactions will appear here when accounts are created with initial balances or when transfers are made.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance After</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.map((transaction) => (
                              <tr key={transaction.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{formatDate(transaction.created_at)}</div>
                                  <div className="text-xs text-gray-500">{new Date(transaction.created_at).toLocaleTimeString()}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    Account #{transaction.account_id}
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono">
                                    {(transaction as any).account_iban}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    transaction.transaction_type === 'CREDIT'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.transaction_type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`text-sm font-medium ${
                                    transaction.transaction_type === 'CREDIT' 
                                      ? 'text-green-600' 
                                      : 'text-red-600'
                                  }`}>
                                    {transaction.transaction_type === 'CREDIT' ? '+' : '-'}
                                    {transaction.currency} {parseFloat(transaction.amount).toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {transaction.currency} {parseFloat(transaction.balance_after).toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-900">{transaction.description}</div>
                                  {transaction.reference_number && (
                                    <div className="text-xs text-gray-500 font-mono">
                                      Ref: {transaction.reference_number}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    transaction.status === 'completed'
                                      ? 'bg-green-100 text-green-800'
                                      : transaction.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Customer</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete <strong>{customer?.name}</strong>? 
                </p>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex">
                    <svg className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">This action cannot be undone!</p>
                      <p className="mt-1">This will permanently delete:</p>
                      <ul className="mt-1 list-disc list-inside space-y-1">
                        <li>Customer information</li>
                        <li>All customer accounts ({accounts.length} account{accounts.length !== 1 ? 's' : ''})</li>
                        <li>All transaction history</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={handleDeleteCancel}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}