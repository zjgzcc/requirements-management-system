// ===== 基础设施模块 - 增强文件上传服务 =====
// 支持断点续传、进度显示、文件验证

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const formidable = require('formidable');
const { 
    validateFileSize, 
    validateFileType, 
    createSuccessResponse, 
    createErrorResponse,
    ERROR_CODES,
    logError 
} = require('./middleware');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CHUNKS_DIR = path.join(UPLOADS_DIR, '.chunks');
const UPLOADS_FILE = path.join(__dirname, 'uploads.json');

// 确保目录存在
[UPLOADS_DIR, CHUNKS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 初始化上传记录文件
if (!fs.existsSync(UPLOADS_FILE)) {
    fs.writeFileSync(UPLOADS_FILE, JSON.stringify([], null, 2));
}

// 生成唯一 ID
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 计算文件 MD5
function calculateFileMD5(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// 获取上传记录
function getUploadRecords() {
    try {
        return JSON.parse(fs.readFileSync(UPLOADS_FILE, 'utf-8'));
    } catch (error) {
        return [];
    }
}

// 保存上传记录
function saveUploadRecord(record) {
    const records = getUploadRecords();
    records.push(record);
    fs.writeFileSync(UPLOADS_FILE, JSON.stringify(records, null, 2));
}

// 标准文件上传（简单上传）
async function handleSimpleUpload(req, res) {
    const form = new formidable.IncomingForm();
    form.uploadDir = UPLOADS_DIR;
    form.keepExtensions = true;
    form.maxFileSize = 50 * 1024 * 1024; // 50MB
    form.multiples = true;

    return new Promise((resolve, reject) => {
        form.parse(req, async (err, fields, files) => {
            if (err) {
                logError(err, { type: 'formidable_parse' });
                reject(new Error('上传失败：' + err.message));
                return;
            }

            try {
                const uploadedFiles = [];
                
                // 处理多个文件
                const fileArrays = Object.values(files);
                for (const fileArray of fileArrays) {
                    const fileList = Array.isArray(fileArray) ? fileArray : [fileArray];
                    
                    for (const file of fileList) {
                        // 验证文件大小
                        validateFileSize(file, 50);
                        
                        // 可选：验证文件类型
                        // validateFileType(file, ['image/*', 'video/*', 'application/pdf', 'application/msword']);
                        
                        const ext = path.extname(file.originalFilename);
                        const fileName = `${Date.now()}_${generateUniqueId()}${ext}`;
                        const newPath = path.join(UPLOADS_DIR, fileName);
                        
                        // 移动文件
                        fs.renameSync(file.filepath, newPath);
                        
                        // 计算文件 MD5
                        const md5 = await calculateFileMD5(newPath);
                        
                        const fileRecord = {
                            id: generateUniqueId(),
                            originalName: file.originalFilename,
                            fileName: fileName,
                            mimeType: file.mimetype || 'application/octet-stream',
                            size: file.size,
                            md5: md5,
                            url: `/uploads/${fileName}`,
                            uploadedAt: new Date().toISOString()
                        };
                        
                        // 保存记录
                        saveUploadRecord(fileRecord);
                        uploadedFiles.push(fileRecord);
                    }
                }

                resolve(createSuccessResponse(uploadedFiles, '文件上传成功'));
            } catch (error) {
                logError(error, { type: 'simple_upload' });
                reject(error);
            }
        });
    });
}

// 分片上传 - 初始化
async function initChunkedUpload(req, res) {
    const body = await parseBody(req);
    const { fileName, fileSize, mimeType, md5, totalChunks } = body;

    if (!fileName || !fileSize || !totalChunks) {
        throw new Error('参数不完整');
    }

    const uploadId = generateUniqueId();
    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    
    if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
    }

    // 保存上传会话信息
    const uploadSession = {
        uploadId,
        fileName,
        fileSize,
        mimeType: mimeType || 'application/octet-stream',
        md5,
        totalChunks,
        uploadedChunks: [],
        createdAt: new Date().toISOString(),
        status: 'uploading'
    };

    // 保存会话到临时文件
    fs.writeFileSync(
        path.join(chunkDir, 'session.json'),
        JSON.stringify(uploadSession, null, 2)
    );

    return createSuccessResponse({
        uploadId,
        chunkDir: `/api/upload/chunks/${uploadId}`,
        totalChunks
    }, '分片上传初始化成功');
}

// 分片上传 - 上传分片
async function uploadChunk(req, res, uploadId, chunkIndex) {
    const form = new formidable.IncomingForm();
    form.uploadDir = CHUNKS_DIR;
    form.keepExtensions = false;

    return new Promise((resolve, reject) => {
        form.parse(req, async (err, fields, files) => {
            if (err) {
                reject(new Error('分片上传失败：' + err.message));
                return;
            }

            try {
                const chunkDir = path.join(CHUNKS_DIR, uploadId);
                const sessionFile = path.join(chunkDir, 'session.json');
                
                if (!fs.existsSync(sessionFile)) {
                    throw new Error('上传会话不存在');
                }

                const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
                const file = Array.isArray(files.chunk) ? files.chunk[0] : files.chunk;
                
                if (!file) {
                    throw new Error('未找到分片文件');
                }

                // 移动分片到正确位置
                const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
                fs.renameSync(file.filepath, chunkPath);

                // 更新会话
                if (!session.uploadedChunks.includes(chunkIndex)) {
                    session.uploadedChunks.push(chunkIndex);
                    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
                }

                // 计算上传进度
                const progress = Math.round((session.uploadedChunks.length / session.totalChunks) * 100);

                resolve(createSuccessResponse({
                    uploadId,
                    chunkIndex,
                    uploadedChunks: session.uploadedChunks.length,
                    totalChunks: session.totalChunks,
                    progress
                }, `分片 ${chunkIndex} 上传成功`));
            } catch (error) {
                reject(error);
            }
        });
    });
}

// 分片上传 - 合并分片
async function mergeChunks(req, res, uploadId) {
    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    const sessionFile = path.join(chunkDir, 'session.json');

    if (!fs.existsSync(sessionFile)) {
        throw new Error('上传会话不存在');
    }

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));

    // 检查所有分片是否已上传
    if (session.uploadedChunks.length !== session.totalChunks) {
        const missing = [];
        for (let i = 0; i < session.totalChunks; i++) {
            if (!session.uploadedChunks.includes(i)) {
                missing.push(i);
            }
        }
        throw new Error(`还有 ${missing.length} 个分片未上传`);
    }

    // 合并分片
    const ext = path.extname(session.fileName);
    const fileName = `${Date.now()}_${generateUniqueId()}${ext}`;
    const finalPath = path.join(UPLOADS_DIR, fileName);
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk_${i}`);
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
    }

    writeStream.end();

    // 等待写入完成
    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    // 计算最终文件的 MD5
    const md5 = await calculateFileMD5(finalPath);

    // 创建文件记录
    const fileRecord = {
        id: generateUniqueId(),
        originalName: session.fileName,
        fileName: fileName,
        mimeType: session.mimeType,
        size: session.fileSize,
        md5: md5,
        url: `/uploads/${fileName}`,
        uploadedAt: new Date().toISOString(),
        uploadId,
        chunkedUpload: true
    };

    // 保存记录
    saveUploadRecord(fileRecord);

    // 清理临时分片
    fs.rmSync(chunkDir, { recursive: true, force: true });

    return createSuccessResponse(fileRecord, '文件合并成功');
}

// 查询上传进度
async function getUploadProgress(req, res, uploadId) {
    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    const sessionFile = path.join(chunkDir, 'session.json');

    if (!fs.existsSync(sessionFile)) {
        throw new Error('上传会话不存在');
    }

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    const progress = Math.round((session.uploadedChunks.length / session.totalChunks) * 100);

    return createSuccessResponse({
        uploadId,
        fileName: session.fileName,
        totalChunks: session.totalChunks,
        uploadedChunks: session.uploadedChunks.length,
        progress,
        status: session.uploadedChunks.length === session.totalChunks ? 'completed' : 'uploading'
    });
}

// 辅助函数：解析请求体
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

// 获取所有上传记录
function getAllUploadRecords() {
    return getUploadRecords();
}

// 删除上传文件
function deleteUploadFile(fileId) {
    const records = getUploadRecords();
    const fileIndex = records.findIndex(r => r.id === fileId);
    
    if (fileIndex === -1) {
        throw new Error('文件记录不存在');
    }

    const fileRecord = records[fileIndex];
    const filePath = path.join(UPLOADS_DIR, fileRecord.fileName);
    
    // 删除物理文件
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    // 删除记录
    records.splice(fileIndex, 1);
    fs.writeFileSync(UPLOADS_FILE, JSON.stringify(records, null, 2));
    
    return createSuccessResponse({ fileId }, '文件已删除');
}

module.exports = {
    handleSimpleUpload,
    initChunkedUpload,
    uploadChunk,
    mergeChunks,
    getUploadProgress,
    getAllUploadRecords,
    deleteUploadFile,
    UPLOADS_DIR
};
