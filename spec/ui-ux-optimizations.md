# UI/UX 优化规格

## 优化目标

1. 简化界面，减少视觉干扰
2. 提升信息层次清晰度
3. 改进加载状态体验
4. 优化窗口自适应
5. 统一 Vercel 风格设计

## Vercel 风格设计规范

### 颜色系统

```css
:root {
  /* 主色调 */
  --v-color-primary: #000000;
  --v-color-primary-hover: #333333;
  --v-color-primary-light: rgba(0, 0, 0, 0.08);

  /* 背景色 */
  --v-bg-primary: #ffffff;
  --v-bg-secondary: #fafafa;
  --v-bg-tertiary: #f5f5f5;

  /* 边框色 */
  --v-border-primary: #eaeaea;
  --v-border-secondary: #d1d5db;
  --v-border-hover: #000000;

  /* 文字色 */
  --v-text-primary: #111827;
  --v-text-secondary: #333333;
  --v-text-tertiary: #666666;
  --v-text-muted: #999999;

  /* 功能色 */
  --v-success: #22c55e;
  --v-warning: #f59e0b;
  --v-error: #ef4444;
}
```

### 圆角规范

- 小元素（按钮、输入框）: 6px
- 中等元素（卡片、弹窗）: 8px
- 大元素（页面容器）: 12px

### 动画规范

- 时长: 200-300ms
- 缓动函数: ease-out 或 cubic-bezier(0.4, 0, 0.2, 1)
- 属性: 优先使用 transform 和 opacity

### 按钮样式

**主要按钮 (Primary)**:
- 背景: #000000
- 文字: #ffffff
- 圆角: 6px
- Hover: 背景 #333333

**次要按钮 (Secondary)**:
- 背景: #ffffff
- 边框: 1px solid #eaeaea
- 文字: #333333
- Hover: 边框 #000000

## 优化内容

### 1. 单账号游戏提示简化

#### 问题

当游戏只允许添加一个账号时，显示醒目的黄色提示：
- "此游戏最多允许新增账号数:1"

**问题分析**:
- 单账号是游戏规则，不是异常情况
- 黄色警告样式制造不必要的焦虑
- 禁用添加按钮已足够传达信息

#### 解决方案

**策略**: 完全隐藏单账号游戏的限制提示

**实现**:

```typescript
// AccountList.vue
const limitNoticeText = computed<string | null>(() => {
  const notice = account.amountLimitNotice
  if (notice.kind === 'auth_re_login_required') return t('AuthReLogin')
  if (notice.kind === 'other') {
    // 单账号游戏（限制为1）不显示提示
    if (accountLimit.value === 1) return null
    return notice.data
  }
  return null
})
```

**效果**:
- 单账号游戏不再显示黄色警告
- 多账号游戏的限制提示仍然正常显示
- 界面更加简洁

### 2. 加载状态改进

#### 问题

加载账号信息期间显示较大的列表区域，造成视觉空白。

#### 解决方案

**策略**: 条件渲染，加载时只显示紧凑指示器

**实现**:

```vue
<!-- 加载状态 - 紧凑显示 -->
<div v-if="isLoading" class="account-list__loading-compact">
  <el-icon class="account-list__loading-icon"><Loading /></el-icon>
  <span>{{ t('accountList.loading') }}</span>
</div>

<!-- 账号列表 - 加载完成后显示 -->
<section v-else class="account-list__list">
  <!-- 账号列表内容 -->
</section>
```

**样式**:

```css
.account-list__loading-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  color: #9ca3af;
  font-size: 0.875rem;
}

.account-list__loading-icon {
  animation: spin 1s linear infinite;
}
```

**效果**:
- 加载期间不显示大的空白区域
- 紧凑的加载指示器（图标 + 文字）
- 加载完成后平滑过渡

### 3. 窗口自适应优化

#### 问题

游戏卡片展开/收起时，窗口大小不能自动适应内容变化。

#### 解决方案

**策略**: 监听内容变化，自动调整窗口大小

**实现**:

```typescript
// router/index.ts

function attachObserver(): void {
  const root = document.querySelector('[data-window-root]')
  const content = root.querySelector('[data-window-content]')

  observer = new ResizeObserver(() => {
    scheduleOnNextPaint(fitWindow)
  })

  observer.observe(root)
  if (content) observer.observe(content)
}

// 监听窗口 resize 事件
window.addEventListener('resize', handleWindowResize)
```

```typescript
// AccountList.vue

async function toggleGameCard(serviceCode: string, serviceRegion: string) {
  // ... 切换逻辑

  // 等待 DOM 更新后触发窗口调整
  await nextTick()
  window.dispatchEvent(new Event('resize'))
}
```

