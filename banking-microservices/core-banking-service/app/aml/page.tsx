'use client';

import { useState, useEffect } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';

interface PendingPayment {
  id: number;
  webhookId: string;
  accountId: number;
  accountName: string;
  accountEmail: string;
  accountIban: string;
  amount: number;
  currency: string;
  originalAmount?: number; // Original amount before conversion
  originalCurrency?: string; // Original currency before conversion
  conversionRate?: number; // Exchange rate used for conversion
  paymentReference: string;
  paymentSource: string;
  senderInfo: any;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
  autoApprovalEligible: boolean;
  createdAt: string;
  availableBalance: number;
  bookBalance: number;
  webhookData: any;
}

interface BlockedPayment {
  id: number;
  webhook_id: string;
  account_id: number;
  amount: number | string;
  currency: string;
  blocked_reason: string;
  matched_block_list_id: number;
  risk_score: number;
  blocked_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: string;
  blocked_entity_name?: string;
  severity?: number;
}

interface BlockListEntry {
  id: number;
  name: string;
  type: 'INDIVIDUAL' | 'ENTITY' | 'ORGANIZATION';
  reason: string;
  severity: number;
  is_active: boolean;
  created_at: string;
  added_by: string;
  notes?: string;
}

interface AMLStats {
  totalPending: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  totalAmount: number;
  autoEligible: number;
}

