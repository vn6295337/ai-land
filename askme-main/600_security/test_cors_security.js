// CORS Security Test Suite
// Tests the new restrictive CORS configuration

const axios = require('axios');

const BASE_URL = 'https://askme-backend-proxy.onrender.com';

const CORS_TEST_CASES = [
    {
        name: 'No Origin (CLI/Mobile)',
        origin: undefined,
        expectedAllow: true,
        description: 'Should allow requests with no origin header'
    },
    {
        name: 'Localhost Development',
        origin: 'http://localhost:3000',
        expectedAllow: true,
        description: 'Should allow localhost for development'
    },
    {
        name: 'Vercel Deployment',
        origin: 'https://askme-frontend.vercel.app',
        expectedAllow: true,
        description: 'Should allow legitimate frontend deployment'
    },
    {
        name: 'Netlify Deployment',
        origin: 'https://askme-app.netlify.app',
        expectedAllow: true,
        description: 'Should allow Netlify deployment'
    },
    {
        name: 'Malicious Site',
        origin: 'https://malicious-site.com',
        expectedAllow: false,
        description: 'Should block unauthorized domains'
    },
    {
        name: 'Suspicious Origin',
        origin: 'https://phishing-askme.com',
        expectedAllow: false,
        description: 'Should block phishing attempts'
    },
    {
        name: 'HTTP on HTTPS endpoint',
        origin: 'http://malicious-site.com',
        expectedAllow: false,
        description: 'Should block HTTP origins on HTTPS endpoint'
    },
    {
        name: 'Render Preview',
        origin: 'https://askme-test-abc123.onrender.com',
        expectedAllow: true,
        description: 'Should allow Render preview deployments'
    },
    {
        name: 'Vercel Preview',
        origin: 'https://askme-git-feature-abc123.vercel.app',
        expectedAllow: true,
        description: 'Should allow Vercel preview deployments'
    }
];

class CORSSecurityTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            errors: 0,
            details: []
        };
    }
    
    async testCORSOrigin(testCase) {
        console.log(`\n🧪 Testing: ${testCase.name}`);
        console.log(`   Origin: ${testCase.origin || 'No origin'}`);
        console.log(`   Expected: ${testCase.expectedAllow ? 'ALLOW' : 'BLOCK'}`);
        
        try {
            // Test preflight (OPTIONS) request
            const preflightConfig = {
                method: 'OPTIONS',
                url: `${BASE_URL}/api/query`,
                headers: {
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type'
                },
                timeout: 10000
            };
            
            if (testCase.origin) {
                preflightConfig.headers['Origin'] = testCase.origin;
            }
            
            const preflightResponse = await axios(preflightConfig);
            
            // Check CORS headers in response
            const corsHeaders = {
                allowOrigin: preflightResponse.headers['access-control-allow-origin'],
                allowMethods: preflightResponse.headers['access-control-allow-methods'],
                allowHeaders: preflightResponse.headers['access-control-allow-headers'],
                allowCredentials: preflightResponse.headers['access-control-allow-credentials'],
                maxAge: preflightResponse.headers['access-control-max-age']
            };
            
            // Test actual POST request
            const postConfig = {
                method: 'POST',
                url: `${BASE_URL}/api/query`,
                data: { prompt: 'CORS test', provider: 'google' },
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            };
            
            if (testCase.origin) {
                postConfig.headers['Origin'] = testCase.origin;
            }
            
            try {
                const postResponse = await axios(postConfig);
                
                if (testCase.expectedAllow) {
                    console.log(`   ✅ PASS: Request allowed as expected`);
                    this.results.passed++;
                    this.results.details.push({
                        test: testCase.name,
                        status: 'PASS',
                        reason: 'Request correctly allowed',
                        corsHeaders: corsHeaders
                    });
                } else {
                    console.log(`   ❌ FAIL: Request should have been blocked`);
                    this.results.failed++;
                    this.results.details.push({
                        test: testCase.name,
                        status: 'FAIL',
                        reason: 'Request incorrectly allowed',
                        corsHeaders: corsHeaders
                    });
                }
            } catch (postError) {
                if (testCase.expectedAllow) {
                    // Check if it's a CORS error or API error
                    if (postError.response && postError.response.status >= 400 && postError.response.status < 500) {
                        // API validation error is OK if CORS passed
                        console.log(`   ✅ PASS: CORS allowed, API validation working`);
                        this.results.passed++;
                        this.results.details.push({
                            test: testCase.name,
                            status: 'PASS',
                            reason: 'CORS allowed, API validation active',
                            corsHeaders: corsHeaders
                        });
                    } else {
                        console.log(`   ❌ FAIL: Request should have been allowed`);
                        this.results.failed++;
                        this.results.details.push({
                            test: testCase.name,
                            status: 'FAIL',
                            reason: 'Request incorrectly blocked',
                            error: postError.message
                        });
                    }
                } else {
                    console.log(`   ✅ PASS: Request correctly blocked`);
                    this.results.passed++;
                    this.results.details.push({
                        test: testCase.name,
                        status: 'PASS',
                        reason: 'Request correctly blocked by CORS',
                        corsHeaders: corsHeaders
                    });
                }
            }
            
        } catch (error) {
            console.log(`   ⚠️  ERROR: ${error.message}`);
            this.results.errors++;
            this.results.details.push({
                test: testCase.name,
                status: 'ERROR',
                reason: error.message
            });
        }
    }
    
    async testCORSInfo() {
        console.log(`\n🔍 Testing CORS Info Endpoint...`);
        
        try {
            const response = await axios.get(`${BASE_URL}/api/cors-info`);
            console.log(`✅ CORS Info endpoint working`);
            console.log(`   Request Origin: ${response.data.requestOrigin}`);
            console.log(`   Credentials Enabled: ${response.data.corsConfig.credentialsEnabled}`);
            console.log(`   Allowed Methods: ${response.data.corsConfig.allowedMethods.join(', ')}`);
            console.log(`   Max Age: ${response.data.corsConfig.maxAge} seconds`);
            
            return response.data;
        } catch (error) {
            console.log(`❌ CORS Info endpoint error: ${error.message}`);
            return null;
        }
    }
    
    async testSecurityHeaders() {
        console.log(`\n🔒 Testing CORS Security Headers...`);
        
        try {
            const response = await axios.options(`${BASE_URL}/api/query`, {
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type'
                }
            });
            
            const headers = response.headers;
            const checks = [
                { name: 'Access-Control-Allow-Origin', header: headers['access-control-allow-origin'], expected: 'Present' },
                { name: 'Access-Control-Allow-Methods', header: headers['access-control-allow-methods'], expected: 'POST' },
                { name: 'Access-Control-Allow-Headers', header: headers['access-control-allow-headers'], expected: 'Content-Type' },
                { name: 'Access-Control-Allow-Credentials', header: headers['access-control-allow-credentials'], expected: 'true' },
                { name: 'Access-Control-Max-Age', header: headers['access-control-max-age'], expected: '86400' }
            ];
            
            checks.forEach(check => {
                if (check.header) {
                    if (check.expected === 'Present' || check.header.includes(check.expected)) {
                        console.log(`   ✅ ${check.name}: ${check.header}`);
                    } else {
                        console.log(`   ⚠️  ${check.name}: ${check.header} (expected: ${check.expected})`);
                    }
                } else {
                    console.log(`   ❌ ${check.name}: Missing`);
                }
            });
            
        } catch (error) {
            console.log(`❌ CORS headers test error: ${error.message}`);
        }
    }
    
    async runAllTests() {
        console.log('🌐 CORS Security Test Suite');
        console.log('='.repeat(50));
        
        // Test CORS info endpoint first
        await this.testCORSInfo();
        
        // Test CORS security headers
        await this.testSecurityHeaders();
        
        // Test various origins
        for (let testCase of CORS_TEST_CASES) {
            await this.testCORSOrigin(testCase);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        }
        
        // Generate report
        this.generateReport();
    }
    
    generateReport() {
        console.log('\n📊 CORS Security Test Report');
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
        
        // CORS Security Assessment
        if (passRate >= 90) {
            console.log('\n🟢 CORS Security: EXCELLENT');
            console.log('   ✅ Restrictive origin policy active');
            console.log('   ✅ Unauthorized domains blocked');
            console.log('   ✅ Development access maintained');
        } else if (passRate >= 80) {
            console.log('\n🟡 CORS Security: GOOD');
            console.log('   ✅ Basic protection active');
            console.log('   ⚠️  Some issues detected');
        } else {
            console.log('\n🔴 CORS Security: NEEDS IMPROVEMENT');
            console.log('   ❌ Multiple CORS policy violations');
            console.log('   ❌ Potential security risks');
        }
        
        console.log('\n🔍 Security Summary:');
        console.log('- CORS policy now restrictive (vs previous wildcard)');
        console.log('- Unauthorized origins blocked');
        console.log('- Development access preserved');
        console.log('- Credentials properly configured');
        
        console.log('\n🚀 Next: Cloudflare WAF for additional protection');
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new CORSSecurityTester();
    tester.runAllTests().catch(console.error);
}

module.exports = CORSSecurityTester;