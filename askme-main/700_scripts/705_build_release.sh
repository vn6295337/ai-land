#!/bin/bash
# Enhanced AskMe CLI Release Builder with Integrity Checks

set -e

VERSION=${1:-"1.0.0"}
BUILD_DIR="build-release"
DIST_DIR="dist"
TEMP_DIR="temp-build"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

verify_file_integrity() {
    local file_path="$1"
    local expected_min_size="$2"
    local description="$3"
    
    if [[ ! -f "$file_path" ]]; then
        error "$description not found at $file_path"
    fi
    
    local file_size=$(stat -c%s "$file_path")
    if [[ $file_size -lt $expected_min_size ]]; then
        error "$description appears truncated: $file_size bytes (expected >$expected_min_size)"
    fi
    
    # Check for null bytes (sign of corruption)
    if grep -q $'\0' "$file_path"; then
        error "$description contains null bytes - possible corruption"
    fi
    
    log "✅ $description integrity verified ($file_size bytes)"
}

verify_script_integrity() {
    local script_path="$1"
    
    verify_file_integrity "$script_path" 8000 "CLI script"
    
    # Verify script structure
    local line_count=$(wc -l < "$script_path")
    if [[ $line_count -lt 200 ]]; then
        error "Script appears truncated: $line_count lines (expected >200)"
    fi
    
    # Verify CLASSPATH is complete
    if ! grep -q "ktor-serialization-kotlinx-json" "$script_path"; then
        error "CLASSPATH appears incomplete - missing ktor-serialization dependency"
    fi
    
    # Verify script ends properly
    if ! tail -1 "$script_path" | grep -q "exec"; then
        error "Script does not end with exec statement"
    fi
    
    log "✅ Script structure validation passed"
}

generate_comprehensive_checksums() {
    local target_dir="$1"
    local checksum_file="$2"
    
    log "Generating comprehensive checksums..."
    
    # Create checksums for all files
    find "$target_dir" -type f -exec sha256sum {} + > "$checksum_file"
    
    # Create separate checksums for critical files
    local critical_files=("bin/cliApp" "lib/*.jar")
    for pattern in "${critical_files[@]}"; do
        find "$target_dir" -path "*/$pattern" -type f -exec sha256sum {} + >> "${checksum_file}.critical"
    done
    
    # Generate MD5 as backup
    find "$target_dir" -type f -exec md5sum {} + > "${checksum_file}.md5"
    
    log "✅ Checksums generated"
}

create_backup_distribution() {
    local source_dir="$1"
    local backup_name="$2"
    
    log "Creating backup distribution..."
    
    # Create backup in repository root
    local backup_path="../askme-distribution-backup-$backup_name.tar.gz"
    tar -czf "$backup_path" -C "$source_dir" .
    
    # Verify backup
    local temp_extract="temp-verify-$backup_name"
    mkdir -p "$temp_extract"
    tar -xzf "$backup_path" -C "$temp_extract"
    
    verify_script_integrity "$temp_extract/bin/cliApp"
    
    rm -rf "$temp_extract"
    log "✅ Backup distribution created and verified: $backup_path"
}

