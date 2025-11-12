#!/bin/bash
# Release Health Monitoring System

set -e

VERSION=${1:-"1.0.0"}
REPO_OWNER="vn6295337"
REPO_NAME="askme"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

check_github_release() {
    local version="$1"
    local api_url="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/v$version"
    
    log "Checking GitHub release v$version..."
    
    # Check if release exists
    if ! curl -fsSL "$api_url" > /dev/null 2>&1; then
        log "❌ GitHub release v$version not found"
        return 1
    fi
    
    # Get release data
    local release_data=$(curl -fsSL "$api_url")
    
    # Check if release has assets
    local asset_count=$(echo "$release_data" | jq '.assets | length' 2>/dev/null || echo "0")
    if [[ "$asset_count" -eq 0 ]]; then
        log "❌ GitHub release v$version has no assets"
        return 1
    fi
    
    log "✅ GitHub release v$version found with $asset_count assets"
    return 0
}

verify_release_asset() {
    local version="$1"
    local asset_name="$2"
    local expected_min_size="$3"
    
    local download_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$version/$asset_name"
    
    log "Verifying asset: $asset_name"
    
    # Check if asset is downloadable
    local temp_file=$(mktemp)
    if ! curl -fsSL "$download_url" -o "$temp_file"; then
        log "❌ Failed to download $asset_name"
        rm -f "$temp_file"
        return 1
    fi
    
    # Check file size
    local file_size=$(stat -c%s "$temp_file")
    if [[ $file_size -lt $expected_min_size ]]; then
        log "❌ $asset_name is too small: $file_size bytes (expected >$expected_min_size)"
        rm -f "$temp_file"
        return 1
    fi
    
    # For tar.gz files, check if they can be extracted
    if [[ "$asset_name" == *.tar.gz ]]; then
        if ! tar -tzf "$temp_file" > /dev/null 2>&1; then
            log "❌ $asset_name is not a valid tar.gz file"
            rm -f "$temp_file"
            return 1
        fi
        
        # Extract and verify CLI script
        local extract_dir=$(mktemp -d)
        tar -xzf "$temp_file" -C "$extract_dir"
        
        # Find CLI script
        local cli_script=$(find "$extract_dir" -name "cliApp" -type f | head -1)
        if [[ -z "$cli_script" ]]; then
            log "❌ CLI script not found in $asset_name"
            rm -rf "$temp_file" "$extract_dir"
            return 1
        fi
        
        # Verify script structure
        local line_count=$(wc -l < "$cli_script")
        if [[ $line_count -lt 200 ]]; then
            log "❌ CLI script appears truncated: $line_count lines"
            rm -rf "$temp_file" "$extract_dir"
            return 1
        fi
        
        # Check for corruption indicators
        if grep -q $'\0' "$cli_script"; then
            log "❌ CLI script contains null bytes"
            rm -rf "$temp_file" "$extract_dir"
            return 1
        fi
        
        # Verify CLASSPATH
        if ! grep -q "ktor-serialization-kotlinx-json" "$cli_script"; then
            log "❌ CLI script CLASSPATH appears incomplete"
            rm -rf "$temp_file" "$extract_dir"
            return 1
        fi
        
        rm -rf "$extract_dir"
    fi
    
    rm -f "$temp_file"
    log "✅ $asset_name verified successfully ($file_size bytes)"
    return 0
}

test_cli_functionality() {
    local version="$1"
    local download_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$version/askme-cli-v$version.tar.gz"
    
    log "Testing CLI functionality..."
    
    # Create temporary test environment
    local test_dir=$(mktemp -d)
    cd "$test_dir"
    
    # Download and extract
    if ! curl -fsSL "$download_url" -o "askme-cli.tar.gz"; then
        log "❌ Failed to download CLI for testing"
        cd - > /dev/null
        rm -rf "$test_dir"
        return 1
    fi
    
    tar -xzf "askme-cli.tar.gz"
    
    # Find CLI executable
    local cli_path=$(find . -name "cliApp" -type f | head -1)
    if [[ -z "$cli_path" ]]; then
        log "❌ CLI executable not found"
        cd - > /dev/null
        rm -rf "$test_dir"
        return 1
    fi
    
    chmod +x "$cli_path"
    
    # Test help command (should work without network)
    if ! timeout 30s "$cli_path" --help > help_output.txt 2>&1; then
        log "❌ CLI help command failed"
        if [[ -f "help_output.txt" ]]; then
            log "Error output:"
            cat help_output.txt
        fi
        cd - > /dev/null
        rm -rf "$test_dir"
        return 1
    fi
    
    # Verify help output
    if ! grep -q "Usage:" help_output.txt; then
        log "❌ Help output missing expected content"
        cd - > /dev/null
        rm -rf "$test_dir"
        return 1
    fi
    
    cd - > /dev/null
    rm -rf "$test_dir"
    log "✅ CLI functionality test passed"
    return 0
}

