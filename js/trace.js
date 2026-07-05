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
        const M = maxSide || 2048;
        // 低解析來源 2× 超取樣:內插後的邊緣再二值化,向量曲線更平滑
        let s = Math.min(1, M / Math.max(img.width, img.height));
        if (Math.max(img.width, img.height) < 1200) s = Math.min(2, M / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
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
  // 二值化遮罩描邊用:pathomit 壓最低(細襯線、小字不可丟),去斑交給面積門檻
  const DETAIL_BIN = {
    fine:     { ltres: 0.3, qtres: 0.3, pathomit: 1 },
    standard: { ltres: 0.6, qtres: 0.6, pathomit: 2 },
    smooth:   { ltres: 1.4, qtres: 1.4, pathomit: 6 }
  };

  // ---------- 類型辨識:單色墨線 / 平面色塊 / 複雜影像 ----------
  // 反鋸齒暈判定:候選色落在「某主色 → 背景」線段中段附近 = 邊緣漸變,吸收進該主色。
  // 真正的第二品牌色不在該線段上,不會被吃掉;大面積淡色(coverage≥8%)也不吸收。
  function isEdgeRamp(s, host, bgPt) {
    const abx = bgPt.r - host.r, aby = bgPt.g - host.g, abz = bgPt.b - host.b;
    const apx = s.r - host.r, apy = s.g - host.g, apz = s.b - host.b;
    const len2 = abx * abx + aby * aby + abz * abz || 1;
    let t = (apx * abx + apy * aby + apz * abz) / len2;
    if (t < 0.1 || t > 0.96) return false;
    const dx = apx - t * abx, dy = apy - t * aby, dz = apz - t * abz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) < 26;
  }
  function classify(imgd, bg, removeBg) {
    const sw = extractSwatches(imgd, bg, removeBg, 8);
    const bgPt = (bg && bg.uniform && bg.a >= 128) ? bg : { r: 255, g: 255, b: 255 };
    const cand = sw.filter(s => s.coverage >= 2);
    const inks = [];
    for (const s of cand) {
      const host = s.coverage < 8 && inks.find(k => isEdgeRamp(s, k, bgPt));
      if (host) { host.coverage += s.coverage; continue; }
      inks.push({ ...s });
    }
    const kind = inks.length <= 1 ? 'mono' : inks.length <= 6 ? 'flat' : 'complex';
    return { kind, inks: inks.length ? inks : sw.slice(0, 1), swatches: sw };
  }

  // 單色影像的 Otsu 二值化閾值(對「與背景的距離」直方圖)
  function otsuThreshold(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 127, maxVar = -1;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; best = t; }
    }
    return best;
  }

  // 把 ImageTracer 單層 paths 轉 cmds,附面積去斑(輪廓與針孔皆清)
  function pathsToCmds(paths, minArea) {
    const cmds = [];
    let speckles = 0;
    const keep = [];
    for (const p of paths) {
      if (!p.segments || !p.segments.length) continue;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const sg of p.segments) {
        const xs = sg.type === 'Q' ? [sg.x1, sg.x3] : [sg.x1, sg.x2];
        const ys = sg.type === 'Q' ? [sg.y1, sg.y3] : [sg.y1, sg.y2];
        for (const x of xs) { if (x < x1) x1 = x; if (x > x2) x2 = x; }
        for (const y of ys) { if (y < y1) y1 = y; if (y > y2) y2 = y; }
      }
      keep.push({ p, area: (x2 - x1) * (y2 - y1) });
    }
    const solidCount = keep.filter(k => !k.p.isholepath).length;
    for (const k of keep) {
      if (minArea && k.area < minArea && solidCount > 4) { speckles++; continue; }
      const segs = k.p.segments;
      cmds.push({ type: 'M', x: segs[0].x1, y: segs[0].y1 });
      for (const sg of segs) {
        if (sg.type === 'L') cmds.push({ type: 'L', x: sg.x2, y: sg.y2 });
        else cmds.push({
          type: 'C',
          x1: sg.x1 + 2 / 3 * (sg.x2 - sg.x1), y1: sg.y1 + 2 / 3 * (sg.y2 - sg.y1),
          x2: sg.x3 + 2 / 3 * (sg.x2 - sg.x3), y2: sg.y3 + 2 / 3 * (sg.y2 - sg.y3),
          x: sg.x3, y: sg.y3
        });
      }
      cmds.push({ type: 'Z' });
    }
    return { cmds, speckles };
  }

  // 對單一遮罩(黑/白)跑二值描邊,回傳墨層 paths
  // 固定黑白調色盤 + colorsampling:0 → 決定性,不受自動調色盤抽樣影響
  function traceBinary(maskImgd, detail) {
    const it = IT();
    const o = Object.assign({
      numberofcolors: 2, colorquantcycles: 1, colorsampling: 0, strokewidth: 0,
      linefilter: false, rightangleenhance: false, blurradius: 0, layering: 0,
      pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }]
    }, DETAIL_BIN[detail || 'standard']);
    const td = it.imagedataToTracedata(maskImgd, o);
    let inkIdx = 0, best = Infinity;
    td.palette.forEach((c, i) => { const l = c.r + c.g + c.b; if (c.a >= 128 && l < best) { best = l; inkIdx = i; } });
    return td.layers[inkIdx] || [];
  }

  /* traceSmart — 辨識驅動的向量化:
   * mono:與背景距離 Otsu 二值化 → 單次二值描邊(細節不丟、無鬼影層)
   * flat:每個主色獨立遮罩(最近色指派,含反鋸齒邊)→ 各自二值描邊
   * complex:退回多色量化(舊法)並標記降級
   * 全路徑面積去斑。 */
  function traceSmart(imgd, opts) {
    const bg = opts.bg;
    const removeBg = !!(opts.removeBg && bg && bg.uniform && bg.a >= 128);
    const cls = classify(imgd, bg, opts.removeBg);
    let inks = cls.inks;
    let kind = cls.kind;
    if (opts.colorsOverride) {
      inks = extractSwatches(imgd, bg, opts.removeBg, opts.colorsOverride);
      kind = inks.length <= 1 ? 'mono' : 'flat';
    }
    if (kind === 'complex')
      return Object.assign(traceToLayers(imgd, { colors: 8, detail: opts.detail, removeBg: opts.removeBg, bg }), { kind, inkSwatches: cls.swatches, speckles: 0 });

    const { width: w, height: h, data: d } = imgd;
    const minArea = Math.max(36, w * h * 1.2e-5);
    const layers = [];
    let nodes = 0, speckles = 0;

    if (kind === 'mono') {
      const ink = inks[0];
      // 距背景距離 → 0..255 直方圖 → Otsu
      const hist = new Uint32Array(256);
      const dist = new Uint8ClampedArray(w * h);
      let total = 0;
      const bR = removeBg ? bg.r : 255, bG = removeBg ? bg.g : 255, bB = removeBg ? bg.b : 255;
      for (let p = 0, i = 0; p < w * h; p++, i += 4) {
        let v;
        if (d[i + 3] < 128) v = 0;
        else v = Math.min(255, Math.sqrt((d[i] - bR) ** 2 + (d[i + 1] - bG) ** 2 + (d[i + 2] - bB) ** 2) / 441 * 255 * (d[i + 3] / 255));
        dist[p] = v; hist[v | 0]++; total++;
      }
      const th = otsuThreshold(hist, total);
      const bin = new Uint8ClampedArray(w * h * 4);
      for (let p = 0, i = 0; p < w * h; p++, i += 4) {
        const on = dist[p] > th;
        bin[i] = bin[i + 1] = bin[i + 2] = on ? 0 : 255;
        bin[i + 3] = 255;
      }
      const paths = traceBinary({ width: w, height: h, data: bin }, opts.detail);
      const r = pathsToCmds(paths, minArea);
      speckles += r.speckles; nodes += r.cmds.length;
      if (!r.cmds.length) throw new Error('二值化後沒有可用輪廓 — 試試「保留背景」或提高色數');
      layers.push({ cmds: r.cmds, fill: ink ? ink.hex : '#14171C' });
    } else {
      // flat:單次掃描把每個像素指派給最近主色(或背景),產生 N 份遮罩
      const n = inks.length;
      const masks = [];
      for (let k = 0; k < n; k++) { const m = new Uint8ClampedArray(w * h * 4); m.fill(255); for (let i = 3; i < m.length; i += 4) m[i] = 255; masks.push(m); }
      for (let p = 0, i = 0; p < w * h; p++, i += 4) {
        if (d[i + 3] < 128) continue;
        const r0 = d[i], g0 = d[i + 1], b0 = d[i + 2];
        let bestK = -1, bestD = Infinity;
        for (let k = 0; k < n; k++) {
          const s = inks[k];
          const dd = (r0 - s.r) ** 2 * 0.9 + (g0 - s.g) ** 2 * 1.2 + (b0 - s.b) ** 2 * 0.9;
          if (dd < bestD) { bestD = dd; bestK = k; }
        }
        if (removeBg) {
          const db = (r0 - bg.r) ** 2 * 0.9 + (g0 - bg.g) ** 2 * 1.2 + (b0 - bg.b) ** 2 * 0.9;
          if (db < bestD) continue; // 背景
        }
        const m = masks[bestK], j = p * 4;
        m[j] = m[j + 1] = m[j + 2] = 0;
      }
      inks.forEach((ink, k) => {
        const paths = traceBinary({ width: w, height: h, data: masks[k] }, opts.detail);
        const r = pathsToCmds(paths, minArea);
        speckles += r.speckles;
        if (r.cmds.length) { nodes += r.cmds.length; layers.push({ cmds: r.cmds, fill: ink.hex }); }
      });
      if (!layers.length) throw new Error('遮罩描邊後沒有可用圖層 — 試試關閉去背');
      layers.sort((a, b) => {
        const ca = inks.find(s => s.hex === a.fill), cb2 = inks.find(s => s.hex === b.fill);
        return (cb2 ? cb2.coverage : 0) - (ca ? ca.coverage : 0);
      });
    }
    return { layers, nodes, speckles, dropped: 0, kind, inkSwatches: inks, w, h };
  }

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

  return { loadImageFile, loadImageURL, detectBg, extractSwatches, suggestPrimary, buildPalette, traceToLayers, traceSmart, classify, toLockup, DETAIL };
});
