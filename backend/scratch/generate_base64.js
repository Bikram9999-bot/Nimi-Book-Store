const fs = require('fs');
const path = require('path');

const files = {
  emblem: 'emblem.svg',
  nimiLogo: 'nimi_logo.png',
  skillIndia: 'skill.png'
};

const results = {};

for (const [key, filename] of Object.entries(files)) {
  const p = path.join(__dirname, filename);
  if (!fs.existsSync(p)) {
    console.error(`File ${filename} does not exist!`);
    continue;
  }
  const buffer = fs.readFileSync(p);
  const mimeType = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  const base64 = buffer.toString('base64');
  results[key] = `data:${mimeType};base64,${base64}`;
  console.log(`Converted ${key} to base64 (${results[key].length} characters).`);
}

fs.writeFileSync(
  path.join(__dirname, 'base64_final.json'),
  JSON.stringify(results, null, 2)
);
console.log("Wrote final base64 mapping to scratch/base64_final.json");
