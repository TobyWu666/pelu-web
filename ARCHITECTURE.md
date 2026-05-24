# Pelu Web — 架構大綱

> 給之後接手這個專案的 agent / 開發者一份地圖。

## 1. 專案是什麼

`pelu-web` 是 Pelu（一款 Apple ecosystem 上的 Claude Code / Codex 用量監控 app）的官方靜態行銷網站。

- **正式網址**：https://pelu.wutoby.com
- **GitHub repo**：https://github.com/TobyWu666/pelu-web
- **部署方式**：GitHub Pages（main 分支根目錄）
- **DNS**：CNAME `pelu.wutoby.com` → `tobywu666.github.io`，HTTPS 由 GitHub 簽 Let's Encrypt
- **每次 `git push origin main` 會自動觸發部署**

## 2. 檔案結構

```
pelu_web+/
├── index.html        # 首頁（行銷主頁）
├── tutorial.html     # 使用教學
├── privacy.html      # 隱私政策
├── support.html      # 支援中心（App Store 規範頁，提交 App Store 時用此 URL）
├── about.html        # 開發者介紹 + 招募 + 其他作品
│
├── CNAME             # 自訂網域：pelu.wutoby.com
├── .gitignore        # 排除 .DS_Store / temporary screenshots / node_modules
├── serve.mjs         # 本機開發伺服器（Node 內建 http，無外部依賴）
├── CLAUDE.md         # 給 frontend agent 的工作規則（design guardrails、screenshot 流程）
├── ARCHITECTURE.md   # 你正在看的這份
│
└── 附件/             # 圖片素材（Chinese folder name — 路徑要 URL-encode 或保持原樣）
    ├── background.png        # Hero 背景參考圖（山水風）
    ├── logo/
    │   ├── logo.png          # Pelu 主 logo（sage 色 P 字 + 點）
    │   ├── simple_logo.png   # 簡化版 logo（幾乎全白，目前未使用）
    │   ├── claude_logo.gif   # Claude provider 用
    │   └── chatgpt_logo.png  # Codex provider 用
    └── demo/
        ├── iOSapp_home.PNG       # iPhone Dashboard 截圖
        ├── iOSapp_history.PNG    # iPhone History 截圖
        ├── popover.png            # PeluMac popover 截圖
        └── menubar.png            # 選單列 chip 截圖（目前未直接使用，內嵌在 hero 中以 HTML 重畫）
```

## 3. 頁面拓樸與角色

| 頁面 | URL | 角色 |
|---|---|---|
| `index.html` | `/` | Hero、特色 6 卡、Dashboard 展示、運作方式 4 步驟、隱私表格、支援的 AI 工具、FAQ、下載 CTA |
| `tutorial.html` | `/tutorial.html` | 使用教學:系統需求、安裝兩步驟(Mac + iPhone)、Pelu 顯示什麼、常見問題、教學沒解到時導到 support |
| `privacy.html` | `/privacy.html` | 隱私政策。左側 sticky 目錄,10 個錨點章節。一般使用者語氣 |
| `support.html` | `/support.html` | **App Store 規範支援頁**。Hero、聯絡卡片、App 資訊表、系統需求、快速解答、Bug 回報指引、已知問題、相關資源 |
| `about.html` | `/about.html` | 開發者介紹、招募 Windows + Android 夥伴(基於興趣,不是正職)、設計原則、其他作品(ScaleScout、EquaClip) |

### 共用元件（每頁各自手寫,沒有抽 partial）

- **Nav**：fixed top,7 個項目:特色 / 用量畫面 / 教學 / 隱私 / 支援 / 關於 / 下載。當前頁的對應項目要套 `text-sage-900 font-medium`,其餘 `hover:text-sage-900`
- **Footer**：sage-900 深色,三欄(產品 / 資源 / 關於)+ 版權列

修改 nav / footer 時記得四頁(或五頁)都要同步改。

## 4. Design system

### 色票（Tailwind `theme.extend.colors`）

