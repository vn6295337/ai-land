#!/bin/bash
# Hybrid Tiered Sync Architecture for AskMe Android Development
# Optimized for: USB (Primary) → Google Drive (Essential) → Box.com (Backup) → Mega (Archive)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/tiered_sync.log"
USB_PATH="/home/km_project/askme"

# Tier Configuration
declare -A TIER_CONFIG=(
    ["USB_PRIMARY"]="50GB"          # Full development environment
    ["GDRIVE_ESSENTIAL"]="14GB"     # Essential sync only
    ["BOX_BACKUP"]="10GB"           # Backup and overflow
    ["MEGA_ARCHIVE"]="20GB"         # Archive and large files
)

# Remote Configuration
PRIMARY_REMOTE="askme"           # Google Drive
SECONDARY_REMOTE="askme-box"     # Box.com
ARCHIVE_REMOTE="askme-mega"      # Mega.nz
REMOTE_FOLDER="askme-sync"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging with tier indicators
log() {
    local level="$1"
    local tier="${2:-GENERAL}"
    shift 2
    local timestamp="[$(date '+%Y-%m-%d %H:%M:%S')]"
    local message="$*"
    
    case "$level" in
        "ERROR") echo -e "${RED}${timestamp} [${tier}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE" ;;
        "SUCCESS") echo -e "${GREEN}${timestamp} [${tier}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE" ;;
        "WARN") echo -e "${YELLOW}${timestamp} [${tier}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE" ;;
        "INFO") echo -e "${BLUE}${timestamp} [${tier}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE" ;;
        "TIER") echo -e "${PURPLE}${timestamp} [${tier}] ${message}${NC}" | tee -a "$LOG_FILE" ;;
    esac
}

# Check if remote exists
check_remote() {
    local remote="$1"
    rclone listremotes | sed 's/://g' | grep -q "^${remote}$"
}

# Fixed size calculation function
calculate_sync_size() {
    local source="$1"
    local filter_file="$2"
    
    # Get size with proper error handling
    local size_output
    if ! size_output=$(rclone size "$source" --filter-from "$filter_file" 2>/dev/null); then
        echo "0"
        return 1
    fi
    
    # Parse size more accurately
    # rclone size output format: "Total objects: X (Y bytes)"
    local size_bytes
    size_bytes=$(echo "$size_output" | grep -o '([0-9,]*[[:space:]]*bytes)' | grep -o '[0-9,]*' | tr -d ',' || echo "0")
    
    if [[ -z "$size_bytes" || "$size_bytes" -eq 0 ]]; then
        # Fallback: try to extract from "Total size:" line
        size_bytes=$(echo "$size_output" | grep -i "total size:" | grep -oE '[0-9.]+[[:space:]]*[KMGT]?[Bb]' | head -1 || echo "0")
        
        # Convert to bytes if needed
        if [[ "$size_bytes" =~ ([0-9.]+)[[:space:]]*([KMGT])?[Bb] ]]; then
            local num="${BASH_REMATCH[1]}"
            local unit="${BASH_REMATCH[2]}"
            
            case "$unit" in
                "K") size_bytes=$(echo "$num * 1024" | bc 2>/dev/null || echo "0") ;;
                "M") size_bytes=$(echo "$num * 1024 * 1024" | bc 2>/dev/null || echo "0") ;;
                "G") size_bytes=$(echo "$num * 1024 * 1024 * 1024" | bc 2>/dev/null || echo "0") ;;
                "T") size_bytes=$(echo "$num * 1024 * 1024 * 1024 * 1024" | bc 2>/dev/null || echo "0") ;;
                *) size_bytes=$(echo "$num" | cut -d. -f1 || echo "0") ;;
            esac
        else
            size_bytes="0"
        fi
    fi
    
    # Convert bytes to MB for easier handling
    local size_mb
    if command -v bc >/dev/null 2>&1; then
        size_mb=$(echo "scale=0; $size_bytes / 1024 / 1024" | bc 2>/dev/null || echo "0")
    else
        # Fallback without bc
        size_mb=$((size_bytes / 1024 / 1024))
    fi
    
    # Ensure we have a valid number
    if [[ -z "$size_mb" || "$size_mb" -lt 0 ]]; then
        size_mb=0
    fi
    
    echo "$size_mb"
}

# FIXED: Create optimized filter file with correct rule ordering (exclusions BEFORE inclusions)
create_filter_file() {
    local tier="$1"
    local filter_file="${SCRIPT_DIR}/.${tier}_filter"
    
    case "$tier" in
        "TIER1_USB_FULL")
            cat > "$filter_file" << 'EOF'
