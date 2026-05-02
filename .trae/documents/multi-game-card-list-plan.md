# AccountList 游戏卡片完整功能设计方案

## 目标

在现有 `AccountList.vue` 基础上，以**完整功能卡片**方式展示多个游戏。每个卡片是一个独立区域，包含该游戏的所有操作：账号列表、OTP获取、游戏启动等。同时**尽可能减少OTP相关的API调用**。

---

## 当前架构分析

### 1. 现有数据流

```
登录成功
  ↓
AccountList.vue 挂载
  ↓
setupGameOnMount() → game.loadGames() → list_games (后端命令)
  ↓
获取游戏目录 (INI + ServiceList)
  ↓
选择游戏 → selectActiveGame() → setActiveService() → loadList()
  ↓
获取该游戏的账号列表 (getServiceAccounts)
```

### 2. OTP API调用点

当前OTP获取流程涉及**5步HTTP序列**：
1. `game_start_step2.aspx` - 获取longPollingKey
2. `get_cookies.ashx` - 获取m_strSecretCode
3. `record_service_start.ashx` - 记录服务启动
4. `get_result.ashx` - 长轮询触发
5. `get_webstart_otp.ashx` - 获取OTP密文并解密

**风险点**：频繁调用OTP API可能触发Beanfun的风控机制。

---

## 设计方案

### 核心原则

1. **卡片即完整单元**：每个游戏卡片包含该游戏的所有操作功能
2. **延迟加载**：只在用户明确需要时才获取OTP
3. **按需加载**：卡片初始只显示基础信息，展开后才加载账号列表
4. **在现有界面拓展**：在AccountList.vue上增加可展开的游戏卡片列表

### 新架构设计

```
登录成功
  ↓
AccountList.vue 挂载
  ↓
加载所有游戏列表（一次性，可缓存）
  ↓
展示：游戏卡片纵向列表（默认收起状态）
  ↓
用户展开某个游戏卡片
  ↓
加载该游戏的账号列表（不获取OTP）
  ↓
在卡片内展示：账号列表 + OTP区域 + 启动按钮
  ↓
用户点击"获取OTP"或"启动游戏"时才触发OTP流程
```

### 关键变更

#### 1. 游戏路径配置抽象

每个游戏都需要配置路径，核心能力抽象如下：

**路径管理服务 (`GamePathService`)**
```typescript
// src/services/gamePath.ts
interface GamePathService {
  // 获取游戏路径（先Config，后注册表）
  getPath(gameCode: string, ini: GameIniEntry): Promise<string | null>
  
  // 设置用户自定义路径
  setPath(gameCode: string, dirValueName: string, path: string): Promise<void>
  
  // 检测游戏是否已安装（路径有效）
  isInstalled(gameCode: string, ini: GameIniEntry): Promise<boolean>
}
```

**路径检测流程（复用现有 `detect_game_path`）**
```
getPath(gameCode, ini):
  1. 读取 Config.xml: `{dir_value_name}.{gameCode}`
  2. 如果存在且有效 → 返回
  3. 如果 ini.dir_reg 存在 → 查询注册表
  4. 如果找到 → 写入Config并返回
  5. 返回 null（未安装）
```

#### 2. 新增组件

| 组件 | 路径 | 功能 |
|------|------|------|
| `GameCardFull.vue` | `src/components/GameCardFull.vue` | 完整功能游戏卡片（可展开）|

#### 3. AccountList.vue 界面调整

**当前布局：**
```
┌─────────────────────────────┐
│  TitleBar                   │
├─────────────────────────────┤
│  GameAccountCard (游戏信息)  │
├─────────────────────────────┤
│  账号列表                    │
├─────────────────────────────┤
│  OTP区域                     │
└─────────────────────────────┘
```

**新布局：**
```
┌─────────────────────────────┐
│  TitleBar                   │
├─────────────────────────────┤
│  ▼ 新枫之谷 (已展开)         │ ← 游戏卡片（展开状态）
│    ┌─────────────────────┐  │
│    │ 账号列表              │  │
│    │ - account1          │  │
│    │ - account2          │  │
│    ├─────────────────────┤  │
│    │ [获取OTP] [启动游戏]  │  │
│    │ 自动粘贴 [开关]       │  │
│    └─────────────────────┘  │
├─────────────────────────────┤
│  ▶ 跑跑卡丁车 (已收起)       │ ← 游戏卡片（收起状态）
├─────────────────────────────┤
│  ▶ 天堂 (已收起)            │
└─────────────────────────────┘
```

#### 4. 完整功能游戏卡片设计

