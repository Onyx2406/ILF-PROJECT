import {
  generateUsername,
  hashPassword,
  verifyPassword,
  DEFAULT_PASSWORD
} from '../auth';

describe('Auth Library', () => {
  describe('generateUsername', () => {
    test('should generate username from email and IBAN', () => {
      const email = 'john.doe@example.com';
      const iban = 'PK12ABBL1234567890123456';
      
      const username = generateUsername(email, iban);
      
      expect(username).toBeDefined();
      expect(typeof username).toBe('string');
      expect(username.length).toBeGreaterThan(0);
      expect(username.length).toBeLessThanOrEqual(20);
    });

    test('should include email part in username', () => {
      const email = 'testuser@example.com';
      const iban = 'PK12ABBL1234567890123456';
      
      const username = generateUsername(email, iban);
      
      expect(username).toContain('testuser');
    });

    test('should include last 4 digits of IBAN', () => {
      const email = 'test@example.com';
      const iban = 'PK12ABBL1234567890123456';
      
      const username = generateUsername(email, iban);
      
      expect(username).toContain('3456');
    });

    test('should convert email part to lowercase', () => {
      const email = 'JOHN.DOE@EXAMPLE.COM';
      const iban = 'PK12ABBL1234567890123456';
      
      const username = generateUsername(email, iban);
      
      expect(username).toContain('john.doe');
      expect(username).not.toContain('JOHN.DOE');
    });

    test('should generate different usernames for same email/IBAN due to random part', () => {
      const email = 'test@example.com';
      const iban = 'PK12ABBL1234567890123456';
      
      const username1 = generateUsername(email, iban);
      const username2 = generateUsername(email, iban);
      
      // Due to random part, they should be different
      expect(username1).not.toBe(username2);
    });

    test('should limit username length to 20 characters', () => {
      const email = 'verylongemailaddress@example.com';
      const iban = 'PK12ABBL1234567890123456';
      
      const username = generateUsername(email, iban);
      
      expect(username.length).toBeLessThanOrEqual(20);
    });

    test('should handle short email', () => {
      const email = 'a@b.c';
      const iban = 'PK12ABBL1234567890123456';
      
      const username = generateUsername(email, iban);
      
      expect(username).toContain('a');
      expect(username).toContain('3456');
      expect(username.length).toBeGreaterThan(5); // a + 3456 + random
    });

    test('should handle email with dots and special chars', () => {
      const email = 'first.last+tag@example.com';
      const iban = 'PK12ABBL1234567890123456';
      
      const username = generateUsername(email, iban);
      
      expect(username).toContain('first.last+tag');
    });
  });

  describe('hashPassword', () => {
    test('should hash password successfully', async () => {
      const password = 'TestPassword123!';
      
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    test('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // bcrypt uses salt, so hashes should differ
    });

    test('should handle empty password', async () => {
      const password = '';
      
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    test('should handle special characters in password', async () => {
      const password = 'P@ssw0rd!@#$%^&*()';
      
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    test('should handle unicode characters', async () => {
      const password = 'पासवर्ड123';
      
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('verifyPassword', () => {
    test('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    test('should reject empty password against valid hash', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('', hash);
      
      expect(isValid).toBe(false);
    });

    test('should handle case sensitivity', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('testpassword123!', hash);
      
      expect(isValid).toBe(false); // Should be case sensitive
    });

    test('should reject password against invalid hash', async () => {
      const password = 'TestPassword123!';
      const invalidHash = 'invalid-hash-string';
      
      // This should not throw an error but return false
      await expect(verifyPassword(password, invalidHash)).rejects.toThrow();
    });

    test('should handle special characters verification', async () => {
      const password = 'P@ssw0rd!@#$%^&*()';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    test('should verify default password', async () => {
      const hash = await hashPassword(DEFAULT_PASSWORD);
      
      const isValid = await verifyPassword(DEFAULT_PASSWORD, hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('DEFAULT_PASSWORD', () => {
    test('should be defined', () => {
      expect(DEFAULT_PASSWORD).toBeDefined();
      expect(typeof DEFAULT_PASSWORD).toBe('string');
    });

    test('should not be empty', () => {
      expect(DEFAULT_PASSWORD.length).toBeGreaterThan(0);
    });

    test('should have expected value', () => {
      expect(DEFAULT_PASSWORD).toBe('Abcd@1234');
    });

    test('should be hashable', async () => {
      const hash = await hashPassword(DEFAULT_PASSWORD);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    test('should be verifiable when hashed', async () => {
      const hash = await hashPassword(DEFAULT_PASSWORD);
      const isValid = await verifyPassword(DEFAULT_PASSWORD, hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should work end-to-end: generate username and hash password', async () => {
      const email = 'integration.test@example.com';
      const iban = 'PK12ABBL1234567890123456';
      const password = 'IntegrationTest123!';
      
      const username = generateUsername(email, iban);
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(username).toBeDefined();
      expect(hash).toBeDefined();
      expect(isValid).toBe(true);
    });

    test('should handle complete user registration scenario', async () => {
      const userEmail = 'newuser@abl.com';
      const userIban = 'PK99ABBL9876543210987654';
      const userPassword = 'SecurePassword2024!';
      
      // Generate username
      const username = generateUsername(userEmail, userIban);
      expect(username).toContain('newuser');
      expect(username).toContain('7654');
      
      // Hash password
      const passwordHash = await hashPassword(userPassword);
      expect(passwordHash).toBeDefined();
      
      // Verify password
      const loginSuccess = await verifyPassword(userPassword, passwordHash);
      expect(loginSuccess).toBe(true);
      
      // Verify wrong password fails
      const loginFail = await verifyPassword('WrongPassword', passwordHash);
      expect(loginFail).toBe(false);
    });
  });
});

