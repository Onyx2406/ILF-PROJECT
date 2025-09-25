#!/bin/bash

# 🚀 Test Implementation PR Creation Script
# This script creates organized pull requests for each test category

set -e

echo "🔧 Setting up Git configuration..."
echo "Please configure your Git credentials:"

# Check if Git is configured
if ! git config --global user.name > /dev/null 2>&1; then
    echo "Please enter your name for Git commits:"
    read -p "Name: " git_name
    git config --global user.name "$git_name"
fi

if ! git config --global user.email > /dev/null 2>&1; then
    echo "Please enter your email for Git commits:"
    read -p "Email: " git_email
    git config --global user.email "$git_email"
fi

echo "✅ Git configured with:"
echo "Name: $(git config --global user.name)"
echo "Email: $(git config --global user.email)"

# Create initial commit with existing files
echo "📦 Creating initial commit..."
git add -A
git commit -m "Initial commit: ILF Banking Microservices Project

- Complete Rafiki integration
- Banking microservices infrastructure
- Docker compose setup
- Initial documentation"

# Create and push main branch
echo "🌿 Setting up main branch..."
git push -u origin main

echo ""
echo "🎯 Creating Pull Requests for Test Implementation"
echo "================================================"

# Test PR Categories
declare -A TEST_CATEGORIES=(
    ["core-utilities"]="Core Utilities Tests - IBAN, Mobile, Validation"
    ["authentication"]="Authentication Tests - Password Hashing, Security" 
    ["currency-operations"]="Currency Tests - USD/PKR Conversion, Rate Fetching"
    ["database-layer"]="Database Tests - Connection Management, Queries"
    ["security-compliance"]="Security & Compliance Tests - AML/CFT, Sanctions"
    ["error-handling"]="Error Handling Tests - Edge Cases, Performance"
    ["api-endpoints"]="API Tests - Account & Customer Endpoints"
    ["test-infrastructure"]="Test Infrastructure - Jest Config, Documentation"
)

# Function to create a test PR
create_test_pr() {
    local branch_name=$1
    local pr_title=$2
    local test_files=("${@:3}")
    
    echo ""
    echo "🔨 Creating PR: $pr_title"
    echo "Branch: $branch_name"
    
    # Create and checkout new branch
    git checkout -b "$branch_name"
    
    # Add specific test files for this category
    for file in "${test_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "  ✅ Adding: $file"
            git add "$file"
        fi
    done
    
    # Create commit
    git commit -m "$pr_title

    🧪 Test Implementation Details:
    $(printf '%s\n' "${test_files[@]}" | sed 's/^/- /')
    
    ✅ Features:
    - Comprehensive test coverage
    - Jest configuration
    - Mock implementations
    - Error handling
    - Documentation
    
    📊 Quality Metrics:
    - Unit tests with proper assertions
    - Edge case coverage
    - Performance testing
    - Security validation"
    
    # Push branch
    git push -u origin "$branch_name"
    
    # Return to main
    git checkout main
    
    echo "✅ Branch '$branch_name' created and pushed"
    echo "🌐 Create PR at: https://github.com/Onyx2406/ILF-PROJECT/compare/$branch_name"
}

# PR 1: Core Utilities Tests
create_test_pr "feature/core-utilities-tests" \
    "Add Core Utilities Test Suite" \
    "banking-microservices/core-banking-service/lib/__tests__/utils.test.ts"

# PR 2: Authentication Tests  
create_test_pr "feature/authentication-tests" \
    "Add Authentication & Security Test Suite" \
    "banking-microservices/core-banking-service/lib/__tests__/auth.test.ts"

# PR 3: Currency Operations Tests
create_test_pr "feature/currency-tests" \
    "Add Currency Conversion Test Suite" \
    "banking-microservices/core-banking-service/lib/__tests__/currency.test.ts"

# PR 4: Database Layer Tests
create_test_pr "feature/database-tests" \
    "Add Database Operations Test Suite" \
    "banking-microservices/core-banking-service/lib/__tests__/database.test.ts"

# PR 5: Security & Compliance Tests
create_test_pr "feature/security-compliance-tests" \
    "Add Security & AML/CFT Compliance Test Suite" \
    "banking-microservices/core-banking-service/lib/__tests__/security-compliance.test.ts"

# PR 6: Error Handling Tests
create_test_pr "feature/error-handling-tests" \
    "Add Error Handling & Edge Cases Test Suite" \
    "banking-microservices/core-banking-service/lib/__tests__/error-handling.test.ts"

# PR 7: API Endpoints Tests
create_test_pr "feature/api-tests" \
    "Add API Endpoint Test Suite" \
    "banking-microservices/core-banking-service/app/api/__tests__/accounts.test.ts" \
    "banking-microservices/core-banking-service/app/api/__tests__/customers.test.ts"

# PR 8: Test Infrastructure
create_test_pr "feature/test-infrastructure" \
    "Add Test Infrastructure & Configuration" \
    "banking-microservices/core-banking-service/jest.config.js" \
    "banking-microservices/core-banking-service/jest.setup.js" \
    "banking-microservices/core-banking-service/run-tests.js" \
    "banking-microservices/core-banking-service/TEST_GUIDE.md" \
    "banking-microservices/core-banking-service/package.json" \
    "TEST_IMPLEMENTATION_REPORT.md"

echo ""
echo "🎉 All test PRs created successfully!"
echo "================================================"
echo ""
echo "📋 Summary of Pull Requests Created:"
echo "1. 🔧 Core Utilities Tests - IBAN, Mobile, Validation (37 tests)"
echo "2. 🔐 Authentication Tests - Password Hashing, Security (27 tests)"  
echo "3. 💱 Currency Tests - USD/PKR Conversion, Rate Fetching (41 tests)"
echo "4. 🗄️ Database Tests - Connection Management, Queries (32 tests)"
echo "5. 🔒 Security & Compliance Tests - AML/CFT, Sanctions (26 tests)"
echo "6. ⚠️ Error Handling Tests - Edge Cases, Performance (90 tests)"
echo "7. 🌐 API Tests - Account & Customer Endpoints (36 tests)"
echo "8. 📚 Test Infrastructure - Jest Config, Documentation"
echo ""
echo "📊 Total: 289 test cases across 8 comprehensive test suites"
echo ""
echo "🌐 GitHub PRs:"
for category in "${!TEST_CATEGORIES[@]}"; do
    echo "   https://github.com/Onyx2406/ILF-PROJECT/compare/feature/$category-tests"
done
echo ""
echo "✅ Next Steps:"
echo "1. Visit the GitHub URLs above to create the actual PRs"
echo "2. Add descriptions and labels to each PR"
echo "3. Request reviews from team members"
echo "4. Merge PRs after approval"
echo ""
echo "🎯 All 289 test cases are now ready for review and integration!"
