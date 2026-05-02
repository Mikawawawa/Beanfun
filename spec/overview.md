# 项目概述与架构

## 项目背景

本项目是从 [pungin/Beanfun](https://github.com/pungin/Beanfun) Fork 的第三方 Beanfun 客户端，主要目标是：

1. **支持多游戏展示** - 以卡片形式展示所有游戏
2. **提升安全性** - 减少 OTP API 调用，防止账号被封
3. **优化用户体验** - 简化界面，改进交互

## 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Vue 3     │  │   Pinia     │  │   Element Plus      │  │
│  │  (UI 组件)  │  │  (状态管理)  │  │     (UI 库)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  关键组件:                                                   │
│  - GameCardFull.vue    完整功能游戏卡片                      │
│  - AccountList.vue     账号列表页面（重构后）                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Tauri IPC
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        后端 (Backend)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Rust     │  │   Tauri v2  │  │     Commands        │  │
│  │  (业务逻辑)  │  │   (框架)    │  │   (IPC 接口)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  关键模块:                                                   │
│  - commands/otp.rs     OTP 获取与速率限制                    │
│  - commands/launcher.rs 游戏启动与路径管理                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户操作
    │
    ▼
┌─────────────┐
│  Vue 组件   │
└─────────────┘
    │
    │ 调用
    ▼
┌─────────────┐
│   Store     │ (Pinia)
└─────────────┘
    │
    │ 调用
    ▼
┌─────────────┐
│   Commands  │ (Tauri IPC)
└─────────────┘
    │
    │ 调用
    ▼
┌─────────────┐
│  Rust 服务  │
└─────────────┘
    │
    │ HTTP 请求
    ▼
┌─────────────┐
│ Beanfun API │
└─────────────┘
```

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.x | 前端框架 |
| TypeScript | 5.x | 类型系统 |
| Vite | 6.x | 构建工具 |
| Element Plus | 2.x | UI 组件库 |
| Pinia | 3.x | 状态管理 |
| vue-i18n | 11.x | 国际化 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Rust | stable | 后端语言 |
| Tauri | 2.x | 桌面应用框架 |
| reqwest | - | HTTP 客户端 |
| tokio | - | 异步运行时 |

## 核心功能模块

### 1. 多游戏卡片列表

**目标**: 以可展开卡片形式展示所有游戏

**关键组件**:
- `GameCardFull.vue` - 完整功能游戏卡片
- `GamePathService` - 游戏路径管理服务

**设计要点**:
- 卡片默认收起，点击展开
- 展开后才加载账号列表
- 每个卡片独立管理状态

### 2. OTP 安全机制

**目标**: 减少 API 调用，防止账号被封

**关键实现**:
- 前端防抖 (3 秒)
- 后端速率限制 (5 次/分钟)
- 延迟加载策略

**安全策略**:
| 场景 | OTP 调用 |
|------|----------|
| 登录后展示 | ❌ 无 |
| 展开卡片 | ❌ 无 |
| 点击"获取 OTP" | ✅ 1次 |

### 3. UI/UX 优化

**目标**: 简化界面，提升用户体验

**优化内容**:
- 隐藏单账号游戏的限制提示
- 改进加载状态显示
- 窗口自适应内容

### 4. 交互改进

**目标**: 提升操作效率

**改进内容**:
- 2FA 输入框键盘导航
- TOTP 倒计时同步
- 自动 OTP 粘贴

## 项目结构

```
src/
├── components/          # Vue 组件
│   ├── GameCardFull.vue    # 完整功能游戏卡片 (新增)
│   └── ...
├── composables/         # Vue 组合式函数
├── pages/               # 页面组件
│   ├── AccountList.vue     # 账号列表 (重构)
│   └── ...
├── services/            # 前端服务
│   ├── gamePath.ts         # 游戏路径服务 (新增)
│   └── ...
├── stores/              # Pinia 状态管理
├── i18n/                # 国际化
└── ...

src-tauri/
├── src/
│   ├── commands/        # Tauri 命令
│   │   ├── otp.rs          # OTP 相关 (修改)
│   │   ├── launcher.rs     # 启动相关 (修改)
│   │   └── ...
│   └── services/        # Rust 服务
└── ...

spec/                  # 功能规格文档
├── README.md
├── overview.md
├── multi-game-cards.md
├── otp-security.md
├── ui-ux-optimizations.md
└── interaction-improvements.md
```

## 开发规范

### 代码规范

- **前端**: ESLint + Prettier
- **后端**: `cargo fmt` + `cargo clippy`

### 提交前检查

```bash
# 前端检查
npm run typecheck
npm run lint
npm run format:check

# 后端检查
cargo fmt --check
cargo clippy -- -D warnings
```

## 相关文档

- [multi-game-cards.md](./multi-game-cards.md) - 多游戏卡片功能
- [otp-security.md](./otp-security.md) - OTP 安全机制
- [ui-ux-optimizations.md](./ui-ux-optimizations.md) - UI/UX 优化
- [interaction-improvements.md](./interaction-improvements.md) - 交互改进
