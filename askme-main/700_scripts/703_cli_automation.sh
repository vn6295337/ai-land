#!/bin/bash

# askme CLI Automation Testing Script
# Tests predefined input cases to verify CLI functionality

CLI_PATH="/home/km_project/askme/300_implementation/askme-cli/cliApp/build/install/cliApp/bin/cliApp"
LOG_FILE="/home/km_project/askme-automation-test.log"

echo "=== askme CLI Automation Test Started: $(date) ===" | tee -a $LOG_FILE

# Test Case 1: Help Command
echo "Test 1: Help command" | tee -a $LOG_FILE
timeout 10s $CLI_PATH --help 2>&1 | tee -a $LOG_FILE
echo "---" | tee -a $LOG_FILE

# Test Case 2: Simple Query Test
echo "Test 2: Simple query (Hello)" | tee -a $LOG_FILE
echo "Hello" | timeout 30s $CLI_PATH 2>&1 | tee -a $LOG_FILE
echo "---" | tee -a $LOG_FILE

echo "=== CLI Automation Test Completed: $(date) ===" | tee -a $LOG_FILE
