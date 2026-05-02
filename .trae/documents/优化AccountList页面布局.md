# AccountList 页面优化计划

## 问题分析

当前 AccountList 页面存在以下问题：

### 1. 功能主次不分

* 游戏信息栏、快捷操作行、账号列表、OTP 区域都在争抢视觉焦点

* 没有明确的层次关系

* 所有区块使用相同的视觉权重

### 2. 视觉风格不统一

* 使用了玻璃态效果（`bf-glass-window`、`bf-glass-panel`、`bf-glass-card`）

* 渐变按钮和纯色按钮混用

* 标题字重过高（800）

### 3. 布局拥挤

* 区块间距小（`gap: 1rem`）

* 内边距不一致

* 信息密度高但呼吸感不足

## 优化方案

### 1. 重新设计布局层次

**主要功能（高视觉权重）：**

* 游戏信息栏 + 开始游戏按钮

* 账号列表

**次要功能（中等视觉权重）：**

* OTP 区域

**辅助功能（低视觉权重）：**

* 快捷操作行（余额、充值、会员、客服）

### 2. 简化视觉设计

* 移除所有玻璃态效果（`bf-glass-*` 类）

* 移除渐变按钮

* 使用纯色背景和细边框

* 降低字重：标题 800 → 500，普通文字 700 → 500

* 统一圆角：8px

### 3. 优化布局

* 增加区块间距（`gap: 1rem` → `gap: 1.25rem`）

* 统一内边距（`padding: 1rem`）

* 简化标题区域

### 4. 统一按钮样式

* 主按钮：纯色填充（`#171717`）

* 次要按钮：白色背景 + 细边框

* 图标按钮：透明背景 + hover 效果

## 实施步骤

### 步骤 1: 简化模板

* 移除 `bf-glass-window`、`bf-glass-panel`、`bf-glass-card`、`bf-ghost-border` 类

* 移除 `bf-text-gradient`、`bf-btn-gradient` 类

* 简化标题区域

### 步骤 2: 重写样式

* 重写整个 `<style scoped>` 部分

* 移除所有玻璃态、渐变相关样式

* 使用统一的 Vercel 风格设计系统

### 步骤 3: 优化布局

* 调整 `.account-list__scroll` 的 padding

* 调整 `.account-list__container` 的 gap

* 优化各区块的 padding 和间距

### 步骤 4: 统一按钮样式

* 重写 `.account-list__start-btn`

* 重写 `.account-list__add-btn`

* 重写 `.account-list__otp-get`

* 重写 `.account-list__quick-link`

## 预期效果

优化后的页面应该：

* 有清晰的视觉层次

* 简洁现代的 Vercel 风格

* 统一的配色（黑白灰）

* 更好的呼吸感和可读性

* 降低字重，更优雅

