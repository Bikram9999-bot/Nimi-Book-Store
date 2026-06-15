const fs = require('fs');
const path = require('path');

const base64Data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'base64_final.json'), 'utf8')
);

const replacements = [
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/240px-Emblem_of_India.svg.png',
    base64: base64Data.emblem
  },
  {
    url: 'https://nimi.gov.in/web/img/nimi-logo.png',
    base64: base64Data.nimiLogo
  },
  {
    url: 'https://www.skillindiadigital.gov.in/assets/images/skillindialogo.png',
    base64: base64Data.skillIndia
  }
];

const targetFiles = [
  path.join(__dirname, '../../bookstore_pos.html'),
  path.join(__dirname, '../../index.html')
];

targetFiles.forEach(filepath => {
  if (!fs.existsSync(filepath)) {
    console.error(`Target file does not exist: ${filepath}`);
    return;
  }

  let content = fs.readFileSync(filepath, 'utf8');
  let count = 0;

  replacements.forEach(r => {
    // Escape special characters in regex
    const escapedUrl = r.url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedUrl, 'g');
    const occurrences = (content.match(regex) || []).length;
    if (occurrences > 0) {
      content = content.replace(regex, r.base64);
      count += occurrences;
    }
  });

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Updated ${path.basename(filepath)}: replaced ${count} URL references with Base64.`);
});
