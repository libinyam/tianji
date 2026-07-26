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
- 使用函数式组件与 React Hooks
- 提交前自查清单（与 PR CI 完全一致，任一失败 CI 会拒绝合入）：
  ```bash
  npm run check          # TypeScript 类型检查
  npm run lint           # ESLint
  npm run format:check   # Prettier 格式检查
  npm run test:coverage  # 全量测试 + 覆盖率阈值
  npm run build          # Vite 构建
  ```
- 组件/页面测试文件（.tsx）顶部必须带 `// @vitest-environment jsdom` 注释

## 评审流程

1. Fork 本仓库
2. 从 `main` 创建特性分支
3. 完成开发并自测
4. 提交 Pull Request
5. 等待 Review 通过后 Merge

## 本地开发注意事项

- 安装依赖后复制 `.env.example` 为 `.env` 并填入环境变量（与 README 一致）
- 云函数位于 `cloudfunctions/`，修改后需重新部署
- 涉及 CloudBase 数据库操作时注意安全规则配置
