/* color.js — 色彩引擎:轉換、CIEDE2000、Pantone 最近色、WCAG 對比、策展配色
 * CMYK 轉換為無 ICC 的通用公式,輸出時一律標註「以打樣為準」。
 * Pantone 對照資料:adonald/Pantone-CMYK-RGB-Hex(MIT,非官方參考值)。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ColorLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 基本轉換 ----------
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16)
    };
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  // 通用 CMYK(無 ICC profile;正式印刷以 Pantone 對照或打樣為準)
  function rgbToCmyk(r, g, b) {
    const rr = r / 255, gg = g / 255, bb = b / 255;
    const k = 1 - Math.max(rr, gg, bb);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round((1 - rr - k) / (1 - k) * 100),
      m: Math.round((1 - gg - k) / (1 - k) * 100),
      y: Math.round((1 - bb - k) / (1 - k) * 100),
      k: Math.round(k * 100)
    };
  }

  // ---------- WCAG ----------
  function srgbLin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return 0.2126 * srgbLin(r) + 0.7152 * srgbLin(g) + 0.0722 * srgbLin(b);
  }
  function contrast(hex1, hex2) {
    const l1 = luminance(hex1), l2 = luminance(hex2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  // 深底反白、淺底正色的自動判定
  function onColor(bgHex) { return contrast(bgHex, '#FFFFFF') >= 3 ? '#FFFFFF' : '#14171C'; }

  // ---------- Lab / CIEDE2000 ----------
  function rgbToLab(r, g, b) {
    let x = srgbLin(r) * 0.4124564 + srgbLin(g) * 0.3575761 + srgbLin(b) * 0.1804375;
    let y = srgbLin(r) * 0.2126729 + srgbLin(g) * 0.7151522 + srgbLin(b) * 0.0721750;
    let z = srgbLin(r) * 0.0193339 + srgbLin(g) * 0.1191920 + srgbLin(b) * 0.9503041;
    x /= 0.95047; z /= 1.08883; // D65
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    const fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  const RAD = Math.PI / 180;
  function deltaE2000(lab1, lab2) {
    const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
    const Cb = (C1 + C2) / 2;
    const Cb7 = Math.pow(Cb, 7);
    const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + Math.pow(25, 7))));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) / RAD + 360) % 360;
    const h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) / RAD + 360) % 360;
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * RAD);
    const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
    let hbp = h1p + h2p;
    if (C1p * C2p !== 0) {
      if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
      else hbp = (h1p + h2p) < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    }
    const T = 1 - 0.17 * Math.cos((hbp - 30) * RAD) + 0.24 * Math.cos(2 * hbp * RAD)
      + 0.32 * Math.cos((3 * hbp + 6) * RAD) - 0.20 * Math.cos((4 * hbp - 63) * RAD);
    const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
    const Cbp7 = Math.pow(Cbp, 7);
    const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
    const Sl = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
    const Sc = 1 + 0.045 * Cbp;
    const Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(2 * dTheta * RAD) * Rc;
    return Math.sqrt(
      Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2)
      + Rt * (dCp / Sc) * (dHp / Sh)
    );
  }

  // ---------- Pantone 最近色 ----------
  let pantoneCache = null; // [{code, hex, cmyk, lab}]
  function loadPantone(rawList) {
    pantoneCache = rawList.map(row => {
      const { r, g, b } = hexToRgb(row.Hex);
      return {
        code: 'PANTONE ' + row.Code,
        hex: row.Hex.toUpperCase(),
        cmyk: { c: +row.C, m: +row.M, y: +row.Y, k: +row.K },
        lab: rgbToLab(r, g, b)
      };
    });
    return pantoneCache.length;
  }
  function nearestPantone(hex, n) {
    if (!pantoneCache) return [];
    const { r, g, b } = hexToRgb(hex);
    const lab = rgbToLab(r, g, b);
    return pantoneCache
      .map(p => ({ ...p, dE: deltaE2000(lab, p.lab) }))
      .sort((a, b2) => a.dE - b2.dE)
      .slice(0, n || 3)
      .map(p => ({ code: p.code, hex: p.hex, cmyk: p.cmyk, dE: Math.round(p.dE * 100) / 100 }));
  }

  // ---------- 共用中性灰階 ----------
  const GREYS = {
    ink: '#14171C', g700: '#3E4450', g500: '#737A87',
    g300: '#C7CCD4', g100: '#F1F2F4', paper: '#FFFFFF'
  };

  // ---------- 策展配色(單一強調色 + 中性灰) ----------
  function shade(hex, f) { // f<1 變深, f>1 變淺(往白)
    const { r, g, b } = hexToRgb(hex);
    if (f <= 1) return rgbToHex(r * f, g * f, b * f);
    const t = f - 1;
    return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
  }
  const PALETTES = [
    { id: 'navy',    zh: '深海軍', primary: '#1E3A5F', tags: ['工程營造', '金融保險', '法律顧問', '政府公共'] },
    { id: 'cobalt',  zh: '鈷藍',   primary: '#2949E5', tags: ['科技資訊', '物流運輸', '金融保險'] },
    { id: 'ocean',   zh: '海洋藍', primary: '#0369A1', tags: ['醫療健康', '物流運輸', '政府公共'] },
    { id: 'teal',    zh: '松石綠', primary: '#0F766E', tags: ['醫療健康', '環保能源'] },
    { id: 'forest',  zh: '森林綠', primary: '#047857', tags: ['環保能源', '教育學術'] },
    { id: 'amber',   zh: '琥珀',   primary: '#B45309', tags: ['餐飲食品', '文創設計'] },
    { id: 'rust',    zh: '赤陶',   primary: '#C2410C', tags: ['餐飲食品', '工程營造'] },
    { id: 'crimson', zh: '緋紅',   primary: '#BE123C', tags: ['零售電商', '餐飲食品'] },
    { id: 'plum',    zh: '深紫',   primary: '#6D28D9', tags: ['文創設計', '科技資訊'] },
    { id: 'bronze',  zh: '青銅',   primary: '#92400E', tags: ['文創設計', '法律顧問'] },
    { id: 'slate',   zh: '石墨',   primary: '#334155', tags: ['科技資訊', '法律顧問', '政府公共'] },
    { id: 'ink',     zh: '純墨',   primary: '#16181D', tags: ['文創設計', '零售電商', '教育學術'] }
  ].map(p => ({
    ...p,
    dark: shade(p.primary, 0.72),
    tint: shade(p.primary, 1.88),
    ...GREYS,
    onPrimary: onColor(p.primary)
  }));

  return {
    hexToRgb, rgbToHex, rgbToCmyk, luminance, contrast, onColor,
    rgbToLab, deltaE2000, loadPantone, nearestPantone,
    shade, GREYS, PALETTES
  };
});
