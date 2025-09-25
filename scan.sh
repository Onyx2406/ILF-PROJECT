#!/bin/bash
# Security Scan Script for ILF-PROJECT
# Generates:
#   1) CodeQL SAST report (codeql.sarif)
#   2) Semgrep SAST + Secrets report (semgrep.sarif)
#   3) CycloneDX SBOM (sbom.json)
#   4) Grype SCA report (grype.sarif)

set -euo pipefail

# --- Configuration ---
declare -a repoUrlsArray=(
  "https://github.com/sohaib1083/ILF-PROJECT"
)

declare securityOutputs="$PWD/security-outputs"
declare repoDirName="scanned-repo"

# --- Helpers ---
is_root() { [ "${EUID:-$(id -u)}" -eq 0 ]; }
SUDO=""
if ! is_root; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "WARNING: Not running as root and 'sudo' is unavailable. Permission fixes may fail." >&2
    SUDO=""
  fi
fi

cleanup() {
  set +e
  if [ -n "${baseDir:-}" ]; then cd "$baseDir" 2>/dev/null || true; fi
  if [ -n "${repoDir:-}" ] && [ -d "$repoDir" ]; then rm -rf "$repoDir" 2>/dev/null || true; fi
  if [ -d "db" ]; then rm -rf db 2>/dev/null || true; fi
}
trap cleanup EXIT

# --- Environment / Tooling ---
export PATH=$PATH:/opt/codeql

if [ ! -d "/opt/codeql" ]; then
  echo "ERROR: /opt/codeql not found. Please install CodeQL or adjust the path." >&2
  exit 1
fi

# Warn if noexec mount blocks execution even when +x is set
if mount | grep -E " on (/opt|/) " | grep -q "noexec"; then
  echo "WARNING: Detected 'noexec' on /opt or /. Executables under /opt may not run." >&2
  echo "         Remount without noexec or move CodeQL to /usr/local." >&2
fi

# Fix CodeQL main binary permission
if [ -f "/opt/codeql/codeql" ] && [ ! -x "/opt/codeql/codeql" ]; then
  echo "Fixing CodeQL launcher permissions..."
  $SUDO chmod +x /opt/codeql/codeql || true
fi

# Fix ALL helper/tool permissions (covers scc, mktool, java, etc.)
if [ -d "/opt/codeql/tools" ]; then
  echo "Fixing all CodeQL helper permissions..."
  $SUDO find /opt/codeql/tools -type f -exec chmod +x {} \; || true
fi

# Preflight: prove helpers are runnable (scc is required by database create)
if [ -x /opt/codeql/tools/linux64/scc ]; then
  if ! /opt/codeql/tools/linux64/scc --version >/dev/null 2>&1; then
    echo "ERROR: /opt/codeql/tools/linux64/scc exists but cannot run (noexec or incompatible binary)." >&2
    exit 1
  fi
else
  echo "Attempting to fix scc permission..."
  ($SUDO chmod +x /opt/codeql/tools/linux64/scc 2>/dev/null || true)
  if ! /opt/codeql/tools/linux64/scc --version >/dev/null 2>&1; then
    echo "ERROR: scc still not runnable. Check filesystem mount options (noexec) or reinstall CodeQL under /usr/local." >&2
    exit 1
  fi
fi

# Verify CodeQL is available
if ! command -v codeql >/dev/null 2>&1; then
  echo "ERROR: CodeQL is not available in PATH."
  echo "Add to shell rc or export here: export PATH=\$PATH:/opt/codeql"
  exit 1
fi

echo "Starting security scan for ILF-PROJECT..."

# Check available disk space (need at least ~2GB free)
AVAILABLE_SPACE=$(df /home 2>/dev/null | tail -1 | awk '{print $4}')
if [ -n "${AVAILABLE_SPACE:-}" ] && [ "$AVAILABLE_SPACE" -lt 2097152 ]; then
  echo "WARNING: Low disk space detected. Available: $(($AVAILABLE_SPACE / 1024))MB"
  echo "         CodeQL may fail. Consider freeing up space."
fi

# Prepare outputs dir
mkdir -p "$securityOutputs"