# USB: Full development environment (minimal excludes)
# IMPORTANT: Exclusions MUST come before inclusions!

# Exclude only the largest files that could fill USB
- **/.git/objects/pack/*.pack
- **/*.tmp
- **/.DS_Store
- **/.Trash-*/**
- **/*.log

# Include everything else
+ **
EOF
            ;;
        "TIER2_GDRIVE_ESSENTIAL")
            cat > "$filter_file" << 'EOF'
# Google Drive: Essential development files only
# IMPORTANT: Exclusions MUST come before inclusions in rclone!

# Exclude .git directory and files
- .git/**
- **/.git/**
- .gitignore
- .github/**

# Exclude IDE and build directories
- .idea/**
- **/.idea/**
- .vscode/**
- **/.vscode/**
- .gradle/**
- **/.gradle/**
- build/**
- **/build/**
- out/**
- **/out/**

# Exclude temporary and cache files
- **/*.tmp
- **/*~
- **/.DS_Store
- **/*.log
- **/*.lock

# Exclude Android-specific build files
- **/gradle-wrapper.jar
- **/gradle-wrapper.properties
- **/local.properties
- **/*.keystore
- **/*.jks
- **/*.apk
- **/*.ap_
- **/*.dex
- **/*.so
- **/*.class

# Exclude large binary files
- **/*.jar
- **/*.war
- **/*.ear
- **/*.img
- **/*.iso

# Exclude build artifacts and generated files
- **/captures/**
- **/generated/**
- **/intermediates/**
- **/node_modules/**
- **/target/**

# Exclude development container files
- .devcontainer/**

# NOW include everything else (this MUST be last)
+ **
EOF
            ;;
        "TIER3_BOX_BACKUP")
            cat > "$filter_file" << 'EOF'
# Box.com: Backup and overflow (~8GB)
# IMPORTANT: Exclusions MUST come before inclusions!

# Exclude .git directory and files
- .git/**
- **/.git/**
- .gitignore
- .github/**

# Exclude IDE and build directories
- .idea/**
- **/.idea/**
- .vscode/**
- **/.vscode/**
- .gradle/**
- **/.gradle/**
- build/**
- **/build/**
- out/**
- **/out/**

# Exclude temporary and cache files
- **/*.tmp
- **/*~
- **/.DS_Store
- **/*.log
- **/*.lock

# Exclude build artifacts
- **/node_modules/**
- **/target/**
- **/captures/**
- **/generated/**
- **/intermediates/**

# Exclude large files
- **/*.img
- **/*.iso

# Include everything else
+ **
EOF
            ;;
        "TIER4_MEGA_ARCHIVE")
            cat > "$filter_file" << 'EOF'
# Mega: Archive and large files (~15GB)
# IMPORTANT: Exclusions MUST come before inclusions!

# Exclude .git directory (most important)
- .git/**
- **/.git/**
- *.git/**
- .git/
- **/.git/
- .gitignore
- .github/**

# Exclude IDE and build directories
- .idea/**
- **/.idea/**
- .vscode/**
- **/.vscode/**
- .gradle/**
- **/.gradle/**
- build/**
- **/build/**
- out/**
- **/out/**

# Exclude temporary files
- **/*.tmp
- **/*~
- **/.DS_Store
- **/*.log
- **/*.lock

