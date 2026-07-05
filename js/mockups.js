/* mockups.js — 全情境應用展開場景庫(20+ 項)
 * 風格鐵則:扁平、克制、無漸層無濾鏡;場景物件用灰階(g100/g300/paper),
 * 品牌色只出現在該出現的地方(logo、車身色帶、名片色塊)。
 * 品牌名稱一律用 ctx.logo() 放真向量 logo,禁止用 <text> 打品牌字。
 * 場景說明文字(標註、假內文)可用 H.text / H.par。
 *
 * ctx 合約(由 app 注入):
 *   ctx.p        — 配色 {primary,dark,tint,ink,g700,g500,g300,g100,paper,onPrimary}
 *   ctx.nameZh / ctx.nameEn / ctx.tagline / ctx.industry
 *   ctx.logo(layout, mode, x, y, targetW) → '<g …>…</g>' 已定位縮放的向量 logo
 *       layout: 'horizontal'|'vertical'|'mark'|'wordmark'
 *       mode:   'full'(彩色)|'mono'(單色墨)|'paper'(反白)
 *   ctx.logoH(layout, targetW) → 該版型在 targetW 寬時的實際高(供排版)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mockups = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // ---------- 繪圖 helpers ----------
  const H = {
    rr: (x, y, w, h, r, fill, extra) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra ? ' ' + extra : ''}/>`,
    circle: (cx, cy, r, fill, extra) =>
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra ? ' ' + extra : ''}/>`,
    line: (x1, y1, x2, y2, stroke, w) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w || 1}"/>`,
    poly: (pts, fill, extra) =>
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}"${extra ? ' ' + extra : ''}/>`,
    path: (d, fill, extra) => `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`,
    // 場景文字(標註/假內容)。family 固定 UI 字體。
    text: (x, y, str, size, fill, o) => {
      const opt = o || {};
      return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"` +
        ` font-family="Inter,'Noto Sans TC','Microsoft JhengHei',sans-serif"` +
        (opt.weight ? ` font-weight="${opt.weight}"` : '') +
        (opt.anchor ? ` text-anchor="${opt.anchor}"` : '') +
        (opt.ls ? ` letter-spacing="${opt.ls}"` : '') +
        `>${esc(str)}</text>`;
    },
    // 假段落:一組灰線代表文字
    par: (x, y, w, lines, gap, stroke) => {
      let s = '';
      for (let i = 0; i < lines; i++) {
        const ww = i === lines - 1 ? w * 0.62 : w;
        s += `<rect x="${x}" y="${y + i * gap}" width="${ww}" height="4" rx="2" fill="${stroke}"/>`;
      }
      return s;
    },
    // 工程尺寸標註線(兩端刻度 + 中央標籤)
    dim: (x1, y1, x2, y2, label, color) => {
      const c = color || '#737A87';
      const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
      const tick = vertical
        ? `<line x1="${x1 - 5}" y1="${y1}" x2="${x1 + 5}" y2="${y1}" stroke="${c}"/>` +
          `<line x1="${x2 - 5}" y1="${y2}" x2="${x2 + 5}" y2="${y2}" stroke="${c}"/>`
        : `<line x1="${x1}" y1="${y1 - 5}" x2="${x1}" y2="${y1 + 5}" stroke="${c}"/>` +
          `<line x1="${x2}" y1="${y2 - 5}" x2="${x2}" y2="${y2 + 5}" stroke="${c}"/>`;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const lbl = vertical
        ? H.text(mx + 9, my + 3, label, 11, c)
        : H.text(mx, my - 7, label, 11, c, { anchor: 'middle' });
      return `<g>${H.line(x1, y1, x2, y2, c, 1)}${tick}${lbl}</g>`;
    },
    // 場景底板(統一淺灰工作台)
    board: (w, h, fill) => `<rect width="${w}" height="${h}" fill="${fill || '#F1F2F4'}"/>`,
    // 陰影墊片(扁平風:實色淺灰,不用 blur)
    pad: (x, y, w, h, r) => `<rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" rx="${r}" fill="#DDE1E6"/>`
  };

  // ---------- 場景 ----------
  // 每項:{id, title, category, w, h, build(ctx)→inner-SVG字串}
  // category ∈ 事務用品 | 車輛塗裝 | 制服配件 | 數位介面 | 環境識別 | 週邊
  const SCENES = [

    { id: 'bizcard-front', title: '名片(正面)', category: '事務用品', w: 900, h: 620,
      build(ctx) {
        const p = ctx.p;
        // 名片 90×54mm → 630×378
        const x = 135, y = 105, w = 630, h = 378;
        return H.board(900, 620) + H.pad(x, y, w, h, 10) +
          H.rr(x, y, w, h, 10, p.paper) +
          H.rr(x, y + h - 14, w, 14, 0, p.primary) +
          ctx.logo('horizontal', 'full', x + 44, y + 48, 236) +
          H.par(x + 44, y + 210, 200, 3, 16, '#C7CCD4') +
          H.text(x + 44, y + 300, '總經理', 15, p.g700, { weight: 600 }) +
          H.text(x + 44, y + 326, '02-2700-0000 · service@example.com.tw', 13, p.g500) +
          H.dim(x, y + h + 28, x + w, y + h + 28, '90 mm', p.g500) +
          H.dim(x - 28, y, x - 28, y + h, '54 mm', p.g500);
      } },

    { id: 'app-icon', title: 'App Icon(iOS / Android)', category: '數位介面', w: 900, h: 620,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(900, 620);
        // iOS 超橢圓(圓角 22.37%)
        const S1 = 240, x1 = 130, y1 = 130;
        s += H.pad(x1, y1, S1, S1, S1 * 0.2237) + H.rr(x1, y1, S1, S1, S1 * 0.2237, p.primary);
        const m1 = S1 * 0.56;
        s += ctx.logo('mark', 'paper', x1 + (S1 - m1) / 2, y1 + (S1 - m1) / 2, m1);
        s += H.text(x1 + S1 / 2, y1 + S1 + 34, 'iOS 1024×1024', 14, p.g700, { anchor: 'middle' });
        // Android 圓形遮罩
        const x2 = 530, y2 = 130;
        s += `<circle cx="${x2 + S1 / 2 + 4}" cy="${y2 + S1 / 2 + 5}" r="${S1 / 2}" fill="#DDE1E6"/>`;
        s += H.circle(x2 + S1 / 2, y2 + S1 / 2, S1 / 2, p.primary);
        s += ctx.logo('mark', 'paper', x2 + (S1 - m1) / 2, y2 + (S1 - m1) / 2, m1);
        s += H.text(x2 + S1 / 2, y2 + S1 + 34, 'Android Adaptive 512×512', 14, p.g700, { anchor: 'middle' });
        // 尺寸階梯
        const sizes = [[180, '180'], [120, '120'], [80, '80'], [48, '48']];
        let sx = 150;
        for (const [sz, lbl] of sizes) {
          const yy = 470 - sz / 2;
          s += H.rr(sx, yy, sz, sz, sz * 0.2237, p.primary);
          const mm = sz * 0.56;
          s += ctx.logo('mark', 'paper', sx + (sz - mm) / 2, yy + (sz - mm) / 2, mm);
          s += H.text(sx + sz / 2, 470 + sz / 2 + 22, lbl + 'px', 12, p.g500, { anchor: 'middle' });
          sx += sz + 52;
        }
        return s;
      } },

    { id: 'truck', title: '工程貨車塗裝(側視)', category: '車輛塗裝', w: 960, h: 540,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 540);
        s += H.line(80, 430, 880, 430, '#C7CCD4', 2); // 地面
        // 貨廂
        s += H.rr(140, 130, 470, 250, 8, p.paper, `stroke="#C7CCD4" stroke-width="2"`);
        // 車頭
        s += H.path('M640 380 L640 190 Q640 172 658 172 L735 172 Q752 172 762 186 L806 258 Q812 266 812 276 L812 380 Z', p.g300);
        s += H.rr(660, 196, 82, 62, 6, '#E8EBEF'); // 車窗
        // 車身品牌色帶
        s += H.rr(140, 330, 470, 50, 0, p.primary);
        s += H.rr(640, 330, 172, 50, 0, p.dark);
        // 輪
        for (const wx of [235, 330, 700]) {
          s += H.circle(wx, 430, 46, '#2A2E35') + H.circle(wx, 430, 20, '#C7CCD4');
        }
        // 貨廂 logo(橫式,置中)
        const lw = 300;
        const lh = ctx.logoH('horizontal', lw);
        s += ctx.logo('horizontal', 'full', 225, 230 - lh / 2, lw);
        // 車門小標
        s += ctx.logo('mark', 'paper', 664, 286, 34);
        s += H.dim(140, 470, 812, 470, '全長參考 6.2 m(比例 1:24)', p.g500);
        return s;
      } },

    // ===== 事務用品 =====

    { id: 'bizcard-back', title: '名片(反面)', category: '事務用品', w: 900, h: 620,
      build(ctx) {
        const p = ctx.p;
        const x = 135, y = 105, w = 630, h = 378;
        let s = H.board(900, 620) + H.pad(x, y, w, h, 10);
        s += H.rr(x, y, w, h, 10, p.primary);
        const mw = 92;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'paper', x + w / 2 - mw / 2, y + 108 - mh / 2, mw);
        s += H.text(x + w / 2, y + 196, ctx.tagline || '專業 可靠 準時', 15, p.onPrimary, { anchor: 'middle', ls: 1 });
        s += H.line(x + w / 2 - 70, y + 224, x + w / 2 + 70, y + 224, 'rgba(255,255,255,0.35)', 1);
        s += H.text(x + w / 2, y + 262, 'www.example.com.tw', 13, p.onPrimary, { anchor: 'middle' });
        s += H.text(x + w / 2, y + 320, ctx.nameZh || '品牌名稱', 13, p.onPrimary, { anchor: 'middle', weight: 600, ls: 2 });
        s += H.dim(x, y + h + 28, x + w, y + h + 28, '90 mm', p.g500);
        s += H.dim(x - 28, y, x - 28, y + h, '54 mm', p.g500);
        return s;
      } },

    { id: 'letterhead', title: '信紙(A4)', category: '事務用品', w: 760, h: 980,
      build(ctx) {
        const p = ctx.p;
        const x = 80, y = 60, w = 600, h = 848;
        let s = H.board(760, 980) + H.pad(x, y, w, h, 4) + H.rr(x, y, w, h, 4, p.paper);
        const lw = 168;
        s += ctx.logo('horizontal', 'full', x + 56, y + 54, lw);
        s += H.text(x + w - 56, y + 62, ctx.nameEn || 'Company Ltd.', 11, p.g500, { anchor: 'end' });
        s += H.text(x + w - 56, y + 80, 'www.example.com.tw', 11, p.g500, { anchor: 'end' });
        s += H.rr(x + 56, y + 148, w - 112, 2, 0, p.primary);
        s += H.text(x + 56, y + 208, '2026 年 7 月 5 日', 13, p.g700);
        s += H.par(x + 56, y + 246, w - 112, 3, 26, p.g300);
        s += H.par(x + 56, y + 344, w - 112, 5, 26, p.g300);
        s += H.par(x + 56, y + 492, w - 112, 4, 26, p.g300);
        s += H.text(x + 56, y + 656, '敬祝　商祺', 13, p.g700);
        s += H.text(x + 56, y + 706, ctx.nameZh || '公司名稱', 14, p.g700, { weight: 600 });
        s += H.rr(x + 56, y + h - 86, w - 112, 2, 0, p.g300);
        s += H.text(x + w / 2, y + h - 56, (ctx.nameZh || '') + ' · ' + (ctx.tagline || ''), 11, p.g500, { anchor: 'middle' });
        s += H.dim(x, y + h + 26, x + w, y + h + 26, '210 mm', p.g500);
        s += H.dim(x + w + 20, y, x + w + 20, y + h, '297 mm', p.g500);
        return s;
      } },

    { id: 'envelope', title: '西式信封', category: '事務用品', w: 900, h: 620,
      build(ctx) {
        const p = ctx.p;
        const x = 170, y = 170, w = 560, h = 280;
        let s = H.board(900, 620) + H.pad(x, y, w, h, 6);
        s += H.rr(x, y, w, h, 6, p.paper);
        s += H.poly([[x, y], [x + w, y], [x + w / 2, y + h * 0.42]], p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        const lw = 148;
        s += ctx.logo('horizontal', 'full', x + 40, y + h * 0.58, lw);
        s += H.rr(x + w - 100, y + 28, 68, 50, 2, p.g100, `stroke="${p.g300}" stroke-width="1"`);
        s += H.par(x + w * 0.46, y + h * 0.56, 220, 4, 24, p.g300);
        s += H.dim(x, y + h + 34, x + w, y + h + 34, 'DL 220×110 mm', p.g500);
        return s;
      } },

    { id: 'folder', title: '資料夾', category: '事務用品', w: 900, h: 620,
      build(ctx) {
        const p = ctx.p;
        const x = 210, y = 90, w = 480, h = 440;
        let s = H.board(900, 620) + H.pad(x, y, w, h, 10);
        s += H.rr(x, y, w, h, 10, p.g100);
        s += H.poly([[x, y + h * 0.72], [x + w, y + h * 0.8], [x + w, y + h], [x, y + h]], p.g300);
        const lw = 240;
        const lh = ctx.logoH('horizontal', lw);
        s += ctx.logo('horizontal', 'full', x + w / 2 - lw / 2, y + 130 - lh / 2, lw);
        s += H.text(x + w / 2, y + 200, ctx.tagline || '安全 準時 值得信賴', 14, p.g500, { anchor: 'middle', ls: 1 });
        s += H.pad(x + 26, y + h - 106, 116, 74, 4);
        s += H.rr(x + 26, y + h - 106, 116, 74, 4, p.paper, `stroke="${p.g300}" stroke-width="1"`);
        s += ctx.logo('mark', 'full', x + 26 + 14, y + h - 106 + 14, 30);
        s += H.par(x + 26 + 54, y + h - 106 + 24, 50, 2, 14, p.g300);
        s += H.text(x + w / 2, y + h + 40, '簡報 / 提案資料夾(內附口袋)', 13, p.g500, { anchor: 'middle' });
        return s;
      } },

    { id: 'id-badge', title: '識別證(掛繩)', category: '事務用品', w: 700, h: 900,
      build(ctx) {
        const p = ctx.p;
        const cx = 350;
        let s = H.board(700, 900);
        s += H.rr(cx - 23, 40, 46, 130, 0, p.primary);
        s += H.rr(cx - 16, 168, 32, 18, 4, p.g500);
        const x = 205, y = 196, w = 290, h = 456;
        s += H.pad(x, y, w, h, 14);
        s += H.rr(x, y, w, h, 14, p.paper);
        s += H.circle(cx, y + 22, 7, p.g100);
        const mw = 40;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'full', cx - mw / 2, y + 46 - mh / 2 + 20, mw);
        s += H.rr(x + 40, y + 116, w - 80, 176, 6, p.g100);
        s += H.circle(cx, y + 168, 34, p.g300);
        s += H.poly([[cx - 46, y + 268], [cx + 46, y + 268], [cx + 30, y + 230], [cx - 30, y + 230]], p.g300);
        s += H.text(cx, y + 340, '王小明', 17, p.g700, { anchor: 'middle', weight: 600 });
        s += H.text(cx, y + 366, '工程部 · 專案經理', 12, p.g500, { anchor: 'middle' });
        s += H.rr(x, y + h - 14, w, 14, 0, p.primary);
        s += H.dim(x, y + h + 30, x + w, y + h + 30, '85×54 mm', p.g500);
        return s;
      } },

    // ===== 車輛塗裝 =====

    { id: 'van', title: '廂型車(側視)', category: '車輛塗裝', w: 960, h: 540,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 540);
        s += H.line(80, 430, 880, 430, p.g300, 2);
        s += H.rr(130, 200, 560, 210, 16, p.paper, `stroke="${p.g300}" stroke-width="2"`);
        s += H.path('M690 200 L742 200 Q758 200 766 214 L800 288 Q806 298 806 310 L806 410 L690 410 Z', p.g300);
        s += H.rr(716, 224, 74, 58, 6, '#E8EBEF');
        s += H.rr(130, 330, 560, 50, 0, p.primary);
        s += H.rr(690, 330, 116, 50, 0, p.dark);
        s += H.line(430, 210, 430, 380, p.g300, 2);
        s += H.rr(414, 288, 22, 8, 2, p.g500);
        for (const wx of [250, 630]) {
          s += H.circle(wx, 430, 46, '#2A2E35') + H.circle(wx, 430, 20, p.g300);
        }
        const lw = 260;
        const lh = ctx.logoH('horizontal', lw);
        s += ctx.logo('horizontal', 'full', 300 - lw / 2, 265 - lh / 2, lw);
        s += ctx.logo('mark', 'full', 388, 260, 30);
        s += H.dim(130, 470, 806, 470, '全長參考 5.2 m(比例 1:24)', p.g500);
        return s;
      } },

    { id: 'sedan', title: '公務轎車(車門標)', category: '車輛塗裝', w: 960, h: 540,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 540);
        s += H.line(80, 430, 880, 430, p.g300, 2);
        s += H.rr(140, 340, 660, 70, 14, p.paper, `stroke="${p.g300}" stroke-width="2"`);
        s += H.poly([[260, 340], [300, 270], [560, 270], [610, 340]], p.paper, `stroke="${p.g300}" stroke-width="2"`);
        s += H.poly([[290, 335], [318, 285], [555, 285], [585, 335]], '#E8EBEF');
        s += H.line(430, 285, 430, 335, p.g300, 2);
        for (const wx of [260, 640]) {
          s += H.circle(wx, 430, 44, '#2A2E35') + H.circle(wx, 430, 19, p.g300);
        }
        s += ctx.logo('mark', 'full', 336, 362, 28);
        s += H.line(360, 366, 700, 190, '#9AA1AC', 1.5);
        s += H.circle(760, 140, 70, p.paper, `stroke="${p.g300}" stroke-width="2"`);
        const mw = 78;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'full', 760 - mw / 2, 140 - mh / 2, mw);
        s += H.dim(690, 224, 830, 224, '標準貼牌 120 mm', p.g500);
        s += H.dim(140, 470, 800, 470, '全長參考 4.8 m(比例 1:24)', p.g500);
        return s;
      } },

    // ===== 制服配件 =====

    { id: 'polo', title: 'POLO 衫', category: '制服配件', w: 900, h: 720,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(900, 720);
        s += H.pad(340, 220, 220, 380, 14);
        s += H.rr(340, 220, 220, 380, 14, p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        s += H.poly([[340, 240], [260, 260], [250, 340], [300, 350], [340, 320]], p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        s += H.poly([[560, 240], [640, 260], [650, 340], [600, 350], [560, 320]], p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        s += H.poly([[400, 220], [430, 190], [440, 222], [420, 236]], p.g100, `stroke="${p.g300}" stroke-width="1"`);
        s += H.poly([[500, 220], [470, 190], [460, 222], [480, 236]], p.g100, `stroke="${p.g300}" stroke-width="1"`);
        s += H.rr(444, 220, 12, 60, 0, p.paper, `stroke="${p.g300}" stroke-width="1"`);
        s += H.circle(450, 246, 3, p.g500) + H.circle(450, 268, 3, p.g500);
        s += H.rr(396, 214, 54, 6, 3, p.primary);
        s += H.rr(250, 342, 54, 8, 3, p.primary);
        s += H.rr(596, 342, 54, 8, 3, p.primary);
        const mw = 42;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'mono', 478, 268 - mh / 2 + 21, mw);
        s += H.text(450, 660, 'POLO 衫(丈青 / 石墨 二色)', 14, p.g700, { anchor: 'middle' });
        s += H.text(450, 686, '左胸繡花 · 40 mm 寬', 12, p.g500, { anchor: 'middle' });
        return s;
      } },

    { id: 'vest', title: '工程反光背心', category: '制服配件', w: 900, h: 720, only: ['工程營造', '環保能源', '物流運輸'],
      build(ctx) {
        const p = ctx.p;
        let s = H.board(900, 720);
        s += H.pad(360, 150, 200, 470, 20);
        s += H.rr(360, 150, 200, 470, 20, p.primary);
        s += H.circle(460, 150, 26, p.g100);
        s += H.circle(360, 260, 50, p.g100);
        s += H.circle(560, 260, 50, p.g100);
        s += H.rr(430, 150, 14, 190, 0, p.paper);
        s += H.rr(502, 150, 14, 190, 0, p.paper);
        s += H.rr(360, 340, 200, 24, 0, p.paper);
        s += H.rr(360, 430, 200, 24, 0, p.paper);
        const mw = 44;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'paper', 460 - mw / 2, 397 - mh / 2, mw);
        s += H.text(460, 660, '工程反光背心(可依規範加大反光導條)', 13, p.g700, { anchor: 'middle' });
        return s;
      } },

    { id: 'helmet', title: '工程安全帽', category: '制服配件', w: 900, h: 620, only: ['工程營造', '環保能源'],
      build(ctx) {
        const p = ctx.p;
        let s = H.board(900, 620);
        s += `<ellipse cx="450" cy="466" rx="150" ry="14" fill="#DDE1E6"/>`;
        s += H.path('M310 320 A140 140 0 0 1 590 320 Z', p.primary);
        s += `<ellipse cx="330" cy="322" rx="90" ry="18" fill="${p.dark}"/>`;
        s += H.circle(410, 198, 8, p.paper) + H.circle(450, 188, 8, p.paper) + H.circle(490, 198, 8, p.paper);
        s += H.circle(580, 308, 14, p.dark) + H.circle(580, 308, 5, p.g500);
        const mw = 34;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'paper', 486 - mw / 2, 258 - mh / 2, mw);
        s += H.text(450, 520, '工程安全帽(側視)', 15, p.g700, { anchor: 'middle', weight: 600 });
        s += H.text(450, 546, 'ABS 殼體 · 側邊單色貼牌', 12, p.g500, { anchor: 'middle' });
        return s;
      } },

    // ===== 數位介面 =====

    { id: 'favicon-browser', title: '瀏覽器分頁 favicon', category: '數位介面', w: 900, h: 420,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(900, 420);
        s += H.rr(60, 50, 760, 70, 10, p.g300);
        s += H.rr(320, 54, 220, 56, 10, p.g300);
        const mw2 = 24;
        const mh2 = ctx.logoH('mark', mw2);
        s += ctx.logo('mark', 'mono', 340, 82 - mh2 / 2, mw2);
        s += H.text(374, 87, '其他分頁', 13, p.g500);
        s += H.rr(90, 44, 220, 66, 10, p.paper);
        const mw1 = 26;
        const mh1 = ctx.logoH('mark', mw1);
        s += ctx.logo('mark', 'full', 110, 77 - mh1 / 2, mw1);
        s += H.text(146, 82, ctx.nameZh || '品牌名稱', 13, p.g700, { weight: 600 });
        s += H.rr(90, 132, 700, 40, 8, p.paper, `stroke="${p.g300}" stroke-width="1"`);
        s += H.text(112, 157, 'https://www.example.com.tw', 13, p.g500);
        s += H.rr(90, 196, 700, 150, 8, p.g100);
        s += H.par(115, 230, 400, 3, 26, p.g300);
        s += H.text(450, 396, '標準 favicon 尺寸:16 / 32 / 48 px(以上為視覺放大示意)', 13, p.g500, { anchor: 'middle' });
        return s;
      } },

    { id: 'website-hero', title: '官網首頁 hero', category: '數位介面', w: 960, h: 640,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 640);
        s += H.pad(60, 40, 840, 560, 12);
        s += H.rr(60, 40, 840, 560, 12, p.paper, `stroke="${p.g300}" stroke-width="1"`);
        s += H.rr(60, 40, 840, 44, 0, p.g100);
        s += H.circle(84, 62, 5, p.g500) + H.circle(102, 62, 5, p.g300) + H.circle(120, 62, 5, p.g300);
        s += ctx.logo('horizontal', 'full', 100, 108, 140);
        for (const nx of [600, 668, 736]) s += H.rr(nx, 122, 50, 14, 7, p.g300);
        s += H.rr(806, 108, 94, 32, 16, p.primary);
        s += H.text(853, 129, '洽詢', 13, p.onPrimary, { anchor: 'middle', weight: 600 });
        s += H.text(100, 286, '打造值得信賴的', 38, p.g700, { weight: 700 });
        s += H.text(100, 334, '品牌識別系統', 38, p.g700, { weight: 700 });
        s += H.par(100, 372, 360, 3, 24, p.g300);
        s += H.rr(100, 440, 160, 50, 8, p.primary);
        s += H.text(180, 470, '立即詢價', 14, p.onPrimary, { anchor: 'middle', weight: 600 });
        s += H.rr(280, 440, 140, 50, 8, p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        s += H.text(350, 470, '了解更多', 14, p.g700, { anchor: 'middle' });
        s += H.rr(560, 260, 300, 260, 16, p.g100);
        const mw = 96;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'mono', 710 - mw / 2, 390 - mh / 2, mw);
        return s;
      } },

    { id: 'presentation', title: '簡報封面(16:9)', category: '數位介面', w: 960, h: 580,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 580, p.dark);
        s += H.poly([[960, 580], [960, 360], [660, 580]], p.primary);
        s += H.text(90, 250, ctx.nameZh || '品牌識別', 44, p.onPrimary, { weight: 700 });
        s += H.text(90, 300, '應用展開提案', 26, p.onPrimary, { weight: 400 });
        s += H.text(90, 344, '2026 年度 · 品牌識別系統', 14, p.onPrimary, { ls: 1 });
        const lw = 168;
        s += ctx.logo('horizontal', 'paper', 70, 480, lw);
        s += H.text(890, 66, '01', 14, p.onPrimary, { anchor: 'end' });
        return s;
      } },

    { id: 'email-sig', title: '電子郵件簽名檔', category: '數位介面', w: 900, h: 420,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(900, 420);
        s += H.pad(60, 40, 780, 340, 10);
        s += H.rr(60, 40, 780, 340, 10, p.paper, `stroke="${p.g300}" stroke-width="1"`);
        s += H.rr(60, 40, 780, 36, 0, p.g100);
        s += H.circle(82, 58, 5, p.g500) + H.circle(100, 58, 5, p.g300) + H.circle(118, 58, 5, p.g300);
        s += H.text(500, 63, '回覆:年度採購提案', 12, p.g500, { anchor: 'middle' });
        s += H.par(100, 116, 640, 4, 22, p.g300);
        s += H.line(100, 224, 740, 224, p.g300, 1);
        const mw = 46;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'full', 100, 250 - mh / 2 + 23, mw);
        s += H.text(168, 250, ctx.nameZh ? '王小明' : '王小明', 15, p.g700, { weight: 600 });
        s += H.text(168, 270, '業務部 · 協理', 12, p.g500);
        s += H.text(168, 292, ctx.nameEn || 'Company Ltd.', 12, p.g500);
        s += H.text(168, 312, '02-2700-0000 · service@example.com.tw', 12, p.g500);
        for (const cx of [560, 594, 628]) s += H.circle(cx, 300, 12, p.g100, `stroke="${p.g300}" stroke-width="1"`);
        return s;
      } },

    { id: 'social-avatar', title: '社群頭像+封面', category: '數位介面', w: 960, h: 540,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 540);
        s += H.rr(120, 60, 720, 220, 12, p.primary);
        s += `<g opacity="0.14">${ctx.logo('mark', 'paper', 700, 40, 220)}</g>`;
        s += H.circle(220, 280, 70, p.paper);
        s += H.circle(220, 280, 64, p.primary);
        const mw = 62;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'paper', 220 - mw / 2, 280 - mh / 2, mw);
        s += H.text(220, 388, ctx.nameZh || '品牌名稱', 18, p.g700, { anchor: 'middle', weight: 600 });
        s += H.text(220, 412, '@' + (ctx.nameEn || 'brand').replace(/\s+/g, '').toLowerCase(), 13, p.g500, { anchor: 'middle' });
        let sx = 360;
        for (const [num, lbl] of [['1.2k', '貼文'], ['8.4k', '追蹤者'], ['320', '追蹤中']]) {
          s += H.text(sx, 400, num, 15, p.g700, { anchor: 'middle', weight: 600 });
          s += H.text(sx, 420, lbl, 11, p.g500, { anchor: 'middle' });
          sx += 90;
        }
        return s;
      } },

    // ===== 環境識別 =====

    { id: 'signboard', title: '建築立面招牌', category: '環境識別', w: 960, h: 620,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 620);
        s += H.line(60, 560, 900, 560, p.g300, 2);
        s += H.rr(140, 120, 680, 440, 0, '#E3E6EA');
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 4; col++) {
            s += H.rr(190 + col * 156, 150 + row * 60, 92, 40, 2, p.paper, `stroke="${p.g300}" stroke-width="1"`);
          }
        }
        s += H.rr(220, 480, 100, 80, 2, p.g300);
        s += H.rr(200, 344, 20, 16, 2, p.g500);
        s += H.rr(740, 344, 20, 16, 2, p.g500);
        s += `<ellipse cx="480" cy="566" rx="200" ry="10" fill="#DDE1E6"/>`;
        s += H.rr(200, 350, 560, 90, 6, p.primary);
        const lw = 320;
        const lh = ctx.logoH('horizontal', lw);
        s += ctx.logo('horizontal', 'paper', 480 - lw / 2, 395 - lh / 2, lw);
        s += H.text(480, 594, '建築立面招牌(單面自發光可選)', 13, p.g500, { anchor: 'middle' });
        return s;
      } },

    { id: 'flag', title: '桅旗', category: '環境識別', w: 700, h: 900,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(700, 900);
        s += `<ellipse cx="350" cy="822" rx="70" ry="12" fill="#DDE1E6"/>`;
        s += H.poly([[300, 780], [400, 780], [382, 820], [318, 820]], p.g300);
        s += H.rr(346, 60, 8, 720, 0, p.g500);
        s += H.poly([[350, 80], [350, 650], [365, 648], [430, 560], [452, 430], [440, 280], [380, 140], [358, 85]], p.primary);
        const lw = 108;
        const lh = ctx.logoH('vertical', lw);
        s += ctx.logo('vertical', 'paper', 398 - lw / 2, 300 - lh / 2, lw);
        s += H.text(350, 860, '桅旗(滌綸旗布 · 雙面印刷)', 13, p.g500, { anchor: 'middle' });
        return s;
      } },

    { id: 'hoarding', title: '施工圍籬', category: '環境識別', w: 960, h: 540, only: ['工程營造'],
      build(ctx) {
        const p = ctx.p;
        let s = H.board(960, 540);
        s += H.line(40, 500, 920, 500, p.g300, 2);
        s += H.pad(60, 160, 840, 280, 0);
        s += H.rr(60, 160, 840, 280, 0, p.paper, `stroke="${p.g300}" stroke-width="2"`);
        s += H.line(340, 160, 340, 440, p.g300, 2);
        s += H.line(620, 160, 620, 440, p.g300, 2);
        const lw = 168;
        const lh = ctx.logoH('horizontal', lw);
        for (const px of [200, 480, 760]) {
          s += ctx.logo('horizontal', 'full', px - lw / 2, 300 - lh / 2, lw);
        }
        for (let i = 0; i <= 19; i++) {
          const x0 = 60 + i * 40;
          s += H.poly([[x0, 480], [x0 + 30, 480], [x0 + 70, 440], [x0 + 40, 440]], i % 2 === 0 ? p.primary : p.paper);
        }
        s += H.rr(60, 440, 840, 40, 0, 'none', `stroke="${p.g300}" stroke-width="2"`);
        s += H.text(480, 60, '施工圍籬(單元版 3m×2m,可重複延伸)', 14, p.g700, { anchor: 'middle' });
        return s;
      } },

    { id: 'reception', title: '接待背牆', category: '環境識別', w: 960, h: 620,
      build(ctx) {
        const p = ctx.p;
        let s = `<rect width="960" height="620" fill="${p.g100}"/>`;
        s += H.rr(0, 0, 960, 480, 0, p.primary);
        s += H.rr(0, 480, 960, 140, 0, '#E3E6EA');
        s += H.line(0, 480, 960, 480, p.dark, 2);
        const lw = 340;
        const lh = ctx.logoH('horizontal', lw);
        s += ctx.logo('horizontal', 'paper', 480 - lw / 2, 190 - lh / 2, lw);
        s += H.text(480, 268, (ctx.tagline || '安全 準時 值得信賴').toUpperCase(), 14, p.onPrimary, { anchor: 'middle', ls: 3 });
        s += H.pad(240, 410, 480, 130, 6);
        s += H.rr(240, 410, 480, 26, 4, '#E3E6EA');
        s += H.rr(260, 430, 440, 110, 8, p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        const mw = 40;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'mono', 480 - mw / 2, 470 - mh / 2, mw);
        s += H.text(480, 600, '接待背牆(建議搭配立體字或發光字施作)', 13, p.g500, { anchor: 'middle' });
        return s;
      } },

    // ===== 週邊 =====

    { id: 'tote', title: '帆布提袋', category: '週邊', w: 800, h: 800,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(800, 800);
        s += H.pad(240, 200, 320, 440, 20);
        s += H.rr(286, 110, 24, 95, 12, p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        s += H.rr(494, 110, 24, 95, 12, p.paper, `stroke="${p.g300}" stroke-width="1.5"`);
        s += H.poly([[230, 200], [570, 200], [540, 640], [260, 640]], p.paper, `stroke="${p.g300}" stroke-width="2"`);
        s += H.line(262, 600, 538, 600, p.g300, 1);
        const mw = 200;
        const mh = ctx.logoH('mark', mw);
        s += ctx.logo('mark', 'full', 400 - mw / 2, 380 - mh / 2, mw);
        s += H.text(400, 700, '帆布提袋(丈青帆布 · 單色印刷)', 14, p.g700, { anchor: 'middle' });
        return s;
      } },

    { id: 'cup', title: '紙杯', category: '週邊', w: 700, h: 800,
      build(ctx) {
        const p = ctx.p;
        let s = H.board(700, 800);
        s += H.pad(214, 204, 272, 446, 8);
        s += H.poly([[220, 220], [480, 220], [440, 650], [260, 650]], p.paper, `stroke="${p.g300}" stroke-width="2"`);
        s += H.poly([[235, 380], [465, 380], [452, 520], [248, 520]], p.primary);
        const lw = 140;
        const lh = ctx.logoH('horizontal', lw);
        s += ctx.logo('horizontal', 'paper', 350 - lw / 2, 450 - lh / 2, lw);
        s += `<ellipse cx="350" cy="650" rx="90" ry="14" fill="${p.g300}"/>`;
        s += `<ellipse cx="350" cy="220" rx="130" ry="18" fill="${p.g100}" stroke="${p.g300}" stroke-width="1"/>`;
        s += `<ellipse cx="350" cy="205" rx="134" ry="16" fill="${p.paper}" stroke="${p.g300}" stroke-width="1"/>`;
        s += H.text(350, 730, '紙杯(12oz 雙層防燙)', 14, p.g700, { anchor: 'middle' });
        return s;
      } }

  ];

  // 依產業過濾:帶 only 標記的場景只給對口產業(精品工作室不需要安全帽)
  function scenesFor(industry) {
    return SCENES.filter(sc => !sc.only || sc.only.includes(industry));
  }

  return { SCENES, scenesFor, H };
});