```js
sage: {
  50:'#f3f7f6',   100:'#e2ecea',  200:'#c6dad6',
  300:'#a8c4bf',  400:'#84a8a4',  // ← logo 本色
  500:'#6c918d',  600:'#557672',  700:'#3f5a57',
  800:'#2b3f3d',  900:'#1c2a29',
},
mist:'#dfe7e5', cream:'#f5f1ea', ink:'#0f1517'
```

從 logo 的湖綠色 `#84A8A4`（sage-400）推出整條色階。不使用 Tailwind 預設藍/靛。

### 字型

- **顯示字**(`font-display`)：`Noto Serif TC`(weight 500/700/900)
- **內文**：`Inter`(weight 400/500/600/700/800)+ `PingFang TC` / `Noto Sans TC` 後備
- **等寬**：`JetBrains Mono`(URL、版號、key 顯示)

字型由 Google Fonts CDN 載入(`<link>` 在每頁 `<head>`)。每頁都有完整的 `tailwind.config` 與 `<style>` 區塊——這是刻意的:沒有 build step,直接看 source 就知道全貌。

### 常用 class / 元素

- `.scenery` — Hero 背景:多層 radial gradient + linear gradient 組成的山水底色
- `.noise::before` — SVG 雜訊紋理疊在 scenery 上(避免色帶)
- `.shadow-sage` — 通用卡片陰影(內陰影 1px 白 + 多層 sage 色陰影)
- `.shadow-deep` — 深色卡片用的更強陰影
- `.btn` — 按鈕通用 transition + hover 上浮 + focus-visible ring
- 山稜剪影 `<svg>` — 兩條 path,放在 Hero 底部
- 「太陽」`<div>` — Hero 右上角白色光暈

### 排版規範

- Hero 大標 `tracking-tighter2`(-0.035em)
- 中標 `tracking-tightish`(-0.025em)
- 內文 `leading-[1.75]` ~ `[1.85]`
- 永遠避免 `transition-all`、不用預設 Tailwind 藍/靛

## 5. 本機開發

### 啟動伺服器

```sh
node serve.mjs
# 預設 port 3000,或設定 PORT 環境變數
```

`serve.mjs` 是 Node 內建 `http` 模組寫的純靜態伺服器:無外部依賴,支援 MIME、目錄索引、路徑遍歷防護。**不要改用 vite / next / webpack**——這個專案刻意保持零 build step。

### 截圖

CLAUDE.md 規範用 `temporary screenshots/` 存,自動編號。本機開發環境若有 Chrome,可以用:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1440,5200 \
  --screenshot="temporary screenshots/screenshot-N.png" \
  --virtual-time-budget=4000 \
  http://localhost:3000/
