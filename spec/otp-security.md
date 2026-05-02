# OTP 安全机制规格

## 概述

为防止频繁调用 Beanfun OTP API 导致账号被封，实施多层安全机制。

## 风险分析

### OTP 获取流程

当前 OTP 获取涉及 5 步 HTTP 序列：
1. `game_start_step2.aspx` - 获取 longPollingKey
2. `get_cookies.ashx` - 获取 m_strSecretCode
3. `record_service_start.ashx` - 记录服务启动
4. `get_result.ashx` - 长轮询触发
5. `get_webstart_otp.ashx` - 获取 OTP 密文并解密

### 风险点

- 频繁调用可能触发 Beanfun 风控机制
- 短时间内多次请求可能被视为异常行为
- 可能导致账号临时或永久封禁

## 安全策略

### 策略 1: 延迟加载（设计层面）

**原则**: 只在用户明确需要时才获取 OTP

| 场景 | 原行为 | 新行为 | OTP 调用 |
|------|--------|--------|----------|
| 登录后展示 | 自动加载默认游戏账号 | 只加载游戏列表 | ❌ 无 |
| 切换游戏 | 重新加载账号列表 | 导航到新页面，按需加载 | ❌ 无 |
| 展开卡片 | - | 加载账号列表 | ❌ 无 |
| 点击"获取 OTP" | 立即获取 | 用户点击后才获取 | ✅ 1次 |
| 点击"启动游戏" | 根据配置决定 | 同上 | 根据配置 |

### 策略 2: 前端防抖（交互层面）

**实现**: 3 秒内禁止重复点击

```typescript
const lastOtpTime = ref<number>(0)

async function handleGetOtp() {
  const now = Date.now()
  if (now - lastOtpTime.value < 3000) {
    return  // 忽略快速点击
  }
  lastOtpTime.value = now
  // ... 获取 OTP
}
```

**效果**:
- 防止用户误触重复请求
- 提供视觉反馈（按钮禁用状态）

### 策略 3: 后端速率限制（服务层面）

**实现**: 每分钟最多 5 次请求

```rust
// 速率限制器
static OTP_RATE_LIMITER: Mutex<Option<HashMap<String, Vec<Instant>>>> = 
    Mutex::new(None);

const OTP_RATE_LIMIT: usize = 5;  // 最大请求数
const OTP_RATE_WINDOW: Duration = Duration::from_secs(60);  // 时间窗口

fn check_otp_rate_limit(account_sid: &str) -> Result<(), CommandError> {
    // 清理过期请求记录
    // 检查是否超过限制
    // 记录本次请求
}
```

**错误处理**:
- 超过限制时返回 `otp.rate_limit_exceeded`
- 前端静默处理，不显示错误提示（避免用户焦虑）

## 技术实现

### 前端实现

#### 防抖逻辑

```typescript
// src/components/GameCardFull.vue

const otpLoading = ref(false)
const lastOtpTime = ref<number>(0)

async function handleGetOtp() {
  if (!selectedAccount.value) {
    ElMessage.warning('请先选择账号')
    return
  }
  
  // 防抖检查
  const now = Date.now()
  if (now - lastOtpTime.value < 3000) {
    return
  }
  lastOtpTime.value = now
  
  otpLoading.value = true
  try {
    otp.value = await accountStore.getOtp(selectedAccount.value)
    await navigator.clipboard.writeText(otp.value)
    ElMessage.success('OTP 已复制到剪贴板')
  } catch (error) {
    ElMessage.error('获取 OTP 失败')
  } finally {
    otpLoading.value = false
  }
}
```

### 后端实现

#### 速率限制器

```rust
// src-tauri/src/commands/otp.rs

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

static OTP_RATE_LIMITER: Mutex<Option<HashMap<String, Vec<Instant>>>> = 
    Mutex::new(None);

const OTP_RATE_LIMIT: usize = 5;
const OTP_RATE_WINDOW: Duration = Duration::from_secs(60);

fn check_otp_rate_limit(account_sid: &str) -> Result<(), CommandError> {
    let mut guard = OTP_RATE_LIMITER.lock().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    
    let now = Instant::now();
    let requests = map.entry(account_sid.to_string()).or_insert_with(Vec::new);
    
    // 移除时间窗口外的旧请求
    requests.retain(|&t| now.duration_since(t) < OTP_RATE_WINDOW);
    
    // 检查是否超过限制
    if requests.len() >= OTP_RATE_LIMIT {
        return Err(CommandError::new(
            "otp.rate_limit_exceeded",
            "OTP request rate limit exceeded",
        ));
    }
    
    // 记录本次请求
    requests.push(now);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_otp(
    state: State<'_, AppState>,
    account: ServiceAccount,
) -> Result<String, CommandError> {
    // 先检查速率限制
    check_otp_rate_limit(&account.sid)?;
    
    // 继续获取 OTP...
}
```

## 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 登录后 OTP 调用 | 可能多次 | 0 次 |
| 切换游戏 OTP 调用 | 可能多次 | 0 次 |
| 正常启动 OTP 调用 | 1 次 | 1 次（必要） |
| 快速重复点击 | 多次请求 | 被防抖阻止 |
| 异常高频请求 | 无限制 | 被速率限制阻止 |

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/components/GameCardFull.vue` | 前端防抖实现 |
| `src-tauri/src/commands/otp.rs` | 后端速率限制 |

## 注意事项

1. **用户教育**: 不需要向用户解释这些机制，避免制造焦虑
2. **错误处理**: 速率限制错误静默处理，不显示提示
3. **监控**: 可考虑添加日志监控异常请求模式

## 变更历史

- 2024-XX: 初始实现
  - 添加前端防抖（3秒）
  - 添加后端速率限制（5次/分钟）
  - 实施延迟加载策略
