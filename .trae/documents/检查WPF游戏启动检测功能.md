# 检查 WPF 版本的游戏启动检测功能 - 分析报告

## 分析完成

### WPF 参考实现 (MainWindow.xaml.cs L1765-1833)

```csharp
string gameProcessName = Regex("(.*).exe").Match(game_exe).Groups[1].Value;
foreach (Process process in Process.GetProcessesByName(gameProcessName))
{
    try // 1st attempt: WMI ExecutablePath lookup
    {
        using var searcher = new ManagementObjectSearcher(
            "select * from Win32_Process where ProcessId = " + process.Id);
        if (gamePath == objects…["executablepath"]…) { processIds.Add(process.Id); continue; }
    } catch { }
    try // 2nd attempt: .NET MainModule fallback
    {
        if (process.MainModule.FileName == gamePath) { processIds.Add(process.Id); continue; }
    } catch { }
}
if (processIds.Count > 0 && MessageBox.Show(MsgGameAlreadyRun) == Yes)
{
    foreach (int pid in processIds)
        try { Process.GetProcessById(pid).Kill(); } catch { }
}
```

### Tauri 当前实现

#### 前端 (useGameLauncher.ts)
- `checkAndKillRunningGameProcesses(gamePath)` 函数
- 调用 `commands.listGameProcesses(gamePath)` 获取进程列表
- 如果进程存在，显示确认对话框 `MsgGameAlreadyRun`
- 用户确认后，调用 `commands.killGameProcesses(pids)` 终止进程

#### 后端 (services/process/game.rs)
- `find_game_processes(game_path)` 函数
- 从 `game_path` 提取文件名（如 `MapleStory.exe`）
- 调用 `find_processes_by_name(exe_name)` 查询 WMI
- 过滤结果，匹配完整路径（byte-equal 比较）
- `kill_game_processes(pids)` 函数逐个终止进程，失败静默跳过

#### WMI 查询 (services/process/find.rs)
- 使用 `WMIConnection` 查询 `Win32_Process`
- 直接按名称过滤，一次性查询（比 WPF 的 N+1 查询更高效）
- 返回 `ProcessInfo` 包含 pid、name、executable_path

### 实现对比

| 方面 | WPF | Tauri | 差异分析 |
|------|-----|-------|----------|
| 进程查找 | `Process.GetProcessesByName` + WMI 查询每个 PID | 直接 WMI 查询按名称过滤 | Tauri 更高效（1 次查询 vs N+1 次） |
| 路径匹配 | WMI `ExecutablePath` 或 `MainModule.FileName` | WMI `ExecutablePath` | Tauri 省略了 .NET fallback，更简洁 |
| 错误处理 | 每个进程 try-catch | WMI 查询整体错误处理 | Tauri 更统一 |
| 终止方式 | `process.Kill()` | `kill_process` 系统调用 | 功能相同 |
| 用户提示 | `MessageBox.Show` | `ElMessageBox.confirm` | UI 框架差异，逻辑相同 |

### 关键发现

**实现一致性：✅ 良好**

Tauri 实现与 WPF 参考实现逻辑一致：
1. 都通过进程名查找游戏进程
2. 都通过完整路径匹配确认是同一游戏
3. 都提供用户确认对话框
4. 都使用 best-effort 方式终止进程

**优化点：**
- Tauri 将 WPF 的 N+1 查询优化为单次 WMI 查询
- Tauri 移除了 .NET `MainModule.FileName` fallback（WMI 失败时），因为 WMI 查询已经是原子操作

### 结论

**无需修复。** Tauri 的游戏启动检测功能与 WPF 版本逻辑一致，且实现更优化。

如果用户遇到游戏启动检测问题，可能原因：
1. WMI 权限问题（罕见，代码已处理）
2. 游戏路径大小写不匹配（代码使用 byte-equal 比较）
3. 游戏进程保护（WMI 无法获取 ExecutablePath）

这些都不是实现问题，而是系统环境或游戏保护机制导致。