check_backup_distributions() {
    local version="$1"
    
    log "Checking backup distributions..."
    
    # Check repository backup
    local repo_backup_url="https://github.com/$REPO_OWNER/$REPO_NAME/raw/main/askme-distribution-backup-$version.tar.gz"
    if curl -fsSL --head "$repo_backup_url" | grep -q "200 OK"; then
        log "✅ Repository backup distribution found"
    else
        log "❌ Repository backup distribution not found"
        return 1
    fi
    
    # Check GitHub Pages (if configured)
    local pages_url="https://$REPO_OWNER.github.io/$REPO_NAME/distributions/askme-cli-backup-v$version.tar.gz"
    if curl -fsSL --head "$pages_url" | grep -q "200 OK"; then
        log "✅ GitHub Pages distribution found"
    else
        log "⚠️ GitHub Pages distribution not found (may not be configured)"
    fi
    
    return 0
}

generate_health_report() {
    local version="$1"
    local report_file="health-report-v$version.md"
    
    log "Generating health report..."
    
    cat > "$report_file" << EOF
# AskMe CLI v$version - Health Report

**Generated:** $(date)

## Release Status

EOF
    
    # Run all checks and capture results
    local github_status="❌ Failed"
    local main_asset_status="❌ Failed"
    local checksum_status="❌ Failed"
    local functionality_status="❌ Failed"
    local backup_status="❌ Failed"
    
    if check_github_release "$version"; then
        github_status="✅ Passed"
    fi
    
    if verify_release_asset "$version" "askme-cli-v$version.tar.gz" 1000000; then
        main_asset_status="✅ Passed"
    fi
    
    if verify_release_asset "$version" "askme-cli-v$version.sha256" 50; then
        checksum_status="✅ Passed"
    fi
    
    if test_cli_functionality "$version"; then
        functionality_status="✅ Passed"
    fi
    
    if check_backup_distributions "$version"; then
        backup_status="✅ Passed"
    fi
    
    cat >> "$report_file" << EOF
| Check | Status |
|-------|--------|
| GitHub Release Exists | $github_status |
| Main Asset Integrity | $main_asset_status |
| Checksum File | $checksum_status |
| CLI Functionality | $functionality_status |
| Backup Distributions | $backup_status |

## Asset Details

EOF
    
    # Get asset details from GitHub API
    local api_url="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/v$version"
    if curl -fsSL "$api_url" > /dev/null 2>&1; then
        local release_data=$(curl -fsSL "$api_url")
        echo "| Asset | Size | Downloads |" >> "$report_file"
        echo "|-------|------|-----------|" >> "$report_file"
        
        echo "$release_data" | jq -r '.assets[] | "\(.name) | \(.size) bytes | \(.download_count)"' >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

## Recommendations

EOF
    
    # Add recommendations based on failures
    if [[ "$main_asset_status" == "❌ Failed" ]]; then
        echo "- ⚠️ Main distribution asset is corrupted or inaccessible" >> "$report_file"
        echo "- 🔧 Regenerate and re-upload the release" >> "$report_file"
    fi
    
    if [[ "$functionality_status" == "❌ Failed" ]]; then
        echo "- ⚠️ CLI functionality test failed" >> "$report_file"
        echo "- 🔧 Verify the build process and dependencies" >> "$report_file"
    fi
    
    if [[ "$backup_status" == "❌ Failed" ]]; then
        echo "- ⚠️ Backup distributions missing" >> "$report_file"
        echo "- 🔧 Run backup distribution creation script" >> "$report_file"
    fi
    
    log "✅ Health report generated: $report_file"
}

main() {
    log "AskMe CLI Release Health Monitor"
    log "==============================="
    
    if [[ -z "$VERSION" ]]; then
        log "❌ Version not specified"
        exit 1
    fi
    
    log "Monitoring release v$VERSION..."
    
    # Create monitoring directory
    mkdir -p "monitoring/v$VERSION"
    cd "monitoring/v$VERSION"
    
    # Run comprehensive health check
    local overall_status="✅ Healthy"
    
    if ! check_github_release "$VERSION"; then
        overall_status="❌ Unhealthy"
    fi
    
    if ! verify_release_asset "$VERSION" "askme-cli-v$VERSION.tar.gz" 1000000; then
        overall_status="❌ Unhealthy"
    fi
    
    if ! verify_release_asset "$VERSION" "askme-cli-v$VERSION.sha256" 50; then
        overall_status="❌ Unhealthy"
    fi
    
    if ! test_cli_functionality "$VERSION"; then
        overall_status="❌ Unhealthy"
    fi
    
    if ! check_backup_distributions "$VERSION"; then
        overall_status="⚠️ Partially Healthy"
    fi
    
    # Generate detailed report
    generate_health_report "$VERSION"
    
    log "=========================================="
    log "Overall Status: $overall_status"
    log "=========================================="
    
    if [[ "$overall_status" == "❌ Unhealthy" ]]; then
        exit 1
    fi
    
    exit 0
}

main "$@"