**GameCardFull.vue**
```vue
<template>
  <div class="game-card-full" :class="{ 'is-expanded': isExpanded }">
    <!-- 卡片头部（始终显示） -->
    <div class="card-header" @click="toggleExpand">
      <img :src="bannerUrl" :alt="game.service.name" class="game-banner" />
      <div class="header-info">
        <h3 class="game-name">{{ game.service.name }}</h3>
        <div class="header-meta">
          <span v-if="accountCount > 0" class="account-count">
            {{ accountCount }} 个账号
          </span>
          <span v-if="!isInstalled" class="path-warning">未设置路径</span>
        </div>
      </div>
      <div class="expand-icon">
        <ChevronDown v-if="isExpanded" />
        <ChevronRight v-else />
      </div>
    </div>
    
    <!-- 卡片内容（展开时显示） -->
    <div v-if="isExpanded" class="card-body">
      <!-- 未设置路径提示 -->
      <div v-if="!isInstalled" class="path-setup">
        <p>未检测到游戏路径，请设置游戏安装路径</p>
        <button @click="handleSetPath">设置路径</button>
      </div>
      
      <!-- 账号列表 -->
      <div v-else class="account-section">
        <div class="account-list">
          <AccountItem
            v-for="account in accounts"
            :key="account.id"
            :account="account"
            @launch="handleLaunch(account)"
          />
        </div>
        
        <!-- 添加账号按钮 -->
        <button class="add-account-btn" @click="showAddAccount = true">
          + 添加账号
        </button>
        
        <!-- OTP区域 -->
        <div class="otp-section">
          <div class="otp-display">
            <span v-if="otp" class="otp-code">{{ otp }}</span>
            <span v-else class="otp-placeholder">点击获取OTP</span>
          </div>
          <button 
            class="otp-btn" 
            @click="handleGetOtp"
            :disabled="otpLoading"
          >
            {{ otpLoading ? '获取中...' : '获取OTP' }}
          </button>
        </div>
        
        <!-- 启动选项 -->
        <div class="launch-options">
          <label class="auto-paste-option">
            <input type="checkbox" v-model="autoPaste" />
            自动粘贴OTP并启动游戏
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 路径检测逻辑
const pathState = ref<'checking' | 'installed' | 'not-installed'>('checking')
const gamePath = ref<string | null>(null)

// 展开状态
const isExpanded = ref(false)

// 账号列表
const accounts = ref<ServiceAccount[]>([])
const accountCount = computed(() => accounts.value.length)

// OTP
const otp = ref('')
const otpLoading = ref(false)

// 自动粘贴
const autoPaste = ref(false)

onMounted(async () => {
  // 检测游戏路径
  gamePath.value = await gamePathService.getPath(gameCode, props.game.ini)
  pathState.value = gamePath.value ? 'installed' : 'not-installed'
})

// 展开/收起
async function toggleExpand() {
  isExpanded.value = !isExpanded.value
  
  // 展开时加载账号列表
  if (isExpanded.value && accounts.value.length === 0) {
    await loadAccounts()
  }
}

// 加载账号列表（不涉及OTP）
async function loadAccounts() {
  accounts.value = await accountStore.getServiceAccounts(
    props.game.service.service_code,
    props.game.service.service_region
  )
}

// 获取OTP（用户点击时才调用）
async function handleGetOtp() {
  otpLoading.value = true
  try {
    otp.value = await accountStore.getOtp(
      props.game.service.service_code,
      props.game.service.service_region,
      selectedAccount.value.id
    )
  } finally {
    otpLoading.value = false
  }
}

// 启动游戏
async function handleLaunch(account: ServiceAccount) {
  if (autoPaste.value) {
    // 先获取OTP
    await handleGetOtp()
    // 然后启动游戏并自动粘贴
    await launchGameWithOtp(account, otp.value)
  } else {
    // 直接启动游戏
    await launchGame(account)
  }
}

// 设置路径
async function handleSetPath() {
  const path = await selectGamePath()
  if (path) {
    await gamePathService.setPath(gameCode, props.game.ini.dir_value_name, path)
    gamePath.value = path
    pathState.value = 'installed'
    // 设置路径后加载账号列表
    await loadAccounts()
  }
}
</script>
```

#### 5. AccountList.vue 功能调整

**新增功能：**
- 游戏卡片纵向列表（可展开/收起）
- 每个卡片独立管理自己的账号列表
- 每个卡片独立管理自己的OTP状态
- 卡片内完成所有游戏相关操作

**移除功能：**
- 移除原有的 GameAccountCard（功能合并到卡片头部）
- 移除原有的账号列表区域（功能合并到卡片内）
- 移除原有的OTP区域（功能合并到卡片内）
- 移除"切换游戏"按钮（改为展开/收起卡片）
- 移除 GameList.vue 弹窗（功能合并到卡片列表）

