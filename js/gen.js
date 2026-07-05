/* gen.js — 向量標誌生成引擎
 * 核心原則:所有幾何一律是「閉合路徑」;文字經 opentype.js 真轉外框;
 * 開孔(負空間)用 even-odd 單一路徑實作,單色/反白版不會破。
 * 路徑指令統一 M/L/C/Z(Q 一律升階為 C,EPS 匯出才有原生對應)。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('opentype.js'), require('./color.js'));
  else root.Gen = factory(root.opentype, root.ColorLib);
})(typeof self !== 'undefined' ? self : this, function (opentype, ColorLib) {
  'use strict';

  // ---------- RNG ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const rand = (rng, lo, hi) => lo + rng() * (hi - lo);

  // ---------- 路徑基礎 ----------
  const KAPPA = 0.5522847498307936;

  function cmdsToD(cmds, dp) {
    const p = dp === undefined ? 2 : dp;
    const f = n => +n.toFixed(p);
    return cmds.map(c =>
      c.type === 'M' ? `M${f(c.x)} ${f(c.y)}` :
      c.type === 'L' ? `L${f(c.x)} ${f(c.y)}` :
      c.type === 'C' ? `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}` :
      'Z').join('');
  }

  // opentype path → 標準化 cmds(Q→C、每個輪廓補 Z)
  function fromFontPath(otCmds) {
    const out = [];
    let cx = 0, cy = 0, open = false;
    for (const c of otCmds) {
      if (c.type === 'M') {
        if (open) out.push({ type: 'Z' });
        out.push({ type: 'M', x: c.x, y: c.y }); cx = c.x; cy = c.y; open = true;
      } else if (c.type === 'L') {
        out.push({ type: 'L', x: c.x, y: c.y }); cx = c.x; cy = c.y;
      } else if (c.type === 'C') {
        out.push({ type: 'C', x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, x: c.x, y: c.y }); cx = c.x; cy = c.y;
      } else if (c.type === 'Q') {
        out.push({
          type: 'C',
          x1: cx + 2 / 3 * (c.x1 - cx), y1: cy + 2 / 3 * (c.y1 - cy),
          x2: c.x + 2 / 3 * (c.x1 - c.x), y2: c.y + 2 / 3 * (c.y1 - c.y),
          x: c.x, y: c.y
        }); cx = c.x; cy = c.y;
      } else if (c.type === 'Z') {
        out.push({ type: 'Z' }); open = false;
      }
    }
    if (open) out.push({ type: 'Z' });
    return out;
  }

  function bboxOf(cmds) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, px = 0, py = 0;
    const acc = (x, y) => { if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y; };
    for (const c of cmds) {
      if (c.type === 'M' || c.type === 'L') { acc(c.x, c.y); px = c.x; py = c.y; }
      else if (c.type === 'C') {
        for (let t = 0.1; t < 1; t += 0.15) {
          const mt = 1 - t;
          acc(mt * mt * mt * px + 3 * mt * mt * t * c.x1 + 3 * mt * t * t * c.x2 + t * t * t * c.x,
              mt * mt * mt * py + 3 * mt * mt * t * c.y1 + 3 * mt * t * t * c.y2 + t * t * t * c.y);
        }
        acc(c.x, c.y); px = c.x; py = c.y;
      }
    }
    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  function transform(cmds, dx, dy, s) {
    const sc = s === undefined ? 1 : s;
    return cmds.map(c => {
      if (c.type === 'Z') return c;
      const o = { type: c.type, x: c.x * sc + dx, y: c.y * sc + dy };
      if (c.type === 'C') { o.x1 = c.x1 * sc + dx; o.y1 = c.y1 * sc + dy; o.x2 = c.x2 * sc + dx; o.y2 = c.y2 * sc + dy; }
      return o;
    });
  }
  function rotate(cmds, deg, cx, cy) {
    const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const rx = (x, y) => cx + (x - cx) * cos - (y - cy) * sin;
    const ry = (x, y) => cy + (x - cx) * sin + (y - cy) * cos;
    return cmds.map(c => {
      if (c.type === 'Z') return c;
      const o = { type: c.type, x: rx(c.x, c.y), y: ry(c.x, c.y) };
      if (c.type === 'C') {
        o.x1 = rx(c.x1, c.y1); o.y1 = ry(c.x1, c.y1);
        o.x2 = rx(c.x2, c.y2); o.y2 = ry(c.x2, c.y2);
      }
      return o;
    });
  }

  // ---------- 幾何原語(全部閉合) ----------
  function rect(x, y, w, h, r) {
    const rr = Math.min(r || 0, w / 2, h / 2);
    if (rr <= 0.01) return [
      { type: 'M', x, y }, { type: 'L', x: x + w, y }, { type: 'L', x: x + w, y: y + h },
      { type: 'L', x, y: y + h }, { type: 'Z' }];
    const k = KAPPA * rr;
    return [
      { type: 'M', x: x + rr, y },
      { type: 'L', x: x + w - rr, y },
      { type: 'C', x1: x + w - rr + k, y1: y, x2: x + w, y2: y + rr - k, x: x + w, y: y + rr },
      { type: 'L', x: x + w, y: y + h - rr },
      { type: 'C', x1: x + w, y1: y + h - rr + k, x2: x + w - rr + k, y2: y + h, x: x + w - rr, y: y + h },
      { type: 'L', x: x + rr, y: y + h },
      { type: 'C', x1: x + rr - k, y1: y + h, x2: x, y2: y + h - rr + k, x, y: y + h - rr },
      { type: 'L', x, y: y + rr },
      { type: 'C', x1: x, y1: y + rr - k, x2: x + rr - k, y2: y, x: x + rr, y },
      { type: 'Z' }];
  }
  function circle(cx, cy, r) {
    const k = KAPPA * r;
    return [
      { type: 'M', x: cx + r, y: cy },
      { type: 'C', x1: cx + r, y1: cy + k, x2: cx + k, y2: cy + r, x: cx, y: cy + r },
      { type: 'C', x1: cx - k, y1: cy + r, x2: cx - r, y2: cy + k, x: cx - r, y: cy },
      { type: 'C', x1: cx - r, y1: cy - k, x2: cx - k, y2: cy - r, x: cx, y: cy - r },
      { type: 'C', x1: cx + k, y1: cy - r, x2: cx + r, y2: cy - k, x: cx + r, y: cy },
      { type: 'Z' }];
  }
  function polygon(pts) {
    const out = [{ type: 'M', x: pts[0][0], y: pts[0][1] }];
    for (let i = 1; i < pts.length; i++) out.push({ type: 'L', x: pts[i][0], y: pts[i][1] });
    out.push({ type: 'Z' });
    return out;
  }
  // 圓弧(≤90° 分段貝茲)。回傳未閉合的指令片段,供組合。
  function arcSeg(cx, cy, r, a0, a1) {
    const out = [];
    const total = a1 - a0, n = Math.ceil(Math.abs(total) / 90), step = total / n;
    for (let i = 0; i < n; i++) {
      const s = (a0 + i * step) * Math.PI / 180, e = (a0 + (i + 1) * step) * Math.PI / 180;
      const t = Math.tan((e - s) / 4), h = 4 / 3 * t * r;
      const x0 = cx + r * Math.cos(s), y0 = cy + r * Math.sin(s);
      const x3 = cx + r * Math.cos(e), y3 = cy + r * Math.sin(e);
      out.push({
        type: 'C',
        x1: x0 - h * Math.sin(s), y1: y0 + h * Math.cos(s),
        x2: x3 + h * Math.sin(e), y2: y3 - h * Math.cos(e),
        x: x3, y: y3
      });
    }
    return { start: { x: cx + r * Math.cos(a0 * Math.PI / 180), y: cy + r * Math.sin(a0 * Math.PI / 180) }, segs: out };
  }
  // 弧帶(閉合):外弧 a0→a1、切到內弧、內弧 a1→a0、閉合
  function arcBand(cx, cy, rOut, rIn, a0, a1) {
    const o = arcSeg(cx, cy, rOut, a0, a1);
    const i = arcSeg(cx, cy, rIn, a1, a0);
    return [{ type: 'M', x: o.start.x, y: o.start.y }, ...o.segs,
      { type: 'L', x: i.start.x, y: i.start.y }, ...i.segs, { type: 'Z' }];
  }
  function ring(cx, cy, rOut, rIn) {
    return [...circle(cx, cy, rOut), ...circle(cx, cy, rIn)]; // even-odd 挖空
  }
  // 水滴葉形:tip 在上,底在 (0,0)
  function leaf(w, h) {
    return [
      { type: 'M', x: 0, y: 0 },
      { type: 'C', x1: -w, y1: -h * 0.32, x2: -w * 0.58, y2: -h * 0.85, x: 0, y: -h },
      { type: 'C', x1: w * 0.58, y1: -h * 0.85, x2: w, y2: -h * 0.32, x: 0, y: 0 },
      { type: 'Z' }];
  }

  // ---------- 字體 ----------
  const FONTS = [
    { id: 'poppins',    label: 'Poppins SemiBold',      file: 'fonts/Poppins-SemiBold.ttf',      kind: 'latin', mood: '幾何現代' },
    { id: 'poppinsR',   label: 'Poppins Regular',       file: 'fonts/Poppins-Regular.ttf',       kind: 'latin', mood: '輔助' },
    { id: 'montserrat', label: 'Montserrat SemiBold',   file: 'fonts/Montserrat-SemiBold.ttf',   kind: 'latin', mood: '端正經典' },
    { id: 'plexserif',  label: 'IBM Plex Serif',        file: 'fonts/IBMPlexSerif-SemiBold.ttf', kind: 'latin', mood: '信任襯線' },
    { id: 'bebas',      label: 'Bebas Neue',            file: 'fonts/BebasNeue-Regular.ttf',     kind: 'latin', mood: '窄體力量' },
    { id: 'audiowide',  label: 'Audiowide',             file: 'fonts/Audiowide-Regular.ttf',     kind: 'latin', mood: '科技展示' },
    { id: 'notosans',   label: 'Noto Sans TC Bold',     file: 'fonts/NotoSansTC-Bold.otf',       kind: 'cjk',  mood: '現代黑體' },
    { id: 'notosansR',  label: 'Noto Sans TC Regular',  file: 'fonts/NotoSansTC-Regular.otf',    kind: 'cjk',  mood: '輔助' },
    { id: 'notoserif',  label: 'Noto Serif TC Bold',    file: 'fonts/NotoSerifTC-Bold.otf',      kind: 'cjk',  mood: '人文明體' }
  ];
  const fontCache = {};
  async function loadFont(id) {
    if (fontCache[id]) return fontCache[id];
    const spec = FONTS.find(f => f.id === id);
    if (!spec) throw new Error('unknown font ' + id);
    let ab;
    if (typeof window === 'undefined') {
      const fs = require('fs'), b = fs.readFileSync(spec.file);
      ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    } else {
      ab = await (await fetch(spec.file)).arrayBuffer();
    }
    fontCache[id] = opentype.parse(ab);
    return fontCache[id];
  }
  async function loadFonts(ids) { for (const id of ids) await loadFont(id); }
  function getFont(id) {
    if (!fontCache[id]) throw new Error('font not loaded: ' + id);
    return fontCache[id];
  }

  // 文字轉外框。tracking 單位 = em。回傳 {cmds, bbox, adv}
  function textPath(text, fontId, size, tracking) {
    const font = getFont(fontId);
    const tr = tracking || 0;
    const cmds = [];
    let x = 0;
    font.forEachGlyph(text, 0, 0, size, { kerning: true }, (glyph, gx) => {
      const shifted = fromFontPath(glyph.getPath(gx + x, 0, size).commands);
      cmds.push(...shifted);
      x += tr * size; // 每字後加字距
    });
    const adv = font.getAdvanceWidth(text, size, { kerning: true }) + tr * size * Math.max(0, text.length - 1);
    const bbox = cmds.length ? bboxOf(cmds) : { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
    return { cmds, bbox, adv };
  }
  const hasCJK = s => /[㐀-鿿]/.test(s || '');

  // ---------- 標誌家族 ----------
  // 每個 builder(rng, glyphInfo) → { layers:[{cmds, fill}], name }
  // fill 語彙:primary / dark / ink / sub;開孔直接併入同一路徑(even-odd)
  function centeredGlyph(ch, fontId, boxSize, ratio) {
    const t = textPath(ch, fontId, boxSize, 0);
    const s = boxSize * ratio / Math.max(t.bbox.w, t.bbox.h);
    const scaled = transform(t.cmds, 0, 0, s);
    const b = bboxOf(scaled);
    return transform(scaled, boxSize / 2 - (b.x1 + b.w / 2), boxSize / 2 - (b.y1 + b.h / 2));
  }

  const FAMILIES = {
    containerMonogram(rng, g) {
      const S = 100;
      const kind = pick(rng, ['circle', 'rsquare', 'squircle', 'shield', 'hex']);
      let cont;
      if (kind === 'circle') cont = circle(S / 2, S / 2, S / 2);
      else if (kind === 'rsquare') cont = rect(0, 0, S, S, rand(rng, 18, 26));
      else if (kind === 'squircle') cont = rect(0, 0, S, S, 42);
      else if (kind === 'hex') {
        const c = S / 2, r = S / 2;
        cont = polygon([0, 1, 2, 3, 4, 5].map(i => {
          const a = (60 * i - 90) * Math.PI / 180;
          return [c + r * Math.cos(a), c + r * Math.sin(a)];
        }));
      } else { // shield
        cont = [
          { type: 'M', x: 8, y: 0 }, { type: 'L', x: S - 8, y: 0 },
          { type: 'C', x1: S - 3, y1: 0, x2: S, y2: 4, x: S, y: 10 },
          { type: 'L', x: S, y: 58 },
          { type: 'C', x1: S, y1: 80, x2: S * 0.72, y2: 94, x: S / 2, y: 100 },
          { type: 'C', x1: S * 0.28, y1: 94, x2: 0, y2: 80, x: 0, y: 58 },
          { type: 'L', x: 0, y: 10 },
          { type: 'C', x1: 0, y1: 4, x2: 3, y2: 0, x: 8, y: 0 },
          { type: 'Z' }];
      }
      const ratio = kind === 'circle' || kind === 'hex' ? rand(rng, 0.46, 0.52) : rand(rng, 0.5, 0.58);
      const glyph = centeredGlyph(g.ch, g.fontId, S, ratio);
      if (rng() < 0.32 && kind !== 'shield') {
        // 變體:實心字 + 外環容器(兩件皆 primary,單色安全)
        const inset = 9;
        const outer = cont;
        const innerHole = kind === 'circle' ? circle(S / 2, S / 2, S / 2 - inset)
          : rect(inset, inset, S - inset * 2, S - inset * 2, kind === 'rsquare' ? 14 : 32);
        return { layers: [{ cmds: [...outer, ...innerHole], fill: 'primary' }, { cmds: glyph, fill: 'primary' }], name: '容器字標(環)' };
      }
      return { layers: [{ cmds: [...cont, ...glyph], fill: 'primary' }], name: '容器字標(開孔)' };
    },

    moduleGrid(rng) {
      const n = pick(rng, [3, 3, 4]);
      const S = 100, gap = rand(rng, 3, 5), cell = (S - gap * (n - 1)) / n;
      const shapes = pick(rng, [['square', 'leaf'], ['round', 'leaf'], ['square', 'circle'], ['round', 'circle']]);
      const sym = pick(rng, ['mirrorX', 'rot4', 'mirrorX']);
      const grid = Array.from({ length: n }, () => Array(n).fill(0));
      const half = Math.ceil(n / 2);
      for (let r = 0; r < n; r++)
        for (let c = 0; c < (sym === 'mirrorX' ? half : n); c++)
          if (rng() < 0.58) grid[r][c] = 1;
      if (sym === 'mirrorX')
        for (let r = 0; r < n; r++) for (let c = 0; c < half; c++) grid[r][n - 1 - c] = grid[r][c];
      if (sym === 'rot4') {
        for (let r = 0; r < half; r++) for (let c = 0; c < half; c++) {
          const v = grid[r][c];
          grid[c][n - 1 - r] = v; grid[n - 1 - r][n - 1 - c] = v; grid[n - 1 - c][r] = v;
        }
      }
      // 保底:太空或太滿都修正
      let filled = grid.flat().filter(Boolean).length;
      if (filled < n * n * 0.38) { grid[Math.floor(n / 2)][Math.floor(n / 2)] = 1; grid[0][0] = grid[0][n - 1] = 1; }
      if (filled > n * n * 0.85) grid[0][Math.floor(n / 2)] = 0;
      const layers = [];
      const cells = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c]) cells.push([r, c]);
      const accent = cells.length > 3 ? cells[Math.floor(rng() * cells.length)] : null;
      const main = [], acc = [];
      for (const [r, c] of cells) {
        const x = c * (cell + gap), y = r * (cell + gap);
        const shape = pick(rng, shapes);
        let s;
        if (shape === 'square') s = rect(x, y, cell, cell, cell * 0.12);
        else if (shape === 'round') s = rect(x, y, cell, cell, cell * 0.5);
        else if (shape === 'circle') s = circle(x + cell / 2, y + cell / 2, cell / 2);
        else { // leaf:單角全圓角
          const corner = pick(rng, [0, 1, 2, 3]);
          s = rect(x, y, cell, cell, cell * 0.5);
          // 用 rot 直角葉:兩對角圓角 → 以 quarter 圓角矩形近似:改用 circle+rect 併排太雜,直接旋轉 leaf 形
          s = transform(rotate(leaf(cell / 2, cell), corner * 90, 0, -cell / 2), x + cell / 2, y + cell, 1);
        }
        (accent && r === accent[0] && c === accent[1] ? acc : main).push(...s);
      }
      layers.push({ cmds: main, fill: 'primary' });
      if (acc.length) layers.push({ cmds: acc, fill: 'dark' });
      return { layers, name: `模組網格 ${n}×${n}` };
    },

    orbits(rng) {
      const S = 100, cx = S / 2, cy = S / 2;
      const layers = [];
      const thick = rand(rng, 8, 11);
      const a0 = rand(rng, -30, 60);
      layers.push({ cmds: arcBand(cx, cy, 50, 50 - thick, a0, a0 + rand(rng, 250, 300)), fill: 'primary' });
      const rMid = rand(rng, 28, 34);
      const b0 = rand(rng, 90, 200);
      layers.push({ cmds: arcBand(cx, cy, rMid, rMid - thick * 0.85, b0, b0 + rand(rng, 90, 150)), fill: 'primary' });
      layers.push({ cmds: circle(cx, cy, rand(rng, 9, 13)), fill: 'dark' });
      if (rng() < 0.5) {
        const a = (a0 - 8) * Math.PI / 180;
        layers.push({ cmds: circle(cx + (50 - thick / 2) * Math.cos(a), cy + (50 - thick / 2) * Math.sin(a), thick * 0.55), fill: 'dark' });
      }
      return { layers, name: '軌道弧' };
    },

    bars(rng) {
      const S = 100;
      const mode = pick(rng, ['skyline', 'ascend', 'chevron']);
      if (mode === 'chevron') {
        const k = 3;
        const cmds = [];
        for (let i = 0; i < k; i++) {
          const y = 14 + i * 25, t = 14, wHalf = 36, drop = 22;
          cmds.push(...polygon([
            [S / 2 - wHalf, y + drop], [S / 2, y], [S / 2 + wHalf, y + drop],
            [S / 2 + wHalf, y + drop + t], [S / 2, y + t], [S / 2 - wHalf, y + drop + t]
          ]));
        }
        return { layers: [{ cmds, fill: 'primary' }], name: '疊層箭頭' };
      }
      const k = pick(rng, [3, 4, 5]);
      const gap = 6, w = (S - gap * (k - 1)) / k;
      const heights = [];
      for (let i = 0; i < k; i++) {
        if (mode === 'ascend') heights.push(38 + (62 / (k - 1)) * i * rand(rng, 0.92, 1.08));
        else heights.push(rand(rng, 34, 100));
      }
      if (mode === 'skyline') { heights[Math.floor(k / 2)] = 100; }
      const rounded = rng() < 0.6;
      const main = [], accIdx = mode === 'ascend' ? k - 1 : Math.floor(k / 2), acc = [];
      heights.forEach((h, i) => {
        const hh = Math.min(100, h);
        const b = rect(i * (w + gap), 100 - hh, w, hh, rounded ? w / 2 : 2);
        (i === accIdx ? acc : main).push(...b);
      });
      return { layers: [{ cmds: main, fill: 'primary' }, { cmds: acc, fill: 'dark' }], name: mode === 'ascend' ? '成長柱' : '天際線' };
    },

    petals(rng) {
      const S = 100, cx = S / 2, cy = S / 2;
      const N = pick(rng, [4, 5, 6]);
      const R = 46, off = rand(rng, 10, 15);
      const w = R * (N === 6 ? 0.30 : N === 5 ? 0.36 : 0.44);
      const one = transform(leaf(w, R - off), cx, cy - off, 1);
      const cmds = [];
      for (let i = 0; i < N; i++) cmds.push(...rotate(one, 360 / N * i, cx, cy));
      const layers = [{ cmds, fill: 'primary' }];
      if (rng() < 0.55) layers.push({ cmds: circle(cx, cy, off * 0.62), fill: 'dark' });
      return { layers, name: `花瓣 ×${N}` };
    },

    cjkSeal(rng, g) {
      const S = 100;
      const r1 = rand(rng, 14, 20);
      const border = [...rect(0, 0, S, S, r1), ...rect(5.5, 5.5, S - 11, S - 11, r1 - 4)];
      const inner = rect(10, 10, S - 20, S - 20, r1 - 6);
      const glyph = centeredGlyph(g.ch, g.fontId, S, rand(rng, 0.56, 0.62));
      return {
        layers: [
          { cmds: border, fill: 'primary' },
          { cmds: [...inner, ...glyph], fill: 'primary' }
        ], name: '印鑑'
      };
    },

    stackedArcs(rng) {
      const S = 100;
      const cx = 14, cy = 86; // 圓心在左下
      const layers = [];
      const t = rand(rng, 11, 13);
      const radii = [30, 51, 72];
      radii.forEach((r, i) => {
        layers.push({ cmds: arcBand(cx, cy, r, r - t, -90, 0), fill: i === radii.length - 1 ? 'dark' : 'primary' });
      });
      layers.push({ cmds: circle(cx, cy, t * 0.62), fill: 'primary' });
      return { layers, name: '揚升弧' };
    }
  };

  // ---------- 產業預設 ----------
  const INDUSTRIES = {
    '工程營造': { families: ['bars', 'containerMonogram', 'moduleGrid', 'cjkSeal'], palettes: ['navy', 'rust', 'slate'], latin: ['montserrat', 'bebas'], cjk: ['notosans'] },
    '科技資訊': { families: ['moduleGrid', 'orbits', 'containerMonogram'], palettes: ['cobalt', 'slate', 'plum'], latin: ['poppins', 'audiowide'], cjk: ['notosans'] },
    '金融保險': { families: ['stackedArcs', 'containerMonogram', 'bars'], palettes: ['navy', 'forest', 'cobalt'], latin: ['plexserif', 'montserrat'], cjk: ['notosans'] },
    '醫療健康': { families: ['petals', 'orbits', 'containerMonogram'], palettes: ['teal', 'ocean'], latin: ['poppins', 'montserrat'], cjk: ['notosans'] },
    '政府公共': { families: ['containerMonogram', 'petals', 'moduleGrid', 'cjkSeal'], palettes: ['navy', 'ocean', 'slate'], latin: ['montserrat', 'plexserif'], cjk: ['notoserif', 'notosans'] },
    '物流運輸': { families: ['bars', 'orbits', 'stackedArcs'], palettes: ['cobalt', 'ocean', 'navy'], latin: ['montserrat', 'bebas'], cjk: ['notosans'] },
    '餐飲食品': { families: ['petals', 'cjkSeal', 'containerMonogram'], palettes: ['amber', 'rust', 'crimson'], latin: ['poppins', 'plexserif'], cjk: ['notoserif'] },
    '文創設計': { families: ['cjkSeal', 'petals', 'moduleGrid'], palettes: ['plum', 'bronze', 'ink', 'amber'], latin: ['plexserif', 'poppins'], cjk: ['notoserif'] },
    '教育學術': { families: ['containerMonogram', 'stackedArcs', 'petals'], palettes: ['forest', 'navy', 'ink'], latin: ['plexserif', 'montserrat'], cjk: ['notoserif'] },
    '環保能源': { families: ['petals', 'orbits', 'moduleGrid'], palettes: ['forest', 'teal'], latin: ['poppins', 'montserrat'], cjk: ['notosans'] },
    '法律顧問': { families: ['containerMonogram', 'bars', 'stackedArcs', 'cjkSeal'], palettes: ['navy', 'bronze', 'slate', 'ink'], latin: ['plexserif', 'montserrat'], cjk: ['notoserif'] },
    '零售電商': { families: ['moduleGrid', 'petals', 'containerMonogram'], palettes: ['crimson', 'cobalt', 'ink', 'amber'], latin: ['poppins', 'montserrat'], cjk: ['notosans'] }
  };

  // ---------- 候選生成與重建 ----------
  function buildMark(spec) {
    const rng = mulberry32(spec.markSeed);
    const fam = FAMILIES[spec.family];
    const g = { ch: spec.glyphChar, fontId: spec.glyphFontId };
    const mark = fam(rng, g);
    // 正規化到 0..100 高
    const all = mark.layers.flatMap(l => l.cmds);
    const b = bboxOf(all);
    const s = 100 / Math.max(b.w, b.h);
    mark.layers = mark.layers.map(l => ({
      cmds: transform(l.cmds, -b.x1 * s + (100 - b.w * s) / 2, -b.y1 * s + (100 - b.h * s) / 2, s),
      fill: l.fill
    }));
    mark.w = 100; mark.h = 100;
    return mark;
  }

  function makeSpec(input, i, seed) {
    const ind = INDUSTRIES[input.industry] || INDUSTRIES['科技資訊'];
    const rng = mulberry32(seed + i * 7919);
    const family = ind.families[i % ind.families.length];
    const paletteId = ind.palettes[(i + Math.floor(i / ind.palettes.length)) % ind.palettes.length];
    const latinFontId = ind.latin[i % ind.latin.length];
    const cjkFontId = ind.cjk[i % ind.cjk.length];
    const zh = (input.nameZh || '').trim(), en = (input.nameEn || '').trim();
    let glyphChar, glyphFontId;
    if (family === 'cjkSeal' || (hasCJK(zh) && rng() < 0.5)) {
      glyphChar = zh ? zh[0] : (en ? en[0].toUpperCase() : '標');
      glyphFontId = zh ? cjkFontId : latinFontId;
      if (!zh && family === 'cjkSeal') glyphChar = en ? en[0].toUpperCase() : '標';
    } else {
      glyphChar = en ? en[0].toUpperCase() : (zh ? zh[0] : 'A');
      glyphFontId = en ? latinFontId : cjkFontId;
    }
    return {
      id: 'c' + i, family, paletteId, latinFontId, cjkFontId,
      glyphChar, glyphFontId,
      markSeed: (seed + i * 7919) >>> 0,
      layout: 'horizontal',
      nameZh: zh, nameEn: en, tagline: (input.tagline || '').trim(),
      industry: input.industry
    };
  }

  // ---------- 鎖定版型 ----------
  // 回傳 {w,h,layers:[{cmds,fill}],unit,clear} unit=標誌高、clear=淨空
  function buildLockup(spec, layout) {
    const mark = buildMark(spec);
    const L = layout || spec.layout || 'horizontal';
    const zh = spec.nameZh, en = spec.nameEn, tag = spec.tagline;
    const upper = ['bebas', 'audiowide'].includes(spec.latinFontId);
    const enDisp = en ? (upper || en === en.toLowerCase() ? en.toUpperCase() : en) : '';
    const layers = [];
    const texts = [];

    function zhBlock(size) {
      const len = Math.max(2, zh.length);
      const s = Math.min(size, size * 4.6 / len);
      return textPath(zh, spec.cjkFontId, s, 0.06);
    }
    function enBlock(size, track) { return textPath(enDisp, spec.latinFontId, size, track); }

    if (L === 'mark') {
      return { w: 100, h: 100, layers: mark.layers, unit: 100, clear: 25, markW: 100 };
    }

    if (L === 'wordmark') {
      let y = 0; const parts = [];
      if (zh) { const t = zhBlock(56); parts.push({ t, fill: 'ink', y: 0 }); y = t.bbox.h; }
      if (en) {
        const t = enBlock(zh ? Math.min(20, 56 * 2.2 / Math.max(4, enDisp.length)) : 46, zh ? 0.3 : 0.04);
        parts.push({ t, fill: zh ? 'sub' : 'ink', y: y + (zh ? 14 : 0) });
      }
      let w = 0;
      parts.forEach(p => { w = Math.max(w, p.t.bbox.w); });
      parts.forEach(p => {
        layers.push({ cmds: transform(p.t.cmds, -p.t.bbox.x1 + (w - p.t.bbox.w) / 2, -p.t.bbox.y1 + p.y), fill: p.fill });
      });
      const b = bboxOf(layers.flatMap(l => l.cmds));
      return { w: b.x2, h: b.y2, layers, unit: b.y2, clear: b.y2 / 3, markW: 0 };
    }

    // 帶標誌版型
    const M = 100; // mark 高
    if (L === 'vertical') {
      mark.layers.forEach(l => layers.push({ cmds: l.cmds, fill: l.fill }));
      let y = M + 26, w = M;
      if (zh) {
        const t = zhBlock(34);
        layers.push({ cmds: transform(t.cmds, -t.bbox.x1, -t.bbox.y1 + y), fill: 'ink' });
        w = Math.max(w, t.bbox.w); y += t.bbox.h + 10;
      }
      if (en) {
        const t = enBlock(zh ? 13 : 26, zh ? 0.32 : 0.06);
        layers.push({ cmds: transform(t.cmds, -t.bbox.x1, -t.bbox.y1 + y), fill: zh ? 'sub' : 'ink' });
        w = Math.max(w, t.bbox.w); y += t.bbox.h;
      }
      // 置中每一層文字
      const b0 = bboxOf(layers.flatMap(l => l.cmds));
      const out = { w: Math.max(w, M), h: y, layers: [], unit: M, clear: M / 3, markW: M };
      const cxAll = out.w / 2;
      layers.forEach((l, idx) => {
        if (idx < mark.layers.length) out.layers.push({ cmds: transform(l.cmds, cxAll - M / 2, 0), fill: l.fill });
        else {
          const bb = bboxOf(l.cmds);
          out.layers.push({ cmds: transform(l.cmds, cxAll - (bb.x1 + bb.w / 2), 0), fill: l.fill });
        }
      });
      return out;
    }

    // horizontal(預設)
    mark.layers.forEach(l => layers.push({ cmds: l.cmds, fill: l.fill }));
    const gapX = 26;
    const tx = M + gapX;
    const block = [];
    if (zh && en) {
      const t1 = zhBlock(46);
      const adv1 = t1.bbox.w;
      const enSize = Math.min(19, adv1 * 1.02 / Math.max(1, enBlock(1, 0.3).adv));
      const t2 = enBlock(Math.max(10, enSize), 0.3);
      block.push({ t: t1, fill: 'ink' }, { t: t2, fill: 'sub', gap: 13 });
    } else if (zh) {
      const t1 = zhBlock(52);
      block.push({ t: t1, fill: 'ink' });
      if (tag) { const t3 = textPath(tag, spec.cjkFontId === 'notoserif' ? 'notoserif' : 'notosansR', 15, 0.2); block.push({ t: t3, fill: 'sub', gap: 12 }); }
    } else {
      const t1 = enBlock(44, 0.03);
      block.push({ t: t1, fill: 'ink' });
      if (tag) {
        const tagFont = hasCJK(tag) ? 'notosansR' : 'poppinsR';
        const t3 = textPath(tag, tagFont, 14, 0.22);
        block.push({ t: t3, fill: 'sub', gap: 12 });
      }
    }
    // 垂直置中文字塊
    let totalH = 0;
    block.forEach((p, i) => { totalH += p.t.bbox.h + (i ? p.gap || 0 : 0); });
    let y = (M - totalH) / 2;
    block.forEach((p, i) => {
      if (i) y += p.gap || 0;
      layers.push({ cmds: transform(p.t.cmds, -p.t.bbox.x1 + tx, -p.t.bbox.y1 + y), fill: p.fill });
      y += p.t.bbox.h;
    });
    const b = bboxOf(layers.flatMap(l => l.cmds));
    return { w: b.x2, h: M, layers, unit: M, clear: M / 3, markW: M };
  }

  // ---------- 色彩模式與 SVG ----------
  function resolveFill(token, palette, mode) {
    // 具體色(上傳描邊圖層):全彩=原色,其餘模式與語彙 token 同規則
    if (token && token.charAt(0) === '#' && mode !== 'mono' && mode !== 'paper' && mode !== 'reversed' && mode !== 'monoDeep') return token;
    if (mode === 'mono') return palette.ink;
    if (mode === 'paper' || mode === 'reversed') return '#FFFFFF';
    if (mode === 'monoDeep') return palette.dark;
    return token === 'primary' ? palette.primary
      : token === 'dark' ? palette.dark
      : token === 'sub' ? palette.g700
      : token === 'paper' ? '#FFFFFF'
      : palette.ink;
  }

  function toSVG(lockup, palette, mode, opts) {
    const o = opts || {};
    const padU = o.pad === undefined ? 0 : o.pad;
    const pad = padU * lockup.unit;
    const w = lockup.w + pad * 2, h = lockup.h + pad * 2;
    let bgRect = '';
    if (o.bg === 'primary') bgRect = `<rect width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${palette.primary}"/>`;
    else if (o.bg === 'dark') bgRect = `<rect width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${palette.ink}"/>`;
    else if (o.bg && o.bg !== 'none') bgRect = `<rect width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${o.bg}"/>`;
    const paths = lockup.layers.map(l =>
      `<path fill-rule="evenodd" fill="${resolveFill(l.fill, palette, mode)}" d="${cmdsToD(transform(l.cmds, pad, pad))}"/>`
    ).join('\n  ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}">
  ${bgRect}
  ${paths}
</svg>`;
  }

  // 供 mockup / 手冊嵌入:回傳 <g> 字串(已縮放至 targetW)
  function lockupGroup(lockup, palette, mode, x, y, targetW) {
    const s = targetW / lockup.w;
    const paths = lockup.layers.map(l =>
      `<path fill-rule="evenodd" fill="${resolveFill(l.fill, palette, mode)}" d="${cmdsToD(l.cmds)}"/>`
    ).join('');
    return { g: `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${s.toFixed(4)})">${paths}</g>`, h: lockup.h * s, w: targetW };
  }

  function generateCandidates(input, seed, count) {
    const n = count || 12;
    const specs = [];
    for (let i = 0; i < n; i++) specs.push(makeSpec(input, i, seed));
    return specs;
  }

  function fontsNeeded(input) {
    const ind = INDUSTRIES[input.industry] || INDUSTRIES['科技資訊'];
    const set = new Set([...ind.latin, ...ind.cjk, 'poppinsR', 'notosansR']);
    return [...set];
  }

  return {
    mulberry32, FONTS, INDUSTRIES, FAMILIES,
    loadFont, loadFonts, getFont, textPath, hasCJK,
    rect, circle, ring, arcBand, polygon, leaf,
    cmdsToD, bboxOf, transform, rotate, fromFontPath,
    makeSpec, buildMark, buildLockup, generateCandidates, fontsNeeded,
    resolveFill, toSVG, lockupGroup
  };
});
