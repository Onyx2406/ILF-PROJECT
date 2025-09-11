#!/bin/bash

echo "🧪 Testing Webhook Processing with Legitimate Customer"
echo "===================================================="

# Create test webhook data with legitimate name
WEBHOOK_ID="test-webhook-$(date +%s)"
PAYMENT_ID="test-payment-$(date +%s)"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)

webhook_data=$(cat <<EOF
{
  "id": "${WEBHOOK_ID}",
  "type": "incoming_payment.completed", 
  "data": {
    "id": "${PAYMENT_ID}",
    "client": "https://cloud-nine-wallet-backend/.well-known/pay",
    "metadata": {
      "senderName": "John Smith",
      "description": "Regular payment - should be allowed",
      "senderWalletAddress": "https://legitimate.com/sender"
    },
    "completed": true,
    "createdAt": "${TIMESTAMP}",
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
}
EOF
)

echo ""
echo "📤 Sending webhook to CBS..."
echo "Webhook ID: $WEBHOOK_ID"
echo "Payment ID: $PAYMENT_ID"
echo "Sender: John Smith (SHOULD BE ALLOWED)"

response=$(curl -s -X POST http://localhost:3200/api/webhooks/rafiki \
  -H "Content-Type: application/json" \
  -H "x-forwarded-by: test-script" \
  -d "$webhook_data")

echo ""
echo "📥 Response:"
echo "$response"

echo ""
echo "🔍 Checking logs for processing activity..."
sleep 2
docker logs core-banking --tail 20 | grep -E "(AIML|fraud|blocked|cleared|John|test-payment)" | tail -10