**保留功能：**
- 添加/删除账号（在卡片内完成）
- 修改账号别名（在卡片内完成）
- 获取OTP按钮（关键：只在点击时才调用API）
- 启动游戏按钮（在卡片内完成）
- 自动粘贴选项（在卡片内完成）

### 6. 数据结构

```typescript
// 前端 Store 扩展
interface GameCardState {
  service: GameService
  ini: GameIniEntry
  isExpanded: boolean
  isLoading: boolean
  accounts: ServiceAccount[]
  otp: string
  otpLoading: boolean
  autoPaste: boolean
  gamePath: string | null
  pathState: 'checking' | 'installed' | 'not-installed'
}

// useGameStore 扩展
const useGameStore = defineStore('game', () => {
  // 现有状态...
  
  // 新增：所有游戏卡片的状态
  const gameCards = ref<Record<string, GameCardState>>({})
  
  // 初始化游戏卡片状态
  async function initGameCards(games: GameService[], inis: GameIniEntry[])
  
  // 展开/收起卡片
  async function toggleGameCard(serviceCode: string, serviceRegion: string)
  
  // 加载指定卡片的账号列表
  async function loadGameCardAccounts(serviceCode: string, serviceRegion: string)
})
```

### 7. 后端新增命令

```rust
// src-tauri/src/commands/account.rs

/// 批量获取多个游戏的账号列表
/// 用于初始化时快速加载所有游戏的账号数量
#[tauri::command]
pub async fn get_games_account_summary(
    state: State<'_, AppState>
) -> Result<HashMap<String, Vec<ServiceAccount>>, CommandError> {
    // 返回每个游戏的账号列表，不涉及OTP
    // key格式: "{service_code}_{service_region}"
}
```

### 8. OTP调用优化策略

| 场景 | 原行为 | 新行为 | OTP调用 |
|------|--------|--------|---------|
| 登录后展示 | 自动加载默认游戏的账号列表 | 加载所有游戏卡片（收起状态） | ❌ 无 |
| 展开卡片 | - | 加载该游戏账号列表 | ❌ 无 |
| 切换游戏 | 打开弹窗选择，重新加载 | 收起当前卡片，展开目标卡片 | ❌ 无 |
| 点击"获取OTP" | 立即获取OTP | 用户点击后才获取 | ✅ 1次 |
| 点击"启动游戏" | 根据配置决定是否获取OTP | 同上 | 根据配置 |

### 9. 防封号措施

1. **OTP调用频率限制**
   - 前端：添加防抖，连续点击间隔至少3秒
   - 后端：添加速率限制，单个账号每分钟最多5次OTP请求

2. **异常行为检测**
   - 监控短时间内多次OTP请求
   - 超过阈值时静默处理

### 10. 向后兼容

- 保留原有的游戏切换逻辑作为fallback
- 用户可通过设置选择界面模式（卡片列表/传统视图）
- 原有OTP流程保持不变，只是调用时机延后

---

## 实施步骤

### Phase 1: 基础架构
1. 创建 `GamePathService` 路径服务抽象层
2. 创建 `GameCardFull.vue` 完整功能卡片组件

### Phase 2: 后端API
1. 新增 `get_games_account_summary` 命令
2. 添加OTP调用频率限制

### Phase 3: AccountList.vue 改造
1. 集成 GameCardFull 组件
2. 移除原有的 GameAccountCard、账号列表、OTP区域
3. 调整游戏切换逻辑为展开/收起卡片

### Phase 4: 优化与测试
1. 添加防抖和频率限制
2. 性能测试（大量游戏时的渲染性能）
3. 安全测试（OTP调用频率控制）

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| OTP调用仍可能被封号 | 高 | 添加频率限制、异常检测 |
| 卡片过多导致页面过长 | 中 | 虚拟滚动、懒加载 |
| 用户不习惯新界面 | 低 | 保留传统视图选项 |

---

## 总结

本方案通过以下方式减少OTP API调用：

1. **延迟OTP获取**：只在用户明确需要时（点击"获取OTP"或"启动游戏"）才调用
2. **卡片独立管理**：每个卡片独立管理自己的状态，切换游戏不触发OTP
3. **按需加载**：卡片初始收起，展开时才加载账号列表
4. **频率控制**：前后端双重防抖和速率限制

预期效果：
- 登录后OTP调用次数：**从可能多次减少到0次**
- 切换游戏OTP调用次数：**从可能多次减少到0次**
- 正常游戏启动OTP调用次数：**保持1次（必要）**
