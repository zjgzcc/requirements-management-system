/**
 * License 验证管理器
 * 用于商用授权管理，支持硬件绑定和试用模式
 * 
 * 功能：
 * 1. License 信息结构（companyName, authorizedUsers, expirationDate, features, hardwareId）
 * 2. 硬件 ID 生成（MAC 地址 + hostname + platform 的 SHA256）
 * 3. License 验证逻辑（有效性检查、硬件匹配、过期检查）
 * 4. 试用模式支持（未激活时可用 14 天）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const LICENSE_FILE = path.join(__dirname, 'license.json');
const TRIAL_START_FILE = path.join(__dirname, '.trial-start');
const TRIAL_DAYS = 14;

// 安全密钥（生产环境应使用环境变量）
const LICENSE_SECRET_KEY = process.env.LICENSE_SECRET_KEY || 'LICENSE_SECRET_KEY_CHANGE_IN_PRODUCTION';

/**
 * 获取网络接口信息
 */
function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const macAddresses = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 跳过内部接口和无效的 MAC 地址
            if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                macAddresses.push(iface.mac.toLowerCase());
            }
        }
    }
    
    // 排序以确保一致性
    return macAddresses.sort().join(':');
}

/**
 * 生成硬件 ID（MAC 地址 + hostname + platform 的 SHA256）
 * @returns {string} 硬件 ID 哈希值
 */
function getHardwareId() {
    const mac = getNetworkInterfaces();
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    
    // 组合硬件信息
    const hardwareInfo = `${mac}|${hostname}|${platform}|${arch}`;
    
    // 生成 SHA256 哈希
    return crypto
        .createHash('sha256')
        .update(hardwareInfo)
        .digest('hex');
}

/**
 * 生成 License Key
 * @param {object} options - License 选项
 * @param {string} options.companyName - 公司名称
 * @param {number} options.authorizedUsers - 授权用户数
 * @param {string} options.expirationDate - 过期日期 (YYYY-MM-DD)
 * @param {string[]} options.features - 功能列表
 * @param {string} [options.hardwareId] - 硬件 ID（可选，默认使用当前机器）
 * @returns {object} License 对象
 */
function generateLicense(options) {
    const {
        companyName,
        authorizedUsers,
        expirationDate,
        features = ['all'],
        hardwareId
    } = options;
    
    const hwId = hardwareId || getHardwareId();
    const issuedAt = new Date().toISOString();
    
    // 构建 License 数据
    const licenseData = {
        licenseKey: '',
        companyName: companyName || '',
        authorizedUsers: authorizedUsers || 0,
        expirationDate: expirationDate || '',
        features: features,
        hardwareId: hwId,
        issuedAt: issuedAt,
        status: 'active'
    };
    
    // 生成签名数据
    const dataToSign = JSON.stringify({
        companyName: licenseData.companyName,
        authorizedUsers: licenseData.authorizedUsers,
        expirationDate: licenseData.expirationDate,
        features: licenseData.features,
        hardwareId: licenseData.hardwareId,
        issuedAt: licenseData.issuedAt
    });
    
    // 生成 HMAC 签名
    licenseData.licenseKey = crypto
        .createHmac('sha256', LICENSE_SECRET_KEY)
        .update(dataToSign)
        .digest('hex');
    
    return licenseData;
}

/**
 * 验证 License 数据
 * @param {object} licenseData - License 数据
 * @returns {object} 验证结果
 */
function verifyLicenseData(licenseData) {
    // 验证签名
    const dataToSign = JSON.stringify({
        companyName: licenseData.companyName,
        authorizedUsers: licenseData.authorizedUsers,
        expirationDate: licenseData.expirationDate,
        features: licenseData.features,
        hardwareId: licenseData.hardwareId,
        issuedAt: licenseData.issuedAt
    });
    
    const expectedKey = crypto
        .createHmac('sha256', LICENSE_SECRET_KEY)
        .update(dataToSign)
        .digest('hex');
    
    if (licenseData.licenseKey !== expectedKey) {
        return {
            valid: false,
            reason: 'signature_invalid',
            message: 'License 签名验证失败，License 可能已被篡改'
        };
    }
    
    // 验证硬件匹配
    const currentHardwareId = getHardwareId();
    if (licenseData.hardwareId !== currentHardwareId) {
        return {
            valid: false,
            reason: 'hardware_mismatch',
            message: 'License 与当前机器硬件不匹配',
            currentHardwareId,
            licensedHardwareId: licenseData.hardwareId
        };
    }
    
    // 验证过期时间
    const expirationDate = new Date(licenseData.expirationDate);
    const now = new Date();
    
    if (expirationDate < now) {
        return {
            valid: false,
            reason: 'expired',
            message: 'License 已过期',
            expirationDate: licenseData.expirationDate,
            expiredDays: Math.ceil((now - expirationDate) / (1000 * 60 * 60 * 24))
        };
    }
    
    // 验证状态
    if (licenseData.status !== 'active') {
        return {
            valid: false,
            reason: 'inactive',
            message: 'License 已被禁用'
        };
    }
    
    // 计算剩余天数
    const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
    
    return {
        valid: true,
        reason: 'valid',
        message: 'License 验证通过',
        daysLeft,
        expirationDate: licenseData.expirationDate
    };
}

