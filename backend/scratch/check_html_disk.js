const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '../../bookstore_pos.html'),
  path.join(__dirname, '../../index.html')
];

targetFiles.forEach(filepath => {
  if (!fs.existsSync(filepath)) {
    console.log(`${filepath} does not exist.`);
    return;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  console.log(`=== File: ${path.basename(filepath)} (${content.length} chars) ===`);
  const regex = /src=["'](data:[^"']+)["']/g;
  let match;
  let count = 0;
  while ((match = regex.exec(content)) !== null) {
    const dataUri = match[1];
    console.log(`  [Match ${count++}]: length=${dataUri.length}, prefix=${dataUri.substring(0, 100)}...`);
  }
});
