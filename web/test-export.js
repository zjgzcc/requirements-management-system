const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:8001';

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
                const isFile = res.headers['content-type']?.includes('application/vnd');
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: isFile ? body : JSON.parse(body),
                    isFile
                });
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testExport() {
    console.log('=== 测试模板导出功能 ===\n');

    // 登录
    const loginRes = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
    });
    const token = loginRes.data.data?.token || loginRes.data.token;
    console.log('✓ 登录成功\n');

    // 获取模板列表
    const templatesRes = await request('GET', '/api/templates', null, {
        'Authorization': `Bearer ${token}`
    });
    console.log('✓ 获取模板列表成功');
    console.log('  模板数量:', templatesRes.data.data?.length || 0);
    
    templatesRes.data.data.forEach(t => {
        console.log(`  - ${t.name} (${t.type}, ${t.visibility})`);
    });
    console.log();

    // 准备测试数据
    const testData = [
        {
            tcId: 'TC-001',
            title: '登录功能测试',
            precondition: '用户已注册',
            steps: '1. 打开登录页面\n2. 输入用户名和密码\n3. 点击登录',
            expectedResult: '登录成功，跳转到首页',
            priority: '高',
            testType: '功能测试'
        },
        {
            tcId: 'TC-002',
            title: '注册功能测试',
            precondition: '无',
            steps: '1. 打开注册页面\n2. 填写信息\n3. 提交',
            expectedResult: '注册成功，发送验证邮件',
            priority: '中',
            testType: '功能测试'
        }
    ];

    // 测试 Excel 导出
    const excelTemplate = templatesRes.data.data.find(t => t.type === 'excel');
    if (excelTemplate) {
        console.log(`测试 Excel 导出：${excelTemplate.name}`);
        const exportRes = await request(
            'GET', 
            `/api/templates/${excelTemplate.id}/export?data=${encodeURIComponent(JSON.stringify(testData))}`,
            null,
            { 'Authorization': `Bearer ${token}` }
        );
        
        if (exportRes.isFile) {
            console.log('  ✓ Excel 导出成功');
            console.log('  Content-Type:', exportRes.headers['content-type']);
            console.log('  Content-Disposition:', exportRes.headers['content-disposition']);
            
            // 保存文件
            const filename = exportRes.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || 'export.xlsx';
            fs.writeFileSync(`/tmp/${filename}`, exportRes.data, 'binary');
            console.log('  文件已保存到：/tmp/' + filename);
        } else {
            console.log('  ✗ Excel 导出失败:', exportRes.data);
        }
        console.log();
    }

    // 测试 Word 导出
    const wordTemplate = templatesRes.data.data.find(t => t.type === 'word');
    if (wordTemplate) {
        console.log(`测试 Word 导出：${wordTemplate.name}`);
        const wordData = testData.map(t => ({
            title: t.title,
            tcId: t.tcId,
            project: '测试项目',
            precondition: t.precondition,
            steps: t.steps,
            expectedResult: t.expectedResult,
            notes: '测试备注'
        }));
        
        const exportRes = await request(
            'GET', 
            `/api/templates/${wordTemplate.id}/export?data=${encodeURIComponent(JSON.stringify(wordData))}`,
            null,
            { 'Authorization': `Bearer ${token}` }
        );
        
        if (exportRes.isFile) {
            console.log('  ✓ Word 导出成功');
            console.log('  Content-Type:', exportRes.headers['content-type']);
            console.log('  Content-Disposition:', exportRes.headers['content-disposition']);
            
            const filename = exportRes.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || 'export.docx';
            fs.writeFileSync(`/tmp/${filename}`, exportRes.data, 'binary');
            console.log('  文件已保存到：/tmp/' + filename);
        } else {
            console.log('  ✗ Word 导出失败:', exportRes.data);
        }
        console.log();
    }

    console.log('=== 导出测试完成 ===');
}

testExport().catch(console.error);
