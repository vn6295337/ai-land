#!/bin/bash
# Continuous Distribution Validation

set -e

REPO_OWNER="vn6295337"
REPO_NAME="askme"
VALIDATION_DIR="validation-results"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

get_all_releases() {
    log "Fetching all releases..."
    
    local api_url="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases"
    curl -fsSL "$api_url" | jq -r '.[].tag_name' | sed 's/^v//'
}

validate_all_releases() {
    log "Starting validation of all releases..."
    
    mkdir -p "$VALIDATION_DIR"
    
    local releases=$(get_all_releases)
    local total_releases=$(echo "$releases" | wc -l)
    local current=0
    
    log "Found $total_releases releases to validate"
    
    for version in $releases; do
        current=$((current + 1))
        log "[$current/$total_releases] Validating v$version..."
        
        # Run health check for each version
        if ./700_scripts/708_release_health_monitor.sh "$version"; then
            log "✅ v$version - Healthy"
            echo "v$version,$(date),healthy" >> "$VALIDATION_DIR/validation-log.csv"
        else
            log "❌ v$version - Unhealthy"
            echo "v$version,$(date),unhealthy" >> "$VALIDATION_DIR/validation-log.csv"
        fi
    done
    
    generate_validation_summary
}

generate_validation_summary() {
    log "Generating validation summary..."
    
    local summary_file="$VALIDATION_DIR/validation-summary.md"
    
    cat > "$summary_file" << EOF
# AskMe CLI - Distribution Validation Summary

**Generated:** $(date)

## Validation Results

EOF
    
    if [[ -f "$VALIDATION_DIR/validation-log.csv" ]]; then
        echo "| Version | Status | Last Checked |" >> "$summary_file"
        echo "|---------|--------|--------------|" >> "$summary_file"
        
        while IFS=',' read -r version timestamp status; do
            local status_icon="✅"
            if [[ "$status" == "unhealthy" ]]; then
                status_icon="❌"
            fi
            echo "| $version | $status_icon $status | $timestamp |" >> "$summary_file"
        done < "$VALIDATION_DIR/validation-log.csv"
    fi
    
    cat >> "$summary_file" << EOF

## Statistics

EOF
    
    if [[ -f "$VALIDATION_DIR/validation-log.csv" ]]; then
        local total=$(wc -l < "$VALIDATION_DIR/validation-log.csv")
        local healthy=$(grep -c "healthy" "$VALIDATION_DIR/validation-log.csv" || echo "0")
        local unhealthy=$(grep -c "unhealthy" "$VALIDATION_DIR/validation-log.csv" || echo "0")
        
        echo "- **Total Releases:** $total" >> "$summary_file"
        echo "- **Healthy:** $healthy" >> "$summary_file"
        echo "- **Unhealthy:** $unhealthy" >> "$summary_file"
        
        local health_percentage=$((healthy * 100 / total))
        echo "- **Health Percentage:** $health_percentage%" >> "$summary_file"
    fi
    
    log "✅ Validation summary generated: $summary_file"
}

main() {
    log "AskMe CLI Continuous Distribution Validation"
    log "==========================================="
    
    # Ensure we have the monitoring script
    if [[ ! -f "700_scripts/708_release_health_monitor.sh" ]]; then
        log "❌ Health monitor script not found"
        exit 1
    fi
    
    validate_all_releases
    
    log "Validation complete. Check $VALIDATION_DIR for results."
}

main "$@"