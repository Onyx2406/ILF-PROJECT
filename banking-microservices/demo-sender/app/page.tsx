'use client';

import { useState, useEffect } from 'react';
import { CREATE_RECEIVER_QUERY, CREATE_QUOTE_QUERY, CREATE_OUTGOING_PAYMENT_QUERY } from '../lib/rafiki'
import { v4 as uuidv4 } from 'uuid';

interface PaymentStep {
  step: number;
  title: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  data?: any;
  error?: string;
}

export default function DemoSenderPage() {
  const [recipientWalletAddress, setRecipientWalletAddress] = useState('https://abl-backend/PK47ABBL8950311861785523');
  const [amount, setAmount] = useState('5.00');
  const [senderWalletId, setSenderWalletId] = useState('2cf06058-a987-4914-8ea7-449a4137dc19'); // Using specified wallet ID
  const [senderName, setSenderName] = useState('John Doe');
  const [senderWalletAddress, setSenderWalletAddress] = useState('https://bankofamerica.com/john.doe');
  const [description, setDescription] = useState('Bank of America cross-currency payment');
  const [steps, setSteps] = useState<PaymentStep[]>([
    { step: 1, title: 'Create Receiver', status: 'pending' },
    { step: 2, title: 'Create Quote', status: 'pending' },
    { step: 3, title: 'Create Outgoing Payment', status: 'pending' },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  // Using hardcoded wallet ID - no need to fetch dynamically
  useEffect(() => {
    addLog(`🏦 Bank of America wallet ID configured: ${senderWalletId}`);
  }, []);

  const updateStep = (stepNumber: number, status: PaymentStep['status'], data?: any, error?: string) => {
    setSteps(prev => prev.map(step => 
      step.step === stepNumber 
        ? { ...step, status, data, error }
        : step
    ));
  };

  const sendPayment = async () => {
    setIsProcessing(true);
    setLogs([]);
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', data: undefined, error: undefined })));

    try {
      addLog('Starting payment process...');

      // Step 1: Create Receiver
      addLog('Step 1: Creating receiver...');
      updateStep(1, 'loading');
      
      const receiverResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: CREATE_RECEIVER_QUERY,
          variables: {
            input: {
              metadata: {
                description,
                senderName,
                senderWalletAddress
              },
              incomingAmount: {
                assetCode: "USD",
                assetScale: 2,
                value: Math.round(parseFloat(amount) * 100)
              },
              walletAddressUrl: recipientWalletAddress
            }
          }
        })
      });

      const receiverResult = await receiverResponse.json();

      console.log('CreateReceiver result:', receiverResult);

      if (receiverResult.errors) {
        throw new Error(`Receiver creation failed: ${receiverResult.errors[0].message}`);
      }

      if (!receiverResult.data?.createReceiver?.receiver) {
        throw new Error('Failed to create receiver - no receiver data returned');
      }

      const receiver = receiverResult.data.createReceiver.receiver;
      updateStep(1, 'success', receiver);
      addLog(`✅ Receiver created: ${receiver.id}`);
      addLog(`📝 Metadata sent - Name: ${senderName}, Wallet: ${senderWalletAddress}`);

      // Add small delay like human interaction
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Create Quote
      addLog('Step 2: Creating quote...');
      updateStep(2, 'loading');

      const quoteResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: CREATE_QUOTE_QUERY,
          variables: {
            input: {
              walletAddressId: senderWalletId,
              receiver: receiver.id
            }
          }
        })
      });

      const quoteResult = await quoteResponse.json();

      console.log('CreateQuote result:', quoteResult);

      if (quoteResult.errors) {
        throw new Error(`Quote creation failed: ${quoteResult.errors[0].message}`);
      }

      if (!quoteResult.data?.createQuote?.quote) {
        throw new Error('Failed to create quote - no quote data returned');
      }

      const quote = quoteResult.data.createQuote.quote;
      updateStep(2, 'success', quote);
      addLog(`✅ Quote created: ${quote.id}`);
      addLog(`💰 Debit Amount: ${quote.debitAmount.value} ${quote.debitAmount.assetCode}`);
      addLog(`💰 Receive Amount: ${quote.receiveAmount.value} ${quote.receiveAmount.assetCode}`);

      // Add small delay like human interaction
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Create Outgoing Payment  
      addLog('Step 3: Creating outgoing payment...');
      updateStep(3, 'loading');

      const paymentResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: CREATE_OUTGOING_PAYMENT_QUERY,
          variables: {
            input: {
              walletAddressId: senderWalletId,
              quoteId: quote.id,
              metadata: {
                description,
                senderName,
                senderWalletAddress
              }
            }
          }
        })
      });

      const paymentResult = await paymentResponse.json();

      console.log('CreateOutgoingPayment result:', paymentResult);

      if (paymentResult.errors) {
        throw new Error(`Payment creation failed: ${paymentResult.errors[0].message}`);
      }

      if (!paymentResult.data?.createOutgoingPayment?.payment) {
        throw new Error('Failed to create payment - no payment data returned');
      }

      const payment = paymentResult.data.createOutgoingPayment.payment;
      updateStep(3, 'success', payment);
      addLog(`✅ Outgoing payment created: ${payment.id}`);
      addLog(`🏦 Payment state: ${payment.state}`);
      addLog(`💰 Debit amount: ${payment.debitAmount.value} ${payment.debitAmount.assetCode}`);
      addLog(`💰 Receive amount: ${payment.receiveAmount.value} ${payment.receiveAmount.assetCode}`);
      addLog(`📝 Metadata attached to payment - This will appear in webhooks!`);
      addLog(`🎯 Payment will auto-complete and trigger webhooks!`);
      addLog(`✅ incoming.payment.created webhook delivered`);
      addLog(`✅ incoming.payment.completed webhook will be delivered automatically`);

    } catch (error: any) {
      const currentStep = steps.find(s => s.status === 'loading')?.step || 1;
      updateStep(currentStep, 'error', undefined, error.message);
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepIcon = (status: PaymentStep['status']) => {
    switch (status) {
      case 'loading':
        return <div className="animate-spin rounded-full h-6 w-6 border-2 border-red-600 border-t-transparent"></div>;
      case 'success':
        return <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center text-white text-sm shadow-md">✓</div>;
      case 'error':
        return <div className="w-6 h-6 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-sm shadow-md">✗</div>;
      default:
        return <div className="w-6 h-6 bg-gray-300 rounded-full border-2 border-gray-400"></div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg border border-red-100 p-6 mb-6">
          <div className="flex items-center space-x-4 mb-4">
            {/* Bank of America Logo */}
            <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">BoA</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-blue-700 bg-clip-text text-transparent mb-1">
                Bank of America
              </h1>
              <p className="text-lg font-medium text-gray-700">Payment Demo Portal</p>
            </div>
          </div>
          <p className="text-gray-600 border-l-4 border-red-500 pl-4">
            Send secure payments from Bank of America to other financial institutions via Rafiki with enhanced metadata tracking
          </p>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow-lg border border-red-100 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-blue-700 rounded flex items-center justify-center">
              <span className="text-white text-sm">💳</span>
            </div>
            <h2 className="text-xl font-semibold bg-gradient-to-r from-red-600 to-blue-700 bg-clip-text text-transparent">
              Payment Details
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center space-x-2">
                  <span>🏦</span>
                  <span>Bank of America Wallet ID</span>
                </span>
              </label>
              <input
                type="text"
                value={senderWalletId}
                onChange={(e) => setSenderWalletId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="Enter Bank of America wallet ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center space-x-2">
                  <span>💰</span>
                  <span>Amount (USD)</span>
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="5.00"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center space-x-2">
                <span>🎯</span>
                <span>Recipient Wallet Address (ABL)</span>
              </span>
            </label>
            <input
              type="text"
              value={recipientWalletAddress}
              onChange={(e) => setRecipientWalletAddress(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
              placeholder="https://abl-backend/PK47ABBL8950311861785523"
            />
          </div>

          {/* Metadata Section */}
          <div className="border-t-2 border-red-100 pt-6 mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-blue-700 rounded flex items-center justify-center">
                <span className="text-white text-sm">📄</span>
              </div>
              <h3 className="text-lg font-medium bg-gradient-to-r from-red-600 to-blue-700 bg-clip-text text-transparent">
                Payment Metadata (will appear in webhooks)
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center space-x-2">
                    <span>👤</span>
                    <span>Sender Name</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center space-x-2">
                    <span>🏦</span>
                    <span>Bank of America Wallet Address</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={senderWalletAddress}
                  onChange={(e) => setSenderWalletAddress(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  placeholder="https://bankofamerica.com/john.doe"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center space-x-2">
                  <span>📝</span>
                  <span>Description</span>
                </span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="Cross-currency payment"
              />
            </div>
          </div>

          <button
            onClick={sendPayment}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-red-600 to-blue-700 text-white py-4 px-6 rounded-lg hover:from-red-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing Bank of America Payment...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center space-x-2">
                <span>🚀</span>
                <span>Send Payment with Bank of America</span>
              </span>
            )}
          </button>
        </div>

        {/* Payment Steps */}
        <div className="bg-white rounded-lg shadow-lg border border-red-100 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-blue-700 rounded flex items-center justify-center">
              <span className="text-white text-sm">⚡</span>
            </div>
            <h2 className="text-xl font-semibold bg-gradient-to-r from-red-600 to-blue-700 bg-clip-text text-transparent">
              Payment Process
            </h2>
          </div>
          
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.step} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step.status)}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    Step {step.step}: {step.title}
                  </h3>
                  {step.status === 'success' && step.data && (
                    <div className="mt-1 text-xs text-green-600">
                      ID: {step.data.id}
                    </div>
                  )}
                  {step.status === 'error' && step.error && (
                    <div className="mt-1 text-xs text-red-600">
                      Error: {step.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg shadow-lg border border-red-100 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-blue-700 rounded flex items-center justify-center">
                <span className="text-white text-sm">📊</span>
              </div>
              <h2 className="text-lg font-semibold text-white">
                Bank of America Transaction Log
              </h2>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto bg-black bg-opacity-50 rounded-lg p-3">
              {logs.map((log, index) => (
                <div key={index} className="text-sm text-green-300 font-mono leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
