const https = require('http');

// Test data
const timestamp = Date.now();
const body = {
  "query": "\n  mutation CreateReceiver($input: CreateReceiverInput!) {\n    createReceiver(input: $input) {\n      receiver {\n        id\n        walletAddressUrl\n        incomingAmount {\n          value\n          assetCode\n          assetScale\n        }\n        metadata\n        createdAt\n        updatedAt\n      }\n    }\n  }\n",
  "variables": {
    "input": {
      "walletAddressUrl": "https://abl-backend/PK47ABBL8950311861785523",
      "incomingAmount": {
        "value": "500",
        "assetCode": "USD",
        "assetScale": 2
      },
      "metadata": {
        "description": "Demo payment from Cloud Nine to ABL",
        "sender": "Demo Sender App"
      }
    }
  }
};

// Test signature from our logs
const signature = "t=1755864502042, v1=693268749d8f63e6ba6d6b0bd8b314df07f61d6ffb4927d7ad015996a12863e9";
const tenantId = "438fa74a-fa7d-4317-9ced-dde32ece1787";

console.log('Testing GraphQL request...');
console.log('URL: http://cloud-nine-wallet-backend:3001/graphql');
console.log('Headers:', {
  'Content-Type': 'application/json',
  'signature': signature,
  'tenant-id': tenantId
});
console.log('Body:', JSON.stringify(body, null, 2));

const postData = JSON.stringify(body);

const options = {
  hostname: 'cloud-nine-wallet-backend',
  port: 3001,
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'signature': signature,
    'tenant-id': tenantId
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE BODY:');
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
