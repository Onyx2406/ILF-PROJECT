# 🔑 GitHub Authentication Guide

## Current Setup ✅
- Git configured with: **Onyx2406** (yashsancheti24@gmail.com)
- Repository: https://github.com/Onyx2406/ILF-PROJECT
- All branches created locally and ready to push

## 🚀 Quick Start (Choose One Method)

### Method 1: GitHub CLI (Recommended)
```bash
# Install GitHub CLI (if not installed)
sudo apt update
sudo apt install gh

# Authenticate with GitHub
gh auth login

# Then run the push script
./push-all-branches.sh
```

### Method 2: Personal Access Token
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (full repository access)
4. Copy the generated token
5. When prompted for password during push, use the token instead

```bash
# Run the push script (will prompt for credentials)
./push-all-branches.sh
```

### Method 3: SSH Key (Most Secure)
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "yashsancheti24@gmail.com"

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copy public key
cat ~/.ssh/id_ed25519.pub
# Copy this output and add to GitHub: https://github.com/settings/keys

# Change remote to SSH
git remote set-url origin git@github.com:Onyx2406/ILF-PROJECT.git

# Then push
./push-all-branches.sh
```

## 📋 Step-by-Step Process

### Step 1: Authenticate (choose method above)

### Step 2: Push All Branches
```bash
cd /home/yash/Downloads/ILF-PROJECT-main
./push-all-branches.sh
```

### Step 3: Create Pull Requests
After pushing, visit these URLs to create PRs:

| # | Test Suite | Description | Create PR |
|---|------------|-------------|-----------|
| 1 | Core Utilities | IBAN, Mobile, Validation (37 tests) | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/core-utilities-tests) |
| 2 | Authentication | Security, Password Hashing (27 tests) | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/authentication-tests) |
| 3 | Currency | USD/PKR Conversion (41 tests) | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/currency-tests) |
| 4 | Database | Connection, Queries (32 tests) | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/database-tests) |
| 5 | Security | AML/CFT, Compliance (26 tests) | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/security-compliance-tests) |
| 6 | Error Handling | Edge Cases, Performance (90 tests) | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/error-handling-tests) |
| 7 | API Tests | Account & Customer Endpoints (36 tests) | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/api-tests) |
| 8 | Infrastructure | Jest Config, Documentation | [Create](https://github.com/Onyx2406/ILF-PROJECT/compare/main...feature/test-infrastructure) |

## 🎯 PR Templates

### Use this template for each PR:

```markdown
## 🧪 [Test Suite Name] Test Suite

### Overview
Brief description of what this test suite covers.

### Test Coverage
- ✅ [X] test cases
- ✅ [Feature 1]
- ✅ [Feature 2]
- ✅ [Feature 3]

### Key Features
- Feature highlights
- Edge cases covered
- Performance considerations

### Files Added/Modified
- `path/to/test/file.test.ts` - New test file ([X] tests)

### How to Run
```bash
cd banking-microservices/core-banking-service
npm test path/to/test/file.test.ts
```

### Related Issues
Closes #[issue-number] (if applicable)
```

## 🔧 Troubleshooting

### If authentication fails:
1. **Token method**: Make sure token has `repo` scope
2. **SSH method**: Verify key is added to GitHub
3. **CLI method**: Run `gh auth status` to check

### If push fails:
```bash
# Check remote
git remote -v

# Verify branches
git branch -a

# Check git status
git status
```

## ✅ After Successful Push

1. ✅ All 8 branches will be on GitHub
2. ✅ Create PRs using the provided links
3. ✅ Add labels: `enhancement`, `testing`, `security`
4. ✅ Request reviews from team members
5. ✅ Merge after approval

---

**Ready to push 289 test cases across 8 comprehensive test suites! 🚀**
