/* vi.js — VI 品牌手冊自動組版(A4,43+ 頁)
 * 每頁 = HTML 字串(絕對定位排版),SVG 直接內嵌 → 瀏覽器列印即向量 PDF。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MANUAL_CSS = `
  .page { font-family:'InterV',Inter,'Noto Sans TC','Microsoft JhengHei',sans-serif; color:#14171C; }
  .vi-body { position:absolute; inset:64px 56px 60px; }
  .vi-sec { position:absolute; top:28px; left:56px; font-size:10px; letter-spacing:.14em; color:#737A87; font-weight:600; }
  .vi-no  { position:absolute; bottom:24px; right:56px; font-size:10px; color:#737A87; font-variant-numeric:tabular-nums; }
  .vi-brandfoot { position:absolute; bottom:24px; left:56px; font-size:10px; color:#C7CCD4; }
  .vi-h1 { font-size:26px; font-weight:660; letter-spacing:-.01em; margin:0 0 4px; }
  .vi-sub { font-size:12px; color:#737A87; margin:0 0 22px; line-height:1.7; }
  .vi-rule { height:3px; width:44px; border-radius:2px; margin:0 0 18px; }
  .vi-note { font-size:10.5px; color:#737A87; line-height:1.7; }
  .vi-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .vi-grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  .vi-cell { border:1px solid #E4E7EB; border-radius:10px; padding:14px; text-align:center; }
  .vi-cell .bx { height:110px; display:flex; align-items:center; justify-content:center; }
  .vi-cell .bx svg { max-width:92%; max-height:96px; }
  .vi-cell b { font-size:10.5px; color:#3E4450; font-weight:600; }
  .vi-kv { width:100%; border-collapse:collapse; font-size:11px; }
  .vi-kv td { padding:7px 4px; border-bottom:1px solid #F1F2F4; vertical-align:top; }
  .vi-kv td:first-child { color:#737A87; width:110px; }
  .vi-toc { column-count:2; column-gap:40px; font-size:12px; line-height:2.35; }
  .vi-toc div { display:flex; }
  .vi-toc .t { flex:1; }
  .vi-toc .n { color:#737A87; font-variant-numeric:tabular-nums; }
  .vi-cover-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:26px; }
  .vi-app-svg { border:1px solid #E4E7EB; border-radius:12px; overflow:hidden; }
  .vi-app-svg svg { display:block; width:100%; height:auto; }
  .vi-x { position:absolute; top:8px; right:10px; font-size:14px; font-weight:700; color:#BE123C; }
  `;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function shell(no, section, inner, brand, accent) {
    return `
      <div class="vi-sec">${esc(section)}</div>
      <div class="vi-body">${inner}</div>
      <div class="vi-brandfoot">${esc(brand)} 品牌視覺識別手冊</div>
      <div class="vi-no">${String(no).padStart(2, '0')}</div>`;
  }
  const H1 = (t, sub, accent) =>
    `<div class="vi-rule" style="background:${accent}"></div><h1 class="vi-h1">${t}</h1><p class="vi-sub">${sub}</p>`;

  function svgWrap(w, h, inner, style) {
    // width/height 屬性給固有尺寸(否則在非 flex 容器內 max-* 會塌成 0);style 仍可覆蓋
    return `<svg viewBox="0 0 ${w} ${h}" width="${w.toFixed ? w.toFixed(1) : w}" height="${h.toFixed ? h.toFixed(1) : h}" xmlns="http://www.w3.org/2000/svg" style="${style || 'width:100%;height:auto'}">${inner}</svg>`;
  }

  // ---------- 手冊主體 ----------
  function buildManual(ctx) {
    if (typeof document !== 'undefined' && !document.getElementById('viStyle')) {
      const st = document.createElement('style');
      st.id = 'viStyle'; st.textContent = MANUAL_CSS;
      document.head.appendChild(st);
    }
    const p = ctx.p;
    const up = ctx.spec && ctx.spec.mode === 'upload';
    const brand = ctx.nameZh || ctx.nameEn;
    const pages = [];
    const push = (section, inner) => pages.push({ section, inner });

    const lockH = ctx.lockup('horizontal');
    const lockV = ctx.lockup('vertical');
    const lockM = ctx.lockup('mark');
    const lockW = ctx.lockup('wordmark');
    const G = (lk, mode, x, y, w) => (typeof Gen !== 'undefined' ? Gen : require('./gen.js')).lockupGroup(lk, p, mode, x, y, w).g;
    const ratioH = lockH.h / lockH.w, ratioV = lockV.h / lockV.w;

    // ---- 01 封面
    push('COVER', `
      <div class="vi-cover-center">
        ${svgWrap(lockV.w * 1.2, lockV.h * 1.2, G(lockV, 'full', lockV.w * 0.1, lockV.h * 0.1, lockV.w), 'width:300px;height:auto')}
        <div style="text-align:center">
          <div style="font-size:15px;font-weight:650;letter-spacing:.3em;color:#3E4450">品牌視覺識別手冊</div>
          <div style="font-size:10.5px;color:#737A87;margin-top:8px;letter-spacing:.12em">BRAND IDENTITY GUIDELINES · V1.0 · 2026</div>
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:12px;background:${p.primary}"></div>`);

    // ---- 02 目錄(先佔位,最後回填頁碼)
    push('CONTENTS', '__TOC__');

    // ---- 03 品牌核心
    push('BRAND CORE', H1('品牌核心', '本手冊為品牌之唯一視覺依據;任何媒介之標誌使用,悉依本手冊規範。', p.primary) + `
      <table class="vi-kv">
        <tr><td>品牌名稱</td><td><b>${esc(ctx.nameZh || '—')}</b>&nbsp;&nbsp;${esc(ctx.nameEn || '')}</td></tr>
        <tr><td>產業別</td><td>${esc(ctx.industry)}</td></tr>
        ${ctx.tagline ? `<tr><td>品牌標語</td><td>${esc(ctx.tagline)}</td></tr>` : ''}
        ${up ? `<tr><td>設計方法</td><td>上傳圖形之向量描邊(ImageTracer,公有領域)—— 輪廓一律閉合、負空間 even-odd 鏤空;描邊為近似外框,來源圖權利由上傳方擔保。</td></tr>
        <tr><td>再現性</td><td>來源檔 ${esc(ctx.spec.uploadName || 'upload')}(${ctx.spec.uploadW}×${ctx.spec.uploadH}px):相同來源檔與描邊參數可重現本向量檔。</td></tr>`
      : `<tr><td>設計方法</td><td>參數化向量生成 —— 標誌之所有幾何皆由演算法以閉合路徑構成,文字全數轉為字型外框;無點陣素材、無第三方圖像。</td></tr>
        <tr><td>再現性</td><td>幾何種子 ${ctx.spec.markSeed}:同種子可 100% 重現本標誌之全部幾何。</td></tr>`}
      </table>
      <div style="margin-top:36px;display:flex;justify-content:center">${svgWrap(lockH.w * 1.3, lockH.h * 1.6, G(lockH, 'full', lockH.w * 0.15, lockH.h * 0.3, lockH.w), 'width:70%;height:auto')}</div>`);

    // ---- 04 標誌總覽
    push('LOGO', up
      ? H1('標誌總覽', '上傳圖形之向量化標誌。全彩為預設;單色墨用於傳真、雕刻、單色印刷。', p.primary) + `
      <div class="vi-grid2">
        ${[['full', '全彩(預設)'], ['mono', '單色墨']].map(([m, t]) => `
          <div class="vi-cell"><div class="bx" style="height:150px">${svgWrap(lockH.w * 1.2, lockH.h * 1.2, G(lockH, m, lockH.w * 0.1, lockH.h * 0.1, lockH.w), 'max-width:90%;max-height:140px')}</div><b>${t}</b></div>`).join('')}
      </div>
      <p class="vi-note" style="margin-top:16px">標誌比例與色彩為鎖定值,不得個別調整;禁止自行重繪或以點陣圖縮放替代。</p>`
      : H1('標誌總覽', '四種法定版型。橫式為預設;直式用於窄幅;純標誌限已建立認知之場合;純字標用於極小尺寸。', p.primary) + `
      <div class="vi-grid2">
        ${[[lockH, '橫式(預設)'], [lockV, '直式'], [lockM, '純標誌'], [lockW, '純字標']].map(([lk, t]) => `
          <div class="vi-cell"><div class="bx" style="height:150px">${svgWrap(lk.w * 1.2, lk.h * 1.2, G(lk, 'full', lk.w * 0.1, lk.h * 0.1, lk.w), 'max-width:90%;max-height:140px')}</div><b>${t}</b></div>`).join('')}
      </div>
      <p class="vi-note" style="margin-top:16px">四版型之相對比例、色彩與間距皆為鎖定值,不得個別調整。</p>`);

    // ---- 05 標誌製圖(橫式)
    {
      const w = lockH.w, h = lockH.h, u = lockH.unit;
      let grid = '';
      for (let gx = 0; gx <= w + u; gx += u / 2)
        grid += `<line x1="${gx}" y1="${-u * 0.6}" x2="${gx}" y2="${h + u * 0.6}" stroke="#E4E7EB" stroke-width="0.8"/>`;
      for (let gy = -u * 0.5; gy <= h + u * 0.5; gy += u / 2)
        grid += `<line x1="${-u * 0.5}" y1="${gy}" x2="${w + u}" y2="${gy}" stroke="#E4E7EB" stroke-width="0.8"/>`;
      const dims = `
        <line x1="${-u * 0.32}" y1="0" x2="${-u * 0.32}" y2="${h}" stroke="#737A87" stroke-width="1.2"/>
        <text x="${-u * 0.44}" y="${h / 2}" font-size="${u * 0.13}" fill="#3E4450" text-anchor="middle" transform="rotate(-90 ${-u * 0.44} ${h / 2})">1x(標誌高)</text>
        <line x1="${lockH.markW}" y1="${h + u * 0.3}" x2="${lockH.markW + 26}" y2="${h + u * 0.3}" stroke="#737A87" stroke-width="1.2"/>
        <text x="${lockH.markW + 13}" y="${h + u * 0.47}" font-size="${u * 0.11}" fill="#3E4450" text-anchor="middle">0.26x</text>`;
      push('LOGO', H1('標誌製圖(橫式)', '以標誌高度 1x 為基準單位;格線為 x/2。所有間距與字級鎖定於 x 之比例,放大縮小不得變動。', p.primary) +
        `<div style="display:flex;justify-content:center;margin-top:10px">${svgWrap(w + u * 1.6, h + u * 1.4, `<g transform="translate(${u * 0.55},${u * 0.6})">${grid}${G(lockH, 'full', 0, 0, w)}${dims}</g>`, 'width:96%;height:auto')}</div>
        <table class="vi-kv" style="margin-top:18px">
          <tr><td>基準單位</td><td>x = 標誌(圖形)高度</td></tr>
          <tr><td>圖文間距</td><td>0.26x(鎖定)</td></tr>
          <tr><td>路徑規格</td><td>全數閉合;負空間以 even-odd 開孔,非白色覆蓋 —— 單色與反白版型不破</td></tr>
        </table>`);
    }

    // ---- 06 標誌製圖(直式)(上傳模式無多版型,略過)
    if (!up) push('LOGO', H1('標誌製圖(直式)', '直式版型:標誌置中,中文名於下,字距與行距為鎖定比例。', p.primary) +
      `<div style="display:flex;justify-content:center;margin-top:16px">${svgWrap(lockV.w * 1.5, lockV.h * 1.25, `<rect x="${lockV.w * 0.25}" y="0" width="${lockV.w}" height="${lockV.h}" fill="none" stroke="#C7CCD4" stroke-dasharray="4 4"/>` + G(lockV, 'full', lockV.w * 0.25, lockV.h * 0.06, lockV.w), 'width:44%;height:auto')}</div>
      <p class="vi-note" style="text-align:center;margin-top:14px">虛線 = 版型外框(最小包覆矩形)。直式用於旗幟、識別證、窄幅招牌。</p>`);

    // ---- 07 淨空區
    {
      const u = lockH.unit, c = u / 3;
      const w = lockH.w + c * 2, h = lockH.h + c * 2;
      const inner = `
        <rect x="0" y="0" width="${w}" height="${h}" fill="#F1F2F4"/>
        <rect x="${c}" y="${c}" width="${lockH.w}" height="${lockH.h}" fill="#FFFFFF" stroke="#C7CCD4" stroke-dasharray="5 4"/>
        ${G(lockH, 'full', c, c, lockH.w)}
        ${['M', [w / 2, c / 2], [w / 2, h - c / 2], [c / 2, h / 2], [w - c / 2, h / 2]].slice(1).map(pt =>
          `<text x="${pt[0]}" y="${pt[1] + 4}" font-size="${u * 0.14}" fill="#3E4450" text-anchor="middle" font-weight="600">x/3</text>`).join('')}`;
      push('LOGO', H1('淨空區', '標誌四周需保留 x/3 之淨空(x=標誌高)。淨空區內不得出現任何文字、圖形、其他標誌或高對比邊界。', p.primary) +
        `<div style="display:flex;justify-content:center;margin-top:18px">${svgWrap(w, h, inner, 'width:88%;height:auto')}</div>
        <p class="vi-note" style="margin-top:16px">灰色區 = 最小淨空。版面允許時,建議淨空 ≥ x/2。</p>`);
    }

    // ---- 08 最小尺寸
    push('LOGO', H1('最小使用尺寸', '低於最小尺寸,細節將不可辨,一律禁止。更小需求改用「純標誌」版型。', p.primary) + `
      <div style="display:flex;align-items:flex-end;gap:36px;margin-top:26px;justify-content:center">
        ${[[140, '40 mm'], [90, '25 mm'], [42, '12 mm'], [17.7, '5 mm(下限)']].map(([px, lbl]) => `
          <div style="text-align:center">
            <div style="display:flex;align-items:flex-end;justify-content:center;height:120px">${svgWrap(lockH.w, lockH.h, G(lockH, 'full', 0, 0, lockH.w), `width:${px * 2.2}px;height:auto`)}</div>
            <div style="font-size:10.5px;color:#3E4450;margin-top:10px;font-weight:600">${lbl}</div>
          </div>`).join('')}
      </div>
      <table class="vi-kv" style="margin-top:30px">
        <tr><td>印刷媒介</td><td><b>橫式標誌寬 ≥ 5 mm</b>(名片、票券等微小應用改用純字標)</td></tr>
        <tr><td>數位媒介</td><td><b>橫式標誌寬 ≥ 96 px;純標誌 ≥ 24 px</b>(favicon 16px 使用簡化純標誌)</td></tr>
        <tr><td>大型輸出</td><td>向量母檔無上限 —— 10 公尺以上噴繪直接以 SVG/EPS 輸出,不得以點陣放大</td></tr>
      </table>`);

    // ---- 09 禁用範例
    {
      const base = svgWrap(lockH.w * 1.06, lockH.h * 1.3, G(lockH, 'full', lockH.w * 0.03, lockH.h * 0.15, lockH.w), 'max-width:88%;max-height:74px');
      const baseMono = m => svgWrap(lockH.w * 1.06, lockH.h * 1.3, G(lockH, m, lockH.w * 0.03, lockH.h * 0.15, lockH.w), 'max-width:88%;max-height:74px');
      const wrongPal = { ...p, primary: '#7AC943', dark: '#4E8F22', ink: '#7AC943', g700: '#7AC943' };
      const wrong = svgWrap(lockH.w * 1.06, lockH.h * 1.3, (typeof Gen !== 'undefined' ? Gen : require('./gen.js')).lockupGroup(lockH, wrongPal, 'full', lockH.w * 0.03, lockH.h * 0.15, lockH.w).g, 'max-width:88%;max-height:74px');
      const tiles = [
        ['任意變形拉伸', `<div style="transform:scaleX(1.45)">${base}</div>`],
        ['任意旋轉', `<div style="transform:rotate(12deg)">${base}</div>`],
        ['擅改色彩', wrong],
        ['低對比背景', `<div style="background:${p.tint};border-radius:8px;padding:4px 8px">${baseMono('paper')}</div>`],
        ['外加描邊', `<div style="-webkit-text-stroke:1px;filter:none">${svgWrap(lockH.w * 1.06, lockH.h * 1.3, G(lockH, 'full', lockH.w * 0.03, lockH.h * 0.15, lockH.w).replace(/<path /g, `<path stroke="${p.dark}" stroke-width="3" `), 'max-width:88%;max-height:74px')}</div>`],
        ['外加陰影', `<div style="filter:drop-shadow(3px 4px 2px #9AA1AB)">${base}</div>`],
        ['置於花俏底紋', `<div style="background:repeating-linear-gradient(45deg,#D8DEE6 0 8px,#F1F2F4 8px 16px);border-radius:8px;padding:4px 8px">${base}</div>`],
        ['壓縮行距重排', `<div style="transform:scaleY(1.4)">${base}</div>`]
      ];
      push('LOGO', H1('禁用範例', '以下情形一律禁止。發現誤用,依本手冊要求限期改正。', p.primary) + `
        <div class="vi-grid4" style="grid-template-columns:repeat(2,1fr);gap:12px">
          ${tiles.map(([t, inner]) => `
            <div class="vi-cell" style="position:relative;padding:10px">
              <span class="vi-x">✕</span>
              <div class="bx" style="height:86px;overflow:hidden">${inner}</div><b>${t}</b>
            </div>`).join('')}
        </div>`);
    }

    // ---- 10 色彩系統
    {
      const pms = (typeof ColorLib !== 'undefined' ? ColorLib : require('./color.js')).nearestPantone(p.primary, 3);
      const CL = typeof ColorLib !== 'undefined' ? ColorLib : require('./color.js');
      const cmyk = pms[0] ? pms[0].cmyk : CL.rgbToCmyk(...Object.values(CL.hexToRgb(p.primary)));
      const rgb = CL.hexToRgb(p.primary);
      push('COLOR', H1('色彩系統 — 主色', '主色為品牌唯一強調色。印刷以 Pantone 特別色優先;四色印刷採下表 CMYK;數位一律使用 HEX。', p.primary) + `
        <div style="height:150px;border-radius:14px;background:${p.primary};display:flex;align-items:flex-end;padding:18px">
          <span style="color:#fff;font-size:13px;font-weight:650;letter-spacing:.06em">PRIMARY ${p.primary}</span>
        </div>
        <table class="vi-kv" style="margin-top:20px">
          <tr><td>Pantone(參考)</td><td>${pms.map(x => `<b>${x.code}</b>(ΔE2000 = ${x.dE})`).join(' / ') || '—'}</td></tr>
          <tr><td>CMYK</td><td><b>C${cmyk.c} M${cmyk.m} Y${cmyk.y} K${cmyk.k}</b>(取 PMS 對照表建議值)</td></tr>
          <tr><td>RGB</td><td><b>R${rgb.r} G${rgb.g} B${rgb.b}</b></td></tr>
          <tr><td>HEX</td><td><b>${p.primary}</b></td></tr>
          <tr><td>核色程序</td><td>正式量產前以 Pantone 實體色票核對,並依「三材質打樣申請單」完成打樣簽核(ΔE ≤ 2 為合格)</td></tr>
        </table>
        <p class="vi-note" style="margin-top:12px">Pantone 對照為非官方最近色參考(依 CIEDE2000 排序)。特別色與四色印刷、不同材質之呈色本有差異,一律以簽核打樣為驗收基準。</p>`);
    }

    // ---- 10 色彩延伸
    push('COLOR', H1('色彩延伸 — 深階與中性灰', '深階僅用於雙色構成與 hover 等輔助;中性灰承擔所有版面文字與背景,不得以彩色替代。', p.primary) + `
      <div class="vi-grid4">
        ${[['深階', p.dark], ['主色', p.primary], ['淡階', p.tint], ['墨', p.ink]].map(([t, c]) => `
          <div><div style="height:74px;border-radius:10px;background:${c};border:1px solid #E4E7EB"></div>
          <div style="font-size:10.5px;margin-top:7px"><b>${t}</b> <span style="color:#737A87">${c}</span></div></div>`).join('')}
      </div>
      <div class="vi-grid4" style="margin-top:14px">
        ${[['灰 700', p.g700], ['灰 500', p.g500], ['灰 300', p.g300], ['灰 100', p.g100]].map(([t, c]) => `
          <div><div style="height:52px;border-radius:10px;background:${c};border:1px solid #E4E7EB"></div>
          <div style="font-size:10.5px;margin-top:7px"><b>${t}</b> <span style="color:#737A87">${c}</span></div></div>`).join('')}
      </div>
      <div style="margin-top:26px">
        <div style="font-size:11px;font-weight:650;margin-bottom:8px">建議用色比例</div>
        <div style="display:flex;height:26px;border-radius:8px;overflow:hidden">
          <div style="flex:6;background:#FFFFFF;border:1px solid #E4E7EB"></div>
          <div style="flex:2.5;background:${p.g100}"></div>
          <div style="flex:1;background:${p.primary}"></div>
          <div style="flex:.5;background:${p.dark}"></div>
        </div>
        <div style="display:flex;font-size:10px;color:#737A87;margin-top:6px"><span style="flex:6">白 60%</span><span style="flex:2.5">灰 25%</span><span style="flex:1">主色 10%</span><span style="flex:.5">深 5%</span></div>
      </div>`);

    // ---- 11 背景明度準則
    {
      const CL = typeof ColorLib !== 'undefined' ? ColorLib : require('./color.js');
      const steps = Array.from({ length: 10 }, (_, i) => {
        const v = Math.round(255 - i * (255 / 9));
        return CL.rgbToHex(v, v, v);
      });
      push('COLOR', H1('背景明度使用準則', '依背景明度自動判定:與主色對比 ≥ 3:1 用全彩,否則一律反白。渐層、照片等複雜底,以其最深區判定。', p.primary) + `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:14px">
          ${steps.map(bg => {
            const useFull = CL.contrast(p.primary, bg) >= 3;
            return `<div style="background:${bg};border:1px solid #E4E7EB;border-radius:9px;height:88px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
              ${svgWrap(lockM.w, lockM.h, G(lockM, useFull ? 'full' : 'paper', 0, 0, lockM.w), 'width:34px;height:34px')}
              <span style="font-size:8.5px;color:${CL.contrast(bg, '#FFFFFF') > 4 ? '#FFFFFF' : '#3E4450'}">${useFull ? '全彩' : '反白'}</span>
            </div>`;
          }).join('')}
        </div>
        <p class="vi-note" style="margin-top:16px">判定式:contrast(主色, 背景) ≥ 3.0 → 全彩;&lt; 3.0 → 反白。禁止在低對比背景上使用全彩版。</p>`);
    }

    // ---- 12 色彩模式
    push('COLOR', H1('正反白與單色', '共四種法定色彩模式;傳真、雕刻、單色印刷用「單色墨」;深色與主色底用「反白」。', p.primary) + `
      <div class="vi-grid2">
        ${[['全彩(預設)', 'full', '#FFFFFF'], ['單色墨', 'mono', '#FFFFFF'], ['反白 · 主色底', 'paper', p.primary], ['反白 · 深底', 'paper', '#191C22']].map(([t, m, bg]) => `
          <div class="vi-cell" style="background:${bg};border-color:#E4E7EB">
            <div class="bx">${svgWrap(lockH.w * 1.1, lockH.h * 1.3, G(lockH, m, lockH.w * 0.05, lockH.h * 0.15, lockH.w), 'max-width:86%')}</div>
            <b style="color:${bg === '#FFFFFF' ? '#3E4450' : '#FFFFFF'}">${t}</b>
          </div>`).join('')}
      </div>
      <p class="vi-note" style="margin-top:14px">單色模式之開孔為真實路徑鏤空(even-odd),而非白色覆蓋 —— 於任何底色皆成立。</p>`);


    // ---- 14/15 字體
    const fontPage = (title, items, note) => H1(title, '品牌指定字體;所有標誌文字皆已轉外框,不依賴字體安裝。版面文字依下表。', p.primary) +
      items.map(([name, sample, meta]) => `
        <div style="border:1px solid #E4E7EB;border-radius:12px;padding:16px 18px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:12px">${name}</b><span style="font-size:10px;color:#737A87">${meta}</span></div>
          <div style="margin-top:10px">${sample}</div>
        </div>`).join('') + `<p class="vi-note">${note}</p>`;
    {
      const GenL = typeof Gen !== 'undefined' ? Gen : require('./gen.js');
      const spec = (txt, fid, size) => {
        try {
          const t = GenL.textPath(txt, fid, size, 0.04);
          return svgWrap(t.bbox.w + 8, t.bbox.h + 8, `<g transform="translate(${4 - t.bbox.x1},${4 - t.bbox.y1})"><path fill="#14171C" fill-rule="evenodd" d="${GenL.cmdsToD(t.cmds)}"/></g>`, `height:${size * 1.15}px;width:auto;max-width:100%`);
        } catch (e) { return `<span style="font-size:${size}px">${esc(txt)}</span>`; }
      };
      if (up) {
        const d = ctx.upload || {};
        push('SOURCE', H1('來源檔案與描邊規格', '本標誌向量檔由上傳圖形描邊而得;本頁為驗收與重現之技術規格。', p.primary) + `
          <table class="vi-kv">
            <tr><td>來源檔名</td><td><b>${esc(ctx.spec.uploadName || '—')}</b></td></tr>
            <tr><td>原始尺寸</td><td>${ctx.spec.uploadW} × ${ctx.spec.uploadH} px${Math.min(ctx.spec.uploadW, ctx.spec.uploadH) < 500 ? '(解析度偏低,描邊品質受限)' : ''}</td></tr>
            <tr><td>描邊引擎</td><td>ImageTracer(公有領域 / Unlicense),本機執行</td></tr>
            <tr><td>描邊參數</td><td>${d.colors || '—'} 色 · ${({ fine: '精細', standard: '標準', smooth: '平滑' })[d.detail] || '—'}${d.removeBg ? ' · 自動去背' : ''}</td></tr>
            <tr><td>路徑節點</td><td>${d.nodes || '—'} 個指令;輪廓一律閉合,負空間 even-odd 鏤空</td></tr>
            <tr><td>品質聲明</td><td>描邊為「近似外框」,非原始幾何重建;大型輸出(10 米級)前建議以向量軟體人工精修節點。</td></tr>
          </table>`);
        push('TYPE', fontPage('版面用字',
          [['Noto Sans TC', spec('版面內文使用思源黑體,行高一點六', 'notosansR', 22), '內文 · 說明'],
           ['Poppins', spec('Latin body text 0123456789', 'poppinsR', 20), '歐文內文']],
          '標誌本體為上傳向量圖形,不依賴任何字體;本頁僅規範文件與應用之版面文字。版面字體均為 SIL OFL 1.1 授權。'));
      } else {
        push('TYPE', fontPage('中文字體',
          [[GenL.FONTS.find(f => f.id === ctx.spec.cjkFontId).label, spec('永以為好 見賢思齊 0123', ctx.spec.cjkFontId, 30), '標誌 · 標題'],
           ['Noto Sans TC Regular', spec('內文使用常規字重,行高一點六', 'notosansR', 20), '內文 · 說明']],
          '中文字體採 Noto(思源)家族,SIL OFL 1.1 授權 —— 允許商用、內嵌與轉外框,無授權金。'));
        push('TYPE', fontPage('歐文字體',
          [[GenL.FONTS.find(f => f.id === ctx.spec.latinFontId).label, spec('AaBbCc 0123456789', ctx.spec.latinFontId, 30), '標誌 · 標題'],
           ['Poppins Regular', spec('The quick brown fox 0123', 'poppinsR', 20), '內文 · 說明']],
          '歐文字體均為 Google Fonts OFL 授權;數位介面備援字體:Inter、系統無襯線。'));
      }
    }

    // ---- 16 輔助圖形
    {
      const cells = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
        const col = (r + c) % 3 === 0 ? p.primary : (r + c) % 3 === 1 ? p.tint : p.g100;
        cells.push(`<g transform="translate(${c * 90},${r * 90}) rotate(${((r + c) % 4) * 90} 40 40)">${G(lockM, 'full', 0, 0, 80).replace(/fill="[^"]*"/g, `fill="${col}"`)}</g>`);
      }
      push('GRAPHIC', H1('輔助圖形', '以標誌幾何衍生之圖紋,用於文件封面、圍籬、包裝之大面積鋪陳;不得取代標誌本身。', p.primary) +
        `<div style="border:1px solid #E4E7EB;border-radius:12px;overflow:hidden">${svgWrap(540, 170, `<rect width="540" height="170" fill="#FFFFFF"/>${cells.join('')}`)}</div>
        <table class="vi-kv" style="margin-top:18px">
          <tr><td>構成</td><td>標誌圖形以 90° 倍數旋轉陣列;色彩僅限主色 / 淡階 / 灰 100 三種</td></tr>
          <tr><td>限制</td><td>不得與標誌本體同時高密度出現;文字區上方鋪陳時,圖紋一律用淡階以下</td></tr>
        </table>`);
    }

    // ---- 17+ 應用展開(每景一頁)
    const scenes = (typeof Mockups !== 'undefined' ? Mockups : require('./mockups.js')).scenesFor(ctx.industry);
    scenes.forEach(sc => {
      let inner;
      try { inner = sc.build(ctx); } catch (e) { inner = ''; }
      push('APPLICATION', H1('應用 — ' + sc.title, `分類:${sc.category}。本頁為比例配置圖;實作尺寸與材質依採購規格,色彩依第 09 頁色彩系統。`, p.primary) +
        `<div class="vi-app-svg">${svgWrap(sc.w, sc.h, inner)}</div>
        <p class="vi-note" style="margin-top:12px">標誌一律取用向量母檔,禁止自行重繪或自點陣圖縮放。</p>`);
    });

    // ---- 檔案清單
    push('FILES', H1('交付檔案清單與命名', '所有母檔隨手冊交付;檔名規則:版型_色彩模式.副檔名。', p.primary) + `
      <table class="vi-kv">
        <tr><td>01_向量母檔/</td><td>SVG(母檔)、EPS(交換格式;Illustrator 開啟後可另存 .ai)、PNG(512–4096px 衍生)</td></tr>
        <tr><td>02_色彩定義/</td><td>色彩定義表(HTML/CSV)、三材質打樣申請單</td></tr>
        <tr><td>03_VI手冊/</td><td>本手冊(HTML 原稿;瀏覽器列印 = 向量 PDF)</td></tr>
        <tr><td>04_應用展開/</td><td>${scenes.length} 景 SVG 比例配置圖</td></tr>
        <tr><td>05_法務文件/</td><td>OFL 授權全文、字體版權宣告、資產來源清單、著作財產權轉讓切結書、AI 生成揭露</td></tr>
      </table>
      <p class="vi-note" style="margin-top:14px">${up ? '檔名代碼:logo=標誌;' : '版型代碼:h=橫式 v=直式 mark=純標誌 word=純字標;'}色彩模式:full=全彩 mono=單色墨 paper=反白 deep=深階。</p>`);

    // ---- 授權聲明
    push('LEGAL', H1('授權與版權聲明', '', p.primary) + `
      <table class="vi-kv">
        ${up ? `<tr><td>圖形元素</td><td>上傳方提供之圖形(${esc(ctx.spec.uploadName || '—')})經 ImageTracer(公有領域)向量描邊;來源圖之權利由上傳方擔保,平台未添加第三方素材。</td></tr>
        <tr><td>字體</td><td>版面文字使用 Noto Sans TC、Poppins(SIL OFL 1.1);標誌本體為向量圖形,不含任何字體軟體。</td></tr>`
      : `<tr><td>圖形元素</td><td>全部由參數化演算法生成(幾何種子 ${ctx.spec.markSeed}),無第三方圖像素材,無需外部授權。</td></tr>
        <tr><td>字體</td><td>Noto Sans/Serif TC、Poppins、Montserrat、IBM Plex Serif、Bebas Neue、Audiowide —— 均為 SIL Open Font License 1.1;允許商業使用、修改、內嵌與轉外框;標誌內文字已全數轉外框,成品不含字體軟體本體。</td></tr>`}
        <tr><td>Pantone 對照</td><td>非官方社群參考值(MIT 授權資料集);「PANTONE」為 Pantone LLC 商標,正式色號認定以實體色票為準。</td></tr>
        <tr><td>著作權</td><td>隨附「著作財產權轉讓切結書」範本;簽署後全部著作財產權歸屬甲方,乙方不行使著作人格權。</td></tr>
      </table>`);

    // ---- 封底
    push('COVER', `
      <div class="vi-cover-center">
        ${svgWrap(lockM.w, lockM.h, G(lockM, 'full', 0, 0, lockM.w), 'width:64px;height:auto')}
        <div style="font-size:10px;color:#737A87;letter-spacing:.14em">${esc(brand)} · BRAND IDENTITY GUIDELINES · 2026</div>
      </div>`);

    // ---- 組頁:回填目錄與頁碼
    const tocEntries = [];
    let lastSec = '';
    pages.forEach((pg, i) => {
      if (pg.section !== lastSec && !['COVER', 'CONTENTS'].includes(pg.section)) {
        const secZh = { 'BRAND CORE': '品牌核心', LOGO: '標誌規範', COLOR: '色彩系統', SOURCE: '來源與描邊', TYPE: '字體系統', GRAPHIC: '輔助圖形', APPLICATION: '應用展開', FILES: '檔案清單', LEGAL: '授權聲明' }[pg.section] || pg.section;
        tocEntries.push([secZh, i + 1]);
        lastSec = pg.section;
      }
    });
    const tocHtml = H1('目錄', 'CONTENTS', p.primary) + `<div class="vi-toc">
      ${tocEntries.map(([t, n]) => `<div><span class="t">${t}</span><span class="n">${String(n).padStart(2, '0')}</span></div>`).join('')}
    </div>`;
    return pages.map((pg, i) =>
      shell(i + 1, pg.section, pg.inner === '__TOC__' ? tocHtml : pg.inner, brand, p.primary));
  }

  return { buildManual, MANUAL_CSS };
});
