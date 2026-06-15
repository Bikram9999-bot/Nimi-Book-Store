const fs = require('fs');
const path = require('path');

const files = ['emblem.svg', 'nimi_logo.png', 'skill_india.png'];

files.forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) {
    console.log(`${f} does not exist.`);
    return;
  }
  const content = fs.readFileSync(p);
  console.log(`--- ${f} (${content.length} bytes) ---`);
  console.log("Hex:", content.toString('hex', 0, 8));
  console.log("UTF8:", content.toString('utf8', 0, 50));
});
