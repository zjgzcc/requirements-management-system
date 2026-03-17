// 测试用例管理模块 API
const API_BASE = 'http://localhost:8001/api';

async function testAPI() {
    console.log('===== 开始测试用例管理模块 API =====\n');
    
    // 1. 获取项目列表
    console.log('1. 获取项目列表...');
    const projectsRes = await fetch(`${API_BASE}/projects`);
    const projects = await projectsRes.json();
    console.log('项目:', projects.data.map(p => p.name).join(', '));
    const projectId = projects.data[0]?.id;
    if (!projectId) {
        console.log('❌ 没有可用项目，测试终止');
        return;
    }
    console.log('✓ 使用项目:', projectId, '\n');
    
    // 2. 创建测试用例（带新字段）
    console.log('2. 创建测试用例（带新字段）...');
    const createRes = await fetch(`${API_BASE}/testcases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectId,
            prefix: 'TEST',
            title: '登录功能测试',
            type: '功能测试',
            status: 'not_executed',
            priority: 'high',
            assignee: '张三',
            richContent: '<p>1. 打开登录页面</p><p>2. 输入用户名和密码</p><p>3. 点击登录</p>',
            expectedResult: '成功登录'
        })
    });
    const createData = await createRes.json();
    console.log('创建结果:', createData.success ? '✓ 成功' : '❌ 失败', createData.message);
    const testcaseId = createData.data?.id;
    if (!testcaseId) {
        console.log('❌ 创建失败，测试终止');
        return;
    }
    console.log('用例 ID:', testcaseId, '\n');
    
    // 3. 执行用例
    console.log('3. 执行用例...');
    const executeRes = await fetch(`${API_BASE}/testcases/${testcaseId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: 'pass',
            result: '所有步骤执行成功，功能正常',
            executedBy: '测试员',
            duration: 15,
            notes: '首次执行通过'
        })
    });
    const executeData = await executeRes.json();
    console.log('执行结果:', executeData.success ? '✓ 成功' : '❌ 失败', executeData.message);
    if (executeData.success) {
        console.log('执行后状态:', executeData.data.testcase.status);
        console.log('最后执行时间:', executeData.data.testcase.lastExecuted);
    }
    console.log();
    
    // 4. 获取执行历史
    console.log('4. 获取执行历史...');
    const historyRes = await fetch(`${API_BASE}/testcases/${testcaseId}/history`);
    const historyData = await historyRes.json();
    console.log('执行历史数量:', historyData.data?.length || 0);
    if (historyData.data && historyData.data.length > 0) {
        console.log('最近执行:', historyData.data[0].status, historyData.data[0].executedAt);
    }
    console.log();
    
    // 5. 获取需求列表（用于关联测试）
    console.log('5. 获取需求列表...');
    const reqsRes = await fetch(`${API_BASE}/requirements?projectId=${projectId}`);
    const reqsData = await reqsRes.json();
    console.log('需求数量:', reqsData.data?.length || 0);
    const requirementId = reqsData.data?.[0]?.id;
    console.log();
    
    // 6. 关联需求（如果有需求）
    if (requirementId) {
        console.log('6. 关联需求到用例...');
        const linkRes = await fetch(`${API_BASE}/traces/batch-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                testcaseId,
                requirementIds: [requirementId]
            })
        });
        const linkData = await linkRes.json();
        console.log('关联结果:', linkData.success ? '✓ 成功' : '❌ 失败', linkData.message);
        if (linkData.success) {
            console.log('成功关联:', linkData.data.success.length, '个需求');
        }
        console.log();
        
        // 7. 获取用例关联的需求
        console.log('7. 获取用例关联的需求...');
        const tracesRes = await fetch(`${API_BASE}/testcases/${testcaseId}/traces`);
        const tracesData = await tracesRes.json();
        console.log('关联结果:', tracesData.success ? '✓ 成功' : '❌ 失败');
        console.log('关联的需求数量:', tracesData.data?.relatedRequirements?.length || 0);
        console.log();
    }
    
    // 8. 更新用例
    console.log('8. 更新用例...');
    const updateRes = await fetch(`${API_BASE}/testcases/${testcaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: '登录功能测试（已更新）',
            status: 'pass',
            priority: 'urgent'
        })
    });
    const updateData = await updateRes.json();
    console.log('更新结果:', updateData.success ? '✓ 成功' : '❌ 失败', updateData.message);
    console.log();
    
    // 9. 删除用例（清理测试数据）
    console.log('9. 删除测试用例（清理）...');
    const deleteRes = await fetch(`${API_BASE}/testcases/${testcaseId}`, {
        method: 'DELETE'
    });
    const deleteData = await deleteRes.json();
    console.log('删除结果:', deleteData.success ? '✓ 成功' : '❌ 失败', deleteData.message);
    console.log();
    
    console.log('===== 测试完成 =====');
}

testAPI().catch(console.error);
