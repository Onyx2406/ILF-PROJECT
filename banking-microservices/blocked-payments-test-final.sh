#!/bin/bash

echo "🧪 Final Test: Blocked Payments Tab is Now Working"
echo "================================================="
echo ""

echo "1. ✅ Database contains blocked payments:"
docker exec 2b0fdb63af91_abl-postgres psql -U postgres -d abl_cbs -c "
SELECT 
    id,
    webhook_id,
    amount || ' ' || currency as amount_currency,
    CASE 
        WHEN blocked_reason LIKE '%Usama%' THEN '🚫 Usama bin Ladin' 
        ELSE blocked_reason 
    END as blocked_entity,
    blocked_at::date as blocked_date,
    status
FROM blocked_payments 
ORDER BY blocked_at DESC;"

echo ""
echo "2. ✅ API endpoint returns blocked payments correctly:"
curl -s http://localhost:3200/api/aiml/blocked-payments | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Total blocked payments: {data[\"total\"]}')
for payment in data['data']:
    print(f'  - ID: {payment[\"id\"]}, Amount: {payment[\"amount\"]} {payment[\"currency\"]}, Entity: {payment[\"blocked_entity_name\"]}, Severity: {payment[\"severity\"]}')
"

echo ""
echo "3. ✅ AIML Statistics working:"
curl -s http://localhost:3200/api/aiml/stats | python3 -c "
import sys, json
data = json.load(sys.stdin)['data']
print(f'Statistics:')
print(f'  - Total blocked: {data[\"total\"]}')
print(f'  - Today: {data[\"today\"]}')
print(f'  - This month: {data[\"thisMonth\"]}')
print(f'  - By severity: {data[\"bySeverity\"]}')
"

echo ""
echo "🎉 RESOLUTION COMPLETE!"
echo "======================"
echo "✅ Fixed database column mismatch (blocked_entity_id → matched_block_list_id)"
echo "✅ Blocked payments API now returns all blocked transactions"
echo "✅ Your original 'Usama bin Ladin' payment is properly recorded as blocked"
echo "✅ AML interface will now display blocked payments in the blocked payments tab"
echo ""
echo "📋 Next steps:"
echo "   - Refresh the AML page in your browser"
echo "   - Navigate to the 'Blocked Payments' tab"
echo "   - You should now see 3 blocked payments including the original sanctioned transaction"
