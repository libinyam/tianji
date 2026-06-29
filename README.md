# 天玑 (Tianji) — 知识共创社区

面向学生、研究者和开发者的知识分享平台，集讨论区、灵感广场、资源库、协作工坊于一体。

## 技术栈

- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS 样式
- Zustand 状态管理
- CloudBase（腾讯云开发）后端服务
- React Router 路由
- KaTeX 数学公式渲染

## 功能模块

- **用户认证**：邮箱注册登录、GitHub OAuth
- **讨论区**：发帖、回答、评论、AI 机器人
- **灵感广场**：分享与讨论灵感
- **资源库**：文件上传与下载
- **协作工坊**：多人协作
- **全局搜索 + 热度榜**
- **标签系统**：学科、工具两级分类
- **消息通知**
- **收藏功能**
- **个人主页**
- **管理后台**
- **深色 / 浅色主题切换**

## 本地启动

```bash
npm install
npm run dev
```

需要配置环境变量。复制 `.env.example` 为 `.env` 并填入实际值（`.env` 已被 `.gitignore` 忽略，不会提交到仓库）：

```bash
cp .env.example .env
```

```env
VITE_CLOUDBASE_ENV_ID=你的云环境ID
VITE_CLOUDBASE_REGION=你的地域
VITE_CLOUDBASE_ACCESS_KEY=你的访问密钥
```

## 部署

通过 GitHub Actions 自动部署到 CloudBase 静态托管。推送代码到 `main`/`master` 分支即触发部署流程（构建产物上传至静态托管根目录）。

## 目录结构

```
.
├── src/
│   ├── components/   # 通用组件与各页面区块组件
│   ├── pages/        # 路由页面
│   ├── lib/          # CloudBase 封装与业务逻辑
│   ├── stores/       # Zustand 状态管理
│   ├── types/        # TypeScript 类型定义
│   └── data/         # 静态数据与种子内容
├── cloudfunctions/   # 云函数（如 AI 机器人）
└── public/           # 静态资源
```

## License

MIT
