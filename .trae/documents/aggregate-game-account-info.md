# 游戏和账号信息聚合展示计划

## 当前问题

当前 AccountList 页面的信息分散在多个区域：

1. **游戏信息区**（上方）
   - 游戏图标/图片
   - 游戏名称
   - 在线状态
   - 切换游戏按钮
   - 开始游戏按钮
   - 工具按钮

2. **快捷操作区**
   - Gash 余额
   - 充值链接
   - 会员中心
   - 客服中心

3. **账号列表区**（下方）
   - 账号列表标题
   - 账号列表（或单账号卡片）
   - 添加账号按钮

**问题**：
- 游戏和账号信息物理分离，用户需要在上下区域间来回看
- 单账号游戏时，"开始游戏"按钮和账号信息距离较远
- 视觉层级不够清晰

## 优化方案

### 核心思路：游戏-账号信息聚合卡片

将游戏信息和当前选中的账号信息聚合到一个卡片中，形成"当前游戏+当前账号"的完整上下文。

### 数据流设计（保持清晰）

```
┌─────────────────────────────────────────────────────────────┐
│  数据层 (Store)                                              │
│  ├── gameStore: 当前游戏信息 (gameName, gameImage, etc.)    │
│  ├── accountStore: 账号列表、选中账号、限制信息              │
│  └── configStore: Gash 余额等配置                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  聚合层 (Computed)                                           │
│  ├── currentGameAccount: 整合当前游戏 + 选中账号信息         │
│  └── isSingleAccountGame: 单账号游戏标记                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  展示层 (Template)                                           │
│  ├── GameAccountCard: 游戏+账号聚合卡片                      │
│  ├── QuickActions: 快捷操作（充值、会员中心等）              │
│  └── AccountList/Multi: 多账号时的列表（如有）               │
└─────────────────────────────────────────────────────────────┘
```

### UI 布局变更

**单账号游戏（聚合展示）**：
```
┌─────────────────────────────────────────┐
│  [设置] [关于]                    [X]   │  ← TitleBar
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [游戏图片]  游戏名称            │    │  ← 游戏信息
│  │             ● 在线              │    │
│  ├─────────────────────────────────┤    │
│  │  当前账号: 账号名称              │    │  ← 账号信息
│  │  [修改别名] [账号信息] [查邮箱]  │    │
│  ├─────────────────────────────────┤    │
│  │  Gash: 1,234 点    [开始游戏]   │    │  ← 余额+主要操作
│  └─────────────────────────────────┘    │
│                                         │
│  [充值] [会员中心] [客服] [工具]        │  ← 快捷操作
│                                         │
└─────────────────────────────────────────┘
```

**多账号游戏（保持列表）**：
```
┌─────────────────────────────────────────┐
│  [设置] [关于]                    [X]   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [游戏图片]  游戏名称            │    │  ← 游戏信息卡片
│  │             ● 在线              │    │
│  │  Gash: 1,234 点    [开始游戏]   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  游戏账号 (3)                           │
│  ┌─────────────────────────────────┐    │
│  │ ⋮⋮ ① 账号一            ⋯       │    │  ← 账号列表
│  │ ⋮⋮ ② 账号二            ⋯       │    │
│  │ ⋮⋮ ③ 账号三            ⋯       │    │
│  └─────────────────────────────────┘    │
│  [+ 添加账号]                           │
│                                         │
│  [充值] [会员中心] [客服] [工具]        │
│                                         │
└─────────────────────────────────────────┘
```

### 具体实现

#### 1. 新建聚合组件：GameAccountCard.vue

