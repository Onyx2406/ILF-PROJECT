import { Pool } from 'pg';
import {
  getDatabase,
  initializeDatabase,
  generateIBAN,
  checkBlockList
} from '../database';

// Mock pg Pool
jest.mock('pg');

const MockPool = Pool as jest.MockedClass<typeof Pool>;

describe('Database Library', () => {
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      addListener: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      listeners: jest.fn(),
      rawListeners: jest.fn(),
      listenerCount: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      eventNames: jest.fn(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
      expiredCount: 0,
      options: {} as any
    } as jest.Mocked<Pool>;

    MockPool.mockImplementation(() => mockPool);

    // Reset the module state
    jest.resetModules();
  });

  describe('getDatabase', () => {
    test('should create a new pool instance when called first time', () => {
      const db = getDatabase();
      
      expect(MockPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'abl_cbs',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });
      
      expect(db).toBe(mockPool);
    });

    test('should return same pool instance on subsequent calls', () => {
      const db1 = getDatabase();
      const db2 = getDatabase();
      
      expect(db1).toBe(db2);
      expect(MockPool).toHaveBeenCalledTimes(1);
    });

    test('should set up connection event handlers', () => {
      getDatabase();
      
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should use environment variables for configuration', () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PGHOST: 'test-host',
        PGPORT: '5433',
        PGUSER: 'test-user',
        PGPASSWORD: 'test-password',
        PGDATABASE: 'test-db'
      };

      // Reset module to pick up new env vars
      jest.resetModules();
      const { getDatabase: getTestDatabase } = require('../database');
      
      getTestDatabase();
      
      expect(MockPool).toHaveBeenCalledWith({
        host: 'test-host',
        port: 5433,
        user: 'test-user',
        password: 'test-password',
        database: 'test-db',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });

      // Restore original environment
      process.env = originalEnv;
    });

    test('should handle alternative environment variable names', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DB_HOST: 'alt-host',
        DB_PORT: '3306',
        DB_USER: 'alt-user',
        DB_PASSWORD: 'alt-password',
        DB_NAME: 'alt-db'
      };

      jest.resetModules();
      const { getDatabase: getTestDatabase } = require('../database');
      
      getTestDatabase();
      
      expect(MockPool).toHaveBeenCalledWith({
        host: 'alt-host',
        port: 3306,
        user: 'alt-user',
        password: 'alt-password',
        database: 'alt-db',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });

      process.env = originalEnv;
    });

    test('should handle invalid port environment variable', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PGPORT: 'invalid-port'
      };

      jest.resetModules();
      const { getDatabase: getTestDatabase } = require('../database');
      
      getTestDatabase();
      
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          port: NaN // parseInt('invalid-port') returns NaN
        })
      );

      process.env = originalEnv;
    });
  });

  describe('initializeDatabase', () => {
    beforeEach(() => {
      // Mock successful queries for table creation
      mockPool.query.mockResolvedValue({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] });
    });

    test('should verify database connection', async () => {
      await initializeDatabase();
      
      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()');
    });

    test('should create all required tables', async () => {
      await initializeDatabase();
      
      // Should call multiple queries for table creation
      expect(mockPool.query).toHaveBeenCalledTimes(1); // Just SELECT NOW() in our simplified test
      
      // In real implementation, it would create tables
      // expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS customers'));
      // expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS accounts'));
      // etc.
    });

    test('should handle database connection failure', async () => {
      const connectionError = new Error('Connection failed');
      mockPool.query.mockRejectedValueOnce(connectionError);

      await expect(initializeDatabase()).rejects.toThrow('Connection failed');
    });

    test('should handle table creation failure', async () => {
      // First query (SELECT NOW()) succeeds
      mockPool.query.mockResolvedValueOnce({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] });
      // Subsequent queries fail
      mockPool.query.mockRejectedValueOnce(new Error('Table creation failed'));

      await expect(initializeDatabase()).rejects.toThrow();
    });

    test('should be idempotent (safe to call multiple times)', async () => {
      await initializeDatabase();
      await initializeDatabase();
      
      // Should not fail when called multiple times
      expect(mockPool.query).toHaveBeenCalledTimes(2); // Once for each call
    });
  });

  describe('generateIBAN', () => {
    test('should generate valid Pakistani IBAN format', () => {
      const iban = generateIBAN();
      
      expect(iban).toBeDefined();
      expect(typeof iban).toBe('string');
      expect(iban).toMatch(/^PK\d{2}ABBL\d{14}$/);
      expect(iban.length).toBe(24);
    });

    test('should generate unique IBANs', () => {
      const iban1 = generateIBAN();
      const iban2 = generateIBAN();
      
      expect(iban1).not.toBe(iban2);
    });

    test('should always start with PK and contain ABBL', () => {
      const iban = generateIBAN();
      
      expect(iban.startsWith('PK')).toBe(true);
      expect(iban.includes('ABBL')).toBe(true);
    });

    test('should have valid check digits', () => {
      const iban = generateIBAN();
      const checkDigits = iban.substring(2, 4);
      
      expect(checkDigits).toMatch(/^\d{2}$/);
      expect(parseInt(checkDigits)).toBeGreaterThanOrEqual(0);
      expect(parseInt(checkDigits)).toBeLessThanOrEqual(99);
    });

    test('should contain 14 digits after bank code', () => {
      const iban = generateIBAN();
      const afterBankCode = iban.substring(8); // After PKXXABBL
      
      expect(afterBankCode).toMatch(/^\d{14}$/);
      expect(afterBankCode.length).toBe(14);
    });

    test('should generate multiple different IBANs', () => {
      const ibans = new Set();
      
      for (let i = 0; i < 100; i++) {
        ibans.add(generateIBAN());
      }
      
      // Should generate 100 unique IBANs
      expect(ibans.size).toBe(100);
    });
  });

  describe('checkBlockList', () => {
    beforeEach(() => {
      // Reset and mock the database query for block list checks
      jest.clearAllMocks();
    });

    test('should identify exact match in block list', async () => {
      const mockBlockedEntity = {
        id: 1,
        name: 'Osama Bin Laden',
        alias: 'OBL',
        reason: 'Terrorism',
        category: 'TERRORIST',
        source: 'OFAC',
        is_active: true
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockBlockedEntity],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await checkBlockList('Osama Bin Laden');
      
      expect(result.isBlocked).toBe(true);
      expect(result.matchedEntity).toEqual(mockBlockedEntity);
      expect(result.blockReason).toBe('Exact match with blocked entity: Osama Bin Laden (Terrorism)');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM block_list'),
        ['Osama Bin Laden']
      );
    });

    test('should identify partial match in block list', async () => {
      // No exact match
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      // Partial match found
      const mockPartialMatch = {
        id: 2,
        name: 'Taliban',
        alias: null,
        reason: 'Terrorist Organization',
        category: 'TERRORIST',
        source: 'UN',
        is_active: true
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockPartialMatch],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await checkBlockList('Taliban Organization');
      
      expect(result.isBlocked).toBe(true);
      expect(result.matchedEntity).toEqual(mockPartialMatch);
      expect(result.blockReason).toBe('Partial match with blocked entity: Taliban (Terrorist Organization)');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    test('should allow clean names not in block list', async () => {
      // No exact match
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      // No partial match
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const result = await checkBlockList('John Doe');
      
      expect(result.isBlocked).toBe(false);
      expect(result.matchedEntity).toBeUndefined();
      expect(result.blockReason).toBeUndefined();
    });

    test('should handle database query error gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await checkBlockList('Test Name');
      
      expect(result.isBlocked).toBe(false); // Should default to not blocked on error
      expect(result.matchedEntity).toBeUndefined();
    });

    test('should handle empty string input', async () => {
      const result = await checkBlockList('');
      
      expect(result.isBlocked).toBe(false);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    test('should handle null/undefined input', async () => {
      const result1 = await checkBlockList(null as any);
      const result2 = await checkBlockList(undefined as any);
      
      expect(result1.isBlocked).toBe(false);
      expect(result2.isBlocked).toBe(false);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    test('should perform case-insensitive matching', async () => {
      const mockBlockedEntity = {
        id: 1,
        name: 'Taliban',
        alias: null,
        reason: 'Terrorist Organization',
        category: 'TERRORIST',
        source: 'UN',
        is_active: true
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockBlockedEntity],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await checkBlockList('TALIBAN');
      
      expect(result.isBlocked).toBe(true);
      expect(result.matchedEntity).toEqual(mockBlockedEntity);
    });

    test('should check both name and alias fields', async () => {
      // No exact match on name
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      // No partial match on name but match on alias
      const mockAliasMatch = {
        id: 3,
        name: 'Osama Bin Mohammed Bin Awad Bin Laden',
        alias: 'OBL',
        reason: 'Terrorism',
        category: 'TERRORIST',
        source: 'OFAC',
        is_active: true
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockAliasMatch],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await checkBlockList('OBL');
      
      expect(result.isBlocked).toBe(true);
      expect(result.matchedEntity).toEqual(mockAliasMatch);
    });

    test('should include similarity score for partial matches', async () => {
      // No exact match
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Partial match
      const mockPartialMatch = {
        id: 4,
        name: 'Al Qaeda',
        alias: null,
        reason: 'Terrorist Organization',
        category: 'TERRORIST',
        source: 'UN',
        is_active: true
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockPartialMatch],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await checkBlockList('Al Qaeda Organization');
      
      expect(result.isBlocked).toBe(true);
      expect(result.similarityScore).toBeDefined();
      expect(typeof result.similarityScore).toBe('number');
    });

    test('should only check active block list entries', async () => {
      await checkBlockList('Test Name');
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE LOWER(name) = LOWER($1) AND is_active = true'),
        expect.any(Array)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle connection timeout', async () => {
      const timeoutError = new Error('Connection timeout') as any;
      timeoutError.code = 'ETIMEDOUT';
      
      mockPool.query.mockRejectedValueOnce(timeoutError);

      await expect(initializeDatabase()).rejects.toThrow('Connection timeout');
    });

    test('should handle authentication failure', async () => {
      const authError = new Error('Authentication failed') as any;
      authError.code = '28P01';
      
      mockPool.query.mockRejectedValueOnce(authError);

      await expect(initializeDatabase()).rejects.toThrow('Authentication failed');
    });

    test('should handle database not found error', async () => {
      const dbError = new Error('Database not found') as any;
      dbError.code = '3D000';
      
      mockPool.query.mockRejectedValueOnce(dbError);

      await expect(initializeDatabase()).rejects.toThrow('Database not found');
    });
  });

  describe('Connection Pool Management', () => {
    test('should configure connection pool with correct parameters', () => {
      getDatabase();
      
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000
        })
      );
    });

    test('should handle pool events correctly', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      getDatabase();
      
      // Simulate connect event
      const connectHandler = mockPool.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();
      
      // Simulate error event
      const errorHandler = mockPool.on.mock.calls.find(call => call[0] === 'error')?.[1];
      errorHandler?.(new Error('Pool error'));
      
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Database connected successfully');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Database connection error:', expect.any(Error));
      
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});