```

`temporary screenshots/` 已被 .gitignore 排除。

## 6. 內容語氣指南

- 「面向一般大眾」,不要技術用語。已被使用者多次糾正過:
  - ❌ CloudKit private database / Required Reason API / Mac Keychain / UserDefaults / NSPrivacyAccessed... / FSEvents / JSONL / token_count / `~/.claude/usag-status.json` / Developer ID / Apple Notarize
  - ✅ 你的 iCloud / Apple ID / 同步 / 重置倒數 / 系統會自動更新
- **不要提 Claude Code statusLine hook**(這個功能在產品端不再以使用者可見的方式呈現)
- **不要說「無內購」**——未來會新增 donation/抖內,要保留空間。可以說「核心功能完全免費」
- **Context 功能已移除**——不要提 Context 用量、Context bar 等
- **多 Mac 顯示邏輯**：同一 Apple ID 下的 Mac 會出現在設定的裝置列表；iPhone / Widget / 動態島整合顯示最近更新的用量；Mac 選單列仍顯示該台本機最新讀取結果
- 開發者本人:**大學物理系在讀**(不是已畢業),**沒有正式開發經驗,因為 AI agent 才開始做 app**。不強調具體地點,只說「在台灣」
- 招募 Windows + Android 開發者:**興趣合作,不是正職招募**

## 7. App Store 規範要點(support.html)

`support.html` 是 App Store Connect 的 Support URL。Apple 要求一個 support 頁要能讓使用者「找到開發者協助」,實作上有以下要點:

- **明確聯絡方式**(email + 預期回應時間)放在最上方
- **App 資訊**:名稱、類別、版本、最近更新、售價、開發者
- **系統需求**
- **常見問題 / 快速解答**(內容不要太多,深入內容導去 tutorial)
- **Bug 回報指引**:建議附上的資訊
- **已知問題**:即使沒有也明確標示「目前沒有已知問題」
- **相關資源**:隱私政策、教學、首頁的連結

修改此頁時請維持這個骨架,不要把它變成行銷頁。

## 8. 隱私聲明的事實基礎

`privacy.html` 中宣稱的事實對應產品實作:

| 聲明 | 對應實作 |
|---|---|
| 沒有自家伺服器 | 使用 CloudKit private database,Pelu 開發者帳號只能看 schema,看不到 record |
| 不蒐集任何資料 | App Store Privacy 申報為 `Data Not Collected` |
| 沒有第三方追蹤 | 不依賴 Google Analytics、Crashlytics 等任何第三方 SDK |
| 資料只在你的裝置與你的 iCloud | 用量資料只寫進使用者 iCloud private DB;30 天歷史只存在 iPhone 本地 |

修改隱私頁時請確保新增的聲明在產品端真的成立。

## 9. 部署細節

### GitHub Pages 設定

- Source:`main` 分支 / `/`(根目錄)
- Custom domain:`pelu.wutoby.com`(由 CNAME 檔提供)
- Enforce HTTPS:✅(GitHub 自動簽 Let's Encrypt)

### DNS

`pelu.wutoby.com` 是 CNAME → `tobywu666.github.io`,於使用者的 DNS provider 設定。

### 部署觸發

`git push origin main` 即觸發 GitHub Pages 部署,通常 1–3 分鐘生效。

```sh
# 查看部署狀態
gh api repos/TobyWu666/pelu-web/pages | jq '{status,html_url,https_certificate}'
```

## 10. 修改清單(常見需求)

| 需求 | 修改的檔案 |
|---|---|
| 改文案/標題 | 對應頁面的 `.html` |
| 新增/換截圖 | `附件/demo/` 內換檔案,檔名沿用即可 |
| 改 nav | 五個 html 都要改(沒有 partial) |
| 改 footer | 五個 html 都要改 |
| 改色 / 改字體 | 五個 html 內各自的 `tailwind.config` + `<style>` 區塊 |
| 換網域 | 更新 `CNAME` 檔 + DNS + `gh api ... -f cname=...` |
| 新增頁面 | 新建一個 `.html`,從現有頁面複製 head/nav/footer,並把所有頁面的 nav 都加上連結 |

## 11. 注意事項 / 已知決定

- **沒有 build step**:刻意保持簡單。每頁都是完整 HTML + inline Tailwind config,不用 npm install
- **資料夾 `附件/` 用中文**:在現代瀏覽器 / GitHub Pages 上沒問題,URL 會自動 `%E9%99%84%E4%BB%B6` 編碼。不要改名
- **沒有 `simple_logo.png` 用途**:幾乎是空白圖,目前所有需要 logo 的位置都用 `logo.png`
- **`SourceHanSerifTC-Bold.otf`**:project 根目錄有這個檔案但**沒被 commit**,因為現在用 Google Fonts CDN
- **沒有 sitemap.xml / robots.txt**:目前不需要,SEO 不是這個產品的關鍵

## 12. 寫給未來 agent

如果使用者請你修改網站:

1. **先確認 / 啟動本機伺服器**(`node serve.mjs`),改完用截圖驗證
2. **每頁 nav / footer 要同步**,別忘了
3. **語氣維持「一般大眾」**——遇到要寫的新功能或新區塊,先想「我媽看得懂嗎?」
4. **謹守事實**:不要在隱私頁/支援頁加入產品端沒有的承諾
5. **commit 後 push 即部署**——push 前確認改的東西是穩定狀態

Co-Authored-By: Claude Opus 4.7
