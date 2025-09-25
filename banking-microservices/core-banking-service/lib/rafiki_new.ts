import axios from 'axios';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';
import { v4 as uuidv4 } from 'uuid';

// Rafiki GraphQL configuration - Happy Life Bank
export const RAFIKI_CONFIG = {
  graphqlHost: 'http://rafiki-happy-life-backend-1:3001',
  graphqlUrl: 'http://rafiki-happy-life-backend-1:3001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d',
  assetId: '7b101b93-379f-4e56-bb3e-4e94ebcadf45', // USD asset ID from Happy Life Bank (verified from DB)
  baseWalletUrl: 'https://abl-backend'
};

// Rafiki GraphQL Helper Functions
export function generateBackendApiSignature(body: any): string {
  const version = RAFIKI_CONFIG.backendApiSignatureVersion;
  const secret = RAFIKI_CONFIG.backendApiSignatureSecret;
  const timestamp = Date.now(); // Use milliseconds, not seconds
  const payload = `${timestamp}.${canonicalize(body)}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return `t=${timestamp}, v${version}=${digest}`;
}

// GraphQL Queries for Rafiki Integration
const CREATE_RECEIVER_QUERY = `
  mutation CreateReceiver($input: CreateReceiverInput!) {
    createReceiver(input: $input) {
      receiver {
        id
        walletAddressUrl
        incomingAmount {
          value
          assetCode
          assetScale
        }
        metadata
        completed
        createdAt
        expiresAt
        receivedAmount {
          value
          assetCode
          assetScale
        }
        __typename
      }
      __typename
    }
  }
`;

const CREATE_QUOTE_QUERY = `
  mutation CreateQuote($input: CreateQuoteInput!) {
    createQuote(input: $input) {
      quote {
        id
        walletAddressId
        receiver
        debitAmount {
          assetCode
          assetScale
          value
        }
        receiveAmount {
          assetCode
          assetScale
          value
        }
        createdAt
        expiresAt
        __typename
      }
      __typename
    }
  }
`;

const CREATE_OUTGOING_PAYMENT_QUERY = `
  mutation CreateOutgoingPayment($input: CreateOutgoingPaymentInput!) {
    createOutgoingPayment(input: $input) {
      payment {
        id
        walletAddressId
        receiveAmount {
          assetCode
          assetScale
          value
        }
        receiver
        debitAmount {
          assetCode
          assetScale
          value
        }
        sentAmount {
          assetCode
          assetScale
          value
        }
        state
        stateAttempts
        metadata
        createdAt
        __typename
      }
      __typename
    }
  }
`;

// Helper function to make GraphQL requests to Rafiki
async function makeRafikiRequest(query: string, variables: any): Promise<any> {
  const requestBody = {
    query,
    variables
  };

  const headers = {
    'Content-Type': 'application/json',
    'signature': generateBackendApiSignature(requestBody),
    'tenant-id': RAFIKI_CONFIG.senderTenantId
  };

  const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, { headers });

  if (response.data?.errors) {
    console.error('❌ GraphQL errors:', response.data.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
  }

  return response.data;
}

// Create a payment reversal using the 3-step Rafiki flow
export async function createReversalPayment(
  senderWalletAddress: string,
  amount: string,
  currency: string,
  originalPaymentId: string,
  description?: string
): Promise<any> {
  console.log('💰 Creating reversal payment via Rafiki...');
  console.log('📋 Reversal details:', {
    senderWalletAddress,
    amount,
    currency,
    originalPaymentId,
    description
  });

  try {
    // Step 1: Find our wallet ID for sending the reversal
    const ourWalletId = await findOurWalletId();
    if (!ourWalletId) {
      throw new Error('Could not find our wallet ID for reversal processing');
    }

    console.log('🏦 Using our wallet ID for reversal:', ourWalletId);

    // Step 2: Create Receiver (for the original sender to receive the reversal)
    console.log('📝 Step 1: Creating receiver for original sender...');
    
    const receiverInput = {
      walletAddressUrl: senderWalletAddress,
      incomingAmount: {
        assetCode: currency,
        assetScale: 2, // Assuming 2 decimal places for currency
        value: amount
      },
      metadata: {
        description: description || `Reversal for payment ${originalPaymentId}`,
        originalPaymentId: originalPaymentId,
        reversalReason: 'AML_REJECTION'
      }
    };

    const receiverResult = await makeRafikiRequest(CREATE_RECEIVER_QUERY, {
      input: receiverInput
    });

    if (!receiverResult.data?.createReceiver?.receiver) {
      throw new Error('Failed to create receiver for reversal');
    }

    const receiver = receiverResult.data.createReceiver.receiver;
    console.log('✅ Receiver created for reversal:', receiver.id);

    // Step 3: Create Quote (from our wallet to sender)
    console.log('📝 Step 2: Creating quote for reversal...');
    
    const quoteInput = {
      walletAddressId: ourWalletId,
      receiver: receiver.id
    };

    const quoteResult = await makeRafikiRequest(CREATE_QUOTE_QUERY, {
      input: quoteInput
    });

    if (!quoteResult.data?.createQuote?.quote) {
      throw new Error('Failed to create quote for reversal');
    }

    const quote = quoteResult.data.createQuote.quote;
    console.log('✅ Quote created for reversal:', quote.id);
    console.log('💰 Debit amount:', quote.debitAmount.value, quote.debitAmount.assetCode);
    console.log('💰 Receive amount:', quote.receiveAmount.value, quote.receiveAmount.assetCode);

    // Step 4: Create Outgoing Payment (actual reversal payment)
    console.log('📝 Step 3: Creating outgoing payment for reversal...');
    
    const paymentInput = {
      walletAddressId: ourWalletId,
      quoteId: quote.id,
      metadata: {
        description: description || `Reversal for payment ${originalPaymentId}`,
        originalPaymentId: originalPaymentId,
        reversalReason: 'AML_REJECTION',
        processedAt: new Date().toISOString()
      }
    };

    const paymentResult = await makeRafikiRequest(CREATE_OUTGOING_PAYMENT_QUERY, {
      input: paymentInput
    });

    if (!paymentResult.data?.createOutgoingPayment?.payment) {
      throw new Error('Failed to create outgoing payment for reversal');
    }

    const payment = paymentResult.data.createOutgoingPayment.payment;
    console.log('✅ Reversal payment created:', payment.id);
    console.log('🏦 Payment state:', payment.state);

    return {
      success: true,
      payment: {
        id: payment.id,
        amount: payment.receiveAmount.value,
        currency: payment.receiveAmount.assetCode,
        recipient: senderWalletAddress,
        status: payment.state,
        createdAt: payment.createdAt
      },
      receiver: receiver,
      quote: quote
    };

  } catch (error: any) {
    console.error('❌ Error creating reversal payment:', error);
    throw new Error(`Reversal payment failed: ${error.message}`);
  }
}

// Helper function to find our own wallet ID for processing reversals
export async function findOurWalletId(): Promise<string | null> {
  console.log('🔍 Looking up our wallet ID for reversal processing...');
  
  try {
    const { getDatabase } = await import('./database');
    const db = getDatabase();
    
    // Look for any active account with a wallet_id that we can use for reversals
    // In a real system, you might have a dedicated reversal wallet
    const result = await db.query(
      `SELECT wallet_id FROM accounts 
       WHERE wallet_id IS NOT NULL 
       AND status = 'active' 
       ORDER BY id ASC 
       LIMIT 1`
    );
    
    if (result.rows.length > 0) {
      const walletId = result.rows[0].wallet_id;
      console.log('✅ Found our wallet ID for reversals:', walletId);
      return walletId;
    } else {
      console.log('⚠️ No wallet ID found for reversal processing');
      return null;
    }
  } catch (error) {
    console.error('❌ Error finding our wallet ID:', error);
    return null;
  }
}

// Helper function to find wallet ID by wallet address
export async function findWalletIdByAddress(walletAddress: string): Promise<string | null> {
  console.log('🔍 Looking up wallet ID for address:', walletAddress);
  
  try {
    const { getDatabase } = await import('./database');
    const db = getDatabase();
    
    const result = await db.query(
      'SELECT wallet_id FROM accounts WHERE wallet_address = $1 AND wallet_id IS NOT NULL',
      [walletAddress]
    );
    
    if (result.rows.length > 0) {
      const walletId = result.rows[0].wallet_id;
      console.log('✅ Found wallet ID:', walletId);
      return walletId;
    } else {
      console.log('⚠️ No wallet ID found for address:', walletAddress);
      return null;
    }
  } catch (error) {
    console.error('❌ Error finding wallet ID:', error);
    return null;
  }
}

// Wallet address creation functions (keeping from original)
export async function createWalletAddressInRafiki(accountData: any): Promise<any> {
  console.log('🌐 Creating wallet address in Rafiki Happy Life Bank...');
  console.log('📋 Account data:', accountData);

  const createWalletAddressQuery = `
    mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
      createWalletAddress(input: $input) {
        walletAddress {
          id
          address
          publicName
          status
          createdAt
          asset {
            id
            code
            scale
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      assetId: RAFIKI_CONFIG.assetId,
      address: `${RAFIKI_CONFIG.baseWalletUrl}/${accountData.iban}`,
      publicName: accountData.wallet_public_name || accountData.name,
      additionalProperties: [
        {
          key: 'accountId',
          value: accountData.id.toString(),
          visibleInOpenPayments: false
        },
        {
          key: 'accountIban',
          value: accountData.iban,
          visibleInOpenPayments: false
        },
        {
          key: 'customerEmail',
          value: accountData.email,
          visibleInOpenPayments: false
        }
      ]
    }
  };

  const requestBody = {
    query: createWalletAddressQuery,
    variables
  };

  const headers = {
    'Content-Type': 'application/json',
    'signature': generateBackendApiSignature(requestBody),
    'tenant-id': RAFIKI_CONFIG.senderTenantId
  };

  try {
    const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, { headers });

    if (response.data?.errors) {
      console.error('❌ GraphQL errors:', response.data.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    if (!response.data?.data?.createWalletAddress?.walletAddress) {
      console.error('❌ No wallet address in response:', response.data);
      throw new Error('No wallet address returned from Rafiki');
    }

    return response.data.data.createWalletAddress.walletAddress;
    
  } catch (error) {
    console.error('❌ Error creating wallet address in Rafiki:', error);
    if (axios.isAxiosError(error)) {
      console.error('📡 Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    }
    throw error;
  }
}

export async function updateWalletAddressInRafiki(walletAddressId: string, status: 'ACTIVE' | 'INACTIVE', publicName?: string): Promise<any> {
  console.log('🔄 Updating wallet address in Rafiki Happy Life Bank...');

  const updateWalletAddressQuery = `
    mutation UpdateWalletAddress($input: UpdateWalletAddressInput!) {
      updateWalletAddress(input: $input) {
        walletAddress {
          id
          asset {
            id
            code
            scale
            withdrawalThreshold
            createdAt
          }
          address
          publicName
          createdAt
          status
        }
      }
    }
  `;

  const input: any = {
    id: walletAddressId,
    status: status
  };

  if (publicName) {
    input.publicName = publicName;
  }

  const variables = { input };
  const requestBody = { query: updateWalletAddressQuery, variables };
  const headers = {
    'Content-Type': 'application/json',
    'signature': generateBackendApiSignature(requestBody),
    'tenant-id': RAFIKI_CONFIG.senderTenantId
  };

  try {
    const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, { headers });

    if (response.data?.errors) {
      console.error('❌ GraphQL errors:', response.data.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }

    if (!response.data?.data?.updateWalletAddress?.walletAddress) {
      console.error('❌ No wallet address in update response:', response.data);
      throw new Error('No wallet address returned from Rafiki update');
    }

    console.log('✅ Wallet address status updated successfully');
    return response.data.data.updateWalletAddress.walletAddress;
    
  } catch (error) {
    console.error('❌ Error updating wallet address in Rafiki:', error);
    if (axios.isAxiosError(error)) {
      console.error('📡 Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    }
    throw error;
  }
}

// IBAN Generator functions (keeping from original)
export function generateIBAN(): string {
  const bankCode = 'ABBL';
  const accountNumber = generateAccountNumber();
  const checkDigits = calculateCheckDigits(bankCode + accountNumber);
  return `PK${checkDigits}${bankCode}${accountNumber}`;
}

function generateAccountNumber(): string {
  let accountNumber = '';
  for (let i = 0; i < 16; i++) {
    accountNumber += Math.floor(Math.random() * 10).toString();
  }
  return accountNumber;
}

function calculateCheckDigits(accountPart: string): string {
  let numericString = '';
  
  for (const char of accountPart) {
    if (char >= 'A' && char <= 'Z') {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }
  
  numericString += '252000';
  
  let remainder = 0;
  for (const digit of numericString) {
    remainder = (remainder * 10 + parseInt(digit)) % 97;
  }
  
  const checkDigits = 98 - remainder;
  return checkDigits.toString().padStart(2, '0');
}