# Exclude build artifacts
- **/node_modules/**
- **/target/**
- **/captures/**
- **/generated/**
- **/intermediates/**

# Include everything else
+ **
EOF
            ;;
    esac
    
    echo "$filter_file"
}

# Smart tier synchronization
sync_tier() {
    local source="$1"
    local dest="$2"
    local tier="$3"
    local direction="$4"
    local dry_run="${5:-false}"
    
    log "TIER" "$tier" "Starting $direction sync"
    
    # Create filter file for this tier
    local filter_file
    filter_file=$(create_filter_file "$tier")
    
    # Check if destination remote exists (for cloud destinations)
    if [[ "$dest" =~ : ]]; then
        local remote_name
        remote_name=$(echo "$dest" | cut -d: -f1)
        if ! check_remote "$remote_name"; then
            log "ERROR" "$tier" "Remote '$remote_name' not configured in rclone"
            log "INFO" "$tier" "Please run: rclone config"
            rm -f "$filter_file"
            return 1
        fi
    fi
    
    # Estimate size with improved calculation
    if [[ "$dry_run" == "false" && "$dest" =~ : ]]; then
        log "INFO" "$tier" "Calculating sync size for $tier..."
        local size_mb
        size_mb=$(calculate_sync_size "$source" "$filter_file")
        
        if [[ "$size_mb" -gt 0 ]]; then
            log "INFO" "$tier" "Estimated sync size: ${size_mb}MB"
            
            # Tier-specific size validation (convert to MB for comparison)
            case "$tier" in
                "TIER2_GDRIVE_ESSENTIAL")
                    if [[ "$size_mb" -gt 12000 ]]; then  # 12GB = 12000MB
                        log "WARN" "$tier" "Size ${size_mb}MB exceeds Google Drive tier limit"
                        log "INFO" "$tier" "Consider moving large files to Mega tier"
                    fi
                    ;;
                "TIER3_BOX_BACKUP")
                    if [[ "$size_mb" -gt 8000 ]]; then  # 8GB = 8000MB
                        log "WARN" "$tier" "Size ${size_mb}MB exceeds Box.com tier limit"
                    fi
                    ;;
                "TIER4_MEGA_ARCHIVE")
                    if [[ "$size_mb" -gt 18000 ]]; then  # 18GB = 18000MB
                        log "WARN" "$tier" "Size ${size_mb}MB approaching Mega tier limit"
                    fi
                    ;;
            esac
        else
            log "INFO" "$tier" "Estimated sync size: <1MB (empty or very small)"
        fi
    fi
    
    # Perform sync
    local cmd_args=("sync" "$source" "$dest" "--filter-from" "$filter_file")
    
    if [[ "$dry_run" == "true" ]]; then
        cmd_args+=("--dry-run" "--progress" "--stats" "30s" "-v")
        log "INFO" "$tier" "DRY RUN: $direction"
    else
        cmd_args+=("--progress" "--transfers" "4" "--checkers" "8" "--stats" "30s")
        log "INFO" "$tier" "EXECUTING: $direction"
    fi
    
    if rclone "${cmd_args[@]}" 2>&1 | tee -a "$LOG_FILE"; then
        log "SUCCESS" "$tier" "Sync completed: $direction"
        rm -f "$filter_file"
        return 0
    else
        log "ERROR" "$tier" "Sync failed: $direction"
        rm -f "$filter_file"
        return 1
    fi
}

# Tier status checker
check_tier_status() {
    local tier="$1"
    local path="$2"
    
    echo -e "${CYAN}=== $tier Status ===${NC}"
    
    if [[ "$path" =~ : ]]; then
        # Remote path
        local remote_name
        remote_name=$(echo "$path" | cut -d: -f1)
        
        # Check if remote exists
        if ! check_remote "$remote_name"; then
            echo "  Remote: $remote_name (not configured)"
            echo
            return 1
        fi
        
        # Check remote storage
        if rclone about "$remote_name:" 2>/dev/null > /tmp/remote_info.txt; then
            local used_line
            local total_line
            used_line=$(grep "Used:" /tmp/remote_info.txt || echo "Used: 0")
            total_line=$(grep "Total:" /tmp/remote_info.txt || echo "Total: 0")
            
            echo "  Remote: $remote_name"
            echo "  $used_line"
            echo "  $total_line"
            
            # Check folder size
            local folder_size
            folder_size=$(rclone size "$path" 2>/dev/null | grep -oE '[0-9.]+\s+[KMGT]?B' | head -1 || echo "0 B")
            echo "  Sync Folder: $folder_size"
        else
            echo "  Remote: $remote_name (connection failed)"
        fi
        
        rm -f /tmp/remote_info.txt
    else
        # Local path
        if [[ -d "$path" ]]; then
            local size
            local free
            size=$(du -sh "$path" 2>/dev/null | cut -f1 || echo "Unknown")
            free=$(df -h "$path" 2>/dev/null | awk 'NR==2 {print $4}' || echo "Unknown")
            
            echo "  Path: $path"
            echo "  Used: $size"
            echo "  Free: $free"
        else
            echo "  Path: $path (not found)"
        fi
    fi
    echo
}

# Intelligent sync orchestrator
orchestrated_sync() {
    local sync_type="$1"
    
    case "$sync_type" in
        "usb_to_cloud")
            log "INFO" "ORCHESTRATOR" "Starting USB → Cloud tiered sync"
            
            # Tier 2: Essential to Google Drive
            if sync_tier "$USB_PATH" "${PRIMARY_REMOTE}:${REMOTE_FOLDER}" "TIER2_GDRIVE_ESSENTIAL" "USB → Google Drive Essential"; then
                log "SUCCESS" "ORCHESTRATOR" "Tier 2 (Essential) sync completed"
            else
                log "ERROR" "ORCHESTRATOR" "Tier 2 sync failed"
                return 1
            fi
            
            # Tier 3: Backup to Box.com (only if configured)
            if check_remote "$SECONDARY_REMOTE"; then
                if sync_tier "$USB_PATH" "${SECONDARY_REMOTE}:${REMOTE_FOLDER}" "TIER3_BOX_BACKUP" "USB → Box.com Backup"; then
                    log "SUCCESS" "ORCHESTRATOR" "Tier 3 (Backup) sync completed"
                else
                    log "WARN" "ORCHESTRATOR" "Tier 3 sync failed (continuing)"
                fi
            else
                log "INFO" "ORCHESTRATOR" "Box.com remote not configured, skipping Tier 3"
            fi
            
            # Tier 4: Archive to Mega (only if configured)
            if check_remote "$ARCHIVE_REMOTE"; then
                if sync_tier "$USB_PATH" "${ARCHIVE_REMOTE}:${REMOTE_FOLDER}" "TIER4_MEGA_ARCHIVE" "USB → Mega Archive"; then
                    log "SUCCESS" "ORCHESTRATOR" "Tier 4 (Archive) sync completed"
                else
                    log "WARN" "ORCHESTRATOR" "Tier 4 sync failed (continuing)"
                fi
            else
                log "INFO" "ORCHESTRATOR" "Mega remote not configured, skipping Tier 4"
            fi
            ;;
        "cloud_to_usb")
            log "INFO" "ORCHESTRATOR" "Starting Cloud → USB sync"
            
            echo "Select download source:"
            echo "1. Google Drive (Essential)"
            echo "2. Box.com (Backup)"
            echo "3. Mega (Archive)"
            read -p "Choose source (1-3): " -r source_choice
            
            case "$source_choice" in
                1) 
                    if sync_tier "${PRIMARY_REMOTE}:${REMOTE_FOLDER}" "$USB_PATH" "TIER2_GDRIVE_ESSENTIAL" "Google Drive → USB"; then
                        log "SUCCESS" "ORCHESTRATOR" "Google Drive → USB sync completed"
                    else
                        log "ERROR" "ORCHESTRATOR" "Google Drive → USB sync failed"
                        return 1
                    fi
                    ;;
                2)
                    if check_remote "$SECONDARY_REMOTE"; then
                        if sync_tier "${SECONDARY_REMOTE}:${REMOTE_FOLDER}" "$USB_PATH" "TIER3_BOX_BACKUP" "Box.com → USB"; then
                            log "SUCCESS" "ORCHESTRATOR" "Box.com → USB sync completed"
                        else
                            log "ERROR" "ORCHESTRATOR" "Box.com → USB sync failed"
                            return 1
                        fi
                    else
                        log "ERROR" "ORCHESTRATOR" "Box.com remote not configured"
                        return 1
                    fi
                    ;;
                3)
                    if check_remote "$ARCHIVE_REMOTE"; then
                        if sync_tier "${ARCHIVE_REMOTE}:${REMOTE_FOLDER}" "$USB_PATH" "TIER4_MEGA_ARCHIVE" "Mega → USB"; then
                            log "SUCCESS" "ORCHESTRATOR" "Mega → USB sync completed"
                        else
                            log "ERROR" "ORCHESTRATOR" "Mega → USB sync failed"
                            return 1
                        fi
                    else
                        log "ERROR" "ORCHESTRATOR" "Mega remote not configured"
                        return 1
                    fi
                    ;;
                *)
                    log "ERROR" "ORCHESTRATOR" "Invalid source choice"
                    return 1
                    ;;
            esac
            ;;
        "full_backup")
            log "INFO" "ORCHESTRATOR" "Starting full backup cycle"
            
            # USB → Cloud (all tiers)
            orchestrated_sync "usb_to_cloud"
            ;;
    esac
}

# Environment detection
detect_environment() {
    if [[ -d "/mnt/chromeos" ]]; then
        echo "chromebook"
    else
        echo "unknown"
    fi
}

# Enhanced main menu
main() {
    echo "================================================================="
    echo "    🏗️  HYBRID TIERED SYNC ARCHITECTURE 🏗️"
    echo "    Smart Multi-Tier Development Environment"
    echo "================================================================="
    
    local env
    env=$(detect_environment)
    
    case "$env" in
        "chromebook")
            echo -e "${GREEN}📱 Chromebook Environment Detected${NC}"
            echo
            echo "🏗️ TIERED SYNC OPTIONS:"
            echo "1. 📤 Upload: USB → Cloud (Tiered)"
            echo "2. 📥 Download: Cloud → USB (Selective)"
            echo "3. 🔄 Bidirectional: USB ↔ Google Drive (Essential)"
            echo "4. 💾 Full Backup: USB → All Tiers"
            echo "5. 📊 Tier Status Dashboard"
            echo "6. ⚙️  Configure Tier Rules"
            echo "7. 🧪 Test Sync (Dry Run)"
            echo "8. 📋 View Sync Logs"
            echo "9. ❌ Exit"
            ;;
        *)
            log "ERROR" "SYSTEM" "Chromebook environment required - cannot proceed"
            exit 1
            ;;
    esac
    
    echo
    read -p "Choose option: " -r
    
    case "$REPLY" in
        "1")
            orchestrated_sync "usb_to_cloud"
            ;;
        "2")
            orchestrated_sync "cloud_to_usb"
            ;;
        "3")
            orchestrated_sync "usb_to_cloud"
            echo
            sync_tier "${PRIMARY_REMOTE}:${REMOTE_FOLDER}" "$USB_PATH" "TIER2_GDRIVE_ESSENTIAL" "Google Drive → USB"
            ;;
        "4")
            orchestrated_sync "full_backup"
            ;;
        "5")
            echo -e "${PURPLE}📊 TIER STATUS DASHBOARD${NC}"
            check_tier_status "TIER 1: USB Primary" "$USB_PATH"
            check_tier_status "TIER 2: Google Drive Essential" "${PRIMARY_REMOTE}:${REMOTE_FOLDER}"
            check_tier_status "TIER 3: Box.com Backup" "${SECONDARY_REMOTE}:${REMOTE_FOLDER}"
            check_tier_status "TIER 4: Mega Archive" "${ARCHIVE_REMOTE}:${REMOTE_FOLDER}"
            ;;
        "6")
            echo -e "${YELLOW}📝 Tier Configuration Summary:${NC}"
            echo "- TIER 1 (USB): Full development environment (${TIER_CONFIG[USB_PRIMARY]})"
            echo "- TIER 2 (Google Drive): Essential files only (${TIER_CONFIG[GDRIVE_ESSENTIAL]})"
            echo "- TIER 3 (Box.com): Backup and overflow (${TIER_CONFIG[BOX_BACKUP]})"
            echo "- TIER 4 (Mega): Archive and large files (${TIER_CONFIG[MEGA_ARCHIVE]})"
            echo
            echo "Filter rules are based on your project's Gradle structure and exclude:"
            echo "- Build artifacts (.gradle, build/, out/)"
            echo "- IDE files (.idea, .vscode, *.iml)"
            echo "- Temporary files (*.tmp, *.log, *~)"
            echo "- Android binaries (*.apk, *.dex, *.so)"
            echo "- Git objects and large packs"
            ;;
        "7")
            log "INFO" "TEST" "Running comprehensive dry-run test"
            echo "Select test tier:"
            echo "1. Google Drive Essential"
            echo "2. Box.com Backup"
            echo "3. Mega Archive"
            read -p "Choose test tier (1-3): " -r test_choice
            case "$test_choice" in
                1) sync_tier "$USB_PATH" "${PRIMARY_REMOTE}:${REMOTE_FOLDER}" "TIER2_GDRIVE_ESSENTIAL" "USB → Google Drive (TEST)" "true" ;;
                2) sync_tier "$USB_PATH" "${SECONDARY_REMOTE}:${REMOTE_FOLDER}" "TIER3_BOX_BACKUP" "USB → Box.com (TEST)" "true" ;;
                3) sync_tier "$USB_PATH" "${ARCHIVE_REMOTE}:${REMOTE_FOLDER}" "TIER4_MEGA_ARCHIVE" "USB → Mega (TEST)" "true" ;;
                *) log "ERROR" "TEST" "Invalid test choice" ;;
            esac
            ;;
        "8")
            if [[ -f "$LOG_FILE" ]]; then
                echo -e "${CYAN}📋 Last 50 log entries:${NC}"
                tail -50 "$LOG_FILE"
            else
                echo "No log file found yet."
            fi
            ;;
        "9")
            log "INFO" "SYSTEM" "Exiting Hybrid Tiered Sync"
            exit 0
            ;;
        *)
            log "ERROR" "SYSTEM" "Invalid option"
            exit 1
            ;;
    esac
    
    log "SUCCESS" "SYSTEM" "Hybrid Tiered Sync operation completed"
}

# Startup
main "$@"