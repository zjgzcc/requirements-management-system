// ===== 需求管理系统 - API 服务器 =====
// 【基础设施模块】增强版：集成全局错误处理、日志记录、性能监控

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const formidable = require('formidable');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = require('docx');
const XLSX = require('xlsx');

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

// License 管理器
const {
    validateLicense,
    licenseMiddleware,
    licenseAPI
} = require('./license-manager');

// AI 智能助手
const aiAssistant = require('./ai-assistant');

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
const NAVIGATION_FILE = path.join(__dirname, 'navigation.json');
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const DEFECTS_FILE = path.join(__dirname, 'defects.json');
const AI_CACHE_FILE = path.join(__dirname, 'ai-cache.json');

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
let prefixes = initializeFile(PREFIXES_FILE, { requirement: 'REQ', testcase: 'TC', defect: 'DEF' });
let navigation = initializeFile(NAVIGATION_FILE, []); // 导航树数据
let idCounter = initializeFile(ID_COUNTER_FILE, { requirement: 0, testcase: 0, defect: 0 });
let tasksData = initializeFile(TASKS_FILE, { tasks: [], users: [], projects: [] });
let defects = initializeFile(DEFECTS_FILE, []); // 缺陷数据

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

// ===== Session 管理 =====
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 分钟
const sessions = initializeFile(SESSIONS_FILE, {});

// 生成 Session Token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 创建 Session
function createSession(userId, rememberMe = false) {
    const token = generateSessionToken();
    const expires = rememberMe 
        ? Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 天
        : Date.now() + SESSION_TIMEOUT; // 30 分钟
    
    sessions[token] = {
        userId,
        expires,
        createdAt: new Date().toISOString(),
        lastActivity: Date.now()
    };
    
    saveSessions();
    return { token, expires };
}

// 验证 Session
function verifySession(token) {
    if (!token || !sessions[token]) {
        return null;
    }
    
    const session = sessions[token];
    if (Date.now() > session.expires) {
        // Session 过期，删除
        delete sessions[token];
        saveSessions();
        return null;
    }
    
    // 更新最后活动时间
    session.lastActivity = Date.now();
    saveSessions();
    
    return session;
}

// 删除 Session（登出）
function destroySession(token) {
    if (sessions[token]) {
        delete sessions[token];
        saveSessions();
        return true;
    }
    return false;
}

// 保存 Sessions
function saveSessions() {
    // 清理过期 sessions
    const now = Date.now();
    Object.keys(sessions).forEach(token => {
        if (now > sessions[token].expires) {
            delete sessions[token];
        }
    });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// 获取 Session 中间件
function getSessionFromHeaders(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}

// 认证中间件
function requireAuth(req, res) {
    const token = getSessionFromHeaders(req);
    const session = verifySession(token);
    
    if (!session) {
        return { error: { success: false, message: '未授权访问', code: 401 } };
    }
    
    const user = users.find(u => u.id === session.userId);
    if (!user || user.status !== 'active') {
        destroySession(token);
        return { error: { success: false, message: '用户不存在或已被禁用', code: 403 } };
    }
    
    // 移除密码
    const { password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, session };
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
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2));
    fs.writeFileSync(DEFECTS_FILE, JSON.stringify(defects, null, 2));
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

// 分析变更类型和影响范围
function analyzeChanges(oldData, newData) {
    const changes = [];
    const changeTypeMap = {
        title: '内容变更',
        description: '内容变更',
        acceptanceCriteria: '验收标准变更',
        steps: '步骤变更',
        expectedResult: '预期结果变更',
        richContent: '富文本变更',
        status: '状态变更',
        priority: '优先级变更',
        category: '分类变更',
        assignee: '负责人变更',
        headerId: '层级变更'
    };
    
    const impactLevelMap = {
        title: 'high',
        description: 'high',
        acceptanceCriteria: 'high',
        steps: 'high',
        expectedResult: 'high',
        richContent: 'medium',
        status: 'medium',
        priority: 'medium',
        category: 'low',
        assignee: 'low',
        headerId: 'low'
    };
    
    Object.keys(newData).forEach(key => {
        if (oldData[key] !== newData[key] && !key.startsWith('_')) {
            const oldValue = oldData[key];
            const newValue = newData[key];
            
            // 计算差异（简化版 diff）
            let diffType = 'modified';
            if (oldValue === undefined || oldValue === null) {
                diffType = 'added';
            } else if (newValue === null || newValue === '') {
                diffType = 'removed';
            }
            
            changes.push({
                field: key,
                fieldName: changeTypeMap[key] || key,
                oldValue: oldValue || '',
                newValue: newValue || '',
                changeType: diffType, // 'added', 'removed', 'modified'
                impactLevel: impactLevelMap[key] || 'medium', // 'high', 'medium', 'low'
                annotation: generateChangeAnnotation(key, oldValue, newValue)
            });
        }
    });
    
    return changes;
}

// 生成变更批注
function generateChangeAnnotation(field, oldValue, newValue) {
    const annotations = {
        status: `状态从 "${oldValue || '无'}" 变更为 "${newValue || '无'}"`,
        priority: `优先级从 "${oldValue || '无'}" 调整为 "${newValue || '无'}"`,
        assignee: `负责人从 "${oldValue || '无'}" 移交至 "${newValue || '无'}"`,
        title: `标题更新`,
        description: `描述内容已修改`,
        acceptanceCriteria: `验收标准已更新`,
        steps: `操作步骤已变更`,
        expectedResult: `预期结果已调整`,
        category: `分类从 "${oldValue || '无'}" 改为 "${newValue || '无'}"`
    };
    return annotations[field] || `${field} 字段已更新`;
}

