/**
 * 用例管理模块 API 测试脚本
 * 用于验证新增的 API 端点是否正常工作
 */

const http = require('http');

const API_BASE = 'http://localhost:8001/api';

// 测试函数
async function testEndpoint(method, path, expectedStatus = 200) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8001,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`✅ ${method} ${path}`);
                    console.log(`   状态：${res.statusCode}`);
                    if (json.success !== undefined) {
                        console.log(`   结果：${json.success ? '成功' : '失败'}`);
                    }
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    console.log(`✅ ${method} ${path}`);
                    console.log(`   状态：${res.statusCode}`);
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', (e) => {
            console.log(`❌ ${method} ${path}`);
            console.log(`   错误：${e.message}`);
            reject(e);
        });

        req.end();
    });
}

// 运行测试
async function runTests() {
    console.log('\n🧪 开始测试用例管理模块 API...\n');

    const tests = [
        // 基础 API
        ['GET', '/api/testcases'],
        ['GET', '/api/testcases?projectId=test'],
        ['GET', '/api/templates'],
        ['GET', '/api/history?type=testcase&limit=10'],
        
        // 批量导出 API
        ['GET', '/api/testcases/batch-export?format=json'],
        ['GET', '/api/testcases/batch-export?format=csv'],
    ];

    let passed = 0;
    let failed = 0;

    for (const [method, path] of tests) {
        try {
            await testEndpoint(method, path);
            passed++;
        } catch (e) {
            failed++;
        }
        console.log();
    }

    console.log('═══════════════════════════════════════');
    console.log(`测试结果：${passed} 通过，${failed} 失败`);
    console.log('═══════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

// 检查服务器是否运行
async function checkServer() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8001,
            path: '/api/testcases',
            method: 'GET',
            timeout: 2000
        }, () => resolve(true));

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        req.end();
    });
}

// 主函数
(async () => {
    const isRunning = await checkServer();
    
    if (!isRunning) {
        console.log('❌ 服务器未运行！');
        console.log('请先启动服务器：node api-server.js');
        console.log('或运行：npm start\n');
        process.exit(1);
    }

    await runTests();
})();
