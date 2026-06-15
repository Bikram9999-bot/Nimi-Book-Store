const fs = require('fs');
const https = require('https');
const path = require('path');

const urls = {
  emblem: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/240px-Emblem_of_India.svg.png',
  nimiLogo: 'https://nimi.gov.in/web/img/nimi-logo.png',
  skillIndia: 'https://www.skillindiadigital.gov.in/assets/images/skillindialogo.png'
};

function downloadAndBase64(name, url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${name}: Status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mimeType = res.headers['content-type'] || 'image/png';
        const base64 = buffer.toString('base64');
        resolve({ name, dataUri: `data:${mimeType};base64,${base64}` });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function run() {
  console.log("Downloading images and converting to base64...");
  const results = {};
  for (const [key, url] of Object.entries(urls)) {
    try {
      const res = await downloadAndBase64(key, url);
      results[key] = res.dataUri;
      console.log(`Successfully converted ${key} (${res.dataUri.length} chars)`);
    } catch (err) {
      console.error(`Error converting ${key}:`, err.message);
    }
  }

  fs.writeFileSync(
    path.join(__dirname, 'base64_images.json'),
    JSON.stringify(results, null, 2)
  );
  console.log("Wrote base64 URIs to scratch/base64_images.json");
}

run();
