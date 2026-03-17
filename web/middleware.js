// ===== 基础设施模块 - 全局错误处理中间件 =====
// 提供统一的错误处理、日志记录和性能监控

const fs = require('fs');
const path = require('path');

// 错误码定义（遵循 MODULE-INTERFACES.md 规范）
const ERROR_CODES = {
    // 1xxx - 用户认证
    UNAUTHORIZED: 1001,
    FORBIDDEN: 1002,
    INVALID_CREDENTIALS: 1003,
    
    // 2xxx - 项目
    PROJECT_NOT_FOUND: 2001,
    PROJECT_CREATE_FAILED: 2002,
    
    // 3xxx - 需求
    REQUIREMENT_NOT_FOUND: 3001,
    REQUIREMENT_CREATE_FAILED: 3002,
    
    // 4xxx - 用例
    TESTCASE_NOT_FOUND: 4001,
    TESTCASE_CREATE_FAILED: 4002,
    
    // 5xxx - 文件
    FILE_TOO_LARGE: 5001,
    INVALID_FILE_TYPE: 5002,
    FILE_UPLOAD_FAILED: 5003,
    FILE_NOT_FOUND: 5004,
    
    // 6xxx - 基线
    BASELINE_NOT_FOUND: 6001,
    BASELINE_CREATE_FAILED: 6002,
    
    // 7xxx - 标题层级
    HEADER_NOT_FOUND: 7001,
    HEADER_CREATE_FAILED: 7002,
    
    // 8xxx - 追踪
    TRACE_NOT_FOUND: 8001,
    TRACE_CREATE_FAILED: 8002,
    
    // 9xxx - 系统
    INTERNAL_ERROR: 9000,
    INVALID_REQUEST: 9001,
    DATABASE_ERROR: 9002,
    VALIDATION_ERROR: 9003,
    
    // 10xxx - AI 服务
    AI_SERVICE_ERROR: 10001,
    AI_TIMEOUT: 10002,
    AI_MODEL_ERROR: 10003,
    
    // 11xxx - 搜索
    SEARCH_ERROR: 11001,
};

// 日志文件路径
const LOG_DIR = path.join(__dirname, 'logs');
const REQUEST_LOG_FILE = path.join(LOG_DIR, 'requests.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'errors.log');
const PERFORMANCE_LOG_FILE = path.join(LOG_DIR, 'performance.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 性能监控配置
const PERFORMANCE_CONFIG = {
    slowQueryThreshold: 1000, // 慢查询阈值（毫秒）
    enableLogging: true,
    enablePerformanceMonitoring: true
};

// 请求日志记录
function logRequest(method, url, statusCode, duration, userId = 'anonymous') {
    if (!PERFORMANCE_CONFIG.enableLogging) return;
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        method,
        url,
        statusCode,
        durationMs: duration,
        userId,
        slow: duration > PERFORMANCE_CONFIG.slowQueryThreshold
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(REQUEST_LOG_FILE, logLine);
    
    // 慢查询告警
    if (logEntry.slow) {
        console.warn(`⚠️  慢查询告警：${method} ${url} - ${duration}ms`);
        fs.appendFileSync(PERFORMANCE_LOG_FILE, JSON.stringify({
            type: 'SLOW_QUERY',
            ...logEntry
        }) + '\n');
    }
}

// 错误日志记录
function logError(error, context = {}) {
    if (!PERFORMANCE_CONFIG.enableLogging) return;
    
    const errorEntry = {
        timestamp: new Date().toISOString(),
        name: error.name,
        message: error.message,
        stack: error.stack,
        context,
        errorCode: error.errorCode || ERROR_CODES.INTERNAL_ERROR
    };
    
    const logLine = JSON.stringify(errorEntry) + '\n';
    fs.appendFileSync(ERROR_LOG_FILE, logLine);
    
    console.error(`❌ 错误：${error.message}`, context);
}

// 性能监控开始
function startPerformanceMonitor() {
    if (!PERFORMANCE_CONFIG.enablePerformanceMonitoring) return null;
    return {
        startTime: Date.now(),
        marks: []
    };
}

// 性能监控标记点
function markPerformance(monitor, label) {
    if (!monitor) return;
    monitor.marks.push({
        label,
        time: Date.now() - monitor.startTime
    });
}

// 性能监控结束并记录
function endPerformanceMonitor(monitor, operation, details = {}) {
    if (!monitor) return;
    
    const duration = Date.now() - monitor.startTime;
    const perfEntry = {
        timestamp: new Date().toISOString(),
        operation,
        durationMs: duration,
        marks: monitor.marks,
        details,
        slow: duration > PERFORMANCE_CONFIG.slowQueryThreshold
    };
    
    fs.appendFileSync(PERFORMANCE_LOG_FILE, JSON.stringify(perfEntry) + '\n');
    
    if (perfEntry.slow) {
        console.warn(`⚠️  性能告警：${operation} - ${duration}ms`);
    }
    
    return duration;
}

// 统一错误响应格式
function createErrorResponse(message, errorCode = ERROR_CODES.INTERNAL_ERROR, details = {}) {
    return {
        success: false,
        message,
        errorCode,
        timestamp: new Date().toISOString(),
        ...details
    };
}

// 统一成功响应格式
function createSuccessResponse(data, message = '操作成功') {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    };
}

// 全局错误处理中间件
function errorHandler(error, req, res, context = {}) {
    console.error('全局错误处理:', error);
    
    // 记录错误日志
    logError(error, {
        url: req.url,
        method: req.method,
        ...context
    });
    
    // 确定 HTTP 状态码
    let statusCode = 500;
    let errorMessage = '服务器内部错误';
    let errorCode = ERROR_CODES.INTERNAL_ERROR;
    
    if (error.statusCode) {
        statusCode = error.statusCode;
        errorMessage = error.message;
    } else if (error.code === 'ENOENT') {
        statusCode = 404;
        errorMessage = '资源不存在';
        errorCode = ERROR_CODES.FILE_NOT_FOUND;
    } else if (error.message.includes('Invalid JSON')) {
        statusCode = 400;
        errorMessage = '请求格式错误';
        errorCode = ERROR_CODES.INVALID_REQUEST;
    }
    
    // 返回统一错误响应
    const errorResponse = createErrorResponse(errorMessage, errorCode, {
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    if (res && !res.headersSent) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(errorResponse, null, 2));
    }
    
    return errorResponse;
}

// 请求验证中间件
function validateRequest(requiredFields = []) {
    return (body) => {
        const missing = requiredFields.filter(field => !body[field]);
        if (missing.length > 0) {
            const error = new Error(`缺少必填字段：${missing.join(', ')}`);
            error.statusCode = 400;
            error.errorCode = ERROR_CODES.VALIDATION_ERROR;
            throw error;
        }
    };
}

// 文件大小验证
function validateFileSize(file, maxSizeMB = 50) {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
        const error = new Error(`文件大小超过限制（最大 ${maxSizeMB}MB）`);
        error.statusCode = 400;
        error.errorCode = ERROR_CODES.FILE_TOO_LARGE;
        throw error;
    }
}

