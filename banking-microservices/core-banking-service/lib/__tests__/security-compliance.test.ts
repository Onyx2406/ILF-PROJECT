import { Pool } from 'pg';
import { AIMLBlockService, BlockListEntry, BlockedPayment } from '../aiml-block-service';

// Mock pg Pool
jest.mock('pg');

describe('Security and Compliance Tests', () => {
  let mockPool: jest.Mocked<Pool>;
  let blockService: AIMLBlockService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    } as any;
    
    blockService = new AIMLBlockService(mockPool);
  });

  describe('AIMLBlockService - Block List Checking', () => {
    describe('checkPaymentAgainstBlockList', () => {
      test('should block payment for exact name match', async () => {
        const mockBlockEntry: BlockListEntry = {
          id: 1,
          name: 'Osama Bin Laden',
          type: 'person',
          reason: 'Terrorism',
          severity: 10,
          added_by: 'OFAC',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [mockBlockEntry],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('Osama Bin Laden', {});

        expect(result.isBlocked).toBe(true);
        expect(result.matchedEntry).toEqual(mockBlockEntry);
        expect(result.reason).toContain('Exact match with blocked entity: Osama Bin Laden');
      });

      test('should block payment for fuzzy name match', async () => {
        const mockBlockEntry: BlockListEntry = {
          id: 2,
          name: 'Taliban',
          type: 'organization',
          reason: 'Terrorist Organization',
          severity: 9,
          added_by: 'UN',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [mockBlockEntry],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('Taliban Organization of Afghanistan', {});

        expect(result.isBlocked).toBe(true);
        expect(result.matchedEntry).toEqual(mockBlockEntry);
        expect(result.reason).toContain('Fuzzy match with blocked entity: Taliban');
      });

      test('should block payment for partial word match', async () => {
        const mockBlockEntry: BlockListEntry = {
          id: 3,
          name: 'Al Qaeda',
          type: 'organization',
          reason: 'Terrorist Organization',
          severity: 10,
          added_by: 'OFAC',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [mockBlockEntry],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('Al Qaeda Network', {});

        expect(result.isBlocked).toBe(true);
        expect(result.matchedEntry).toEqual(mockBlockEntry);
        expect(result.reason).toContain('Partial name match with blocked entity: Al Qaeda');
      });

      test('should allow payment for clean names', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('John Doe', {});

        expect(result.isBlocked).toBe(false);
        expect(result.matchedEntry).toBeUndefined();
        expect(result.reason).toBeUndefined();
      });

      test('should handle case-insensitive matching', async () => {
        const mockBlockEntry: BlockListEntry = {
          id: 4,
          name: 'Usama Bin Laden',
          type: 'person',
          reason: 'Terrorism',
          severity: 10,
          added_by: 'OFAC',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [mockBlockEntry],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('USAMA BIN LADEN', {});

        expect(result.isBlocked).toBe(true);
        expect(result.matchedEntry).toEqual(mockBlockEntry);
      });

      test('should handle special characters in names', async () => {
        const mockBlockEntry: BlockListEntry = {
          id: 5,
          name: 'Muammar Qaddafi',
          type: 'person',
          reason: 'Sanctions',
          severity: 8,
          added_by: 'UN',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [mockBlockEntry],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('Muammar Al-Qaddafi', {});

        expect(result.isBlocked).toBe(true);
        expect(result.matchedEntry).toEqual(mockBlockEntry);
      });

      test('should prioritize higher severity matches', async () => {
        const mockBlockEntries: BlockListEntry[] = [
          {
            id: 6,
            name: 'John Smith',
            type: 'person',
            reason: 'Low Risk',
            severity: 3,
            added_by: 'ADMIN',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 7,
            name: 'John Smith',
            type: 'person',
            reason: 'High Risk Terrorism',
            severity: 10,
            added_by: 'OFAC',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        mockPool.query.mockResolvedValueOnce({
          rows: mockBlockEntries,
          command: 'SELECT',
          rowCount: 2,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('John Smith', {});

        expect(result.isBlocked).toBe(true);
        expect(result.matchedEntry?.severity).toBe(10); // Should match highest severity first
      });

      test('should handle database errors gracefully', async () => {
        mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

        const result = await blockService.checkPaymentAgainstBlockList('Test Name', {});

        expect(result.isBlocked).toBe(false); // Should default to allow on error
        expect(result.matchedEntry).toBeUndefined();
      });

      test('should only check active block list entries', async () => {
        await blockService.checkPaymentAgainstBlockList('Test Name', {});

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE is_active = true'),
          undefined
        );
      });
    });

    describe('recordBlockedPayment', () => {
      test('should record blocked payment successfully', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 123 }],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.recordBlockedPayment(
          'payment-123',
          'Blocked Name',
          1000.00,
          'USD',
          'Matched sanctioned entity',
          1,
          { description: 'Test payment' },
          { id: 'webhook-456' },
          100
        );

        expect(result).toBe(123);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO blocked_payments'),
          ['webhook-456', 100, 1, 1000.00, 'USD', 'Matched sanctioned entity']
        );
      });

      test('should handle missing optional parameters', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 124 }],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.recordBlockedPayment(
          'payment-124',
          'Blocked Name',
          500.00,
          'EUR',
          'High risk transaction'
        );

        expect(result).toBe(124);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO blocked_payments'),
          ['payment-124', null, undefined, 500.00, 'EUR', 'High risk transaction']
        );
      });

      test('should handle database insertion errors', async () => {
        mockPool.query.mockRejectedValueOnce(new Error('Database insert failed'));

        await expect(blockService.recordBlockedPayment(
          'payment-125',
          'Test Name',
          100.00,
          'USD',
          'Test block'
        )).rejects.toThrow('Database insert failed');
      });
    });

    describe('Block List Management', () => {
      test('should get active block list entries', async () => {
        const mockEntries: BlockListEntry[] = [
          {
            id: 1,
            name: 'Test Entity 1',
            type: 'person',
            reason: 'Sanctions',
            severity: 8,
            added_by: 'ADMIN',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 2,
            name: 'Test Entity 2',
            type: 'organization',
            reason: 'Terrorism',
            severity: 10,
            added_by: 'OFAC',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        mockPool.query.mockResolvedValueOnce({
          rows: mockEntries,
          command: 'SELECT',
          rowCount: 2,
          oid: 0,
          fields: []
        });

        const result = await blockService.getBlockList();

        expect(result).toEqual(mockEntries);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE is_active = true'),
          undefined
        );
      });

      test('should add new entry to block list', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 10 }],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.addToBlockList(
          'New Blocked Entity',
          'organization',
          'Money Laundering',
          9,
          'AML_TEAM',
          'High risk organization identified through investigation'
        );

        expect(result).toBe(10);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO block_list'),
          ['New Blocked Entity', 'organization', 'Money Laundering', 9, 'AML_TEAM', 'High risk organization identified through investigation']
        );
      });

      test('should deactivate block list entry', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.deactivateBlockEntry(5);

        expect(result).toBe(true);
        expect(mockPool.query).toHaveBeenCalledWith(
          'UPDATE block_list SET is_active = false WHERE id = $1',
          [5]
        );
      });
    });

    describe('Statistics and Reporting', () => {
      test('should get blocked payments statistics', async () => {
        // Mock responses for all stat queries
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ count: '150' }] }) // total
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // today
          .mockResolvedValueOnce({ rows: [{ count: '12' }] })  // this week
          .mockResolvedValueOnce({ rows: [{ count: '35' }] })  // this month
          .mockResolvedValueOnce({ rows: [               // by severity
            { severity: 8, count: '10' },
            { severity: 9, count: '8' },
            { severity: 10, count: '15' }
          ] });

        const result = await blockService.getBlockedPaymentsStats();

        expect(result).toEqual({
          total: 150,
          today: 5,
          thisWeek: 12,
          thisMonth: 35,
          bySeverity: {
            '8': 10,
            '9': 8,
            '10': 15
          }
        });

        expect(mockPool.query).toHaveBeenCalledTimes(5);
      });

      test('should handle statistics query errors', async () => {
        mockPool.query.mockRejectedValue(new Error('Stats query failed'));

        const result = await blockService.getBlockedPaymentsStats();

        expect(result).toEqual({
          total: 0,
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          bySeverity: {}
        });
      });
    });

    describe('Name Normalization', () => {
      test('should normalize names correctly', async () => {
        // We test normalization indirectly through the matching
        const mockBlockEntry: BlockListEntry = {
          id: 1,
          name: 'Test-Name',
          type: 'person',
          reason: 'Test',
          severity: 5,
          added_by: 'ADMIN',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [mockBlockEntry],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        // Should match despite different formatting
        const result = await blockService.checkPaymentAgainstBlockList('Test Name!@#', {});

        expect(result.isBlocked).toBe(true);
        expect(result.matchedEntry).toEqual(mockBlockEntry);
      });

      test('should handle multiple spaces and special characters', async () => {
        const mockBlockEntry: BlockListEntry = {
          id: 1,
          name: 'John   Smith',
          type: 'person',
          reason: 'Test',
          severity: 5,
          added_by: 'ADMIN',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [mockBlockEntry],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        });

        const result = await blockService.checkPaymentAgainstBlockList('John     Smith!!!', {});

        expect(result.isBlocked).toBe(true);
      });
    });
  });

  describe('Input Validation and Security', () => {
    test('should handle SQL injection attempts in payment checks', async () => {
      const maliciousInput = "'; DROP TABLE block_list; --";

      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const result = await blockService.checkPaymentAgainstBlockList(maliciousInput, {});

      expect(result.isBlocked).toBe(false);
      // Should not cause any errors due to proper parameterized queries
      expect(mockPool.query).toHaveBeenCalled();
    });

    test('should handle very long input strings', async () => {
      const longInput = 'A'.repeat(10000);

      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const result = await blockService.checkPaymentAgainstBlockList(longInput, {});

      expect(result.isBlocked).toBe(false);
      expect(mockPool.query).toHaveBeenCalled();
    });

    test('should handle unicode and international characters', async () => {
      const unicodeInput = 'محمد عبدالله الأحمد';

      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const result = await blockService.checkPaymentAgainstBlockList(unicodeInput, {});

      expect(result.isBlocked).toBe(false);
      expect(mockPool.query).toHaveBeenCalled();
    });

    test('should handle null and undefined inputs gracefully', async () => {
      const result1 = await blockService.checkPaymentAgainstBlockList(null as any, {});
      const result2 = await blockService.checkPaymentAgainstBlockList(undefined as any, {});

      expect(result1.isBlocked).toBe(false);
      expect(result2.isBlocked).toBe(false);
    });

    test('should handle empty string input', async () => {
      const result = await blockService.checkPaymentAgainstBlockList('', {});

      expect(result.isBlocked).toBe(false);
      // Should not make database calls for empty input
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large block lists efficiently', async () => {
      // Generate a large block list
      const largeBlockList: BlockListEntry[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Entity ${i + 1}`,
        type: 'person',
        reason: 'Test',
        severity: Math.floor(Math.random() * 10) + 1,
        added_by: 'ADMIN',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }));

      mockPool.query.mockResolvedValueOnce({
        rows: largeBlockList,
        command: 'SELECT',
        rowCount: 1000,
        oid: 0,
        fields: []
      });

      const startTime = Date.now();
      const result = await blockService.checkPaymentAgainstBlockList('Clean Name', {});
      const endTime = Date.now();

      expect(result.isBlocked).toBe(false);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle concurrent payment checks', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: []
      });

      const promises = Array.from({ length: 10 }, (_, i) =>
        blockService.checkPaymentAgainstBlockList(`Test Name ${i}`, {})
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.isBlocked).toBe(false);
      });
    });
  });
});

