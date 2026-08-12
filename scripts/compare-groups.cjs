const fs = require('fs');
const vi = JSON.parse(fs.readFileSync('public/locales/vi.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));

const viGroups = vi._groups || {};
const enGroups = en._groups || {};

const viGroupKeys = Object.keys(viGroups);
const enGroupKeys = Object.keys(enGroups);

console.log('vi _groups categories:', viGroupKeys.length);
console.log('en _groups categories:', enGroupKeys.length);

let diffs = 0;
viGroupKeys.forEach((cat) => {
  const viSubKeys = viGroups[cat];
  const enSubKeys = enGroups[cat];
  if (!enSubKeys) {
    console.log('Category', cat, 'missing in en _groups!');
    diffs++;
    return;
  }
  const viArr = Array.isArray(viSubKeys) ? viSubKeys : Object.keys(viSubKeys);
  const enArr = Array.isArray(enSubKeys) ? enSubKeys : Object.keys(enSubKeys);
  if (JSON.stringify(viArr) !== JSON.stringify(enArr)) {
    const onlyVi = viArr.filter(x => !enArr.includes(x));
    const onlyEn = enArr.filter(x => !viArr.includes(x));
    if (onlyVi.length > 0 || onlyEn.length > 0) {
      console.log('Category ', JSON.stringify(cat), ' differs: only in vi:', onlyVi.slice(0,5), ' only in en:', onlyEn.slice(0,5));
      diffs++;
    }
  }
});
console.log('Total category diffs:', diffs);
