import { Pool } from 'pg';
import {
  generateRandomId,
  generateIBAN,
  formatIBAN,
  formatMobile,
  validateIBAN,
  validateMobile
} from '../utils';
import {
  generateUsername,
  hashPassword,
  verifyPassword
} from '../auth';
import {
  getUSDtoPKRRate,
  convertUSDtoPKR,
  needsCurrencyConversion,
  formatCurrencyAmount,
  getCurrencySymbol,
  calculateConversionRisk
} from '../currency';

// Mock fetch for currency tests
global.fetch = jest.fn();

describe('Error Handling and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Utils Error Handling', () => {
    describe('formatIBAN edge cases', () => {
      test('should handle null input', () => {
        expect(() => formatIBAN(null as any)).toThrow();
      });

      test('should handle undefined input', () => {
        expect(() => formatIBAN(undefined as any)).toThrow();
      });

      test('should handle numeric input', () => {
        const result = formatIBAN(12345 as any);
        expect(result).toBe('PK12345');
      });

      test('should handle very long input', () => {
        const longInput = 'A'.repeat(1000);
        const result = formatIBAN(longInput);
        expect(result.startsWith('PK')).toBe(true);
        expect(result.length).toBe(1002); // PK + 1000 chars
      });

      test('should handle input with only special characters', () => {
        const result = formatIBAN('!@#$%^&*()');
        expect(result).toBe('PK');
      });

      test('should handle mixed language characters', () => {
        const result = formatIBAN('PK12مرحبا3456');
        expect(result).toBe('PK123456'); // Should remove non-English chars
      });
    });

    describe('formatMobile edge cases', () => {
      test('should handle null input', () => {
        expect(() => formatMobile(null as any)).toThrow();
      });

      test('should handle undefined input', () => {
        expect(() => formatMobile(undefined as any)).toThrow();
      });

      test('should handle numeric input', () => {
        const result = formatMobile(923001234567 as any);
        expect(result).toBe('+923001234567');
      });

      test('should handle very long input', () => {
        const longInput = '9'.repeat(50);
        const result = formatMobile(longInput);
        expect(result.startsWith('+92')).toBe(true);
      });

      test('should handle input with only letters', () => {
        const result = formatMobile('abcdefghijk');
        expect(result).toBe('+92');
      });

      test('should handle international format attempts', () => {
        const result = formatMobile('+1234567890');
        expect(result).toBe('+921234567890'); // Should still add +92
      });
    });

    describe('validateIBAN edge cases', () => {
      test('should handle null input', () => {
        expect(validateIBAN(null as any)).toBe(false);
      });

      test('should handle undefined input', () => {
        expect(validateIBAN(undefined as any)).toBe(false);
      });

      test('should handle numeric input', () => {
        expect(validateIBAN(123456789 as any)).toBe(false);
      });

      test('should handle object input', () => {
        expect(validateIBAN({} as any)).toBe(false);
      });

      test('should handle array input', () => {
        expect(validateIBAN([] as any)).toBe(false);
      });

      test('should validate edge case lengths', () => {
        expect(validateIBAN('PK12ABBL12345678901234')).toBe(false); // Too short
        expect(validateIBAN('PK12ABBL123456789012345')).toBe(false); // Too long
        expect(validateIBAN('PK12ABBL1234567890123456')).toBe(true); // Correct length
      });

      test('should handle IBANs with mixed case', () => {
        expect(validateIBAN('pk12abbl1234567890123456')).toBe(false); // Must be uppercase
        expect(validateIBAN('Pk12Abbl1234567890123456')).toBe(false); // Mixed case
      });
    });

    describe('validateMobile edge cases', () => {
      test('should handle various input types', () => {
        expect(validateMobile(null as any)).toBe(false);
        expect(validateMobile(undefined as any)).toBe(false);
        expect(validateMobile(123456789 as any)).toBe(false);
        expect(validateMobile({} as any)).toBe(false);
        expect(validateMobile([] as any)).toBe(false);
      });

      test('should validate edge case lengths', () => {
        expect(validateMobile('+9230012345')).toBe(false); // Too short
        expect(validateMobile('+92300123456')).toBe(false); // Too short
        expect(validateMobile('+923001234567')).toBe(true); // Correct
        expect(validateMobile('+9230012345678')).toBe(false); // Too long
      });

      test('should handle borderline valid numbers', () => {
        expect(validateMobile('+920000000000')).toBe(true); // Edge case but valid format
        expect(validateMobile('+929999999999')).toBe(true); // Edge case but valid format
      });
    });

    describe('generateWalletAddress edge cases', () => {
      test('should handle empty customer name', () => {
        const result = generateWalletAddress('', 'test123');
        expect(result).toBe('https://abl-backend/accounts/-test123');
      });

      test('should handle customer name with only spaces', () => {
        const result = generateWalletAddress('   ', 'test123');
        expect(result).toBe('https://abl-backend/accounts/-test123');
      });

      test('should handle customer name with only special characters', () => {
        const result = generateWalletAddress('!@#$%^&*()', 'test123');
        expect(result).toBe('https://abl-backend/accounts/-test123');
      });

      test('should handle very long customer names', () => {
        const longName = 'A'.repeat(200);
        const result = generateWalletAddress(longName, 'test123');
        expect(result).toContain('aaa'); // Should be converted to lowercase
        expect(result.length).toBeGreaterThan(0);
      });

      test('should handle empty IBAN', () => {
        const result = generateWalletAddress('John Doe', 'test123', '');
        expect(result).toBe('https://abl-backend/accounts/john-doe-test123');
      });

      test('should handle null parameters', () => {
        expect(() => generateWalletAddress(null as any, 'test')).toThrow();
        expect(() => generateWalletAddress('John', null as any)).toThrow();
      });
    });
  });

  describe('Auth Error Handling', () => {
    describe('generateUsername edge cases', () => {
      test('should handle invalid email formats', () => {
        const result = generateUsername('notanemail', 'PK12ABBL1234567890123456');
        expect(result).toContain('notanemail'); // Should use whole string before @
      });

      test('should handle email with multiple @ symbols', () => {
        const result = generateUsername('user@domain@test.com', 'PK12ABBL1234567890123456');
        expect(result).toContain('user'); // Should use part before first @
      });

      test('should handle empty email', () => {
        const result = generateUsername('', 'PK12ABBL1234567890123456');
        expect(result).toContain('3456'); // Should still include IBAN part
        expect(result.length).toBeGreaterThan(6); // Should have random part
      });

      test('should handle empty IBAN', () => {
        const result = generateUsername('test@example.com', '');
        expect(result).toContain('test'); // Should still include email part
      });

      test('should handle very short IBAN', () => {
        const result = generateUsername('test@example.com', 'PK');
        expect(result).toContain('test');
        expect(result).toContain('PK'); // Should use whole IBAN if less than 4 chars
      });

      test('should handle null/undefined inputs', () => {
        expect(() => generateUsername(null as any, 'IBAN')).toThrow();
        expect(() => generateUsername('email', null as any)).toThrow();
        expect(() => generateUsername(undefined as any, 'IBAN')).toThrow();
      });

      test('should handle very long email and IBAN', () => {
        const longEmail = 'a'.repeat(100) + '@example.com';
        const longIban = 'PK12ABBL' + '1'.repeat(50);
        
        const result = generateUsername(longEmail, longIban);
        expect(result.length).toBeLessThanOrEqual(20); // Should be truncated
      });
    });

    describe('hashPassword edge cases', () => {
      test('should handle empty password', async () => {
        const hash = await hashPassword('');
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
      });

      test('should handle very long password', async () => {
        const longPassword = 'A'.repeat(10000);
        const hash = await hashPassword(longPassword);
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
      });

      test('should handle null password', async () => {
        await expect(hashPassword(null as any)).rejects.toThrow();
      });

      test('should handle undefined password', async () => {
        await expect(hashPassword(undefined as any)).rejects.toThrow();
      });

      test('should handle non-string password', async () => {
        await expect(hashPassword(123456 as any)).rejects.toThrow();
      });

      test('should handle password with null bytes', async () => {
        const passwordWithNull = 'password\0test';
        const hash = await hashPassword(passwordWithNull);
        expect(hash).toBeDefined();
      });

      test('should handle unicode passwords', async () => {
        const unicodePassword = '密码测试🔒🗝️';
        const hash = await hashPassword(unicodePassword);
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
      });
    });

    describe('verifyPassword edge cases', () => {
      test('should handle invalid hash format', async () => {
        await expect(verifyPassword('password', 'invalid-hash')).rejects.toThrow();
      });

      test('should handle empty hash', async () => {
        await expect(verifyPassword('password', '')).rejects.toThrow();
      });

      test('should handle null inputs', async () => {
        await expect(verifyPassword(null as any, 'hash')).rejects.toThrow();
        await expect(verifyPassword('password', null as any)).rejects.toThrow();
      });

      test('should handle very long password verification', async () => {
        const longPassword = 'A'.repeat(10000);
        const hash = await hashPassword(longPassword);
        
        const isValid = await verifyPassword(longPassword, hash);
        expect(isValid).toBe(true);
      });

      test('should handle hash tampering', async () => {
        const password = 'testpassword';
        const hash = await hashPassword(password);
        
        // Tamper with the hash
        const tamperedHash = hash.slice(0, -5) + 'XXXXX';
        
        const isValid = await verifyPassword(password, tamperedHash);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Currency Error Handling', () => {
    describe('getUSDtoPKRRate edge cases', () => {
      test('should handle network timeout', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
        );

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(278.50); // Should return fallback rate
      });

      test('should handle malformed JSON response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => { throw new Error('Invalid JSON'); }
        });

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(278.50); // Should return fallback rate
      });

      test('should handle missing data in response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'No data' })
        });

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(278.50); // Should return fallback rate
      });

      test('should handle API rate limiting', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        });

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(278.50); // Should return fallback rate
      });

      test('should handle API key errors', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden'
        });

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(278.50); // Should return fallback rate
      });

      test('should handle DNS resolution failures', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce({
          code: 'ENOTFOUND',
          message: 'DNS resolution failed'
        });

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(278.50); // Should return fallback rate
      });

      test('should handle extremely high rates', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { PKR: 999999 } })
        });

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(999999); // Should accept high but valid rates
      });

      test('should handle zero rate', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { PKR: 0 } })
        });

        const rate = await getUSDtoPKRRate();
        expect(rate).toBe(278.50); // Should return fallback for invalid rate
      });
    });

    describe('convertUSDtoPKR edge cases', () => {
      test('should handle very large USD amounts', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { PKR: 280.0 } })
        });

        const result = await convertUSDtoPKR(999999999);
        expect(result.originalAmount).toBe(999999999);
        expect(result.convertedAmount).toBe(279999999720); // 999999999 * 280
      });

      test('should handle negative USD amounts', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { PKR: 280.0 } })
        });

        const result = await convertUSDtoPKR(-100);
        expect(result.originalAmount).toBe(-100);
        expect(result.convertedAmount).toBe(-28000); // -100 * 280
      });

      test('should handle decimal precision issues', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { PKR: 278.333333 } })
        });

        const result = await convertUSDtoPKR(1);
        expect(result.convertedAmount).toBe(278.33); // Should round to 2 decimal places
      });

      test('should handle very small amounts', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { PKR: 280.0 } })
        });

        const result = await convertUSDtoPKR(0.01);
        expect(result.originalAmount).toBe(0.01);
        expect(result.convertedAmount).toBe(2.80);
      });

      test('should handle rate fetch failure during conversion', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const result = await convertUSDtoPKR(100);
        expect(result.originalAmount).toBe(100);
        expect(result.exchangeRate).toBe(278.50); // Should use fallback
        expect(result.convertedAmount).toBe(27850);
      });
    });

    describe('formatCurrencyAmount edge cases', () => {
      test('should handle very large amounts', () => {
        const result = formatCurrencyAmount(999999999999.99, 'USD');
        expect(result).toBe('$999999999999.99');
      });

      test('should handle very small amounts', () => {
        const result = formatCurrencyAmount(0.001, 'PKR');
        expect(result).toBe('₨0.00'); // Should round to 2 decimal places
      });

      test('should handle negative amounts', () => {
        expect(formatCurrencyAmount(-100.50, 'USD')).toBe('$-100.50');
        expect(formatCurrencyAmount(-200.75, 'PKR')).toBe('₨-200.75');
      });

      test('should handle NaN input', () => {
        const result = formatCurrencyAmount(NaN, 'USD');
        expect(result).toBe('$NaN');
      });

      test('should handle Infinity', () => {
        const result = formatCurrencyAmount(Infinity, 'USD');
        expect(result).toBe('$Infinity');
      });

      test('should handle null/undefined currency', () => {
        expect(formatCurrencyAmount(100, null as any)).toContain('100.00');
        expect(formatCurrencyAmount(100, undefined as any)).toContain('100.00');
      });

      test('should handle empty string currency', () => {
        const result = formatCurrencyAmount(100, '');
        expect(result).toBe(' 100.00');
      });
    });

    describe('calculateConversionRisk edge cases', () => {
      test('should handle negative USD amounts', () => {
        const risk = calculateConversionRisk(-1000, -278500);
        expect(risk).toBe(10); // Should treat as low risk
      });

      test('should handle zero amounts', () => {
        const risk = calculateConversionRisk(0, 0);
        expect(risk).toBe(10);
      });

      test('should handle very large amounts', () => {
        const risk = calculateConversionRisk(999999999, 278499999722);
        expect(risk).toBe(75); // Should be high risk
      });

      test('should handle decimal amounts at boundaries', () => {
        expect(calculateConversionRisk(999.99, 278497.22)).toBe(10);
        expect(calculateConversionRisk(1000.01, 278502.785)).toBe(25);
        expect(calculateConversionRisk(4999.99, 1392497.215)).toBe(25);
        expect(calculateConversionRisk(5000.01, 1392502.785)).toBe(45);
        expect(calculateConversionRisk(9999.99, 2784997.215)).toBe(45);
        expect(calculateConversionRisk(10000.01, 2785002.785)).toBe(75);
      });

      test('should handle NaN inputs', () => {
        const risk = calculateConversionRisk(NaN, 1000);
        expect(risk).toBe(10); // Should default to low risk
      });

      test('should handle Infinity inputs', () => {
        const risk = calculateConversionRisk(Infinity, 1000);
        expect(risk).toBe(75); // Should be high risk
      });
    });

    describe('needsCurrencyConversion edge cases', () => {
      test('should handle null/undefined inputs', () => {
        expect(needsCurrencyConversion(null as any, 'PKR')).toBe(false);
        expect(needsCurrencyConversion('USD', null as any)).toBe(false);
        expect(needsCurrencyConversion(undefined as any, 'PKR')).toBe(false);
        expect(needsCurrencyConversion('USD', undefined as any)).toBe(false);
      });

      test('should handle empty string inputs', () => {
        expect(needsCurrencyConversion('', 'PKR')).toBe(false);
        expect(needsCurrencyConversion('USD', '')).toBe(false);
        expect(needsCurrencyConversion('', '')).toBe(false);
      });

      test('should handle case variations', () => {
        expect(needsCurrencyConversion('usd', 'pkr')).toBe(false);
        expect(needsCurrencyConversion('Usd', 'Pkr')).toBe(false);
        expect(needsCurrencyConversion('USD', 'pkr')).toBe(false);
        expect(needsCurrencyConversion('usd', 'PKR')).toBe(false);
      });

      test('should handle numeric inputs', () => {
        expect(needsCurrencyConversion(123 as any, 456 as any)).toBe(false);
      });

      test('should handle object inputs', () => {
        expect(needsCurrencyConversion({} as any, [] as any)).toBe(false);
      });
    });

    describe('getCurrencySymbol edge cases', () => {
      test('should handle null/undefined inputs', () => {
        expect(getCurrencySymbol(null as any)).toBe(null);
        expect(getCurrencySymbol(undefined as any)).toBe(undefined);
      });

      test('should handle numeric inputs', () => {
        expect(getCurrencySymbol(123 as any)).toBe(123);
      });

      test('should handle object inputs', () => {
        const obj = {};
        expect(getCurrencySymbol(obj as any)).toBe(obj);
      });

      test('should handle empty string', () => {
        expect(getCurrencySymbol('')).toBe('');
      });

      test('should handle very long strings', () => {
        const longString = 'A'.repeat(1000);
        expect(getCurrencySymbol(longString)).toBe(longString);
      });
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    test('should handle multiple concurrent IBAN generations', () => {
      const promises = Array.from({ length: 100 }, () => generateIBAN());
      const ibans = Promise.all(promises);
      
      return ibans.then(results => {
        const uniqueIbans = new Set(results);
        expect(uniqueIbans.size).toBe(100); // All should be unique
      });
    });

    test('should handle multiple concurrent ID generations', () => {
      const promises = Array.from({ length: 100 }, () => generateRandomId());
      const ids = Promise.all(promises);
      
      return ids.then(results => {
        const uniqueIds = new Set(results);
        expect(uniqueIds.size).toBe(100); // All should be unique
      });
    });

    test('should handle concurrent password hashing', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        hashPassword(`password${i}`)
      );
      
      const hashes = await Promise.all(promises);
      
      expect(hashes).toHaveLength(10);
      hashes.forEach(hash => {
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
      });
    });

    test('should handle concurrent currency conversions', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { PKR: 280.0 } })
      });

      const promises = Array.from({ length: 10 }, (_, i) => 
        convertUSDtoPKR(100 + i)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.originalAmount).toBe(100 + i);
        expect(result.convertedAmount).toBe((100 + i) * 280);
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('should handle memory stress with large string operations', () => {
      const largeInput = 'A'.repeat(100000);
      
      // These operations should not cause memory issues
      const formattedIban = formatIBAN(largeInput);
      const formattedMobile = formatMobile(largeInput);
      
      expect(formattedIban).toBeDefined();
      expect(formattedMobile).toBeDefined();
    });

    test('should handle rapid successive operations', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        generateRandomId();
        generateIBAN();
        formatIBAN('PK12ABBL1234567890123456');
        validateIBAN('PK12ABBL1234567890123456');
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle validation of many inputs efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        validateIBAN(`PK${i.toString().padStart(2, '0')}ABBL1234567890123456`);
        validateMobile(`+92300123${i.toString().padStart(4, '0')}`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should be very fast
    });
  });
});

