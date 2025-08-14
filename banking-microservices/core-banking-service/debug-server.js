const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const axios = require('axios');
const { createHmac } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const { nanoid } = require('nanoid');

console.log('🚀 Starting ABL Backend with Happy Life Bank Rafiki Integration...');

// Rafiki GraphQL configuration - Happy Life Bank
const RAFIKI_CONFIG = {
  graphqlHost: 'http://localhost:4001',
  graphqlUrl: 'http://localhost:4001/graphql',
  backendApiSignatureSecret: 'iyIgCprjb9uL8wFckR+pLEkJWMB7FJhgkvqhTQR/964=',
  backendApiSignatureVersion: '1',
  senderTenantId: 'cf5fd7d3-1eb1-4041-8e43-ba45747e9e5d',
  assetId: 'b64f99cd-8b61-4c7f-9d73-cdd087e3d0ae', // USD asset ID from Happy Life Bank
  baseWalletUrl: 'https://abl-backend'
};

console.log('📋 Rafiki Configuration:');
console.log('- GraphQL URL:', RAFIKI_CONFIG.graphqlUrl);
console.log('- Tenant ID:', RAFIKI_CONFIG.senderTenantId);
console.log('- Asset ID:', RAFIKI_CONFIG.assetId);
console.log('- Base Wallet URL:', RAFIKI_CONFIG.baseWalletUrl);

// Test Rafiki connection on startup
async function testRafikiOnStartup() {
  console.log('🔌 Testing Rafiki connection...');
  try {
    const response = await axios.get('http://localhost:4001/healthz', { timeout: 5000 });
    console.log('✅ Happy Life Bank is running on port 4001');
  } catch (error) {
    console.error('❌ Happy Life Bank not accessible on port 4001:', error.message);
  }
}

testRafikiOnStartup();

console.log('✅ ABL Backend started with Happy Life Bank integration!');
