#!/bin/bash

echo "🧪 Complete Rafiki Integration Test on Happy Life Bank"
echo "======================================================"

# Step 1: Create Customer
echo
echo "📋 Step 1: Creating customer..."
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:8101/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User Rafiki", "email": "test.rafiki@example.com", "phone_number": "+1234567894", "address": "123 Rafiki St", "cnic": "1234567890127", "dob": "1990-06-10"}')

echo $CUSTOMER_RESPONSE

CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | grep -o '"c_id":[0-9]*' | cut -d':' -f2)
echo "✅ Customer ID: $CUSTOMER_ID"

# Step 2: Create Account
echo
echo "📋 Step 2: Creating account..."
ACCOUNT_RESPONSE=$(curl -s -X POST http://localhost:8101/api/customers/$CUSTOMER_ID/accounts \
  -H "Content-Type: application/json" \
  -d '{"account_type": "current", "initial_deposit": 2500, "branch_code": "BR002"}')

echo $ACCOUNT_RESPONSE

ACCOUNT_ID=$(echo $ACCOUNT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "✅ Account ID: $ACCOUNT_ID"

# Step 3: Create Wallet with Rafiki
echo
echo "📋 Step 3: Creating wallet address via Happy Life Bank Rafiki..."
WALLET_RESPONSE=$(curl -s -X PATCH http://localhost:8101/api/accounts/$ACCOUNT_ID/wallet \
  -H "Content-Type: application/json" \
  -d '{"wallet_public_name": "Test Rafiki Wallet", "asset_id": "USD"}')

echo $WALLET_RESPONSE

# Check if wallet was created successfully
if echo $WALLET_RESPONSE | grep -q '"wallet_address_id":null'; then
  echo "❌ Wallet address NOT created - wallet_address_id is null"
  echo "💡 Check server logs for Rafiki integration errors"
else
  echo "🎉 Wallet address created successfully!"
  echo "📋 Wallet details:"
  echo $WALLET_RESPONSE | grep -o '"wallet_address_id":"[^"]*"'
  echo $WALLET_RESPONSE | grep -o '"wallet_address_url":"[^"]*"'
fi

echo
echo "✅ Test completed!"