/**
 * 检查试用模式状态
 * @returns {object} 试用状态
 */
function checkTrialStatus() {
    try {
        // 检查试用开始时间记录
        if (!fs.existsSync(TRIAL_START_FILE)) {
            // 首次使用，记录开始时间
            const now = Date.now();
            fs.writeFileSync(TRIAL_START_FILE, now.toString(), 'utf-8');
            return {
                isTrial: true,
                trialStarted: true,
                daysLeft: TRIAL_DAYS,
                expirationDate: new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            };
        }
        
        const trialStart = parseInt(fs.readFileSync(TRIAL_START_FILE, 'utf-8'), 10);
        const now = Date.now();
        const trialEnd = trialStart + TRIAL_DAYS * 24 * 60 * 60 * 1000;
        
        if (now > trialEnd) {
            return {
                isTrial: true,
                trialStarted: true,
                expired: true,
                daysLeft: 0,
                expirationDate: new Date(trialEnd).toISOString().split('T')[0]
            };
        }
        
        const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
        
        return {
            isTrial: true,
            trialStarted: true,
            expired: false,
            daysLeft,
            expirationDate: new Date(trialEnd).toISOString().split('T')[0]
        };
        
    } catch (error) {
        console.error('检查试用状态失败:', error);
        return {
            isTrial: true,
            trialStarted: false,
            error: error.message
        };
    }
}

/**
 * 验证 License（主函数）
 * @returns {object} 验证结果
 */
