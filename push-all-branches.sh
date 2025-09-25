#!/bin/bash

# 🚀 Push All Test Branches to GitHub
# Run this script after authenticating with GitHub

set -e

echo "🔧 Git Configuration:"
echo "Name: $(git config --global user.name)"
echo "Email: $(git config --global user.email)"
echo ""

echo "🚀 Pushing all branches to GitHub..."
echo "================================================"

# Push main branch
echo "📦 Pushing main branch..."
git push -u origin main
echo "✅ Main branch pushed successfully!"
echo ""

# Push all feature branches
branches=(
    "feature/core-utilities-tests"
    "feature/authentication-tests"
    "feature/currency-tests"
    "feature/database-tests"
    "feature/security-compliance-tests"
    "feature/error-handling-tests"
    "feature/api-tests"
    "feature/test-infrastructure"
)

echo "🌿 Pushing feature branches..."
for branch in "${branches[@]}"; do
    echo "  → Pushing $branch..."
    git push -u origin "$branch"
done

echo ""
echo "🎉 All branches pushed successfully!"
echo "================================================"
echo ""
echo "🌐 Create Pull Requests at:"
echo "1. Core Utilities: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/core-utilities-tests"
echo "2. Authentication: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/authentication-tests"
echo "3. Currency: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/currency-tests"
echo "4. Database: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/database-tests"
echo "5. Security: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/security-compliance-tests"
echo "6. Error Handling: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/error-handling-tests"
echo "7. API Tests: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/api-tests"
echo "8. Infrastructure: https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/test-infrastructure"
echo ""
echo "📊 Total: 289 test cases across 8 comprehensive test suites ready for review!"
