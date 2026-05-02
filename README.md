# Beanfun

[![GitHub all releases](https://img.shields.io/github/downloads/pungin/Beanfun/total)](https://github.com/pungin/Beanfun/releases)
[![Lint, Format & Test](https://github.com/pungin/Beanfun/actions/workflows/ci.yml/badge.svg)](https://github.com/pungin/Beanfun/actions/workflows/ci.yml)

> **遊戲橘子數位科技旗下遊戲的第三方啟動器**

**免責聲明：** 本軟體 **不是** 遊戲橘子旗下科技所開發的官方客戶端程式。若您的帳號使用第三方的方式登錄，請自行三思並且確認下載當前程式的來源是否安全。

- 本程式使用部份 `BeanfunLogin` 的代碼。
- 程式使用 [Locale_Remulator](https://github.com/InWILL/Locale_Remulator) 作為語言模擬元件，支援 32-bit 及 64-bit 遊戲。

---

## 關於本 Fork

本專案是從 [pungin/Beanfun](https://github.com/pungin/Beanfun) Fork 而來，並添加了以下改進功能：

### 主要改進

1. **多遊戲卡片列表展示**
   - 以可展開的卡片形式展示所有遊戲
   - 每個卡片包含完整的遊戲操作功能（帳號列表、OTP獲取、啟動遊戲）
   - 大幅減少 OTP API 調用，防止帳號因異常行為被封

2. **UI/UX 優化**
   - 簡化單帳號遊戲的 UI 顯示，隱藏不必要的限制提示
   - 優化頁面布局，提升視覺層次感
   - 改進載入狀態顯示

3. **互動體驗改進**
   - 優化 2FA 輸入框的鍵盤導航（方向鍵、Home/End 支持）
   - 添加 TOTP 倒計時同步顯示
   - 改進自動 OTP 粘貼邏輯

4. **OTP 安全機制**
   - 前端防抖：3 秒內禁止重複點擊獲取 OTP
   - 後端速率限制：單個帳號每分鐘最多 5 次 OTP 請求
   - 延遲加載：只在用戶明確需要時才調用 OTP API

詳細的改進記錄請參見 [CHANGELOG.md](./CHANGELOG.md)。

功能規格文檔請參見 [spec/](./spec/) 目錄，AI 協作指南請參見 [AGENTS.md](./AGENTS.md)。

---

## 下載與使用 (Getting Started)

### 系統要求 (Prerequisites)

- **作業系統：** Windows 10 或以上
- **必備元件：** [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)（Windows 11 已預裝）

### 使用方法 (Usage)

前往 **[最新發行版 (Releases)](https://github.com/pungin/Beanfun/releases/latest)** 下載：

| 版本         | 檔案                          | 說明                                                                                 |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------ |
| **免安裝版** | `Beanfun.exe`                 | 放至任意全英文路徑的資料夾，直接執行即可。需系統已安裝 WebView2 Runtime。            |
| **安裝版**   | `Beanfun_x.x.x_x64-setup.exe` | 適用於精簡版 Windows 等未預裝 WebView2 的環境，安裝過程會自動安裝 WebView2 Runtime。 |

> **⚠ 注意事項說明：**
>
> - 啟動遊戲時程式會在執行資料夾生成 `LRProc.exe`、`LRHookx32.dll`、`LRHookx64.dll` 等件。
> - `LRProc.exe` — 負責 Hook DLL 載入至程序中
> - `LRHookx32.dll` / `LRHookx64.dll` — 語言模擬元件

---

## 技術棧 (Built With)

- **[Tauri v2](https://tauri.app/)** — 桌面殼層（WebView2）
- **[Rust](https://www.rust-lang.org/)** — 後端核心
- **[Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)** — 前端框架
- **[Element Plus](https://element-plus.org/)** — UI 元件庫
- **[Locale_Remulator](https://github.com/InWILL/Locale_Remulator)** — 語言模擬元件

---

## 架構 (Architecture)

採前後端分離設計：

- **前端 (`src/`)**：Vue 3 + TypeScript + Vite，負責 UI 與多視窗（In-App Browser、ServiceAccountInfo…）。
- **後端 (`src-tauri/`)**：Rust + Tauri v2，提供 IPC commands 與服務層（登入 / 帳號 / 遊戲啟動 / 設定檔 / 加密儲存 / 自動更新…）。
- **語系**：`Lang/`（WPF 時代 XAML 來源）→ `src/i18n/` + `src/locales/`（vue-i18n）。

完整目錄樹與模組說明請見 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

專案設計文檔請見 **[.trae/documents](./.trae/documents)** 目錄。

---

## 開發 (Development)

### 環境需求

| 需求                      | 版本                                  |
| ------------------------- | ------------------------------------- |
| Node.js                   | >= 22 LTS                             |
| Rust                      | stable (x86_64-pc-windows-msvc)       |
| WebView2 Runtime          | Windows 11 預裝；Windows 10 需安裝    |
| Visual Studio Build Tools | 安裝 **Desktop development with C++** |

### 快速開始

```sh
npm install
npm run tauri dev
```

### 常用指令

```sh
# 前端
npm run lint              # ESLint
npm run format:check      # Prettier
npm run typecheck         # TypeScript 型別檢查
npm run test              # Vitest 單元測試

# 後端 (src-tauri/)
cargo fmt --check         # Rust 格式檢查
cargo clippy -- -D warnings
cargo test
```

---

## 貢獻 (Contributing)

1. 從 `code` 分支出新 feature branch。
2. PR 到 `code` 時會跑 CI（lint / format / typecheck / test）。
3. 送 PR 前請先跑 `npm run format` + `cargo fmt`。

---

## 致謝

- 感謝 [pungin/Beanfun](https://github.com/pungin/Beanfun) 原作者的出色工作
- 感謝 [Locale_Remulator](https://github.com/InWILL/Locale_Remulator) 項目提供的語言模擬功能
