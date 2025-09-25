import { NextRequest } from 'next/server';
import { POST, GET } from '../accounts/route';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/rafiki');
jest.mock('@/lib/init');

import { getDatabase } from '@/lib/database';
import { generateIBAN } from '@/lib/rafiki';
import { ensureDatabaseInitialized } from '@/lib/init';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockGenerateIBAN = generateIBAN as jest.MockedFunction<typeof generateIBAN>;
const mockEnsureDatabaseInitialized = ensureDatabaseInitialized as jest.MockedFunction<typeof ensureDatabaseInitialized>;

describe('/api/accounts', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn()
    };
    
    mockGetDatabase.mockReturnValue(mockDb);
    mockEnsureDatabaseInitialized.mockResolvedValue(undefined);
    mockGenerateIBAN.mockReturnValue('PK12ABBL1234567890123456');
  });

  describe('POST /api/accounts', () => {
    test('should create new account successfully', async () => {
      const mockAccount = {
        id: 1,
        name: 'John Doe',
        email: 'john.doe@example.com',
        iban: 'PK12ABBL1234567890123456',
        currency: 'PKR',
        balance: '0.00',
        available_balance: '0.00',
        book_balance: '0.00'
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockAccount]
      });

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john.doe@example.com'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockAccount);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO accounts'),
        ['John Doe', 'john.doe@example.com', 'PK12ABBL1234567890123456', 'PKR', '0.00', '0.00', '0.00']
      );
    });

    test('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          email: 'john.doe@example.com'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Name and email are required');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('should return 400 when email is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Name and email are required');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('should handle duplicate email error', async () => {
      const duplicateError = new Error('Duplicate key') as any;
      duplicateError.code = '23505';
      
      mockDb.query.mockRejectedValueOnce(duplicateError);

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'existing@example.com'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Email already exists');
    });

    test('should handle database connection error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john.doe@example.com'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Failed to create account');
    });

    test('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Failed to create account');
    });

    test('should ensure database is initialized before creating account', async () => {
      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john.doe@example.com'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      mockDb.query.mockResolvedValueOnce({ rows: [{}] });

      await POST(request);

      expect(mockEnsureDatabaseInitialized).toHaveBeenCalledBefore(mockDb.query as jest.Mock);
    });

    test('should generate unique IBAN for each account', async () => {
      mockGenerateIBAN
        .mockReturnValueOnce('PK12ABBL1111111111111111')
        .mockReturnValueOnce('PK12ABBL2222222222222222');

      mockDb.query.mockResolvedValue({ rows: [{}] });

      const request1 = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const request2 = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane@example.com'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      await POST(request1);
      await POST(request2);

      expect(mockGenerateIBAN).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('INSERT INTO accounts'),
        expect.arrayContaining(['PK12ABBL1111111111111111'])
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO accounts'),
        expect.arrayContaining(['PK12ABBL2222222222222222'])
      );
    });
  });

  describe('GET /api/accounts', () => {
    test('should return all accounts successfully', async () => {
      const mockAccounts = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          iban: 'PK12ABBL1111111111111111',
          currency: 'PKR',
          balance: '1000.00',
          available_balance: '950.00',
          book_balance: '1000.00',
          status: 'active',
          wallet_address: null,
          wallet_id: null,
          asset_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          iban: 'PK12ABBL2222222222222222',
          currency: 'PKR',
          balance: '2000.00',
          available_balance: '2000.00',
          book_balance: '2000.00',
          status: 'active',
          wallet_address: null,
          wallet_id: null,
          asset_id: null,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockAccounts
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockAccounts);
      expect(responseData.data).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        undefined
      );
    });

    test('should return empty array when no accounts exist', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual([]);
      expect(responseData.data).toHaveLength(0);
    });

    test('should handle database query error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database query failed'));

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Failed to fetch accounts');
    });

    test('should ensure database is initialized before fetching accounts', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await GET();

      expect(mockEnsureDatabaseInitialized).toHaveBeenCalledBefore(mockDb.query as jest.Mock);
    });

    test('should order accounts by created_at DESC', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await GET();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC')
      );
    });

    test('should select all required account fields', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await GET();

      const query = mockDb.query.mock.calls[0][0];
      
      // Check that all important fields are selected
      expect(query).toContain('id');
      expect(query).toContain('name');
      expect(query).toContain('email');
      expect(query).toContain('iban');
      expect(query).toContain('currency');
      expect(query).toContain('balance');
      expect(query).toContain('available_balance');
      expect(query).toContain('book_balance');
      expect(query).toContain('status');
      expect(query).toContain('wallet_address');
      expect(query).toContain('wallet_id');
      expect(query).toContain('asset_id');
      expect(query).toContain('created_at');
      expect(query).toContain('updated_at');
    });
  });

  describe('Database Initialization', () => {
    test('should handle database initialization failure in POST', async () => {
      mockEnsureDatabaseInitialized.mockRejectedValueOnce(new Error('DB init failed'));

      const request = new NextRequest('http://localhost:3000/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('should handle database initialization failure in GET', async () => {
      mockEnsureDatabaseInitialized.mockRejectedValueOnce(new Error('DB init failed'));

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});

