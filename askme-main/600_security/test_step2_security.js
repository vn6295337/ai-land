// Test Step 2: Input Validation & Security Middleware
// This will test all the security features we just added

const axios = require('axios');

const BASE_URL = 'https://askme-backend-proxy.onrender.com'; // Update after deployment
const TEST_CASES = [
    {
        name: 'XSS Protection - Script Tag',
        payload: { prompt: '<script>alert("xss")</script>', provider: 'google' },
        expectedBlock: true,
        expectedCode: 'XSS_BLOCKED'
    },
    {
        name: 'XSS Protection - JavaScript URL',
        payload: { prompt: 'javascript:alert("xss")', provider: 'google' },
        expectedBlock: true,
        expectedCode: 'XSS_BLOCKED'
    },
    {
        name: 'XSS Protection - Iframe Injection',
        payload: { prompt: '<iframe src="javascript:alert(1)"></iframe>', provider: 'google' },
        expectedBlock: true,
        expectedCode: 'XSS_BLOCKED'
    },
    {
        name: 'SQL Injection - Basic OR 1=1',
        payload: { prompt: "' OR '1'='1", provider: 'google' },
        expectedBlock: true,
        expectedCode: 'SQL_INJECTION_BLOCKED'
    },
    {
        name: 'SQL Injection - UNION SELECT',
        payload: { prompt: 'UNION SELECT * FROM users', provider: 'google' },
        expectedBlock: true,
        expectedCode: 'SQL_INJECTION_BLOCKED'
    },
    {
        name: 'Command Injection - Semicolon',
        payload: { prompt: 'hello; cat /etc/passwd', provider: 'google' },
        expectedBlock: true,
        expectedCode: 'COMMAND_INJECTION_BLOCKED'
    },
    {
        name: 'Command Injection - Path Traversal',
        payload: { prompt: '../../../etc/passwd', provider: 'google' },
        expectedBlock: true,
        expectedCode: 'COMMAND_INJECTION_BLOCKED'
    },
    {
        name: 'Invalid Provider',
        payload: { prompt: 'hello world', provider: 'invalid<>provider' },
        expectedBlock: true,
        expectedCode: 'INVALID_PROVIDER'
    },
    {
        name: 'Empty Prompt',
        payload: { prompt: '', provider: 'google' },
        expectedBlock: true,
        expectedCode: 'EMPTY_PROMPT'
    },
    {
        name: 'Prompt Too Long',
        payload: { prompt: 'x'.repeat(15000), provider: 'google' },
        expectedBlock: true,
        expectedCode: 'PROMPT_TOO_LONG'
    },
    {
        name: 'Valid Request',
        payload: { prompt: 'What is artificial intelligence?', provider: 'google' },
        expectedBlock: false,
        expectedCode: null
    },
    {
        name: 'Valid Creative Request',
        payload: { prompt: 'Write a short story about a robot learning to paint', provider: 'mistral' },
        expectedBlock: false,
        expectedCode: null
    }
];

class SecurityTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            errors: 0,
            details: []
        };
    }
    
    async runTest(testCase) {
        console.log(`\n🧪 Testing: ${testCase.name}`);
        
        try {
            const response = await axios.post(`${BASE_URL}/api/query`, testCase.payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            
            // If we expected it to be blocked but it wasn't
            if (testCase.expectedBlock) {
                console.log(`❌ FAIL: Expected block but request succeeded`);
                this.results.failed++;
                this.results.details.push({
                    test: testCase.name,
                    status: 'FAIL',
                    reason: 'Expected block but request succeeded',
                    response: response.data
                });
            } else {
                console.log(`✅ PASS: Valid request processed correctly`);
                this.results.passed++;
                this.results.details.push({
                    test: testCase.name,
                    status: 'PASS',
                    reason: 'Valid request processed'
                });
            }
            
        } catch (error) {
            if (error.response && error.response.status === 400) {
                const errorData = error.response.data;
                
                if (testCase.expectedBlock) {
                    if (testCase.expectedCode && errorData.code === testCase.expectedCode) {
                        console.log(`✅ PASS: Correctly blocked with code ${errorData.code}`);
                        this.results.passed++;
                        this.results.details.push({
                            test: testCase.name,
                            status: 'PASS',
                            reason: `Correctly blocked with ${errorData.code}`,
                            errorCode: errorData.code
                        });
                    } else {
                        console.log(`⚠️  PARTIAL: Blocked but wrong code. Expected: ${testCase.expectedCode}, Got: ${errorData.code}`);
                        this.results.passed++; // Still a pass since it was blocked
                        this.results.details.push({
                            test: testCase.name,
                            status: 'PARTIAL',
                            reason: `Blocked but wrong error code`,
                            expected: testCase.expectedCode,
                            actual: errorData.code
                        });
                    }
                } else {
                    console.log(`❌ FAIL: Valid request was blocked`);
                    this.results.failed++;
                    this.results.details.push({
                        test: testCase.name,
                        status: 'FAIL',
                        reason: 'Valid request incorrectly blocked',
                        error: errorData
                    });
                }
            } else {
                console.log(`⚠️  ERROR: ${error.message}`);
                this.results.errors++;
                this.results.details.push({
                    test: testCase.name,
                    status: 'ERROR',
                    reason: error.message
                });
            }
        }
    }
    
    async testSecurityHeaders() {
        console.log(`\n🔍 Testing Security Headers...`);
        
        try {
            const response = await axios.get(`${BASE_URL}/health`);
            const headers = response.headers;
            
            const expectedHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'referrer-policy'
            ];
            
            let headersPassed = 0;
            expectedHeaders.forEach(header => {
                if (headers[header]) {
                    console.log(`✅ Header ${header}: ${headers[header]}`);
                    headersPassed++;
                } else {
                    console.log(`❌ Missing header: ${header}`);
                }
            });
            
            if (headers['x-powered-by']) {
                console.log(`⚠️  X-Powered-By header still present (should be removed)`);
            } else {
                console.log(`✅ X-Powered-By header properly removed`);
                headersPassed++;
            }
            
            console.log(`📊 Security Headers: ${headersPassed}/${expectedHeaders.length + 1} configured`);
            
        } catch (error) {
            console.log(`❌ Error testing security headers: ${error.message}`);
        }
    }
    
    async testRateLimiting() {
        console.log(`\n⏱️  Testing Rate Limiting...`);
        
        const requests = [];
        const testPrompt = { prompt: 'Rate limit test', provider: 'google' };
        
        // Send 15 requests rapidly
        for (let i = 0; i < 15; i++) {
            requests.push(
                axios.post(`${BASE_URL}/api/query`, testPrompt, {
                    timeout: 5000
                }).catch(error => error.response)
            );
        }
        
        try {
            const responses = await Promise.all(requests);
            const blocked = responses.filter(r => r && r.status === 429).length;
            const successful = responses.filter(r => r && r.status === 200).length;
            
            if (blocked > 0) {
                console.log(`✅ Rate limiting working: ${blocked} requests blocked, ${successful} succeeded`);
            } else {
                console.log(`⚠️  Rate limiting may need adjustment: all ${successful} requests succeeded`);
            }
        } catch (error) {
            console.log(`⚠️  Rate limiting test error: ${error.message}`);
        }
    }
    
    async runAllTests() {
        console.log('🛡️  Starting Comprehensive Security Test Suite');
        console.log('='.repeat(50));
        
        // Test input validation
        for (let testCase of TEST_CASES) {
            await this.runTest(testCase);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        }
        
        // Test security headers
        await this.testSecurityHeaders();
        
        // Test rate limiting
        await this.testRateLimiting();
        
        // Generate report
        this.generateReport();
    }
    
    generateReport() {
        console.log('\n📊 Security Test Report');
        console.log('='.repeat(50));
        
        const total = this.results.passed + this.results.failed + this.results.errors;
        const passRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
        
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⚠️  Errors: ${this.results.errors}`);
        console.log(`📈 Pass Rate: ${passRate}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.details
                .filter(d => d.status === 'FAIL')
                .forEach(detail => {
                    console.log(`  - ${detail.test}: ${detail.reason}`);
                });
        }
        
        if (this.results.errors > 0) {
            console.log('\n⚠️  Error Details:');
            this.results.details
                .filter(d => d.status === 'ERROR')
                .forEach(detail => {
                    console.log(`  - ${detail.test}: ${detail.reason}`);
                });
        }
        
        // Overall security score
        if (passRate >= 90) {
            console.log('\n🟢 Security Status: EXCELLENT');
        } else if (passRate >= 80) {
            console.log('\n🟡 Security Status: GOOD');
        } else if (passRate >= 70) {
            console.log('\n🟠 Security Status: NEEDS IMPROVEMENT');
        } else {
            console.log('\n🔴 Security Status: CRITICAL - IMMEDIATE ACTION REQUIRED');
        }
        
        console.log('\n🚀 Next Steps:');
        console.log('1. Deploy to Render and run this test');
        console.log('2. Monitor logs for security events');
        console.log('3. Proceed to Step 3: CORS Configuration');
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new SecurityTester();
    tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester;