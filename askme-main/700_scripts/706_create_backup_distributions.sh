#!/bin/bash
# Multiple Format Distribution Creator

set -e

VERSION=${1:-"1.0.0"}
SOURCE_DIR=${2:-"300_implementation/askme-cli/cliApp/build/install/cliApp"}

log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

main() {
    log "Creating multiple distribution formats for v$VERSION"
    
    if [[ ! -d "$SOURCE_DIR" ]]; then
        log "ERROR: Source directory not found: $SOURCE_DIR"
        exit 1
    fi
    
    # Create distributions directory
    mkdir -p distributions
    
    # 1. Standard tar.gz (as backup)
    log "Creating tar.gz distribution..."
    tar -czf "distributions/askme-cli-backup-v$VERSION.tar.gz" -C "$SOURCE_DIR/.." "$(basename "$SOURCE_DIR")"
    
    # 2. Zip format for Windows compatibility
    log "Creating zip distribution..."
    (cd "$SOURCE_DIR/.." && zip -r "../../distributions/askme-cli-backup-v$VERSION.zip" "$(basename "$SOURCE_DIR")")
    
    # 3. Self-extracting script
    log "Creating self-extracting distribution..."
    cat > "distributions/askme-cli-installer-v$VERSION.sh" << 'EOF'
#!/bin/bash
# AskMe CLI Self-Extracting Installer

set -e

VERSION="VERSION_PLACEHOLDER"
ARCHIVE_START_LINE=__ARCHIVE_LINE__

echo "AskMe CLI v$VERSION Self-Extracting Installer"
echo "=============================================="

# Extract archive
tail -n +$ARCHIVE_START_LINE "$0" | tar -xzf -

# Make executable
chmod +x cliApp/bin/cliApp

echo ""
echo "Installation complete!"
echo "To run: ./cliApp/bin/cliApp \"Your question here\""
echo ""

exit 0

__ARCHIVE_BELOW__
EOF
    
    # Replace placeholders
    sed -i "s/VERSION_PLACEHOLDER/$VERSION/g" "distributions/askme-cli-installer-v$VERSION.sh"
    
    # Calculate archive start line
    ARCHIVE_LINE=$(grep -n "^__ARCHIVE_BELOW__$" "distributions/askme-cli-installer-v$VERSION.sh" | cut -d: -f1)
    ARCHIVE_LINE=$((ARCHIVE_LINE + 1))
    sed -i "s/__ARCHIVE_LINE__/$ARCHIVE_LINE/g" "distributions/askme-cli-installer-v$VERSION.sh"
    
    # Remove the marker and append the archive
    sed -i '/^__ARCHIVE_BELOW__$/d' "distributions/askme-cli-installer-v$VERSION.sh"
    tar -czf - -C "$SOURCE_DIR/.." "$(basename "$SOURCE_DIR")" >> "distributions/askme-cli-installer-v$VERSION.sh"
    
    chmod +x "distributions/askme-cli-installer-v$VERSION.sh"
    
    # 4. Repository-embedded distribution
    log "Creating repository-embedded distribution..."
    mkdir -p "distributions/embedded"
    cp -r "$SOURCE_DIR" "distributions/embedded/askme-cli"
    
    # Add integration script
    cat > "distributions/embedded/install-from-repo.sh" << EOF
#!/bin/bash
# Install AskMe CLI from Repository

set -e

REPO_URL="https://github.com/vn6295337/askme.git"
INSTALL_DIR="\$HOME/.askme-cli"

echo "Installing AskMe CLI from repository..."

# Clone if not exists
if [[ ! -d "\$INSTALL_DIR" ]]; then
    git clone "\$REPO_URL" "\$INSTALL_DIR"
else
    cd "\$INSTALL_DIR"
    git pull origin main
fi

# Check for pre-built distribution
if [[ -f "\$INSTALL_DIR/askme-distribution-backup-$VERSION.tar.gz" ]]; then
    echo "Found pre-built distribution, using it..."
    cd "\$INSTALL_DIR"
    tar -xzf "askme-distribution-backup-$VERSION.tar.gz"
    chmod +x askme-cli/bin/cliApp
    
    # Create symlink
    ln -sf "\$INSTALL_DIR/askme-cli/bin/cliApp" "\$HOME/.local/bin/askme" 2>/dev/null || true
    
    echo "Installation complete!"
    echo "Run: askme 'Your question here'"
else
    echo "Building from source..."
    cd "\$INSTALL_DIR/300_implementation/askme-cli"
    chmod +x gradlew
    ./gradlew cliApp:installDist
    
    # Create symlink
    ln -sf "\$INSTALL_DIR/300_implementation/askme-cli/cliApp/build/install/cliApp/bin/cliApp" "\$HOME/.local/bin/askme" 2>/dev/null || true
    
    echo "Build and installation complete!"
    echo "Run: askme 'Your question here'"
fi
EOF
    
    chmod +x "distributions/embedded/install-from-repo.sh"
    
    # 5. Docker-based distribution
    log "Creating Docker-based distribution..."
    cat > "distributions/Dockerfile" << EOF
FROM openjdk:17-jdk-slim

LABEL maintainer="askme-cli"
LABEL version="$VERSION"

# Install required packages
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy application
COPY cliApp/ ./

# Make script executable
RUN chmod +x bin/cliApp

# Create entrypoint
ENTRYPOINT ["./bin/cliApp"]
EOF
    
    # Copy CLI for Docker
    cp -r "$SOURCE_DIR" "distributions/cliApp"
    
    # Create checksums for all distributions
    log "Generating checksums for all distributions..."
    cd distributions
    find . -name "*.tar.gz" -o -name "*.zip" -o -name "*.sh" | xargs -I {} sh -c 'sha256sum "{}" > "{}.sha256"'
    
    # Create distribution index
    cat > "DISTRIBUTIONS.md" << EOF
# AskMe CLI v$VERSION - Distribution Options

This directory contains multiple distribution formats for maximum compatibility:

## 1. Standard Archive Formats

### tar.gz (Recommended for Linux/macOS)
\`\`\`bash
curl -L -O https://github.com/vn6295337/askme/raw/main/distributions/askme-cli-backup-v$VERSION.tar.gz
tar -xzf askme-cli-backup-v$VERSION.tar.gz
chmod +x cliApp/bin/cliApp
./cliApp/bin/cliApp "Your question here"
\`\`\`

### ZIP (Windows Compatible)
\`\`\`bash
curl -L -O https://github.com/vn6295337/askme/raw/main/distributions/askme-cli-backup-v$VERSION.zip
unzip askme-cli-backup-v$VERSION.zip
chmod +x cliApp/bin/cliApp
./cliApp/bin/cliApp "Your question here"
\`\`\`

## 2. Self-Extracting Installer
\`\`\`bash
curl -L -O https://github.com/vn6295337/askme/raw/main/distributions/askme-cli-installer-v$VERSION.sh
chmod +x askme-cli-installer-v$VERSION.sh
./askme-cli-installer-v$VERSION.sh
\`\`\`

## 3. Repository-Based Installation
\`\`\`bash
curl -fsSL https://github.com/vn6295337/askme/raw/main/distributions/embedded/install-from-repo.sh | bash
\`\`\`

## 4. Docker-Based Usage
\`\`\`bash
# Clone repository
git clone https://github.com/vn6295337/askme.git
cd askme/distributions

# Build image
docker build -t askme-cli:v$VERSION .

# Run
docker run --rm askme-cli:v$VERSION "Your question here"
\`\`\`

## Integrity Verification

Each distribution includes SHA256 checksums. Always verify before use:

\`\`\`bash
# For tar.gz
sha256sum -c askme-cli-backup-v$VERSION.tar.gz.sha256

# For zip
sha256sum -c askme-cli-backup-v$VERSION.zip.sha256

# For self-extracting
sha256sum -c askme-cli-installer-v$VERSION.sh.sha256
\`\`\`

## Distribution Sizes

EOF
    
    # Add file sizes to documentation
    for file in *.tar.gz *.zip *.sh; do
        if [[ -f "$file" ]]; then
            size=$(du -h "$file" | cut -f1)
            echo "- $file: $size" >> "DISTRIBUTIONS.md"
        fi
    done
    
    cd ..
    
    log "✅ Multiple distribution formats created successfully"
    log "📁 Available in: distributions/"
    log "📄 Documentation: distributions/DISTRIBUTIONS.md"
}

main "$@"