# Beanfun Fork - AI 协作指南

本文档用于指导 AI 助手理解本项目结构、设计决策和开发规范。

## ⚠️ 重要声明

### 文档维护规则

1. **`.trae/documents/` 用于开发阶段快速对齐** - 该目录可用于开发过程中快速记录想法、问题分析和方案草稿，但**不应作为正式文档引用**

2. **关键改动必须维护到 `spec/` 目录** - 所有功能规格、设计决策和技术文档必须整理到 `spec/` 目录下的相应文件中，作为正式文档

3. **优先参考 `spec/` 目录** - 进行任何开发工作时，优先查看 `spec/` 目录下的正式规格文档

4. **开发完成后同步更新** - 功能开发完成后，应将 `.trae/documents/` 中的关键决策整理到 `spec/` 目录，保持正式文档的时效性

## 项目概述

本项目是从 [pungin/Beanfun](https://github.com/pungin/Beanfun) Fork 的第三方 Beanfun 客户端，主要改进包括多游戏卡片列表展示、OTP 安全机制、UI/UX 优化等。

## 文档结构

```
项目根目录/
├── AGENTS.md              # 本文档 - AI 协作指南
├── README.md              # 项目说明
├── CHANGELOG.md           # 变更记录
├── spec/                  # 功能规格目录（正式文档）
│   ├── README.md          # 规格目录说明
│   ├── overview.md        # 项目概述与架构
│   ├── multi-game-cards.md    # 多游戏卡片功能
│   ├── otp-security.md        # OTP 安全机制
│   ├── ui-ux-optimizations.md # UI/UX 优化
│   └── interaction-improvements.md # 交互改进
└── .trae/documents/       # 设计过程文档（已忽略，仅历史记录）
```

## 核心设计原则

1. **延迟加载** - 只在需要时获取数据，减少不必要的 API 调用
2. **用户控制** - OTP 等敏感操作必须由用户明确触发
3. **安全优先** - 添加多层保护防止账号被封
4. **简洁直观** - 简化 UI，减少不必要的提示和警告

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Element Plus
- **后端**: Rust + Tauri v2
- **状态管理**: Pinia
- **国际化**: vue-i18n

## 关键文件位置

### 新增的核心组件
- `src/components/GameCardFull.vue` - 完整功能游戏卡片
- `src/services/gamePath.ts` - 游戏路径管理服务

### 修改的主要页面
- `src/pages/AccountList.vue` - 账号列表页面（重构为卡片布局）

### 后端命令
- `src-tauri/src/commands/otp.rs` - OTP 获取与速率限制
- `src-tauri/src/commands/launcher.rs` - 游戏启动相关

## 开发规范

### 代码风格
- 前端: ESLint + Prettier
- 后端: `cargo fmt` + `cargo clippy`

### 提交前检查
```bash
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
npm run format:check # Prettier 格式检查
cargo fmt --check    # Rust 格式检查
```

### 文档维护规范

**开发阶段（快速迭代）：**
1. 可在 `.trae/documents/` 目录下创建草稿文档，快速记录想法和方案
2. 用于团队成员间快速对齐目标和设计思路
3. 文档格式可以比较随意，重点是快速沟通

**开发完成后（文档整理）：**
1. 将 `.trae/documents/` 中的关键决策整理到 `spec/` 目录的正式文档
2. 在 `CHANGELOG.md` 中记录变更
3. 确保 `spec/` 目录的正式文档与代码实现一致

**长期维护：**
1. 优先更新 `spec/` 目录的正式文档
2. `.trae/documents/` 中的文档可根据需要保留或清理
3. 新成员入职时，直接参考 `spec/` 目录学习项目

## 常见问题

### OTP 相关
- **Q**: 为什么添加 OTP 速率限制？
- **A**: 防止频繁调用 Beanfun API 导致账号被封

### 游戏卡片相关
- **Q**: 为什么卡片默认收起？
- **A**: 减少初始加载时间，按需加载账号列表

### 窗口自适应相关
- **Q**: 窗口大小如何自动调整？
- **A**: 通过 `ResizeObserver` 监听内容变化，调用 `fitWindow()` 调整

## 参考文档

**正式规格文档（优先参考）：**
- [spec/overview.md](./spec/overview.md) - 项目架构概述
- [spec/multi-game-cards.md](./spec/multi-game-cards.md) - 多游戏卡片功能
- [spec/otp-security.md](./spec/otp-security.md) - OTP 安全机制
- [spec/ui-ux-optimizations.md](./spec/ui-ux-optimizations.md) - UI/UX 优化
- [spec/interaction-improvements.md](./spec/interaction-improvements.md) - 交互改进

## 目录使用说明

### `.trae/documents/` 目录

**用途**：开发阶段快速记录和团队对齐

**适用场景**：
- 快速记录问题分析
- 方案草稿和对比
- 技术决策过程
- 临时的想法记录

**特点**：
- 格式随意，注重快速沟通
- 可用于开发过程中反复修改
- 不需要严格的文档结构

### `spec/` 目录

**用途**：正式的功能规格文档

**适用场景**：
- 功能开发完成后的规格整理
- 新成员了解项目
- 长期维护和参考
- 对外分享项目设计

**特点**：
- 结构清晰，内容完整
- 与代码实现保持一致
- 作为项目的正式文档
