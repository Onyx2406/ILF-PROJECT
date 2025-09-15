'use client';

import { useState, useEffect } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface WebhookEvent {
  id: string;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
  walletAddressId?: string;
  accountId?: string;
  status: 'received' | 'processed' | 'error';
  forwardedBy?: string;
  forwardedAt?: string;
  originalSource?: string;
  resourceId?: string;
  createdAt?: string;
}

interface WebhookStats {
  total: number;
  byStatus: {
    received: number;
    processed: number;
    error: number;
  };
  byType: Record<string, number>;
  lastWebhook: string | null;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/webhooks/rafiki');
      if (response.ok) {
        const result = await response.json();
        setWebhooks(result.data.webhooks);
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearWebhooks = async () => {
    try {
      const response = await fetch('/api/webhooks/rafiki', { method: 'DELETE' });
      if (response.ok) {
        setWebhooks([]);
        setStats({ total: 0, byStatus: { received: 0, processed: 0, error: 0 }, byType: {}, lastWebhook: null });
      }
    } catch (error) {
      console.error('Error clearing webhooks:', error);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchWebhooks, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'text-green-600 bg-green-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getTypeColor = (type: string) => {
    if (type.includes('incoming')) return 'text-blue-600 bg-blue-100';
    if (type.includes('outgoing')) return 'text-purple-600 bg-purple-100';
    if (type.includes('wallet')) return 'text-green-600 bg-green-100';
    if (type.includes('liquidity')) return 'text-orange-600 bg-orange-100';
    return 'text-gray-600 bg-gray-100';
  };

  const filteredWebhooks = webhooks.filter(webhook => {
    if (filter === 'all') return true;
    if (filter === 'payments') return webhook.type.includes('payment');
    if (filter === 'wallet') return webhook.type.includes('wallet');
    if (filter === 'alerts') return webhook.type.includes('liquidity');
    return webhook.status === filter;
  });

  return (
    <SidebarLayout>
      <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔔 Rafiki Webhooks</h1>
          <p className="text-gray-600 mt-1">Monitor and manage incoming webhook events from Rafiki</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchWebhooks}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={clearWebhooks}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            🗑️ Clear All
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Webhooks</h3>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Processed</h3>
            <div className="text-2xl font-bold text-green-600">{stats.byStatus.processed}</div>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Pending</h3>
            <div className="text-2xl font-bold text-yellow-600">{stats.byStatus.received}</div>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Errors</h3>
            <div className="text-2xl font-bold text-red-600">{stats.byStatus.error}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {['all', 'payments', 'wallet', 'alerts', 'processed', 'received', 'error'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === filterOption
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Webhook List */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Webhook Events</h2>
          <p className="text-gray-600 text-sm">Recent webhook events received from Rafiki via OC Service</p>
        </div>
        
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading webhooks...</p>
            </div>
          ) : filteredWebhooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔔</div>
              <p>No webhooks found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWebhooks.map((webhook) => (
                <div key={webhook.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(webhook.type)}`}>
                          {webhook.type}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.status)}`}>
                          {webhook.status === 'processed' ? '✅' : webhook.status === 'error' ? '❌' : '⏳'} {webhook.status}
                        </span>
                        {webhook.forwardedBy && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
                            via {webhook.forwardedBy}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p><strong>Webhook ID:</strong> {webhook.id}</p>
                          <p><strong>Timestamp:</strong> {new Date(webhook.timestamp).toLocaleString()}</p>
                          {webhook.walletAddressId && (
                            <p><strong>Wallet Address ID:</strong> {webhook.walletAddressId}</p>
                          )}
                        </div>
                        <div>
                          {webhook.data.id !== undefined && (
                            <p><strong>Resource ID:</strong> {String(webhook.data.id)}</p>
                          )}
                          {webhook.originalSource && (
                            <p><strong>Source:</strong> {webhook.originalSource}</p>
                          )}
                          {webhook.createdAt && (
                            <p><strong>Created:</strong> {new Date(webhook.createdAt).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                      
                      <details className="mt-3">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm">
                          📋 View Webhook Data
                        </summary>
                        <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto border">
                          {JSON.stringify(webhook.data, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </SidebarLayout>
  );
}
