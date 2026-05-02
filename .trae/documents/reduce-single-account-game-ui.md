# 优化单账号游戏UI显示计划

## 问题分析

当前当游戏只允许添加一个账号时，会在账号列表底部显示醒目的黄色提示文本（`account-list__limit-notice`），例如：
- "此遊戲最多允許新增帳號數:1"
- "此游戏最多允许新增账号数:1"

这个提示对于单账号游戏来说过于醒目，因为：
1. 用户只能添加一个账号是预期行为，不需要特别提醒
2. 黄色警告样式的提示会制造不必要的焦虑感
3. 当用户已经有一个账号时，添加按钮会被禁用，这已经足够说明问题

## 优化方案

### 方案A：完全隐藏单账号游戏的限制提示（推荐）

当检测到限制数量为1时，不显示任何提示文本。因为：
- 单账号是游戏规则，不是异常情况
- 禁用添加按钮已经传达了足够的信息
- 界面更加简洁

### 方案B：弱化提示样式

如果必须显示提示，可以：
- 将黄色警告色改为灰色提示色
- 减小字体大小
- 放在更不显眼的位置

## 具体实现

### 修改文件：src/pages/AccountList.vue

#### 1. 修改 `limitNoticeText` computed

当前逻辑：
```typescript
const limitNoticeText = computed<string | null>(() => {
  const notice = account.amountLimitNotice
  if (notice.kind === 'auth_re_login_required') return t('AuthReLogin')
  if (notice.kind === 'other') return notice.data
  return null
})
```

修改为：
```typescript
const limitNoticeText = computed<string | null>(() => {
  const notice = account.amountLimitNotice
  if (notice.kind === 'auth_re_login_required') return t('AuthReLogin')
  if (notice.kind === 'other') {
    // 单账号游戏（限制为1）不显示提示，因为单账号是预期行为
    if (accountLimit.value === 1) return null
    return notice.data
  }
  return null
})
```

#### 2. 可选：修改样式（如果采用方案B）

修改 `.account-list__limit-notice` 的样式，使其不那么醒目。

## 实施步骤

1. 修改 `src/pages/AccountList.vue` 中的 `limitNoticeText` computed
2. 运行测试确保没有破坏现有功能
3. 验证效果

## 预期效果

- 单账号游戏（如某些特定游戏）不再显示"此游戏最多允许新增账号数:1"的黄色提示
- 用户仍然会看到禁用的添加按钮，这足以传达无法添加更多账号的信息
- 多账号游戏的限制提示仍然正常显示