```vue
<!-- 游戏+账号信息聚合卡片 -->
<template>
  <div class="game-account-card">
    <!-- 游戏信息区 -->
    <div class="game-account-card__game">
      <img v-if="gameImage" :src="gameImage" class="game-account-card__game-image" />
      <div class="game-account-card__game-info">
        <span class="game-account-card__game-name">{{ gameName }}</span>
        <span class="game-account-card__game-status">
          <span class="status-dot" /> {{ statusText }}
        </span>
      </div>
    </div>
    
    <!-- 分割线 -->
    <div v-if="showAccountSection" class="game-account-card__divider" />
    
    <!-- 账号信息区（单账号游戏时） -->
    <div v-if="showAccountSection" class="game-account-card__account">
      <div class="game-account-card__account-header">
        <span class="game-account-card__account-label">{{ t('accountList.currentAccount') }}</span>
      </div>
      <div class="game-account-card__account-body">
        <span class="game-account-card__account-name" :class="{ banned: isBanned }">
          {{ accountName }}
        </span>
        <span v-if="isBanned" class="game-account-card__account-status">
          {{ t('accountList.statusBanned') }}
        </span>
      </div>
      <div class="game-account-card__account-actions">
        <slot name="account-actions" />
      </div>
    </div>
    
    <!-- 底部操作区 -->
    <div class="game-account-card__footer">
      <div class="game-account-card__balance">
        <span class="game-account-card__balance-label">{{ t('accountList.gashBalance') }}</span>
        <span class="game-account-card__balance-value">{{ balance }}</span>
      </div>
      <button class="game-account-card__start-btn" @click="onStartGame">
        {{ t('GameStart') }}
      </button>
    </div>
  </div>
</template>
```

#### 2. 修改 AccountList.vue

**移除的内容**：
- 原有的 `account-list__game` 游戏信息栏
- 原有的 `account-list__quick` 快捷操作区（部分移动到卡片底部）
- 单账号游戏的独立卡片视图

**新增的内容**：
- `GameAccountCard` 组件引用
- 聚合数据传递给卡片组件

**保持不变的**：
- 多账号游戏的列表展示逻辑
- 所有数据流（stores → computed → template）
- 所有事件处理函数

#### 3. 数据流保持清晰

```typescript
// AccountList.vue 中的数据流保持不变

// 1. 从 Store 获取原始数据
const game = useGameStore()
const account = useAccountStore()
const configStore = useConfigStore()

// 2. Computed 聚合展示数据（保持单一职责）
const gameAccountCardData = computed(() => ({
  // 游戏信息
  gameName: gameNameDisplay.value,
  gameImage: gameImageUrl.value,
  gameStatus: 'online',
  
  // 账号信息（单账号游戏时）
  showAccountSection: isSingleAccountGame.value && account.serviceAccounts.length > 0,
  accountName: isSingleAccountGame.value ? account.serviceAccounts[0]?.sname : '',
  isBanned: isSingleAccountGame.value ? !account.serviceAccounts[0]?.is_enable : false,
  
  // 余额
  balance: formattedRemainPoint.value,
}))

// 3. 事件处理保持独立
const handleStartGame = () => { /* ... */ }
const handleChangeAlias = (account: ServiceAccount) => { /* ... */ }
```

### 样式设计

```css
.game-account-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  margin: 0 1rem;
}

.game-account-card__game {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.game-account-card__game-image {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}

.game-account-card__divider {
  height: 1px;
  background: #e5e7eb;
  margin: 1rem 0;
}

.game-account-card__account {
  padding: 0.5rem 0;
}

.game-account-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
```

## 实施步骤

1. **新建组件** `src/components/GameAccountCard.vue`
   - 接收 props：游戏信息、账号信息、余额
   - 提供 slots：账号操作按钮
   - 发出事件：开始游戏

2. **修改** `src/pages/AccountList.vue`
   - 导入 GameAccountCard 组件
   - 移除原有的游戏信息栏
   - 使用 GameAccountCard 替换单账号卡片视图
   - 调整快捷操作区布局

3. **调整样式**
   - 移除冗余样式
   - 添加卡片组件样式

4. **运行测试验证**
   - TypeScript 检查
   - 单元测试

## 预期效果

1. **单账号游戏**：游戏和账号信息在一个卡片内聚合展示，视觉层级清晰
2. **多账号游戏**：游戏信息卡片 + 账号列表，结构分明
3. **数据流清晰**：Store → Computed → Props → Component，单向数据流
4. **组件化**：GameAccountCard 可复用，逻辑内聚