export default function AMLScreeningPage() {
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [blockedPayments, setBlockedPayments] = useState<BlockedPayment[]>([]);
  const [blockList, setBlockList] = useState<BlockListEntry[]>([]);
  const [stats, setStats] = useState<AMLStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'blocked' | 'blocklist'>('pending');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [screeningNotes, setScreeningNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [riskFilter, activeTab]);

  const fetchData = async () => {
    try {
      // Always fetch pending payments for stats
      const pendingParams = new URLSearchParams();
      if (riskFilter !== 'ALL') {
        pendingParams.append('riskLevel', riskFilter);
      }
      
      const pendingResponse = await fetch(`/api/aml/pending-payments?${pendingParams}`);
      const pendingResult = await pendingResponse.json();
      
      if (pendingResult.success) {
        setPendingPayments(pendingResult.data.pendingPayments);
        setStats(pendingResult.data.stats);
      }

      // Fetch blocked payments if on blocked tab
      if (activeTab === 'blocked') {
        const blockedResponse = await fetch('/api/aiml/blocked-payments');
        const blockedResult = await blockedResponse.json();
        if (blockedResult.success) {
          setBlockedPayments(blockedResult.data);
        }
      }

      // Fetch block list if on blocklist tab
      if (activeTab === 'blocklist') {
        const blockListResponse = await fetch('/api/aiml/block-list');
        const blockListResult = await blockListResponse.json();
        if (blockListResult.success) {
          setBlockList(blockListResult.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (paymentId: number, action: 'APPROVE' | 'REJECT') => {
    setProcessing(true);
    try {
      // All pending payments (both approve and reject) use the pending payments API
      // The updated API now handles the complete reversal flow for rejections
      const response = await fetch('/api/aml/pending-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          action,
          screeningNotes,
          screenedBy: 'AML Officer'
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh the list
        await fetchData();
        setSelectedPayment(null);
        setScreeningNotes('');
        
        if (action === 'REJECT') {
          const reversalInfo = result.data?.reversal?.status === 'COMPLETED' 
            ? `Payment rejected and reversed back to sender (ID: ${result.data.reversal.paymentId})`
            : `Payment rejected with complete reversal flow. ${result.data?.reversal?.error || 'Reversal may require manual intervention'}`;
          alert(reversalInfo);
        } else {
          alert(`Payment ${action.toLowerCase()}d successfully!`);
        }
      } else {
        alert(`Error: ${result.error.message}`);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error processing payment');
    } finally {
      setProcessing(false);
    }
  };

  const getSeverityString = (severity: string | number) => {
    if (typeof severity === 'number') {
      // Convert integer severity to string
      if (severity >= 8) return 'CRITICAL';
      else if (severity >= 6) return 'HIGH';
      else if (severity >= 4) return 'MEDIUM';
      else return 'LOW';
    } else if (typeof severity === 'string') {
      return severity.toUpperCase();
    } else {
      return 'LOW'; // default fallback
    }
  };

  const getSeverityColor = (severity: string | number) => {
    // Handle both integer and string severity values
    let severityString = '';
    
    if (typeof severity === 'number') {
      // Convert integer severity to string
      if (severity >= 8) severityString = 'CRITICAL';
      else if (severity >= 6) severityString = 'HIGH';
      else if (severity >= 4) severityString = 'MEDIUM';
      else severityString = 'LOW';
    } else if (typeof severity === 'string') {
      severityString = severity;
    } else {
      severityString = 'LOW'; // default fallback
    }
    
    switch (severityString?.toUpperCase()) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HIGH': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (amount: number | string, currency: string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numAmount);
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">AML/CFT Screening</h1>
          <p className="text-gray-600">Review and approve incoming payments, monitor blocked transactions</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'pending'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔍 Pending Payments ({pendingPayments.length})
              </button>
              <button
                onClick={() => setActiveTab('blocked')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'blocked'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🚫 Blocked Payments ({blockedPayments.length})
              </button>
              <button
                onClick={() => setActiveTab('blocklist')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'blocklist'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 Block List ({blockList.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{stats.totalPending}</div>
              <div className="text-sm text-gray-600">Total Pending</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">{stats.lowRisk}</div>
              <div className="text-sm text-gray-600">Low Risk</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600">{stats.mediumRisk}</div>
              <div className="text-sm text-gray-600">Medium Risk</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-600">{stats.highRisk}</div>
              <div className="text-sm text-gray-600">High Risk</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-indigo-600">{stats.autoEligible}</div>
              <div className="text-sm text-gray-600">Auto Eligible</div>
            </div>
          </div>
        )}

        {/* Filters - Only show for pending payments */}
        {activeTab === 'pending' && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex space-x-4">
              <label className="text-sm font-medium text-gray-700">Risk Level:</label>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="ALL">All</option>
                <option value="LOW">Low Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="HIGH">High Risk</option>
              </select>
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'pending' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pending Payments</h2>
            </div>
            
            {pendingPayments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No pending payments found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Incoming Remittance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Source
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Received
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{payment.accountName}</div>
                          <div className="text-sm text-gray-500">{payment.accountEmail}</div>
                          <div className="text-sm text-gray-500">{payment.accountIban}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {payment.originalAmount && payment.originalCurrency ? (
                            <div className="text-sm font-medium text-blue-600">
                              {formatCurrency(payment.originalAmount, payment.originalCurrency)}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">
                              N/A
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(payment.amount, payment.currency)}
                          </div>
                          {payment.autoApprovalEligible && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Auto Eligible
                            </span>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskColor(payment.riskLevel)}`}>
                            {payment.riskLevel} ({payment.riskScore})
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{payment.paymentSource}</div>
                          <div className="text-sm text-gray-500">{payment.paymentReference}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(payment.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'blocked' && (
          <BlockedPaymentsSection 
            blockedPayments={blockedPayments}
            formatCurrency={formatCurrency}
            getSeverityColor={getSeverityColor}
          />
        )}

        {activeTab === 'blocklist' && (
          <BlockListSection 
            blockList={blockList}
            getSeverityColor={getSeverityColor}
            getSeverityString={getSeverityString}
          />
        )}

        {/* Payment Review Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Payment Review - {selectedPayment.paymentReference}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Account Information */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Account Information</h4>
                    <div className="space-y-1 text-sm">
                      <div><span className="font-medium">Name:</span> {selectedPayment.accountName}</div>
                      <div><span className="font-medium">Email:</span> {selectedPayment.accountEmail}</div>
                      <div><span className="font-medium">IBAN:</span> {selectedPayment.accountIban}</div>
                      <div><span className="font-medium">Cuurent Balance:</span> {formatCurrency(selectedPayment.bookBalance, selectedPayment.currency)}</div>
                      <div><span className="font-medium">Available Balance:</span> {formatCurrency(selectedPayment.availableBalance, selectedPayment.currency)}</div>
                    </div>
                  </div>
                  
                  {/* Payment Information */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Payment Information</h4>
                    <div className="space-y-1 text-sm">
                      <div><span className="font-medium">Amount:</span> {formatCurrency(selectedPayment.amount, selectedPayment.currency)}</div>
                      {selectedPayment.originalAmount && selectedPayment.originalCurrency && selectedPayment.conversionRate && (
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                          <div className="text-sm text-blue-800">
                            <div className="font-medium">💱 Currency Conversion Applied</div>
                            <div className="mt-1 space-y-1">
                              <div><span className="font-medium">Original:</span> {formatCurrency(selectedPayment.originalAmount, selectedPayment.originalCurrency)}</div>
                              <div><span className="font-medium">Converted:</span> {formatCurrency(selectedPayment.amount, selectedPayment.currency)}</div>
                              <div><span className="font-medium">Exchange Rate:</span> {selectedPayment.conversionRate.toFixed(6)} {selectedPayment.originalCurrency}/{selectedPayment.currency}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div><span className="font-medium">Risk Score:</span> 
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskColor(selectedPayment.riskLevel)}`}>
                          {selectedPayment.riskLevel} ({selectedPayment.riskScore})
                        </span>
                      </div>
                      <div><span className="font-medium">Source:</span> {selectedPayment.paymentSource}</div>
                      <div><span className="font-medium">Received:</span> {new Date(selectedPayment.createdAt).toLocaleString()}</div>
                      {selectedPayment.autoApprovalEligible && (
                        <div><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Auto Approval Eligible
                        </span></div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sender Information */}
                {selectedPayment.senderInfo && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Sender Information</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      <pre>{JSON.stringify(selectedPayment.senderInfo, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Screening Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Screening Notes
                  </label>
                  <textarea
                    value={screeningNotes}
                    onChange={(e) => setScreeningNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Add notes about your screening decision..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={processing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePaymentAction(selectedPayment.id, 'REJECT')}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Reject & Reverse'}
                  </button>
                  <button
                    onClick={() => handlePaymentAction(selectedPayment.id, 'APPROVE')}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

// Component for Blocked Payments Section
function BlockedPaymentsSection({ 
  blockedPayments, 
  formatCurrency, 
  getSeverityColor 
}: {
  blockedPayments: BlockedPayment[];
  formatCurrency: (amount: number | string, currency: string) => string;
  getSeverityColor: (severity: string | number) => string;
}) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
        <h2 className="text-lg font-semibold text-red-900">🚫 AIML Blocked Payments</h2>
        <p className="text-sm text-red-700">Payments automatically blocked by fraud detection</p>
      </div>
      
      {blockedPayments.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <div className="text-green-600 mb-2">✅ No blocked payments</div>
          <div className="text-sm">All payments have passed fraud screening</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Webhook ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Blocked Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Blocked At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {blockedPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-red-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{payment.webhook_id}</div>
                    <div className="text-sm text-gray-500">ID: {payment.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-red-900">Account: {payment.account_id}</div>
                    {payment.blocked_entity_name && (
                      <div className="text-sm text-red-600">Matched: {payment.blocked_entity_name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-red-900 font-medium">{payment.blocked_reason}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.severity && (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(payment.severity)}`}>
                        {typeof payment.severity === 'number' 
                          ? (payment.severity >= 10 ? 'CRITICAL' : payment.severity >= 7 ? 'HIGH' : payment.severity >= 4 ? 'MEDIUM' : 'LOW')
                          : payment.severity}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(payment.blocked_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Component for Block List Section
function BlockListSection({ 
  blockList, 
  getSeverityColor,
  getSeverityString
}: {
  blockList: BlockListEntry[];
  getSeverityColor: (severity: string | number) => string;
  getSeverityString: (severity: string | number) => string;
}) {
  const getTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'INDIVIDUAL': return '👤';
      case 'ENTITY': return '🏢';
      case 'ORGANIZATION': return '🌐';
      default: return '❓';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
        <h2 className="text-lg font-semibold text-orange-900">📋 Fraud Block List</h2>
        <p className="text-sm text-orange-700">Entities monitored for fraud prevention</p>
      </div>
      
      {blockList.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No block list entries found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {blockList.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{getTypeIcon(entry.type)}</span>
                      <div className="text-sm font-medium text-gray-900">{entry.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(entry.severity)}`}>
                      {getSeverityString(entry.severity)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{entry.reason}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{new Date(entry.created_at).toLocaleDateString()}</div>
                    <div className="text-xs">by {entry.added_by}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
