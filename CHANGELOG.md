# Changelog

本项目所有重要变更记录在此文件中。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- Dependabot 依赖更新自动化配置
- 分支保护 enforce_admins 启用

## [0.3.0] - 2026-07-11

### Security
- 安全规则 v1.1.0：新增 users_v2/_backups 集合规则，修复 notifications create 和 posts update 矛盾 (#199)
- voteAnswer 计数漂移修复：检查 set()/remove() 返回值，仅新建/删除时才 inc (#202)
- cos-nodejs-sdk-v5 移到 devDependencies，消除 3 个 critical 漏洞 (#205)
- 评审工件移出公开仓库（repo-context.json / .trae/skills / .tmp-e2e）(#200)

### CI/CD
- 分支保护 required status checks 从 step 名修正为 job 名 (#201)
- CI 测试步骤加 --coverage，覆盖率 include 扩大为 src/lib/**/*.ts (#206)
- 安全规则部署脚本重写：用 CloudBase CLI 替代 manager-node (#204)

### Test
- 安全规则一致性测试（7 个）(#207)
- 声望系统单元测试（11 个）(#153)

### Fixed
- DiscussionDetail 区分加载失败与帖子不存在 (#197)
- DiscussionSidebar 热门列表加载失败加日志 (#198)
- 删除孤儿 result.ts 模块 (#203)

## [0.2.0] - 2026-07-10

### Features
- 帖子置顶/锁定/加精审核功能 (#170)
- 敏感词过滤 + 用户封禁系统 (#152)
- 声望/积分/等级/徽章体系 (#153)
- 通用分页工具 (#169)
- 搜索分页 + 高级过滤（类型/标签/排序）(#155)
- 登录前操作保留（pending action 系统）(#92)
- 通知实时化（CloudBase watch）(#164)
- 首页新手引导卡片 (#147)
- 入门资源可达性修复（6 个资源添加 link）(#101)

### Security
- XSS 防护加固（sanitizeInput/sanitizeTitle/sanitizeTag）(#178)
- 管理员 UID 硬编码移除 (#179)
- voteAnswer TOCTOU 竞态修复 (#181)
- AI bot 云函数 API key 保护 (#182)
- 安全规则 v1.0.0 引入 (#193)

### Infrastructure
- Vitest 测试框架建立 (#182)
- PR 触发 CI (#190)
- CloudBase Content-Disposition 头修复 (#41)
- 云函数依赖可复现部署 (#37)

### Test
- security.ts 13 个测试 (#186)
- utils.ts + format.ts 18 个测试 (#187)

## [0.1.0] - 2026-07-08

### Initial Release
- 学问讨论区（帖子/回答/评论/投票/采纳）
- 灵感广场（共鸣/评论）
- 资源库（上传/下载/收藏/评分）
- 协作工坊（章节/批注/贡献）
- 用户认证（微信/匿名登录）
- 管理后台（公告/举报/统计）
- 深空主题 UI + 暗色模式
