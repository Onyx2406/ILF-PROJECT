'use client';

import { useState, useEffect } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface PaymentPointer {
  id: number;
  name: string;
  email: string;
  iban: string;
  wallet_address_id: string;
  wallet_address_url: string;
  wallet_public_name: string;
  asset_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function PaymentPointersPage() {
  const [paymentPointers, setPaymentPointers] = useState<PaymentPointer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPointer, setSelectedPointer] = useState<PaymentPointer | null>(null);

  useEffect(() => {
    fetchPaymentPointers();
  }, []);

  const fetchPaymentPointers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payment-pointers');
      const data = await response.json();

      if (data.success) {
        setPaymentPointers(data.data);
        console.log(`📋 Loaded ${data.count} payment pointers`);
      } else {
        setError(data.error?.message || 'Failed to load payment pointers');
      }
    } catch (err) {
      console.error('Error fetching payment pointers:', err);
      setError('Failed to load payment pointers');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const removePaymentPointer = async (id: number) => {
    if (!confirm('Are you sure you want to remove this payment pointer?')) {
      return;
    }

    try {
      const response = await fetch(`/api/payment-pointers/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the list
        fetchPaymentPointers();
        setSelectedPointer(null);
      } else {
        setError(data.error?.message || 'Failed to remove payment pointer');
      }
    } catch (err) {
      console.error('Error removing payment pointer:', err);
      setError('Failed to remove payment pointer');
    }
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading payment pointers...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Pointers</h1>
            <p className="text-gray-600">
              All accounts with active Rafiki wallet addresses ({paymentPointers.length} total)
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="text-red-800">
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {paymentPointers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Pointers Found</h3>
              <p className="text-gray-600">
                No accounts have wallet addresses created yet. Create wallet addresses from the account details page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Payment Pointers List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
                    <h2 className="text-xl font-semibold">Active Payment Pointers</h2>
                    <p className="text-green-100">Click on any row to view details</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Account
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Payment Pointer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Wallet Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paymentPointers.map((pointer) => (
                          <tr
                            key={pointer.id}
                            className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                              selectedPointer?.id === pointer.id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => setSelectedPointer(pointer)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{pointer.name}</div>
                                <div className="text-sm text-gray-500">{pointer.email}</div>
                                <div className="text-xs text-gray-400">{pointer.iban}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 font-mono">
                                {pointer.wallet_address_url}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{pointer.wallet_public_name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(pointer.wallet_address_url);
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                                title="Copy payment pointer"
                              >
                                Copy
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePaymentPointer(pointer.id);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Remove payment pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Details Panel */}
              <div className="lg:col-span-1">
                {selectedPointer ? (
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
                      <h3 className="text-lg font-semibold">Payment Pointer Details</h3>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Account Name</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedPointer.name}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedPointer.email}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">IBAN</label>
                        <p className="mt-1 text-sm text-gray-900 font-mono">{selectedPointer.iban}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Payment Pointer URL</label>
                        <div className="mt-1 flex">
                          <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded-l border flex-1">
                            {selectedPointer.wallet_address_url}
                          </p>
                          <button
                            onClick={() => copyToClipboard(selectedPointer.wallet_address_url)}
                            className="bg-blue-500 text-white px-3 py-2 rounded-r hover:bg-blue-600 transition-colors"
                            title="Copy to clipboard"
                          >
                            📋
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Wallet ID</label>
                        <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                          {selectedPointer.wallet_address_id}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Wallet Name</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedPointer.wallet_public_name}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Asset ID</label>
                        <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                          {selectedPointer.asset_id}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Created</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedPointer.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedPointer.updated_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="pt-4 border-t">
                        <button
                          onClick={() => removePaymentPointer(selectedPointer.id)}
                          className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
                        >
                          Remove Payment Pointer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600">Select a payment pointer to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}