# --- Main Loop ---
for repoUrl in "${repoUrlsArray[@]}"; do
  repoName=$(basename "$repoUrl" .git)
  baseDir=$PWD
  repoDir="$baseDir/$repoDirName"

  echo -e "\n*********** STARTING SCAN FOR REPO: $repoName ***********"

  # Fresh clone
  if [ -d "$repoDir" ]; then
    echo "Directory $repoDir exists - removing it."
    rm -rf "$repoDir"
  fi

  echo "Cloning repository: $repoUrl"
  git clone --depth 1 "$repoUrl" "$repoDir"

  cd "$repoDir"

  # ---------- choose best source roots ----------
  # Detect project structure and choose appropriate roots
  ROOT_A="."
  ROOT_B="packages"
  
  # Check for common monorepo structures
  if [ -f "pnpm-workspace.yaml" ] || [ -f "pnpm-workspace.yml" ]; then
    echo "Detected pnpm workspace"
    ROOT_B="packages"
  elif [ -f "lerna.json" ]; then
    echo "Detected Lerna monorepo"
    ROOT_B="packages"
  elif [ -f "nx.json" ]; then
    echo "Detected Nx workspace"
    ROOT_B="apps"
    [ -d "libs" ] && ROOT_C="libs"
  elif [ -d "packages" ]; then
    echo "Detected packages directory"
    ROOT_B="packages"
  else
    echo "Single package project detected"
    ROOT_B="."
  fi
  
  # Ensure ROOT_B exists
  [ -d "$ROOT_B" ] || ROOT_B="."

  # Count JS/TS files under each root (for logs & sanity)
  COUNT_A=$(find "$ROOT_A" -maxdepth 3 -type f \( -iname "*.ts" -o -iname "*.tsx" -o -iname "*.js" -o -iname "*.jsx" \) 2>/dev/null | wc -l || echo 0)
  COUNT_B=$(find "$ROOT_B" -maxdepth 5 -type f \( -iname "*.ts" -o -iname "*.tsx" -o -iname "*.js" -o -iname "*.jsx" \) 2>/dev/null | wc -l || echo 0)
  echo "JS/TS file count: root=$COUNT_A, $ROOT_B=$COUNT_B"

  # Helper to run a single CodeQL attempt on a given source root
  run_codeql_create_and_analyze () {
    local SRC_ROOT="$1"
    echo "Attempting CodeQL on source-root: $SRC_ROOT"
    # Clean any previous DB
    [ -d db ] && rm -rf db

    # If no JS/TS under this root, bail fast
    if ! find "$SRC_ROOT" -type f \( -iname "*.ts" -o -iname "*.tsx" -o -iname "*.js" -o -iname "*.jsx" \) -print -quit | grep -q .; then
      echo "No JS/TS files under $SRC_ROOT"
      return 1
    fi

    # Prepare build environment for pnpm monorepo
    echo "Setting up build environment..."
    
    # Setup Node.js version using NVM if available
    echo "Setting up Node.js environment..."
    
    # Function to source NVM properly
    setup_nvm() {
      # Try multiple common NVM locations (including original user's home if running as root)
      local nvm_locations=(
        "$HOME/.nvm/nvm.sh"
        "/home/yash/.nvm/nvm.sh"
        "/usr/local/nvm/nvm.sh"
      )
      
      # Add NVM_DIR location if it's set
      [ -n "${NVM_DIR:-}" ] && nvm_locations+=("$NVM_DIR/nvm.sh")
      
      for nvm_path in "${nvm_locations[@]}"; do
        if [ -s "$nvm_path" ]; then
          echo "Sourcing NVM from: $nvm_path"
          export NVM_DIR="$(dirname "$nvm_path")"
          . "$nvm_path"
          # Also load bash completion if available
          [ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
          return 0
        fi
      done
      return 1
    }
    
    # Try to setup NVM
    if setup_nvm; then
      echo "NVM loaded successfully"
      
      # Check if .nvmrc exists and use it
      if [ -f ".nvmrc" ]; then
        echo "Found .nvmrc file, attempting to use correct Node.js version..."
        REQUIRED_VERSION=$(cat .nvmrc | tr -d '[:space:]')
        echo "Required version from .nvmrc: $REQUIRED_VERSION"
        
        # Try to use the version
        if nvm use "$REQUIRED_VERSION" 2>/dev/null; then
          echo "Successfully switched to Node.js version: $(node --version 2>/dev/null)"
        else
          echo "Version not installed, attempting to install: $REQUIRED_VERSION"
          if nvm install "$REQUIRED_VERSION" 2>/dev/null; then
            echo "Successfully installed and switched to Node.js version: $(node --version 2>/dev/null)"
          else
            echo "WARNING: Failed to install required Node.js version from .nvmrc"
          fi
        fi
      elif [ -f "package.json" ] && grep -q '"node"' package.json; then
        # Try to extract Node version from package.json engines
        REQUIRED_NODE=$(grep -o '"node"[[:space:]]*:[[:space:]]*"[^"]*"' package.json | sed 's/.*"node"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | sed 's/[^0-9].*//')
        if [ -n "$REQUIRED_NODE" ]; then
          echo "Found Node.js requirement in package.json: v$REQUIRED_NODE"
          
          if nvm use "$REQUIRED_NODE" 2>/dev/null || nvm install "$REQUIRED_NODE" 2>/dev/null; then
            echo "Successfully switched to Node.js version: $(node --version 2>/dev/null)"
          else
            echo "WARNING: Failed to install required Node.js version v$REQUIRED_NODE"
          fi
        fi
      fi
    else
      echo "NVM not found or not properly installed"
      
      # Special handling if running as root
      if [ "$(id -u)" -eq 0 ]; then
        echo ""
        echo "⚠️  WARNING: Running as root user!"
        echo "NVM is typically installed per-user. Consider running as the original user:"
        echo "  sudo -u yash bash ./scan.sh"
        echo ""
        echo "Or install Node.js system-wide:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        echo ""
      fi
      
      # Check if we can find a newer Node.js version manually
      for node_path in "/usr/local/bin/node" "/opt/node/bin/node" "$HOME/.local/bin/node" "/home/yash/.local/bin/node"; do
        if [ -x "$node_path" ]; then
          NODE_VER=$("$node_path" --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
          if [ -n "$NODE_VER" ] && [ "$NODE_VER" -ge 18 ]; then
            echo "Found compatible Node.js at: $node_path ($(\"$node_path\" --version))"
            export PATH="$(dirname "$node_path"):$PATH"
            break
          fi
        fi
      done
    fi
    
    # Check Node.js version compatibility
    NODE_VERSION=""
    if command -v node >/dev/null 2>&1; then
      NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
      echo "Current Node.js version: $(node --version 2>/dev/null || echo 'unknown')"
      
      if [ -n "$NODE_VERSION" ] && [ "$NODE_VERSION" -lt 14 ]; then
        echo "WARNING: Node.js version is still too old (< 14). TypeScript compilation may fail."
        echo ""
        echo "To fix this manually, run these commands:"
        echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        echo "  source ~/.bashrc"
        echo "  nvm install lts/iron"
        echo "  nvm use lts/iron"
        echo ""
        echo "Then re-run this script."
        echo ""
      elif [ -n "$NODE_VERSION" ] && [ "$NODE_VERSION" -ge 18 ]; then
        echo "✓ Node.js version is compatible for this project (v$NODE_VERSION)"
      elif [ -n "$NODE_VERSION" ]; then
        echo "⚠ Node.js version may work but is not optimal (v$NODE_VERSION, recommended: v20+)"
      fi
    fi

    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
      echo "Installing dependencies..."
      
      # Enable corepack if available (for pnpm)
      if command -v corepack >/dev/null 2>&1; then
        echo "Enabling corepack for package manager support..."
        corepack enable 2>/dev/null || echo "Warning: corepack enable failed"
      fi
      
      # Check for lockfiles to determine package manager
      if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
        echo "Using pnpm (lockfile detected)..."
        pnpm install --frozen-lockfile --ignore-scripts --reporter=silent || echo "Warning: pnpm install failed, continuing..."
      elif [ -f "yarn.lock" ] && command -v yarn >/dev/null 2>&1; then
        echo "Using yarn (lockfile detected)..."
        yarn install --frozen-lockfile --ignore-scripts --silent || echo "Warning: yarn install failed, continuing..."
      elif [ -f "package-lock.json" ] && command -v npm >/dev/null 2>&1; then
        echo "Using npm (lockfile detected)..."
        npm ci --ignore-scripts --silent || echo "Warning: npm install failed, continuing..."
      elif command -v pnpm >/dev/null 2>&1; then
        echo "Using pnpm (fallback)..."
        pnpm install --ignore-scripts --reporter=silent || echo "Warning: pnpm install failed, continuing..."
      elif command -v npm >/dev/null 2>&1; then
        echo "Using npm (fallback)..."
        npm install --ignore-scripts --silent || echo "Warning: npm install failed, continuing..."
      else
        echo "No package manager available, skipping dependency installation..."
        echo "Consider installing Node.js and npm/pnpm first."
      fi
    fi

    set +e
    # Try with build command first (for TypeScript projects)
    # Skip build if Node.js is too old to avoid compatibility issues
    if [ -f "package.json" ] && grep -q '"build"' package.json && [ -n "$NODE_VERSION" ] && [ "$NODE_VERSION" -ge 14 ]; then
      echo "Attempting CodeQL with build command..."
      
      # Determine the appropriate build command
      BUILD_CMD=""
      if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
        BUILD_CMD="pnpm build"
      elif [ -f "yarn.lock" ] && command -v yarn >/dev/null 2>&1; then
        BUILD_CMD="yarn build"
      elif command -v npm >/dev/null 2>&1; then
        BUILD_CMD="npm run build"
      else
        BUILD_CMD="echo 'No package manager available for build'"
      fi
      
      echo "Using build command: $BUILD_CMD"
      
      if timeout 600 codeql database create db \
            --language=javascript \
            --source-root "$SRC_ROOT" \
            --command="bash -c '$BUILD_CMD || echo Build failed, continuing...'" \
            --ram=2048 \
            --overwrite; then
        echo "CodeQL database created with build command (source-root=$SRC_ROOT)"
      else
        echo "Build command failed, trying without build..."
        # Fallback to no-build mode
        if timeout 600 codeql database create db \
              --language=javascript \
              --source-root "$SRC_ROOT" \
              --build-mode=none \
              --ram=2048 \
              --overwrite; then
          echo "CodeQL database created without build (source-root=$SRC_ROOT)"
        else
          echo "WARNING: Database create failed on $SRC_ROOT"
          set -e
          return 1
        fi
      fi
    else
      # No build script or Node.js too old, use no-build mode
      if [ -f "package.json" ] && grep -q '"build"' package.json; then
        echo "Skipping build due to Node.js version compatibility (detected v$NODE_VERSION, need >= 14)"
      fi
      # For no-build mode, help CodeQL find source files
      echo "Preparing source files for CodeQL analysis..."
      
      # Create a comprehensive tsconfig.json for better TypeScript analysis
      if find "$SRC_ROOT" -name "*.ts" -o -name "*.tsx" | head -1 | grep -q .; then
        echo "Creating comprehensive tsconfig.json for CodeQL..."
        cat > codeql-tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "commonjs",
    "lib": ["ES2018", "DOM"],
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": false,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": false,
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false,
    "removeComments": false,
    "noImplicitAny": false,
    "noImplicitReturns": false,
    "noImplicitThis": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "**/*.test.*",
    "**/*.spec.*",
    "**/test/**",
    "**/tests/**"
  ]
}
EOF
        
        # Also create a simple package.json if it doesn't exist to help with module resolution
        if [ ! -f "package.json" ]; then
          echo "Creating minimal package.json for CodeQL..."
          cat > package.json << 'EOF'
{
  "name": "codeql-analysis",
  "version": "1.0.0",
  "type": "commonjs"
}
EOF
        fi
      fi
      
      # List some source files for debugging
      echo "Source files found in $SRC_ROOT:"
      find "$SRC_ROOT" -maxdepth 2 -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -10 || echo "No source files found"
      
      # Use additional CodeQL options for better source file detection
      CODEQL_OPTS=""
      if [ -f "codeql-tsconfig.json" ]; then
        CODEQL_OPTS="--extractor-option=typescript.tsconfig=codeql-tsconfig.json"
      fi
      
      if timeout 600 codeql database create db \
            --language=javascript \
            --source-root "$SRC_ROOT" \
            --build-mode=none \
            --ram=2048 \
            --overwrite \
            $CODEQL_OPTS; then
        echo "CodeQL database created (source-root=$SRC_ROOT)"
      else
        echo "WARNING: Database create failed on $SRC_ROOT"
        set -e
        return 1
      fi
    fi
    
    # Analyze the database
    echo "Analyzing CodeQL database..."
    
    # Try to find available query suites
    QUERY_SUITE=""
    if [ -d "/opt/codeql/qlpacks/codeql/javascript-queries" ]; then
      # Find the most recent version
      LATEST_VERSION=$(ls -1 /opt/codeql/qlpacks/codeql/javascript-queries/ | sort -V | tail -1)
      if [ -n "$LATEST_VERSION" ]; then
        SECURITY_SUITE="/opt/codeql/qlpacks/codeql/javascript-queries/$LATEST_VERSION/codeql-suites/javascript-security-and-quality.qls"
        EXTENDED_SUITE="/opt/codeql/qlpacks/codeql/javascript-queries/$LATEST_VERSION/codeql-suites/javascript-security-extended.qls"
        
        # Check which suite exists
        if [ -f "$SECURITY_SUITE" ]; then
          QUERY_SUITE="$SECURITY_SUITE"
        elif [ -f "$EXTENDED_SUITE" ]; then
          QUERY_SUITE="$EXTENDED_SUITE"
        fi
      fi
    fi
    
    # Fallback to hardcoded path if auto-detection fails
    if [ -z "$QUERY_SUITE" ]; then
      QUERY_SUITE="/opt/codeql/qlpacks/codeql/javascript-queries/2.0.1/codeql-suites/javascript-security-and-quality.qls"
    fi
    
    echo "Using query suite: $QUERY_SUITE"
    
    if timeout 900 codeql database analyze db \
          "$QUERY_SUITE" \
          --format=sarif-latest \
          --output=codeql.sarif \
          --ram=2048; then
      echo "CodeQL analysis completed."
      set -e
      return 0
    else
      echo "WARNING: Analysis failed; trying with reduced memory..."
      if timeout 600 codeql database analyze db \
            "$QUERY_SUITE" \
            --format=sarif-latest \
            --output=codeql.sarif \
            --ram=1024; then
        echo "CodeQL analysis completed (reduced memory)."
        set -e
        return 0
      else
        echo "WARNING: Analysis failed on $SRC_ROOT"
        set -e
        return 1
      fi
    fi
  }

  # --- 1) SAST (CodeQL) ---
  echo -e "\n--- Running SAST scan (CodeQL) ---"
  echo "Creating CodeQL database (tries: packages/ then repo root)..."

  if run_codeql_create_and_analyze "$ROOT_B"; then
    echo "CodeQL succeeded with source-root: $ROOT_B"
  elif run_codeql_create_and_analyze "$ROOT_A"; then
    echo "CodeQL succeeded with source-root: $ROOT_A"
  else
    echo "WARNING: CodeQL failed to process JS/TS in both roots, creating empty SARIF."
    : > codeql.sarif
  fi

  # --- 2) Additional SAST + Secrets (Semgrep) ---
  echo -e "\n--- Running SAST + Secrets scan (Semgrep) ---"
  echo "Running Semgrep with timeout (3 minutes)..."
  set +e
  if timeout 180 semgrep scan --config=p/security-audit --config=p/secrets --sarif --output semgrep.sarif . --no-git-ignore; then
    echo "Semgrep scan completed successfully."
  else
    echo "WARNING: Semgrep with security rules failed, trying basic config..."
    if timeout 120 semgrep scan --config=p/javascript --sarif --output semgrep.sarif . --no-git-ignore; then
      echo "Semgrep scan completed with basic rules."
    else
      echo "WARNING: All Semgrep attempts failed, creating empty SARIF file"
      : > semgrep.sarif
    fi
  fi
  set -e

  # --- 3) SBOM + CVE / License (Syft → Grype) ---
  echo -e "\n--- Running SBOM, Dependency, and License Scans ---"
  set +e
  if syft dir:. -o cyclonedx-json=sbom.json; then
    echo "SBOM creation completed successfully."
    if grype sbom:sbom.json -o sarif > grype.sarif; then
      echo "Grype scan completed successfully."
    else
      echo "WARNING: Grype scan failed, creating empty SARIF file"
      : > grype.sarif
    fi
  else
    echo "WARNING: SBOM creation failed, creating empty files"
    : > sbom.json
    : > grype.sarif
  fi
  set -e

  # --- 4) Package Results ---
  echo -e "\n--- Packaging and Cleaning up ---"
  tar -czf "$repoName-scan.tar.gz" codeql.sarif semgrep.sarif sbom.json grype.sarif
  mv "$repoName-scan.tar.gz" "$securityOutputs/"
  echo "Results moved to $securityOutputs/"

  # --- Cleanup per-repo ---
  cd "$baseDir"
  echo "Cleaning up temporary files..."
  rm -rf "$repoDir"
  if [ -d "db" ]; then rm -rf db; fi
  
  # Clean up any temporary config files we created
  if [ -f "$repoDir/codeql-tsconfig.json" ]; then rm -f "$repoDir/codeql-tsconfig.json"; fi

  echo -e "*********** COMPLETED SCAN FOR REPO: $repoName ***********"
done

echo -e "\n\n=== ALL SCANS COMPLETED! ==="
echo "All reports are in: $securityOutputs"
