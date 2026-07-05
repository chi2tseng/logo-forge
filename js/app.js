/* app.js — 平台流程:輸入 → 候選 → 微調 → 交付 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const FAMILY_ZH = {
    containerMonogram: '容器字標', moduleGrid: '模組網格', orbits: '軌道弧',
    bars: '柱列動態', petals: '花瓣放射', cjkSeal: '印鑑', stackedArcs: '揚升弧'
  };
  const LAYOUTS = [['horizontal', '橫式'], ['vertical', '直式'], ['mark', '純標誌'], ['wordmark', '純字標']];
  const BGS = [['white', '白'], ['grey', '淺灰'], ['primary', '主色'], ['dark', '深'], ['grid', '格線']];
  const CJK_FONTS = [['notosans', '黑體'], ['notoserif', '明體']];
  const LATIN_FONTS = [['poppins', 'Poppins'], ['montserrat', 'Montserrat'], ['plexserif', 'Plex Serif'], ['bebas', 'Bebas'], ['audiowide', 'Audiowide']];

  const S = {
    mode: 'gen', // 'gen' 參數化生成 | 'upload' 上傳辨識
    input: null, seed: 20260705, batch: 0,
    specs: [], sel: null,
    up: null, // 上傳模式狀態 {img,bg,swatches,colors,detail,removeBg,primaryHex,trace,lockup,palette}
    bg: 'white',
    pack: null // 交付包結果
  };

  // ---------- 工具 ----------
  function palette() {
    if (S.mode === 'upload' && S.up) return S.up.palette;
    return ColorLib.PALETTES.find(p => p.id === S.sel.paletteId) || ColorLib.PALETTES[0];
  }
  function showView(id) {
    $$('.view').forEach(v => v.classList.remove('show'));
    $('#view-' + id).classList.add('show');
    const order = ['input', 'grid', 'editor', 'deliver'];
    const idx = order.indexOf(id);
    $$('#steps span').forEach(sp => {
      const i = order.indexOf(sp.dataset.step);
      sp.classList.toggle('on', sp.dataset.step === id);
      sp.classList.toggle('done', idx >= 0 && i >= 0 && i < idx);
    });
    window.scrollTo({ top: 0 });
  }
  function chipRow(el, items, cur, onPick) {
    el.innerHTML = '';
    items.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (val === cur ? ' on' : '');
      b.textContent = label;
      b.onclick = () => onPick(val);
      el.appendChild(b);
    });
  }
  async function ensureFonts(ids) {
    await Gen.loadFonts(ids.filter(Boolean));
  }

  // ---------- ctx(給 mockups / vi / export 用) ----------
  function makeCtx() {
    const pal = palette();
    const cache = {};
    const lock = layout => {
      if (S.mode === 'upload') return S.up.lockup; // 上傳模式:四種版型皆同一份描邊母檔
      return cache[layout] || (cache[layout] = Gen.buildLockup(S.sel, layout));
    };
    return {
      p: pal,
      nameZh: S.sel.nameZh, nameEn: S.sel.nameEn, tagline: S.sel.tagline, industry: S.sel.industry,
      spec: S.sel, palette: pal,
      upload: S.mode === 'upload' ? { nodes: S.up.trace.nodes, colors: S.up.colors, detail: S.up.detail, removeBg: S.up.removeBg } : null,
      lockup: lock,
      logo: (layout, mode, x, y, w) => Gen.lockupGroup(lock(layout), pal, mode, x, y, w).g,
      logoH: (layout, w) => { const lk = lock(layout); return lk.h * (w / lk.w); }
    };
  }
  window.__lfCtx = makeCtx; // 除錯/驗證用

  // ---------- 01 輸入 ----------
  function initForm() {
    const sel = $('#inIndustry');
    Object.keys(Gen.INDUSTRIES).forEach(k => {
      const o = document.createElement('option');
      o.value = o.textContent = k;
      sel.appendChild(o);
    });
    $('#btnGen').onclick = generate;
    // 模式切換
    $$('#modeTabs .seg').forEach(b => { b.onclick = () => setMode(b.dataset.mode); });
    // 上傳 dropzone
    const dz = $('#dropzone'), fi = $('#fileInput');
    dz.onclick = () => fi.click();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) uploadFlow(e.dataTransfer.files[0]); };
    fi.onchange = () => { if (fi.files[0]) uploadFlow(fi.files[0]); fi.value = ''; };
  }

  function setMode(m) {
    S.mode = m;
    $$('#modeTabs .seg').forEach(x => x.classList.toggle('on', x.dataset.mode === m));
    $('#rowGen').style.display = m === 'gen' ? '' : 'none';
    $('#rowUpload').style.display = m === 'upload' ? '' : 'none';
  }

  // ---------- 上傳辨識流程:載圖 → 擷色 → 去背 → 描邊 → 直達編輯器 ----------
  async function uploadFlow(fileOrURL, nameHint) {
    const dz = $('#dropzone');
    dz.classList.add('busy');
    try {
      const img = typeof fileOrURL === 'string'
        ? await Trace.loadImageURL(fileOrURL, 1024, nameHint || 'sample.png')
        : await Trace.loadImageFile(fileOrURL, 1024);
      const bg = Trace.detectBg(img.imageData);
      const swatches = Trace.extractSwatches(img.imageData, bg, true, 6);
      if (!swatches.length) throw new Error('擷取不到有效色彩(圖形過淡或全透明)');
      setMode('upload');
      S.up = {
        img, bg, swatches,
        colors: Math.min(8, Math.max(2, swatches.length + 1)),
        detail: 'standard', removeBg: true,
        primaryHex: Trace.suggestPrimary(swatches)
      };
      retrace();
      S.input = {
        nameZh: $('#inNameZh').value.trim(), nameEn: $('#inNameEn').value.trim(),
        tagline: $('#inTagline').value.trim(), industry: $('#inIndustry').value
      };
      S.sel = {
        mode: 'upload', id: 'upload', family: 'upload', paletteId: 'upload',
        glyphChar: '—', markSeed: '—', layout: 'mark',
        nameZh: S.input.nameZh, nameEn: S.input.nameEn, tagline: S.input.tagline,
        industry: S.input.industry,
        uploadName: img.name, uploadW: img.srcW, uploadH: img.srcH
      };
      await ensureFonts(['poppinsR', 'notosansR', 'notosans']); // 手冊版面字樣本
      renderControls(); renderStage(); showView('editor');
    } catch (e) {
      alert('辨識失敗:' + e.message);
      console.error(e);
    } finally { dz.classList.remove('busy'); }
  }
  function retrace() {
    const u = S.up;
    u.trace = Trace.traceToLayers(u.img.imageData, { colors: u.colors, detail: u.detail, removeBg: u.removeBg, bg: u.bg });
    u.lockup = Trace.toLockup(u.trace);
    u.palette = Trace.buildPalette(u.primaryHex);
  }
  window.__lfTestUpload = uploadFlow; // E2E 測試掛鉤

  async function generate() {
    const zh = $('#inNameZh').value.trim(), en = $('#inNameEn').value.trim();
    if (!zh && !en) { $('#inNameZh').focus(); $('#inNameZh').style.borderColor = '#BE123C'; return; }
    $('#inNameZh').style.borderColor = '';
    const btn = $('#btnGen');
    btn.classList.add('loading'); btn.disabled = true;
    S.input = { nameZh: zh, nameEn: en, tagline: $('#inTagline').value.trim(), industry: $('#inIndustry').value };
    S.seed = parseInt($('#inSeed').value, 10) || 20260705;
    try {
      await ensureFonts(Gen.fontsNeeded(S.input));
      S.specs = Gen.generateCandidates(S.input, S.seed + S.batch * 977, 12);
      renderGrid();
      showView('grid');
    } catch (e) {
      alert('生成失敗:' + e.message);
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  }

  // ---------- 02 候選 ----------
  function renderGrid() {
    const grid = $('#grid');
    grid.innerHTML = '';
    $('#gridMeta').textContent = `seed ${S.seed + S.batch * 977} · ${S.input.industry}`;
    S.specs.forEach(spec => {
      const pal = ColorLib.PALETTES.find(p => p.id === spec.paletteId);
      const lk = Gen.buildLockup(spec, 'horizontal');
      const svg = Gen.toSVG(lk, pal, 'full', { pad: 0.25 });
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div class="cv">${svg}</div>
        <div class="lb"><b>${FAMILY_ZH[spec.family] || spec.family}</b><span>${pal.zh} · ${spec.glyphChar}</span></div>`;
      card.onclick = () => { S.sel = JSON.parse(JSON.stringify(spec)); openEditor(); };
      grid.appendChild(card);
    });
  }
  $('#btnReroll') && ($('#btnReroll').onclick = async () => { S.batch++; S.specs = Gen.generateCandidates(S.input, S.seed + S.batch * 977, 12); renderGrid(); });

  // ---------- 03 編輯器 ----------
  async function openEditor() {
    await ensureFonts([S.sel.latinFontId, S.sel.cjkFontId, S.sel.glyphFontId]);
    renderControls();
    renderStage();
    showView('editor');
  }

  function renderControls() {
    const up = S.mode === 'upload';
    $('#genCtl').style.display = up ? 'none' : '';
    $('#uploadCtl').style.display = up ? '' : 'none';
    chipRow($('#ctlBg'), BGS, S.bg, v => { S.bg = v; renderStage(); });
    if (up) { renderUploadControls(); return; }
    chipRow($('#ctlLayout'), LAYOUTS, S.sel.layout, v => { S.sel.layout = v; renderControls(); renderStage(); });
    chipRow($('#ctlFamily'), Object.entries(FAMILY_ZH), S.sel.family, v => { S.sel.family = v; renderControls(); renderStage(); });
    chipRow($('#ctlCjkFont'), CJK_FONTS, S.sel.cjkFontId, async v => {
      await ensureFonts([v]); S.sel.cjkFontId = v;
      if (Gen.hasCJK(S.sel.glyphChar)) S.sel.glyphFontId = v;
      renderControls(); renderStage();
    });
    chipRow($('#ctlLatinFont'), LATIN_FONTS, S.sel.latinFontId, async v => {
      await ensureFonts([v]); S.sel.latinFontId = v;
      if (!Gen.hasCJK(S.sel.glyphChar)) S.sel.glyphFontId = v;
      renderControls(); renderStage();
    });
    // 配色
    const sw = $('#ctlPalette');
    sw.innerHTML = '';
    ColorLib.PALETTES.forEach(p => {
      const d = document.createElement('div');
      d.className = 'sw' + (p.id === S.sel.paletteId ? ' on' : '');
      d.style.background = p.primary;
      d.title = p.zh + ' ' + p.primary;
      d.onclick = () => { S.sel.paletteId = p.id; renderControls(); renderStage(); };
      sw.appendChild(d);
    });
    const g = $('#ctlGlyph');
    g.value = S.sel.glyphChar;
    g.onchange = async () => {
      const ch = g.value.trim();
      if (!ch) return;
      S.sel.glyphChar = ch;
      S.sel.glyphFontId = Gen.hasCJK(ch) ? S.sel.cjkFontId : S.sel.latinFontId;
      await ensureFonts([S.sel.glyphFontId]);
      renderStage();
    };
    $('#btnReseed').onclick = () => { S.sel.markSeed = (S.sel.markSeed + 0x9E3779B9) >>> 0; renderStage(); };
  }

  function renderUploadControls() {
    const u = S.up;
    const rebuild = () => { retrace(); renderControls(); renderStage(); };
    chipRow($('#ctlColors'), [2, 3, 4, 5, 6, 8].map(n => [String(n), n + ' 色']), String(u.colors),
      v => { u.colors = +v; rebuild(); });
    chipRow($('#ctlDetail'), [['fine', '精細'], ['standard', '標準'], ['smooth', '平滑']], u.detail,
      v => { u.detail = v; rebuild(); });
    chipRow($('#ctlBgRemove'), [['on', '自動去背'], ['off', '保留背景']], u.removeBg ? 'on' : 'off',
      v => { u.removeBg = v === 'on'; rebuild(); });
    const sw = $('#ctlSwatches');
    sw.innerHTML = '';
    u.swatches.forEach(s => {
      const b = document.createElement('button');
      b.className = 'chip swchip' + (s.hex === u.primaryHex ? ' on' : '');
      b.innerHTML = `<span class="pms-dot" style="background:${s.hex}"></span>${s.hex} · ${s.coverage}%`;
      b.onclick = () => { u.primaryHex = s.hex; u.palette = Trace.buildPalette(s.hex); renderControls(); renderStage(); };
      sw.appendChild(b);
    });
  }

  function renderStage() {
    const pal = palette();
    const stage = $('#stage');
    stage.className = 'stage' + (S.bg === 'white' ? '' : ' bg-' + S.bg);
    stage.style.setProperty('--live-primary', pal.primary);
    const lk = S.mode === 'upload' ? S.up.lockup : Gen.buildLockup(S.sel, S.sel.layout);
    const mode = (S.bg === 'primary' || S.bg === 'dark') ? 'paper' : 'full';
    stage.innerHTML = Gen.toSVG(lk, pal, mode, { pad: 0.1 });
    // 三模式列
    const strip = $('#modeStrip');
    strip.innerHTML = '';
    [['full', '全彩', '#FFFFFF'], ['mono', '單色', '#FFFFFF'], ['paper', '反白', pal.primary]].forEach(([m, label, bg]) => {
      const cell = document.createElement('div');
      cell.className = 'mode-cell';
      cell.innerHTML = `<div class="box" style="background:${bg}">${Gen.toSVG(lk, pal, m, { pad: 0.15 })}</div><span>${label}</span>`;
      strip.appendChild(cell);
    });
    renderSpecPanel(lk);
  }

  function renderSpecPanel(lk) {
    const pal = palette();
    const pms = ColorLib.nearestPantone(pal.primary, 2);
    const cmyk = ColorLib.rgbToCmyk(...Object.values(ColorLib.hexToRgb(pal.primary)));
    const rows = [
      ['主色', `<b>${pal.primary}</b>(${pal.zh})`],
      ['Pantone', pms.map(p => `<span class="pms-dot" style="background:${p.hex}"></span><b>${p.code}</b> <span style="color:var(--g500)">ΔE ${p.dE}</span>`).join('<br>')],
      ['CMYK', pms[0] ? `<b>${pms[0].cmyk.c} / ${pms[0].cmyk.m} / ${pms[0].cmyk.y} / ${pms[0].cmyk.k}</b>(PMS 對照)` : `<b>${cmyk.c} / ${cmyk.m} / ${cmyk.y} / ${cmyk.k}</b>`],
      ['RGB', `<b>${Object.values(ColorLib.hexToRgb(pal.primary)).join(' / ')}</b>`],
      ['白底對比', `<b>${ColorLib.contrast(pal.primary, '#FFFFFF').toFixed(2)} : 1</b>${ColorLib.contrast(pal.primary, '#FFFFFF') >= 4.5 ? '(AA ✓)' : ''}`]
    ];
    $('#specTable').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const metaRows = S.mode === 'upload' ? [
      ['來源檔案', S.sel.uploadName],
      ['原始尺寸', `${S.sel.uploadW}×${S.sel.uploadH}` + (Math.min(S.sel.uploadW, S.sel.uploadH) < 500 ? ' ⚠ 偏低' : '')],
      ['描邊參數', `${S.up.colors} 色 · ${({ fine: '精細', standard: '標準', smooth: '平滑' })[S.up.detail]}${S.up.removeBg ? ' · 去背' : ''}`],
      ['節點數', S.up.trace.nodes],
      ['路徑', '閉合近似外框 · even-odd']
    ] : [
      ['家族', FAMILY_ZH[S.sel.family]],
      ['字紋', S.sel.glyphChar],
      ['幾何種子', S.sel.markSeed],
      ['鎖定比例', `標誌高 = 1x,淨空 = x/3`],
      ['路徑', `全閉合 · even-odd 開孔`]
    ];
    $('#metaTable').innerHTML = metaRows.map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('');
  }

  // ---------- 04 交付 ----------
  const PROG_STEPS = [
    ['母檔', '向量母檔(4 版型 × 4 色彩模式,SVG/EPS)'],
    ['點陣', '高解析 PNG 衍生(512–4096px)'],
    ['色彩', '色彩定義表 + Pantone/CMYK 對照 + 打樣申請單'],
    ['手冊', 'VI 品牌手冊組版(40+ 頁,A4)'],
    ['展開', '全情境應用展開(24 景)'],
    ['法務', '授權證明 + 著作權轉讓切結書'],
    ['打包', 'ZIP 打包']
  ];

  async function deliver() {
    showView('deliver');
    const list = $('#progList');
    $('#dcards').style.display = 'none';
    $('#deliverCta').style.display = 'none';
    $('#deliverSub').textContent = '正在從同一份向量母檔衍生所有資產⋯';
    list.innerHTML = PROG_STEPS.map(s => `<li data-k="${s[0]}"><span class="ms">progress_activity</span>${s[1]}</li>`).join('');
    const mark = k => {
      const li = list.querySelector(`li[data-k="${k}"]`);
      if (li) { li.className = 'done'; li.querySelector('.ms').textContent = 'check_circle'; }
    };
    const doing = k => {
      const li = list.querySelector(`li[data-k="${k}"]`);
      if (li) li.className = 'doing';
    };
    try {
      const ctx = makeCtx();
      S.pack = await ExportPack.buildPackage(ctx, { doing, done: mark });
      $('#deliverSub').textContent = `完成。共 ${S.pack.fileCount} 個檔案 · ${(S.pack.blob.size / 1048576).toFixed(1)} MB · 全程本機生成`;
      renderDeliverCards();
      $('#dcards').style.display = '';
      $('#deliverCta').style.display = '';
    } catch (e) {
      $('#deliverSub').textContent = '產出失敗:' + e.message;
      console.error(e);
    }
  }

  function renderDeliverCards() {
    const m = S.pack.manifest;
    const up = S.mode === 'upload';
    const cards = [
      ['polyline', '原始向量母檔', up
        ? '上傳圖形之向量描邊母檔 × 全彩/單色/反白/深階;輪廓閉合(even-odd)。描邊為近似外框,建議大型輸出前人工精修。EPS 供 Illustrator 另存 .ai。'
        : '4 版型 × 全彩/單色/反白/深階,全數轉外框、路徑閉合。SVG 為母檔,EPS 供 Illustrator 開啟另存 .ai。', m.filter(f => f.startsWith('01_')).length + ' 檔(SVG / EPS / PNG)'],
      ['palette', '全媒介色彩定義', 'Pantone 最近色對照(ΔE2000)、PMS 表 CMYK、RGB/Hex,附三材質打樣申請單。', m.filter(f => f.startsWith('02_')).length + ' 檔'],
      ['menu_book', '品牌視覺手冊', `${S.pack.manualCount} 頁 A4:製圖網格、淨空區、最小尺寸(印刷 5mm/數位 24px)、明度背景準則、禁用範例。`, 'HTML 原稿 + 瀏覽器列印成向量 PDF'],
      ['grid_view', '全情境應用展開', `${S.pack.mockupCount} 景:車輛塗裝、制服、事務用品、數位介面、環境識別。`, m.filter(f => f.startsWith('04_')).length + ' 檔 SVG'],
      ['gavel', '法務與版權', '字體 OFL 授權全文、資產來源清單(每個元素的生成方式)、著作財產權轉讓切結書 + AI 生成揭露。', m.filter(f => f.startsWith('05_')).length + ' 檔'],
      ['checklist', '驗收對照表', '逐條對應標案需求(含誠實限制聲明),缺失自查。', '內建檢視 + README']
    ];
    $('#dcards').innerHTML = cards.map(c => `
      <div class="dcard">
        <div class="ic"><span class="ms">${c[0]}</span></div>
        <h4>${c[1]}</h4><p>${c[2]}</p>
        <div class="files">${c[3]}</div>
      </div>`).join('');
  }

  function downloadZip() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(S.pack.blob);
    const name = (S.sel.nameEn || S.sel.nameZh || 'brand').replace(/\s+/g, '_');
    a.download = `${name}_標案交付包.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  // ---------- 應用展開 / 手冊 / 對照表 ----------
  function renderGallery() {
    const ctx = makeCtx();
    const g = $('#gallery');
    g.innerHTML = '';
    let n = 0;
    Mockups.SCENES.forEach(sc => {
      try {
        const inner = sc.build(ctx);
        const card = document.createElement('div');
        card.className = 'gcard';
        card.innerHTML = `<svg viewBox="0 0 ${sc.w} ${sc.h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>
          <div class="cap"><b>${sc.title}</b><span>${sc.category}</span></div>`;
        g.appendChild(card); n++;
      } catch (e) { console.error('scene fail', sc.id, e); }
    });
    $('#galleryMeta').textContent = `${n} 景 · 同一份向量母檔衍生`;
  }

  function renderManual() {
    const ctx = makeCtx();
    const pages = VI.buildManual(ctx);
    // ?pages=5-9 只渲染子集(驗證/快速預覽用)
    const q = Object.fromEntries(new URLSearchParams(decodeURIComponent(location.hash).split('?')[1] || ''));
    let list = pages;
    if (q.pages) { const [a, b] = q.pages.split('-').map(Number); list = pages.slice((a || 1) - 1, b || a); }
    $('#manualPages').innerHTML = list.map(p => `<div class="page">${p}</div>`).join('');
    $('#manualMeta').textContent = `${pages.length} 頁 · A4 · 向量`;
  }

  function renderChecklist() {
    const up = S.sel && S.sel.mode === 'upload';
    const rows = [
      ['原始向量母檔:.ai、幾何精修、路徑閉合、全數轉外框、10 米噴繪不失真',
        up ? '上傳圖形經向量描邊之 SVG + EPS 母檔 × 4 色彩模式;輪廓一律閉合(even-odd 開孔)'
           : '4 版型 × 4 色彩模式 SVG + EPS 母檔;所有文字經 opentype.js 轉外框,輪廓一律閉合(even-odd 開孔)',
        '01_向量母檔/', up
          ? '向量可無限縮放;惟描邊為<b>近似外框</b>(非原始幾何),大型輸出前建議以 Illustrator 人工精修節點 —— 交付文件已如實揭露。.ai:以 Illustrator 開啟 EPS/SVG 後另存。'
          : '向量無限縮放,10 米噴繪成立。<b>.ai 為 Adobe 專有格式</b>:以 Illustrator 開啟 EPS/SVG 後「另存 .ai」即符合(標案通例接受「.ai 或同等向量格式」,交付包 README 已註明)。'],
      ['全媒介色彩定義:Pantone 色號、CMYK、RGB/Hex、三材質打樣',
        '色彩定義表(主色/深階/灰階全列)+ PMS 最近色對照(ΔE2000 排序)+ PMS 表 CMYK 建議值 + RGB/Hex',
        '02_色彩定義/', 'Pantone 對照為社群參考值(來源:adonald/Pantone-CMYK-RGB-Hex,MIT);<b>正式印製需以實體色票核對</b>。打樣為實體流程 —— 附三材質(車貼膜/金屬烤漆/織品)打樣申請單供委外。'],
      ['品牌視覺手冊 40–60 頁:淨空區、最小 5mm、正反白、禁用準則',
        `自動組版 A4 手冊:製圖網格、淨空 x/3、最小尺寸(印刷 5mm / 數位 24px)、背景明度 10 階自動判定正反白、禁用範例 8 式、字體與輔助圖形`,
        '03_VI手冊/(瀏覽器列印=向量 PDF)', '頁數依名稱與應用數落在 40+;列印時瀏覽器選「另存 PDF」即為向量檔。'],
      ['全情境應用展開 20–30 項:車輛、制服、事務用品、UI/App Icon',
        '24 景 SVG:名片/信封/信紙/資料夾/識別證、貨車/廂型車/轎車塗裝、POLO/背心/安全帽、App Icon(iOS+Android+尺寸階)/favicon/官網/簡報/郵件簽名/社群、招牌/旗幟/圍籬/接待牆、提袋/紙杯',
        '04_應用展開/', '每景含比例或規格標註(名片 90×54mm、信封 DL、車輛全長參考)。'],
      ['法務與版權:元素授權證明、著作財產權轉讓切結書',
        '字體 SIL OFL 1.1 全文 + 各字體版權宣告(自字型檔 name table 抽出)+ 資產來源清單(每個圖形元素=參數化演算法生成,無第三方素材)+ 轉讓切結書範本 + AI 生成揭露聲明',
        '05_法務文件/', '幾何皆演算法生成、字體 OFL 允許商用與轉外框 —— 無需第三方授權;切結書為範本,簽署主體請填貴司資料。'],
      ['驗收缺失記罰 / 延遲記罰 / 展延一次一週',
        '本對照表 = 自查清單;交付包內 README 含檔案總表與再生成種子(同 seed 可 100% 重現)',
        'README.md', '可重現性 = 修改請求的保險:改稿只動參數,不用重畫。']
    ];
    $('#checklist').innerHTML = `<table class="check-table">
      <tr><th style="width:26%">標案需求(原留言)</th><th style="width:30%">交付物</th><th style="width:14%">位置</th><th>備註(誠實聲明)</th></tr>
      ${rows.map(r => `<tr>
        <td>${r[0]}</td>
        <td><span class="ok"><span class="ms">check_circle</span></span> ${r[1]}</td>
        <td><code>${r[2]}</code></td>
        <td class="note">${r[3]}</td>
      </tr>`).join('')}
    </table>`;
  }

  // ---------- 導航與啟動 ----------
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    const to = nav.dataset.nav;
    if (to === 'gallery') renderGallery();
    if (to === 'manual') renderManual();
    if (to === 'checklist') renderChecklist();
    showView(to);
  });
  $('#btnDeliver').onclick = deliver;
  $('#btnZip').onclick = downloadZip;
  $('#btnPrint').onclick = () => window.print();

  // #demo 路由:自動填表生成,直達指定視圖(測試/展示用)
  // 例:#demo/editor?ind=醫療健康&seed=7&pick=3
  async function demoRoute() {
    const h = decodeURIComponent(location.hash || '');
    if (!h.startsWith('#demo')) return;
    const q = Object.fromEntries(new URLSearchParams(h.split('?')[1] || ''));
    $('#inNameZh').value = q.zh !== undefined ? q.zh : '鑫和工程';
    $('#inNameEn').value = q.en !== undefined ? q.en : 'SINHO Engineering';
    $('#inTagline').value = q.tag !== undefined ? q.tag : '安全 準時 三十年';
    if (q.ind) $('#inIndustry').value = q.ind;
    if (q.seed) $('#inSeed').value = q.seed;
    await generate();
    const target = (h.split('?')[0].split('/')[1] || '');
    // 上傳模式示範:拿自家生成的候選 raster 成 PNG 再回描(自含,不需外部檔案)
    if (target === 'upload' || target === 'updeliver') {
      const spec = S.specs[+(q.pick || 0)] || S.specs[0];
      const pal = ColorLib.PALETTES.find(p => p.id === spec.paletteId);
      const svg = Gen.toSVG(Gen.buildLockup(spec, 'horizontal'), pal, 'full', { pad: 0.2, bg: '#FFFFFF' });
      const png = await svgToPngURL(svg, 900);
      await uploadFlow(png, 'demo_sample.png');
      if (target === 'updeliver') await deliver();
      document.title = 'READY — ' + document.title;
      return;
    }
    if (!target) return;
    S.sel = JSON.parse(JSON.stringify(S.specs[+(q.pick || 0)] || S.specs[0]));
    await openEditor();
    if (target === 'editor') return;
    if (target === 'gallery') { renderGallery(); showView('gallery'); }
    else if (target === 'manual') { renderManual(); showView('manual'); }
    else if (target === 'checklist') { renderChecklist(); showView('checklist'); }
    else if (target === 'deliver') { await deliver(); }
    document.title = 'READY — ' + document.title;
  }

  function svgToPngURL(svgStr, targetW) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = targetW; cv.height = Math.round(img.height * targetW / img.width);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg raster fail')); };
      img.src = url;
    });
  }

  (async function boot() {
    initForm();
    window.__lfState = S; // 除錯/自動驗證用
    try {
      const res = await fetch('data/pantone-pms.json');
      ColorLib.loadPantone(await res.json());
    } catch (e) { console.warn('pantone data unavailable', e); }
    demoRoute().catch(e => console.error('demo route fail', e));
  })();
})();