// 文件类型验证
function validateFileType(file, allowedTypes = []) {
    if (allowedTypes.length === 0) return;
    
    const mimeType = file.mimetype || '';
    const isValid = allowedTypes.some(type => {
        if (type.includes('*')) {
            const prefix = type.replace('*', '');
            return mimeType.startsWith(prefix);
        }
        return mimeType === type;
    });
    
    if (!isValid) {
        const error = new Error(`不支持的文件类型：${mimeType}`);
        error.statusCode = 400;
        error.errorCode = ERROR_CODES.INVALID_FILE_TYPE;
        throw error;
    }
}

// 获取日志统计信息
function getLogStats() {
    const stats = {
        requests: { total: 0, slow: 0, errors: 0 },
        errors: { total: 0 },
        performance: { avgDuration: 0, slowQueries: 0 }
    };
    
    try {
        // 请求日志统计
        if (fs.existsSync(REQUEST_LOG_FILE)) {
            const requestLogs = fs.readFileSync(REQUEST_LOG_FILE, 'utf-8')
                .trim().split('\n').filter(line => line);
            
            stats.requests.total = requestLogs.length;
            stats.requests.slow = requestLogs.filter(line => {
                const entry = JSON.parse(line);
                return entry.slow;
            }).length;
            
            stats.requests.errors = requestLogs.filter(line => {
                const entry = JSON.parse(line);
                return entry.statusCode >= 400;
            }).length;
        }
        
        // 错误日志统计
        if (fs.existsSync(ERROR_LOG_FILE)) {
            const errorLogs = fs.readFileSync(ERROR_LOG_FILE, 'utf-8')
                .trim().split('\n').filter(line => line);
            stats.errors.total = errorLogs.length;
        }
        
        // 性能日志统计
        if (fs.existsSync(PERFORMANCE_LOG_FILE)) {
            const perfLogs = fs.readFileSync(PERFORMANCE_LOG_FILE, 'utf-8')
                .trim().split('\n').filter(line => line);
            
            stats.performance.slowQueries = perfLogs.filter(line => {
                const entry = JSON.parse(line);
                return entry.slow || entry.type === 'SLOW_QUERY';
            }).length;
            
            const durations = perfLogs
                .map(line => JSON.parse(line).durationMs)
                .filter(d => d);
            
            if (durations.length > 0) {
                stats.performance.avgDuration = Math.round(
                    durations.reduce((a, b) => a + b, 0) / durations.length
                );
            }
        }
    } catch (error) {
        console.error('读取日志统计失败:', error);
    }
    
    return stats;
}

// 清理旧日志（保留最近 7 天）
function cleanupOldLogs(daysToKeep = 7) {
    const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const logFiles = [REQUEST_LOG_FILE, ERROR_LOG_FILE, PERFORMANCE_LOG_FILE];
    
    logFiles.forEach(logFile => {
        if (!fs.existsSync(logFile)) return;
        
        const lines = fs.readFileSync(logFile, 'utf-8')
            .trim().split('\n')
            .filter(line => {
                if (!line) return false;
                try {
                    const entry = JSON.parse(line);
                    const entryDate = new Date(entry.timestamp).getTime();
                    return entryDate > cutoffDate;
                } catch {
                    return true; // 保留无法解析的行
                }
            });
        
        fs.writeFileSync(logFile, lines.join('\n') + '\n');
    });
}

module.exports = {
    ERROR_CODES,
    PERFORMANCE_CONFIG,
    logRequest,
    logError,
    startPerformanceMonitor,
    markPerformance,
    endPerformanceMonitor,
    createErrorResponse,
    createSuccessResponse,
    errorHandler,
    validateRequest,
    validateFileSize,
    validateFileType,
    getLogStats,
    cleanupOldLogs
};
