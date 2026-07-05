// 獨立重驗:在 node 重建全部資產(不經瀏覽器),逐條驗收。exit 0 = 全過。
// 用法:node tools/verify_pack.js
const ColorLib = require('../js/color.js');
const Gen = require('../js/gen.js');
const Mockups = require('../js/mockups.js');
const VI = require('../js/vi.js');
const fs = require('fs');

let pass = 0, fail = 0;
const T = (name, cond, detail) => {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  [' + detail + ']' : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  [' + detail + ']' : ''}`); }
};

(async () => {
  // 1. 色彩科學
  const sharma = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412]];
  T('CIEDE2000 對 Sharma 測試向量', sharma.every(([a, b, e]) => Math.abs(ColorLib.deltaE2000(a, b) - e) < 0.005));
  const pms = JSON.parse(fs.readFileSync(__dirname + '/../data/pantone-pms.json', 'utf8'));
  const n = ColorLib.loadPantone(pms);
  T('Pantone 對照庫載入', n >= 1000, n + ' 色');
  const near = ColorLib.nearestPantone('#1E3A5F', 1)[0];
  T('最近色檢索含 CMYK', !!(near && near.code.startsWith('PANTONE') && near.cmyk && near.dE < 10), `${near.code} dE=${near.dE}`);
  T('12 配色全數 AA(白底)', ColorLib.PALETTES.every(p => ColorLib.contrast(p.primary, '#FFFFFF') >= 4.5));

  // 2. 生成引擎
  await Gen.loadFonts(['poppins', 'poppinsR', 'montserrat', 'plexserif', 'bebas', 'audiowide', 'notosans', 'notosansR', 'notoserif']);
  T('9 字體 opentype 解析', true);
  const input = { nameZh: '鑫和工程', nameEn: 'SINHO Engineering', tagline: '安全 準時 三十年', industry: '工程營造' };
  const specs = Gen.generateCandidates(input, 20260705, 12);
  T('12 候選生成', specs.length === 12);
  const pal = ColorLib.PALETTES.find(p => p.id === specs[0].paletteId);
  let allClean = true, epsOK = true;
  const ExportPack = require('../js/export.js'); // 需在 Gen/ColorLib 後(UMD 於 node 各自 require)
  global.Gen = Gen; global.ColorLib = ColorLib; // export.js 內部引用全域
  for (const layout of ['horizontal', 'vertical', 'mark', 'wordmark']) {
    const lk = Gen.buildLockup(specs[0], layout);
    for (const mode of ['full', 'mono', 'paper']) {
      const svg = Gen.toSVG(lk, pal, mode, { pad: 0.15 });
      if (svg.includes('NaN') || svg.includes('<text') || svg.includes('<image') || !svg.includes('evenodd')) allClean = false;
      const eps = ExportPack.toEPS(lk, pal, mode, 'test');
      if (!eps.startsWith('%!PS-Adobe-3.0 EPSF-3.0') || !eps.includes('eofill') || !eps.includes('setcmykcolor') || !eps.trim().endsWith('%%EOF')) epsOK = false;
      const bb = eps.match(/%%BoundingBox: 0 0 (\d+) (\d+)/);
      if (!bb || +bb[1] <= 0 || +bb[2] <= 0) epsOK = false;
    }
  }
  T('SVG 母檔:無 NaN / 無 <text> / 無 <image> / even-odd(4 版型 × 3 模式)', allClean);
  T('EPS:標頭 / eofill / setcmykcolor / BBox / EOF(4 版型 × 3 模式)', epsOK);
  // 全數轉外框驗證:字紋輪廓存在且閉合
  const t = Gen.textPath('鑫和工程', 'notosans', 46, 0.06);
  T('中文轉外框:路徑數與閉合', t.cmds.filter(c => c.type === 'Z').length >= 4 && t.cmds.length > 100, `${t.cmds.length} cmds`);

  // 3. mockups
  const ctx = {
    p: pal, nameZh: input.nameZh, nameEn: input.nameEn, tagline: input.tagline, industry: input.industry,
    spec: specs[0], palette: pal,
    lockup: layout => Gen.buildLockup(specs[0], layout),
    logo: (layout, mode, x, y, w) => Gen.lockupGroup(Gen.buildLockup(specs[0], layout), pal, mode, x, y, w).g,
    logoH: (layout, w) => { const lk = Gen.buildLockup(specs[0], layout); return lk.h * (w / lk.w); }
  };
  const cats = {};
  let sceneBad = 0;
  for (const sc of Mockups.SCENES) {
    try {
      const s = sc.build(ctx);
      if (s.includes('NaN') || s.includes('undefined') || s.length < 200) sceneBad++;
      cats[sc.category] = (cats[sc.category] || 0) + 1;
    } catch (e) { sceneBad++; }
  }
  T('應用展開 ≥24 景全渲染(真 logo 注入)', Mockups.SCENES.length >= 24 && sceneBad === 0, JSON.stringify(cats));

  // 4. VI 手冊
  const pages = VI.buildManual(ctx);
  T('手冊頁數 40–60', pages.length >= 40 && pages.length <= 60, pages.length + ' 頁');
  const all = pages.join('');
  T('手冊含:淨空區 x/3', all.includes('x/3'));
  T('手冊含:最小 5mm(印刷)', all.includes('5 mm'));
  T('手冊含:背景明度準則', all.includes('背景明度'));
  T('手冊含:禁用範例 8 式', (all.match(/vi-x/g) || []).length >= 8);
  T('手冊含:Pantone 誠實聲明', all.includes('非官方最近色參考'));
  T('手冊含:應用展開頁 ≥24', (all.match(/應用 — /g) || []).length >= 24);

  // 5. 檔案存在
  for (const f of ['fonts/NotoSansTC-Bold.otf', 'data/pantone-pms.json', 'LICENSES/OFL-1.1.txt', 'vendor/opentype.min.js', 'vendor/jszip.min.js'])
    T('檔案存在:' + f, fs.existsSync(__dirname + '/../' + f));

  console.log('---');
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
