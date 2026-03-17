const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const manifestPath = path.join(__dirname, 'integrity-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let allValid = true;

console.log('🔍 验证文件完整性...\n');

for (const [file, expectedHash] of Object.entries(manifest)) {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${file}: 文件不存在`);
    allValid = false;
    continue;
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const actualHash = hashSum.digest('hex');
  
  if (actualHash === expectedHash) {
    console.log(`✅ ${file}: 完整性验证通过`);
  } else {
    console.log(`❌ ${file}: 完整性验证失败！`);
    console.log(`   预期：${expectedHash}`);
    console.log(`   实际：${actualHash}`);
    allValid = false;
  }
}

console.log('\n' + (allValid ? '✅ 所有文件完整性验证通过！' : '❌ 部分文件验证失败！'));
process.exit(allValid ? 0 : 1);