main() {
    log "🚀 Building AskMe CLI v$VERSION with enhanced integrity checks..."
    
    # Clean previous builds
    rm -rf "$BUILD_DIR" "$DIST_DIR" "$TEMP_DIR"
    mkdir -p "$BUILD_DIR" "$DIST_DIR" "$TEMP_DIR"
    
    # Navigate to CLI project
    cd 300_implementation/askme-cli
    
    # Build with integrity checks
    log "📦 Building CLI application with integrity verification..."
    ./gradlew clean atomicBuild
    
    # Verify build immediately
    verify_script_integrity "cliApp/build/install/cliApp/bin/cliApp"
    
    log "📁 Preparing distribution..."
    cd ../../
    
    # Copy to temp directory first (atomic operation)
    cp -r 300_implementation/askme-cli/cliApp/build/install/cliApp "$TEMP_DIR/askme-cli"
    
    # Verify temp distribution
    verify_script_integrity "$TEMP_DIR/askme-cli/bin/cliApp"
    
    # Create additional files
    cat > "$TEMP_DIR/askme-cli/README.md" << EOF
# AskMe CLI v$VERSION

## Quick Start
1. Make executable: chmod +x bin/cliApp
2. Add to PATH or run directly: ./bin/cliApp "your question"
3. Configure API keys: ./bin/cliApp --setup

## Integrity Verification
This distribution includes checksums for verification:
- SHA256: CHECKSUMS.txt
- MD5: CHECKSUMS.txt.md5
- Critical files: CHECKSUMS.txt.critical

## Documentation
Visit: https://github.com/vn6295337/askme
EOF
    
    cat > "$TEMP_DIR/askme-cli/VERSION" << EOF
$VERSION
EOF
    
    # Generate comprehensive checksums
    generate_comprehensive_checksums "$TEMP_DIR/askme-cli" "$TEMP_DIR/askme-cli/CHECKSUMS.txt"
    
    # Move temp to final build directory (atomic operation)
    mv "$TEMP_DIR/askme-cli" "$BUILD_DIR/askme-cli"
    
    # Create backup distribution in repository root
    create_backup_distribution "$BUILD_DIR/askme-cli" "$VERSION"
    
    # Create main tarball
    log "📦 Creating release archive..."
    cd "$BUILD_DIR"
    tar -czf "../$DIST_DIR/askme-cli-v$VERSION.tar.gz" askme-cli/
    cd ..
    
    # Verify final archive
    log "🔍 Verifying final archive..."
    mkdir -p "$TEMP_DIR/verify"
    tar -xzf "$DIST_DIR/askme-cli-v$VERSION.tar.gz" -C "$TEMP_DIR/verify"
    verify_script_integrity "$TEMP_DIR/verify/askme-cli/bin/cliApp"
    
    # Generate final checksums
    log "🔐 Generating final checksums..."
    cd "$DIST_DIR"
    sha256sum "askme-cli-v$VERSION.tar.gz" > "askme-cli-v$VERSION.sha256"
    md5sum "askme-cli-v$VERSION.tar.gz" > "askme-cli-v$VERSION.md5"
    
    # Create verification script
    cat > "verify-v$VERSION.sh" << 'EOF'
#!/bin/bash
# Verification script for AskMe CLI release
set -e

VERSION="$1"
if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>"
    exit 1
fi

ARCHIVE="askme-cli-v$VERSION.tar.gz"
CHECKSUM_FILE="askme-cli-v$VERSION.sha256"

if [[ ! -f "$ARCHIVE" ]] || [[ ! -f "$CHECKSUM_FILE" ]]; then
    echo "Error: $ARCHIVE or $CHECKSUM_FILE not found"
    exit 1
fi

echo "Verifying archive integrity..."
sha256sum -c "$CHECKSUM_FILE"

echo "Extracting and verifying contents..."
mkdir -p "temp-verify"
tar -xzf "$ARCHIVE" -C "temp-verify"

# Verify script structure
SCRIPT_PATH="temp-verify/askme-cli/bin/cliApp"
if [[ ! -f "$SCRIPT_PATH" ]]; then
    echo "Error: CLI script not found"
    exit 1
fi

LINE_COUNT=$(wc -l < "$SCRIPT_PATH")
if [[ $LINE_COUNT -lt 200 ]]; then
    echo "Error: Script appears truncated ($LINE_COUNT lines)"
    exit 1
fi

if ! grep -q "ktor-serialization-kotlinx-json" "$SCRIPT_PATH"; then
    echo "Error: CLASSPATH appears incomplete"
    exit 1
fi

# Verify internal checksums
if [[ -f "temp-verify/askme-cli/CHECKSUMS.txt" ]]; then
    echo "Verifying internal checksums..."
    cd "temp-verify/askme-cli"
    sha256sum -c CHECKSUMS.txt --quiet
    cd ../..
fi

rm -rf "temp-verify"
echo "✅ Archive verification completed successfully"
EOF
    
    chmod +x "verify-v$VERSION.sh"
    cd ..
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    log "✅ Release build complete with integrity verification!"
    log "📄 Files created:"
    log "   $DIST_DIR/askme-cli-v$VERSION.tar.gz"
    log "   $DIST_DIR/askme-cli-v$VERSION.sha256"
    log "   $DIST_DIR/askme-cli-v$VERSION.md5"
    log "   $DIST_DIR/verify-v$VERSION.sh"
    log "   askme-distribution-backup-$VERSION.tar.gz"
}

main "$@"