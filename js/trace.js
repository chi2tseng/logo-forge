/* trace.js — 上傳 logo 辨識管線:色彩擷取 + ImageTracer 向量描邊 + 去背
 * 產出與 gen.js lockup 相容的物件(layers[{cmds, fill:#hex}]),
 * 讓 EPS/SVG/手冊/應用展開整條既有管線直接復用。
 * 描邊器:imagetracerjs(公有領域/Unlicense)。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('imagetracerjs'), require('./color.js'));
  else root.Trace = factory(root.ImageTracer, root.ColorLib);
})(typeof self !== 'undefined' ? self : this, function (ImageTracerRef, ColorLib) {
  'use strict';
  const IT = () => ImageTracerRef || (typeof ImageTracer !== 'undefined' ? ImageTracer : null);

  // ---------- 載圖(瀏覽器限定) ----------
  function loadImageURL(dataURL, maxSide, name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const M = maxSide || 1024;
        const s = Math.min(1, M / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, w, h);
        resolve({ imageData: cx.getImageData(0, 0, w, h), w, h, name: name || 'upload.png', srcW: img.width, srcH: img.height, dataURL });
      };
      img.onerror = () => reject(new Error('圖檔無法讀取(支援 PNG/JPG/SVG/WebP)'));
      img.src = dataURL;
    });
  }
  function loadImageFile(file, maxSide) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => loadImageURL(r.result, maxSide, file.name).then(resolve, reject);
      r.onerror = () => reject(new Error('檔案讀取失敗'));
      r.readAsDataURL(file);
    });
  }

  // ---------- 色彩工具 ----------
  const dE = (c1, c2) => ColorLib.deltaE2000(
    ColorLib.rgbToLab(c1.r, c1.g, c1.b), ColorLib.rgbToLab(c2.r, c2.g, c2.b));

  // 角落取樣偵測單一背景色
  function detectBg(imgd) {
    const w = imgd.width, h = imgd.height, d = imgd.data;
    const P = Math.min(6, w, h), pts = [];
    for (const [x0, y0] of [[0, 0], [w - P, 0], [0, h - P], [w - P, h - P]])
      for (let y = y0; y < y0 + P; y++) for (let x = x0; x < x0 + P; x++) {
        const i = (y * w + x) * 4;
        pts.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
      }
    const avg = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2], a[3] + p[3]], [0, 0, 0, 0]).map(v => v / pts.length);
    const spread = pts.reduce((m, p) => Math.max(m, Math.abs(p[0] - avg[0]) + Math.abs(p[1] - avg[1]) + Math.abs(p[2] - avg[2])), 0);
    return { r: avg[0], g: avg[1], b: avg[2], a: avg[3], uniform: avg[3] < 128 || spread < 90 };
  }

  // 量化直方圖 → 主要色票(排除透明/背景、合併近似色)
  function extractSwatches(imgd, bg, removeBg, topN) {
    const w = imgd.width, h = imgd.height, d = imgd.data;
    const buckets = new Map();
    const step = Math.max(1, Math.floor(Math.sqrt(w * h / 90000)));
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 128) continue;
      const key = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
      const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
      buckets.set(key, b);
    }
    let sw = [...buckets.values()]
      .map(b => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), n: b.n }))
      .sort((a, b) => b.n - a.n);
    const total = sw.reduce((a, s) => a + s.n, 0) || 1;
    if (removeBg && bg && bg.uniform && bg.a >= 128) sw = sw.filter(s => dE(s, bg) > 10);
    const merged = [];
    for (const s of sw) {
      const hit = merged.find(m => dE(m, s) < 8);
      if (hit) hit.n += s.n; else merged.push({ ...s });
    }
    return merged.slice(0, topN || 6).map(s => ({
      hex: ColorLib.rgbToHex(s.r, s.g, s.b), coverage: Math.round(s.n / total * 100), r: s.r, g: s.g, b: s.b
    }));
  }

  // 建議主色:飽和度 × 覆蓋率,過亮色降權(當不了印刷主色)
  function suggestPrimary(swatches) {
    if (!swatches.length) return '#1E3A5F';
    const score = s => {
      const mx = Math.max(s.r, s.g, s.b), mn = Math.min(s.r, s.g, s.b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const usable = ColorLib.luminance(s.hex) < 0.72 ? 1 : 0.25;
      return (sat * 0.75 + 0.25) * Math.sqrt(Math.max(1, s.coverage)) * usable;
    };
    return [...swatches].sort((a, b) => score(b) - score(a))[0].hex;
  }

  // 由主色建整套配色(deliver/手冊/mockup 用)
  function buildPalette(primaryHex) {
    return {
      id: 'upload', zh: '擷取主色', primary: primaryHex,
      dark: ColorLib.shade(primaryHex, 0.72), tint: ColorLib.shade(primaryHex, 1.88),
      ...ColorLib.GREYS, onPrimary: ColorLib.onColor(primaryHex)
    };
  }

  // ---------- 向量描邊 ----------
  const DETAIL = {
    fine:     { ltres: 0.5, qtres: 0.5, pathomit: 4,  blurradius: 0 },
    standard: { ltres: 1,   qtres: 1,   pathomit: 8,  blurradius: 0 },
    smooth:   { ltres: 2,   qtres: 2,   pathomit: 16, blurradius: 1 }
  };

  function traceToLayers(imgd, opts) {
    const it = IT();
    if (!it) throw new Error('ImageTracer 未載入');
    const o = Object.assign({
      numberofcolors: opts.colors || 5,
      colorquantcycles: 3, strokewidth: 0, linefilter: false,
      rightangleenhance: true, blurdelta: 20, layering: 0
    }, DETAIL[opts.detail || 'standard']);
    const td = it.imagedataToTracedata(imgd, o);
    const layers = [];
    let nodes = 0, dropped = 0;
    td.layers.forEach((paths, li) => {
      const c = td.palette[li];
      if (c.a < 128) { dropped++; return; }
      if (opts.removeBg && opts.bg && opts.bg.uniform && opts.bg.a >= 128 && dE(c, opts.bg) < 10) { dropped++; return; }
      const cmds = [];
      for (const p of paths) {
        if (!p.segments || !p.segments.length) continue;
        cmds.push({ type: 'M', x: p.segments[0].x1, y: p.segments[0].y1 });
        for (const sg of p.segments) {
          if (sg.type === 'L') cmds.push({ type: 'L', x: sg.x2, y: sg.y2 });
          else cmds.push({ // Q → C 升階(與 gen.js 同規格,EPS 有原生對應)
            type: 'C',
            x1: sg.x1 + 2 / 3 * (sg.x2 - sg.x1), y1: sg.y1 + 2 / 3 * (sg.y2 - sg.y1),
            x2: sg.x3 + 2 / 3 * (sg.x2 - sg.x3), y2: sg.y3 + 2 / 3 * (sg.y2 - sg.y3),
            x: sg.x3, y: sg.y3
          });
        }
        cmds.push({ type: 'Z' }); // 描邊輪廓一律閉合;孔洞同層合併,even-odd 鏤空
      }
      if (!cmds.length) return;
      nodes += cmds.length;
      layers.push({ cmds, fill: ColorLib.rgbToHex(c.r, c.g, c.b) });
    });
    if (!layers.length) throw new Error('描邊後沒有可用圖層 — 試著關閉去背或提高色數');
    return { layers, nodes, dropped, w: imgd.width, h: imgd.height };
  }

  // ---------- 正規化成 lockup 相容物件 ----------
  function bboxAll(layers) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const l of layers) for (const c of l.cmds) {
      if (c.type === 'Z') continue;
      for (const [x, y] of c.type === 'C' ? [[c.x1, c.y1], [c.x2, c.y2], [c.x, c.y]] : [[c.x, c.y]]) {
        if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y;
      }
    }
    return { x1, y1, w: x2 - x1, h: y2 - y1 };
  }
  function toLockup(tr) {
    const b = bboxAll(tr.layers);
    const s = 100 / Math.max(1, b.h);
    const mv = (v, o) => (v - o) * s;
    const layers = tr.layers.map(l => ({
      fill: l.fill,
      cmds: l.cmds.map(c => {
        if (c.type === 'Z') return c;
        const o = { type: c.type, x: mv(c.x, b.x1), y: mv(c.y, b.y1) };
        if (c.type === 'C') {
          o.x1 = mv(c.x1, b.x1); o.y1 = mv(c.y1, b.y1);
          o.x2 = mv(c.x2, b.x1); o.y2 = mv(c.y2, b.y1);
        }
        return o;
      })
    }));
    const w = b.w * s;
    return { w, h: 100, layers, unit: 100, clear: 100 / 3, markW: w };
  }

  return { loadImageFile, loadImageURL, detectBg, extractSwatches, suggestPrimary, buildPalette, traceToLayers, toLockup, DETAIL };
});
