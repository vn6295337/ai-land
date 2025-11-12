// Quick Security Test for Render Deployment
const axios = require('axios');

const BASE_URL = 'https://askme-backend-proxy.onrender.com';

async function quickSecurityTest() {
    console.log('🔍 Testing security on Render deployment...\n');
    
    // Test 1: XSS Protection
    try {
        const response = await axios.post(`${BASE_URL}/api/query`, {
            prompt: '<script>alert("xss")</script>',
            provider: 'google'
        });
        console.log('❌ XSS Test: FAILED - Request allowed');
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('✅ XSS Test: PASSED - Request blocked');
        } else {
            console.log(`⚠️  XSS Test: ERROR - ${error.message}`);
        }
    }
    
    // Test 2: Rate Limiting
    console.log('\n🔄 Testing rate limiting (may take a minute)...');
    const requests = [];
    for (let i = 0; i < 20; i++) {
        requests.push(
            axios.post(`${BASE_URL}/api/query`, {
                prompt: `Test ${i}`,
                provider: 'google'
            }).catch(e => e.response)
        );
    }
    
    const responses = await Promise.all(requests);
    const blocked = responses.filter(r => r?.status === 429).length;
    
    if (blocked > 0) {
        console.log(`✅ Rate Limiting: WORKING - ${blocked} requests blocked`);
    } else {
        console.log('⚠️  Rate Limiting: May need adjustment');
    }
    
    // Test 3: CORS Policy
    try {
        const response = await axios.options(`${BASE_URL}/api/query`, {
            headers: {
                'Origin': 'https://malicious-site.com'
            }
        });
        console.log('\n⚠️  CORS: May be too permissive');
    } catch (error) {
        console.log('\n✅ CORS: Properly configured');
    }
    
    // Test 4: Health Check
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        console.log('\n✅ Health Check: Service responding');
        console.log(`   Version: ${response.data.version}`);
        console.log(`   Providers: ${response.data.providers?.length || 0}`);
    } catch (error) {
        console.log('\n❌ Health Check: Service not responding');
    }
    
    console.log('\n📊 Security Test Complete');
}

quickSecurityTest().catch(console.error);