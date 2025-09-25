#!/bin/bash

echo "🧪 Testing Webhook Processing with Sanctioned Individual"
echo "======================================================="

# Create test webhook data
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
      "senderName": "Usama bin Ladin",
      "description": "Test payment to verify blocking",
      "senderWalletAddress": "https://test.com/sender"
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
echo "Sender: Usama bin Ladin (SHOULD BE BLOCKED)"

response=$(curl -s -X POST http://localhost:3200/api/webhooks/rafiki \
  -H "Content-Type: application/json" \
  -H "x-forwarded-by: test-script" \
  -d "$webhook_data")

echo ""
echo "📥 Response:"
echo "$response"

echo ""
echo "🔍 Checking logs for AIML activity..."
sleep 2
docker logs core-banking --tail 30 | grep -E "(DEBUG|AIML|fraud|blocked|Usama|test-payment)"
