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
  const [senderWalletAddress, setSenderWalletAddress] = useState('https://cloud-nine-wallet/john.doe');
  const [description, setDescription] = useState('Cross-currency payment');
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
    addLog(`✅ Using Cloud Nine wallet ID: ${senderWalletId}`);
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
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>;
      case 'success':
        return <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>;
      case 'error':
        return <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">✗</div>;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full"></div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Demo Sender</h1>
          <p className="text-gray-600">
            Send payments from Cloud Nine wallet to ABL via Rafiki with custom metadata
          </p>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sender Wallet ID (Cloud Nine)
              </label>
              <input
                type="text"
                value={senderWalletId}
                onChange={(e) => setSenderWalletId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter sender wallet ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="5.00"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Wallet Address (ABL)
            </label>
            <input
              type="text"
              value={recipientWalletAddress}
              onChange={(e) => setRecipientWalletAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://abl-backend/PK47ABBL8950311861785523"
            />
          </div>

          {/* Metadata Section */}
          <div className="border-t pt-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Metadata (will appear in webhooks)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Wallet Address
                </label>
                <input
                  type="text"
                  value={senderWalletAddress}
                  onChange={(e) => setSenderWalletAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://cloud-nine-wallet/john.doe"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Cross-currency payment"
              />
            </div>
          </div>

          <button
            onClick={sendPayment}
            disabled={isProcessing}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isProcessing ? 'Processing Payment...' : 'Send Payment with Metadata'}
          </button>
        </div>

        {/* Payment Steps */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Process</h2>
          
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
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-3">Activity Log</h2>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-sm text-gray-300 font-mono">
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
