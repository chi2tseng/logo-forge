/* export.js — 交付包產出:SVG/EPS/PNG 母檔、色彩文件、手冊、應用展開、法務、ZIP
 * EPS:自寫 PostScript(moveto/curveto/eofill,CMYK 上色),Illustrator 可直接開啟。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ExportPack = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LAYOUTS = [['h', 'horizontal', '橫式'], ['v', 'vertical', '直式'], ['mark', 'mark', '純標誌'], ['word', 'wordmark', '純字標']];
  const MODES = [['full', '全彩'], ['mono', '單色墨'], ['paper', '反白'], ['deep', '深階']];

  // ---------- EPS ----------
  function epsColor(hex) {
    const { r, g, b } = ColorLib.hexToRgb(hex);
    const k = ColorLib.rgbToCmyk(r, g, b);
    return `${(k.c / 100).toFixed(3)} ${(k.m / 100).toFixed(3)} ${(k.y / 100).toFixed(3)} ${(k.k / 100).toFixed(3)} setcmykcolor`;
  }
  function cmdsToEps(cmds, H, pad) {
    const f = n => +n.toFixed(3);
    let out = 'newpath\n';
    for (const c of cmds) {
      if (c.type === 'M') out += `${f(c.x + pad)} ${f(H - (c.y + pad))} moveto\n`;
      else if (c.type === 'L') out += `${f(c.x + pad)} ${f(H - (c.y + pad))} lineto\n`;
      else if (c.type === 'C') out += `${f(c.x1 + pad)} ${f(H - (c.y1 + pad))} ${f(c.x2 + pad)} ${f(H - (c.y2 + pad))} ${f(c.x + pad)} ${f(H - (c.y + pad))} curveto\n`;
      else out += 'closepath\n';
    }
    return out;
  }
  function toEPS(lockup, palette, mode, title) {
    const padU = 0.15;
    const pad = padU * lockup.unit;
    const W = Math.ceil(lockup.w + pad * 2), H = Math.ceil(lockup.h + pad * 2);
    let body = '';
    const modeKey = mode === 'deep' ? 'monoDeep' : mode;
    for (const l of lockup.layers) {
      body += epsColor(Gen.resolveFill(l.fill, palette, modeKey)) + '\n';
      body += cmdsToEps(l.cmds, H, pad);
      body += 'eofill\n';
    }
    return `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${W} ${H}
%%HiResBoundingBox: 0 0 ${W} ${H}
%%Title: ${title}
%%Creator: LogoForge (parametric vector engine)
%%DocumentData: Clean7Bit
%%LanguageLevel: 2
%%Pages: 1
%%EndComments
gsave
${body}grestore
showpage
%%EOF
`;
  }

  // ---------- SVG / PNG ----------
  function svgFile(lockup, palette, mode) {
    const modeKey = mode === 'deep' ? 'monoDeep' : mode;
    return Gen.toSVG(lockup, palette, modeKey, { pad: 0.15, bg: 'none' });
  }
  function pngFromSvg(svgStr, targetW) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      img.onload = () => {
        const scale = targetW / img.width;
        const cv = document.createElement('canvas');
        cv.width = targetW; cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('toBlob null')), 'image/png');
      };
      img.onerror = e => { URL.revokeObjectURL(url); reject(new Error('svg raster fail')); };
      img.src = url;
    });
  }

  // ---------- 文件 ----------
  function colorCsv(palette) {
    const CL = ColorLib;
    const rows = [['role', 'name', 'hex', 'R', 'G', 'B', 'C', 'M', 'Y', 'K', 'pantone_ref', 'deltaE2000']];
    const add = (role, name, hex, usePms) => {
      const { r, g, b } = CL.hexToRgb(hex);
      const pms = usePms ? CL.nearestPantone(hex, 1)[0] : null;
      const k = pms ? pms.cmyk : CL.rgbToCmyk(r, g, b);
      rows.push([role, name, hex, r, g, b, k.c, k.m, k.y, k.k, pms ? pms.code : '', pms ? pms.dE : '']);
    };
    add('primary', '主色', palette.primary, true);
    add('primary-dark', '深階', palette.dark, true);
    add('tint', '淡階', palette.tint, false);
    add('ink', '墨', palette.ink, false);
    add('grey-700', '灰700', palette.g700, false);
    add('grey-500', '灰500', palette.g500, false);
    add('grey-300', '灰300', palette.g300, false);
    add('grey-100', '灰100', palette.g100, false);
    return '﻿' + rows.map(r => r.join(',')).join('\r\n');
  }

  function docShell(title, body) {
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${title}</title>
<style>
 body{font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#14171C;line-height:1.85;font-size:14px}
 h1{font-size:22px;letter-spacing:.04em} h2{font-size:15px;margin-top:28px}
 table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
 td,th{border:1px solid #C7CCD4;padding:8px 10px;text-align:left;vertical-align:top}
 th{background:#F1F2F4} .blank{color:#737A87} .sig{margin-top:48px;display:flex;justify-content:space-between;gap:40px}
 .sig div{flex:1;border-top:1px solid #14171C;padding-top:8px;font-size:13px}
 @media print{body{margin:16mm auto}}
</style></head><body>${body}</body></html>`;
  }

  function proofSheet(ctx) {
    const pms = ColorLib.nearestPantone(ctx.p.primary, 1)[0];
    const cm = pms ? pms.cmyk : ColorLib.rgbToCmyk(...Object.values(ColorLib.hexToRgb(ctx.p.primary)));
    return docShell('三材質打樣申請單', `
      <h1>色彩打樣申請單(三材質)</h1>
      <p>品牌:${ctx.nameZh || ''} ${ctx.nameEn || ''}|主色:${ctx.p.primary}|Pantone 參考:${pms ? pms.code : '—'}|CMYK:C${cm.c} M${cm.m} Y${cm.y} K${cm.k}</p>
      <table>
        <tr><th>材質</th><th>工法</th><th>色彩指定</th><th>合格標準</th><th>打樣結果 / ΔE</th><th>簽核</th></tr>
        <tr><td>車貼膠膜(戶外級)</td><td>溶劑噴繪 / 割字</td><td>Pantone 優先,否則 CMYK</td><td>ΔE2000 ≤ 2;戶外 3 年不褪</td><td class="blank">＿＿＿＿</td><td class="blank">＿＿＿＿</td></tr>
        <tr><td>金屬烤漆(招牌)</td><td>粉體烤漆 / 烤漆鋁板</td><td>以 Pantone 實體色票對色</td><td>ΔE2000 ≤ 2;戶外耐候</td><td class="blank">＿＿＿＿</td><td class="blank">＿＿＿＿</td></tr>
        <tr><td>織品(制服刺繡/印花)</td><td>刺繡線 / 熱轉印</td><td>取最接近繡線色號並記錄</td><td>目視比對核可(繡線為離散色)</td><td class="blank">＿＿＿＿</td><td class="blank">＿＿＿＿</td></tr>
      </table>
      <p>說明:特別色(Pantone)與四色印刷、不同材質之呈色本有物理差異;驗收一律以「簽核之實體打樣」為基準,非以螢幕或噴墨稿為準。</p>
      <div class="sig"><div>申請單位 / 日期</div><div>打樣廠商 / 日期</div><div>驗收核可 / 日期</div></div>`);
  }

  function assignmentDoc(ctx) {
    return docShell('著作財產權轉讓切結書', `
      <h1>著作財產權轉讓切結書</h1>
      <p>立書人(乙方):<span class="blank">＿＿＿＿＿＿＿＿</span>茲就交付予
      <span class="blank">＿＿＿＿＿＿＿＿</span>(甲方)之「${ctx.nameZh || ctx.nameEn} 品牌標誌暨視覺識別系統」(下稱本著作),切結如下:</p>
      <h2>一、權利轉讓</h2>
      <p>乙方同意將本著作之全部著作財產權(包括但不限於重製、改作、編輯、公開傳輸、散布等權利)自交付日起讓與甲方,其地域、期間、媒介均無限制。乙方並同意對甲方及其授權之人不行使著作人格權。</p>
      <h2>二、權利擔保</h2>
      ${ctx.spec.mode === 'upload' ? `
      <p>乙方擔保其對上傳之來源圖形享有合法權利或授權,並擔保向量化過程未添加任何第三方素材。本著作之構成元素來源如下:</p>
      <table>
        <tr><th>元素</th><th>來源</th><th>授權</th></tr>
        <tr><td>標誌圖形</td><td>乙方提供之圖檔(${ctx.spec.uploadName || '上傳圖形'}),經 ImageTracer(公有領域)向量描邊</td><td>來源圖之權利由乙方(上傳方)擔保</td></tr>
        <tr><td>Pantone 對照值</td><td>社群公開對照表(MIT)</td><td>參考值;「PANTONE」為 Pantone LLC 商標</td></tr>
      </table>
      <h2>三、生成方式揭露</h2>
      <p>本著作之向量檔由乙方上傳之圖形經開源演算法(ImageTracer,公有領域)向量描邊而得,色彩經量化擷取;描邊為近似外框。本平台流程未使用擴散模型;若來源圖形本身為 AI 生成,其生成方式與權利狀態由乙方另行揭露並負責。相同描邊參數可重現本向量檔。</p>` : `
      <p>乙方擔保本著作為原創,未侵害任何第三人之著作權、商標權或其他權利。本著作之構成元素來源如下,均具合法商用授權:</p>
      <table>
        <tr><th>元素</th><th>來源</th><th>授權</th></tr>
        <tr><td>標誌圖形(全部幾何)</td><td>參數化演算法生成(幾何種子 ${ctx.spec.markSeed}),無第三方素材</td><td>無外部授權需求</td></tr>
        <tr><td>標誌文字外框</td><td>SIL OFL 1.1 授權字體轉外框(明細見「字體版權宣告」)</td><td>OFL 明文允許商用與轉外框,成品不含字體軟體</td></tr>
        <tr><td>Pantone 對照值</td><td>社群公開對照表(MIT)</td><td>參考值;「PANTONE」為 Pantone LLC 商標</td></tr>
      </table>
      <h2>三、生成方式揭露</h2>
      <p>本著作以參數化向量生成引擎產出、經人工挑選與調校。全部路徑為演算法直接構成之閉合向量,非以擴散模型點陣圖描邊而得;相同參數可完整重現,不涉及任何第三方著作之學習樣本重製。</p>`}
      <h2>四、違約責任</h2>
      <p>如有第三人就本著作主張權利,乙方應負責處理並賠償甲方因此所受之損害。</p>
      <div class="sig"><div>立書人(乙方)簽章 / 日期</div><div>甲方簽章 / 日期</div></div>`);
  }

  function colorSpecHtml(ctx) {
    const CL = ColorLib;
    const rows = [
      ['主色 PRIMARY', ctx.p.primary, true], ['深階 DARK', ctx.p.dark, true],
      ['淡階 TINT', ctx.p.tint, false], ['墨 INK', ctx.p.ink, false],
      ['灰 700', ctx.p.g700, false], ['灰 500', ctx.p.g500, false],
      ['灰 300', ctx.p.g300, false], ['灰 100', ctx.p.g100, false]
    ].map(([name, hex, usePms]) => {
      const { r, g, b } = CL.hexToRgb(hex);
      const pms = usePms ? CL.nearestPantone(hex, 2) : [];
      const k = pms[0] ? pms[0].cmyk : CL.rgbToCmyk(r, g, b);
      return `<tr>
        <td><div style="width:46px;height:30px;border-radius:6px;background:${hex};border:1px solid #C7CCD4"></div></td>
        <td>${name}</td><td>${hex}</td><td>${r} / ${g} / ${b}</td>
        <td>C${k.c} M${k.m} Y${k.y} K${k.k}</td>
        <td>${pms.map(x => `${x.code}(ΔE ${x.dE})`).join('<br>') || '—'}</td></tr>`;
    }).join('');
    return docShell('全媒介色彩定義表', `
      <h1>全媒介色彩定義表</h1>
      <p>品牌:${ctx.nameZh || ''} ${ctx.nameEn || ''}|產業:${ctx.industry}</p>
      <table><tr><th>色樣</th><th>角色</th><th>HEX(數位)</th><th>RGB</th><th>CMYK(印刷)</th><th>Pantone 參考(ΔE2000)</th></tr>${rows}</table>
      <p>使用順位:特別色印刷 → Pantone;四色印刷 → CMYK(取 PMS 對照表建議值);數位 → HEX。<br>
      Pantone 對照為非官方最近色(資料集:adonald/Pantone-CMYK-RGB-Hex,MIT 授權);正式印製以 Pantone 實體色票與簽核打樣為準(合格標準 ΔE2000 ≤ 2)。CMYK 換算未掛 ICC 描述檔,大量印刷前應打數位樣。</p>`);
  }

  function fontLegal() {
    const lines = ['字體版權宣告(自字型檔 name table 抽出)', '='.repeat(40), ''];
    for (const f of Gen.FONTS) {
      try {
        const font = Gen.getFont(f.id);
        const nm = font.names || {};
        const gv = k => nm[k] ? (nm[k].zh || nm[k].en || Object.values(nm[k])[0]) : '';
        lines.push(`【${f.label}】(${f.file})`);
        lines.push(`  Copyright : ${gv('copyright') || '(見字型檔)'}`);
        lines.push(`  License   : ${(gv('license') || 'SIL Open Font License 1.1').slice(0, 160)}`);
        lines.push('');
      } catch (e) {
        lines.push(`【${f.label}】未載入(本次未使用)`, '');
      }
    }
    lines.push('全部字體均為 SIL Open Font License 1.1;授權全文見 OFL-1.1.txt。');
    lines.push('OFL 明文允許:商業使用、修改、再散布、內嵌與轉外框;唯不得以字體本身名義販售。');
    lines.push('本交付包內所有標誌文字「已轉外框為純路徑」,成品不含任何字體軟體本體。');
    return lines.join('\r\n');
  }

  function aiDisclosureDoc(ctx) {
    const body = ctx.spec.mode === 'upload' ? `
1. **生成方式**:本向量母檔由上傳方提供之圖形(\`${ctx.spec.uploadName || '上傳圖檔'}\`,原始 ${ctx.spec.uploadW}×${ctx.spec.uploadH}px)經開源演算法 ImageTracer(公有領域/Unlicense)向量描邊而得;色彩以量化直方圖擷取,背景以角落取樣偵測後移除。
2. **描邊性質**:輸出為「近似外框」之閉合路徑(even-odd 鏤空),非原始幾何重建;大型輸出前建議以向量軟體人工精修節點。本平台流程未使用擴散模型。
3. **來源圖責任**:若來源圖形本身為 AI 生成或含第三方素材,其生成方式揭露與權利擔保由上傳方負責(見切結書第二、三條)。
4. **可重現性**:相同來源檔與描邊參數(色數/細節/去背設定)可重現本向量檔。
5. **元素授權**:明細見「資產來源清單.md」;權利歸屬依「著作財產權轉讓切結書」辦理。` : `
1. **生成方式**:本標誌與全部衍生資產由參數化向量生成引擎(LogoForge)產出;所有幾何由演算法直接以「閉合貝茲路徑」構成,標誌文字以 SIL OFL 1.1 授權字體經 opentype.js 轉為外框路徑。
2. **非點陣生圖**:未使用擴散模型或任何生圖模型之點陣輸出,亦無「生圖後描邊(auto-trace)」流程;不涉及第三方著作樣本之重製疑慮。
3. **人工參與**:候選經人工挑選;配色、版型、字體與幾何參數經人工調校後定稿(定稿參數:幾何種子 \`${ctx.spec.markSeed}\`、家族 \`${ctx.spec.family}\`、配色 \`${ctx.palette.id}\`、字紋 \`${ctx.spec.glyphChar}\`)。
4. **可重現性**:輸入相同名稱與上述參數即可 100% 重現全部資產,供驗收核對與後續改版追溯。
5. **元素授權**:構成元素明細見「資產來源清單.md」與「字體版權宣告.txt」;權利歸屬依「著作財產權轉讓切結書」辦理。`;
    return `# AI 生成揭露聲明

品牌:${ctx.nameZh || ''} ${ctx.nameEn || ''}|產業:${ctx.industry}
${body}

聲明人(乙方):＿＿＿＿＿＿＿＿　日期:＿＿＿＿＿＿＿＿
`;
  }

  function provenanceDoc(ctx, manifest) {
    const up = ctx.spec.mode === 'upload';
    const paramLine = up
      ? `來源檔 \`${ctx.spec.uploadName || 'upload'}\`(${ctx.spec.uploadW}×${ctx.spec.uploadH}px)|主色(擷取)\`${ctx.palette.primary}\``
      : `幾何種子 \`${ctx.spec.markSeed}\`|家族 \`${ctx.spec.family}\`|配色 \`${ctx.palette.id}\`|字紋 \`${ctx.spec.glyphChar}\``;
    const logoRows = up ? `| 標誌向量 | 上傳圖形經 ImageTracer(公有領域)向量描邊,近似外框 | 上傳方提供之來源圖形 | 權利由上傳方擔保 |
| 色彩擷取 | 量化直方圖 + 角落背景偵測(本機演算) | 無 | 不適用 |` : `| 標誌幾何(容器、模組、弧、柱等) | 參數化演算法(閉合貝茲路徑) | 無 | 不適用 |
| 標誌文字外框 | opentype.js 讀取 OFL 字體字形 → 轉閉合外框 | 字形設計(OFL 字體) | SIL OFL 1.1(允許商用/轉外框) |
| 配色 | 策展色板(單一強調色 + 中性灰) | 無 | 不適用 |`;
    return `# 資產來源清單(Provenance)

品牌:${ctx.nameZh || ''} ${ctx.nameEn || ''}|產業:${ctx.industry}
生成參數:${paramLine}

| 資產 | 生成方式 | 第三方內容 | 授權 |
|---|---|---|---|
${logoRows}
| Pantone 參考值 | CIEDE2000 最近色檢索 | adonald/Pantone-CMYK-RGB-Hex 資料集 | MIT;PANTONE® 為 Pantone LLC 商標 |
| 應用展開場景 | 平台內建向量場景庫 | 無 | 不適用 |
| VI 手冊 | 平台自動組版 | 無 | 不適用 |

**重現方法**:${up ? '於 LogoForge 上傳相同來源檔並套用相同描邊參數(色數/細節/去背),即可重現向量母檔。' : `於 LogoForge 輸入相同名稱與種子(${ctx.spec.markSeed}),即可 100% 重現全部資產。`}

共 ${manifest.length} 個檔案,清單見 README.md。
`;
  }

  function readmeDoc(ctx, manifest, manualCount, mockupCount) {
    return `# ${ctx.nameZh || ctx.nameEn} — 標案交付包

由 LogoForge(參數化向量生成引擎)產出。**全部資產衍生自同一份向量母檔**。

## 目錄結構

- \`01_向量母檔/\` — SVG 母檔 + EPS 交換檔(4 版型 × 4 色彩模式)+ PNG 高解析衍生
- \`02_色彩定義/\` — 色彩定義表(HTML/CSV)、三材質打樣申請單
- \`03_VI手冊/\` — 品牌視覺手冊 ${manualCount} 頁(HTML;瀏覽器開啟 → 列印 → 另存 PDF = 向量 PDF)
- \`04_應用展開/\` — ${mockupCount} 景應用配置圖(SVG)
- \`05_法務文件/\` — OFL 授權全文、字體版權宣告、資產來源清單、著作財產權轉讓切結書、AI 生成揭露

## 關於 .ai 格式

.ai 為 Adobe 專有格式,無法由第三方工具直接產生。本包提供 **EPS 與 SVG**(業界通用向量交換格式):
以 Adobe Illustrator 開啟 \`01_向量母檔/EPS/\` 任一檔 → 另存新檔 → .ai,即為原生 .ai 母檔(路徑不變、外框不變)。
標案規格書多寫「.ai 或同等向量格式」;若貴案僅收 .ai,依上述步驟一分鐘內可完成轉存。

## 大型輸出(10 公尺以上)

所有母檔為純向量(閉合路徑、文字已轉外框),放大無失真;噴繪廠直接取用 SVG 或 EPS 即可,禁止以 PNG 放大。

## 重現與改稿

${ctx.spec.mode === 'upload'
    ? `來源:上傳檔 \`${ctx.spec.uploadName || 'upload'}\`(${ctx.spec.uploadW}×${ctx.spec.uploadH}px)。相同來源檔 + 相同描邊參數(色數/細節/去背)即可重現向量母檔。`
    : `生成參數:名稱「${ctx.nameZh || ''} / ${ctx.nameEn || ''}」、種子 \`${ctx.spec.markSeed}\`、家族 \`${ctx.spec.family}\`、配色 \`${ctx.palette.id}\`。
改稿 = 調參數重出,不需重畫;歷次版本可完整追溯。`}

## 誠實限制聲明

1. Pantone 為非官方最近色參考(ΔE2000);正式印製以實體色票 + 簽核打樣為準。
2. CMYK 為 PMS 對照表建議值 / 通用換算,未掛 ICC;量產前請打數位樣。
3. 材質打樣為實體流程,請使用隨附申請單委外執行。${ctx.spec.mode === 'upload' ? `
4. 本包向量母檔為「描邊近似外框」(自上傳點陣圖向量化):可無限縮放,但非原始幾何重建;大型輸出(10 米級)前建議以 Illustrator 人工精修節點、確認邊緣品質。` : ''}

## 檔案清單(${manifest.length})

${manifest.map(f => '- ' + f).join('\n')}
`;
  }

  // ---------- 主流程 ----------
  async function buildPackage(ctx, prog) {
    const zip = new JSZip();
    const manifest = [];
    const add = (path, content) => { zip.file(path, content); manifest.push(path); };
    const pal = ctx.palette;
    const brand = (ctx.nameEn || ctx.nameZh || 'brand').replace(/\s+/g, '_');

    // 1. 向量母檔
    prog.doing('母檔');
    const up = ctx.spec.mode === 'upload';
    const layoutList = up ? [['logo', 'mark', '標誌']] : LAYOUTS;
    const lockups = {};
    for (const [code, layout] of layoutList.map(l => [l[0], l[1]])) lockups[code] = ctx.lockup(layout);
    for (const [code, , zhName] of layoutList) {
      for (const [mode] of MODES) {
        const svg = svgFile(lockups[code], pal, mode);
        add(`01_向量母檔/SVG/${brand}_${code}_${mode}.svg`, svg);
        add(`01_向量母檔/EPS/${brand}_${code}_${mode}.eps`, toEPS(lockups[code], pal, mode, `${brand} ${zhName} ${mode}`));
      }
    }
    add('01_向量母檔/說明.txt',
      (up ? '母檔為上傳圖形之向量描邊(近似外框):輪廓閉合、even-odd 鏤空;大型輸出前建議人工精修節點。\r\n'
          : '母檔規格:全部路徑閉合、文字已轉外框、負空間為 even-odd 真實鏤空。\r\n') +
      'SVG = 母檔;EPS = 交換格式(Illustrator 開啟後可另存 .ai)。\r\n' +
      '反白(paper)版為白色圖形、透明底,請置於深色/主色背景使用。\r\n' +
      '色彩模式代碼:full=全彩 mono=單色墨 paper=反白 deep=深階。' +
      (up ? '' : '\r\n版型代碼:h=橫式 v=直式 mark=純標誌 word=純字標。'));
    prog.done('母檔');

    // 2. PNG
    prog.doing('點陣');
    const pngPlan = up ? [
      ['logo', 'full', [512, 1024, 2048, 4096]],
      ['logo', 'mono', [1024]]
    ] : [
      ['h', 'full', [512, 1024, 2048, 4096]],
      ['mark', 'full', [512, 1024, 2048, 4096]],
      ['h', 'mono', [1024]],
      ['mark', 'mono', [1024]]
    ];
    for (const [code, mode, sizes] of pngPlan) {
      const svg = svgFile(lockups[code], pal, mode);
      for (const w of sizes) {
        try {
          const blob = await pngFromSvg(svg, w);
          add(`01_向量母檔/PNG/${brand}_${code}_${mode}_${w}px.png`, blob);
        } catch (e) { console.warn('png fail', code, mode, w, e); }
      }
    }
    prog.done('點陣');

    // 3. 色彩
    prog.doing('色彩');
    add('02_色彩定義/色彩定義表.html', colorSpecHtml(ctx));
    add('02_色彩定義/色彩定義表.csv', colorCsv(pal));
    add('02_色彩定義/三材質打樣申請單.html', proofSheet(ctx));
    prog.done('色彩');

    // 4. 手冊
    prog.doing('手冊');
    const pages = VI.buildManual(ctx);
    const manualHtml = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${ctx.nameZh || ctx.nameEn} 品牌視覺手冊</title>
<style>
 body{background:#E8EAEE;margin:0;padding:24px 0;font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif}
 .page{width:794px;height:1123px;background:#fff;margin:0 auto 24px;position:relative;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
 @page{size:A4;margin:0}
 @media print{body{background:#fff;padding:0}.page{margin:0;box-shadow:none;width:210mm;height:296.5mm;page-break-after:always}}
 ${VI.MANUAL_CSS}
</style></head><body>
${pages.map(pg => `<div class="page">${pg}</div>`).join('\n')}
</body></html>`;
    add('03_VI手冊/品牌視覺手冊.html', manualHtml);
    add('03_VI手冊/如何輸出PDF.txt', '以 Chrome/Edge 開啟「品牌視覺手冊.html」→ Ctrl+P → 目的地選「另存為 PDF」→ 邊界「無」→ 勾選背景圖形 → 儲存。\r\n輸出之 PDF 內標誌與圖形皆為向量。');
    prog.done('手冊');

    // 5. 應用展開
    prog.doing('展開');
    let mockupCount = 0;
    for (const sc of Mockups.scenesFor(ctx.industry)) {
      try {
        const inner = sc.build(ctx);
        add(`04_應用展開/${sc.id}_${sc.title.replace(/[\\/:*?"<>|]/g, '')}.svg`,
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sc.w} ${sc.h}">${inner}</svg>`);
        mockupCount++;
      } catch (e) { console.warn('scene fail', sc.id, e); }
    }
    prog.done('展開');

    // 6. 法務
    prog.doing('法務');
    try {
      const ofl = await (await fetch('LICENSES/OFL-1.1.txt')).text();
      add('05_法務文件/OFL-1.1.txt', ofl);
    } catch (e) { add('05_法務文件/OFL-1.1.txt', 'SIL Open Font License 1.1 全文:https://openfontlicense.org'); }
    add('05_法務文件/字體版權宣告.txt', fontLegal());
    add('05_法務文件/著作財產權轉讓切結書.html', assignmentDoc(ctx));
    add('05_法務文件/資產來源清單.md', provenanceDoc(ctx, manifest));
    add('05_法務文件/AI生成揭露聲明.md', aiDisclosureDoc(ctx));
    prog.done('法務');

    // 7. ZIP
    prog.doing('打包');
    add('README.md', readmeDoc(ctx, manifest, pages.length, mockupCount));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    prog.done('打包');

    return { blob, manifest, fileCount: manifest.length, manualCount: pages.length, mockupCount };
  }

  return { buildPackage, toEPS };
});
