# LogoForge — 標案級 Logo 交付平台

> 「恭喜!您的設計太驚人了,現在請提供:轉外框 .ai 母檔、Pantone/CMYK、40–60 頁 VI 手冊、20–30 項應用展開、版權切結書⋯⋯」
>
> AI 生圖給得出 logo,給不出**交付物**。這個平台就是為了把後面那整包一鍵補齊。

**Live**: https://chi2tseng.github.io/logo-forge/

## 兩種入口

| 模式 | 做什麼 |
|---|---|
| **AI 生成** | 參數化「向量優先」生成 12 個候選 —— 幾何天生閉合路徑、文字以 OFL 字型真轉外框、負空間 even-odd 真鏤空 |
| **上傳現有 Logo** | 丟一張你已生成好的 logo 圖(PNG/JPG/WebP/SVG),本機自動:色彩擷取 → 背景偵測 → ImageTracer 向量描邊 → 長出整套系統 |

## 一鍵交付包內容

- `01_向量母檔/` — SVG 母檔 + EPS(Illustrator 開啟可另存 .ai)+ PNG 512–4096px;全彩/單色墨/反白/深階
- `02_色彩定義/` — Pantone 最近色對照(CIEDE2000)、PMS 表 CMYK 建議值、RGB/Hex、三材質打樣申請單
- `03_VI手冊/` — 40+ 頁 A4 自動組版(製圖網格、淨空 x/3、最小尺寸 5mm/24px、背景明度準則、禁用範例);瀏覽器列印即為向量 PDF
- `04_應用展開/` — 24 景 SVG:車輛塗裝、制服、事務用品、App Icon/官網、環境識別
- `05_法務文件/` — OFL 授權全文、字體版權宣告、資產來源清單、著作財產權轉讓切結書、AI 生成揭露聲明

全程瀏覽器本機生成,不經任何雲端。

## 誠實限制

1. Pantone 為非官方最近色參考值(資料集:adonald/Pantone-CMYK-RGB-Hex,MIT);正式印製以實體色票 + 簽核打樣為準(ΔE ≤ 2)。
2. `.ai` 為 Adobe 專有格式:以 Illustrator 開啟本包 EPS/SVG 後另存即得。
3. 上傳模式之向量為「描邊近似外框」;大型輸出前建議人工精修節點。
4. 材質打樣為實體流程,平台提供的是可直接委外的申請單。

## 本機開發

```
py -m http.server 5580 --directory .
# 測試路由:#demo(候選)#demo/editor #demo/manual #demo/gallery #demo/checklist #demo/deliver #demo/upload #demo/updeliver
# 驗證:node tools/verify_pack.js、node tools/smoke_mockups.js
```

字體:SIL OFL 1.1(Noto TC、Poppins、Montserrat、IBM Plex Serif、Bebas Neue、Audiowide)。描邊:imagetracerjs(公有領域)。
