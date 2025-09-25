import { NextRequest } from 'next/server';
import { GET, POST } from '../customers/route';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/init');

import { getDatabase } from '@/lib/database';
import { ensureDatabaseInitialized } from '@/lib/init';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockEnsureDatabaseInitialized = ensureDatabaseInitialized as jest.MockedFunction<typeof ensureDatabaseInitialized>;

describe('/api/customers', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn()
    };
    
    mockGetDatabase.mockReturnValue(mockDb);
    mockEnsureDatabaseInitialized.mockResolvedValue(undefined);
  });

  describe('POST /api/customers', () => {
    test('should create new customer successfully', async () => {
      const mockCustomer = {
        c_id: 1,
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone_number: '+923001234567',
        address: '123 Main St, Karachi',
        cnic: '4210112345671',
        dob: '1990-01-15',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockCustomer]
      });

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone_number: '+923001234567',
          address: '123 Main St, Karachi',
          cnic: '4210112345671',
          dob: '1990-01-15'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockCustomer);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO customers'),
        ['John Doe', 'john.doe@example.com', '+923001234567', '123 Main St, Karachi', '4210112345671', '1990-01-15']
      );
    });

    test('should create customer with minimal required fields', async () => {
      const mockCustomer = {
        c_id: 1,
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone_number: null,
        address: null,
        cnic: null,
        dob: null,
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockCustomer]
      });

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane.doe@example.com'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockCustomer);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO customers'),
        ['Jane Doe', 'jane.doe@example.com', undefined, undefined, undefined, undefined]
      );
    });

    test('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com'
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
      const request = new NextRequest('http://localhost:3000/api/customers', {
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
      const duplicateError = new Error('Duplicate email') as any;
      duplicateError.code = '23505';
      duplicateError.constraint = 'customers_email_key';
      
      mockDb.query.mockRejectedValueOnce(duplicateError);

      const request = new NextRequest('http://localhost:3000/api/customers', {
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
      expect(responseData.error.message).toBe('EMAIL already exists');
    });

    test('should handle duplicate CNIC error', async () => {
      const duplicateError = new Error('Duplicate CNIC') as any;
      duplicateError.code = '23505';
      duplicateError.constraint = 'customers_cnic_key';
      
      mockDb.query.mockRejectedValueOnce(duplicateError);

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          cnic: '4210112345671'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('CNIC already exists');
    });

    test('should handle general database error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Failed to create customer');
    });

    test('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/customers', {
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
      expect(responseData.error.message).toBe('Failed to create customer');
    });
  });

  describe('GET /api/customers', () => {
    test('should return paginated customers successfully', async () => {
      const mockCustomers = [
        {
          c_id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          phone_number: '+923001234567',
          address: '123 Main St',
          cnic: '4210112345671',
          dob: '1990-01-15',
          status: 'active',
          account_count: '2',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          c_id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone_number: '+923009876543',
          address: '456 Oak Ave',
          cnic: '4210187654321',
          dob: '1985-06-20',
          status: 'active',
          account_count: '1',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ];

      // Mock the main query
      mockDb.query.mockResolvedValueOnce({
        rows: mockCustomers
      });

      // Mock the count query
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '25' }]
      });

      const request = new NextRequest('http://localhost:3000/api/customers?page=1&limit=10');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockCustomers);
      expect(responseData.count).toBe(2);
      expect(responseData.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        pages: 3
      });
    });

    test('should handle search query parameter', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const request = new NextRequest('http://localhost:3000/api/customers?search=john');

      await GET(request);

      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('WHERE (c.name ILIKE $1 OR c.email ILIKE $1 OR c.cnic ILIKE $1)'),
        expect.arrayContaining(['%john%', 10, 0])
      );
    });

    test('should handle custom page and limit parameters', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const request = new NextRequest('http://localhost:3000/api/customers?page=3&limit=5');

      await GET(request);

      // Should calculate offset as (3-1)*5 = 10
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [5, 10]
      );
    });

    test('should use default pagination when parameters are missing', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const request = new NextRequest('http://localhost:3000/api/customers');

      await GET(request);

      // Should use default page=1, limit=10, offset=0
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 0]
      );
    });

    test('should handle invalid pagination parameters gracefully', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const request = new NextRequest('http://localhost:3000/api/customers?page=invalid&limit=notanumber');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.pagination.page).toBe(1); // Should default to 1
      expect(responseData.pagination.limit).toBe(10); // Should default to 10
    });

    test('should return empty results when no customers found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const request = new NextRequest('http://localhost:3000/api/customers');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual([]);
      expect(responseData.count).toBe(0);
      expect(responseData.pagination.total).toBe(0);
      expect(responseData.pagination.pages).toBe(0);
    });

    test('should handle database query error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database query failed'));

      const request = new NextRequest('http://localhost:3000/api/customers');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toBe('Failed to fetch customers');
    });

    test('should include account count in customer data', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const request = new NextRequest('http://localhost:3000/api/customers');

      await GET(request);

      const query = mockDb.query.mock.calls[0][0];
      expect(query).toContain('COUNT(ca.account_id) as account_count');
      expect(query).toContain('LEFT JOIN customer_accounts ca ON c.c_id = ca.customer_id');
      expect(query).toContain('GROUP BY c.c_id');
    });

    test('should order customers by created_at DESC', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const request = new NextRequest('http://localhost:3000/api/customers');

      await GET(request);

      const query = mockDb.query.mock.calls[0][0];
      expect(query).toContain('ORDER BY c.created_at DESC');
    });

    test('should handle search with pagination correctly', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const request = new NextRequest('http://localhost:3000/api/customers?search=john&page=2&limit=3');

      const response = await GET(request);
      const responseData = await response.json();

      // First query should include search and pagination
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('WHERE (c.name ILIKE $1 OR c.email ILIKE $1 OR c.cnic ILIKE $1)'),
        ['%john%', 3, 3] // limit=3, offset=(2-1)*3=3
      );

      // Count query should also include search
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('WHERE (name ILIKE $1 OR email ILIKE $1 OR cnic ILIKE $1)'),
        ['%john%']
      );

      expect(responseData.pagination).toEqual({
        page: 2,
        limit: 3,
        total: 5,
        pages: 2 // Math.ceil(5/3) = 2
      });
    });
  });

  describe('Database Initialization', () => {
    test('should ensure database is initialized before operations', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' }
      });

      await POST(request);

      expect(mockEnsureDatabaseInitialized).toHaveBeenCalledBefore(mockDb.query as jest.Mock);
    });

    test('should handle database initialization failure', async () => {
      mockEnsureDatabaseInitialized.mockRejectedValueOnce(new Error('DB init failed'));

      const request = new NextRequest('http://localhost:3000/api/customers');

      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});