**效果**:
- 展开卡片时窗口自动增高
- 收起卡片时窗口自动缩小
- 内容变化时实时适应

### 4. 游戏信息聚合展示

#### 问题

游戏信息和账号信息物理分离，用户需要在上下区域间来回看。

#### 解决方案

**策略**: 将游戏信息和当前账号信息聚合到同一卡片

**单账号游戏布局**:

```
┌─────────────────────────────────┐
│ [游戏图片]  游戏名称             │
│            ● 在线               │
├─────────────────────────────────┤
│ 当前账号: 账号名称               │
│ [修改别名] [账号信息] [查邮箱]   │
├─────────────────────────────────┤
│ Gash: 1,234 点    [开始游戏]    │
└─────────────────────────────────┘
```

**多账号游戏布局**:

```
┌─────────────────────────────────┐
│ [游戏图片]  游戏名称             │
│            ● 在线               │
│ Gash: 1,234 点    [开始游戏]    │
└─────────────────────────────────┘

游戏账号 (3)
┌─────────────────────────────────┐
│ ⋮⋮ ① 账号一            ⋯       │
│ ⋮⋮ ② 账号二            ⋯       │
│ ⋮⋮ ③ 账号三            ⋯       │
└─────────────────────────────────┘
```

**效果**:
- 单账号游戏信息聚合，视觉层次清晰
- 多账号游戏结构分明
- 减少用户视线移动

### 5. 空状态优化 (Vercel 风格)

#### 设计规范

空状态遵循 Vercel 风格：

```
[图标 - 灰色]
[标题 - 深灰色]
[描述文字 - 浅灰色]
[操作按钮 - 黑色背景]
```

#### 实现

```vue
<!-- 无游戏空状态 -->
<div class="account-list__empty-vercel">
  <div class="empty-icon-vercel">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  </div>
  <h3 class="empty-title-vercel">{{ t('accountList.noGamesTitle') }}</h3>
  <p class="empty-desc-vercel">{{ t('accountList.noGamesDesc') }}</p>
  <button class="empty-action-btn-vercel" @click="handleOpenAddGame">
    <el-icon><Plus /></el-icon>
    {{ t('accountList.addFirstGame') }}
  </button>
</div>
```

**样式**:

```css
.account-list__empty-vercel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  background: #fafafa;
  border: 1px dashed #eaeaea;
  border-radius: 8px;
}

.empty-icon-vercel {
  width: 64px;
  height: 64px;
  color: #999999;
}

.empty-title-vercel {
  font-size: 1.125rem;
  font-weight: 600;
  color: #333333;
  margin: 0;
}

.empty-desc-vercel {
  font-size: 0.875rem;
  color: #666666;
  margin: 0;
  text-align: center;
  max-width: 300px;
}

.empty-action-btn-vercel {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #000000;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.empty-action-btn-vercel:hover {
  background: #333333;
}
```

### 6. 动画效果

#### 卡片展开/收起动画

```css
/* 卡片展开/收起动画 */
.card-expand-enter-active,
.card-expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 1000px;
  opacity: 1;
  overflow: hidden;
}

.card-expand-enter-from,
.card-expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
```

#### 按钮交互动画

```css
/* 按钮点击动画 */
.launch-btn-compact:active {
  transform: scale(0.96);
}

.header-btn:active {
  transform: scale(0.92);
}

/* 账号卡片选中动画 */
.account-card-vercel {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.account-card-vercel:hover {
  border-color: #d1d5db;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.account-card-vercel.is-selected {
  border-color: #000000;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
```

## 设计原则

### 简洁性

- 移除不必要的提示和警告
- 减少视觉干扰元素
- 保持界面清爽

### 一致性

- 统一的按钮样式（Vercel 风格）
- 统一的间距和圆角
- 统一的色彩系统

### 反馈性

- 加载状态明确
- 操作结果反馈
- 错误提示友好

### 可访问性

- 支持键盘导航
- 快捷键提示
- 清晰的视觉层次

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/pages/AccountList.vue` | 主页面优化 |
| `src/components/GameCardFull.vue` | 游戏卡片组件 |
| `src/components/GameAccountCard.vue` | 游戏账号聚合卡片 |
| `src/router/index.ts` | 窗口自适应逻辑 |
| `src/styles/vercel-theme.css` | Vercel 风格 CSS 变量 |
| `src/components/common/VercelButton.vue` | Vercel 风格按钮组件 |
| `src/components/common/EmptyState.vue` | 空状态组件 |

## 变更历史

- 2024-XX: 初始优化
  - 单账号游戏提示简化
  - 加载状态改进
  - 窗口自适应优化
- 2024-XX: Vercel 风格统一
  - 添加 CSS 变量系统
  - 统一按钮样式
  - 优化空状态设计
  - 添加动画效果
