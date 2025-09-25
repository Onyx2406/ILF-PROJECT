// Jest setup file for banking microservices tests

// Mock console methods to reduce noise during testing
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Mock console methods unless explicitly testing them
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Set up global test environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset environment variables to defaults
  process.env.NODE_ENV = 'test';
  process.env.PGHOST = 'localhost';
  process.env.PGPORT = '5432';
  process.env.PGUSER = 'postgres';
  process.env.PGPASSWORD = 'postgres';
  process.env.PGDATABASE = 'test_db';
});

// Clean up after each test
afterEach(() => {
  // Clean up any timers
  jest.clearAllTimers();
});

// Global test utilities
global.testUtils = {
  // Helper to create mock database response
  createMockDbResponse: (rows = [], command = 'SELECT', rowCount = null) => ({
    rows,
    command,
    rowCount: rowCount !== null ? rowCount : rows.length,
    oid: 0,
    fields: []
  }),
  
  // Helper to create mock customer
  createMockCustomer: (overrides = {}) => ({
    c_id: 1,
    name: 'Test Customer',
    email: 'test@example.com',
    phone_number: '+923001234567',
    address: '123 Test St',
    cnic: '4210112345671',
    dob: '1990-01-01',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),
  
  // Helper to create mock account
  createMockAccount: (overrides = {}) => ({
    id: 1,
    name: 'Test Account',
    email: 'test@example.com',
    iban: 'PK12ABBL1234567890123456',
    currency: 'PKR',
    balance: '1000.00',
    available_balance: '1000.00',
    book_balance: '1000.00',
    account_type: 'SAVINGS',
    status: 'active',
    customer_id: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),
  
  // Helper to create mock block list entry
  createMockBlockEntry: (overrides = {}) => ({
    id: 1,
    name: 'Test Blocked Entity',
    type: 'person',
    reason: 'Test Sanctions',
    severity: 8,
    added_by: 'ADMIN',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  })
};

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress specific warnings that are expected in test environment
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' && 
    (args[0].includes('deprecated') || 
     args[0].includes('experimental') ||
     args[0].includes('punycode'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

