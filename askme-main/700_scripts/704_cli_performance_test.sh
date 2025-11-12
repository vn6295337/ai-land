#!/bin/bash
echo "CLI Performance Benchmark"
echo "========================"

CLI_PATH="$USB_PATH/src/askme/cliApp/build/install/cliApp/bin/cliApp"

echo "Testing CLI startup time..."
time $CLI_PATH >/dev/null 2>&1

echo -e "\nTesting file processing time..."
time $CLI_PATH -f test_prompt.txt -m openai >/dev/null 2>&1

echo -e "\nCLI MVP Performance: MEASURED"
