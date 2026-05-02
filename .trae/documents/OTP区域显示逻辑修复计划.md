# OTP 区域显示逻辑修复计划

## Bug 分析

### 当前问题
用户取消勾选【传统登录】后，OTP 区域仍然展示。

### 根本原因
OTP 区域的显示**没有**与 `tradLogin` 设置关联。当前 OTP 区域是**无条件显示**的（没有 `v-if` 控制）。

### 逻辑分析

#### `tradLogin` 的作用
- `tradLogin = true`（默认）：直接启动游戏，不需要 OTP
- `tradLogin = false`：通过 OTP 启动游戏（OTP + launch chain）

#### 当前代码逻辑
```typescript
// startGameDirect = true 时，直接启动游戏（不需要 OTP）
const startGameDirect = computed(() => {
  return (tradLogin.value && loginActionType.value === 1) || loginActionType.value === 0
})

// otpLaunchChain = true 时，获取 OTP 后启动游戏
const otpLaunchChain = computed(() => {
  return !tradLogin.value && loginActionType.value === 1
})
```

#### 问题
1. OTP 区域**始终显示**，不管 `tradLogin` 设置如何
2. 当 `tradLogin = true` 时，用户不需要 OTP 功能，但 OTP 区域仍然占用界面空间
3. 当 `tradLogin = false` 时，OTP 区域应该显示（因为需要手动获取 OTP）

## 修复方案

### 方案 1：根据 tradLogin 控制 OTP 区域显示（推荐）

当 `tradLogin = true` 时，隐藏 OTP 区域（因为直接启动游戏，不需要 OTP）。

当 `tradLogin = false` 时，显示 OTP 区域（因为需要通过 OTP 启动游戏）。

```vue
<section v-if="!tradLogin" class="account-list__otp">
  <!-- OTP 内容 -->
</section>
```

### 方案 2：根据 startGameDirect 控制 OTP 区域显示

当 `startGameDirect = true` 时，隐藏 OTP 区域。

当 `startGameDirect = false` 时，显示 OTP 区域。

```vue
<section v-if="!startGameDirect" class="account-list__otp">
  <!-- OTP 内容 -->
</section>
```

### 方案 3：完全移除 OTP 区域（如果确定不需要手动 OTP）

如果用户希望完全自动化，可以：
1. 隐藏 OTP 区域
2. 在点击"开始游戏"时自动获取 OTP
3. 自动启动游戏

## 推荐方案

采用**方案 1**，原因：
1. 符合 `tradLogin` 的语义（传统登录 = 不需要 OTP）
2. 保持向后兼容（用户可以随时切换回传统登录）
3. 界面更简洁

## 实施步骤

### 步骤 1：修改 AccountList.vue 模板
在 OTP 区域添加 `v-if="!tradLogin"` 条件：

```vue
<section v-if="!tradLogin" class="account-list__otp">
  <!-- 现有 OTP 内容 -->
</section>
```

### 步骤 2：验证逻辑
- 当 `tradLogin = true`：OTP 区域隐藏，点击"开始游戏"直接启动
- 当 `tradLogin = false`：OTP 区域显示，点击"开始游戏"获取 OTP 后启动

### 步骤 3：测试
1. 勾选传统登录 → OTP 区域应该隐藏
2. 取消勾选传统登录 → OTP 区域应该显示
3. 点击"开始游戏"验证两种模式都能正常工作

## 最终用户体验

### 场景 1：传统登录（tradLogin = true）
- 界面：简洁，无 OTP 区域
- 操作：选择账号 → 点击"开始游戏" → 游戏直接启动

### 场景 2：OTP 登录（tradLogin = false）
- 界面：显示 OTP 区域
- 操作：选择账号 → 点击"开始游戏" → 自动获取 OTP → 游戏启动
- 或者：手动点击"获取 OTP" → 复制 OTP → 手动输入

## 注意事项
1. `tradLogin` 默认值是 `true`，所以默认情况下 OTP 区域会隐藏
2. 需要确保 `tradLogin` 的计算属性正确工作
3. 保持现有的 `handleGetOtp` 和 `autoPaste` 功能不变
