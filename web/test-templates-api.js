const http = require('http');

const BASE_URL = 'http://localhost:8001';

// 简单的 HTTP 请求封装
function request(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: body
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('=== 导出模板 API 测试 ===\n');

    // 1. 登录
    console.log('1. 测试登录...');
    const loginRes = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
    });
    console.log('   状态:', loginRes.status);
    console.log('   结果:', loginRes.data.success ? '✓ 登录成功' : '✗ 登录失败');
    
    if (!loginRes.data.success) {
        console.log('   错误:', loginRes.data.message);
        return;
    }

    const token = loginRes.data.data.token;
    const userId = loginRes.data.data.id;
    console.log('   Token:', token.substring(0, 20) + '...\n');

    // 2. 获取模板列表（未授权）
    console.log('2. 测试未授权访问...');
    const unauthRes = await request('GET', '/api/templates');
    console.log('   状态:', unauthRes.status);
    console.log('   结果:', unauthRes.status === 401 ? '✓ 正确拒绝未授权访问' : '✗ 权限检查失败');
    console.log('   消息:', unauthRes.data.message, '\n');

    // 3. 获取模板列表（已授权）
    console.log('3. 测试获取模板列表...');
    const templatesRes = await request('GET', '/api/templates?visibility=all', null, {
        'Authorization': `Bearer ${token}`
    });
    console.log('   状态:', templatesRes.status);
    console.log('   结果:', templatesRes.data.success ? '✓ 获取成功' : '✗ 获取失败');
    console.log('   模板数量:', templatesRes.data.data?.length || 0, '\n');

    // 4. 创建新模板
    console.log('4. 测试创建模板...');
    const newTemplate = {
        name: '测试导出模板',
        description: '这是一个测试模板',
        type: 'excel',
        visibility: 'private',
        fields: [
            { name: '用例 ID', key: 'tcId', type: 'text', width: 15 },
            { name: '用例名称', key: 'title', type: 'text', width: 30 },
            { name: '测试步骤', key: 'steps', type: 'richtext', width: 40 },
            { name: '预期结果', key: 'expectedResult', type: 'text', width: 30 }
        ],
        styles: {
            header: { bold: true, backgroundColor: '#4472C4', color: '#FFFFFF' },
            row: { height: 30 },
            border: true
        }
    };
    
    const createRes = await request('POST', '/api/templates', newTemplate, {
        'Authorization': `Bearer ${token}`
    });
    console.log('   状态:', createRes.status);
    console.log('   结果:', createRes.data.success ? '✓ 创建成功' : '✗ 创建失败');
    
    if (createRes.data.success) {
        const templateId = createRes.data.data.id;
        console.log('   模板 ID:', templateId);
        console.log('   模板名称:', createRes.data.data.name, '\n');

        // 5. 获取单个模板
        console.log('5. 测试获取单个模板...');
        const getRes = await request('GET', `/api/templates/${templateId}`, null, {
            'Authorization': `Bearer ${token}`
        });
        console.log('   状态:', getRes.status);
        console.log('   结果:', getRes.data.success ? '✓ 获取成功' : '✗ 获取失败');
        console.log('   字段数量:', getRes.data.data?.fields?.length || 0, '\n');

        // 6. 更新模板
        console.log('6. 测试更新模板...');
        const updateRes = await request('PUT', `/api/templates/${templateId}`, {
            name: '测试导出模板 - 已更新',
            description: '描述已更新'
        }, {
            'Authorization': `Bearer ${token}`
        });
        console.log('   状态:', updateRes.status);
        console.log('   结果:', updateRes.data.success ? '✓ 更新成功' : '✗ 更新失败');
        console.log('   新名称:', updateRes.data.data?.name, '\n');

        // 7. 删除模板
        console.log('7. 测试删除模板...');
        const deleteRes = await request('DELETE', `/api/templates/${templateId}`, null, {
            'Authorization': `Bearer ${token}`
        });
        console.log('   状态:', deleteRes.status);
        console.log('   结果:', deleteRes.data.success ? '✓ 删除成功' : '✗ 删除失败');
        console.log('   消息:', deleteRes.data.message, '\n');

        // 8. 验证删除
        console.log('8. 验证模板已删除...');
        const verifyRes = await request('GET', `/api/templates/${templateId}`, null, {
            'Authorization': `Bearer ${token}`
        });
        console.log('   状态:', verifyRes.status);
        console.log('   结果:', verifyRes.status === 404 ? '✓ 确认已删除' : '✗ 删除验证失败', '\n');
    }

    console.log('=== 测试完成 ===');
}

runTests().catch(console.error);
