const fs = require('fs');
const https = require('https');
const path = require('path');
const url = require('url');

const emblemUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/240px-Emblem_of_India.svg.png';
const skillIndiaUrl = 'https://www.skillindiadigital.gov.in/assets/images/skillindialogo.png';

const nimiPaths = [
  'https://nimi.gov.in/img/headerlogos/3.png',
  'https://www.nimi.gov.in/img/headerlogos/3.png',
  'https://nimi.gov.in/web/img/nimi-logo.png',
  'https://www.nimi.gov.in/web/img/nimi-logo.png'
];

function download(targetUrl) {
  const parsed = url.parse(targetUrl);
  const options = {
    hostname: parsed.hostname,
    path: parsed.path,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.google.com/'
    }
  };

  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode} for ${targetUrl}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mimeType = res.headers['content-type'] || 'image/png';
        const base64 = buffer.toString('base64');
        resolve(`data:${mimeType};base64,${base64}`);
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log("Starting conversion v2...");
  const results = {};

  // 1. Convert Skill India
  try {
    const data = await download(skillIndiaUrl);
    results.skillIndia = data;
    console.log("Success: skillIndia");
  } catch (err) {
    console.error("Failed skillIndia:", err.message);
  }

  // 2. Convert Emblem
  try {
    const data = await download(emblemUrl);
    results.emblem = data;
    console.log("Success: emblem");
  } catch (err) {
    console.error("Failed emblem:", err.message);
  }

  // 3. Try NIMI Logo paths
  let nimiData = null;
  for (const nimiUrl of nimiPaths) {
    console.log(`Trying NIMI Logo URL: ${nimiUrl}`);
    try {
      nimiData = await download(nimiUrl);
      console.log(`Success: nimiLogo from ${nimiUrl}`);
      break;
    } catch (err) {
      console.log(`Failed path ${nimiUrl}: ${err.message}`);
    }
  }

  if (nimiData) {
    results.nimiLogo = nimiData;
  } else {
    console.error("Failed to download NIMI logo from all paths.");
  }

  fs.writeFileSync(
    path.join(__dirname, 'base64_images_v2.json'),
    JSON.stringify(results, null, 2)
  );
  console.log("Wrote base64 URIs to scratch/base64_images_v2.json");
}

run();
