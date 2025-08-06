'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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

interface Asset {
  id: string;
  code: string;
  scale: number;
}

export default function AccountDetailsPage() {
  const params = useParams();
  const accountId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (accountId) {
      fetchAccountDetails();
      fetchAssets();
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
    }
  };

  const fetchAssets = async () => {
    try {
      console.log('🔍 Fetching assets from /api/assets...');
      const response = await fetch('/api/assets');
      console.log('📊 Assets fetch response status:', response.status);
      
      const result = await response.json();
      console.log('📦 Assets fetch result:', result);

      if (result.success && result.data) {
        console.log('✅ Assets loaded successfully:', result.data.length, 'assets');
        setAssets(result.data);
        if (result.data.length > 0) {
          setSelectedAsset(result.data[0].id);
          console.log('🎯 Selected first asset:', result.data[0].id);
        }
        
        if (result.isMock) {
          setMessage({
            type: 'error',
            text: 'Using mock assets - Rafiki connection failed'
          });
        }
      } else {
        console.error('❌ Failed to fetch assets:', result);
        setMessage({
          type: 'error',
          text: `Failed to load assets: ${result.error?.message || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('❌ Error fetching assets:', error);
      setMessage({
        type: 'error',
        text: 'Network error while fetching assets'
      });
    } finally {
      setLoading(false);
    }
  };

  // Updated function to add wallet data to the main accounts table
  const addWalletToAccount = async (walletData: { id: string; url: string; publicName: string }) => {
    try {
      const response = await fetch(`/api/accounts/${account?.id}/wallet`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address_id: walletData.id,
          wallet_address_url: walletData.url,
          wallet_public_name: walletData.publicName,
          asset_id: selectedAsset,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Wallet data added to account successfully');
        // Update local account state
        setAccount(prev => prev ? {
          ...prev,
          wallet_address_id: walletData.id,
          wallet_address_url: walletData.url,
          wallet_public_name: walletData.publicName,
          asset_id: selectedAsset
        } : null);
      } else {
        console.error('❌ Failed to add wallet data to account:', result.error);
      }
    } catch (error) {
      console.error('❌ Error adding wallet data to account:', error);
    }
  };

  const createWalletAddress = async () => {
    if (!selectedAsset || !account) {
      setMessage({ type: 'error', text: 'Please select an asset first' });
      return;
    }

    setCreatingWallet(true);
    setMessage(null);

    try {
      console.log('🚀 Creating wallet address for:', {
        assetId: selectedAsset,
        publicName: `${account.name} - ${assets.find(a => a.id === selectedAsset)?.code || 'Unknown'} Wallet`,
        accountIban: account.iban // Pass the account IBAN
      });

      const response = await fetch('/api/wallet-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset,
          publicName: `${account.name} - ${assets.find(a => a.id === selectedAsset)?.code || 'Unknown'} Wallet`,
          accountIban: account.iban // Include the IBAN
        })
      });

      console.log('📊 Wallet creation response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('📦 Wallet creation result:', result);

      if (result.success) {
        // Add wallet data to the main accounts table
        await addWalletToAccount(result.data);
        
        setMessage({
          type: 'success',
          text: `Wallet address created successfully: ${result.data.url}${result.mock ? ' (Mock for testing)' : ''}`
        });

        // Refresh account details to show the new wallet
        await fetchAccountDetails();
      } else {
        setMessage({
          type: 'error',
          text: result.error?.message || 'Failed to create wallet address'
        });
      }
    } catch (error) {
      console.error('❌ Error creating wallet address:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while creating wallet address'
      });
    } finally {
      setCreatingWallet(false);
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
              <p className="text-gray-600 mt-2">View account information and create wallet address</p>
            </div>
            <a
              href="/accounts-view"
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Account Information Card */}
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
            </div>
          </div>

          {/* Create Wallet Address Card */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
              <h2 className="text-xl font-semibold mb-2">Create Wallet Address</h2>
              <p className="text-purple-100">Generate Rafiki payment pointer</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {/* Asset Selection */}
                <div>
                  <label htmlFor="asset" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Asset
                  </label>
                  {assets.length === 0 ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500">
                      No assets available - Check Rafiki connection
                    </div>
                  ) : (
                    <select
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select an asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.code} | ID: {asset.id.substring(0, 12)}...{asset.id.length > 12 ? asset.id.substring(-4) : ''} | Scale: {asset.scale}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Debug Info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
                    <p><strong>Debug Info:</strong></p>
                    <p>Assets loaded: {assets.length}</p>
                    <p>Selected asset: {selectedAsset}</p>
                    <p>Loading: {loading.toString()}</p>
                  </div>
                )}

                {/* Create Button */}
                <button
                  onClick={createWalletAddress}
                  disabled={creatingWallet || !selectedAsset || assets.length === 0}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    creatingWallet || !selectedAsset || assets.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {creatingWallet ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating Wallet Address...
                    </div>
                  ) : assets.length === 0 ? (
                    '❌ No Assets Available'
                  ) : (
                    '🚀 Create Wallet Address'
                  )}
                </button>

                {/* Additional Info */}
                <div className="text-xs text-gray-500 space-y-1">
                  <p>• The wallet address will be stored in the ILP_active_accounts table</p>
                  <p>• You can create multiple wallet addresses for different currencies</p>
                  <p>• Each wallet address is unique and can be used for receiving payments</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </SidebarLayout>
  );
}