// 记录修改历史（增强版 - 支持批注和审计）
function recordHistory(type, itemId, action, changes, userId = 'system', options = {}) {
    const { oldData, newData, baselineId, impactSummary, operationSource = 'manual' } = options;
    
    // 分析变更（如果有新旧数据）
    let analyzedChanges = changes;
    if (oldData && newData && action === 'update') {
        analyzedChanges = analyzeChanges(oldData, newData);
    }
    
    // 计算影响范围统计
    const impactStats = analyzedChanges && Array.isArray(analyzedChanges) ? {
        high: analyzedChanges.filter(c => c.impactLevel === 'high').length,
        medium: analyzedChanges.filter(c => c.impactLevel === 'medium').length,
        low: analyzedChanges.filter(c => c.impactLevel === 'low').length,
        total: analyzedChanges.length
    } : null;
    
    const record = {
        id: generateUniqueId(),
        type, // 'requirement' or 'testcase'
        itemId,
        action, // 'create', 'update', 'delete', 'baseline', 'restore', 'execute'
        changes: analyzedChanges,
        rawChanges: changes, // 保留原始变更数据
        userId,
        operationSource, // 'manual', 'api', 'batch', 'restore', 'import'
        impactStats,
        impactSummary: impactSummary || null,
        baselineId: baselineId || null,
        timestamp: new Date().toISOString(),
        // 审计字段
        audit: {
            ipAddress: options.ipAddress || 'localhost',
            userAgent: options.userAgent || 'system',
            sessionId: options.sessionId || null,
            reason: options.reason || null // 变更原因说明
        }
    };
    
    history.push(record);
    // 保留最近 2000 条记录（增加容量）
    if (history.length > 2000) {
        history = history.slice(-2000);
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
        // ===== 认证 API =====
        // POST /api/auth/login - 用户登录
        if (url === '/api/auth/login' && method === 'POST') {
            const body = await parseBody(req);
            const { username, password, rememberMe = false } = body;

            if (!username || !password) {
                return jsonRes(res, 400, { success: false, message: '用户名和密码不能为空' });
            }

            const user = users.find(u => u.username === username && u.password === hashPassword(password));

            if (user) {
                if (user.status !== 'active') {
                    return jsonRes(res, 403, { success: false, message: '账户已被禁用' });
                }
                
                // 创建 Session
                const { token, expires } = createSession(user.id, rememberMe);
                
                const { password: _, ...userWithoutPassword } = user;
                return jsonRes(res, 200, {
                    success: true,
                    message: '登录成功',
                    data: {
                        ...userWithoutPassword,
                        token,
                        expires
                    }
                });
            } else {
                return jsonRes(res, 401, { success: false, message: '用户名或密码错误' });
            }
        }

        // POST /api/auth/logout - 用户登出
        if (url === '/api/auth/logout' && method === 'POST') {
            const token = getSessionFromHeaders(req);
            if (token) {
                destroySession(token);
            }
            return jsonRes(res, 200, { success: true, message: '登出成功' });
        }

        // GET /api/auth/me - 获取当前用户信息
        if (url === '/api/auth/me' && method === 'GET') {
            const authResult = requireAuth(req, res);
            if (authResult.error) {
                return jsonRes(res, authResult.error.code, authResult.error);
            }
            return jsonRes(res, 200, { 
                success: true, 
                data: authResult.user,
                session: {
                    expires: authResult.session.expires,
                    lastActivity: authResult.session.lastActivity
                }
            });
        }

        // 兼容旧版登录接口
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
            const { projectId, prefix, title, category, status, priority, assignee, description, acceptanceCriteria, headerId, savePrefix, richContent, attachments } = body;

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
                title: title || '',
                category: category || '用户需求',
                status: status || 'draft',
                priority: priority || 'medium',
                assignee: assignee || '',
                description: description || '',
                acceptanceCriteria: acceptanceCriteria || '',
                headerId: headerId || null,
                richContent: richContent || null,
                attachments: attachments || [],
                columns: columns || [{ id: generateUniqueId(), name: '描述', type: 'text', value: description || '' }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            requirements.push(newRequirement);
            recordHistory('requirement', newRequirement.id, 'create', { 
                title, category, status, priority, assignee, description, acceptanceCriteria, richContent 
            });
            
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

            const oldData = JSON.parse(JSON.stringify(requirements[reqIndex]));
            const { title, category, status, priority, assignee, description, acceptanceCriteria, headerId, columns, richContent } = body;
            
            // P0 字段
            if (title !== undefined) requirements[reqIndex].title = title;
            if (status !== undefined) requirements[reqIndex].status = status;
            if (priority !== undefined) requirements[reqIndex].priority = priority;
            
            // P1 字段
            if (category !== undefined) requirements[reqIndex].category = category;
            if (assignee !== undefined) requirements[reqIndex].assignee = assignee;
            
            // 其他字段
            if (description !== undefined) requirements[reqIndex].description = description;
            if (acceptanceCriteria !== undefined) requirements[reqIndex].acceptanceCriteria = acceptanceCriteria;
            if (headerId !== undefined) requirements[reqIndex].headerId = headerId;
            if (columns !== undefined) requirements[reqIndex].columns = columns;
            if (richContent !== undefined) requirements[reqIndex].richContent = richContent;
            
            requirements[reqIndex].updatedAt = new Date().toISOString();

            // 记录详细历史（带变更分析）
            recordHistory('requirement', reqId, 'update', { 
                oldData, 
                newData: { title, category, status, priority, assignee, description, acceptanceCriteria, headerId, richContent } 
            }, 'system', {
                oldData,
                newData: { title, category, status, priority, assignee, description, acceptanceCriteria, headerId, richContent },
                operationSource: 'api',
                reason: body.changeReason || null // 允许前端传入变更原因
            });
            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: '需求更新成功', 
                data: requirements[reqIndex],
                changes: analyzeChanges(oldData, { title, category, status, priority, assignee, description, acceptanceCriteria, headerId, richContent })
            });
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
            const { projectId, prefix, steps, expectedResult, headerId, savePrefix, richContent, 
                    title, type, status, priority, assignee, columns } = body;

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
                title: title || '',
                type: type || '功能测试',
                status: status || 'not_executed',
                priority: priority || 'medium',
                assignee: assignee || '',
                steps: steps || '',
                expectedResult: expectedResult || '',
                headerId: headerId || null,
                richContent: richContent || null,
                attachments: [],
                lastExecuted: null,
                columns: columns || [
                    { id: generateUniqueId(), name: '操作步骤', type: 'text', value: steps || '' },
                    { id: generateUniqueId(), name: '预期结果', type: 'text', value: expectedResult || '' }
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            testcases.push(newTestcase);
            recordHistory('testcase', newTestcase.id, 'create', { steps, expectedResult, richContent, title, type, status, priority, assignee });
            
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

            const oldData = JSON.parse(JSON.stringify(testcases[tcIndex]));
            const { steps, expectedResult, columns, title, type, status, priority, assignee, 
                    richContent, headerId, lastExecuted } = body;
            if (title !== undefined) testcases[tcIndex].title = title;
            if (type !== undefined) testcases[tcIndex].type = type;
            if (status !== undefined) testcases[tcIndex].status = status;
            if (priority !== undefined) testcases[tcIndex].priority = priority;
            if (assignee !== undefined) testcases[tcIndex].assignee = assignee;
            if (steps !== undefined) testcases[tcIndex].steps = steps;
            if (expectedResult !== undefined) testcases[tcIndex].expectedResult = expectedResult;
            if (richContent !== undefined) testcases[tcIndex].richContent = richContent;
            if (headerId !== undefined) testcases[tcIndex].headerId = headerId;
            if (lastExecuted !== undefined) testcases[tcIndex].lastExecuted = lastExecuted;
            if (columns !== undefined) testcases[tcIndex].columns = columns;
            testcases[tcIndex].updatedAt = new Date().toISOString();

            // 记录详细历史（带变更分析）
            recordHistory('testcase', tcId, 'update', { 
                oldData, 
                newData: { steps, expectedResult, columns, title, type, status, priority, assignee, richContent, lastExecuted } 
            }, 'system', {
                oldData,
                newData: { steps, expectedResult, columns, title, type, status, priority, assignee, richContent, lastExecuted },
                operationSource: 'api',
                reason: body.changeReason || null
            });
            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: '用例更新成功', 
                data: testcases[tcIndex],
                changes: analyzeChanges(oldData, { steps, expectedResult, columns, title, type, status, priority, assignee, richContent, lastExecuted })
            });
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

        // ===== 用例执行记录 API =====
        if (url.match(/^\/api\/testcases\/[^\/]+\/execute$/) && method === 'POST') {
            const tcId = url.split('/')[3];
            const body = await parseBody(req);
            const tcIndex = testcases.findIndex(t => t.id === tcId);
            
            if (tcIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '用例不存在' });
            }

            const { status, result, executedBy, duration, notes, attachments } = body;
            
            // 更新用例状态和最后执行时间
            testcases[tcIndex].status = status || testcases[tcIndex].status;
            testcases[tcIndex].lastExecuted = new Date().toISOString();
            testcases[tcIndex].updatedAt = new Date().toISOString();
            
            // 创建执行记录
            const executionRecord = {
                id: generateUniqueId(),
                testcaseId: tcId,
                status: status || 'not_executed',
                result: result || '',
                executedBy: executedBy || 'system',
                duration: duration || 0,
                notes: notes || '',
                attachments: attachments || [],
                executedAt: new Date().toISOString()
            };
            
            // 保存到执行历史记录
            if (!testcases[tcIndex].executionHistory) {
                testcases[tcIndex].executionHistory = [];
            }
            testcases[tcIndex].executionHistory.push(executionRecord);
            
            recordHistory('testcase', tcId, 'execute', { 
                status: testcases[tcIndex].status, 
                executedBy, 
                executionRecordId: executionRecord.id 
            });
            saveData();

            return jsonRes(res, 201, { 
                success: true, 
                message: '用例执行记录成功', 
                data: { testcase: testcases[tcIndex], executionRecord } 
            });
        }

        // 获取用例执行历史
        if (url.match(/^\/api\/testcases\/[^\/]+\/history$/) && method === 'GET') {
            const tcId = url.split('/')[3];
            const testcase = testcases.find(t => t.id === tcId);
            
            if (!testcase) {
                return jsonRes(res, 404, { success: false, message: '用例不存在' });
            }
            
            const executionHistory = testcase.executionHistory || [];
            
            return jsonRes(res, 200, { 
                success: true, 
                data: executionHistory.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt)) 
            });
        }

        // ===== 缺陷管理 API =====
        // 获取缺陷列表
        if (url === '/api/defects' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const status = urlObj.searchParams.get('status');
            const severity = urlObj.searchParams.get('severity');
            const assignee = urlObj.searchParams.get('assignee');
            
            let filteredDefects = defects;
            if (projectId) {
                filteredDefects = filteredDefects.filter(d => d.projectId === projectId);
            }
            if (status) {
                filteredDefects = filteredDefects.filter(d => d.status === status);
            }
            if (severity) {
                filteredDefects = filteredDefects.filter(d => d.severity === severity);
            }
            if (assignee) {
                filteredDefects = filteredDefects.filter(d => d.assignee?.id === assignee);
            }
            
            return jsonRes(res, 200, { success: true, data: filteredDefects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
        }

        // 创建缺陷
        if (url === '/api/defects' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, title, description, severity, priority, type, steps, expectedResult, actualResult, environment, relatedRequirement, relatedTestcase, relatedTask, attachments } = body;

            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }
            if (!title) {
                return jsonRes(res, 400, { success: false, message: '缺陷标题不能为空' });
            }

            const nextId = getNextId('defect');
            const defectId = `DEF-${nextId}`;

            // 获取当前用户（从 session）
            const token = getSessionFromHeaders(req);
            const session = verifySession(token);
            const currentUser = session ? users.find(u => u.id === session.userId) : null;

            const newDefect = {
                id: generateUniqueId(),
                defectId,
                projectId,
                title: title || '',
                description: description || '',
                severity: severity || 'normal',
                priority: priority || 'medium',
                status: 'new',
                type: type || 'function',
                reporter: currentUser ? { id: currentUser.id, name: currentUser.username, avatar: '' } : { id: 'system', name: 'System', avatar: '' },
                assignee: null,
                verifier: null,
                ccUsers: [],
                steps: steps || [],
                expectedResult: expectedResult || '',
                actualResult: actualResult || '',
                environment: environment || '',
                relatedRequirement: relatedRequirement || null,
                relatedTestcase: relatedTestcase || null,
                relatedTask: relatedTask || null,
                attachments: attachments || [],
                comments: [],
                history: [{
                    id: generateUniqueId(),
                    action: 'created',
                    field: null,
                    oldValue: null,
                    newValue: null,
                    userId: currentUser ? currentUser.id : 'system',
                    userName: currentUser ? currentUser.username : 'System',
                    timestamp: new Date().toISOString()
                }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                closedAt: null
            };

            defects.push(newDefect);
            recordHistory('defect', newDefect.id, 'create', { title, severity, priority });
            saveData();

            return jsonRes(res, 201, { success: true, message: '缺陷创建成功', data: newDefect });
        }

        // 获取单个缺陷
        if (url.match(/^\/api\/defects\/[^\/]+$/) && method === 'GET') {
            const defectId = url.split('/')[3];
            const defect = defects.find(d => d.id === defectId);
            
            if (!defect) {
                return jsonRes(res, 404, { success: false, message: '缺陷不存在' });
            }
            
            return jsonRes(res, 200, { success: true, data: defect });
        }

        // 更新缺陷
        if (url.match(/^\/api\/defects\/[^\/]+$/) && method === 'PUT') {
            const defectId = url.split('/')[3];
            const defectIndex = defects.findIndex(d => d.id === defectId);
            
            if (defectIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '缺陷不存在' });
            }

            const oldData = JSON.parse(JSON.stringify(defects[defectIndex]));
            const body = await parseBody(req);
            const { title, description, severity, priority, status, type, steps, expectedResult, actualResult, environment, assignee, verifier, relatedRequirement, relatedTestcase, relatedTask } = body;

            const token = getSessionFromHeaders(req);
            const session = verifySession(token);
            const currentUser = session ? users.find(u => u.id === session.userId) : null;
            const historyEntry = {
                id: generateUniqueId(),
                timestamp: new Date().toISOString(),
                userId: currentUser ? currentUser.id : 'system',
                userName: currentUser ? currentUser.username : 'System'
            };

            // P0 字段
            if (title !== undefined) {
                defects[defectIndex].title = title;
                defects[defectIndex].history.push({ ...historyEntry, action: 'update', field: 'title', oldValue: oldData.title, newValue: title });
            }
            if (status !== undefined) {
                const oldStatus = defects[defectIndex].status;
                defects[defectIndex].status = status;
                defects[defectIndex].history.push({ ...historyEntry, action: 'update', field: 'status', oldValue: oldStatus, newValue: status });
                if (status === 'closed' || status === 'rejected') {
                    defects[defectIndex].closedAt = new Date().toISOString();
                }
            }
            if (severity !== undefined) {
                defects[defectIndex].severity = severity;
                defects[defectIndex].history.push({ ...historyEntry, action: 'update', field: 'severity', oldValue: oldData.severity, newValue: severity });
            }
            if (priority !== undefined) {
                defects[defectIndex].priority = priority;
                defects[defectIndex].history.push({ ...historyEntry, action: 'update', field: 'priority', oldValue: oldData.priority, newValue: priority });
            }
            
            // 其他字段
            if (description !== undefined) defects[defectIndex].description = description;
            if (type !== undefined) defects[defectIndex].type = type;
            if (steps !== undefined) defects[defectIndex].steps = steps;
            if (expectedResult !== undefined) defects[defectIndex].expectedResult = expectedResult;
            if (actualResult !== undefined) defects[defectIndex].actualResult = actualResult;
            if (environment !== undefined) defects[defectIndex].environment = environment;
            if (assignee !== undefined) {
                const oldAssignee = defects[defectIndex].assignee;
                defects[defectIndex].assignee = assignee;
                if (assignee) {
                    defects[defectIndex].history.push({ ...historyEntry, action: 'update', field: 'assignee', oldValue: oldAssignee, newValue: assignee });
                }
            }
            if (verifier !== undefined) {
                defects[defectIndex].verifier = verifier;
                if (verifier) {
                    defects[defectIndex].history.push({ ...historyEntry, action: 'update', field: 'verifier', oldValue: oldData.verifier, newValue: verifier });
                }
            }
            if (relatedRequirement !== undefined) defects[defectIndex].relatedRequirement = relatedRequirement;
            if (relatedTestcase !== undefined) defects[defectIndex].relatedTestcase = relatedTestcase;
            if (relatedTask !== undefined) defects[defectIndex].relatedTask = relatedTask;
            
            defects[defectIndex].updatedAt = new Date().toISOString();
            recordHistory('defect', defectId, 'update', { oldData, newData: body });
            saveData();

            return jsonRes(res, 200, { success: true, message: '缺陷更新成功', data: defects[defectIndex] });
        }

        // 删除缺陷
        if (url.match(/^\/api\/defects\/[^\/]+$/) && method === 'DELETE') {
            const defectId = url.split('/')[3];
            const defectIndex = defects.findIndex(d => d.id === defectId);
            
            if (defectIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '缺陷不存在' });
            }

            recordHistory('defect', defectId, 'delete', { deletedData: defects[defectIndex] });
            defects.splice(defectIndex, 1);
            saveData();

            return jsonRes(res, 200, { success: true, message: '缺陷已删除' });
        }

        // 获取缺陷评论
        if (url.match(/^\/api\/defects\/[^\/]+\/comments$/) && method === 'GET') {
            const defectId = url.split('/')[3];
            const defect = defects.find(d => d.id === defectId);
            
            if (!defect) {
                return jsonRes(res, 404, { success: false, message: '缺陷不存在' });
            }
            
            return jsonRes(res, 200, { success: true, data: defect.comments || [] });
        }

        // 添加缺陷评论
        if (url.match(/^\/api\/defects\/[^\/]+\/comments$/) && method === 'POST') {
            const defectId = url.split('/')[3];
            const defectIndex = defects.findIndex(d => d.id === defectId);
            
            if (defectIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '缺陷不存在' });
            }

            const body = await parseBody(req);
            const { content, attachments } = body;

            if (!content) {
                return jsonRes(res, 400, { success: false, message: '评论内容不能为空' });
            }

            const token = getSessionFromHeaders(req);
            const session = verifySession(token);
            const currentUser = session ? users.find(u => u.id === session.userId) : null;

            const newComment = {
                id: generateUniqueId(),
                content,
                attachments: attachments || [],
                userId: currentUser ? currentUser.id : 'system',
                userName: currentUser ? currentUser.username : 'System',
                userAvatar: currentUser?.avatar || '',
                createdAt: new Date().toISOString()
            };

            if (!defects[defectIndex].comments) {
                defects[defectIndex].comments = [];
            }
            defects[defectIndex].comments.push(newComment);
            defects[defectIndex].updatedAt = new Date().toISOString();
            saveData();

            return jsonRes(res, 201, { success: true, message: '评论添加成功', data: newComment });
        }

        // 获取缺陷统计
        if (url === '/api/defects/stats' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            let filteredDefects = defects;
            if (projectId) {
                filteredDefects = filteredDefects.filter(d => d.projectId === projectId);
            }

            // 按状态统计
            const byStatus = {};
            filteredDefects.forEach(d => {
                byStatus[d.status] = (byStatus[d.status] || 0) + 1;
            });

            // 按严重程度统计
            const bySeverity = {};
            filteredDefects.forEach(d => {
                bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
            });

            // 按负责人统计
            const byAssignee = {};
            filteredDefects.forEach(d => {
                const assigneeName = d.assignee?.name || '未分配';
                byAssignee[assigneeName] = (byAssignee[assigneeName] || 0) + 1;
            });

            // 按类型统计
            const byType = {};
            filteredDefects.forEach(d => {
                byType[d.type] = (byType[d.type] || 0) + 1;
            });

            // 趋势统计（最近 7 天）
            const now = new Date();
            const trend = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const nextDate = new Date(date);
                nextDate.setDate(nextDate.getDate() + 1);
                
                const newCount = filteredDefects.filter(d => {
                    const createdAt = new Date(d.createdAt);
                    return createdAt >= date && createdAt < nextDate;
                }).length;
                
                const closedCount = filteredDefects.filter(d => {
                    if (!d.closedAt) return false;
                    const closedAt = new Date(d.closedAt);
                    return closedAt >= date && closedAt < nextDate;
                }).length;
                
                trend.push({
                    date: dateStr,
                    newCount,
                    closedCount
                });
            }

            return jsonRes(res, 200, { 
                success: true, 
                data: {
                    total: filteredDefects.length,
                    byStatus,
                    bySeverity,
                    byAssignee,
                    byType,
                    trend
                } 
            });
        }

        // 获取缺陷看板数据
        if (url === '/api/defects/board' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            let filteredDefects = defects;
            if (projectId) {
                filteredDefects = filteredDefects.filter(d => d.projectId === projectId);
            }

            // 按状态分组
            const board = {
                new: filteredDefects.filter(d => d.status === 'new'),
                confirmed: filteredDefects.filter(d => d.status === 'confirmed'),
                assigned: filteredDefects.filter(d => d.status === 'assigned'),
                in_progress: filteredDefects.filter(d => d.status === 'in_progress'),
                resolved: filteredDefects.filter(d => d.status === 'resolved'),
                verified: filteredDefects.filter(d => d.status === 'verified'),
                closed: filteredDefects.filter(d => d.status === 'closed'),
                rejected: filteredDefects.filter(d => d.status === 'rejected')
            };

            return jsonRes(res, 200, { success: true, data: board });
        }

        // 缺陷状态流转 API
        if (url.match(/^\/api\/defects\/[^\/]+\/transition$/) && method === 'POST') {
            const defectId = url.split('/')[3];
            const defectIndex = defects.findIndex(d => d.id === defectId);
            
            if (defectIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '缺陷不存在' });
            }

            const body = await parseBody(req);
            const { targetStatus, comment } = body;

            const validTransitions = {
                'new': ['confirmed', 'rejected'],
                'confirmed': ['assigned', 'rejected'],
                'assigned': ['in_progress', 'rejected'],
                'in_progress': ['resolved', 'in_progress'],
                'resolved': ['verified', 'reopened'],
                'verified': ['closed', 'reopened'],
                'closed': ['reopened'],
                'rejected': ['reopened']
            };

            const currentStatus = defects[defectIndex].status;
            if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(targetStatus)) {
                return jsonRes(res, 400, { success: false, message: `无效的状态流转：${currentStatus} -> ${targetStatus}` });
            }

            const token = getSessionFromHeaders(req);
            const session = verifySession(token);
            const currentUser = session ? users.find(u => u.id === session.userId) : null;

            const oldStatus = defects[defectIndex].status;
            defects[defectIndex].status = targetStatus;
            defects[defectIndex].history.push({
                id: generateUniqueId(),
                action: 'transition',
                field: 'status',
                oldValue: oldStatus,
                newValue: targetStatus,
                userId: currentUser ? currentUser.id : 'system',
                userName: currentUser ? currentUser.username : 'System',
                timestamp: new Date().toISOString(),
                comment: comment || ''
            });
            
            if (targetStatus === 'closed' || targetStatus === 'rejected') {
                defects[defectIndex].closedAt = new Date().toISOString();
            }
            
            defects[defectIndex].updatedAt = new Date().toISOString();
            recordHistory('defect', defectId, 'transition', { from: oldStatus, to: targetStatus });
            saveData();

            return jsonRes(res, 200, { success: true, message: '状态流转成功', data: defects[defectIndex] });
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

        // 获取用例关联的需求
        if (url.match(/^\/api\/testcases\/[^\/]+\/traces$/) && method === 'GET') {
            const tcId = url.split('/')[3];
            const testcase = testcases.find(t => t.id === tcId);
            
            if (!testcase) {
                return jsonRes(res, 404, { success: false, message: '用例不存在' });
            }
            
            // 查找该用例关联的所有需求
            const relatedTraces = traces.filter(t => t.testcaseId === tcId);
            const relatedRequirements = relatedTraces.map(trace => {
                const req = requirements.find(r => r.id === trace.requirementId);
                return req ? { ...req, traceId: trace.id } : null;
            }).filter(r => r !== null);
            
            return jsonRes(res, 200, { 
                success: true, 
                data: { testcase, relatedRequirements } 
            });
        }

        // 批量关联需求到用例
        if (url === '/api/traces/batch-link' && method === 'POST') {
            const body = await parseBody(req);
            const { testcaseId, requirementIds } = body;

            if (!testcaseId || !requirementIds || !Array.isArray(requirementIds)) {
                return jsonRes(res, 400, { success: false, message: '参数错误' });
            }

            const testcase = testcases.find(t => t.id === testcaseId);
            if (!testcase) {
                return jsonRes(res, 404, { success: false, message: '用例不存在' });
            }

            const results = { success: [], failed: [], duplicates: [] };

            requirementIds.forEach(reqId => {
                const req = requirements.find(r => r.id === reqId);
                if (!req) {
                    results.failed.push({ requirementId: reqId, reason: '需求不存在' });
                    return;
                }

                const existing = traces.find(t => t.requirementId === reqId && t.testcaseId === testcaseId);
                if (existing) {
                    results.duplicates.push({ requirementId: reqId, traceId: existing.id });
                    return;
                }

                const newTrace = {
                    id: generateUniqueId(),
                    requirementId: reqId,
                    testcaseId: testcaseId,
                    createdAt: new Date().toISOString()
                };

                traces.push(newTrace);
                results.success.push(newTrace);
            });

            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: `成功关联 ${results.success.length} 个需求`,
                data: results 
            });
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

        // ===== 批量删除追踪关系 API =====
        if (url === '/api/traces/batch-delete' && method === 'POST') {
            const body = await parseBody(req);
            const { traceIds } = body;

            if (!traceIds || !Array.isArray(traceIds) || traceIds.length === 0) {
                return jsonRes(res, 400, { success: false, message: '追踪 ID 列表不能为空' });
            }

            const results = {
                deleted: [],
                notFound: []
            };

            traceIds.forEach(traceId => {
                const traceIndex = traces.findIndex(t => t.id === traceId);
                if (traceIndex !== -1) {
                    const deleted = traces.splice(traceIndex, 1);
                    results.deleted.push({ traceId, ...deleted[0] });
                } else {
                    results.notFound.push(traceId);
                }
            });

            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: `批量删除完成：成功${results.deleted.length}条，未找到${results.notFound.length}条`,
                data: results 
            });
        }

        // ===== 按需求批量删除追踪关系 API =====
        if (url === '/api/traces/batch-delete-by-requirement' && method === 'POST') {
            const body = await parseBody(req);
            const { requirementIds } = body;

            if (!requirementIds || !Array.isArray(requirementIds) || requirementIds.length === 0) {
                return jsonRes(res, 400, { success: false, message: '需求 ID 列表不能为空' });
            }

            const beforeCount = traces.length;
            traces = traces.filter(t => !requirementIds.includes(t.requirementId));
            const deletedCount = beforeCount - traces.length;

            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: `批量删除完成：删除了 ${deletedCount} 条追踪关系`,
                data: { deletedCount, requirementIds } 
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

        // ===== 导出追溯报告 API - 增强版（支持 HTML/PDF） =====
        if (url === '/api/trace-report/export' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const format = urlObj.searchParams.get('format') || 'html';
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            const projectReqs = requirements.filter(r => r.projectId === projectId);
            const projectTcs = testcases.filter(t => t.projectId === projectId);
            
            // 计算覆盖率统计
            const coveredReqs = new Set();
            const coveredTcs = new Set();
            const traceDetails = [];
            
            traces.forEach(t => {
                const req = projectReqs.find(r => r.id === t.requirementId);
                const tc = projectTcs.find(tc => tc.id === t.testcaseId);
                if (req && tc) {
                    coveredReqs.add(req.id);
                    coveredTcs.add(tc.id);
                    traceDetails.push({
                        requirementId: req.reqId,
                        requirementDesc: req.description,
                        testcaseId: tc.tcId,
                        testcaseSteps: tc.steps,
                        testcaseResult: tc.expectedResult,
                        traceCreatedAt: t.createdAt
                    });
                }
            });
            
            const stats = {
                totalRequirements: projectReqs.length,
                totalTestcases: projectTcs.length,
                totalTraces: traces.length,
                coveredRequirements: coveredReqs.size,
                uncoveredRequirements: projectReqs.length - coveredReqs.size,
                coveredTestcases: coveredTcs.size,
                uncoveredTestcases: projectTcs.length - coveredTcs.size,
                coverageRate: projectReqs.length > 0 ? Math.round(coveredReqs.size / projectReqs.length * 100) : 0
            };

            // 生成 HTML 报告
            if (format === 'html') {
                const project = projects.find(p => p.id === projectId);
                const reportTime = new Date().toLocaleString('zh-CN');
                
                // 未覆盖的需求列表
                const uncoveredReqs = projectReqs.filter(r => !coveredReqs.has(r.id));
                
                // 未覆盖的用例列表（没有被任何需求关联的用例）
                const orphanTcs = projectTcs.filter(tc => !coveredTcs.has(tc.id));
                
                let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>需求追踪报告 - ${project?.name || '未知项目'}</title>
    <style>
        body {
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
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
            font-size: 28px;
        }
        .header .info {
            color: #666;
            font-size: 14px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .stat-card.warning {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .stat-card.success {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .stat-card.danger {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
        }
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 14px;
            opacity: 0.9;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #e1e1e1;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #f5f5f5;
            font-weight: 600;
            color: #333;
        }
        tr:hover {
            background: #f9f9ff;
        }
        .coverage-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .coverage-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-success {
            background: #d1fae5;
            color: #065f46;
        }
        .badge-warning {
            background: #fef3c7;
            color: #92400e;
        }
        .badge-danger {
            background: #fee2e2;
            color: #991b1b;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e1e1e1;
            color: #999;
            font-size: 12px;
        }
        @media print {
            body { max-width: 100%; }
            .stat-card { page-break-inside: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 需求追踪报告</h1>
        <div class="info">
            <p><strong>项目名称：</strong>${project?.name || '未知项目'}</p>
            <p><strong>生成时间：</strong>${reportTime}</p>
        </div>
    </div>
    
    <div class="summary">
        <div class="stat-card">
            <div class="stat-number">${stats.totalRequirements}</div>
            <div class="stat-label">📋 总需求数</div>
        </div>
        <div class="stat-card success">
            <div class="stat-number">${stats.coveredRequirements}</div>
            <div class="stat-label">✅ 已覆盖需求</div>
        </div>
        <div class="stat-card warning">
            <div class="stat-number">${stats.uncoveredRequirements}</div>
            <div class="stat-label">⚠️ 未覆盖需求</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalTestcases}</div>
            <div class="stat-label">🧪 总用例数</div>
        </div>
        <div class="stat-card danger">
            <div class="stat-number">${stats.coverageRate}%</div>
            <div class="stat-label">📈 覆盖率</div>
        </div>
    </div>

    <div class="section">
        <h2>📈 覆盖率概览</h2>
        <div class="coverage-bar">
            <div class="coverage-fill" style="width: ${stats.coverageRate}%">
                ${stats.coverageRate}% 需求已追踪
            </div>
        </div>
        <p style="color: #666; margin-top: 10px;">
            已建立 <strong>${stats.totalTraces}</strong> 条追踪关系，
            覆盖 <strong>${stats.coveredRequirements}</strong> 个需求，
            关联 <strong>${stats.coveredTestcases}</strong> 个用例
        </p>
    </div>

    <div class="section">
        <h2>🔗 追踪关系详情</h2>
        ${traceDetails.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th style="width: 100px;">需求 ID</th>
                    <th>需求描述</th>
                    <th style="width: 100px;">用例 ID</th>
                    <th>操作步骤</th>
                    <th>预期结果</th>
                    <th style="width: 150px;">追踪时间</th>
                </tr>
            </thead>
            <tbody>
                ${traceDetails.map(t => `
                <tr>
                    <td><strong>${t.requirementId}</strong></td>
                    <td>${(t.requirementDesc || '').substring(0, 100)}${(t.requirementDesc || '').length > 100 ? '...' : ''}</td>
                    <td>${t.testcaseId}</td>
                    <td>${(t.testcaseSteps || '').substring(0, 80)}${(t.testcaseSteps || '').length > 80 ? '...' : ''}</td>
                    <td>${(t.testcaseResult || '-').substring(0, 50)}${(t.testcaseResult || '').length > 50 ? '...' : ''}</td>
                    <td>${new Date(t.traceCreatedAt).toLocaleDateString('zh-CN')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p style="color: #999; text-align: center; padding: 40px;">暂无追踪关系</p>'}
    </div>

    ${uncoveredReqs.length > 0 ? `
    <div class="section">
        <h2>⚠️ 未覆盖的需求 <span class="badge badge-danger">${uncoveredReqs.length}</span></h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 100px;">需求 ID</th>
                    <th>需求描述</th>
                    <th style="width: 150px;">创建时间</th>
                </tr>
            </thead>
            <tbody>
                ${uncoveredReqs.map(r => `
                <tr>
                    <td><strong>${r.reqId}</strong></td>
                    <td>${(r.description || '').substring(0, 150)}${(r.description || '').length > 150 ? '...' : ''}</td>
                    <td>${new Date(r.createdAt).toLocaleDateString('zh-CN')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${orphanTcs.length > 0 ? `
    <div class="section">
        <h2>🔍 未关联的用例 <span class="badge badge-warning">${orphanTcs.length}</span></h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 100px;">用例 ID</th>
                    <th>操作步骤</th>
                    <th style="width: 150px;">创建时间</th>
                </tr>
            </thead>
            <tbody>
                ${orphanTcs.map(tc => `
                <tr>
                    <td><strong>${tc.tcId}</strong></td>
                    <td>${(tc.steps || '').substring(0, 150)}${(tc.steps || '').length > 150 ? '...' : ''}</td>
                    <td>${new Date(tc.createdAt).toLocaleDateString('zh-CN')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="footer">
        <p>此报告由需求管理系统自动生成</p>
        <p>生成时间：${reportTime}</p>
    </div>
</body>
</html>`;

                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="trace_report_${project?.name || projectId}_${new Date().toISOString().split('T')[0]}.html"`);
                res.writeHead(200);
                res.end(html);
                return;
            }

            // JSON 格式
            return jsonRes(res, 200, {
                success: true,
                data: {
                    stats,
                    traceDetails,
                    uncoveredRequirements: uncoveredReqs.map(r => ({
                        id: r.id,
                        reqId: r.reqId,
                        description: r.description
                    })),
                    orphanTestcases: orphanTcs.map(tc => ({
                        id: tc.id,
                        tcId: tc.tcId,
                        steps: tc.steps
                    }))
                }
            });
        }

        // ===== 获取覆盖率统计 API =====
        if (url === '/api/trace-coverage/stats' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }

            const projectReqs = requirements.filter(r => r.projectId === projectId);
            const projectTcs = testcases.filter(t => t.projectId === projectId);
            
            const coveredReqs = new Set();
            const coveredTcs = new Set();
            const reqToTcs = {}; // 需求→用例映射
            const tcToReqs = {}; // 用例→需求映射
            
            traces.forEach(t => {
                const req = projectReqs.find(r => r.id === t.requirementId);
                const tc = projectTcs.find(tc => tc.id === t.testcaseId);
                if (req && tc) {
                    coveredReqs.add(req.id);
                    coveredTcs.add(tc.id);
                    
                    // 构建双向映射
                    if (!reqToTcs[req.id]) reqToTcs[req.id] = [];
                    reqToTcs[req.id].push({ tcId: tc.tcId, tcName: tc.steps });
                    
                    if (!tcToReqs[tc.id]) tcToReqs[tc.id] = [];
                    tcToReqs[tc.id].push({ reqId: req.reqId, reqName: req.description });
                }
            });
            
            const stats = {
                totalRequirements: projectReqs.length,
                totalTestcases: projectTcs.length,
                totalTraces: traces.length,
                coveredRequirements: coveredReqs.size,
                uncoveredRequirements: projectReqs.length - coveredReqs.size,
                coveredTestcases: coveredTcs.size,
                uncoveredTestcases: projectTcs.length - coveredTcs.size,
                coverageRate: projectReqs.length > 0 ? Math.round(coveredReqs.size / projectReqs.length * 100) : 0,
                testcaseCoverageRate: projectTcs.length > 0 ? Math.round(coveredTcs.size / projectTcs.length * 100) : 0,
                avgTracesPerRequirement: projectReqs.length > 0 ? (traces.length / projectReqs.length).toFixed(2) : 0,
                bidirectionalMatrix: {
                    requirementToTestcases: reqToTcs,
                    testcaseToRequirements: tcToReqs
                }
            };

            return jsonRes(res, 200, { success: true, data: stats });
        }

        // ===== 基线版本 API =====
        if (url === '/api/baselines' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const type = urlObj.searchParams.get('type'); // 'requirement' or 'testcase'
            const status = urlObj.searchParams.get('status'); // 'active', 'archived', 'superseded'
            const sortBy = urlObj.searchParams.get('sortBy') || 'createdAt'; // 'createdAt', 'version', 'name'
            const sortOrder = urlObj.searchParams.get('sortOrder') || 'desc'; // 'asc', 'desc'
            
            let filteredBaselines = baselines;
            if (projectId) {
                filteredBaselines = baselines.filter(b => b.projectId === projectId);
            }
            if (type) {
                filteredBaselines = filteredBaselines.filter(b => b.type === type);
            }
            if (status) {
                filteredBaselines = filteredBaselines.filter(b => b.status === status);
            }
            
            // 排序
            filteredBaselines.sort((a, b) => {
                let aVal = a[sortBy];
                let bVal = b[sortBy];
                
                if (sortBy === 'version') {
                    // 版本号特殊排序 (V1.0, V1.1, V2.0)
                    const aMatch = aVal.match(/V(\d+)\.(\d+)/);
                    const bMatch = bVal.match(/V(\d+)\.(\d+)/);
                    if (aMatch && bMatch) {
                        const aMajor = parseInt(aMatch[1]);
                        const aMinor = parseInt(aMatch[2]);
                        const bMajor = parseInt(bMatch[1]);
                        const bMinor = parseInt(bMatch[2]);
                        if (aMajor !== bMajor) return sortOrder === 'asc' ? aMajor - bMajor : bMajor - aMajor;
                        return sortOrder === 'asc' ? aMinor - bMinor : bMinor - aMinor;
                    }
                }
                
                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
            
            // 添加统计信息
            const stats = {
                total: filteredBaselines.length,
                byType: {
                    requirement: filteredBaselines.filter(b => b.type === 'requirement').length,
                    testcase: filteredBaselines.filter(b => b.type === 'testcase').length
                },
                byStatus: {
                    active: filteredBaselines.filter(b => b.status === 'active').length,
                    archived: filteredBaselines.filter(b => b.status === 'archived').length,
                    superseded: filteredBaselines.filter(b => b.status === 'superseded').length
                }
            };
            
            return jsonRes(res, 200, { 
                success: true, 
                data: filteredBaselines,
                stats 
            });
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

            if (items.length !== itemIds.length) {
                return jsonRes(res, 400, { success: false, message: '部分项不存在' });
            }

            // 自动生成版本号：如果未指定，查找该项目该类型的最新版本并递增
            let finalVersion = version;
            if (!finalVersion) {
                const projectBaselines = baselines.filter(b => b.projectId === projectId && b.type === type);
                if (projectBaselines.length === 0) {
                    finalVersion = 'V1.0';
                } else {
                    // 提取最新版本号
                    const versions = projectBaselines.map(b => b.version);
                    versions.sort((a, b) => {
                        const aMatch = a.match(/V(\d+)\.(\d+)/);
                        const bMatch = b.match(/V(\d+)\.(\d+)/);
                        if (aMatch && bMatch) {
                            const aMajor = parseInt(aMatch[1]);
                            const aMinor = parseInt(aMatch[2]);
                            const bMajor = parseInt(bMatch[1]);
                            const bMinor = parseInt(bMatch[2]);
                            if (aMajor !== bMajor) return bMajor - aMajor;
                            return bMinor - aMinor;
                        }
                        return b.localeCompare(a);
                    });
                    const latestVersion = versions[0];
                    const versionMatch = latestVersion.match(/V(\d+)\.(\d+)/);
                    if (versionMatch) {
                        const major = parseInt(versionMatch[1]);
                        const minor = parseInt(versionMatch[2]);
                        finalVersion = `V${major}.${minor + 1}`;
                    } else {
                        finalVersion = 'V1.0';
                    }
                }
            }

            const newBaseline = {
                id: generateUniqueId(),
                projectId,
                type,
                name,
                version: finalVersion,
                items: items.map(item => ({
                    id: item.id,
                    reqId: item.reqId || item.tcId,
                    description: item.description || item.steps,
                    snapshot: JSON.parse(JSON.stringify(item))
                })),
                createdAt: new Date().toISOString(),
                createdBy: 'admin',
                status: 'active' // active, archived, superseded
            };

            baselines.push(newBaseline);
            recordHistory(type, 'baseline', 'baseline', { 
                baselineId: newBaseline.id, 
                name, 
                version: finalVersion,
                itemCount: items.length 
            });
            saveData();

            return jsonRes(res, 201, { 
                success: true, 
                message: '基线创建成功', 
                data: newBaseline,
                versionInfo: {
                    autoGenerated: !version,
                    previousVersion: baselines.filter(b => b.projectId === projectId && b.type === type).length > 1 ? versions[1] : null
                }
            });
        }

        if (url.match(/^\/api\/baselines\/[^\/]+$/) && method === 'GET') {
            const baselineId = url.split('/')[3];
            const baseline = baselines.find(b => b.id === baselineId);
            
            if (!baseline) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            // 计算基线摘要信息
            const summary = {
                totalItems: baseline.items.length,
                byStatus: {
                    active: baseline.items.filter(i => i.snapshot.status === 'active' || !i.snapshot.status).length,
                    inactive: baseline.items.filter(i => i.snapshot.status === 'inactive').length
                }
            };

            return jsonRes(res, 200, { 
                success: true, 
                data: baseline,
                summary 
            });
        }

        // ===== 基线摘要 API - 快速获取基线概览 =====
        if (url.match(/^\/api\/baselines\/[^\/]+\/summary$/) && method === 'GET') {
            const baselineId = url.split('/')[3];
            const baseline = baselines.find(b => b.id === baselineId);
            
            if (!baseline) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            // 获取上一个和下一个基线版本
            const projectBaselines = baselines
                .filter(b => b.projectId === baseline.projectId && b.type === baseline.type)
                .sort((a, b) => {
                    const aMatch = a.version.match(/V(\d+)\.(\d+)/);
                    const bMatch = b.version.match(/V(\d+)\.(\d+)/);
                    if (aMatch && bMatch) {
                        const aMajor = parseInt(aMatch[1]);
                        const aMinor = parseInt(aMatch[2]);
                        const bMajor = parseInt(bMatch[1]);
                        const bMinor = parseInt(bMatch[2]);
                        if (aMajor !== bMajor) return aMajor - bMajor;
                        return aMinor - bMinor;
                    }
                    return a.version.localeCompare(b.version);
                });
            
            const currentIndex = projectBaselines.findIndex(b => b.id === baselineId);
            const prevBaseline = currentIndex > 0 ? projectBaselines[currentIndex - 1] : null;
            const nextBaseline = currentIndex < projectBaselines.length - 1 ? projectBaselines[currentIndex + 1] : null;

            const summary = {
                id: baseline.id,
                version: baseline.version,
                name: baseline.name,
                type: baseline.type,
                status: baseline.status,
                createdAt: baseline.createdAt,
                createdBy: baseline.createdBy,
                itemCount: baseline.items.length,
                items: baseline.items.map(item => ({
                    id: item.id,
                    reqId: item.reqId,
                    description: item.description
                })),
                navigation: {
                    previous: prevBaseline ? { id: prevBaseline.id, version: prevBaseline.version } : null,
                    next: nextBaseline ? { id: nextBaseline.id, version: nextBaseline.version } : null
                }
            };

            return jsonRes(res, 200, { success: true, data: summary });
        }

        if (url.match(/^\/api\/baselines\/[^\/]+$/) && method === 'DELETE') {
            const baselineId = url.split('/')[3];
            const baselineIndex = baselines.findIndex(b => b.id === baselineId);
            
            if (baselineIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            const baseline = baselines[baselineIndex];
            
            // 如果是最后一个基线，不允许删除
            const projectBaselines = baselines.filter(b => b.projectId === baseline.projectId && b.type === baseline.type);
            if (projectBaselines.length === 1) {
                return jsonRes(res, 400, { success: false, message: '不能删除最后一个基线' });
            }

            baselines.splice(baselineIndex, 1);
            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: '基线已删除',
                data: {
                    deletedBaseline: {
                        id: baseline.id,
                        version: baseline.version,
                        name: baseline.name
                    }
                }
            });
        }

        // ===== 基线归档 API - 将基线标记为已归档 =====
        if (url.match(/^\/api\/baselines\/[^\/]+\/archive$/) && method === 'POST') {
            const baselineId = url.split('/')[3];
            const baselineIndex = baselines.findIndex(b => b.id === baselineId);
            
            if (baselineIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            baselines[baselineIndex].status = 'archived';
            baselines[baselineIndex].archivedAt = new Date().toISOString();
            saveData();

            return jsonRes(res, 200, { 
                success: true, 
                message: '基线已归档',
                data: {
                    id: baselines[baselineIndex].id,
                    version: baselines[baselineIndex].version,
                    name: baselines[baselineIndex].name,
                    status: 'archived',
                    archivedAt: baselines[baselineIndex].archivedAt
                }
            });
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

            // 计算详细的变更统计
            const changeStats = {
                added: compareResult.added.length,
                removed: compareResult.removed.length,
                modified: compareResult.modified.length,
                unchanged: compareResult.unchanged.length,
                total1: baseline1.items.length,
                total2: baseline2.items.length,
                changeRate: baseline1.items.length > 0 
                    ? ((compareResult.modified.length + compareResult.added.length + compareResult.removed.length) / baseline1.items.length * 100).toFixed(2) + '%'
                    : '0%'
            };

            return jsonRes(res, 200, { 
                success: true, 
                data: compareResult,
                stats: changeStats,
                summary: {
                    hasChanges: compareResult.added.length > 0 || compareResult.removed.length > 0 || compareResult.modified.length > 0,
                    totalChanges: compareResult.added.length + compareResult.removed.length + compareResult.modified.length,
                    stabilityScore: baseline1.items.length > 0 
                        ? (1 - (compareResult.modified.length + compareResult.added.length + compareResult.removed.length) / baseline1.items.length) * 100
                        : 100
                }
            });
        }

        // ===== 基线恢复 API - 将当前数据恢复到某个基线版本 =====
        if (url.match(/^\/api\/baselines\/[^\/]+\/restore$/) && method === 'POST') {
            const baselineId = url.split('/')[3];
            const body = await parseBody(req);
            const { createBackup = true, reason = '' } = body; // 是否创建备份，恢复原因
            const baseline = baselines.find(b => b.id === baselineId);
            
            if (!baseline) {
                return jsonRes(res, 404, { success: false, message: '基线不存在' });
            }

            // 恢复数据
            const targetType = baseline.type === 'requirement' ? requirements : testcases;
            const restoredCount = [];
            const backupItems = [];
            
            // 如果需要创建备份，先保存当前状态
            if (createBackup) {
                const currentItems = targetType.filter(item => 
                    baseline.items.some(bi => bi.id === item.id)
                );
                if (currentItems.length > 0) {
                    const backupBaseline = {
                        id: generateUniqueId(),
                        projectId: baseline.projectId,
                        type: baseline.type,
                        name: `${baseline.name} - 回退前备份`,
                        version: baseline.version + '-backup',
                        items: currentItems.map(item => ({
                            id: item.id,
                            reqId: item.reqId || item.tcId,
                            description: item.description || item.steps,
                            snapshot: JSON.parse(JSON.stringify(item))
                        })),
                        createdAt: new Date().toISOString(),
                        createdBy: 'admin',
                        status: 'archived',
                        isAutoBackup: true
                    };
                    baselines.push(backupBaseline);
                    backupItems.push(backupBaseline);
                }
            }
            
            baseline.items.forEach(baselineItem => {
                const currentIndex = targetType.findIndex(item => item.id === baselineItem.id);
                
                if (currentIndex !== -1) {
                    // 更新现有项
                    const oldData = JSON.parse(JSON.stringify(targetType[currentIndex]));
                    targetType[currentIndex] = JSON.parse(JSON.stringify(baselineItem.snapshot));
                    targetType[currentIndex].updatedAt = new Date().toISOString();
                    restoredCount.push({ 
                        id: baselineItem.id, 
                        action: 'updated', 
                        reqId: baselineItem.reqId,
                        hasChanges: JSON.stringify(oldData) !== JSON.stringify(baselineItem.snapshot)
                    });
                    // 记录恢复操作的历史
                    recordHistory(baseline.type, baselineItem.id, 'restore', { 
                        oldData, 
                        newData: baselineItem.snapshot,
                        baselineId,
                        baselineVersion: baseline.version,
                        reason
                    }, 'system', {
                        oldData,
                        newData: baselineItem.snapshot,
                        baselineId,
                        baselineVersion: baseline.version,
                        operationSource: 'restore',
                        reason: reason || `从基线版本 ${baseline.version} 恢复`
                    });
                } else {
                    // 添加缺失项
                    const newItem = JSON.parse(JSON.stringify(baselineItem.snapshot));
                    newItem.updatedAt = new Date().toISOString();
                    targetType.push(newItem);
                    restoredCount.push({ 
                        id: baselineItem.id, 
                        action: 'restored', 
                        reqId: baselineItem.reqId 
                    });
                    recordHistory(baseline.type, baselineItem.id, 'restore', { 
                        action: 'restored',
                        newData: baselineItem.snapshot,
                        baselineId,
                        baselineVersion: baseline.version,
                        reason
                    }, 'system', {
                        newData: baselineItem.snapshot,
                        baselineId,
                        baselineVersion: baseline.version,
                        operationSource: 'restore',
                        reason: reason || `从基线版本 ${baseline.version} 恢复`
                    });
                }
            });

            saveData();

            // 统计信息
            const stats = {
                total: restoredCount.length,
                updated: restoredCount.filter(r => r.action === 'updated').length,
                restored: restoredCount.filter(r => r.action === 'restored').length,
                hasChanges: restoredCount.filter(r => r.hasChanges).length,
                backupCreated: backupItems.length > 0
            };

            // 记录基线恢复的汇总日志
            recordHistory(baseline.type, 'baseline', 'restore', {
                baselineId,
                baselineVersion: baseline.version,
                baselineName: baseline.name,
                restoredItems: restoredCount.length,
                backupCreated: backupItems.length > 0,
                reason
            }, 'system', {
                operationSource: 'restore',
                reason: reason || `从基线版本 ${baseline.version} 恢复`,
                impactSummary: `恢复 ${stats.total} 项，其中更新 ${stats.updated} 项，还原 ${stats.restored} 项`
            });

            return jsonRes(res, 200, { 
                success: true, 
                message: `成功恢复 ${stats.total} 项`,
                data: {
                    baselineId,
                    version: baseline.version,
                    name: baseline.name,
                    type: baseline.type,
                    restoredAt: new Date().toISOString(),
                    stats,
                    backup: backupItems.length > 0 ? {
                        id: backupItems[0].id,
                        name: backupItems[0].name,
                        version: backupItems[0].version
                    } : null
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

        // ===== 导航树 API =====
        // 获取导航树数据
        if (url === '/api/navigation' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '缺少 projectId 参数' });
            }
            
            let filteredNav = navigation.filter(n => n.projectId === projectId);
            
            // 计算每个节点的需求数量
            filteredNav = filteredNav.map(node => {
                const reqCount = requirements.filter(r => r.headerId === node.id).length;
                const tcCount = testcases.filter(t => t.headerId === node.id).length;
                return {
                    ...node,
                    requirementCount: reqCount + tcCount
                };
            });
            
            return jsonRes(res, 200, { success: true, data: filteredNav });
        }

        // 创建导航节点
        if (url === '/api/navigation' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, name, parentId, type } = body;

            if (!projectId || !name) {
                return jsonRes(res, 400, { success: false, message: '参数不完整' });
            }

            // 计算层级和路径
            let level = 1;
            let path = '';
            if (parentId) {
                const parentNode = navigation.find(n => n.id === parentId);
                if (parentNode) {
                    level = parentNode.level + 1;
                    // 计算同级节点数量
                    const siblings = navigation.filter(n => n.parentId === parentId);
                    path = `${parentNode.path || '1'}.${siblings.length + 1}`;
                }
            } else {
                const rootNodes = navigation.filter(n => !n.parentId && n.projectId === projectId);
                path = `${rootNodes.length + 1}`;
            }

            const newNode = {
                id: generateUniqueId(),
                projectId,
                name,
                type: type || 'collection', // collection 或 header
                parentId: parentId || null,
                level,
                path,
                order: navigation.filter(n => n.parentId === parentId && n.projectId === projectId).length,
                requirementCount: 0,
                createdAt: new Date().toISOString()
            };

            navigation.push(newNode);
            saveData();

            return jsonRes(res, 201, { success: true, message: '导航节点创建成功', data: newNode });
        }

        // 更新导航节点
        if (url.match(/^\/api\/navigation\/[^\/]+$/) && method === 'PUT') {
            const nodeId = url.split('/')[3];
            const body = await parseBody(req);
            const nodeIndex = navigation.findIndex(n => n.id === nodeId);
            
            if (nodeIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '节点不存在' });
            }

            const { name, type, parentId } = body;
            if (name !== undefined) navigation[nodeIndex].name = name;
            if (type !== undefined) navigation[nodeIndex].type = type;
            if (parentId !== undefined) {
                navigation[nodeIndex].parentId = parentId;
                // TODO: 重新计算层级和路径
            }

            saveData();
            return jsonRes(res, 200, { success: true, message: '节点更新成功', data: navigation[nodeIndex] });
        }

        // 删除导航节点
        if (url.match(/^\/api\/navigation\/[^\/]+$/) && method === 'DELETE') {
            const nodeId = url.split('/')[3];
            const nodeIndex = navigation.findIndex(n => n.id === nodeId);
            
            if (nodeIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '节点不存在' });
            }

            // 检查是否有子节点
            const hasChildren = navigation.some(n => n.parentId === nodeId);
            if (hasChildren) {
                return jsonRes(res, 400, { success: false, message: '请先删除或移动子节点' });
            }

            navigation.splice(nodeIndex, 1);
            saveData();
            return jsonRes(res, 200, { success: true, message: '节点已删除' });
        }

        // 移动导航节点（上移/下移）
        if (url.match(/^\/api\/navigation\/[^\/]+\/move$/) && method === 'POST') {
            const nodeId = url.split('/')[3];
            const body = await parseBody(req);
            const { direction } = body;
            
            const nodeIndex = navigation.findIndex(n => n.id === nodeId);
            if (nodeIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '节点不存在' });
            }

            const node = navigation[nodeIndex];
            const siblings = navigation
                .map((n, i) => ({ ...n, originalIndex: i }))
                .filter(n => n.parentId === node.parentId && n.projectId === node.projectId)
                .sort((a, b) => a.order - b.order);
            
            const siblingIndex = siblings.findIndex(s => s.id === nodeId);
            if (siblingIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '节点不在兄弟姐妹列表中' });
            }

            let newIndex = siblingIndex;
            if (direction === 'up' && siblingIndex > 0) {
                newIndex = siblingIndex - 1;
            } else if (direction === 'down' && siblingIndex < siblings.length - 1) {
                newIndex = siblingIndex + 1;
            }

            if (newIndex !== siblingIndex) {
                // 交换 order
                const tempOrder = siblings[siblingIndex].order;
                navigation[siblings[siblingIndex].originalIndex].order = siblings[newIndex].order;
                navigation[siblings[newIndex].originalIndex].order = tempOrder;
                saveData();
            }

            return jsonRes(res, 200, { success: true, message: '节点移动成功', data: navigation[nodeIndex] });
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

        // ===== 历史记录 API（增强版） =====
        if (url === '/api/history' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const itemId = urlObj.searchParams.get('itemId');
            const type = urlObj.searchParams.get('type');
            const action = urlObj.searchParams.get('action'); // 按操作类型过滤
            const userId = urlObj.searchParams.get('userId'); // 按用户过滤
            const startDate = urlObj.searchParams.get('startDate'); // 开始日期
            const endDate = urlObj.searchParams.get('endDate'); // 结束日期
            const limit = parseInt(urlObj.searchParams.get('limit')) || 100;
            const includeAnalysis = urlObj.searchParams.get('analysis') === 'true'; // 是否包含分析数据
            
            let filteredHistory = history;
            if (itemId) {
                filteredHistory = filteredHistory.filter(h => h.itemId === itemId);
            }
            if (type) {
                filteredHistory = filteredHistory.filter(h => h.type === type);
            }
            if (action) {
                filteredHistory = filteredHistory.filter(h => h.action === action);
            }
            if (userId) {
                filteredHistory = filteredHistory.filter(h => h.userId === userId);
            }
            if (startDate) {
                filteredHistory = filteredHistory.filter(h => new Date(h.timestamp) >= new Date(startDate));
            }
            if (endDate) {
                filteredHistory = filteredHistory.filter(h => new Date(h.timestamp) <= new Date(endDate));
            }
            
            // 按时间倒序，返回最新的记录
            const sorted = filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // 生成统计摘要
            const stats = {
                total: sorted.length,
                byAction: {},
                byType: {},
                byUser: {},
                recentChanges: sorted.slice(0, 10).map(h => ({
                    id: h.id,
                    action: h.action,
                    type: h.type,
                    itemId: h.itemId,
                    timestamp: h.timestamp,
                    userId: h.userId,
                    changeCount: h.changes?.length || 0
                }))
            };
            
            // 统计各维度
            sorted.forEach(h => {
                stats.byAction[h.action] = (stats.byAction[h.action] || 0) + 1;
                stats.byType[h.type] = (stats.byType[h.type] || 0) + 1;
                stats.byUser[h.userId] = (stats.byUser[h.userId] || 0) + 1;
            });
            
            const result = {
                success: true,
                data: sorted.slice(0, limit),
                stats: includeAnalysis ? stats : undefined,
                pagination: {
                    total: sorted.length,
                    limit,
                    hasMore: sorted.length > limit
                }
            };
            
            return jsonRes(res, 200, result);
        }

        // ===== 获取单个历史记录详情 =====
        if (url.match(/^\/api\/history\/[^\/]+$/) && method === 'GET') {
            const historyId = url.split('/')[3];
            const record = history.find(h => h.id === historyId);
            
            if (!record) {
                return jsonRes(res, 404, { success: false, message: '历史记录不存在' });
            }
            
            // 补充相关项的当前状态
            let currentItem = null;
            if (record.type === 'requirement') {
                currentItem = requirements.find(r => r.id === record.itemId);
            } else if (record.type === 'testcase') {
                currentItem = testcases.find(t => t.id === record.itemId);
            }
            
            return jsonRes(res, 200, {
                success: true,
                data: {
                    ...record,
                    currentItem: currentItem ? {
                        id: currentItem.id,
                        reqId: currentItem.reqId || currentItem.tcId,
                        title: currentItem.title || currentItem.steps,
                        status: currentItem.status
                    } : null
                }
            });
        }

        // ===== 导出审计日志 API =====
        if (url === '/api/history/export' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const format = urlObj.searchParams.get('format') || 'csv';
            const startDate = urlObj.searchParams.get('startDate');
            const endDate = urlObj.searchParams.get('endDate');
            
            let filteredHistory = history;
            if (startDate) {
                filteredHistory = filteredHistory.filter(h => new Date(h.timestamp) >= new Date(startDate));
            }
            if (endDate) {
                filteredHistory = filteredHistory.filter(h => new Date(h.timestamp) <= new Date(endDate));
            }
            
            const sorted = filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            if (format === 'json') {
                return jsonRes(res, 200, { success: true, data: sorted });
            } else if (format === 'csv') {
                let csv = '时间，操作类型，数据类型，数据 ID，用户，变更数量，影响等级，操作来源\n';
                sorted.forEach(h => {
                    const impactLevel = h.impactStats 
                        ? `高:${h.impactStats.high}/中:${h.impactStats.medium}/低:${h.impactStats.low}`
                        : '-';
                    csv += `"${h.timestamp}","${h.action}","${h.type}","${h.itemId}","${h.userId}",${h.changes?.length || 0},"${impactLevel}","${h.operationSource || 'manual'}"\n`;
                });
                
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="audit_log_${new Date().toISOString().split('T')[0]}.csv"`);
                res.writeHead(200);
                res.end('\ufeff' + csv);
                return;
            }
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

        // License 管理 API
        if (url.startsWith('/api/license')) {
            return licenseAPI(req, res);
        }

        // ===== Word/Excel 导出 API =====
        // 导出 Word 文档
        if (url === '/api/export/word' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const reqIds = urlObj.searchParams.get('reqIds'); // 可选，导出指定需求
            const tcIds = urlObj.searchParams.get('tcIds'); // 可选，导出指定用例
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }
            
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                return jsonRes(res, 404, { success: false, message: '项目不存在' });
            }
            
            let exportReqs = requirements.filter(r => r.projectId === projectId);
            let exportTcs = testcases.filter(t => t.projectId === projectId);
            let exportTraces = traces.filter(t => 
                exportReqs.some(r => r.id === t.requirementId) && 
                exportTcs.some(tc => tc.id === t.testcaseId)
            );
            
            // 如果指定了 ID 列表，只导出这些
            if (reqIds) {
                const idList = reqIds.split(',');
                exportReqs = exportReqs.filter(r => idList.includes(r.id));
                exportTraces = exportTraces.filter(t => idList.includes(t.requirementId));
            }
            if (tcIds) {
                const idList = tcIds.split(',');
                exportTcs = exportTcs.filter(t => idList.includes(t.id));
                exportTraces = exportTraces.filter(t => idList.includes(t.testcaseId));
            }
            
            try {
                const buffer = await generateWordDocument(project, exportReqs, exportTcs, exportTraces, {
                    includeRequirements: true,
                    includeTestcases: true,
                    includeTraceMatrix: true,
                    groupByHeader: true
                });
                
                const filename = `${project.name}_需求规格说明书_${new Date().toISOString().split('T')[0]}.docx`;
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                res.writeHead(200);
                res.end(buffer);
                return;
            } catch (error) {
                logError(error, { type: 'word_export', projectId });
                return jsonRes(res, 500, { success: false, message: 'Word 导出失败：' + error.message });
            }
        }
        
        // 导出 Excel 文档
        if (url === '/api/export/excel' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const reqIds = urlObj.searchParams.get('reqIds');
            const tcIds = urlObj.searchParams.get('tcIds');
            
            if (!projectId) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 不能为空' });
            }
            
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                return jsonRes(res, 404, { success: false, message: '项目不存在' });
            }
            
            let exportReqs = requirements.filter(r => r.projectId === projectId);
            let exportTcs = testcases.filter(t => t.projectId === projectId);
            let exportTraces = traces.filter(t => 
                exportReqs.some(r => r.id === t.requirementId) && 
                exportTcs.some(tc => tc.id === t.testcaseId)
            );
            
            if (reqIds) {
                const idList = reqIds.split(',');
                exportReqs = exportReqs.filter(r => idList.includes(r.id));
                exportTraces = exportTraces.filter(t => idList.includes(t.requirementId));
            }
            if (tcIds) {
                const idList = tcIds.split(',');
                exportTcs = exportTcs.filter(t => idList.includes(t.id));
                exportTraces = exportTraces.filter(t => idList.includes(t.testcaseId));
            }
            
            try {
                const buffer = generateExcelDocument(project, exportReqs, exportTcs, exportTraces, {
                    includeRequirements: true,
                    includeTestcases: true,
                    includeTraceMatrix: true,
                    groupByHeader: true
                });
                
                const filename = `${project.name}_需求用例导出_${new Date().toISOString().split('T')[0]}.xlsx`;
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                res.writeHead(200);
                res.end(buffer);
                return;
            } catch (error) {
                logError(error, { type: 'excel_export', projectId });
                return jsonRes(res, 500, { success: false, message: 'Excel 导出失败：' + error.message });
            }
        }
        
        // 批量导出（支持多个项目）
        if (url === '/api/export/batch' && method === 'POST') {
            const body = await parseBody(req);
            const { projectIds, format = 'excel', includeRequirements = true, includeTestcases = true } = body;
            
            if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
                return jsonRes(res, 400, { success: false, message: '项目 ID 列表不能为空' });
            }
            
            try {
                const exportProjects = projects.filter(p => projectIds.includes(p.id));
                
                if (exportProjects.length === 0) {
                    return jsonRes(res, 404, { success: false, message: '未找到指定项目' });
                }
                
                if (format === 'excel') {
                    const workbook = XLSX.utils.book_new();
                    
                    for (const project of exportProjects) {
                        const exportReqs = requirements.filter(r => r.projectId === project.id);
                        const exportTcs = testcases.filter(t => t.projectId === project.id);
                        const exportTraces = traces.filter(t => 
                            exportReqs.some(r => r.id === t.requirementId) && 
                            exportTcs.some(tc => tc.id === t.testcaseId)
                        );
                        
                        // 为每个项目创建一个工作表
                        if (includeRequirements && exportReqs.length > 0) {
                            const reqData = [['需求 ID', '标题', '分类', '状态', '优先级', '描述']];
                            exportReqs.forEach(req => {
                                reqData.push([
                                    req.reqId,
                                    req.title || '',
                                    req.category || '',
                                    req.status || '',
                                    req.priority || '',
                                    stripHtml(req.description || '')
                                ]);
                            });
                            
                            const reqWorksheet = XLSX.utils.aoa_to_sheet(reqData);
                            XLSX.utils.book_append_sheet(workbook, reqWorksheet, `${project.name}-需求`);
                        }
                        
                        if (includeTestcases && exportTcs.length > 0) {
                            const tcData = [['用例 ID', '类型', '状态', '步骤', '预期结果']];
                            exportTcs.forEach(tc => {
                                tcData.push([
                                    tc.tcId,
                                    tc.type || '',
                                    tc.status || '',
                                    stripHtml(tc.steps || ''),
                                    stripHtml(tc.expectedResult || '')
                                ]);
                            });
                            
                            const tcWorksheet = XLSX.utils.aoa_to_sheet(tcData);
                            XLSX.utils.book_append_sheet(workbook, tcWorksheet, `${project.name}-用例`);
                        }
                    }
                    
                    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
                    const filename = `批量导出_${new Date().toISOString().split('T')[0]}.xlsx`;
                    
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                    res.writeHead(200);
                    res.end(buffer);
                    return;
                } else {
                    return jsonRes(res, 400, { success: false, message: '暂不支持批量 Word 导出' });
                }
            } catch (error) {
                logError(error, { type: 'batch_export' });
                return jsonRes(res, 500, { success: false, message: '批量导出失败：' + error.message });
            }
        }
        
        // 自定义模板导出
        if (url === '/api/export/custom' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId, template } = body;
            
            if (!projectId || !template) {
                return jsonRes(res, 400, { success: false, message: '参数不完整' });
            }
            
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                return jsonRes(res, 404, { success: false, message: '项目不存在' });
            }
            
            const exportReqs = requirements.filter(r => r.projectId === projectId);
            const exportTcs = testcases.filter(t => t.projectId === projectId);
            const exportTraces = traces.filter(t => 
                exportReqs.some(r => r.id === t.requirementId) && 
                exportTcs.some(tc => tc.id === t.testcaseId)
            );
            
            try {
                const buffer = await generateCustomTemplateDocument(project, exportReqs, exportTcs, exportTraces, template);
                
                const filename = `${project.name}_自定义导出_${new Date().toISOString().split('T')[0]}.${template.format === 'word' ? 'docx' : 'xlsx'}`;
                const contentType = template.format === 'word' 
                    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                res.writeHead(200);
                res.end(buffer);
                return;
            } catch (error) {
                logError(error, { type: 'custom_export' });
                return jsonRes(res, 500, { success: false, message: '自定义导出失败：' + error.message });
            }
        }

        // ===== 任务管理 API =====
        // 获取任务列表（支持项目筛选、状态筛选、负责人筛选）
        if (url === '/api/tasks' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const status = urlObj.searchParams.get('status');
            const assignee = urlObj.searchParams.get('assignee');
            const priority = urlObj.searchParams.get('priority');
            
            let filteredTasks = tasksData.tasks || [];
            
            if (projectId) {
                filteredTasks = filteredTasks.filter(t => t.projectId === projectId);
            }
            if (status) {
                filteredTasks = filteredTasks.filter(t => t.status === status);
            }
            if (assignee) {
                filteredTasks = filteredTasks.filter(t => t.assignee === assignee);
            }
            if (priority) {
                filteredTasks = filteredTasks.filter(t => t.priority === priority);
            }
            
            // 按优先级和截止日期排序
            filteredTasks.sort((a, b) => {
                const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31');
            });
            
            return jsonRes(res, 200, { 
                success: true, 
                data: filteredTasks,
                users: tasksData.users || [],
                projects: tasksData.projects || []
            });
        }

        // 创建任务
        if (url === '/api/tasks' && method === 'POST') {
            const body = await parseBody(req);
            const { 
                title, description, projectId, parentId, 
                assignee, priority, status, dueDate,
                estimatedHours, tags 
            } = body;

            if (!title) {
                return jsonRes(res, 400, { success: false, message: '任务标题不能为空' });
            }

            const newTask = {
                id: generateUniqueId(),
                title,
                description: description || '',
                projectId: projectId || '',
                parentId: parentId || null,
                assignee: assignee || '',
                priority: priority || 'medium',
                status: status || 'todo',
                progress: 0,
                dueDate: dueDate || null,
                estimatedHours: estimatedHours || 0,
                actualHours: 0,
                tags: tags || [],
                comments: [],
                completedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'admin'
            };

            if (!tasksData.tasks) tasksData.tasks = [];
            tasksData.tasks.push(newTask);
            saveData();

            return jsonRes(res, 201, { success: true, message: '任务创建成功', data: newTask });
        }

        // 更新任务
        if (url.match(/^\/api\/tasks\/[^\/]+$/) && method === 'PUT') {
            const taskId = url.split('/')[3];
            const body = await parseBody(req);
            const taskIndex = (tasksData.tasks || []).findIndex(t => t.id === taskId);
            
            if (taskIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '任务不存在' });
            }

            const oldData = JSON.parse(JSON.stringify(tasksData.tasks[taskIndex]));
            const { 
                title, description, projectId, parentId, assignee, 
                priority, status, progress, dueDate, estimatedHours, 
                actualHours, tags, completed 
            } = body;

            if (title !== undefined) tasksData.tasks[taskIndex].title = title;
            if (description !== undefined) tasksData.tasks[taskIndex].description = description;
            if (projectId !== undefined) tasksData.tasks[taskIndex].projectId = projectId;
            if (parentId !== undefined) tasksData.tasks[taskIndex].parentId = parentId;
            if (assignee !== undefined) tasksData.tasks[taskIndex].assignee = assignee;
            if (priority !== undefined) tasksData.tasks[taskIndex].priority = priority;
            if (status !== undefined) {
                tasksData.tasks[taskIndex].status = status;
                if (status === 'done' && !oldData.completedAt) {
                    tasksData.tasks[taskIndex].completedAt = new Date().toISOString();
                }
            }
            if (progress !== undefined) tasksData.tasks[taskIndex].progress = progress;
            if (dueDate !== undefined) tasksData.tasks[taskIndex].dueDate = dueDate;
            if (estimatedHours !== undefined) tasksData.tasks[taskIndex].estimatedHours = estimatedHours;
            if (actualHours !== undefined) tasksData.tasks[taskIndex].actualHours = actualHours;
            if (tags !== undefined) tasksData.tasks[taskIndex].tags = tags;
            
            tasksData.tasks[taskIndex].updatedAt = new Date().toISOString();
            saveData();

            return jsonRes(res, 200, { success: true, message: '任务更新成功', data: tasksData.tasks[taskIndex] });
        }

        // 删除任务
        if (url.match(/^\/api\/tasks\/[^\/]+$/) && method === 'DELETE') {
            const taskId = url.split('/')[3];
            const taskIndex = (tasksData.tasks || []).findIndex(t => t.id === taskId);
            
            if (taskIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '任务不存在' });
            }

            // 检查是否有子任务
            const hasChildren = (tasksData.tasks || []).some(t => t.parentId === taskId);
            if (hasChildren) {
                return jsonRes(res, 400, { success: false, message: '请先删除或移动子任务' });
            }

            tasksData.tasks.splice(taskIndex, 1);
            saveData();

            return jsonRes(res, 200, { success: true, message: '任务已删除' });
        }

        // 获取任务统计
        if (url === '/api/tasks/stats' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            let filteredTasks = tasksData.tasks || [];
            if (projectId) {
                filteredTasks = filteredTasks.filter(t => t.projectId === projectId);
            }

            const users = tasksData.users || [];
            
            // 按状态统计
            const byStatus = {
                todo: filteredTasks.filter(t => t.status === 'todo').length,
                inProgress: filteredTasks.filter(t => t.status === 'inProgress').length,
                done: filteredTasks.filter(t => t.status === 'done').length,
                blocked: filteredTasks.filter(t => t.status === 'blocked').length
            };

            // 按负责人统计
            const byAssignee = users.map(user => ({
                userId: user.id,
                userName: user.name,
                avatar: user.avatar,
                total: filteredTasks.filter(t => t.assignee === user.id).length,
                todo: filteredTasks.filter(t => t.assignee === user.id && t.status === 'todo').length,
                inProgress: filteredTasks.filter(t => t.assignee === user.id && t.status === 'inProgress').length,
                done: filteredTasks.filter(t => t.assignee === user.id && t.status === 'done').length,
                blocked: filteredTasks.filter(t => t.assignee === user.id && t.status === 'blocked').length
            }));

            // 按优先级统计
            const byPriority = {
                urgent: filteredTasks.filter(t => t.priority === 'urgent').length,
                high: filteredTasks.filter(t => t.priority === 'high').length,
                medium: filteredTasks.filter(t => t.priority === 'medium').length,
                low: filteredTasks.filter(t => t.priority === 'low').length
            };

            // 完成率
            const total = filteredTasks.length;
            const completed = byStatus.done;
            const completionRate = total > 0 ? Math.round(completed / total * 100) : 0;

            // 阻塞任务告警
            const blockedTasks = filteredTasks.filter(t => t.status === 'blocked');

            // 即将到期任务（3 天内）
            const now = new Date();
            const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const dueSoonTasks = filteredTasks.filter(t => {
                if (!t.dueDate || t.status === 'done') return false;
                const dueDate = new Date(t.dueDate);
                return dueDate <= threeDaysLater && dueDate >= now;
            });

            // 已过期任务
            const overdueTasks = filteredTasks.filter(t => {
                if (!t.dueDate || t.status === 'done') return false;
                return new Date(t.dueDate) < now;
            });

            return jsonRes(res, 200, {
                success: true,
                data: {
                    summary: {
                        total,
                        completed,
                        completionRate,
                        todo: byStatus.todo,
                        inProgress: byStatus.inProgress,
                        blocked: byStatus.blocked,
                        overdue: overdueTasks.length
                    },
                    byStatus,
                    byAssignee,
                    byPriority,
                    alerts: {
                        blocked: blockedTasks.map(t => ({
                            id: t.id,
                            title: t.title,
                            assignee: t.assignee,
                            dueDate: t.dueDate
                        })),
                        dueSoon: dueSoonTasks.map(t => ({
                            id: t.id,
                            title: t.title,
                            assignee: t.assignee,
                            dueDate: t.dueDate
                        })),
                        overdue: overdueTasks.map(t => ({
                            id: t.id,
                            title: t.title,
                            assignee: t.assignee,
                            dueDate: t.dueDate
                        }))
                    }
                }
            });
        }

        // 获取看板视图数据
        if (url === '/api/tasks/board' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            const groupBy = urlObj.searchParams.get('groupBy') || 'status'; // status or assignee
            
            let filteredTasks = tasksData.tasks || [];
            if (projectId) {
                filteredTasks = filteredTasks.filter(t => t.projectId === projectId);
            }

            const users = tasksData.users || [];
            const projects = tasksData.projects || [];

            // 构建树形结构（父子任务）
            const taskTree = {};
            const rootTasks = [];
            
            filteredTasks.forEach(task => {
                taskTree[task.id] = { ...task, children: [] };
            });
            
            filteredTasks.forEach(task => {
                if (task.parentId && taskTree[task.parentId]) {
                    taskTree[task.parentId].children.push(taskTree[task.id]);
                } else if (!task.parentId) {
                    rootTasks.push(taskTree[task.id]);
                }
            });

            // 按状态分组
            const byStatus = {
                todo: rootTasks.filter(t => t.status === 'todo'),
                inProgress: rootTasks.filter(t => t.status === 'inProgress'),
                done: rootTasks.filter(t => t.status === 'done'),
                blocked: rootTasks.filter(t => t.status === 'blocked')
            };

            // 按负责人分组
            const byAssignee = {};
            users.forEach(user => {
                byAssignee[user.id] = {
                    user,
                    tasks: rootTasks.filter(t => t.assignee === user.id)
                };
            });

            return jsonRes(res, 200, {
                success: true,
                data: {
                    groupBy,
                    columns: groupBy === 'status' ? {
                        todo: { title: '待办', tasks: byStatus.todo, color: '#6b7280' },
                        inProgress: { title: '进行中', tasks: byStatus.inProgress, color: '#3b82f6' },
                        done: { title: '已完成', tasks: byStatus.done, color: '#10b981' },
                        blocked: { title: '已阻塞', tasks: byStatus.blocked, color: '#ef4444' }
                    } : {
                        byAssignee,
                        unassigned: { title: '未分配', tasks: rootTasks.filter(t => !t.assignee), color: '#9ca3af' }
                    },
                    users,
                    projects,
                    taskTree
                }
            });
        }

        // 添加任务评论
        if (url.match(/^\/api\/tasks\/[^\/]+\/comments$/) && method === 'POST') {
            const taskId = url.split('/')[3];
            const body = await parseBody(req);
            const taskIndex = (tasksData.tasks || []).findIndex(t => t.id === taskId);
            
            if (taskIndex === -1) {
                return jsonRes(res, 404, { success: false, message: '任务不存在' });
            }

            const { content, author } = body;
            
            if (!content) {
                return jsonRes(res, 400, { success: false, message: '评论内容不能为空' });
            }

            const comment = {
                id: generateUniqueId(),
                content,
                author: author || 'admin',
                createdAt: new Date().toISOString()
            };

            if (!tasksData.tasks[taskIndex].comments) {
                tasksData.tasks[taskIndex].comments = [];
            }
            tasksData.tasks[taskIndex].comments.push(comment);
            tasksData.tasks[taskIndex].updatedAt = new Date().toISOString();
            saveData();

            return jsonRes(res, 201, { success: true, message: '评论添加成功', data: comment });
        }

        // 获取用户列表
        if (url === '/api/tasks/users' && method === 'GET') {
            return jsonRes(res, 200, { success: true, data: tasksData.users || [] });
        }

        // 获取项目列表
        if (url === '/api/tasks/projects' && method === 'GET') {
            return jsonRes(res, 200, { success: true, data: tasksData.projects || [] });
        }

        // 健康检查
        if (url === '/api/health' && method === 'GET') {
            const licenseStatus = validateLicense();
            return jsonRes(res, 200, createSuccessResponse({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '1.0.0',
                license: licenseStatus
            }, '系统健康'));
        }

        // ===== 仪表盘统计 API =====
        // 获取仪表盘统计数据
        if (url === '/api/dashboard/stats' && method === 'GET') {
            const urlObj = new URL('http://localhost' + fullUrl);
            const projectId = urlObj.searchParams.get('projectId');
            
            // 过滤数据
            let filteredReqs = requirements;
            let filteredTcs = testcases;
            let filteredProjects = projects;
            
            if (projectId) {
                filteredReqs = requirements.filter(r => r.projectId === projectId);
                filteredTcs = testcases.filter(t => t.projectId === projectId);
                filteredProjects = projects.filter(p => p.id === projectId);
            }
            
            // 统计不同状态的数量
            const reqStats = {
                total: filteredReqs.length,
                draft: filteredReqs.filter(r => r.status === 'draft').length,
                review: filteredReqs.filter(r => r.status === 'review').length,
                active: filteredReqs.filter(r => r.status === 'active').length,
                completed: filteredReqs.filter(r => r.status === 'completed').length
            };
            
            const tcStats = {
                total: filteredTcs.length,
                not_executed: filteredTcs.filter(t => t.status === 'not_executed').length,
                passed: filteredTcs.filter(t => t.status === 'passed').length,
                failed: filteredTcs.filter(t => t.status === 'failed').length,
                blocked: filteredTcs.filter(t => t.status === 'blocked').length
            };
            
            // 计算执行率和通过率
            const executed = tcStats.passed + tcStats.failed;
            const executionRate = filteredTcs.length > 0 ? Math.round(executed / filteredTcs.length * 100) : 0;
            const passRate = executed > 0 ? Math.round(tcStats.passed / executed * 100) : 0;
            
            // 计算追踪覆盖率
            const coveredReqs = new Set(traces.filter(t => 
                filteredReqs.some(r => r.id === t.requirementId)
            ).map(t => t.requirementId)).size;
            const traceCoverage = filteredReqs.length > 0 ? Math.round(coveredReqs / filteredReqs.length * 100) : 0;
            
            // 最近 7 天的需求创建趋势
            const trendData = [];
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const count = filteredReqs.filter(r => 
                    new Date(r.createdAt).toISOString().split('T')[0] === dateStr
                ).length;
                trendData.push({ date: dateStr, count });
            }
            
            // 待办事项统计
            const todoCount = reqStats.draft + reqStats.review + tcStats.not_executed + tcStats.failed;
            
            return jsonRes(res, 200, createSuccessResponse({
                summary: {
                    totalRequirements: reqStats.total,
                    totalTestcases: tcStats.total,
                    totalProjects: filteredProjects.length,
                    traceCoverage,
                    executionRate,
                    passRate,
                    todoCount
                },
                requirements: reqStats,
                testcases: tcStats,
                trend: trendData,
                recentActivities: history.slice(0, 10).map(h => ({
                    id: h.id,
                    type: h.type,
                    action: h.action,
                    timestamp: h.timestamp,
                    itemId: h.itemId
                }))
            }, '仪表盘统计数据'));
        }

        // ===== AI 智能助手 API =====
        // 1. AI 需求生成
        if (url === '/api/ai/generate-requirement' && method === 'POST') {
            const body = await parseBody(req);
            const { userInput } = body;
            
            if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
                return jsonRes(res, 400, createErrorResponse('用户输入不能为空', ERROR_CODES.VALIDATION_ERROR));
            }
            
            try {
                const result = await aiAssistant.generateRequirement(userInput);
                return jsonRes(res, 200, createSuccessResponse({
                    result,
                    type: 'requirement',
                }, '需求生成成功'));
            } catch (error) {
                logError(error, { api: 'generate-requirement' });
                return jsonRes(res, 500, createErrorResponse(
                    'AI 服务不可用：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 2. AI 测试用例生成
        if (url === '/api/ai/generate-testcase' && method === 'POST') {
            const body = await parseBody(req);
            const { requirementDoc, requirementId } = body;
            
            if (!requirementDoc || typeof requirementDoc !== 'string') {
                return jsonRes(res, 400, createErrorResponse('需求文档不能为空', ERROR_CODES.VALIDATION_ERROR));
            }
            
            try {
                const result = await aiAssistant.generateTestcase(requirementDoc);
                return jsonRes(res, 200, createSuccessResponse({
                    result,
                    type: 'testcase',
                    requirementId: requirementId || null,
                }, '测试用例生成成功'));
            } catch (error) {
                logError(error, { api: 'generate-testcase' });
                return jsonRes(res, 500, createErrorResponse(
                    'AI 服务不可用：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 3. AI 需求审查
        if (url === '/api/ai/review-requirement' && method === 'POST') {
            const body = await parseBody(req);
            const { requirementText, requirementId } = body;
            
            if (!requirementText || typeof requirementText !== 'string') {
                return jsonRes(res, 400, createErrorResponse('需求文本不能为空', ERROR_CODES.VALIDATION_ERROR));
            }
            
            try {
                const result = await aiAssistant.reviewRequirement(requirementText);
                return jsonRes(res, 200, createSuccessResponse({
                    result,
                    type: 'review',
                    requirementId: requirementId || null,
                }, '需求审查完成'));
            } catch (error) {
                logError(error, { api: 'review-requirement' });
                return jsonRes(res, 500, createErrorResponse(
                    'AI 服务不可用：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 4. AI 缺陷分类
        if (url === '/api/ai/classify-defect' && method === 'POST') {
            const body = await parseBody(req);
            const { defectDescription, defectId, includeHistory } = body;
            
            if (!defectDescription || typeof defectDescription !== 'string') {
                return jsonRes(res, 400, createErrorResponse('缺陷描述不能为空', ERROR_CODES.VALIDATION_ERROR));
            }
            
            try {
                // 可选：加载历史缺陷数据
                let historicalDefects = '';
                if (includeHistory) {
                    const defects = JSON.parse(fs.readFileSync(DEFECTS_FILE, 'utf-8') || '[]');
                    historicalDefects = defects.slice(0, 10).map(d => 
                        `ID: ${d.id}, 描述：${d.description}, 类型：${d.type}, 严重程度：${d.severity}`
                    ).join('\n');
                }
                
                const result = await aiAssistant.classifyDefect(defectDescription, historicalDefects);
                return jsonRes(res, 200, createSuccessResponse({
                    result,
                    type: 'classification',
                    defectId: defectId || null,
                }, '缺陷分类完成'));
            } catch (error) {
                logError(error, { api: 'classify-defect' });
                return jsonRes(res, 500, createErrorResponse(
                    'AI 服务不可用：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 5. AI 任务智能分配
        if (url === '/api/ai/assign-task' && method === 'POST') {
            const body = await parseBody(req);
            const { taskDescription, taskId } = body;
            
            if (!taskDescription || typeof taskDescription !== 'string') {
                return jsonRes(res, 400, createErrorResponse('任务描述不能为空', ERROR_CODES.VALIDATION_ERROR));
            }
            
            try {
                // 加载团队成员和工作负载数据
                const tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8') || '{ tasks: [], users: [] }');
                const teamMembers = tasks.users || [];
                const currentWorkload = tasks.tasks || [];
                
                const result = await aiAssistant.assignTask(
                    taskDescription,
                    JSON.stringify(teamMembers, null, 2),
                    JSON.stringify(currentWorkload, null, 2)
                );
                return jsonRes(res, 200, createSuccessResponse({
                    result,
                    type: 'assignment',
                    taskId: taskId || null,
                }, '任务分配建议生成成功'));
            } catch (error) {
                logError(error, { api: 'assign-task' });
                return jsonRes(res, 500, createErrorResponse(
                    'AI 服务不可用：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 6. AI 智能搜索
        if (url === '/api/ai/search' && method === 'POST') {
            const body = await parseBody(req);
            const { query, filters } = body;
            
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                return jsonRes(res, 400, createErrorResponse('搜索关键词不能为空', ERROR_CODES.VALIDATION_ERROR));
            }
            
            try {
                // 分析搜索意图
                const searchAnalysis = aiAssistant.analyzeSearchQuery(query);
                
                // 执行搜索（本地实现）
                const searchResults = {
                    requirements: [],
                    testcases: [],
                    defects: [],
                    tasks: [],
                };
                
                const keywords = searchAnalysis.keywords.map(k => k.toLowerCase());
                
                // 搜索需求
                searchResults.requirements = requirements.filter(r => 
                    keywords.some(k => 
                        r.title?.toLowerCase().includes(k) || 
                        r.description?.toLowerCase().includes(k)
                    )
                ).slice(0, 10);
                
                // 搜索测试用例
                searchResults.testcases = testcases.filter(t => 
                    keywords.some(k => 
                        t.title?.toLowerCase().includes(k) || 
                        t.description?.toLowerCase().includes(k)
                    )
                ).slice(0, 10);
                
                // 搜索缺陷
                const defects = JSON.parse(fs.readFileSync(DEFECTS_FILE, 'utf-8') || '[]');
                searchResults.defects = defects.filter(d => 
                    keywords.some(k => 
                        d.title?.toLowerCase().includes(k) || 
                        d.description?.toLowerCase().includes(k)
                    )
                ).slice(0, 10);
                
                // 搜索任务
                const tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8') || '{ tasks: [] }');
                searchResults.tasks = tasks.tasks.filter(t => 
                    keywords.some(k => 
                        t.title?.toLowerCase().includes(k) || 
                        t.description?.toLowerCase().includes(k)
                    )
                ).slice(0, 10);
                
                return jsonRes(res, 200, createSuccessResponse({
                    query: searchAnalysis,
                    results: searchResults,
                    suggestions: searchAnalysis.suggestions,
                }, '搜索完成'));
            } catch (error) {
                logError(error, { api: 'search' });
                return jsonRes(res, 500, createErrorResponse(
                    '搜索失败：' + error.message,
                    ERROR_CODES.SEARCH_ERROR
                ));
            }
        }

        // 7. AI 变更影响分析
        if (url === '/api/ai/impact-analysis' && method === 'POST') {
            const body = await parseBody(req);
            const { changeDescription, requirementId } = body;
            
            if (!changeDescription || typeof changeDescription !== 'string') {
                return jsonRes(res, 400, createErrorResponse('变更描述不能为空', ERROR_CODES.VALIDATION_ERROR));
            }
            
            try {
                // 收集关联项目信息
                const relatedItems = {
                    requirements: requirements.filter(r => r.id === requirementId),
                    testcases: testcases.filter(t => 
                        traces.some(trace => trace.requirementId === requirementId && trace.testcaseId === t.id)
                    ),
                    traces: traces.filter(t => t.requirementId === requirementId),
                };
                
                const result = await aiAssistant.analyzeImpact(changeDescription, relatedItems);
                return jsonRes(res, 200, createSuccessResponse({
                    result,
                    type: 'impact-analysis',
                    requirementId: requirementId || null,
                }, '影响分析完成'));
            } catch (error) {
                logError(error, { api: 'impact-analysis' });
                return jsonRes(res, 500, createErrorResponse(
                    'AI 服务不可用：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 8. AI 项目风险预测
        if (url === '/api/ai/risk-prediction' && method === 'POST') {
            const body = await parseBody(req);
            const { projectId } = body;
            
            try {
                // 收集项目数据
                const projectData = {
                    requirements: projectId ? requirements.filter(r => r.projectId === projectId) : requirements,
                    testcases: projectId ? testcases.filter(t => t.projectId === projectId) : testcases,
                    tasks: JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8') || '{ tasks: [] }').tasks,
                    baselines: baselines,
                };
                
                // 历史数据（从历史记录中提取）
                const historicalData = {
                    history: history.slice(0, 100),
                    baselines: baselines.slice(0, 20),
                };
                
                const result = await aiAssistant.predictRisk(projectData, historicalData);
                return jsonRes(res, 200, createSuccessResponse({
                    result,
                    type: 'risk-prediction',
                    projectId: projectId || null,
                }, '风险预测完成'));
            } catch (error) {
                logError(error, { api: 'risk-prediction' });
                return jsonRes(res, 500, createErrorResponse(
                    'AI 服务不可用：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 9. AI 智能建议（通用建议接口）
        if (url === '/api/ai/suggestions' && method === 'GET') {
            try {
                const urlObj = new URL('http://localhost' + fullUrl);
                const context = urlObj.searchParams.get('context') || 'general';
                
                // 根据上下文生成建议
                const suggestions = {
                    general: [
                        '检查是否有未评审的需求',
                        '查看测试覆盖率低于 80% 的模块',
                        ' review 本周新增的缺陷',
                        '更新项目进度报告',
                    ],
                    requirement: [
                        '为需求添加验收标准',
                        '检查需求的可测试性',
                        '关联相关测试用例',
                        '评审需求变更',
                    ],
                    testcase: [
                        '补充边界值测试用例',
                        '更新过期的测试用例',
                        '关联需求文档',
                        '执行失败的测试用例',
                    ],
                };
                
                return jsonRes(res, 200, createSuccessResponse({
                    suggestions: suggestions[context] || suggestions.general,
                    context,
                }, '获取建议成功'));
            } catch (error) {
                logError(error, { api: 'suggestions' });
                return jsonRes(res, 500, createErrorResponse(
                    '获取建议失败：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
        }

        // 10. AI 服务状态检查
        if (url === '/api/ai/status' && method === 'GET') {
            try {
                const status = aiAssistant.getAIStatus();
                const connectionTest = await aiAssistant.testAIConnection();
                
                return jsonRes(res, 200, createSuccessResponse({
                    status,
                    connection: connectionTest,
                }, 'AI 服务状态正常'));
            } catch (error) {
                logError(error, { api: 'status' });
                return jsonRes(res, 500, createErrorResponse(
                    '获取状态失败：' + error.message,
                    ERROR_CODES.AI_SERVICE_ERROR
                ));
            }
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

