interface CurrencyRate {
  data: {
    PKR: number;
    [key: string]: number;
  };
}

interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  exchangeRate: number;
  provider: string;
  timestamp: string;
}

// Free Currency API endpoint (5,000 requests/month free)
const CURRENCY_API_URL = 'https://api.freecurrencyapi.com/v1/latest';
const API_KEY = 'fca_live_3mVOKCUY9ZLJpNjIKUbfbTGdMNwNXLQOhT1eZwdP';

/**
 * Fetch current USD to PKR exchange rate
 */
export async function getUSDtoPKRRate(): Promise<number> {
  try {
    console.log('💱 Fetching live USD to PKR exchange rate...');
    
    const response = await fetch(`${CURRENCY_API_URL}?apikey=${API_KEY}&currencies=PKR&base_currency=USD`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Currency API error: ${response.status} ${response.statusText}`);
    }
    
    const data: CurrencyRate = await response.json();
    const rate = data.data?.PKR;
    
    if (!rate || rate <= 0) {
      throw new Error('Invalid PKR rate received from API');
    }
    
    console.log(`✅ Current USD to PKR rate: ${rate}`);
    return rate;
    
  } catch (error) {
    console.error('❌ Error fetching currency rate:', error);
    
    // Fallback to approximate rate if API fails
    const fallbackRate = 278.50; // Approximate USD to PKR rate (update periodically)
    console.log(`⚠️ Using fallback USD to PKR rate: ${fallbackRate}`);
    return fallbackRate;
  }
}

/**
 * Convert USD amount to PKR using current exchange rate
 */
export async function convertUSDtoPKR(usdAmount: number): Promise<ConversionResult> {
  const exchangeRate = await getUSDtoPKRRate();
  const convertedAmount = parseFloat((usdAmount * exchangeRate).toFixed(2));
  
  const result: ConversionResult = {
    originalAmount: usdAmount,
    originalCurrency: 'USD',
    convertedAmount: convertedAmount,
    convertedCurrency: 'PKR',
    exchangeRate: exchangeRate,
    provider: 'FreeCurrencyAPI',
    timestamp: new Date().toISOString()
  };
  
  console.log(`💱 Conversion: $${usdAmount} → ₨${convertedAmount} (Rate: ${exchangeRate})`);
  return result;
}

/**
 * Check if currency conversion is needed based on payment and account currencies
 */
export function needsCurrencyConversion(paymentCurrency: string, accountCurrency: string): boolean {
  return paymentCurrency === 'USD' && accountCurrency === 'PKR';
}

/**
 * Format currency amount with proper symbol
 */
export function formatCurrencyAmount(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  } else if (currency === 'PKR') {
    return `₨${amount.toFixed(2)}`;
  } else {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Get currency symbol for display
 */
export function getCurrencySymbol(currency: string): string {
  switch (currency) {
    case 'USD': return '$';
    case 'PKR': return '₨';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return currency;
  }
}

/**
 * Calculate risk score based on converted amount (for PKR accounts)
 */
export function calculateConversionRisk(originalUSD: number, convertedPKR: number): number {
  // Base risk on USD amount since that's the international standard
  if (originalUSD >= 10000) return 75; // High risk for $10,000+
  if (originalUSD >= 5000) return 45;  // Medium risk for $5,000+
  if (originalUSD >= 1000) return 25;  // Low-medium risk for $1,000+
  return 10; // Low risk for under $1,000
}
