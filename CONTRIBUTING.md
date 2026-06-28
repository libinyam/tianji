# 贡献指南

感谢你对天玑项目的关注！本文档说明如何参与贡献。

## 分支命名规范

- `feature/xxx` — 新功能
- `fix/xxx` — Bug 修复
- `docs/xxx` — 文档更新

## 提交信息规范

格式：`type: description`

- `feat` — 新功能
- `fix` — Bug 修复
- `docs` — 文档
- `refactor` — 重构
- `chore` — 构建 / 工具 / 杂项

示例：`feat: 讨论区支持按标签筛选`

## 代码规范

- TypeScript strict mode
- 遵循 ESLint 配置，提交前运行 `npm run lint`
- 使用函数式组件与 React Hooks
- 提交前确保 `npm run build` 通过

## 评审流程

1. Fork 本仓库
2. 从 `main` 创建特性分支
3. 完成开发并自测
4. 提交 Pull Request
5. 等待 Review 通过后 Merge

## 本地开发注意事项

- 安装依赖后需配置 `.env.local` 所需环境变量（详见 README）
- 云函数位于 `cloudfunctions/`，修改后需重新部署
- 涉及 CloudBase 数据库操作时注意安全规则配置
