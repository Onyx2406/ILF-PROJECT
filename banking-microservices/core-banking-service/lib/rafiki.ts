import axios from 'axios';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';
import { v4 as uuidv4 } from 'uuid';

// Rafiki GraphQL configuration - Happy Life Bank
export const HAPPY_LIFE_RAFIKI_CONFIG = {
  graphqlHost: 'http://rafiki-happy-life-backend-1:3001',
  graphqlUrl: 'http://rafiki-happy-life-backend-1:3001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d',
  assetId: '7b101b93-379f-4e56-bb3e-4e94ebcadf45', // USD asset ID from Happy Life Bank (verified from DB)
  baseWalletUrl: 'https://abl-backend'
};

// Rafiki GraphQL configuration - Cloud Nine Wallet
export const CLOUD_NINE_RAFIKI_CONFIG = {
  graphqlHost: 'http://cloud-nine-wallet-backend:3001',
  graphqlUrl: 'http://cloud-nine-wallet-backend:3001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: '438fa74a-fa7d-4317-9ced-dde32ece1787',
  assetId: 'b64f99cd-8b61-4c7f-9d73-cdd087e3d0ae', // USD asset ID from Cloud Nine
  baseWalletUrl: 'https://cloud-nine-wallet-backend'
};

// Default configuration for backward compatibility
export const RAFIKI_CONFIG = HAPPY_LIFE_RAFIKI_CONFIG;

