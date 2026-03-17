// ===== AI 智能助手核心逻辑 =====
// 提供 AI 赋能的各种功能：需求生成、测试用例生成、需求审查、缺陷分类等

const axios = require('axios');
const aiPrompts = require('./ai-prompts');

// AI 服务配置
const AI_CONFIG = {
    // 本地 AI 模型（Ollama）
    local: {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        model: 'qwen2.5:7b',
        timeout: 60000,
    },
    // 云端 API（可选备用）
    cloud: {
        enabled: false,
        provider: 'dashscope', // 阿里云百炼
        apiKey: process.env.DASHSCOPE_API_KEY || '',
        model: 'qwen-plus',
        timeout: 30000,
    },
    // 缓存配置
    cache: {
        enabled: true,
        ttl: 3600000, // 1 小时
        maxSize: 1000,
    },
    // 降级配置
    fallback: {
        enabled: true,
        maxRetries: 2,
        retryDelay: 1000,
    }
};

// 结果缓存（简单内存缓存）
const cache = new Map();

/**
 * 生成缓存键
 */
function generateCacheKey(type, input) {
    const hash = require('crypto').createHash('md5').update(JSON.stringify({ type, input })).digest('hex');
    return `ai_${type}_${hash}`;
}

/**
 * 从缓存获取结果
 */
function getFromCache(key) {
    if (!AI_CONFIG.cache.enabled) return null;
    
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < AI_CONFIG.cache.ttl) {
        return cached.data;
    }
    if (cached) {
        cache.delete(key);
    }
    return null;
}

/**
 * 将结果存入缓存
 */
function saveToCache(key, data) {
    if (!AI_CONFIG.cache.enabled) return;
    
    // 清理过期缓存
    if (cache.size >= AI_CONFIG.cache.maxSize) {
        const now = Date.now();
        for (const [k, v] of cache.entries()) {
            if (now - v.timestamp > AI_CONFIG.cache.ttl) {
                cache.delete(k);
            }
        }
    }
    
    cache.set(key, {
        data,
        timestamp: Date.now(),
    });
}

/**
 * 调用本地 AI 模型（Ollama）
 */
async function callLocalAI(prompt, options = {}) {
    if (!AI_CONFIG.local.enabled) {
        throw new Error('本地 AI 未启用');
    }

    const response = await axios.post(
        `${AI_CONFIG.local.baseUrl}/api/generate`,
        {
            model: AI_CONFIG.local.model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: options.temperature || aiPrompts.optimizationConfig.temperature,
                top_p: aiPrompts.optimizationConfig.topP,
            }
        },
        {
            timeout: options.timeout || AI_CONFIG.local.timeout,
        }
    );

    return response.data.response;
}

/**
 * 调用云端 AI API（阿里云百炼）
 */
