#!/bin/bash
# Setup Fallback Distribution System

set -e

VERSION=${1:-"1.0.0"}

log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

setup_github_pages() {
    log "Setting up GitHub Pages for distribution hosting..."
    
    # Create docs directory for GitHub Pages
    mkdir -p docs/distributions
    
    # Copy distributions to docs
    if [[ -d "distributions" ]]; then
        cp -r distributions/* docs/distributions/
    fi
    
    # Create index page
    cat > docs/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>AskMe CLI Distributions</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .download-link { display: block; margin: 10px 0; padding: 10px; background: #f0f0f0; text-decoration: none; color: #333; }
        .download-link:hover { background: #e0e0e0; }
        .checksum { font-family: monospace; font-size: 0.8em; color: #666; }
    </style>
</head>
<body>
    <h1>AskMe CLI v$VERSION - Alternative Download Links</h1>
    <p>If GitHub releases are unavailable, use these alternative download links:</p>
    
    <h2>Direct Downloads</h2>
    <a href="distributions/askme-cli-backup-v$VERSION.tar.gz" class="download-link">
        📦 askme-cli-backup-v$VERSION.tar.gz
    </a>
    <a href="distributions/askme-cli-backup-v$VERSION.zip" class="download-link">
        📦 askme-cli-backup-v$VERSION.zip
    </a>
    <a href="distributions/askme-cli-installer-v$VERSION.sh" class="download-link">
        🚀 askme-cli-installer-v$VERSION.sh (Self-Extracting)
    </a>
    
    <h2>One-Line Installation</h2>
    <pre><code>curl -fsSL https://yourusername.github.io/askme/distributions/embedded/install-from-repo.sh | bash</code></pre>
    
    <h2>Verification</h2>
    <p>Always verify downloads with checksums:</p>
    <pre><code>sha256sum -c askme-cli-backup-v$VERSION.tar.gz.sha256</code></pre>
    
    <h2>Repository Backup</h2>
    <p>As a last resort, build from source:</p>
    <pre><code>git clone https://github.com/vn6295337/askme.git
cd askme/300_implementation/askme-cli
chmod +x gradlew
./gradlew cliApp:installDist
./cliApp/build/install/cliApp/bin/cliApp "Your question"</code></pre>
    
    <hr>
    <p><small>Generated automatically on $(date)</small></p>
</body>
</html>
EOF
    
    log "✅ GitHub Pages setup complete"
}

setup_cdn_mirrors() {
    log "Setting up CDN mirror configuration..."
    
    # Create mirror configuration
    cat > "distributions/MIRRORS.txt" << EOF
# AskMe CLI v$VERSION - Mirror Links

## Primary Sources
- GitHub Releases: https://github.com/vn6295337/askme/releases/tag/v$VERSION
- GitHub Pages: https://yourusername.github.io/askme/
- Repository Raw: https://github.com/vn6295337/askme/raw/main/

## CDN Mirrors (Configure as needed)
- jsDelivr: https://cdn.jsdelivr.net/gh/vn6295337/askme@main/distributions/
- GitHack: https://raw.githack.com/vn6295337/askme/main/distributions/
- Statically: https://cdn.statically.io/gh/vn6295337/askme/main/distributions/

## Self-Hosted Options
- Upload to your own server
- Use cloud storage (AWS S3, Google Cloud Storage)
- Set up your own CDN

## Download Commands for Each Mirror

### jsDelivr
curl -L -O https://cdn.jsdelivr.net/gh/vn6295337/askme@main/distributions/askme-cli-backup-v$VERSION.tar.gz

### GitHack
curl -L -O https://raw.githack.com/vn6295337/askme/main/distributions/askme-cli-backup-v$VERSION.tar.gz

### Statically
curl -L -O https://cdn.statically.io/gh/vn6295337/askme/main/distributions/askme-cli-backup-v$VERSION.tar.gz
EOF
    
    log "✅ CDN mirror configuration created"
}

main() {
    log "Setting up fallback distribution system for v$VERSION"
    
    setup_github_pages
    setup_cdn_mirrors
    
    # Create comprehensive download script
    cat > "DOWNLOAD_ASKME.sh" << 'EOF'
#!/bin/bash
# AskMe CLI Universal Downloader with Fallback

set -e

VERSION="VERSION_PLACEHOLDER"
DOWNLOAD_DIR="askme-cli-download"

log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

try_download() {
    local url="$1"
    local output="$2"
    local description="$3"
    
    log "Trying $description: $url"
    
    if curl -fsSL --connect-timeout 10 --max-time 30 "$url" -o "$output"; then
        if [[ -f "$output" ]] && [[ $(stat -c%s "$output") -gt 1000 ]]; then
            log "✅ Successfully downloaded from $description"
            return 0
        else
            log "❌ Downloaded file is too small or corrupted"
            rm -f "$output"
            return 1
        fi
    else
        log "❌ Failed to download from $description"
        return 1
    fi
}

main() {
    log "AskMe CLI Universal Downloader v$VERSION"
    log "========================================"
    
    mkdir -p "$DOWNLOAD_DIR"
    cd "$DOWNLOAD_DIR"
    
    # Define download sources in order of preference
    declare -a SOURCES=(
        "https://github.com/vn6295337/askme/releases/download/v$VERSION/askme-cli-v$VERSION.tar.gz|GitHub Releases"
        "https://github.com/vn6295337/askme/raw/main/distributions/askme-cli-backup-v$VERSION.tar.gz|GitHub Raw"
        "https://cdn.jsdelivr.net/gh/vn6295337/askme@main/distributions/askme-cli-backup-v$VERSION.tar.gz|jsDelivr CDN"
        "https://raw.githack.com/vn6295337/askme/main/distributions/askme-cli-backup-v$VERSION.tar.gz|GitHack CDN"
        "https://cdn.statically.io/gh/vn6295337/askme/main/distributions/askme-cli-backup-v$VERSION.tar.gz|Statically CDN"
    )
    
    ARCHIVE_NAME="askme-cli-v$VERSION.tar.gz"
    DOWNLOADED=false
    
    # Try each source
    for source in "${SOURCES[@]}"; do
        IFS='|' read -r url description <<< "$source"
        
        if try_download "$url" "$ARCHIVE_NAME" "$description"; then
            DOWNLOADED=true
            break
        fi
        
        sleep 2  # Brief pause between attempts
    done
    
    # If all sources fail, try building from source
    if [[ "$DOWNLOADED" != true ]]; then
        log "All download sources failed, trying to build from source..."
        
        if command -v git >/dev/null 2>&1; then
            log "Cloning repository..."
            git clone https://github.com/vn6295337/askme.git askme-source
            cd askme-source
            
            # Check for pre-built backup
            if [[ -f "askme-distribution-backup-$VERSION.tar.gz" ]]; then
                log "Found pre-built backup in repository"
                cp "askme-distribution-backup-$VERSION.tar.gz" "../$ARCHIVE_NAME"
                cd ..
                DOWNLOADED=true
            else
                log "Building from source..."
                cd 300_implementation/askme-cli
                
                if [[ -f "gradlew" ]]; then
                    chmod +x gradlew
                    ./gradlew cliApp:installDist
                    
                    # Create archive
                    cd ../..
                    tar -czf "$ARCHIVE_NAME" -C "300_implementation/askme-cli/cliApp/build/install" cliApp
                    cp "$ARCHIVE_NAME" "../$ARCHIVE_NAME"
                    cd ..
                    DOWNLOADED=true
                else
                    log "❌ Gradle wrapper not found"
                fi
            fi
        else
            log "❌ Git not available for source build"
        fi
    fi
    
    if [[ "$DOWNLOADED" == true ]]; then
        log "Extracting archive..."
        tar -xzf "$ARCHIVE_NAME"
        
        # Find extracted directory
        EXTRACTED_DIR=$(find . -name "cliApp" -type d | head -1)
        if [[ -n "$EXTRACTED_DIR" ]]; then
            chmod +x "$EXTRACTED_DIR/bin/cliApp"
            log "✅ AskMe CLI ready!"
            log "To use: ./$EXTRACTED_DIR/bin/cliApp 'Your question here'"
        else
            log "❌ Extracted directory not found"
            exit 1
        fi
    else
        log "❌ All download methods failed"
        exit 1
    fi
}

main "$@"
EOF
    
    # Replace version placeholder
    sed -i "s/VERSION_PLACEHOLDER/$VERSION/g" "DOWNLOAD_ASKME.sh"
    chmod +x "DOWNLOAD_ASKME.sh"
    
    log "✅ Fallback distribution system setup complete"
    log "📁 Files created:"
    log "   - docs/index.html (GitHub Pages)"
    log "   - distributions/MIRRORS.txt (CDN configuration)"
    log "   - DOWNLOAD_ASKME.sh (Universal downloader)"
}

main "$@"