// Helper function to find sender wallet ID by wallet address URL
async function findSenderWalletId(senderWalletAddress: string, config: typeof RAFIKI_CONFIG): Promise<string | null> {
  console.log('🔍 Looking up sender wallet ID for address:', senderWalletAddress);
  
  const getWalletAddressesQuery = `
    query GetWalletAddresses {
      walletAddresses {
        edges {
          cursor
          node {
            id
            address
            status
          }
        }
      }
    }
  `;

  const requestBody = {
    query: getWalletAddressesQuery
  };

  try {
    const response = await axios.post(config.graphqlUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'signature': generateBackendApiSignature(requestBody, config),
        'tenant-id': config.senderTenantId
      }
    });

    if (response.data?.data?.walletAddresses?.edges) {
      const wallets = response.data.data.walletAddresses.edges.map((edge: any) => edge.node);
      
      // Find the wallet that matches the sender address
      const senderWallet = wallets.find((wallet: any) => wallet.address === senderWalletAddress);
      
      if (senderWallet) {
        console.log('✅ Found sender wallet ID:', senderWallet.id);
        return senderWallet.id;
      } else {
        console.log('⚠️ Sender wallet not found. Available wallets:');
        wallets.forEach((wallet: any) => {
          console.log(`   - ${wallet.address} (ID: ${wallet.id})`);
        });
        
        // Return first active wallet as fallback
        const fallbackWallet = wallets.find((wallet: any) => wallet.status === 'ACTIVE');
        if (fallbackWallet) {
          console.log('💡 Using first active wallet as fallback:', fallbackWallet.id);
          return fallbackWallet.id;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error finding sender wallet ID:', error);
    return null;
  }
}

// Function to determine which Rafiki configuration to use based on wallet address
function getRafikiConfigForWallet(walletAddress: string): typeof RAFIKI_CONFIG {
  console.log('🔍 Determining Rafiki config for wallet:', walletAddress);
  
  // Check if it's a Cloud Nine wallet address
  if (walletAddress.includes('cloud-nine-wallet-backend') || walletAddress.includes('cloud-nine-wallet')) {
    console.log('☁️ Using Cloud Nine Rafiki configuration');
    return CLOUD_NINE_RAFIKI_CONFIG;
  }
  
  // Check if it's a Happy Life Bank wallet address
  if (walletAddress.includes('abl-backend') || walletAddress.includes('happy-life-bank')) {
    console.log('🏦 Using Happy Life Bank Rafiki configuration');
    return HAPPY_LIFE_RAFIKI_CONFIG;
  }
  
  // Default to Happy Life Bank
  console.log('🏦 Defaulting to Happy Life Bank Rafiki configuration');
  return HAPPY_LIFE_RAFIKI_CONFIG;
}

// Rafiki GraphQL Helper Functions
export function generateBackendApiSignature(body: any, config = RAFIKI_CONFIG): string {
  const version = config.backendApiSignatureVersion;
  const secret = config.backendApiSignatureSecret;
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
async function makeRafikiRequest(query: string, variables: any, config = RAFIKI_CONFIG): Promise<any> {
  const requestBody = {
    query,
    variables
  };

  const headers = {
    'Content-Type': 'application/json',
    'signature': generateBackendApiSignature(requestBody, config),
    'tenant-id': config.senderTenantId
  };

  const response = await axios.post(config.graphqlUrl, requestBody, { headers });

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
  description?: string,
  db?: any,
  webhookData?: any
): Promise<any> {
  console.log('💰 Creating reversal payment via Rafiki...');
  console.log('📋 Reversal details:', {
    senderWalletAddress,
    amount,
    currency,
    originalPaymentId,
    description,
    hasWebhookData: !!webhookData
  });
  
  if (webhookData) {
    console.log('📋 Webhook data structure:', {
      id: webhookData.id,
      walletAddressId: webhookData.walletAddressId,
      incomingAmount: webhookData.incomingAmount,
      metadata: webhookData.metadata
    });
  }

  try {
    // Determine which Rafiki configuration to use based on sender wallet address
    const rafikiConfig = getRafikiConfigForWallet(senderWalletAddress);
    console.log('🔧 Using Rafiki config:', {
      graphqlUrl: rafikiConfig.graphqlUrl,
      senderTenantId: rafikiConfig.senderTenantId,
      assetId: rafikiConfig.assetId
    });

    // Step 1: Find sender wallet ID from the correct Rafiki tenant
    // The sender wallet address determines which Rafiki instance to query
    let senderWalletId = await findSenderWalletId(senderWalletAddress, rafikiConfig);
    
    if (!senderWalletId) {
      console.log('⚠️ Could not find sender wallet ID, falling back to our wallet ID...');
      
      // Fallback: Find our wallet ID for sending the reversal
      let ourWalletId = null;
      if (webhookData) {
        console.log('🔍 Attempting to find wallet ID from webhook data...');
        ourWalletId = await findWalletIdFromWebhook(webhookData, db);
      }
      
      // Final fallback to finding any available wallet ID
      if (!ourWalletId) {
        console.log('🔍 Webhook lookup failed, falling back to findOurWalletId...');
        ourWalletId = await findOurWalletId(db);
      }
      
      if (!ourWalletId) {
        throw new Error('Could not find any wallet ID for reversal processing');
      }
      
      senderWalletId = ourWalletId;
    }

    console.log('🏦 Using sender wallet ID for reversal:', senderWalletId);

    // Step 2: Create Receiver (for the original sender to receive the reversal)
    console.log('📝 Step 1: Creating receiver for original sender...');
    
    // Handle amount conversion based on webhook data
    let amountInCents = amount;
    let assetScale = 2; // Default for USD
    let reversalCurrency = currency;
    
    // If we have webhook data, use its assetScale and amount
    if (webhookData?.incomingAmount?.assetScale !== undefined) {
      assetScale = webhookData.incomingAmount.assetScale;
      
      // If webhook amount is already in correct format, use it directly
      if (webhookData.incomingAmount?.value) {
        amountInCents = webhookData.incomingAmount.value;
        console.log('💰 Using webhook amount directly:', amountInCents);
        
        // Use the original currency from webhook for reversal
        if (webhookData.incomingAmount?.assetCode) {
          reversalCurrency = webhookData.incomingAmount.assetCode;
          console.log('💱 Using webhook currency for reversal:', reversalCurrency);
        }
      } else {
        // Convert decimal amount to smallest unit
        amountInCents = Math.round(parseFloat(amount) * Math.pow(10, assetScale)).toString();
        console.log('💰 Converted amount to smallest unit:', amountInCents);
      }
    } else {
      // Fallback: convert decimal amount to cents
      amountInCents = Math.round(parseFloat(amount) * Math.pow(10, assetScale)).toString();
      console.log('💰 Fallback conversion to cents:', amountInCents);
    }
    
    console.log('💰 Final amount details:', {
      originalAmount: amount,
      assetScale: assetScale,
      amountInCents: amountInCents,
      originalCurrency: currency,
      reversalCurrency: reversalCurrency
    });
    
    const receiverInput = {
      walletAddressUrl: senderWalletAddress,
      incomingAmount: {
        assetCode: reversalCurrency, // Use the correct currency for reversal
        assetScale: assetScale,
        value: amountInCents // Use the correctly formatted amount
      },
      metadata: {
        description: description || `Reversal for payment ${originalPaymentId}`,
        originalPaymentId: originalPaymentId,
        reversalReason: 'AML_REJECTION'
      }
    };

    console.log('📝 Sending CreateReceiver request:', JSON.stringify(receiverInput, null, 2));

    const receiverResult = await makeRafikiRequest(CREATE_RECEIVER_QUERY, {
      input: receiverInput
    }, rafikiConfig);

    console.log('📝 CreateReceiver response:', JSON.stringify(receiverResult, null, 2));

    if (!receiverResult.data?.createReceiver?.receiver) {
      console.error('❌ CreateReceiver failed - no receiver in response');
      throw new Error('Failed to create receiver for reversal');
    }

    const receiver = receiverResult.data.createReceiver.receiver;
    console.log('✅ Receiver created for reversal:', receiver.id);

    // Step 3: Create Quote (from sender's wallet to reversal receiver)
    console.log('📝 Step 2: Creating quote for reversal...');
    
    const quoteInput = {
      walletAddressId: senderWalletId,
      receiver: receiver.id
    };

    console.log('📝 Sending CreateQuote request:', JSON.stringify(quoteInput, null, 2));

    const quoteResult = await makeRafikiRequest(CREATE_QUOTE_QUERY, {
      input: quoteInput
    }, rafikiConfig);

    console.log('📝 CreateQuote response:', JSON.stringify(quoteResult, null, 2));

    if (!quoteResult.data?.createQuote?.quote) {
      console.error('❌ CreateQuote failed - no quote in response');
      throw new Error('Failed to create quote for reversal');
    }

    const quote = quoteResult.data.createQuote.quote;
    console.log('✅ Quote created for reversal:', quote.id);
    console.log('💰 Debit amount:', quote.debitAmount.value, quote.debitAmount.assetCode);
    console.log('💰 Receive amount:', quote.receiveAmount.value, quote.receiveAmount.assetCode);

    // Step 4: Create Outgoing Payment (actual reversal payment)
    console.log('📝 Step 3: Creating outgoing payment for reversal...');
    
    const paymentInput = {
      walletAddressId: senderWalletId,
      quoteId: quote.id,
      metadata: {
        description: description || `Reversal for payment ${originalPaymentId}`,
        originalPaymentId: originalPaymentId,
        reversalReason: 'AML_REJECTION',
        processedAt: new Date().toISOString()
      }
    };

    console.log('📝 Sending CreateOutgoingPayment request:', JSON.stringify(paymentInput, null, 2));

    const paymentResult = await makeRafikiRequest(CREATE_OUTGOING_PAYMENT_QUERY, {
      input: paymentInput
    }, rafikiConfig);

    console.log('📝 CreateOutgoingPayment response:', JSON.stringify(paymentResult, null, 2));

    if (!paymentResult.data?.createOutgoingPayment?.payment) {
      console.error('❌ CreateOutgoingPayment failed - no payment in response');
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

// Helper function to find wallet ID by webhook data (receiver's wallet)
export async function findWalletIdFromWebhook(webhookData: any, db?: any): Promise<string | null> {
  console.log('🔍 Looking up wallet ID from webhook data...');
  console.log('📋 Webhook data received:', JSON.stringify(webhookData, null, 2));
  
  try {
    // Use provided db connection or import database
    let database = db;
    if (!database) {
      const { getDatabase } = await import('./database');
      database = getDatabase();
    }
    
    // Extract wallet address URL from webhook data
    let walletAddressUrl = null;
    
    // Check for direct walletAddressId first (this is the wallet ID we need!)
    if (webhookData?.walletAddressId) {
      console.log('💡 Found direct walletAddressId in webhook:', webhookData.walletAddressId);
      return webhookData.walletAddressId;
    }
    
    // Check different possible locations for wallet address in webhook
    if (webhookData?.walletAddress) {
      walletAddressUrl = webhookData.walletAddress;
      console.log('📍 Found wallet address in webhookData.walletAddress');
    } else if (webhookData?.data?.walletAddress) {
      walletAddressUrl = webhookData.data.walletAddress;
      console.log('📍 Found wallet address in webhookData.data.walletAddress');
    } else if (webhookData?.metadata?.walletAddress) {
      walletAddressUrl = webhookData.metadata.walletAddress;
      console.log('📍 Found wallet address in webhookData.metadata.walletAddress');
    } else if (webhookData?.receiver) {
      walletAddressUrl = webhookData.receiver;
      console.log('� Found wallet address in webhookData.receiver');
    }
    
    if (!walletAddressUrl) {
      console.log('⚠️ No wallet address found in webhook data');
      console.log('🔍 Available webhook properties:', Object.keys(webhookData || {}));
      return null;
    }
    
    console.log('📋 Found wallet address in webhook:', walletAddressUrl);
    
    // Look up the wallet_id in accounts table using wallet_address
    const result = await database.query(
      `SELECT wallet_id, name, iban FROM accounts 
       WHERE wallet_address = $1 AND wallet_id IS NOT NULL 
       ORDER BY id ASC 
       LIMIT 1`,
      [walletAddressUrl]
    );
    
    if (result.rows.length > 0) {
      const walletId = result.rows[0].wallet_id;
      const accountName = result.rows[0].name;
      const iban = result.rows[0].iban;
      console.log(`✅ Found wallet ID from webhook: ${walletId} (Account: ${accountName} - ${iban})`);
      return walletId;
    } else {
      console.log('⚠️ No matching wallet ID found for webhook wallet address');
      // Fallback to any available wallet ID
      return await findOurWalletId(database);
    }
  } catch (error) {
    console.error('❌ Error finding wallet ID from webhook:', error);
    return null;
  }
}

// Helper function to find our own wallet ID for processing reversals
export async function findOurWalletId(db?: any): Promise<string | null> {
  console.log('🔍 Looking up our wallet ID for reversal processing...');
  
  try {
    // Use provided db connection or import database
    let database = db;
    if (!database) {
      const { getDatabase } = await import('./database');
      database = getDatabase();
    }
    
    // Look for any account with a wallet_id that we can use for reversals
    const result = await database.query(
      `SELECT wallet_id, name, iban FROM accounts 
       WHERE wallet_id IS NOT NULL 
       AND status = 'active' 
       ORDER BY id ASC 
       LIMIT 1`
    );
    
    if (result.rows.length > 0) {
      const walletId = result.rows[0].wallet_id;
      const accountName = result.rows[0].name;
      const iban = result.rows[0].iban;
      console.log(`✅ Found our wallet ID for reversals: ${walletId} (Account: ${accountName} - ${iban})`);
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
export async function createWalletAddressInRafiki(accountData: any, config = RAFIKI_CONFIG): Promise<any> {
  console.log('🌐 Creating wallet address in Rafiki...');
  console.log('📋 Account data:', accountData);
  console.log('🔧 Using config:', {
    graphqlUrl: config.graphqlUrl,
    senderTenantId: config.senderTenantId,
    assetId: config.assetId
  });

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
      assetId: config.assetId,
      address: `${config.baseWalletUrl}/${accountData.iban}`,
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
    'signature': generateBackendApiSignature(requestBody, config),
    'tenant-id': config.senderTenantId
  };

  try {
    const response = await axios.post(config.graphqlUrl, requestBody, { headers });

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

export async function updateWalletAddressInRafiki(walletAddressId: string, status: 'ACTIVE' | 'INACTIVE', publicName?: string, config = RAFIKI_CONFIG): Promise<any> {
  console.log('🔄 Updating wallet address in Rafiki...');

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
    'signature': generateBackendApiSignature(requestBody, config),
    'tenant-id': config.senderTenantId
  };

  try {
    const response = await axios.post(config.graphqlUrl, requestBody, { headers });

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

// Alias function for backward compatibility with existing code
export async function updateWalletAddressStatus(walletAddressId: string, status: 'ACTIVE' | 'INACTIVE', publicName?: string, config = RAFIKI_CONFIG): Promise<any> {
  return updateWalletAddressInRafiki(walletAddressId, status, publicName, config);
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
