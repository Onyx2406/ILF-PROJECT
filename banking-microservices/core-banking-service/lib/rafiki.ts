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
  assetId: 'b64f99cd-8b61-4c7f-9d73-cdd087e3d0ae',
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

  console.log('🔗 Sending request to Rafiki...');
  console.log('🎯 URL:', RAFIKI_CONFIG.graphqlUrl);
  console.log('📝 Headers:', {
    'Content-Type': headers['Content-Type'],
    'signature': headers['signature'].substring(0, 50) + '...',
    'tenant-id': headers['tenant-id']
  });

  try {
    const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, { headers });

    console.log('✅ Rafiki response received');
    console.log('📊 Response status:', response.status);
    console.log('📦 Response data structure:', {
      hasData: !!response.data,
      hasDataData: !!response.data?.data,
      hasWalletAddress: !!response.data?.data?.createWalletAddress,
      keys: Object.keys(response.data || {})
    });

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

// IBAN Generator functions
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
