const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 混淆配置 - 控制流平坦化 + 字符串加密
const obfuscationOptions = {
  // 控制流平坦化 - 增加逆向难度
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  
  // 字符串加密
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64', 'rc4'],
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  
  // 变量和函数名混淆
  renameGlobals: false,
  renameProperties: false,
  
  // 死代码注入
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  
  // 数字转换表达式
  numbersToExpressions: true,
  simplify: true,
  
  // 其他安全选项
  compact: true,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  rotateStringArray: true,
  seed: 0,
  selfDefending: true,
  sourceMap: false,
  splitStrings: true,
  splitStringsChunkLength: 10,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// 需要混淆的前端 JS 文件列表
const frontendFiles = [
  'navigation-tree.js',
  'file-upload.js',
  'license-manager.js'
];

// 输出目录
const outputDir = path.join(__dirname, 'dist');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// SHA256 哈希计算
function calculateSHA256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// 完整性清单
const integrityManifest = {};

console.log('🔐 开始代码混淆和安全加固...\n');

// 逐个处理文件
frontendFiles.forEach(file => {
  const inputPath = path.join(__dirname, file);
  const outputPath = path.join(outputDir, file);
  
  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  文件不存在：${file}`);
    return;
  }
  
  console.log(`📄 处理：${file}`);
  
  // 读取源代码
  const sourceCode = fs.readFileSync(inputPath, 'utf8');
  
  // 执行混淆
  const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, obfuscationOptions);
  const obfuscatedCode = obfuscationResult.getObfuscatedCode();
  
  // 写入混淆后的代码
  fs.writeFileSync(outputPath, obfuscatedCode, 'utf8');
  
  // 计算 SHA256
  const sha256 = calculateSHA256(outputPath);
  integrityManifest[file] = sha256;
  
  // 计算压缩率
  const originalSize = Buffer.byteLength(sourceCode, 'utf8');
  const obfuscatedSize = Buffer.byteLength(obfuscatedCode, 'utf8');
  const ratio = ((obfuscatedSize / originalSize) * 100).toFixed(1);
  
  console.log(`   ✅ 完成 | 原始：${(originalSize/1024).toFixed(1)}KB → 混淆：${(obfuscatedSize/1024).toFixed(1)}KB (${ratio}%)`);
  console.log(`   🔒 SHA256: ${sha256.substring(0, 16)}...\n`);
});

// 写入完整性清单
const manifestPath = path.join(outputDir, 'integrity-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(integrityManifest, null, 2), 'utf8');
console.log(`📋 完整性清单已保存：${manifestPath}`);

// 创建完整性验证脚本
const verifyScript = `const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const manifestPath = path.join(__dirname, 'integrity-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let allValid = true;

console.log('🔍 验证文件完整性...\\n');

for (const [file, expectedHash] of Object.entries(manifest)) {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(\`❌ \${file}: 文件不存在\`);
    allValid = false;
    continue;
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const actualHash = hashSum.digest('hex');
  
  if (actualHash === expectedHash) {
    console.log(\`✅ \${file}: 完整性验证通过\`);
  } else {
    console.log(\`❌ \${file}: 完整性验证失败！\`);
    console.log(\`   预期：\${expectedHash}\`);
    console.log(\`   实际：\${actualHash}\`);
    allValid = false;
  }
}

console.log('\\n' + (allValid ? '✅ 所有文件完整性验证通过！' : '❌ 部分文件验证失败！'));
process.exit(allValid ? 0 : 1);
`;

const verifyScriptPath = path.join(outputDir, 'verify-integrity.js');
fs.writeFileSync(verifyScriptPath, verifyScript, 'utf8');
console.log(`🔍 验证脚本已保存：${verifyScriptPath}`);

console.log('\n✅ 代码混淆和安全加固完成！');
console.log(`📁 输出目录：${outputDir}`);
console.log('\n使用方法:');
console.log('  node dist/verify-integrity.js  # 验证文件完整性');
