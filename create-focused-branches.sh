#!/bin/bash

# 🎯 Create Focused Branches with Only Relevant Test Files
# Each branch will contain only its specific test files

set -e

echo "🎯 Creating focused branches with only relevant test files..."
echo "=============================================================="

# Function to create a focused branch
create_focused_branch() {
    local branch_name=$1
    local commit_message="$2"
    shift 2
    local files=("$@")
    
    echo ""
    echo "🌿 Creating focused branch: $branch_name"
    
    # Delete the existing branch (both local and remote)
    git branch -D "$branch_name" 2>/dev/null || true
    git push origin --delete "$branch_name" 2>/dev/null || true
    
    # Create new branch from main
    git checkout main
    git checkout -b "$branch_name"
    
    # Add only the specific files for this branch
    echo "  📁 Adding files:"
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "    ✅ $file"
            git add "$file"
        else
            echo "    ❌ $file (not found)"
        fi
    done
    
    # Create commit with only these files
    git commit -m "$commit_message" || echo "  ℹ️ No changes to commit for $branch_name"
    
    # Push the focused branch
    git push -u origin "$branch_name"
    echo "  ✅ Branch $branch_name pushed with focused changes"
}

# 1. Core Utilities Tests
create_focused_branch "feature/core-utilities-tests" \
    "Add Core Utilities Test Suite

🧪 37 comprehensive test cases covering:
- IBAN generation and validation (Pakistani format)
- Mobile number formatting (+92 prefix)  
- Wallet address generation
- Input validation and sanitization
- Edge cases and boundary conditions

✅ Features:
- Pakistani banking standards compliance
- Comprehensive error handling
- Unicode and special character support
- Performance optimized validation" \
    "banking-microservices/core-banking-service/lib/__tests__/utils.test.ts"

# 2. Authentication Tests
create_focused_branch "feature/authentication-tests" \
    "Add Authentication & Security Test Suite

🔐 27 comprehensive test cases covering:
- Password hashing with bcrypt (12 salt rounds)
- Username generation from email + IBAN
- Password verification and validation
- Security edge cases and vulnerabilities

✅ Security Features:
- Hash tampering detection
- Input validation security
- Integration with user registration
- Default password handling" \
    "banking-microservices/core-banking-service/lib/__tests__/auth.test.ts"

# 3. Currency Tests
create_focused_branch "feature/currency-tests" \
    "Add Currency Conversion Test Suite

💱 41 comprehensive test cases covering:
- USD to PKR conversion with live rates
- FreeCurrencyAPI integration with fallback
- Risk calculation algorithms (10-75 scale)
- Currency formatting and symbols

✅ Features:
- API failure handling and fallback rates
- Precision rounding for financial accuracy
- Performance testing for large amounts
- Network timeout and error scenarios" \
    "banking-microservices/core-banking-service/lib/__tests__/currency.test.ts"

# 4. Database Tests
create_focused_branch "feature/database-tests" \
    "Add Database Operations Test Suite

🗄️ 32 comprehensive test cases covering:
- PostgreSQL connection pool management
- Database initialization and table creation
- IBAN generation with mod-97 algorithm
- Block list checking for AML/CFT compliance

✅ Features:
- Connection error handling
- Environment configuration testing
- Mock database operations
- Performance and timeout scenarios" \
    "banking-microservices/core-banking-service/lib/__tests__/database.test.ts"

# 5. Security & Compliance Tests
create_focused_branch "feature/security-compliance-tests" \
    "Add Security & AML/CFT Compliance Test Suite

🔒 26 comprehensive test cases covering:
- AML/CFT sanctions list checking
- OFAC, UN, EU compliance validation
- Fuzzy name matching (60% threshold)
- SQL injection prevention

✅ Compliance Features:
- Real-world sanctioned entity testing
- Payment blocking workflows
- Audit trail and reporting
- Performance with large block lists (1000+ entities)" \
    "banking-microservices/core-banking-service/lib/__tests__/security-compliance.test.ts"

# 6. Error Handling Tests
create_focused_branch "feature/error-handling-tests" \
    "Add Error Handling & Edge Cases Test Suite

⚠️ 90 comprehensive test cases covering:
- Null/undefined input handling
- Unicode and international characters
- Network failures and timeouts
- Memory stress testing

✅ Edge Case Coverage:
- Very large inputs (10,000+ characters)
- Concurrent operations (100 simultaneous)
- Boundary condition testing
- Type coercion scenarios" \
    "banking-microservices/core-banking-service/lib/__tests__/error-handling.test.ts"

# 7. API Tests
create_focused_branch "feature/api-tests" \
    "Add API Endpoint Test Suite

🌐 36 comprehensive test cases covering:
- Account creation and management (16 tests)
- Customer management with pagination (20 tests)
- Request validation and error handling
- Database integration testing

✅ API Features:
- Complete CRUD operations testing
- Input validation and sanitization
- Error response formatting
- Pagination and search functionality" \
    "banking-microservices/core-banking-service/app/api/__tests__/accounts.test.ts" \
    "banking-microservices/core-banking-service/app/api/__tests__/customers.test.ts"

# 8. Test Infrastructure
create_focused_branch "feature/test-infrastructure" \
    "Add Test Infrastructure & Configuration

📚 Complete test infrastructure including:
- Jest configuration for TypeScript
- Test setup with utilities and mocks
- Custom test runner with reporting
- Comprehensive documentation
- Package.json with test scripts

✅ Infrastructure Features:
- Automated test discovery
- Coverage reporting
- Mock data generators
- Test utilities and helpers
- Complete user documentation" \
    "banking-microservices/core-banking-service/jest.config.js" \
    "banking-microservices/core-banking-service/jest.setup.js" \
    "banking-microservices/core-banking-service/run-tests.js" \
    "banking-microservices/core-banking-service/TEST_GUIDE.md" \
    "TEST_IMPLEMENTATION_REPORT.md"

echo ""
echo "🎉 All focused branches created successfully!"
echo "=============================================="
echo ""
echo "🌐 Create Pull Requests:"
echo "1. Core Utilities:    https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/core-utilities-tests"
echo "2. Authentication:    https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/authentication-tests"
echo "3. Currency:          https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/currency-tests"
echo "4. Database:          https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/database-tests"
echo "5. Security:          https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/security-compliance-tests"
echo "6. Error Handling:    https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/error-handling-tests"
echo "7. API Tests:         https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/api-tests"
echo "8. Infrastructure:    https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/test-infrastructure"
echo ""
echo "✅ Each branch now contains only its specific test files!"
