# ABL Core Banking API - Postman Collection Guide

## 📋 Overview
This Postman collection provides a complete workflow for:
1. **Creating Customers** 👤
2. **Creating Bank Accounts** 🏦 
3. **Creating Wallet Addresses** 💳

## 🚀 Quick Setup

### 1. Import Collection & Environment
1. Import `ABL_Core_Banking_API.postman_collection.json` into Postman
2. Import `ABL_Core_Banking_Environment.postman_environment.json` 
3. Select "ABL Core Banking Environment" in Postman

### 2. Verify Server is Running
- Make sure your ABL backend is running on `http://localhost:8101`
- Test with: **1. Health Check** request

## 🎯 Complete Workflow

### Method 1: Step-by-Step Manual Process

#### Step 1: Create Customer
```json
POST /api/customers
{
  "name": "John Doe",
  "email": "john.doe@example.com", 
  "phone_number": "+92-300-1234567",
  "address": "123 Main Street, Karachi, Pakistan",
  "cnic": "42101-1234567-1",
  "dob": "1990-05-15"
}
```
**Result:** Customer created with `customer_id` (auto-saved to environment)

#### Step 2: Create Account for Customer  
```json
POST /api/customers/{{customer_id}}/accounts
{
  "name": "John Doe - Savings Account",
  "email": "john.doe@example.com",
  "currency": "PKR", 
  "initial_balance": "1000.00",
  "account_type": "SAVINGS"
}
```
**Result:** Account created with `account_id` and `iban` (auto-saved)

#### Step 3: Create Wallet Address
```json
PATCH /api/accounts/{{account_id}}/wallet
{
  "wallet_address_id": "{{$randomUUID}}",
  "wallet_address_url": "$ilp.example.com/{{account_iban}}",
  "wallet_public_name": "John's Wallet", 
  "asset_id": "PKR"
}
```
**Result:** Wallet address created and linked to account

### Method 2: Quick Workflow (Recommended)

Use the **"6. Complete Workflow Examples"** folder:

1. **STEP 1 - Create Customer (Sarah)** ✅
2. **STEP 2 - Create Account for Sarah** ✅  
3. **STEP 3 - Create Wallet Address for Sarah** ✅
4. **BONUS - Check Sarah's Complete Profile** 📋

Just run these 4 requests in order!

## 📁 Collection Structure

### 1. Health Check
- **Health Check**: Verify API is running

### 2. Customer Management  
- **Create Customer**: Add new customer
- **Get All Customers**: List all customers
- **Get Customer by ID**: Get specific customer

### 3. Account Management
- **Create Account for Customer**: Link account to customer
- **Create Direct Account**: Standalone account
- **Get All Accounts**: List all accounts
- **Get Account by ID**: Get specific account
- **Get Customer's Accounts**: Customer's account list

### 4. Wallet Address Management
- **Create Wallet Address**: Add wallet to account
- **Get All Payment Pointers**: List all wallets
- **Get Payment Pointer by Account**: Get specific wallet

### 5. Account Operations
- **Credit Account**: Add money
- **Debit Account**: Withdraw money  
- **Get Account Transactions**: Transaction history

### 6. Complete Workflow Examples
- Ready-to-use examples with test scripts
- Automatically saves IDs between requests
- Console logs guide you through each step

### 7. Debug & Utilities
- Debug endpoints for troubleshooting
- Database relationship viewer

## 🔧 Advanced Features

### Auto-Generated Data
The collection uses Postman's dynamic variables:
- `{{$randomUUID}}`: Unique wallet IDs
- `{{$randomFirstName}}`: Random names
- `{{$randomInt}}`: Random numbers
- `{{account_iban}}`: Uses actual IBAN from account creation

### Environment Variables
Variables are automatically saved between requests:
- `customer_id`: Current customer ID
- `account_id`: Current account ID  
- `account_iban`: Current account IBAN
- `wallet_address_id`: Current wallet ID

### Test Scripts
Each request includes test scripts that:
- Save important IDs to environment
- Provide console feedback
- Guide you to the next step

## 🎯 Real Examples

### Example 1: Personal Banking Customer
```json
Customer: {
  "name": "Ahmed Ali",
  "email": "ahmed.ali@gmail.com",
  "phone_number": "+92-321-1234567",
  "cnic": "42101-1234567-1"
}

Account: {
  "account_type": "SAVINGS",
  "initial_balance": "5000.00"
}

Wallet: {
  "wallet_public_name": "Ahmed's Personal Wallet",
  "wallet_address_url": "$ilp.abl.com/ahmed-personal"
}
```

### Example 2: Business Customer
```json
Customer: {
  "name": "Sarah's Tech Solutions",
  "email": "sarah@techsolutions.com",
  "phone_number": "+92-300-9876543"
}

Account: {
  "account_type": "BUSINESS", 
  "initial_balance": "25000.00"
}

Wallet: {
  "wallet_public_name": "TechSolutions Business Wallet",
  "wallet_address_url": "$ilp.abl.com/techsolutions-biz"
}
```

## 🚨 Common Issues & Solutions

### Issue: "Customer not found"
- **Solution**: Make sure `customer_id` is set in environment
- **Check**: Run "Get All Customers" to see available IDs

### Issue: "Account not found"  
- **Solution**: Verify `account_id` in environment variables
- **Check**: Run "Get All Accounts" to see available accounts

### Issue: "Connection refused"
- **Solution**: Ensure backend server is running on port 8101
- **Command**: `cd abl-service && node server.js`

### Issue: "Wallet already exists"
- **Solution**: Use "Get Payment Pointer by Account" to see existing wallet
- **Note**: One wallet per account

## 🎉 Success Indicators

### ✅ Customer Created Successfully
```json
{
  "success": true,
  "data": {
    "c_id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "status": "active"
  }
}
```

### ✅ Account Created Successfully  
```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "John Doe - Savings Account",
    "iban": "PK95ABBL3315255376969660",
    "balance": "1000.00"
  }
}
```

### ✅ Wallet Address Created Successfully
```json
{
  "success": true,
  "data": {
    "id": 5,
    "wallet_address_id": "uuid-here",
    "wallet_address_url": "$ilp.example.com/PK95ABBL3315255376969660",
    "wallet_public_name": "John's Wallet"
  }
}
```

## 🔄 Testing the Complete Flow

1. **Start with Health Check** - Ensure API is running
2. **Create Customer** - Creates customer profile
3. **Create Account** - Links bank account to customer  
4. **Create Wallet** - Adds payment pointer to account
5. **Verify with GET requests** - Check everything was created
6. **Test Operations** - Credit/debit money
7. **Check Transactions** - View account history

## 📞 Support

If you encounter issues:
1. Check server logs in terminal
2. Verify environment variables are set
3. Use debug endpoints to check database state
4. Ensure all required fields are provided

**Happy Banking! 🏦💳**
