# 隐藏加载期间的账号列表区域

## 问题分析

当前在加载账号信息期间（`loadState === 'loading'`），用户仍然能看到一个较大的账号列表区域，显示 "Loading..." 文本。这造成了视觉上的空白和不确定性。

## 解决方案

### 方案：条件渲染整个列表区域

当 `loadState === 'loading'` 时，完全不渲染账号列表区域，只显示一个紧凑的加载指示器。

### 具体实现

修改 `AccountList.vue`：

1. **添加加载状态检测**：
```typescript
const isLoading = computed(() => loadState.value === 'loading')
```

2. **条件渲染列表区域**：
```vue
<!-- 账号列表区域 - 加载时不显示 -->
<section v-if="!isLoading && !isSingleAccountGame" class="account-list__list">
  <!-- 原有内容 -->
</section>

<!-- 加载状态指示器 - 紧凑显示 -->
<div v-if="isLoading" class="account-list__loading-compact">
  <el-icon class="account-list__loading-icon"><Loading /></el-icon>
  <span>{{ t('accountList.loading') }}</span>
</div>
```

3. **添加紧凑样式**：
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

## 预期效果

- 加载期间不显示大的列表区域
- 只显示紧凑的加载指示器（图标 + 文字）
- 加载完成后平滑过渡到实际内容
