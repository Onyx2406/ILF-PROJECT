#!/bin/bash

# 🎯 Create Clean Test Branches 
# Remove test files from main, then add them to specific branches

set -e

echo "🎯 Creating clean test branches with focused commits..."
echo "======================================================="

# Step 1: Create a clean main branch without test files
echo "🧹 Step 1: Cleaning main branch (removing test files)"
git checkout main

# Remove test files from main
echo "  Removing test files from main..."
git rm -f banking-microservices/core-banking-service/lib/__tests__/*.test.ts 2>/dev/null || true
git rm -f banking-microservices/core-banking-service/app/api/__tests__/*.test.ts 2>/dev/null || true
git rm -f banking-microservices/core-banking-service/jest.config.js 2>/dev/null || true
git rm -f banking-microservices/core-banking-service/jest.setup.js 2>/dev/null || true
git rm -f banking-microservices/core-banking-service/run-tests.js 2>/dev/null || true
git rm -f banking-microservices/core-banking-service/TEST_GUIDE.md 2>/dev/null || true
git rm -f TEST_IMPLEMENTATION_REPORT.md 2>/dev/null || true

# Also remove test dependencies from package.json
cat > banking-microservices/core-banking-service/package.json << 'EOF'
{
  "name": "abl-service",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:build": "docker-compose build",
    "docker:logs": "docker-compose logs -f"
  },
  "dependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.3",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/morgan": "^1.9.10",
    "@types/pg": "^8.15.5",
    "@types/uuid": "^10.0.0",
    "axios": "^1.11.0",
    "bcrypt": "^6.0.0",
    "concurrently": "^9.2.0",
    "cors": "^2.8.5",
    "crypto": "^1.0.1",
    "dotenv": "^17.2.1",
    "express": "^5.1.0",
    "helmet": "^8.1.0",
    "joi": "^18.0.0",
    "json-canonicalize": "^2.0.0",
    "jsonwebtoken": "^9.0.2",
    "lucide-react": "^0.263.1",
    "morgan": "^1.10.1",
    "nanoid": "^5.1.5",
    "next": "15.4.5",
    "pg": "^8.16.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "ts-node": "^10.9.2",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20.19.9",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^9",
    "eslint-config-next": "15.4.5",
    "nodemon": "^3.1.10",
    "tailwindcss": "^4",
    "typescript": "^5.9.2"
  }
}
EOF

git add banking-microservices/core-banking-service/package.json
git commit -m "Clean main branch: Remove test files for focused PR approach

- Removed all test files from main branch  
- Cleaned package.json (removed test dependencies)
- Preparing for focused test PRs with specific files per branch"

git push origin main
echo "✅ Main branch cleaned"

# Function to restore a test file and create branch
create_test_branch() {
    local branch_name=$1
    local commit_message="$2"
    local package_needs_update=$3
    shift 3
    local files=("$@")
    
    echo ""
    echo "🌿 Creating branch: $branch_name"
    
    # Delete existing remote branch
    git push origin --delete "$branch_name" 2>/dev/null || true
    
    # Create new branch from clean main
    git checkout main
    git checkout -b "$branch_name"
    
    # Restore test files from backup (git history)
    echo "  📁 Restoring files:"
    for file in "${files[@]}"; do
        if git checkout HEAD~1 -- "$file" 2>/dev/null; then
            echo "    ✅ $file"
        else
            echo "    ❌ $file (not found in history)"
        fi
    done
    
    # Update package.json if needed
    if [[ "$package_needs_update" == "true" ]]; then
        echo "  📦 Updating package.json with test dependencies..."
        cat > banking-microservices/core-banking-service/package.json << 'EOF'
{
  "name": "abl-service",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:build": "docker-compose build",
    "docker:logs": "docker-compose logs -f"
  },
  "dependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.3",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/morgan": "^1.9.10",
    "@types/pg": "^8.15.5",
    "@types/uuid": "^10.0.0",
    "axios": "^1.11.0",
    "bcrypt": "^6.0.0",
    "concurrently": "^9.2.0",
    "cors": "^2.8.5",
    "crypto": "^1.0.1",
    "dotenv": "^17.2.1",
    "express": "^5.1.0",
    "helmet": "^8.1.0",
    "joi": "^18.0.0",
    "json-canonicalize": "^2.0.0",
    "jsonwebtoken": "^9.0.2",
    "lucide-react": "^0.263.1",
    "morgan": "^1.10.1",
    "nanoid": "^5.1.5",
    "next": "15.4.5",
    "pg": "^8.16.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "ts-node": "^10.9.2",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.19.9",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^9",
    "eslint-config-next": "15.4.5",
    "jest": "^29.7.0",
    "jest-environment-node": "^29.7.0",
    "nodemon": "^3.1.10",
    "tailwindcss": "^4",
    "ts-jest": "^29.1.0",
    "typescript": "^5.9.2"
  }
}
EOF
        git add banking-microservices/core-banking-service/package.json
    fi
    
    # Commit the changes
    git add .
    git commit -m "$commit_message"
    
    # Push branch
    git push -u origin "$branch_name"
    echo "  ✅ Branch $branch_name created and pushed"
}

# Create all test branches
create_test_branch "feature/core-utilities-tests" \
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
- Performance optimized validation

Files added:
- lib/__tests__/utils.test.ts (253 lines, 37 tests)" \
    "false" \
    "banking-microservices/core-banking-service/lib/__tests__/utils.test.ts"

create_test_branch "feature/authentication-tests" \
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
- Default password handling

Files added:
- lib/__tests__/auth.test.ts (272 lines, 27 tests)" \
    "false" \
    "banking-microservices/core-banking-service/lib/__tests__/auth.test.ts"

create_test_branch "feature/currency-tests" \
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
- Network timeout and error scenarios

Files added:
- lib/__tests__/currency.test.ts (414 lines, 41 tests)" \
    "false" \
    "banking-microservices/core-banking-service/lib/__tests__/currency.test.ts"

create_test_branch "feature/database-tests" \
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
- Performance and timeout scenarios

Files added:
- lib/__tests__/database.test.ts (560 lines, 32 tests)" \
    "false" \
    "banking-microservices/core-banking-service/lib/__tests__/database.test.ts"

create_test_branch "feature/security-compliance-tests" \
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
- Performance with large block lists (1000+ entities)

Files added:
- lib/__tests__/security-compliance.test.ts (620 lines, 26 tests)" \
    "false" \
    "banking-microservices/core-banking-service/lib/__tests__/security-compliance.test.ts"

create_test_branch "feature/error-handling-tests" \
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
- Type coercion scenarios

Files added:
- lib/__tests__/error-handling.test.ts (669 lines, 90 tests)" \
    "false" \
    "banking-microservices/core-banking-service/lib/__tests__/error-handling.test.ts"

create_test_branch "feature/api-tests" \
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
- Pagination and search functionality

Files added:
- app/api/__tests__/accounts.test.ts (391 lines, 16 tests)
- app/api/__tests__/customers.test.ts (478 lines, 20 tests)" \
    "false" \
    "banking-microservices/core-banking-service/app/api/__tests__/accounts.test.ts" \
    "banking-microservices/core-banking-service/app/api/__tests__/customers.test.ts"

create_test_branch "feature/test-infrastructure" \
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
- Complete user documentation

Files added:
- jest.config.js (35 lines)
- jest.setup.js (118 lines)
- run-tests.js (123 lines)
- TEST_GUIDE.md (187 lines)
- TEST_IMPLEMENTATION_REPORT.md (577 lines)
- Updated package.json with test dependencies" \
    "true" \
    "banking-microservices/core-banking-service/jest.config.js" \
    "banking-microservices/core-banking-service/jest.setup.js" \
    "banking-microservices/core-banking-service/run-tests.js" \
    "banking-microservices/core-banking-service/TEST_GUIDE.md" \
    "TEST_IMPLEMENTATION_REPORT.md"

echo ""
echo "🎉 All focused test branches created successfully!"
echo "=================================================="
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
echo "✅ Each branch now shows only its specific test files as changes!"