function validateLicense() {
    try {
        // 检查 License 文件是否存在
        if (!fs.existsSync(LICENSE_FILE)) {
            const trialStatus = checkTrialStatus();
            
            if (trialStatus.expired) {
                return {
                    valid: false,
                    mode: 'trial_expired',
                    message: '试用期限已过，请购买正式 License',
                    trialExpired: true,
                    expirationDate: trialStatus.expirationDate
                };
            }
            
            return {
                valid: false,
                mode: 'trial',
                message: '试用模式',
                isTrial: true,
                daysLeft: trialStatus.daysLeft,
                expirationDate: trialStatus.expirationDate,
                features: ['basic']
            };
        }
        
        // 读取 License 文件
        const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
        
        // 验证 License 数据
        const verifyResult = verifyLicenseData(licenseData);
        
        if (!verifyResult.valid) {
            // License 无效，降级到试用模式
            const trialStatus = checkTrialStatus();
            
            return {
                valid: false,
                mode: trialStatus.expired ? 'trial_expired' : 'trial',
                message: verifyResult.message,
                reason: verifyResult.reason,
                isTrial: !trialStatus.expired,
                daysLeft: trialStatus.daysLeft,
                expirationDate: trialStatus.expirationDate,
                features: trialStatus.expired ? [] : ['basic']
            };
        }
        
        // License 验证通过
        return {
            valid: true,
            mode: 'licensed',
            message: 'License 验证通过',
            companyName: licenseData.companyName,
            authorizedUsers: licenseData.authorizedUsers,
            expirationDate: licenseData.expirationDate,
            features: licenseData.features,
            hardwareId: licenseData.hardwareId,
            daysLeft: verifyResult.daysLeft,
            issuedAt: licenseData.issuedAt
        };
        
    } catch (error) {
        console.error('License 验证错误:', error);
        return {
            valid: false,
            mode: 'error',
            message: 'License 验证出错：' + error.message,
            error: error.message
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
 * 激活 License
 * @param {string} licenseKey - License 密钥
 * @param {string} companyName - 公司名称
 * @returns {object} 激活结果
 */
function activateLicense(licenseKey, companyName) {
    try {
        // 在实际应用中，这里应该验证 licenseKey 的有效性
        // 可能包括：
        // 1. 检查 licenseKey 格式
        // 2. 验证签名
        // 3. 检查是否已被吊销
        // 4. 从服务器验证（如果在线）
        
        // 简化版本：假设 licenseKey 是有效的
        // 实际应用中应该实现更复杂的验证逻辑
        
        // 生成新的 License
        const licenseData = generateLicense({
            companyName: companyName || '未命名公司',
            authorizedUsers: 999,
            expirationDate: '2099-12-31',
            features: ['all']
        });
        
        // 保存 License
        saveLicense(licenseData);
        
        return {
            success: true,
            message: 'License 激活成功',
            data: {
                companyName: licenseData.companyName,
                authorizedUsers: licenseData.authorizedUsers,
                expirationDate: licenseData.expirationDate,
                features: licenseData.features,
                daysLeft: 99999
            }
        };
        
    } catch (error) {
        return {
            success: false,
            message: '激活失败：' + error.message
        };
    }
}

/**
 * 重置试用（仅用于开发测试）
 */
function resetTrial() {
    if (fs.existsSync(TRIAL_START_FILE)) {
        fs.unlinkSync(TRIAL_START_FILE);
    }
}

/**
 * 删除 License（用于测试）
 */
function deleteLicense() {
    if (fs.existsSync(LICENSE_FILE)) {
        fs.unlinkSync(LICENSE_FILE);
    }
}

/**
 * License 验证中间件
 */
function licenseMiddleware(req, res, next) {
    // 跳过 License 验证的接口
    const skipPaths = [
        '/api/license/validate',
        '/api/license/activate',
        '/api/license/generate',
        '/api/license/reset-trial',
        '/api/health',
        '/api/system/stats',
        '/api/auth/login',
        '/api/auth/logout'
    ];
    
    if (skipPaths.some(p => req.url.startsWith(p))) {
        return next();
    }
    
    const licenseStatus = validateLicense();
    
    // 将 License 状态添加到响应头
    res.setHeader('X-License-Mode', licenseStatus.mode);
    res.setHeader('X-License-Valid', licenseStatus.valid);
    
    // 如果是试用模式或过期，添加警告头
    if (licenseStatus.mode === 'trial' || licenseStatus.mode === 'trial_expired') {
        res.setHeader('X-License-Message', encodeURIComponent(licenseStatus.message));
    }
    
    next();
}

/**
 * License API 处理器
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
                const { licenseKey, companyName } = JSON.parse(body);
                
                if (!companyName) {
                    return res.writeHead(400, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify({ success: false, message: '公司名称不能为空' }));
                }
                
                const result = activateLicense(licenseKey || '', companyName);
                
                if (result.success) {
                    return res.writeHead(200, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify(result));
                } else {
                    return res.writeHead(400, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify(result));
                }
                
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
                const { companyName, authorizedUsers, expirationDate, features } = JSON.parse(body);
                
                if (!companyName || !expirationDate) {
                    return res.writeHead(400, { 'Content-Type': 'application/json' })
                        .end(JSON.stringify({ success: false, message: '缺少必要参数' }));
                }
                
                const licenseData = generateLicense({
                    companyName,
                    authorizedUsers: authorizedUsers || 0,
                    expirationDate,
                    features: features || ['all']
                });
                
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
    
    // POST /api/license/reset-trial - 重置试用（仅开发测试）
    if (url === '/api/license/reset-trial' && method === 'POST') {
        try {
            resetTrial();
            deleteLicense();
            return res.writeHead(200, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ success: true, message: '试用已重置' }));
        } catch (error) {
            return res.writeHead(500, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ success: false, message: '重置失败：' + error.message }));
        }
    }
    
    // DELETE /api/license - 删除 License（仅开发测试）
    if (url === '/api/license' && method === 'DELETE') {
        try {
            deleteLicense();
            return res.writeHead(200, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ success: true, message: 'License 已删除' }));
        } catch (error) {
            return res.writeHead(500, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ success: false, message: '删除失败：' + error.message }));
        }
    }
    
    return res.writeHead(404, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ success: false, message: '接口不存在' }));
}

module.exports = {
    generateLicense,
    validateLicense,
    verifyLicenseData,
    saveLicense,
    activateLicense,
    licenseMiddleware,
    licenseAPI,
    getHardwareId,
    checkTrialStatus,
    resetTrial,
    deleteLicense
};
