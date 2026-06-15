const fs = require('fs');
const path = require('path');

const files = ['emblem.png', 'nimi.png', 'skill.png'];

files.forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) {
    console.log(`${f} does not exist.`);
    return;
  }
  const content = fs.readFileSync(p);
  console.log(`--- ${f} (${content.length} bytes) ---`);
  console.log(content.toString('utf8', 0, Math.min(200, content.length)));
});
