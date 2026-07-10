# GitHub 项目评审 Skill

> TRAE / Codex / Qoder AI agent 技能，用于对 GitHub 项目进行结构化的多智能体推广就绪评审。

在推广、发布、社区运营或投入更多工程/营销精力**之前**，使用本技能对 GitHub 项目进行结构化的多智能体可行性评审。

## 它能做什么

给定一个 GitHub 仓库（`owner/repo`、URL 或本地克隆路径），本技能会运行一个 **7 角色协作团队评审**，具备共享内存、角色间升级机制，并产出统一的 go/no-go 报告。

1. **采集**仓库上下文 — 元数据、README、文件树、依赖/配置文件、最近提交、issues、贡献者、语言分布、CI/安全文件。
2. **初始化团队工作区**，建立共享内存结构（session、mailbox、synthesis）。
3. **派发七个评审角色**，各自写入结构化发现，并根据发现的内容向其他角色发起升级。
4. **处理升级** — P0 升级必须在综合阶段前解决。
5. **综合**发现为一份简洁的 go/no-go 报告，附带有证据支撑的评分（1-10 评分标准）和推广结论：
   - **可以推广** — 无 P0 阻碍项，核心故事清晰，安装/演示路径可用或可信。
   - **小范围试推广** — 有潜力，但存在 P1 质量/文档/运维缺口。
   - **暂不建议推广** — 存在 P0 阻碍项，核心价值不清，或安全/可靠性风险较高。
6. **（可选）创建 GitHub Issue**，针对测试工程师发现的可操作测试缺口。

## 七个评审角色

| 角色 | 关注点 | 关键产出 |
|---|---|---|
| A — 计划分析师 (Planning Analyst) | 路线图、里程碑、执行追踪 | 计划评分、计划缺口 |
| B — 前端工程师 (Frontend Engineer) | 前端架构、组件、构建 | 前端评分、阻碍项 |
| C — 后端工程师 (Backend Engineer) | API 设计、数据模型、错误处理 | 后端评分、阻碍项 |
| D — 测试工程师 (Test Engineer) | 测试覆盖、测试策略、CI 门禁 | 测试评分、待提交 Issue |
| E — 代码评审员 (Code Reviewer) | 代码质量、规范、技术债务 | 代码质量评分、发现项 |
| F — 产品与市场 (Product & Market) | 定位、差异化、社区 | 产品评分、推广叙事 |
| G — 安全与运维 (Security & DevOps) | CI/CD、安全、依赖、合规 | 安全评分、P0/P1 风险 |

角色之间可以互相升级发现。例如，后端工程师发现 SQL 字符串拼接，会升级给安全角色（P0）。完整的路由矩阵见 [`references/collaboration-protocol.md`](references/collaboration-protocol.md)。

## 仓库结构

```
.
├── SKILL.md                              # 技能定义（6 阶段工作流 + 7 角色规范 + 升级触发器）
├── agents/
│   └── openai.yaml                       # Agent 接口元数据（跨平台）
├── references/
│   ├── evaluation-rubric.md              # 1-10 评分定义 + P0/P1 示例（7 角色）
│   ├── report-template.md                # 最终报告模板（7 维度 + 升级记录）
│   └── collaboration-protocol.md         # 升级路由矩阵 + 完整示例
├── scripts/
│   ├── collect_repo_context.py           # 数据采集器（gh CLI + GITHUB_TOKEN 降级）
│   ├── create_review_issues.py           # Issue 创建器（测试工程师用）
│   ├── team_workspace.py                 # 团队工作区 init/status/clean
│   ├── team_findings.py                  # 角色发现读写 + mark-na
│   ├── team_request.py                   # 角色间请求与升级
│   ├── team_status.py                    # 团队看板 + 完成度检查
│   └── team_synthesis.py                # 评分聚合 + 报告数据
└── tests/
    ├── test_collect_repo_context.py      # 采集器单元测试
    ├── test_create_review_issues.py      # Issue 创建器单元测试
    ├── test_team_workspace.py            # 工作区单元测试
    ├── test_team_findings.py             # 发现读写单元测试
    ├── test_team_request.py             # 请求/升级单元测试
    └── test_team_synthesis.py           # 综合单元测试
```

## 前置条件

### 方式 A：GitHub CLI（推荐）

```bash
# 安装：https://cli.github.com/
gh auth login
```

### 方式 B：个人访问令牌

如果没有 `gh` CLI，设置 `GITHUB_TOKEN` 环境变量：

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

采集器和 Issue 创建器会自动降级为通过 `urllib` 调用 GitHub REST API。

## 安装

### 用于 TRAE / Codex / Qoder

