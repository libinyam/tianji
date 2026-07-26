# Changelog

本项目所有重要变更记录在此文件中。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.4.0] - 2026-07-26

### Added
- 全站重设计为 Discourse/linux.do 白色简约风格，深浅主题经 CSS 变量色板以极小 diff 完成切换 (#396/#398)
- 移动端讨论区新增分区 Tab 条（学术区/闲聊区/关注）与热门标签横向筛选条——此前 <1024px 侧边栏隐藏后这两个功能完全不可达 (#401)
- Hero 主 CTA 精简为「加入讨论」单入口 (#387)
- Footer 添加公安备案号

### Security
- 所有 UGC 写路径收敛为「云函数 + 服务端审核」单一架构：createIdea/updateIdea/createWorkshop/updateWorkshopMeta 迁入 content-actions 并接入 moderateText；updateWorkshopContent 补审核 (#404)
- 通知创建服务端化：actorUid 取自登录态防冒充管理员，link 限站内路径防钓鱼，类型白名单 + 独立限流 (#40)
- 安全规则 v1.5.0：ideas/workshops/notifications 的 create 收紧为禁止客户端直写
- 灵感评论迁移到云函数，修复与安全规则冲突导致非作者评论失败/静默丢失 (#400)
- react-router 升级 7.18.1；GHSA-qwww-vcr4-c8h2 需 v8 迁移根治，CI 注释更新为真实现状 (#405 部分)
- 编辑帖子改走云函数绕过安全规则，修复 [object Object] 错误 (#385)

### Fixed
- fetchPostById/fetchIdeaById/fetchBookById/fetchWorkshops 补 await authReady，修复新访客深链 401 误报「不存在」(#402)
- 首页帖子标题改为真链接：键盘可达、中键新标签、爬虫可发现内容页 (#411)
- 首页表头与数据行统一网格，修复 375px 视口横向溢出与列错位 (#413)
- text-mist-500 对比度提升至 WCAG AA（浅色 2.5:1→4.8:1，全站 197 处生效）(#412)

### Performance
- 帖子列表/搜索/榜单查询加 .field() 投影，完整正文与全部回答评论不再随列表传输 (#407)
- RelatedContent 从每集合拉 50 篇全文档降为 5 篇 + 投影，详情页附带流量降一个数量级 (#410)
- MarkdownRenderer 包 React.memo，详情页输入不再触发全文重解析 (#408 部分)
- 记录 #406 调查结论：SDK 3.6.2 子包发布不完整，按需引入暂不可行

### Accessibility
- Toast 容器 aria-live、Layout skip link、排序按钮 aria-pressed、侧边栏分区 aria-current (#422)

### Test
- content-actions 七个删除/编辑 action 补 16 个权限校验用例——云函数 admin 身份下 authorUid 比对是防越权唯一屏障，此前零覆盖 (#414)
- __setTestDb 支持注入 callFunction，#315 审核 fail-closed 首次纳入回归；新增 security-actions.test.js 23 个用例 (#415)
- manage-announcements 改延迟初始化补齐 admin 门控测试，8 个云函数全部可测 (#416)

### CI/CD
- PR CI 新增 Build 步骤，Vite 构建期错误在合并前暴露 (#417)
- 移除 Vitest 4 已废弃的 environmentMatchGlobs 死配置 (#425 部分)

## [0.3.1] - 2026-07-13

### Security
- 安全规则收紧后前端直写操作失败修复：8 个集合添加 create 规则 (#242)
- awardCreateReputation 声望刷分漏洞修复：添加内容存在性+作者校验 (#249)
- 分支保护启用 PR review 要求 (#271)

### CI/CD
- cloudbaserc.json 移除 node_modules ignore，修复云函数依赖丢失 (#264)
- CI 添加 npm audit 检查（非阻塞）(#272)
- 覆盖率阈值提升：lines 4%→8%，branches 3%→5%，functions 5%→7% (#269)
- CODEOWNERS 文件 (#273)

### Infrastructure
- getEndUserInfo() 修复：6 个云函数不传 context 参数
- 仓库描述和 topics 设置 (#274)
- README 添加在线体验链接 (#276)
- 清理误提交的 .agents/ 目录

### Test
- P0 测试补齐：posts CRUD 10 个、auth 13 个、check-admin 4 个、user-admin 5 个、admin-delete 5 个 (#266/#267/#268)
- awardCreateReputation 6 个测试 (#249)
- 测试从 117 增长到 123，全部通过

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
