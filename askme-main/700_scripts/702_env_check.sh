#!/bin/bash

echo "🔍 Scanning Android development environment under USBdrive/askme..."

ROOT="/home/km_project/askme"
MISSING=0

check_dir() {
  if [ ! -d "$1" ]; then
    echo "❌ MISSING: $1"
    MISSING=1
  else
    echo "✅ Found: $1"
  fi
}

check_file() {
  if [ ! -f "$1" ]; then
    echo "❌ MISSING: $1"
    MISSING=1
  else
    echo "✅ Found: $1"
  fi
}

# ---- Toolchain Checks ----
check_dir "$ROOT/tools/jdk17"
check_dir "$ROOT/tools/android-sdk"
check_dir "$ROOT/tools/android-studio"

# ---- Core Scripts ----
check_file "$ROOT/master_sync.sh"
check_file "$ROOT/env_setup.sh"
check_file "$ROOT/build.sh"

# ---- Config & Sync Assets ----
check_file "$ROOT/.rclone.conf"
check_file "$ROOT/.sync_log"

# ---- Git Repository Check ----
if [ -d "$ROOT/.git" ]; then
  echo "✅ Git repo initialized in askme/"
else
  echo "❌ MISSING: .git repo not initialized"
  MISSING=1
fi

# ---- Final Summary ----
echo "--------------------------------------"
if [ $MISSING -eq 0 ]; then
  echo "✅ Environment check complete: All critical components present."
else
  echo "⚠️ Check complete: Some components are missing. Please reinstall or recover them before proceeding."
fi
