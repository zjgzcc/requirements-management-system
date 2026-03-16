const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8002;
const WEB_DIR = path.join(__dirname, 'web');

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

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // 处理根路径，重定向到登录页面
    let filePath = req.url === '/' ? '/login.html' : req.url;
    
    // 防止路径遍历攻击
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║          需求管理系统 - 服务器已启动                      ║
╠══════════════════════════════════════════════════════════╣
║  本地访问：http://localhost:${PORT}                       ║
║  远程访问：http://<服务器 IP>:${PORT}                     ║
║                                                          ║
║  按 Ctrl+C 停止服务器                                    ║
╚══════════════════════════════════════════════════════════╝
    `);
});
