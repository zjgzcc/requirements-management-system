// ===== 需求管理系统 - API 服务器（重构版）=====
// 稳定版本 - 修复服务器自动退出问题

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8001;
const WEB_DIR = __dirname;

// MIME 类型映射
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 简单路由处理
function handleRequest(req, res) {
    const url = req.url.split('?')[0];
    const method = req.method;

    // API 路由
    if (url.startsWith('/api/')) {
        handleApiRequest(req, res, url, method);
        return;
    }

    // 静态文件
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
}

// 简化 API 处理
function handleApiRequest(req, res, url, method) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 健康检查
    if (url === '/api/health' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            message: '系统健康',
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '2.0.0'
            }
        }));
        return;
    }

    // 系统统计
    if (url === '/api/system/stats' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            data: {
                totalRequirements: 0,
                totalTestcases: 0,
                totalProjects: 0,
                traceCoverage: 0
            }
        }));
        return;
    }

    // 默认 404
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: '接口不存在' }));
}

// 创建服务器
const server = http.createServer(handleRequest);

// 启动服务器 - 使用回调确保启动完成
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       需求管理系统 - 服务器已启动 (v2.0 稳定版)          ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  本地访问：http://localhost:${PORT}                       ║`);
    console.log(`║  远程访问：http://8.215.93.217:${PORT}                  ║`);
    console.log('║                                                          ║');
    console.log('║  状态：✅ 正常运行中                                     ║');
    console.log('║  按 Ctrl+C 停止服务器                                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
});

// 错误处理
server.on('error', (err) => {
    console.error('服务器错误:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用，请检查是否有其他进程在使用`);
    }
    process.exit(1);
});

// 优雅退出
process.on('SIGTERM', () => {
    console.log('\n收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n收到 SIGINT 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

// 未捕获异常处理
process.on('uncaughtException', (err) => {
    console.error('未捕获异常:', err.message);
    // 不退出，继续运行
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
    // 不退出，继续运行
});
