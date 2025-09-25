import {
  generateRandomId,
  generateIBAN,
  formatIBAN,
  formatMobile,
  generateWalletAddress,
  validateIBAN,
  validateMobile,
  formatDate
} from '../utils';

describe('Utils Library', () => {
  describe('generateRandomId', () => {
    test('should generate a 12-character random ID', () => {
      const id = generateRandomId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(12);
    });

    test('should generate unique IDs', () => {
      const id1 = generateRandomId();
      const id2 = generateRandomId();
      expect(id1).not.toBe(id2);
    });

    test('should generate IDs with only valid characters', () => {
      const id = generateRandomId();
      // nanoid uses URL-safe characters
      expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    });
  });

  describe('generateIBAN', () => {
    test('should generate valid Pakistani IBAN format', () => {
      const iban = generateIBAN();
      expect(iban).toBeDefined();
      expect(typeof iban).toBe('string');
      expect(iban).toMatch(/^PK\d{2}ABBL\d{16}$/);
    });

    test('should generate unique IBANs', () => {
      const iban1 = generateIBAN();
      const iban2 = generateIBAN();
      expect(iban1).not.toBe(iban2);
    });

    test('should start with PK and contain ABBL bank code', () => {
      const iban = generateIBAN();
      expect(iban.startsWith('PK')).toBe(true);
      expect(iban.includes('ABBL')).toBe(true);
    });

    test('should have correct length (24 characters)', () => {
      const iban = generateIBAN();
      expect(iban.length).toBe(24);
    });
  });

  describe('formatIBAN', () => {
    test('should remove non-alphanumeric characters', () => {
      const input = 'PK12-ABBL-1234-5678-9012-3456';
      const result = formatIBAN(input);
      expect(result).toBe('PK12ABBL123456789012345');
    });

    test('should convert to uppercase', () => {
      const input = 'pk12abbl123456789012345';
      const result = formatIBAN(input);
      expect(result).toBe('PK12ABBL123456789012345');
    });

    test('should add PK prefix if missing', () => {
      const input = '12ABBL123456789012345';
      const result = formatIBAN(input);
      expect(result).toBe('PK12ABBL123456789012345');
    });

    test('should handle empty string', () => {
      const result = formatIBAN('');
      expect(result).toBe('PK');
    });

    test('should handle already formatted IBAN', () => {
      const input = 'PK12ABBL123456789012345';
      const result = formatIBAN(input);
      expect(result).toBe(input);
    });
  });

  describe('formatMobile', () => {
    test('should format Pakistani mobile number', () => {
      const input = '03001234567';
      const result = formatMobile(input);
      expect(result).toBe('+923001234567');
    });

    test('should handle number starting with 92', () => {
      const input = '923001234567';
      const result = formatMobile(input);
      expect(result).toBe('+923001234567');
    });

    test('should handle number already with +92', () => {
      const input = '+923001234567';
      const result = formatMobile(input);
      expect(result).toBe('+923001234567');
    });

    test('should remove non-numeric characters except +', () => {
      const input = '+92-300-123-4567';
      const result = formatMobile(input);
      expect(result).toBe('+923001234567');
    });

    test('should handle empty string', () => {
      const result = formatMobile('');
      expect(result).toBe('+92');
    });
  });

  describe('generateWalletAddress', () => {
    test('should generate IBAN-based wallet address when IBAN provided', () => {
      const customerName = 'John Doe';
      const randomId = 'test123';
      const iban = 'PK12ABBL123456789012345';
      
      const result = generateWalletAddress(customerName, randomId, iban);
      expect(result).toBe(`https://abl-backend/${iban}`);
    });

    test('should generate name-based wallet address when no IBAN', () => {
      const customerName = 'John Doe';
      const randomId = 'test123';
      
      const result = generateWalletAddress(customerName, randomId);
      expect(result).toBe('https://abl-backend/accounts/john-doe-test123');
    });

    test('should clean customer name properly', () => {
      const customerName = 'John@Doe#123 Test';
      const randomId = 'abc';
      
      const result = generateWalletAddress(customerName, randomId);
      expect(result).toBe('https://abl-backend/accounts/johndoe123-test-abc');
    });

    test('should handle special characters in name', () => {
      const customerName = 'André José-María';
      const randomId = '123';
      
      const result = generateWalletAddress(customerName, randomId);
      expect(result).toBe('https://abl-backend/accounts/andr-jos-mara-123');
    });
  });

  describe('validateIBAN', () => {
    test('should validate correct Pakistani IBAN', () => {
      const validIban = 'PK12ABBL1234567890123456';
      expect(validateIBAN(validIban)).toBe(true);
    });

    test('should reject IBAN with wrong country code', () => {
      const invalidIban = 'US12ABBL1234567890123456';
      expect(validateIBAN(invalidIban)).toBe(false);
    });

    test('should reject IBAN with wrong bank code', () => {
      const invalidIban = 'PK12XXXX1234567890123456';
      expect(validateIBAN(invalidIban)).toBe(false);
    });

    test('should reject IBAN with wrong length', () => {
      const invalidIban = 'PK12ABBL12345';
      expect(validateIBAN(invalidIban)).toBe(false);
    });

    test('should reject IBAN with invalid characters', () => {
      const invalidIban = 'PK12ABBL123456789012345A';
      expect(validateIBAN(invalidIban)).toBe(false);
    });

    test('should reject empty string', () => {
      expect(validateIBAN('')).toBe(false);
    });

    test('should reject lowercase IBAN', () => {
      const invalidIban = 'pk12abbl1234567890123456';
      expect(validateIBAN(invalidIban)).toBe(false);
    });
  });

  describe('validateMobile', () => {
    test('should validate correct Pakistani mobile number', () => {
      const validMobile = '+923001234567';
      expect(validateMobile(validMobile)).toBe(true);
    });

    test('should reject mobile without +92 prefix', () => {
      const invalidMobile = '03001234567';
      expect(validateMobile(invalidMobile)).toBe(false);
    });

    test('should reject mobile with wrong country code', () => {
      const invalidMobile = '+913001234567';
      expect(validateMobile(invalidMobile)).toBe(false);
    });

    test('should reject mobile with wrong length', () => {
      const invalidMobile = '+92300123456';
      expect(validateMobile(invalidMobile)).toBe(false);
    });

    test('should reject mobile with letters', () => {
      const invalidMobile = '+92300123456a';
      expect(validateMobile(invalidMobile)).toBe(false);
    });

    test('should reject empty string', () => {
      expect(validateMobile('')).toBe(false);
    });
  });

  describe('formatDate', () => {
    test('should format date string correctly', () => {
      const dateString = '2024-01-15T10:30:00Z';
      const result = formatDate(dateString);
      
      // The exact format may vary by locale, but should contain the date components
      expect(result).toContain('2024');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    test('should handle ISO date string', () => {
      const dateString = '2024-12-25T15:45:30.123Z';
      const result = formatDate(dateString);
      
      expect(result).toContain('2024');
      expect(result).toContain('Dec');
      expect(result).toContain('25');
    });

    test('should handle timestamp', () => {
      const dateString = '1705312200000'; // timestamp
      const result = formatDate(dateString);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

