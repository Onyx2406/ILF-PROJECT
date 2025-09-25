#!/bin/bash

echo "🧪 Testing Rafiki Integration using curl..."
echo

# Step 1: Create a customer
echo "📋 Step 1: Creating a customer..."
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:8101/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "Customer",
    "email": "test.customer@example.com",
    "phone_number": "+1234567890",
    "date_of_birth": "1990-01-01",
    "cnic_number": "1234567890123",
    "address": "123 Test Street, Test City"
  }')

CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "✅ Customer created with ID: $CUSTOMER_ID"

# Step 2: Create an account
echo
echo "📋 Step 2: Creating an account..."
ACCOUNT_RESPONSE=$(curl -s -X POST http://localhost:8101/api/accounts \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": $CUSTOMER_ID,
    \"account_type\": \"savings\",
    \"initial_deposit\": 1000.00,
    \"branch_code\": \"BR001\"
  }")

ACCOUNT_ID=$(echo $ACCOUNT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
ACCOUNT_NUMBER=$(echo $ACCOUNT_RESPONSE | grep -o '"account_number":"[^"]*"' | cut -d':' -f2 | tr -d '"')
echo "✅ Account created with ID: $ACCOUNT_ID, Number: $ACCOUNT_NUMBER"

# Step 3: Create wallet address using Rafiki
echo
echo "📋 Step 3: Creating wallet address via Rafiki..."
WALLET_RESPONSE=$(curl -s -X PATCH http://localhost:8101/api/accounts/$ACCOUNT_ID/wallet \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_public_name": "Test Customer Wallet",
    "asset_id": "USD"
  }')

echo
echo "🎉 Rafiki Integration Test Results:"
echo "====================================="
echo "Customer ID: $CUSTOMER_ID"
echo "Account ID: $ACCOUNT_ID"
echo "Account Number: $ACCOUNT_NUMBER"
echo
echo "Wallet Response:"
echo $WALLET_RESPONSE | jq . || echo $WALLET_RESPONSE

# Check if the response indicates success
if echo $WALLET_RESPONSE | grep -q '"success":true'; then
  echo
  echo "🌟 Test passed! Rafiki integration is working correctly."
else
  echo
  echo "❌ Test failed! Check the response above for errors."
  exit 1
fi
