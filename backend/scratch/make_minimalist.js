const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '../../bookstore_pos.html'),
  path.join(__dirname, '../../index.html')
];

targetFiles.forEach(filepath => {
  if (!fs.existsSync(filepath)) {
    console.error(`File does not exist: ${filepath}`);
    return;
  }

  let content = fs.readFileSync(filepath, 'utf8');

  // 1. Remove blue background and make it clean light grey (#f8fafc)
  content = content.replace(
    'background:linear-gradient(135deg,#003d7c 0%,#00529b 60%,#0a6cbf 100%)',
    'background:#f8fafc'
  );

  // 2. Adjust watermark to be subtle grey-blue on light background
  content = content.replace(
    'color:#fff;text-align:center;letter-spacing:4px;white-space:nowrap;"',
    'color:#003d7c;text-align:center;letter-spacing:4px;white-space:nowrap;"'
  );
  content = content.replace(
    'opacity:0.04;transform:rotate(-30deg);font-size:48px;font-weight:900;color:#003d7c',
    'opacity:0.015;transform:rotate(-30deg);font-size:48px;font-weight:900;color:#003d7c'
  );

  // 3. Make card container shadow soft and add a light border
  content = content.replace(
    'box-shadow:0 24px 64px rgba(0,0,0,0.25);',
    'box-shadow:0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);border:1px solid #e2e8f0;'
  );

  // 4. Change card header background from navy blue to pure white with a bottom border
  content = content.replace(
    'background:#003d7c;padding:28px 32px 20px;text-align:center;',
    'background:#ffffff;border-bottom:1px solid #f1f5f9;padding:28px 32px 20px;text-align:center;'
  );

  // 5. Change header divider color to light grey
  content = content.replace(
    'background:rgba(255,255,255,0.25);',
    'background:#e2e8f0;'
  );

  // 6. Remove filter:brightness(10); so logos render in their original colors on white bg
  content = content.replace(
    'style="height:52px;filter:brightness(10);"',
    'style="height:52px;"'
  );
  content = content.replace(
    'style="height:48px;object-fit:contain;filter:brightness(10);"',
    'style="height:48px;object-fit:contain;"'
  );

  // 7. Adjust text colors in the header to stand out on white bg
  content = content.replace(
    'color:rgba(255,255,255,0.65);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px;',
    'color:#6b7280;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px;'
  );
  content = content.replace(
    'color:#fff;font-size:18px;font-weight:700;margin:0 0 2px;',
    'color:#003d7c;font-size:18px;font-weight:700;margin:0 0 2px;'
  );

  // 8. Re-style bottom logo bar (remove brightness filter from Skill India logo and darken text)
  content = content.replace(
    'style="position:relative;z-index:1;margin-top:28px;display:flex;align-items:center;gap:20px;opacity:0.75;"',
    'style="position:relative;z-index:1;margin-top:28px;display:flex;align-items:center;gap:20px;opacity:0.85;"'
  );
  content = content.replace(
    'style="height:32px;filter:brightness(10);"',
    'style="height:32px;"'
  );
  content = content.replace(
    'style="color:rgba(255,255,255,0.4);font-size:18px;"',
    'style="color:#cbd5e1;font-size:18px;"'
  );
  content = content.replace(
    'style="color:rgba(255,255,255,0.7);font-size:10px;letter-spacing:1px;"',
    'style="color:#4b5563;font-size:10px;letter-spacing:1px;"'
  );

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Updated ${path.basename(filepath)} to have a minimalist white-background login page.`);
});
