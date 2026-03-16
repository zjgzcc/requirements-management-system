// ===== 需求管理系统 - API 服务器 =====
// 【基础设施模块】增强版：集成全局错误处理、日志记录、性能监控

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const formidable = require('formidable');

// 引入基础设施模块
const {
    ERROR_CODES,
    logRequest,
    logError,
    startPerformanceMonitor,
    markPerformance,
    endPerformanceMonitor,
    createErrorResponse,
    createSuccessResponse,
    errorHandler,
    validateRequest,
    getLogStats
} = require('./middleware');

const {
    handleSimpleUpload,
    initChunkedUpload,
    uploadChunk,
    mergeChunks,
    getUploadProgress,
    deleteUploadFile,
    UPLOADS_DIR
} = require('./file-upload');

const PORT = 8001;
const WEB_DIR = __dirname;
const DATA_FILE = path.join(__dirname, 'users.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const REQUIREMENTS_FILE = path.join(__dirname, 'requirements.json');
const TESTCASES_FILE = path.join(__dirname, 'testcases.json');
const TRACES_FILE = path.join(__dirname, 'traces.json');
const ID_COUNTER_FILE = path.join(__dirname, 'id_counter.json');
const BASELINES_FILE = path.join(__dirname, 'baselines.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const HEADERS_FILE = path.join(__dirname, 'headers.json');
const PREFIXES_FILE = path.join(__dirname, 'prefixes.json');

// MIME 类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 密码加密
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 初始化数据文件
function initializeFile(filePath, defaultData) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 初始化所有数据
let users = initializeFile(DATA_FILE, []);
let projects = initializeFile(PROJECTS_FILE, []);
let requirements = initializeFile(REQUIREMENTS_FILE, []);
let testcases = initializeFile(TESTCASES_FILE, []);
let traces = initializeFile(TRACES_FILE, []);
let baselines = initializeFile(BASELINES_FILE, []);
let history = initializeFile(HISTORY_FILE, []);
let headers = initializeFile(HEADERS_FILE, []);
let prefixes = initializeFile(PREFIXES_FILE, { requirement: 'REQ', testcase: 'TC' });
let idCounter = initializeFile(ID_COUNTER_FILE, { requirement: 0, testcase: 0 });

// 初始化默认用户
if (users.length === 0) {
    users.push({
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        password: hashPassword('admin123'),
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString()
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

// 保存数据
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
    fs.writeFileSync(REQUIREMENTS_FILE, JSON.stringify(requirements, null, 2));
    fs.writeFileSync(TESTCASES_FILE, JSON.stringify(testcases, null, 2));
    fs.writeFileSync(TRACES_FILE, JSON.stringify(traces, null, 2));
    fs.writeFileSync(BASELINES_FILE, JSON.stringify(baselines, null, 2));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    fs.writeFileSync(HEADERS_FILE, JSON.stringify(headers, null, 2));
    fs.writeFileSync(PREFIXES_FILE, JSON.stringify(prefixes, null, 2));
    fs.writeFileSync(ID_COUNTER_FILE, JSON.stringify(idCounter, null, 2));
}

// 生成唯一 ID
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 提取关键词（用于智能推荐）
function extractKeywords(text) {
    // 中文分词简化版：按标点符号和空格分割
    const words = text.split(/[\s,，.。;；:：!?！？、|()（）""''""'']+/).filter(w => w.length > 1);
    
    // 去除常见停用词
    const stopWords = new Set(['的', '了', '是', '在', '和', '与', '及', '等', '个', '这', '那', '之', '一个', '以及', '或者', '是否', '可以', '应该', '需要', '进行', '实现', '功能', '系统', '用户', '数据']);
    
    const keywords = new Set();
    words.forEach(word => {
        if (!stopWords.has(word) && word.length >= 2) {
            keywords.add(word);
        }
    });
    
    return keywords;
}

// ===== 基线对比辅助函数 - 查找两个对象之间的差异 =====
function findChanges(oldObj, newObj) {
    const changes = [];
    
    // 需要比较的关键字段
    const fieldsToCompare = ['description', 'acceptanceCriteria', 'steps', 'expectedResult', 'richContent'];
    
    fieldsToCompare.forEach(field => {
        const oldValue = oldObj[field];
        const newValue = newObj[field];
        
        if (oldValue !== newValue) {
            changes.push({
                field,
                oldValue: oldValue || '',
                newValue: newValue || ''
            });
        }
    });
    
    return changes;
}

// ===== 基线导出辅助函数 - 生成 PDF 友好的 HTML 内容 =====
function generateBaselinePDF(baseline, allRequirements, allTestcases) {
    const itemType = baseline.type === 'requirement' ? '需求' : '用例';
    const exportTime = new Date().toLocaleString('zh-CN');
    
    // 构建 HTML 内容
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>基线导出 - ${baseline.version} ${baseline.name}</title>
    <style>
        body {
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .header .info {
            color: #666;
            font-size: 14px;
        }
        .summary {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .summary h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
        }
        .summary p {
            margin: 5px 0;
            font-size: 14px;
        }
        .item {
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            page-break-inside: avoid;
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e1e1e1;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .item-id {
            font-weight: bold;
            color: #2c3e50;
            font-size: 16px;
        }
        .item-desc {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        .item-content {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-size: 14px;
            white-space: pre-wrap;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e1e1e1;
            color: #999;
            font-size: 12px;
        }
        @media print {
            body { max-width: 100%; }
            .item { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📌 基线版本报告</h1>
        <div class="info">
            <p><strong>版本：</strong>${baseline.version}</p>
            <p><strong>名称：</strong>${baseline.name}</p>
            <p><strong>类型：</strong>${itemType}</p>
            <p><strong>导出时间：</strong>${exportTime}</p>
        </div>
    </div>
    
    <div class="summary">
        <h3>📊 概要统计</h3>
        <p><strong>项目 ID：</strong> ${baseline.projectId}</p>
        <p><strong>包含项数：</strong> ${baseline.items.length}</p>
        <p><strong>创建人：</strong> ${baseline.createdBy || '未知'}</p>
        <p><strong>创建时间：</strong> ${new Date(baseline.createdAt).toLocaleString('zh-CN')}</p>
    </div>
    
    <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">📋 ${itemType}清单</h2>
`;

    // 添加每个项的详细内容
    baseline.items.forEach((item, index) => {
        const snapshot = item.snapshot;
        let content = '';
        
        if (baseline.type === 'requirement') {
            content = `
                <p><strong>描述：</strong>${item.description || '无'}</p>
                <p><strong>验收标准：</strong>${snapshot.acceptanceCriteria || '无'}</p>
                ${snapshot.richContent ? `<div class="item-content">${snapshot.richContent}</div>` : ''}
            `;
        } else {
            content = `
                <p><strong>操作步骤：</strong>${snapshot.steps || '无'}</p>
                <p><strong>预期结果：</strong>${snapshot.expectedResult || '无'}</p>
                ${snapshot.richContent ? `<div class="item-content">${snapshot.richContent}</div>` : ''}
            `;
        }
        
        html += `
    <div class="item">
        <div class="item-header">
            <span class="item-id">${item.reqId}</span>
            <span style="color: #999; font-size: 12px;">#${index + 1}</span>
        </div>
        <div class="item-desc">${item.description || '无描述'}</div>
        ${content}
    </div>
`;
    });

    html += `
    <div class="footer">
        <p>此报告由需求管理系统自动生成</p>
        <p>生成时间：${exportTime}</p>
    </div>
</body>
</html>`;

    return html;
}

// 获取下一个自增 ID
function getNextId(type) {
    idCounter[type] = (idCounter[type] || 0) + 1;
    fs.writeFileSync(ID_COUNTER_FILE, JSON.stringify(idCounter, null, 2));
    return idCounter[type];
}

// 记录修改历史
function recordHistory(type, itemId, action, changes, userId = 'system') {
    const record = {
        id: generateUniqueId(),
        type, // 'requirement' or 'testcase'
        itemId,
        action, // 'create', 'update', 'delete', 'baseline'
        changes,
        userId,
        timestamp: new Date().toISOString()
    };
    history.push(record);
    // 保留最近 1000 条记录
    if (history.length > 1000) {
        history = history.slice(-1000);
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    return record;
}

// 解析 JSON 请求体
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

// JSON 响应辅助函数
function jsonRes(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
}

// API 路由处理
async function handleApiRequest(req, res, fullUrl) {
    const url = fullUrl.split('?')[0];
    const method = req.method;
    
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // ===== 用户管理 API =====
        if (url === '/api/login' && method === 'POST') {
            const body = await parseBody(req);
            const { username, password } = body;

            if (!username || !password) {
                return jsonRes(res, 400, { success: false, message: '用户名和密码不能为空' });
            }

            const user = users.find(u => u.username === username && u.password === hashPassword(password));

            if (user) {
                if (user.status !== 'active') {
                    return jsonRes(res, 403, { success: false, message: '账户已被禁用' });
                }
                const { password: _, ...userWithoutPassword } = user;
                return jsonRes(res, 200, {
                    success: true,
                    message: '登录成功',
                    data: userWithoutPassword
                });
            } else {
                return jsonRes(res, 401, { success: false, message: '用户名或密码错误' });
            }
        }

        if (url === '/api/users' && method === 'GET') {
            const usersWithoutPassword = users.map(({ password, ...user }) => user);
            return jsonRes(res, 200, { success: true, data: usersWithoutPassword });
        }

        if (url === '/api/users' && method === 'POST') {
            const body = await parseBody(req);
            const { username, email, password, role, status } = body;

            if (!username || !password) {
                return jsonRes(res, 400, { success: false, message: '用户名和密码不能为空' });
            }
            if (username.length < 3 || username.length > 20) {
                return jsonRes(res, 400, { success: false, message: '用户名长度必须在 3-20 个字符之间' });
            }
            if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
                return jsonRes(res, 400, { success: false, message: '用户名必须以字母开头，只能包含字母、数字和下划线' });
            }
            if (users.find(u => u.username === username)) {
                return jsonRes(res, 400, { success: false, message: '用户名已存在' });
            }
            if (password.length < 6) {
                return jsonRes(res, 400, { success: false, message: '密码至少 6 个字符' });
            }

            const newUser = {
                id: generateUniqueId(),
                username,
                email: email || '',
                password: hashPassword(password),
                role: role || 'user',
                status: status || 'active',
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            saveData();

            const { password: _, ...userWithoutPassword } = newUser;
            return jsonRes(res, 201, { success: true, message: '用户创建成功', data: userWithoutPassword });
        }

        if (url.match(/^\/api\/users\/[^\/]+$/) && method === 'PUT') {
            const userId = url.split('/')[3];
            const body = await parseBody(req);
            const userIndex = users.findIndex(u => u.id === userId);
            
            if (userIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '用户不存在' });
            }

            const { username, email, password, role, status } = body;
            if (username) {
                if (users.find(u => u.username === username && u.id !== userId)) {
                    return jsonRes(res, 400, { success: false, message: '用户名已存在' });
                }
                users[userIndex].username = username;
            }
            if (email !== undefined) users[userIndex].email = email;
            if (password) users[userIndex].password = hashPassword(password);
            if (role) users[userIndex].role = role;
            if (status) users[userIndex].status = status;

            saveData();
            const { password: _, ...userWithoutPassword } = users[userIndex];
            return jsonRes(res, 200, { success: true, message: '用户更新成功', data: userWithoutPassword });
        }

        if (url.match(/^\/api\/users\/[^\/]+$/) && method === 'DELETE') {
            const userId = url.split('/')[3];
            const userIndex = users.findIndex(u => u.id === userId);
            
            if (userIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '用户不存在' });
            }

            const adminCount = users.filter(u => u.role === 'admin').length;
            if (users[userIndex].role === 'admin' && adminCount === 1) {
                return jsonRes(res, 400, { success: false, message: '至少保留一个管理员账号' });
            }

            users.splice(userIndex, 1);
            saveData();
            return jsonRes(res, 200, { success: true, message: '用户已删除' });
        }

        // ===== 项目管理 API =====
        if (url === '/api/projects' && method === 'GET') {
            return jsonRes(res, 200, { success: true, data: projects });
        }

        if (url === '/api/projects' && method === 'POST') {
            const body = await parseBody(req);
            const { name, description, owner } = body;

            if (!name) {
                return jsonRes(res, 400, { success: false, message: '项目名称不能为空' });
            }

            const newProject = {
                id: generateUniqueId(),
                name,
                description: description || '',
                owner: owner || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            projects.push(newProject);
            saveData();
            return jsonRes(res, 201, { success: true, message: '项目创建成功', data: newProject });
        }

        if (url.match(/^\/api\/projects\/[^\/]+$/) && method === 'PUT') {
            const projectId = url.split('/')[3];
            const body = await parseBody(req);
            const projectIndex = projects.findIndex(p => p.id === projectId);
            
            if (projectIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '项目不存在' });
            }

            const { name, description, owner } = body;
            if (name) projects[projectIndex].name = name;
            if (description !== undefined) projects[projectIndex].description = description;
            if (owner !== undefined) projects[projectIndex].owner = owner;
            projects[projectIndex].updatedAt = new Date().toISOString();

            saveData();
            return jsonRes(res, 200, { success: true, message: '项目更新成功', data: projects[projectIndex] });
        }

        if (url.match(/^\/api\/projects\/[^\/]+$/) && method === 'DELETE') {
            const projectId = url.split('/')[3];
            const projectIndex = projects.findIndex(p => p.id === projectId);
            
            if (projectIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '项目不存在' });
            }

            projects.splice(projectIndex, 1);
            saveData();
            return jsonRes(res, 200, { success: true, message: '项目已删除' });
        }

        // ===== 需求管理 API =====
        if (url === '/api/requirements' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            let filteredRequirements = requirements;
            if (projectId) {
                filteredRequirements = requirements.filter(r => r.projectId === projectId);
            }
            
            return jsonRes(res, 200, { success: true, data: filteredRequirements });
        }

        if (url === '/api/requirements' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, prefix, description, acceptanceCriteria, headerId, savePrefix, richContent } = body;

            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            const nextId = getNextId('requirement');
            const reqId = prefix ? `${prefix}-${nextId}` : `REQ-${nextId}`;

            const newRequirement = {
                id: generateUniqueId(),
                reqId,
                projectId,
                prefix: prefix || 'REQ',
                description: description || '',
                acceptanceCriteria: acceptanceCriteria || '',
                headerId: headerId || null,
                richContent: richContent || null,
                attachments: [],
                columns: columns || [{ id: generateUniqueId(), name: '描述', type: 'text', value: description || '' }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            requirements.push(newRequirement);
            recordHistory('requirement', newRequirement.id, 'create', { description, acceptanceCriteria, richContent });
            
            if (savePrefix && prefix) {
                prefixes.requirement = prefix;
            }
            
            saveData();

            return jsonRes(res, 201, { success: true, message: '需求创建成功', data: newRequirement });
        }

        if (url.match(/^\/api\/requirements\/[^\/]+$/) && method === 'PUT') {
            const reqId = url.split('/')[3];
            const body = await parseBody(req);
            const reqIndex = requirements.findIndex(r => r.id === reqId);
            
            if (reqIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '需求不存在' });
            }

            const oldData = { ...requirements[reqIndex] };
            const { description, acceptanceCriteria, headerId, columns } = body;
            if (description !== undefined) requirements[reqIndex].description = description;
            if (acceptanceCriteria !== undefined) requirements[reqIndex].acceptanceCriteria = acceptanceCriteria;
            if (headerId !== undefined) requirements[reqIndex].headerId = headerId;
            if (columns !== undefined) requirements[reqIndex].columns = columns;
            requirements[reqIndex].updatedAt = new Date().toISOString();

            recordHistory('requirement', reqId, 'update', { oldData, newData: { description, acceptanceCriteria, headerId } });
            saveData();

            return jsonRes(res, 200, { success: true, message: '需求更新成功', data: requirements[reqIndex] });
        }

        if (url.match(/^\/api\/requirements\/[^\/]+$/) && method === 'DELETE') {
            const reqId = url.split('/')[3];
            const reqIndex = requirements.findIndex(r => r.id === reqId);
            
            if (reqIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '需求不存在' });
            }

            recordHistory('requirement', reqId, 'delete', { deletedData: requirements[reqIndex] });
            
            traces = traces.filter(t => t.requirementId !== reqId);
            requirements.splice(reqIndex, 1);
            saveData();

            return jsonRes(res, 200, { success: true, message: '需求已删除' });
        }

        // ===== 用例管理 API =====
        if (url === '/api/testcases' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            let filteredTestcases = testcases;
            if (projectId) {
                filteredTestcases = testcases.filter(t => t.projectId === projectId);
            }
            
            return jsonRes(res, 200, { success: true, data: filteredTestcases });
        }

        if (url === '/api/testcases' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, prefix, steps, expectedResult, headerId, savePrefix, richContent } = body;

            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            const nextId = getNextId('testcase');
            const tcId = prefix ? `${prefix}-${nextId}` : `TC-${nextId}`;

            const newTestcase = {
                id: generateUniqueId(),
                tcId,
                projectId,
                prefix: prefix || 'TC',
                steps: steps || '',
                expectedResult: expectedResult || '',
                headerId: headerId || null,
                richContent: richContent || null,
                attachments: [],
                columns: columns || [
                    { id: generateUniqueId(), name: '操作步骤', type: 'text', value: steps || '' },
                    { id: generateUniqueId(), name: '预期结果', type: 'text', value: expectedResult || '' }
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            testcases.push(newTestcase);
            recordHistory('testcase', newTestcase.id, 'create', { steps, expectedResult, richContent });
            
            if (savePrefix && prefix) {
                prefixes.testcase = prefix;
            }
            
            saveData();

            return jsonRes(res, 201, { success: true, message: '用例创建成功', data: newTestcase });
        }

        if (url.match(/^\/api\/testcases\/[^\/]+$/) && method === 'PUT') {
            const tcId = url.split('/')[3];
            const body = await parseBody(req);
            const tcIndex = testcases.findIndex(t => t.id === tcId);
            
            if (tcIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '用例不存在' });
            }

            const oldData = { ...testcases[tcIndex] };
            const { steps, expectedResult, columns } = body;
            if (steps !== undefined) testcases[tcIndex].steps = steps;
            if (expectedResult !== undefined) testcases[tcIndex].expectedResult = expectedResult;
            if (columns !== undefined) testcases[tcIndex].columns = columns;
            testcases[tcIndex].updatedAt = new Date().toISOString();

            recordHistory('testcase', tcId, 'update', { oldData, newData: { steps, expectedResult, columns } });
            saveData();

            return jsonRes(res, 200, { success: true, message: '用例更新成功', data: testcases[tcIndex] });
        }

        if (url.match(/^\/api\/testcases\/[^\/]+$/) && method === 'DELETE') {
            const tcId = url.split('/')[3];
            const tcIndex = testcases.findIndex(t => t.id === tcId);
            
            if (tcIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '用例不存在' });
            }

            recordHistory('testcase', tcId, 'delete', { deletedData: testcases[tcIndex] });
            
            traces = traces.filter(t => t.testcaseId !== tcId);
            testcases.splice(tcIndex, 1);
            saveData();

            return jsonRes(res, 200, { success: true, message: '用例已删除' });
        }

        // ===== 追踪关系 API =====
        if (url === '/api/traces' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            let filteredTraces = traces;
            if (projectId) {
                const projectReqIds = requirements.filter(r => r.projectId === projectId).map(r => r.id);
                const projectTcIds = testcases.filter(t => t.projectId === projectId).map(t => t.id);
                filteredTraces = traces.filter(t => 
                    projectReqIds.includes(t.requirementId) && projectTcIds.includes(t.testcaseId)
                );
            }
            
            return jsonRes(res, 200, { success: true, data: filteredTraces });
        }

        if (url === '/api/traces' && method === 'POST') {
            const body = await parseBody(req);
            const { requirementId, testcaseId } = body;

            if (!requirementId || !testcaseId) {
                return jsonRes(res, 400, { success: false, message: '需求和用例 ID 不能为空' });
            }

            const existing = traces.find(t => t.requirementId === requirementId && t.testcaseId === testcaseId);
            if (existing) {
                return jsonRes(res, 400, { success: false, message: '追踪关系已存在' });
            }

            const newTrace = {
                id: generateUniqueId(),
                requirementId,
                testcaseId,
                createdAt: new Date().toISOString()
            };

            traces.push(newTrace);
            saveData();

            return jsonRes(res, 201, { success: true, message: '追踪关系创建成功', data: newTrace });
        }

        if (url.match(/^\/api\/traces\/[^\/]+$/) && method === 'DELETE') {
            const traceId = url.split('/')[3];
            const traceIndex = traces.findIndex(t => t.id === traceId);
            
            if (traceIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '追踪关系不存在' });
            }

            traces.splice(traceIndex, 1);
            saveData();

            return jsonRes(res, 200, { success: true, message: '追踪关系已删除' });
        }

        // ===== 批量创建追踪关系 API =====
        if (url === '/api/traces/batch' && method === 'POST') {
            const body = await parseBody(req);
            const { traces: batchTraces } = body;

            if (!batchTraces || !Array.isArray(batchTraces) || batchTraces.length === 0) {
                return jsonRes(res, 400, { success: false, message: '批量追踪数据不能为空' });
            }

            const results = {
                success: [],
                failed: [],
                duplicates: []
            };

            batchTraces.forEach(item => {
                const { requirementId, testcaseId } = item;
                
                if (!requirementId || !testcaseId) {
                    results.failed.push({ requirementId, testcaseId, reason: '需求和用例 ID 不能为空' });
                    return;
                }

                const existing = traces.find(t => t.requirementId === requirementId && t.testcaseId === testcaseId);
                if (existing) {
                    results.duplicates.push({ requirementId, testcaseId, traceId: existing.id });
                    return;
                }

                const newTrace = {
                    id: generateUniqueId(),
                    requirementId,
                    testcaseId,
                    createdAt: new Date().toISOString()
                };

                traces.push(newTrace);
                results.success.push(newTrace);
            });

            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: `批量创建完成：成功${results.success.length}条，重复${results.duplicates.length}条，失败${results.failed.length}条`,
                data: results 
            });
        }

        // ===== 智能推荐追踪关系 API =====
        if (url === '/api/traces/recommend' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const requirementId = urlObj.searchParams.get('requirementId');
            const projectId = urlObj.searchParams.get('projectId');
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            const projectReqs = requirements.filter(r => r.projectId === projectId);
            const projectTcs = testcases.filter(t => t.projectId === projectId);
            
            // 获取指定需求或所有需求
            let targetReqs = projectReqs;
            if (requirementId) {
                targetReqs = projectReqs.filter(r => r.id === requirementId);
            }

            const recommendations = [];

            targetReqs.forEach(req => {
                // 提取需求的关键词（从描述和富文本中）
                const reqText = `${req.description || ''} ${req.richContent || ''}`.toLowerCase();
                const reqKeywords = extractKeywords(reqText);

                // 获取该需求已关联的用例 ID
                const existingTcIds = new Set(
                    traces.filter(t => t.requirementId === req.id).map(t => t.testcaseId)
                );

                projectTcs.forEach(tc => {
                    // 跳过已关联的用例
                    if (existingTcIds.has(tc.id)) return;

                    // 提取用例的关键词
                    const tcText = `${tc.steps || ''} ${tc.expectedResult || ''} ${tc.richContent || ''}`.toLowerCase();
                    const tcKeywords = extractKeywords(tcText);

                    // 计算关键词匹配度
                    const matchCount = reqKeywords.filter(k => tcKeywords.has(k)).length;
                    
                    if (matchCount > 0) {
                        recommendations.push({
                            requirementId: req.id,
                            requirementDesc: req.description,
                            testcaseId: tc.id,
                            testcaseSteps: tc.steps,
                            matchScore: matchCount,
                            matchedKeywords: reqKeywords.filter(k => tcKeywords.has(k)).slice(0, 5)
                        });
                    }
                });
            });

            // 按匹配度排序，返回前 50 条推荐
            recommendations.sort((a, b) => b.matchScore - a.matchScore);
            const topRecommendations = recommendations.slice(0, 50);

            return jsonRes(res, 200, { 
                success: true, 
                data: topRecommendations 
            });
        }

        // ===== 追踪矩阵 API =====
        if (url === '/api/trace-matrix' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const page = parseInt(urlObj.searchParams.get('page') || '1');
            const pageSize = parseInt(urlObj.searchParams.get('pageSize') || '20');
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            const projectReqs = requirements.filter(r => r.projectId === projectId);
            const projectTcs = testcases.filter(t => t.projectId === projectId);
            
            // 构建追踪矩阵数据结构
            const matrix = {
                projectId,
                requirements: projectReqs.map(r => ({ 
                    id: r.id, 
                    reqId: r.reqId, 
                    description: r.description,
                    headerId: r.headerId
                })),
                testcases: projectTcs.map(t => ({ 
                    id: t.id, 
                    tcId: t.tcId, 
                    steps: t.steps,
                    headerId: t.headerId
                })),
                // 追踪关系映射表：key = "reqId:tcId", value = trace 对象
                traceMap: {}
            };
            
            // 将追踪关系转换为映射表，便于前端快速查询
            traces.forEach(t => {
                const req = projectReqs.find(r => r.id === t.requirementId);
                const tc = projectTcs.find(tc => tc.id === t.testcaseId);
                if (req && tc) {
                    const key = `${req.id}:${tc.id}`;
                    matrix.traceMap[key] = {
                        traceId: t.id,
                        requirementId: t.requirementId,
                        testcaseId: t.testcaseId,
                        createdAt: t.createdAt
                    };
                }
            });
            
            // 统计信息
            matrix.stats = {
                totalRequirements: projectReqs.length,
                totalTestcases: projectTcs.length,
                totalTraces: Object.keys(matrix.traceMap).length,
                coveredRequirements: new Set(projectReqs.filter(r => 
                    Object.keys(matrix.traceMap).some(k => k.startsWith(r.id + ':'))
                ).map(r => r.id)).size,
                coveredTestcases: new Set(projectTcs.filter(tc => 
                    Object.keys(matrix.traceMap).some(k => k.endsWith(':' + tc.id))
                ).map(tc => tc.id)).size
            };

            // 分页处理（针对需求列表）
            const totalReqs = matrix.requirements.length;
            const totalPages = Math.ceil(totalReqs / pageSize);
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            
            matrix.requirements = matrix.requirements.slice(startIndex, endIndex);
            matrix.pagination = {
                page,
                pageSize,
                totalItems: totalReqs,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            };

            return jsonRes(res, 200, { success: true, data: matrix });
        }

        // ===== 导出追踪矩阵 API =====
        if (url === '/api/trace-matrix/export' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const format = urlObj.searchParams.get('format') || 'csv';
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            const projectReqs = requirements.filter(r => r.projectId === projectId);
            const projectTcs = testcases.filter(t => t.projectId === projectId);
            
            // 构建完整的追踪矩阵数据
            const matrixData = [];
            
            projectReqs.forEach(req => {
                const relatedTraces = traces.filter(t => t.requirementId === req.id);
                const relatedTcs = relatedTraces.map(t => 
                    projectTcs.find(tc => tc.id === t.testcaseId)
                ).filter(tc => tc);
                
                if (relatedTcs.length > 0) {
                    relatedTcs.forEach(tc => {
                        matrixData.push({
                            requirementId: req.reqId,
                            requirementDescription: req.description,
                            testcaseId: tc.tcId,
                            testcaseSteps: tc.steps,
                            testcaseResult: tc.expectedResult,
                            traceCreatedAt: relatedTraces.find(t => t.testcaseId === tc.id)?.createdAt
                        });
                    });
                } else {
                    // 未覆盖的需求
                    matrixData.push({
                        requirementId: req.reqId,
                        requirementDescription: req.description,
                        testcaseId: '-',
                        testcaseSteps: '-',
                        testcaseResult: '-',
                        traceCreatedAt: '-'
                    });
                }
            });
            
            if (format === 'json') {
                return jsonRes(res, 200, { 
                    success: true, 
                    data: matrixData,
                    stats: {
                        totalRequirements: projectReqs.length,
                        totalTestcases: projectTcs.length,
                        coveredRequirements: matrixData.filter(r => r.testcaseId !== '-').length,
                        uncoveredRequirements: matrixData.filter(r => r.testcaseId === '-').length
                    }
                });
            } else {
                // CSV 格式
                let csv = '需求 ID，需求描述，用例 ID，操作步骤，预期结果，追踪创建时间\n';
                matrixData.forEach(row => {
                    csv += `"${row.requirementId}","${(row.requirementDescription || '').replace(/"/g, '""')}","${row.testcaseId}","${(row.testcaseSteps || '').replace(/"/g, '""')}","${(row.testcaseResult || '').replace(/"/g, '""')}","${row.traceCreatedAt}"\n`;
                });
                
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="trace_matrix_${new Date().toISOString().split('T')[0]}.csv"`);
                res.writeHead(200);
                res.end('\ufeff' + csv);
                return;
            }
        }

        // ===== 基线版本 API =====
        if (url === '/api/baselines' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const type = urlObj.searchParams.get('type'); // 'requirement' or 'testcase'
            
            let filteredBaselines = baselines;
            if (projectId) {
                filteredBaselines = baselines.filter(b => b.projectId === projectId);
            }
            if (type) {
                filteredBaselines = filteredBaselines.filter(b => b.type === type);
            }
            
            return jsonRes(res, 200, { success: true, data: filteredBaselines });
        }

        if (url === '/api/baselines' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, type, name, version, itemIds } = body;

            if (!projectId || !name || !itemIds || itemIds.length === 0) {
                return jsonRes(res, 400, { success: false, message: '参数不完整' });
            }

            const items = type === 'requirement' 
                ? requirements.filter(r => itemIds.includes(r.id))
                : testcases.filter(t => itemIds.includes(t.id));

            const newBaseline = {
                id: generateUniqueId(),
                projectId,
                type,
                name,
                version: version || 'V1',
                items: items.map(item => ({
                    id: item.id,
                    reqId: item.reqId || item.tcId,
                    description: item.description || item.steps,
                    snapshot: JSON.parse(JSON.stringify(item))
                })),
                createdAt: new Date().toISOString(),
                createdBy: 'admin'
            };

            baselines.push(newBaseline);
            recordHistory(type, 'baseline', 'baseline', { baselineId: newBaseline.id, name, version });
            saveData();

            return jsonRes(res, 201, { success: true, message: '基线创建成功', data: newBaseline });
        }

        if (url.match(/^\/api\/baselines\/[^\/]+$/) && method === 'GET') {
            const baselineId = url.split('/')[3];
            const baseline = baselines.find(b => b.id === baselineId);
            
            if (!baseline) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            return jsonRes(res, 200, { success: true, data: baseline });
        }

        if (url.match(/^\/api\/baselines\/[^\/]+$/) && method === 'DELETE') {
            const baselineId = url.split('/')[3];
            const baselineIndex = baselines.findIndex(b => b.id === baselineId);
            
            if (baselineIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            baselines.splice(baselineIndex, 1);
            saveData();

            return jsonRes(res, 200, { success: true, message: '基线已删除' });
        }

        // ===== 基线对比 API - 比较两个基线版本的差异 =====
        if (url === '/api/baselines/compare' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const baselineId1 = urlObj.searchParams.get('baselineId1');
            const baselineId2 = urlObj.searchParams.get('baselineId2');
            
            if (!baselineId1 || !baselineId2) {
                return jsonRes(res, 400, { success: false, message: '缺少基线 ID 参数' });
            }

            const baseline1 = baselines.find(b => b.id === baselineId1);
            const baseline2 = baselines.find(b => b.id === baselineId2);
            
            if (!baseline1) {
                return jsonRes(res, 404, { success: false, message: '基线 1 不存在' });
            }
            if (!baseline2) {
                return jsonRes(res, 404, { success: false, message: '基线 2 不存在' });
            }

            // 构建对比结果
            const compareResult = {
                baseline1: { id: baseline1.id, version: baseline1.version, name: baseline1.name },
                baseline2: { id: baseline2.id, version: baseline2.version, name: baseline2.name },
                added: [],    // 在 baseline2 中新增的项
                removed: [],  // 在 baseline2 中删除的项
                modified: [], // 在 baseline2 中修改的项
                unchanged: [] // 未变化的项
            };

            // 创建 baseline1 的项映射
            const baseline1Map = new Map();
            baseline1.items.forEach(item => {
                baseline1Map.set(item.id, item);
            });

            // 创建 baseline2 的项映射
            const baseline2Map = new Map();
            baseline2.items.forEach(item => {
                baseline2Map.set(item.id, item);
            });

            // 查找删除和修改的项
            baseline1.items.forEach(item1 => {
                const item2 = baseline2Map.get(item1.id);
                if (!item2) {
                    // 在 baseline2 中被删除
                    compareResult.removed.push({
                        id: item1.id,
                        reqId: item1.reqId,
                        description: item1.description,
                        snapshot: item1.snapshot
                    });
                } else {
                    // 检查是否有修改
                    const hasChanges = JSON.stringify(item1.snapshot) !== JSON.stringify(item2.snapshot);
                    if (hasChanges) {
                        compareResult.modified.push({
                            id: item1.id,
                            reqId: item1.reqId,
                            description: item1.description,
                            oldSnapshot: item1.snapshot,
                            newSnapshot: item2.snapshot,
                            changes: findChanges(item1.snapshot, item2.snapshot)
                        });
                    } else {
                        compareResult.unchanged.push({
                            id: item1.id,
                            reqId: item1.reqId,
                            description: item1.description
                        });
                    }
                }
            });

            // 查找新增的项
            baseline2.items.forEach(item2 => {
                if (!baseline1Map.has(item2.id)) {
                    compareResult.added.push({
                        id: item2.id,
                        reqId: item2.reqId,
                        description: item2.description,
                        snapshot: item2.snapshot
                    });
                }
            });

            return jsonRes(res, 200, { 
                success: true, 
                data: compareResult,
                stats: {
                    added: compareResult.added.length,
                    removed: compareResult.removed.length,
                    modified: compareResult.modified.length,
                    unchanged: compareResult.unchanged.length,
                    total1: baseline1.items.length,
                    total2: baseline2.items.length
                }
            });
        }

        // ===== 基线恢复 API - 将当前数据恢复到某个基线版本 =====
        if (url.match(/^\/api\/baselines\/[^\/]+\/restore$/) && method === 'POST') {
            const baselineId = url.split('/')[3];
            const baseline = baselines.find(b => b.id === baselineId);
            
            if (!baseline) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            // 恢复数据
            const targetType = baseline.type === 'requirement' ? requirements : testcases;
            const restoredCount = [];
            
            baseline.items.forEach(baselineItem => {
                const currentIndex = targetType.findIndex(item => item.id === baselineItem.id);
                
                if (currentIndex !== -1) {
                    // 更新现有项
                    const oldData = JSON.parse(JSON.stringify(targetType[currentIndex]));
                    targetType[currentIndex] = JSON.parse(JSON.stringify(baselineItem.snapshot));
                    targetType[currentIndex].updatedAt = new Date().toISOString();
                    restoredCount.push({ id: baselineItem.id, action: 'updated', reqId: baselineItem.reqId });
                    recordHistory(baseline.type, baselineItem.id, 'restore', { 
                        oldData, 
                        newData: baselineItem.snapshot,
                        baselineId,
                        baselineVersion: baseline.version
                    });
                } else {
                    // 添加缺失项
                    const newItem = JSON.parse(JSON.stringify(baselineItem.snapshot));
                    newItem.updatedAt = new Date().toISOString();
                    targetType.push(newItem);
                    restoredCount.push({ id: baselineItem.id, action: 'restored', reqId: baselineItem.reqId });
                    recordHistory(baseline.type, baselineItem.id, 'restore', { 
                        action: 'restored',
                        newData: baselineItem.snapshot,
                        baselineId,
                        baselineVersion: baseline.version
                    });
                }
            });

            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: `成功恢复 ${restoredCount.length} 项`,
                data: {
                    baselineId,
                    version: baseline.version,
                    name: baseline.name,
                    type: baseline.type,
                    restoredItems: restoredCount
                }
            });
        }

        // ===== 基线导出 API - 导出基线为 PDF =====
        if (url.match(/^\/api\/baselines\/[^\/]+\/export$/) && method === 'GET') {
            const baselineId = url.split('/')[3];
            const baseline = baselines.find(b => b.id === baselineId);
            
            if (!baseline) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            // 生成 HTML 内容用于 PDF 转换
            const htmlContent = generateBaselinePDF(baseline, requirements, testcases);
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="baseline_${baseline.version}_${new Date().toISOString().split('T')[0]}.html"`);
            res.writeHead(200);
            res.end(htmlContent);
            return;
        }

        // ===== 标题层级 API =====
        if (url === '/api/headers' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            let filteredHeaders = headers;
            if (projectId) {
                filteredHeaders = headers.filter(h => h.projectId === projectId);
            }
            
            return jsonRes(res, 200, { success: true, data: filteredHeaders });
        }

        if (url === '/api/headers' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, name, level, parentId } = body;

            if (!projectId || !name) {
                return jsonRes(res, 400, { success: false, message: '参数不完整' });
            }

            const newHeader = {
                id: generateUniqueId(),
                projectId,
                name,
                level: level || 1,
                parentId: parentId || null,
                createdAt: new Date().toISOString()
            };

            headers.push(newHeader);
            saveData();

            return jsonRes(res, 201, { success: true, message: '标题创建成功', data: newHeader });
        }

        if (url.match(/^\/api\/headers\/[^\/]+$/) && method === 'PUT') {
            const headerId = url.split('/')[3];
            const body = await parseBody(req);
            const headerIndex = headers.findIndex(h => h.id === headerId);
            
            if (headerIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '标题不存在' });
            }

            const { name, level, parentId } = body;
            if (name !== undefined) headers[headerIndex].name = name;
            if (level !== undefined) headers[headerIndex].level = level;
            if (parentId !== undefined) headers[headerIndex].parentId = parentId;

            saveData();
            return jsonRes(res, 200, { success: true, message: '标题更新成功', data: headers[headerIndex] });
        }

        if (url.match(/^\/api\/headers\/[^\/]+$/) && method === 'DELETE') {
            const headerId = url.split('/')[3];
            const headerIndex = headers.findIndex(h => h.id === headerId);
            
            if (headerIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '标题不存在' });
            }

            headers.splice(headerIndex, 1);
            saveData();
            return jsonRes(res, 200, { success: true, message: '标题已删除' });
        }

        // ===== 文件上传 API =====
        // 【基础设施模块】增强版：支持简单上传和分片上传
        if (url === '/api/upload' && method === 'POST') {
            const perfMonitor = startPerformanceMonitor();
            
            try {
                const result = await handleSimpleUpload(req, res);
                endPerformanceMonitor(perfMonitor, 'file_upload_simple', {
                    files: result.data?.length || 0
                });
                return jsonRes(res, 200, result);
            } catch (error) {
                logError(error, { type: 'file_upload' });
                return jsonRes(res, 400, createErrorResponse(error.message, error.errorCode || ERROR_CODES.FILE_UPLOAD_FAILED));
            }
        }

        // 分片上传 - 初始化
        if (url === '/api/upload/chunked/init' && method === 'POST') {
            try {
                const result = await initChunkedUpload(req, res);
                return jsonRes(res, 200, result);
            } catch (error) {
                logError(error, { type: 'chunked_upload_init' });
                return jsonRes(res, 400, createErrorResponse(error.message, error.errorCode || ERROR_CODES.FILE_UPLOAD_FAILED));
            }
        }

        // 分片上传 - 上传分片
        if (url.match(/^\/api\/upload\/chunks\/[^\/]+\/\d+$/) && method === 'POST') {
            const parts = url.split('/');
            const uploadId = parts[4];
            const chunkIndex = parseInt(parts[5]);
            
            try {
                const result = await uploadChunk(req, res, uploadId, chunkIndex);
                return jsonRes(res, 200, result);
            } catch (error) {
                logError(error, { type: 'chunk_upload', uploadId, chunkIndex });
                return jsonRes(res, 400, createErrorResponse(error.message, error.errorCode || ERROR_CODES.FILE_UPLOAD_FAILED));
            }
        }

        // 分片上传 - 合并分片
        if (url.match(/^\/api\/upload\/chunks\/[^\/]+\/merge$/) && method === 'POST') {
            const uploadId = url.split('/')[4];
            
            try {
                const result = await mergeChunks(req, res, uploadId);
                return jsonRes(res, 200, result);
            } catch (error) {
                logError(error, { type: 'chunk_merge', uploadId });
                return jsonRes(res, 400, createErrorResponse(error.message, error.errorCode || ERROR_CODES.FILE_UPLOAD_FAILED));
            }
        }

        // 查询上传进度
        if (url.match(/^\/api\/upload\/progress\/[^\/]+$/) && method === 'GET') {
            const uploadId = url.split('/')[4];
            
            try {
                const result = await getUploadProgress(req, res, uploadId);
                return jsonRes(res, 200, result);
            } catch (error) {
                logError(error, { type: 'upload_progress', uploadId });
                return jsonRes(res, 404, createErrorResponse(error.message, error.errorCode || ERROR_CODES.FILE_NOT_FOUND));
            }
        }

        // 获取上传记录
        if (url === '/api/uploads' && method === 'GET') {
            try {
                const { getAllUploadRecords } = require('./file-upload');
                const records = getAllUploadRecords();
                return jsonRes(res, 200, createSuccessResponse(records));
            } catch (error) {
                logError(error, { type: 'get_uploads' });
                return jsonRes(res, 500, createErrorResponse(error.message));
            }
        }

        // 删除上传文件
        if (url.match(/^\/api\/uploads\/[^\/]+$/) && method === 'DELETE') {
            const fileId = url.split('/')[3];
            
            try {
                const result = deleteUploadFile(fileId);
                return jsonRes(res, 200, result);
            } catch (error) {
                logError(error, { type: 'delete_upload', fileId });
                return jsonRes(res, 404, createErrorResponse(error.message, error.errorCode || ERROR_CODES.FILE_NOT_FOUND));
            }
        }

        // ===== 前缀设置 API =====
        if (url === '/api/prefixes' && method === 'GET') {
            return jsonRes(res, 200, { success: true, data: prefixes });
        }

        if (url === '/api/prefixes' && method === 'PUT') {
            const body = await parseBody(req);
            const { requirement, testcase } = body;
            
            if (requirement !== undefined) prefixes.requirement = requirement;
            if (testcase !== undefined) prefixes.testcase = testcase;
            
            saveData();
            return jsonRes(res, 200, { success: true, message: '前缀设置成功', data: prefixes });
        }

        // ===== 历史记录 API =====
        // ===== 用例模板 API =====
        if (url === '/api/templates' && method === 'GET') {
            // 返回内置模板（前端存储自定义模板）
            const defaultTemplates = [
                {
                    id: 'default_functional',
                    name: '功能测试模板',
                    description: '适用于常规功能测试场景',
                    steps: '<p>1. 打开系统/页面</p><p>2. 输入/点击...</p><p>3. 验证结果</p>',
                    result: '系统响应符合预期',
                    scenarios: '功能测试，回归测试'
                },
                {
                    id: 'default_login',
                    name: '登录测试模板',
                    description: '用户登录相关测试场景',
                    steps: '<p>1. 打开登录页面</p><p>2. 输入用户名和密码</p><p>3. 点击登录按钮</p><p>4. 验证登录结果</p>',
                    result: '成功登录并跳转到首页',
                    scenarios: '登录测试，认证测试'
                },
                {
                    id: 'default_api',
                    name: 'API 测试模板',
                    description: '接口测试场景',
                    steps: '<p>1. 准备测试数据</p><p>2. 发送 HTTP 请求</p><p>3. 验证响应状态码</p><p>4. 验证响应数据</p>',
                    result: 'API 返回预期数据',
                    scenarios: '接口测试，集成测试'
                },
                {
                    id: 'default_ui',
                    name: 'UI 测试模板',
                    description: '界面和交互测试',
                    steps: '<p>1. 打开目标页面</p><p>2. 检查页面元素</p><p>3. 执行交互操作</p><p>4. 验证界面变化</p>',
                    result: '界面显示和交互正常',
                    scenarios: 'UI 测试，兼容性测试'
                },
                {
                    id: 'default_performance',
                    name: '性能测试模板',
                    description: '性能和负载测试',
                    steps: '<p>1. 设置并发用户数</p><p>2. 执行压力测试</p><p>3. 监控系统指标</p><p>4. 分析性能数据</p>',
                    result: '系统性能指标符合要求',
                    scenarios: '性能测试，负载测试'
                },
                {
                    id: 'default_security',
                    name: '安全测试模板',
                    description: '安全性测试场景',
                    steps: '<p>1. 识别测试目标</p><p>2. 执行安全扫描</p><p>3. 尝试漏洞利用</p><p>4. 验证防护措施</p>',
                    result: '系统安全防护有效',
                    scenarios: '安全测试，渗透测试'
                }
            ];
            return jsonRes(res, 200, { success: true, data: defaultTemplates });
        }

        // ===== 批量导入用例 API =====
        if (url === '/api/testcases/batch-import' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, testcases: importedTestcases } = body;

            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            if (!importedTestcases || !Array.isArray(importedTestcases)) {
                return jsonRes(res, 400, { success: false, message: '用例数据格式错误' });
            }

            const results = [];
            for (const tc of importedTestcases) {
                try {
                    const nextId = getNextId('testcase');
                    const prefix = tc.prefix || 'TC';
                    const tcId = `${prefix}-${nextId}`;

                    const newTestcase = {
                        id: generateUniqueId(),
                        tcId,
                        projectId,
                        prefix,
                        steps: tc.steps || '',
                        expectedResult: tc.expectedResult || '',
                        headerId: tc.headerId || null,
                        richContent: tc.richContent || tc.steps || '',
                        attachments: tc.attachments || [],
                        columns: [
                            { id: generateUniqueId(), name: '操作步骤', type: 'text', value: tc.steps || '' },
                            { id: generateUniqueId(), name: '预期结果', type: 'text', value: tc.expectedResult || '' }
                        ],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    testcases.push(newTestcase);
                    recordHistory('testcase', newTestcase.id, 'create', { 
                        steps: tc.steps, 
                        expectedResult: tc.expectedResult,
                        source: 'batch-import'
                    });
                    
                    results.push({ success: true, tcId, id: newTestcase.id });
                } catch (error) {
                    results.push({ success: false, error: error.message });
                }
            }

            saveData();

            const successCount = results.filter(r => r.success).length;
            return jsonRes(res, 200, { 
                success: true, 
                message: `导入完成：成功 ${successCount}/${importedTestcases.length} 条`,
                data: results
            });
        }

        // ===== 批量导出用例 API =====
        if (url === '/api/testcases/batch-export' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const format = urlObj.searchParams.get('format') || 'json';
            const ids = urlObj.searchParams.get('ids'); // 逗号分隔的 ID 列表

            let exportData = testcases;
            if (projectId) {
                exportData = exportData.filter(t => t.projectId === projectId);
            }
            if (ids) {
                const idList = ids.split(',');
                exportData = exportData.filter(t => idList.includes(t.id));
            }

            if (format === 'json') {
                return jsonRes(res, 200, { success: true, data: exportData });
            }

            if (format === 'csv') {
                const csvRows = [['用例 ID', '操作步骤', '预期结果', '创建时间', '更新时间']];
                exportData.forEach(tc => {
                    const steps = (tc.richContent || tc.steps || '').replace(/<[^>]*>/g, '').replace(/[\r\n]+/g, ' ');
                    const result = (tc.expectedResult || '').replace(/[\r\n]+/g, ' ');
                    csvRows.push([tc.tcId, steps, result, tc.createdAt, tc.updatedAt]);
                });
                
                const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                res.writeHead(200, {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="testcases_${Date.now()}.csv"`
                });
                res.end(csvContent, 'utf-8');
                return;
            }

            // Excel 格式需要前端处理或使用库
            return jsonRes(res, 200, { success: true, data: exportData });
        }

        // ===== 历史记录 API =====
        if (url === '/api/history' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const itemId = urlObj.searchParams.get('itemId');
            const type = urlObj.searchParams.get('type');
            const limit = parseInt(urlObj.searchParams.get('limit')) || 50;
            
            let filteredHistory = history;
            if (itemId) {
                filteredHistory = filteredHistory.filter(h => h.itemId === itemId);
            }
            if (type) {
                filteredHistory = filteredHistory.filter(h => h.type === type);
            }
            
            // 按时间倒序，返回最新的记录
            const sorted = filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return jsonRes(res, 200, { success: true, data: sorted.slice(0, limit) });
        }

        // ===== 基础设施监控 API =====
        // 获取系统日志统计
        if (url === '/api/system/stats' && method === 'GET') {
            try {
                const stats = getLogStats();
                return jsonRes(res, 200, createSuccessResponse(stats, '系统统计信息'));
            } catch (error) {
                logError(error, { type: 'system_stats' });
                return jsonRes(res, 500, createErrorResponse(error.message));
            }
        }

        // 健康检查
        if (url === '/api/health' && method === 'GET') {
            return jsonRes(res, 200, createSuccessResponse({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '1.0.0'
            }, '系统健康'));
        }

        // 404
        return jsonRes(res, 404, { success: false, message: '接口不存在' });

    } catch (error) {
        // 使用全局错误处理中间件
        logError(error, { url: fullUrl, method: method });
        return jsonRes(res, 500, createErrorResponse(
            process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
            error.errorCode || ERROR_CODES.INTERNAL_ERROR,
            process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}
        ));
    }
}

// 创建 HTTP 服务器 - 集成请求日志和性能监控
const server = http.createServer(async (req, res) => {
    const fullUrl = req.url;
    const url = req.url.split('?')[0];
    const startTime = Date.now();
    
    // 性能监控开始
    const perfMonitor = startPerformanceMonitor();
    
    // 记录请求开始
    console.log(`${new Date().toISOString()} - ${req.method} ${fullUrl}`);

    // 监听响应完成事件以记录日志
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logRequest(req.method, fullUrl, res.statusCode, duration);
        endPerformanceMonitor(perfMonitor, `${req.method} ${url}`, {
            statusCode: res.statusCode
        });
    });

    if (url.startsWith('/api/')) {
        return handleApiRequest(req, res, fullUrl);
    }
    
    // 上传文件访问
    if (url.startsWith('/uploads/')) {
        const filePath = path.join(UPLOADS_DIR, path.basename(url));
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - 文件未找到</h1>', 'utf-8');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
        return;
    }

    let filePath = url === '/' ? '/login.html' : url;
    filePath = path.join(WEB_DIR, path.normalize(filePath));

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - 文件未找到</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<h1>500 - 服务器错误</h1><p>${err.code}</p>`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║          需求管理系统 - 服务器已启动                      ║
╠══════════════════════════════════════════════════════════╣
║  本地访问：http://localhost:${PORT}                       ║
║  远程访问：http://8.215.93.217:${PORT}                    ║
║                                                          ║
║  默认管理员：admin / admin123                            ║
║                                                          ║
║  【基础设施模块】增强功能：                              ║
║    ✓ 全局错误处理中间件                                  ║
║    ✓ 请求日志记录（所有 API 调用）                        ║
║    ✓ 性能监控（慢查询告警 >1s）                          ║
║    ✓ 文件上传优化（支持断点续传/进度显示）               ║
║    ✓ 统一 API 响应格式                                    ║
║                                                          ║
║  核心功能模块：                                          ║
║    ✓ 用户认证管理                                        ║
║    ✓ 项目管理                                            ║
║    ✓ 需求管理（富文本编辑器）                            ║
║    ✓ 用例管理（富文本 + 模板 + 导入导出）                ║
║    ✓ 标题层级管理                                        ║
║    ✓ 追踪矩阵                                            ║
║    ✓ 基线版本管理                                        ║
║    ✓ 修改历史记录                                        ║
║    ✓ 批量操作                                            ║
║                                                          ║
║  监控接口：                                              ║
║    GET /api/health - 健康检查                            ║
║    GET /api/system/stats - 系统统计                      ║
║                                                          ║
║  日志文件：                                              ║
║    logs/requests.log - 请求日志                          ║
║    logs/errors.log - 错误日志                            ║
║    logs/performance.log - 性能日志                       ║
║                                                          ║
║  按 Ctrl+C 停止服务器                                    ║
╚══════════════════════════════════════════════════════════╝
    `);
});
