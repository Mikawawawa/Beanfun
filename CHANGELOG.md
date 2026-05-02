# Changelog

All notable changes to this fork of Beanfun will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### 多遊戲卡片列表展示
- 新增 `GameCardFull.vue` 組件，提供可展開的遊戲卡片
- 每個卡片包含完整的遊戲操作功能：
  - 帳號列表展示與管理
  - OTP 獲取按鈕（帶防抖保護）
  - 遊戲啟動按鈕
  - 自動粘貼 OTP 選項
- 新增 `GamePathService` 路徑管理服務，統一管理遊戲路徑檢測與配置
- 重構 `AccountList.vue` 頁面，改用卡片列表布局

#### OTP 安全機制
- 前端防抖：3 秒內禁止重複點擊獲取 OTP
- 後端速率限制：單個帳號每分鐘最多 5 次 OTP 請求
- 延遲加載策略：只在用戶明確需要時才調用 OTP API
- 大幅減少 OTP API 調用次數，防止帳號因異常行為被封

#### UI/UX 優化
- 簡化單帳號遊戲的 UI 顯示，隱藏不必要的限制提示
- 優化頁面布局，提升視覺層次感
- 改進載入狀態顯示，使用更緊湊的加載指示器
- 改進窗口自適應邏輯，內容變化時自動調整窗口大小

#### 互動體驗改進
- 優化 2FA 輸入框的鍵盤導航（方向鍵、Home/End 支持）
- 添加 TOTP 倒計時同步顯示
- 改進自動 OTP 粘貼邏輯

### Changed

- 重構 `AccountList.vue`，移除原有的分散式布局，改用卡片列表
- 優化 `GameAccountCard.vue` 組件樣式
- 改進窗口大小調整機制，支持動態內容變化

### Technical Details

#### 新增文件
- `src/components/GameCardFull.vue` - 完整功能遊戲卡片組件
- `src/services/gamePath.ts` - 遊戲路徑管理服務

#### 修改文件
- `src/pages/AccountList.vue` - 重構為卡片列表布局
- `src-tauri/src/commands/otp.rs` - 添加 OTP 速率限制
- `src-tauri/src/commands/launcher.rs` - 添加選擇遊戲可執行文件命令
- `src-tauri/src/commands/mod.rs` - 註冊新命令
- `src/router/index.ts` - 添加窗口大小調整事件監聽

## [Original] - 2024-XX-XX

### 原始專案功能

此 Fork 基於 [pungin/Beanfun](https://github.com/pungin/Beanfun) 的以下功能：

- Tauri v2 桌面應用框架
- Vue 3 + TypeScript + Vite 前端技術棧
- Element Plus UI 組件庫
- 完整的 Beanfun 登入流程（帳號密碼、QR Code、GamePass）
- 遊戲啟動與管理
- 多語言支持（繁體中文、簡體中文、英文）
- Locale_Remulator 語言模擬集成