将本仓库克隆或复制到你的技能目录：

```bash
git clone https://github.com/libinyam/github-project-review-skill.git
```

在 agent 配置中按名称引用该技能：

```yaml
skills:
  - name: github-project-review
```

## 用法

### 作为 AI Agent 技能（推荐）

向你的 agent 提问：

> 用 $github-project-review 评估 owner/repo 的推广就绪度。

agent 会遵循 `SKILL.md` 中的 6 阶段工作流：初始化工作区 → 派发 7 角色 → 处理升级 → 跨角色审查 → 综合报告 → （可选）创建 Issue。

### 独立团队工作流（手动）

```bash
# 1. 采集仓库上下文
python scripts/collect_repo_context.py owner/repo --output repo-context.json

# 2. 初始化团队工作区（会自动把上下文复制进工作区）
python scripts/team_workspace.py init --repo owner/repo --context repo-context.json

# 3.（可选）标记不适用的角色，例如 CLI 项目无前端
python scripts/team_findings.py mark-na --role B

# 4. 每个角色写入发现（由 LLM 生成 findings JSON）
python scripts/team_findings.py write --role G --findings-file role-g-findings.json

# 5. 角色之间互相发送升级
python scripts/team_request.py send --from A --to G --type escalation --priority P0 \
  --subject "深度安全审查：无分支保护" --context '{"finding_id": "A-002"}'

# 6. 解决升级
python scripts/team_request.py resolve --id ESC-001 \
  --resolution-summary "确认：无分支保护" --resolution-finding-id G-005

# 7. 检查就绪度（退出码 0 = 可进入综合）
python scripts/team_status.py --check-complete

# 8. 聚合评分并生成报告数据
python scripts/team_synthesis.py aggregate
python scripts/team_synthesis.py report-data

# 9. 完成后清理工作区
python scripts/team_workspace.py clean --force
```

### 独立采集器

```bash
# 公开仓库
python scripts/collect_repo_context.py owner/repo --output repo-context.json

# 私有仓库（需 gh auth 或 GITHUB_TOKEN）
python scripts/collect_repo_context.py owner/private-repo --output repo-context.json

# 本地克隆
python scripts/collect_repo_context.py /path/to/local/project --output repo-context.json
```

### Issue 创建器（测试工程师）

```bash
# 预演（不实际创建 Issue）
python scripts/create_review_issues.py owner/repo --issues-file review-issues.json --dry-run

# 创建 Issue（交互式 — 需要 TTY）
python scripts/create_review_issues.py owner/repo --issues-file review-issues.json

# 创建 Issue（非交互式 — 适用于 AI agent / CI，跳过确认提示）
python scripts/create_review_issues.py owner/repo --issues-file review-issues.json --yes
```

> **AI agent 和 CI 注意**：请传入 `--yes` 跳过交互式确认提示。
> 在无 TTY 的环境（如 agent 或 CI 流水线）中，除非设置 `--yes`，否则脚本会拒绝运行。

`review-issues.json` 格式：

```json
[
  {
    "title": "为 auth 模块补充单元测试",
    "body": "`src/auth/login.ts` 的 auth 模块无测试覆盖...",
    "labels": ["review-finding", "testing"]
  }
]
```

## 团队协作协议

7 个角色共享一个工作区目录（`.github-review-workspace/`），包含：

- `_session.json` — 会话状态与角色状态
- `_context/` — 共享采集数据（初始化后只读）
- `_mailbox/` — 角色间请求与升级
- `_synthesis/` — 聚合评分与跨角色发现
- `role-*/` — 各角色的发现与笔记

**升级类型**：`task`（具体动作）、`escalation`（必须在报告前解决）、`info`（轻量查询）。

P0 升级会阻塞综合阶段。只有当所有适用角色完成、且无待处理升级时，`team_status.py --check-complete` 才返回退出码 0。

完整的路由矩阵和工作示例见 [`references/collaboration-protocol.md`](references/collaboration-protocol.md)。

## 评分标准

完整的 1-10 分数段定义及 P0/P1 示例见 [`references/evaluation-rubric.md`](references/evaluation-rubric.md)。

## 报告模板

最终报告结构（7 维度 + 升级记录 + 跨角色发现）见 [`references/report-template.md`](references/report-template.md)。

## 测试

```bash
python -m pytest tests/ -v
```

## CI

本仓库包含一个 GitHub Actions 工作流（`.github/workflows/ci.yml`），在每次 push 和 pull request 时运行：

- 对所有脚本做编译检查（`py_compile`）
- 运行单元测试（`pytest`）
- 校验必需文件存在
- 校验 YAML 语法

## 许可证

[MIT](LICENSE)
