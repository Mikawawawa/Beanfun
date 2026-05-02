# 诊断自动输入 OTP 不生效问题

## 问题描述
用户取消勾选"传统登录"后，点击"开始游戏"，OTP 没有自动输入到游戏中。

## 分析结果

### 发现的问题

**关键问题：`launchGame` 参数传递错误**

在 `useGameLauncher.ts` 第 354 行：
```typescript
await wrapCommand(commands.launchGame(gamePath, mode, ini.exe, accountId, password))
```

**问题分析：**
1. `ini.exe` 是完整的命令行（包含游戏路径和参数），例如：`"C:\Games\MapleStory\MapleStory.exe" /u:%s /p:%s`
2. `gamePath` 是单独解析的游戏路径，例如：`"C:\Games\MapleStory\MapleStory.exe"`
3. `launchGame` 的第三个参数应该是 `commandLineTemplate`（命令行模板，包含 `%s` 占位符），例如：`/u:%s /p:%s`

**WPF 参考实现：**
- WPF 在 `MainWindow.xaml.cs` L536-545 使用正则表达式将 `exe` 分割为 `game_exe` 和 `game_commandLine`
- `game_exe` 是游戏可执行文件路径
- `game_commandLine` 是命令行参数模板（包含 `%s` 占位符）

**Tauri 当前实现的问题：**
- 前端传入 `ini.exe` 作为 `commandLineTemplate`，这是完整的命令行，不是模板
- 后端 `build_command_line` 函数会检查 `template.is_empty() || account.is_empty() || password.is_empty()`
- 由于 `ini.exe` 不为空，但不是有效的模板格式（应该是参数部分而不是完整路径），导致替换失败

## 修复方案

### 方案 1：前端分割 `ini.exe`
在 `useGameLauncher.ts` 中，像 WPF 一样分割 `ini.exe`：
1. 使用正则表达式 `(.*).exe` 提取游戏路径
2. 使用正则表达式 `.exe (.*)` 提取命令行参数模板
3. 将分割后的参数模板传入 `launchGame`

### 方案 2：后端处理
修改后端 `launch_game` 命令，接收完整的 `exe` 字符串并自行分割。

### 推荐方案：方案 1（前端分割）
- 保持与 WPF 一致的逻辑
- 前端负责解析 INI 数据，后端保持简单

## 实施步骤

1. **修改 `useGameLauncher.ts`**
   - 添加函数分割 `ini.exe` 为游戏路径和命令行模板
   - 修改 `runGame` 函数，传入正确的参数

2. **添加日志**（用于验证修复）
   - 在前端添加日志，记录分割后的参数
   - 在后端添加日志，记录构建的命令行

3. **测试**
   - 测试自动登录模式（tradLogin = false）
   - 验证 OTP 是否正确传递到游戏
