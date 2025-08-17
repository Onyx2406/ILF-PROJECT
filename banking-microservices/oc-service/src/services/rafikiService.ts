import axios from 'axios';
import { createHmac } from 'crypto';
import { canonicalize } from 'json-canonicalize';

// Rafiki GraphQL configuration - Happy Life Bank
const RAFIKI_CONFIG = {
  graphqlUrl: 'http://rafiki-happy-life-backend-1:3001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d',
  assetId: 'b64f99cd-8b61-4c7f-9d73-cdd087e3d0ae',
  baseWalletUrl: 'https://abl-backend'
};

export class RafikiService {
  // Generate HMAC signature for Rafiki authentication
  private static generateBackendApiSignature(body: any): string {
    const version = RAFIKI_CONFIG.backendApiSignatureVersion;
    const secret = RAFIKI_CONFIG.backendApiSignatureSecret;
    const timestamp = Date.now();
    const payload = `${timestamp}.${canonicalize(body)}`;
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const digest = hmac.digest('hex');
    
    return `t=${timestamp}, v${version}=${digest}`;
  }

  // Create wallet address in Rafiki
  static async createWalletAddress(accountData: any): Promise<any> {
    console.log('🌐 OC Service: Creating wallet address in Rafiki...');
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

    const walletAddress = `${RAFIKI_CONFIG.baseWalletUrl}/${accountData.iban}`;
    const variables = {
      input: {
        assetId: RAFIKI_CONFIG.assetId,
        address: walletAddress,
        publicName: accountData.publicName || accountData.name,
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
      'signature': this.generateBackendApiSignature(requestBody),
      'tenant-id': RAFIKI_CONFIG.senderTenantId
    };

    console.log('🔗 OC Service: Sending request to Rafiki GraphQL...');
    console.log('🎯 URL:', RAFIKI_CONFIG.graphqlUrl);

    try {
      const response = await axios.post(RAFIKI_CONFIG.graphqlUrl, requestBody, { headers });

      console.log('✅ OC Service: Rafiki response received');
      console.log('📊 Response status:', response.status);

      if (response.data?.errors) {
        console.error('❌ OC Service: Rafiki GraphQL errors:', response.data.errors);
        throw new Error(`Rafiki GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      if (!response.data?.data?.createWalletAddress?.walletAddress) {
        console.error('❌ OC Service: No wallet address returned from Rafiki');
        throw new Error('No wallet address returned from Rafiki');
      }

      const rafikiWallet = response.data.data.createWalletAddress.walletAddress;
      console.log('✅ OC Service: Wallet created in Rafiki:', rafikiWallet);

      return rafikiWallet;
      
    } catch (error) {
      console.error('❌ OC Service: Error creating wallet address in Rafiki:', error);
      if (axios.isAxiosError(error)) {
        console.error('📡 OC Service: Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
      }
      throw error;
    }
  }
}

export const rafikiService = new RafikiService();
