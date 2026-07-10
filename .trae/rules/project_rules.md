# Project Rules

## Python 环境

Python 3.14.4 安装路径：`C:\Users\李斌\AppData\Local\Programs\Python\Python314\python.exe`

已在用户 PATH 中注册。若终端会话中 `python` 命令不可用（TRAE 启动时继承旧环境），用以下命令刷新当前会话 PATH：

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
```

或直接用全路径调用：

```powershell
& "C:\Users\李斌\AppData\Local\Programs\Python\Python314\python.exe" script.py
```

## GitHub Project Review Skill

skill 路径：`.trae/skills/github-project-review/`

运行 skill 脚本前需刷新 PATH（见上），或用全路径调用 Python。脚本清单：

| 脚本 | 用途 |
|------|------|
| `scripts/collect_repo_context.py` | 收集仓库上下文 |
| `scripts/team_workspace.py` | 初始化/清理团队工作区 |
| `scripts/team_memory.py` | 加载/保存长期记忆 |
| `scripts/team_findings.py` | 写入角色发现 |
| `scripts/team_request.py` | 发送/解决角色间升级 |
| `scripts/team_status.py` | 检查团队状态 |
| `scripts/team_synthesis.py` | 聚合评分 + 生成报告数据 |
| `scripts/create_review_issues.py` | 自动创建 GitHub Issue |
