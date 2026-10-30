/* Checks every page each time it changes. Run by GitHub on each change (see workflows/check.yml),
   or by hand before publishing with: node .github/check-pages.js
   It does not stop a change from publishing (GitHub Pages publishes every change); it flags it within a
   minute, with an email to whoever made the change, so it can be fixed or reverted.
   1. Every inline script on every page must be valid JavaScript (a typo here blanks the whole page).
   2. The Hub's build number must match in hub/index.html and hub/version.json, so phones that already
      have the Hub open know to reload. The workflow also fails if hub/index.html changed without it. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const pages = ['index.html', 'hub/index.html', 'hub/reset.html', 'volunteer/index.html', 'volunteer/reset.html'];
let bad = 0;
for (const p of pages) {
  const f = path.join(root, p);
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, 'utf8');
  const re = /<script\b(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(html))) {
    n++;
    const attrs = m[1], code = m[2];
    if (/type="application\/(ld\+)?json"/.test(attrs)) { try { JSON.parse(code); } catch (e) { bad++; console.error(`FAIL ${p} script ${n} (JSON): ${e.message}`); } continue; }
    try { new vm.Script('(async function () {\n' + code + '\n})', { filename: `${p}#script${n}` }); }
    catch (e) { bad++; const line = (e.stack || '').split('\n')[0]; console.error(`FAIL ${p} script ${n}: ${e.message} (${line})`); }
  }
  console.log(`ok   ${p} (${n} script${n === 1 ? '' : 's'})`);
}
const hub = fs.readFileSync(path.join(root, 'hub/index.html'), 'utf8');
const b1 = (hub.match(/var BUILD = "(\d+)"/) || [])[1];
let b2 = '';
try { b2 = JSON.parse(fs.readFileSync(path.join(root, 'hub/version.json'), 'utf8')).build; } catch (e) {}
if (!b1 || b1 !== b2) { bad++; console.error(`FAIL Hub build number: hub/index.html has ${b1 || 'none'}, hub/version.json has ${b2 || 'none'}. Set both to the same new number.`); }
else console.log(`ok   Hub build number ${b1}`);
if (bad) { console.error(`\n${bad} problem${bad === 1 ? '' : 's'} found. GitHub publishes every change, so this one is already live: fix it, or revert it (MAINTAINING.md, 'Undoing a change').`); process.exit(1); }
console.log('\nAll pages passed.');
