# 交互体验改进规格

## 改进目标

1. 提升键盘操作效率
2. 增强时间感知
3. 优化自动化体验

## 改进内容

### 1. 2FA 输入框键盘导航

#### 问题

当前 2FA 输入框仅支持基本的输入和退格，缺乏键盘导航功能。

#### 解决方案

**支持的键盘操作**:

| 按键 | 行为 |
|------|------|
| 左右方向键 | 在输入框间移动焦点 |
| Home 键 | 聚焦到第一个输入框 |
| End 键 | 聚焦到最后一个输入框 |
| Delete 键 | 删除当前内容，移动到下一个 |
| Backspace | 删除当前内容，空时移动到上一个 |

**实现**:

```typescript
// src/composables/useOtpInputs.ts

function handleKeydown(event: KeyboardEvent, index: number) {
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      focusInput(index - 1)
      break
    case 'ArrowRight':
      event.preventDefault()
      focusInput(index + 1)
      break
    case 'Home':
      event.preventDefault()
      focusInput(0)
      break
    case 'End':
      event.preventDefault()
      focusInput(inputs.value.length - 1)
      break
    case 'Delete':
      event.preventDefault()
      clearInput(index)
      focusInput(index + 1)
      break
  }
}
```

**效果**:
- 无需鼠标即可完成 OTP 输入
- 提升输入效率
- 符合用户习惯

### 2. TOTP 倒计时同步

#### 问题

用户不知道 OTP 何时会过期，可能在输入时验证码已失效。

#### 解决方案

**策略**: 显示与标准 TOTP 工具同步的倒计时

**原理**:
- TOTP 使用 30 秒时间窗口
- 基于 Unix 时间戳计算
- 与 Google Authenticator、Microsoft Authenticator 等工具同步

**实现**:

```typescript
// src/composables/useTotpCountdown.ts

export function useTotpCountdown() {
  const remainingSeconds = ref(30)
  
  function updateCountdown() {
    const now = Math.floor(Date.now() / 1000)
    remainingSeconds.value = 30 - (now % 30)
  }
  
  onMounted(() => {
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    onUnmounted(() => clearInterval(interval))
  })
  
  return { remainingSeconds }
}
```

**UI 展示**:

```
验证码将在 25 秒后失效
                [=====>          ] 25s
```

**样式**:
- 正常状态：灰色
- 最后 5 秒：红色警告
- 过期时：提示"验证码已更新，请使用新的验证码"

**效果**:
- 用户了解 OTP 有效期
- 及时使用有效验证码
- 减少验证失败

### 3. 自动 OTP 粘贴优化

#### 问题

自动粘贴 OTP 到游戏登录窗口的功能不稳定。

#### 解决方案

**优化策略**:

1. **延迟粘贴**: 等待游戏窗口完全加载
2. **重试机制**: 粘贴失败时自动重试
3. **状态反馈**: 显示粘贴状态

**实现**:

```typescript
// src/composables/useGameLauncher.ts

async function autoPasteOtp(otp: string, options: AutoPasteOptions) {
  const maxRetries = 3
  const retryDelay = 500
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 等待游戏窗口
      await waitForGameWindow(options.windowClass)
      
      // 执行粘贴
      await pasteCredentials({
        account: options.account,
        password: otp,
        className: options.windowClass,
        specialClick: options.specialClick
      })
      
      return { success: true }
    } catch (error) {
      if (i < maxRetries - 1) {
        await delay(retryDelay)
      } else {
        return { success: false, error }
      }
    }
  }
}
```

**用户选项**:

```
☑ 自动粘贴 OTP 并启动游戏
   └─ 粘贴失败时：○ 提示手动输入  ○ 重试
```

**效果**:
- 提高自动粘贴成功率
- 失败时提供备选方案
- 用户可控的自动化程度

## 交互设计原则

### 效率优先

- 减少不必要的鼠标操作
- 支持完整的键盘导航
- 提供快捷操作

### 及时反馈

- 操作结果立即反馈
- 状态变化实时显示
- 错误提示友好明确

### 用户控制

- 自动化功能可关闭
- 提供手动备选方案
- 尊重用户习惯

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/composables/useOtpInputs.ts` | OTP 输入框逻辑 |
| `src/composables/useTotpCountdown.ts` | TOTP 倒计时 |
| `src/composables/useGameLauncher.ts` | 游戏启动与自动粘贴 |
| `src/pages/LoginTotp.vue` | 2FA 输入页面 |

## 测试要点

### 键盘导航测试

- [ ] 左右方向键移动焦点
- [ ] Home 键聚焦第一个
- [ ] End 键聚焦最后一个
- [ ] Delete 键删除并移动
- [ ] Backspace 键正常退格

### 倒计时测试

- [ ] 倒计时与真实 TOTP 同步
- [ ] 最后 5 秒变红警告
- [ ] 过期时正确提示

### 自动粘贴测试

- [ ] 正常粘贴成功
- [ ] 失败后重试机制
- [ ] 手动备选方案可用

## 变更历史

- 2024-XX: 初始改进
  - 添加键盘导航支持
  - 实现 TOTP 倒计时
  - 优化自动粘贴逻辑
