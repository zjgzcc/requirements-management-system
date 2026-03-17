/**
 * License 验证中间件
 * 用于商用授权管理，支持硬件绑定
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LICENSE_FILE = path.join(__dirname, 'license.json');

/**
 * 生成机器指纹（硬件绑定）
 */
function getMachineFingerprint() {
    // 使用主机名、平台、架构等信息生成指纹
    const os = require('os');
    const machineInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.totalmem()}`;
    return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
}

/**
 * 生成 License Key
 * @param {string} customerName - 客户名称
 * @param {string} expiryDate - 过期日期 (YYYY-MM-DD)
 * @param {string} features - 功能列表 (数组)
 * @returns {object} License 对象
 */
function generateLicense(customerName, expiryDate, features = ['all']) {
    const fingerprint = getMachineFingerprint();
    const licenseData = {
        customer: customerName,
        issued: new Date().toISOString(),
        expiry: expiryDate,
        features: features,
        fingerprint: fingerprint,
        licenseKey: ''
    };
    
    // 生成签名
    const dataToSign = JSON.stringify({
        customer: licenseData.customer,
        issued: licenseData.issued,
        expiry: licenseData.expiry,
        features: licenseData.features,
        fingerprint: licenseData.fingerprint
    });
    
    licenseData.licenseKey = crypto
        .createHmac('sha256', 'LICENSE_SECRET_KEY_CHANGE_IN_PRODUCTION')
        .update(dataToSign)
        .digest('hex');
    
    return licenseData;
}

/**
 * 验证 License
 * @returns {object} 验证结果
 */
function validateLicense() {
    try {
        if (!fs.existsSync(LICENSE_FILE)) {
            return {
                valid: false,
                message: '未找到 License 文件，请使用试用模式或激活系统',
                mode: 'trial'
            };
        }
        
        const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
        
        // 验证签名
        const dataToSign = JSON.stringify({
            customer: licenseData.customer,
            issued: licenseData.issued,
            expiry: licenseData.expiry,
            features: licenseData.features,
            fingerprint: licenseData.fingerprint
        });
        
        const expectedKey = crypto
            .createHmac('sha256', 'LICENSE_SECRET_KEY_CHANGE_IN_PRODUCTION')
            .update(dataToSign)
            .digest('hex');
        
        if (licenseData.licenseKey !== expectedKey) {
            return {
                valid: false,
                message: 'License 签名验证失败',
                mode: 'trial'
            };
        }
        
        // 验证机器指纹
        const currentFingerprint = getMachineFingerprint();
        if (licenseData.fingerprint !== currentFingerprint) {
            return {
                valid: false,
                message: 'License 与当前机器不匹配（硬件变更）',
                mode: 'trial',
                currentFingerprint,
                licensedFingerprint: licenseData.fingerprint
            };
        }
        
        // 验证过期时间
        const expiryDate = new Date(licenseData.expiry);
        const now = new Date();
        
        if (expiryDate < now) {
            return {
                valid: false,
                message: 'License 已过期',
                mode: 'trial',
                expired: true,
                expiryDate: licenseData.expiry
            };
        }
        
        // 计算剩余天数
        const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        return {
            valid: true,
            message: 'License 验证通过',
            mode: 'licensed',
            customer: licenseData.customer,
            expiryDate: licenseData.expiry,
            daysLeft: daysLeft,
            features: licenseData.features
        };
        
    } catch (error) {
        console.error('License 验证错误:', error);
        return {
            valid: false,
            message: 'License 验证出错',
            mode: 'trial'
        };
    }
}

/**
 * 保存 License 到文件
 * @param {object} licenseData - License 数据
 */
function saveLicense(licenseData) {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenseData, null, 2), 'utf-8');
}

/**
 * License 验证中间件
 */
function licenseMiddleware(req, res, next) {
    // 跳过 License 验证的接口
    const skipPaths = [
        '/api/license/validate',
        '/api/license/activate',
        '/api/health',
        '/api/system/stats'
    ];
    
    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    }
    
    const licenseStatus = validateLicense();
    
    // 将 License 状态添加到响应头
    res.setHeader('X-License-Mode', licenseStatus.mode);
    res.setHeader('X-License-Valid', licenseStatus.valid);
    
    // 如果是试用模式，添加警告头
    if (licenseStatus.mode === 'trial') {
        res.setHeader('X-License-Message', encodeURIComponent(licenseStatus.message));
    }
    
    next();
}

/**
 * 导出 API 接口处理器
 */
function licenseAPI(req, res) {
    const method = req.method;
    const url = req.url;
    
    // GET /api/license/validate - 验证 License 状态
    if (url === '/api/license/validate' && method === 'GET') {
        const status = validateLicense();
        return res.writeHead(200, { 'Content-Type': 'application/json' })
            .end(JSON.stringify({ success: true, data: status }));
    }
    
    // POST /api/license/activate - 激活 License
    if (url === '/api/license/activate' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { licenseKey, customer } = JSON.parse(body);
                
                if (!licenseKey || !customer) {
                    return res.writeHead(400, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify({ success: false, message: '缺少必要参数' }));
                }
                
                // 这里应该验证 licenseKey 的有效性
                // 简化版本：直接生成一个永久 License
                const licenseData = generateLicense(customer, '2099-12-31', ['all']);
                saveLicense(licenseData);
                
                return res.writeHead(200, { 'Content-Type': 'application/json' })
                    .end(JSON.stringify({ 
                        success: true, 
                        message: 'License 激活成功',
                        data: {
                            customer: licenseData.customer,
                            expiry: licenseData.expiry,
                            features: licenseData.features
                        }
                    }));
                    
            } catch (error) {
                return res.writeHead(400, { 'Content-Type': 'application/json' })
                    .end(JSON.stringify({ success: false, message: '激活失败：' + error.message }));
            }
        });
        return;
    }
    
    // POST /api/license/generate - 生成 License（仅内部使用）
    if (url === '/api/license/generate' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { customer, expiryDate, features } = JSON.parse(body);
                
                if (!customer || !expiryDate) {
                    return res.writeHead(400, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify({ success: false, message: '缺少必要参数' }));
                }
                
                const licenseData = generateLicense(customer, expiryDate, features || ['all']);
                
                return res.writeHead(200, { 'Content-Type': 'application/json' })
                    .end(JSON.stringify({ 
                        success: true, 
                        message: 'License 生成成功',
                        data: licenseData
                    }));
                    
            } catch (error) {
                return res.writeHead(400, { 'Content-Type': 'application/json' })
                    .end(JSON.stringify({ success: false, message: '生成失败：' + error.message }));
            }
        });
        return;
    }
    
    return res.writeHead(404, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ success: false, message: '接口不存在' }));
}

module.exports = {
    generateLicense,
    validateLicense,
    saveLicense,
    licenseMiddleware,
    licenseAPI,
    getMachineFingerprint
};
