// 冒煙測試:所有場景用假 ctx 渲染,驗 22+ 項、無例外、無 NaN、長度合理。
const { SCENES } = require('../js/mockups.js');
const ctx = {
  p: { primary: '#1E3A5F', dark: '#16293F', tint: '#D8E1EC', ink: '#14171C',
       g700: '#3E4450', g500: '#737A87', g300: '#C7CCD4', g100: '#F1F2F4',
       paper: '#FFFFFF', onPrimary: '#FFFFFF' },
  nameZh: '鑫和工程', nameEn: 'SINHO Engineering', tagline: '安全 準時', industry: '工程營造',
  logo: (layout, mode, x, y, w) =>
    `<g transform="translate(${x},${y})"><rect width="${w}" height="${(w * 0.28).toFixed(1)}" fill="#888"/></g>`,
  logoH: (layout, w) => layout === 'vertical' ? w * 1.35 : layout === 'mark' ? w : w * 0.28
};
let fail = 0;
const cats = {};
for (const sc of SCENES) {
  try {
    const svg = sc.build(ctx);
    const bad = svg.includes('NaN') || svg.includes('undefined') || svg.length < 200;
    if (bad) throw new Error(`bad output len=${svg.length} NaN=${svg.includes('NaN')} undef=${svg.includes('undefined')}`);
    cats[sc.category] = (cats[sc.category] || 0) + 1;
    console.log(`PASS ${sc.id} (${sc.category}) len=${svg.length}`);
  } catch (e) { fail++; console.log(`FAIL ${sc.id}: ${e.message.slice(0, 100)}`); }
}
console.log('---');
console.log('total:', SCENES.length, JSON.stringify(cats));
if (SCENES.length < 22) { console.log('FAIL: need >=22 scenes'); fail++; }
process.exit(fail ? 1 : 0);
