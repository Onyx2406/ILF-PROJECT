import {
  getUSDtoPKRRate,
  convertUSDtoPKR,
  needsCurrencyConversion,
  formatCurrencyAmount,
  getCurrencySymbol,
  calculateConversionRisk
} from '../currency';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Currency Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUSDtoPKRRate', () => {
    test('should fetch current USD to PKR rate successfully', async () => {
      const mockResponse = {
        data: { PKR: 278.50 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(278.50);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('freecurrencyapi.com'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
      );
    });

    test('should return fallback rate when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(278.50); // fallback rate
    });

    test('should return fallback rate when API returns invalid data', async () => {
      const mockResponse = {
        data: { PKR: null }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(278.50); // fallback rate
    });

    test('should return fallback rate when API returns zero rate', async () => {
      const mockResponse = {
        data: { PKR: 0 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(278.50); // fallback rate
    });

    test('should return fallback rate when API returns negative rate', async () => {
      const mockResponse = {
        data: { PKR: -100 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(278.50); // fallback rate
    });

    test('should handle API response with wrong status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(278.50); // fallback rate
    });

    test('should handle malformed JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(278.50); // fallback rate
    });

    test('should validate rate is positive number', async () => {
      const mockResponse = {
        data: { PKR: 300.75 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const rate = await getUSDtoPKRRate();

      expect(rate).toBe(300.75);
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThan(0);
    });
  });

  describe('convertUSDtoPKR', () => {
    test('should convert USD to PKR correctly', async () => {
      // Mock the rate fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { PKR: 280.00 } })
      });

      const result = await convertUSDtoPKR(100);

      expect(result).toBeDefined();
      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe('USD');
      expect(result.convertedAmount).toBe(28000.00);
      expect(result.convertedCurrency).toBe('PKR');
      expect(result.exchangeRate).toBe(280.00);
      expect(result.provider).toBe('FreeCurrencyAPI');
      expect(result.timestamp).toBeDefined();
    });

    test('should handle decimal USD amounts', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { PKR: 278.50 } })
      });

      const result = await convertUSDtoPKR(15.75);

      expect(result.originalAmount).toBe(15.75);
      expect(result.convertedAmount).toBe(4385.88); // 15.75 * 278.50 = 4385.875, rounded to 4385.88
      expect(result.exchangeRate).toBe(278.50);
    });

    test('should handle zero amount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { PKR: 278.50 } })
      });

      const result = await convertUSDtoPKR(0);

      expect(result.originalAmount).toBe(0);
      expect(result.convertedAmount).toBe(0);
    });

    test('should round converted amount to 2 decimal places', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { PKR: 278.333 } })
      });

      const result = await convertUSDtoPKR(1);

      expect(result.convertedAmount).toBe(278.33);
    });

    test('should include proper timestamp format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { PKR: 278.50 } })
      });

      const result = await convertUSDtoPKR(100);

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    test('should work with fallback rate when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API failed'));

      const result = await convertUSDtoPKR(100);

      expect(result.originalAmount).toBe(100);
      expect(result.convertedAmount).toBe(27850.00); // 100 * 278.50
      expect(result.exchangeRate).toBe(278.50);
    });
  });

  describe('needsCurrencyConversion', () => {
    test('should return true for USD to PKR conversion', () => {
      const result = needsCurrencyConversion('USD', 'PKR');
      expect(result).toBe(true);
    });

    test('should return false for same currency', () => {
      const result = needsCurrencyConversion('USD', 'USD');
      expect(result).toBe(false);
    });

    test('should return false for PKR to USD conversion', () => {
      const result = needsCurrencyConversion('PKR', 'USD');
      expect(result).toBe(false);
    });

    test('should return false for other currency combinations', () => {
      expect(needsCurrencyConversion('EUR', 'PKR')).toBe(false);
      expect(needsCurrencyConversion('USD', 'EUR')).toBe(false);
      expect(needsCurrencyConversion('GBP', 'USD')).toBe(false);
    });

    test('should handle case sensitivity', () => {
      expect(needsCurrencyConversion('usd', 'pkr')).toBe(false);
      expect(needsCurrencyConversion('Usd', 'Pkr')).toBe(false);
    });

    test('should handle empty strings', () => {
      expect(needsCurrencyConversion('', '')).toBe(false);
      expect(needsCurrencyConversion('USD', '')).toBe(false);
      expect(needsCurrencyConversion('', 'PKR')).toBe(false);
    });
  });

  describe('formatCurrencyAmount', () => {
    test('should format USD amounts correctly', () => {
      expect(formatCurrencyAmount(100, 'USD')).toBe('$100.00');
      expect(formatCurrencyAmount(1234.56, 'USD')).toBe('$1234.56');
      expect(formatCurrencyAmount(0, 'USD')).toBe('$0.00');
    });

    test('should format PKR amounts correctly', () => {
      expect(formatCurrencyAmount(27850, 'PKR')).toBe('₨27850.00');
      expect(formatCurrencyAmount(1234.56, 'PKR')).toBe('₨1234.56');
      expect(formatCurrencyAmount(0, 'PKR')).toBe('₨0.00');
    });

    test('should format other currencies correctly', () => {
      expect(formatCurrencyAmount(100, 'EUR')).toBe('EUR 100.00');
      expect(formatCurrencyAmount(100, 'GBP')).toBe('GBP 100.00');
      expect(formatCurrencyAmount(100, 'JPY')).toBe('JPY 100.00');
    });

    test('should handle decimal places correctly', () => {
      expect(formatCurrencyAmount(100.1, 'USD')).toBe('$100.10');
      expect(formatCurrencyAmount(100.99, 'USD')).toBe('$100.99');
      expect(formatCurrencyAmount(100.999, 'USD')).toBe('$101.00');
    });

    test('should handle negative amounts', () => {
      expect(formatCurrencyAmount(-100, 'USD')).toBe('$-100.00');
      expect(formatCurrencyAmount(-100, 'PKR')).toBe('₨-100.00');
    });

    test('should handle very large amounts', () => {
      expect(formatCurrencyAmount(1000000, 'USD')).toBe('$1000000.00');
      expect(formatCurrencyAmount(999999.99, 'PKR')).toBe('₨999999.99');
    });
  });

  describe('getCurrencySymbol', () => {
    test('should return correct symbol for supported currencies', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('PKR')).toBe('₨');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    test('should return currency code for unsupported currencies', () => {
      expect(getCurrencySymbol('JPY')).toBe('JPY');
      expect(getCurrencySymbol('CAD')).toBe('CAD');
      expect(getCurrencySymbol('AUD')).toBe('AUD');
      expect(getCurrencySymbol('CHF')).toBe('CHF');
    });

    test('should handle empty string', () => {
      expect(getCurrencySymbol('')).toBe('');
    });

    test('should handle case sensitivity', () => {
      expect(getCurrencySymbol('usd')).toBe('usd'); // Should return as-is if not exact match
      expect(getCurrencySymbol('Usd')).toBe('Usd');
    });

    test('should handle null/undefined input', () => {
      expect(getCurrencySymbol(null as any)).toBe(null);
      expect(getCurrencySymbol(undefined as any)).toBe(undefined);
    });
  });

  describe('calculateConversionRisk', () => {
    test('should return high risk for large amounts ($10,000+)', () => {
      expect(calculateConversionRisk(10000, 2785000)).toBe(75);
      expect(calculateConversionRisk(50000, 13925000)).toBe(75);
      expect(calculateConversionRisk(100000, 27850000)).toBe(75);
    });

    test('should return medium risk for $5,000-$9,999', () => {
      expect(calculateConversionRisk(5000, 1392500)).toBe(45);
      expect(calculateConversionRisk(7500, 2088750)).toBe(45);
      expect(calculateConversionRisk(9999, 2784721.5)).toBe(45);
    });

    test('should return low-medium risk for $1,000-$4,999', () => {
      expect(calculateConversionRisk(1000, 278500)).toBe(25);
      expect(calculateConversionRisk(2500, 696250)).toBe(25);
      expect(calculateConversionRisk(4999, 1392221.5)).toBe(25);
    });

    test('should return low risk for under $1,000', () => {
      expect(calculateConversionRisk(100, 27850)).toBe(10);
      expect(calculateConversionRisk(500, 139250)).toBe(10);
      expect(calculateConversionRisk(999, 278221.5)).toBe(10);
      expect(calculateConversionRisk(0, 0)).toBe(10);
    });

    test('should handle decimal amounts correctly', () => {
      expect(calculateConversionRisk(999.99, 278472.215)).toBe(10);
      expect(calculateConversionRisk(1000.01, 278502.785)).toBe(25);
      expect(calculateConversionRisk(4999.99, 1392497.215)).toBe(25);
      expect(calculateConversionRisk(5000.01, 1392502.785)).toBe(45);
    });

    test('should base risk on USD amount regardless of PKR amount', () => {
      // Test that PKR amount doesn't affect risk calculation
      expect(calculateConversionRisk(1000, 1000000)).toBe(25); // High PKR but low USD
      expect(calculateConversionRisk(10000, 100000)).toBe(75); // High USD but low PKR
    });

    test('should handle edge case amounts', () => {
      expect(calculateConversionRisk(1000, 278500)).toBe(25); // Exactly $1,000
      expect(calculateConversionRisk(5000, 1392500)).toBe(45); // Exactly $5,000
      expect(calculateConversionRisk(10000, 2785000)).toBe(75); // Exactly $10,000
    });

    test('should handle negative amounts', () => {
      // Risk calculation should probably handle negative amounts gracefully
      expect(calculateConversionRisk(-1000, -278500)).toBe(10); // Negative amounts treated as low risk
    });
  });

  describe('Integration Tests', () => {
    test('should work end-to-end: fetch rate, convert, format, and calculate risk', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { PKR: 280.00 } })
      });

      const usdAmount = 1500;
      
      // Convert
      const conversion = await convertUSDtoPKR(usdAmount);
      expect(conversion.originalAmount).toBe(1500);
      expect(conversion.convertedAmount).toBe(420000);
      
      // Format amounts
      const formattedUSD = formatCurrencyAmount(conversion.originalAmount, conversion.originalCurrency);
      const formattedPKR = formatCurrencyAmount(conversion.convertedAmount, conversion.convertedCurrency);
      expect(formattedUSD).toBe('$1500.00');
      expect(formattedPKR).toBe('₨420000.00');
      
      // Calculate risk
      const risk = calculateConversionRisk(conversion.originalAmount, conversion.convertedAmount);
      expect(risk).toBe(25); // $1,500 should be low-medium risk
      
      // Check if conversion is needed
      const needsConversion = needsCurrencyConversion('USD', 'PKR');
      expect(needsConversion).toBe(true);
    });

    test('should handle complete currency workflow with fallback', async () => {
      // Simulate API failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API down'));

      const usdAmount = 10000;
      
      // Should still work with fallback rate
      const conversion = await convertUSDtoPKR(usdAmount);
      expect(conversion.exchangeRate).toBe(278.50); // fallback rate
      expect(conversion.convertedAmount).toBe(2785000);
      
      // Risk should be high for $10,000
      const risk = calculateConversionRisk(usdAmount, conversion.convertedAmount);
      expect(risk).toBe(75);
      
      // Formatting should work
      const formattedAmount = formatCurrencyAmount(conversion.convertedAmount, 'PKR');
      expect(formattedAmount).toBe('₨2785000.00');
    });
  });
});

