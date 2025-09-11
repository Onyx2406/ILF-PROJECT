#!/bin/bash

echo "🧪 Testing Webhook Processing with Sanctioned Individual"
echo "======================================================="
echo ""

# Simulate the exact webhook that was received
webhook_data='{
  "id": "test-webhook-' $(date +%s) '",
  "type": "incoming_payment.completed",
  "data": {
    "id": "test-payment-' $(date +%s) '",
    "client": "https://cloud-nine-wallet-backend/.well-known/pay",
    "metadata": {
      "senderName": "Usama bin Ladin",
      "description": "Test payment to verify blocking",
      "senderWalletAddress": "https://test.com/sender"
    },
    "completed": true,
    "createdAt": "' $(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) '",
    "incomingAmount": {
      "value": "100",
      "assetCode": "USD",
      "assetScale": 2
    },
    "receivedAmount": {
      "value": "100",
      "assetCode": "USD",
      "assetScale": 2
    },
    "walletAddressId": "4ed7df8b-0a62-4779-864d-245b7baa473b"
  }
}'

echo "📤 Sending webhook to CBS..."
echo "Webhook data: $webhook_data" | jq .

response=$(curl -s -X POST http://localhost:3200/api/webhooks/rafiki \
  -H "Content-Type: application/json" \
  -H "x-forwarded-by: test-script" \
  -d "$webhook_data")

echo ""
echo "📥 Response:"
echo "$response" | jq .

echo ""
echo "🔍 Checking logs for AIML activity..."
docker logs core-banking --tail 20 | grep -E "(DEBUG|AIML|fraud|blocked|Usama)"