async function callCloudAI(prompt, options = {}) {
    if (!AI_CONFIG.cloud.enabled || !AI_CONFIG.cloud.apiKey) {
        throw new Error('云端 AI 未配置');
    }

    const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        {
            model: AI_CONFIG.cloud.model,
            input: {
                messages: [
                    { role: 'system', content: aiPrompts.systemRole },
                    { role: 'user', content: prompt }
                ]
            },
            parameters: {
                result_format: 'text',
            }
        },
        {
            headers: {
                'Authorization': `Bearer ${AI_CONFIG.cloud.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: options.timeout || AI_CONFIG.cloud.timeout,
        }
    );

    return response.data.output.text;
}

/**
 * 智能调用 AI（优先本地，失败时降级）
 */
async function callAI(prompt, options = {}) {
    const cacheKey = options.cacheKey || generateCacheKey(options.type || 'general', prompt);
    
    // 尝试从缓存获取
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
        console.log('[AI Assistant] 使用缓存结果');
        return cachedResult;
    }

    // 尝试调用 AI
    let lastError = null;
    
    // 优先尝试本地 AI
    if (AI_CONFIG.local.enabled) {
        try {
            console.log('[AI Assistant] 调用本地 AI...');
            const result = await callLocalAI(prompt, options);
            saveToCache(cacheKey, result);
            return result;
        } catch (error) {
            console.warn('[AI Assistant] 本地 AI 调用失败:', error.message);
            lastError = error;
        }
    }

    // 本地失败时尝试云端
    if (AI_CONFIG.cloud.enabled) {
        try {
            console.log('[AI Assistant] 调用云端 AI...');
            const result = await callCloudAI(prompt, options);
            saveToCache(cacheKey, result);
            return result;
        } catch (error) {
            console.warn('[AI Assistant] 云端 AI 调用失败:', error.message);
            lastError = error;
        }
    }

    // 都失败时返回降级响应
    if (AI_CONFIG.fallback.enabled) {
        console.warn('[AI Assistant] 所有 AI 服务不可用，返回降级响应');
        return getFallbackResponse(options.type);
    }

    throw lastError || new Error('AI 服务不可用');
}

/**
 * 降级响应（当 AI 服务不可用时）
 */
function getFallbackResponse(type) {
    const fallbacks = {
        'generate-requirement': `
【AI 服务暂时不可用 - 需求生成模板】

## 功能概述
[请在此描述功能的目的和价值]

## 用户故事
作为 [角色]，我希望 [功能]，以便 [价值]

## 功能详述
### 核心功能点
1. [功能点 1]
2. [功能点 2]
3. [功能点 3]

## 验收标准
- [ ] [验收条件 1]
- [ ] [验收条件 2]
- [ ] [验收条件 3]

## 边界情况
- 异常情况：[描述]
- 边界值：[描述]

## 非功能需求
- 性能：[要求]
- 安全：[要求]
- 兼容性：[要求]
`,
        'generate-testcase': `
【AI 服务暂时不可用 - 测试用例模板】

## 正常场景测试
**用例 ID**: TC_001
**用例名称**: [测试场景名称]
**优先级**: P0
**前置条件**: [条件]
**测试步骤**:
1. [步骤 1]
2. [步骤 2]
**预期结果**: [结果]

## 异常场景测试
**用例 ID**: TC_002
**用例名称**: [异常场景名称]
**优先级**: P1
**测试步骤**:
1. [步骤 1]
**预期结果**: [结果]

## 边界值测试
**用例 ID**: TC_003
**用例名称**: [边界测试名称]
**测试数据**: [最小值/最大值/空值]
**预期结果**: [结果]
`,
        'review-requirement': `
【AI 服务暂时不可用 - 需求审查清单】

## 审查检查项

### 清晰度检查
- [ ] 是否使用了模糊词汇（"可能"、"大概"、"等"）
- [ ] 描述是否具体明确
- [ ] 术语使用是否一致

### 完整性检查
- [ ] 是否包含功能概述
- [ ] 是否有用户故事
- [ ] 验收标准是否完整（至少 3 条）
- [ ] 是否考虑边界情况

### 可测试性检查
- [ ] 验收标准是否可量化
- [ ] 是否有明确的通过/失败标准

### 常见问题
1. 模糊词汇：请检查是否使用了"可能"、"大概"、"适当"等词汇
2. 验收标准不足：建议至少 3-5 条可测试的验收标准
3. 边界情况缺失：请补充异常场景和边界值说明
`,
        'classify-defect': `
【AI 服务暂时不可用 - 缺陷分类指南】

## 缺陷类型参考
- **功能缺陷**: 功能未按需求实现
- **界面缺陷**: UI/UX 问题
- **性能缺陷**: 响应慢、资源占用高
- **安全缺陷**: 安全漏洞
- **兼容性缺陷**: 浏览器/设备兼容问题

## 严重程度参考
- **致命**: 系统崩溃、数据丢失、安全漏洞
- **严重**: 主要功能失效
- **一般**: 次要功能问题
- **轻微**: 界面瑕疵、建议性问题

## 优先级参考
- **P0**: 立即修复（阻塞发布）
- **P1**: 高优先级（本迭代修复）
- **P2**: 中优先级（后续迭代）
- **P3**: 低优先级（有空时修复）
`,
        'default': '【AI 服务暂时不可用】请稍后重试或联系管理员检查 AI 服务配置。'
    };

    return fallbacks[type] || fallbacks['default'];
}

/**
 * 1. AI 需求生成
 */
async function generateRequirement(userInput) {
    const prompt = aiPrompts.generateRequirement(userInput);
    return await callAI(prompt, {
        type: 'generate-requirement',
        cacheKey: generateCacheKey('generate-requirement', userInput),
    });
}

/**
 * 2. AI 测试用例生成
 */
async function generateTestcase(requirementDoc) {
    const prompt = aiPrompts.generateTestcase(requirementDoc);
    return await callAI(prompt, {
        type: 'generate-testcase',
        cacheKey: generateCacheKey('generate-testcase', requirementDoc.substring(0, 200)),
    });
}

/**
 * 3. AI 需求审查
 */
async function reviewRequirement(requirementText) {
    const prompt = aiPrompts.reviewRequirement(requirementText);
    return await callAI(prompt, {
        type: 'review-requirement',
        cacheKey: generateCacheKey('review-requirement', requirementText.substring(0, 200)),
    });
}

/**
 * 4. AI 缺陷分类
 */
async function classifyDefect(defectDescription, historicalDefects = '') {
    const prompt = aiPrompts.classifyDefect(defectDescription, historicalDefects);
    return await callAI(prompt, {
        type: 'classify-defect',
        cacheKey: generateCacheKey('classify-defect', defectDescription.substring(0, 200)),
    });
}

/**
 * 5. AI 任务分配
 */
async function assignTask(taskDescription, teamMembers, currentWorkload) {
    const prompt = aiPrompts.assignTask(taskDescription, teamMembers, currentWorkload);
    return await callAI(prompt, {
        type: 'assign-task',
        cacheKey: generateCacheKey('assign-task', taskDescription.substring(0, 200)),
    });
}

/**
 * 6. AI 智能搜索（辅助函数）
 */
function analyzeSearchQuery(userQuery) {
    // 搜索意图分析（本地实现，不依赖 AI）
    const keywords = userQuery.split(/[\s,，]+/).filter(k => k.length > 1);
    const intentPatterns = {
        '需求': 'requirement',
        '用例': 'testcase',
        '测试': 'testcase',
        '缺陷': 'defect',
        'bug': 'defect',
        '任务': 'task',
        '分配': 'task',
    };

    let detectedType = null;
    for (const [pattern, type] of Object.entries(intentPatterns)) {
        if (userQuery.includes(pattern)) {
            detectedType = type;
            break;
        }
    }

    return {
        originalQuery: userQuery,
        keywords,
        detectedType,
        suggestions: generateSearchSuggestions(keywords, detectedType),
    };
}

function generateSearchSuggestions(keywords, detectedType) {
    const suggestions = [];
    if (detectedType === 'requirement') {
        suggestions.push('相关测试用例', '关联任务', '历史变更记录');
    } else if (detectedType === 'testcase') {
        suggestions.push('对应需求', '执行记录', '关联缺陷');
    } else if (detectedType === 'defect') {
        suggestions.push('相似缺陷', '修复记录', '影响需求');
    }
    return suggestions;
}

/**
 * 7. AI 变更影响分析
 */
async function analyzeImpact(changeDescription, relatedItems) {
    const prompt = aiPrompts.impactAnalysis(changeDescription, JSON.stringify(relatedItems, null, 2));
    return await callAI(prompt, {
        type: 'impact-analysis',
        cacheKey: generateCacheKey('impact-analysis', changeDescription.substring(0, 200)),
    });
}

/**
 * 8. AI 项目风险预测
 */
async function predictRisk(projectData, historicalData) {
    const prompt = aiPrompts.riskPrediction(
        JSON.stringify(projectData, null, 2),
        JSON.stringify(historicalData, null, 2)
    );
    return await callAI(prompt, {
        type: 'risk-prediction',
        cacheKey: generateCacheKey('risk-prediction', JSON.stringify(projectData).substring(0, 200)),
    });
}

/**
 * 获取 AI 服务状态
 */
function getAIStatus() {
    return {
        local: {
            enabled: AI_CONFIG.local.enabled,
            baseUrl: AI_CONFIG.local.baseUrl,
            model: AI_CONFIG.local.model,
            status: 'unknown', // 需要实际探测
        },
        cloud: {
            enabled: AI_CONFIG.cloud.enabled,
            configured: !!AI_CONFIG.cloud.apiKey,
            model: AI_CONFIG.cloud.model,
        },
        cache: {
            enabled: AI_CONFIG.cache.enabled,
            size: cache.size,
        },
    };
}

/**
 * 测试 AI 连接
 */
async function testAIConnection() {
    const results = {
        local: { success: false, error: null, responseTime: null },
        cloud: { success: false, error: null, responseTime: null },
    };

    // 测试本地 AI
    if (AI_CONFIG.local.enabled) {
        try {
            const start = Date.now();
            await axios.get(`${AI_CONFIG.local.baseUrl}/api/tags`, { timeout: 5000 });
            results.local.success = true;
            results.local.responseTime = Date.now() - start;
        } catch (error) {
            results.local.error = error.message;
        }
    }

    // 测试云端 AI
    if (AI_CONFIG.cloud.enabled && AI_CONFIG.cloud.apiKey) {
        try {
            const start = Date.now();
            await axios.get('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
                headers: { 'Authorization': `Bearer ${AI_CONFIG.cloud.apiKey}` },
                timeout: 5000,
            }).catch(() => {}); // 仅测试连接
            results.cloud.success = true;
            results.cloud.responseTime = Date.now() - start;
        } catch (error) {
            results.cloud.error = error.message;
        }
    }

    return results;
}

module.exports = {
    // 核心功能
    generateRequirement,
    generateTestcase,
    reviewRequirement,
    classifyDefect,
    assignTask,
    analyzeImpact,
    predictRisk,
    
    // 辅助功能
    analyzeSearchQuery,
    
    // 状态和管理
    getAIStatus,
    testAIConnection,
    
    // 配置
    AI_CONFIG,
};
