# 单账号游戏 UI 简化计划

## 问题分析

当前单账号游戏的 UI 存在以下问题：

1. **列表形式不合理** - 单账号游戏只会有一个账号，但界面仍然显示：
   - 列表标题 "Service Accounts" + 账号计数
   - 带序号（1）的列表项
   - 拖拽排序手柄（对单账号无意义）
   - 底部的添加按钮（已禁用）

2. **视觉层级混乱** - 一个账号占据了整个列表区域，周围有大量与列表相关的 UI 元素

## 优化方案

### 方案A：单账号卡片化展示（推荐）

当检测到单账号游戏时，将列表区域改为卡片式展示：

**变更内容：**
1. **隐藏列表标题和计数** - 单账号时不需要 "Service Accounts (1)" 标题
2. **隐藏拖拽手柄** - 单账号不需要排序
3. **隐藏序号圆圈** - 不需要显示 "1"
4. **改为卡片布局** - 更大的展示区域，更突出的账号信息
5. **简化底部区域** - 隐藏添加按钮（单账号游戏无法添加）

**视觉对比：**

当前（列表式）：
```
┌─────────────────────────────┐
│ Service Accounts (1)        │ ← 标题冗余
├─────────────────────────────┤
│ ⋮⋮ ① 账号名称        ⋯      │ ← 拖拽手柄和序号无意义
│                             │
├─────────────────────────────┤
│ [+ Add Account]             │ ← 禁用按钮无意义
└─────────────────────────────┘
```

优化后（卡片式）：
```
┌─────────────────────────────┐
│                             │
│      当前游戏账号           │
│                             │
│    ┌─────────────────┐      │
│    │                 │      │
│    │   账号名称       │      │
│    │   状态: 正常     │      │
│    │                 │      │
│    │  [修改别名] [更多信息] │
│    │                 │      │
│    └─────────────────┘      │
│                             │
└─────────────────────────────┘
```

### 方案B：保持列表但简化元素

仅隐藏拖拽手柄和序号，保持列表形式但减少视觉噪音。

## 推荐方案：方案A

理由：
1. 单账号游戏用户不需要"列表"的心智模型
2. 卡片式更符合"当前游戏账号"的语义
3. 可以为单账号游戏提供更多展示空间（如账号详情预览）

## 具体实现

### 修改文件：src/pages/AccountList.vue

#### 1. 添加单账号游戏检测 computed

```typescript
const isSingleAccountGame = computed(() => {
  return accountLimit.value === 1
})
```

#### 2. 条件渲染列表/卡片视图

修改模板逻辑：
- 单账号游戏：显示卡片视图
- 多账号游戏：保持现有列表视图

#### 3. 卡片视图设计

```vue
<!-- 单账号游戏卡片视图 -->
<div v-else-if="isSingleAccountGame && serviceAccounts.length > 0" class="account-list__single-card">
  <div class="account-list__single-card-inner">
    <div class="account-list__single-card-header">
      <span class="account-list__single-card-label">{{ t('accountList.currentAccount') }}</span>
    </div>
    <div class="account-list__single-card-body">
      <p class="account-list__single-card-name">{{ serviceAccounts[0].sname }}</p>
      <p v-if="!serviceAccounts[0].is_enable" class="account-list__single-card-status--banned">
        {{ t('accountList.statusBanned') }}
      </p>
    </div>
    <div class="account-list__single-card-actions">
      <el-button size="small" @click="handleChangeAlias(serviceAccounts[0])">
        {{ t('ChangeAccountName') }}
      </el-button>
      <el-button size="small" @click="handleAccountInfo(serviceAccounts[0])">
        {{ t('GameAccountInfo') }}
      </el-button>
    </div>
  </div>
</div>
```

#### 4. 添加样式

```css
.account-list__single-card {
  padding: 1.5rem;
}

.account-list__single-card-inner {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
}

.account-list__single-card-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.account-list__single-card-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0.75rem 0;
}

.account-list__single-card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1rem;
}
```

#### 5. 隐藏底部添加按钮（单账号游戏）

```vue
<footer v-if="!isSingleAccountGame" class="account-list__list-footer">
  <!-- 原有底部内容 -->
</footer>
```

### 需要添加的国际化文本

```typescript
accountList: {
  currentAccount: '当前游戏账号', // zh-CN
  currentAccount: '當前遊戲賬號', // zh-TW
  currentAccount: 'Current Game Account', // en-US
}
```

## 实施步骤

1. 添加 `isSingleAccountGame` computed
2. 修改模板，添加卡片视图条件分支
3. 添加卡片样式
4. 条件隐藏列表标题、拖拽手柄、序号、添加按钮
5. 添加国际化文本
6. 运行测试验证

## 预期效果

- 单账号游戏界面更简洁，去除列表相关冗余元素
- 账号信息以卡片形式更突出展示
- 多账号游戏保持现有列表视图不变
- 整体视觉层级更清晰
