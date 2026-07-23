# 天机 CloudBase 数据库 Schema

本文件是天机项目 CloudBase NoSQL 数据库的字段定义与版本管理说明，与 [`cloudbase-schema.json`](../cloudbase-schema.json) 保持同步。后者是机器可读的单一真相来源，本文件提供人类可读的补充说明。

## 设计原则

1. **schemaVersion 字段**：每个需要演进的集合文档都带一个 `schemaVersion` 数字字段，缺失视为 v1。
2. **防御性读取**：前端通过 [`src/lib/normalize.ts`](../src/lib/normalize.ts) 的 `normalizePost` / `normalizeIdea` / `normalizeBook` 兜底缺失字段，避免老文档导致页面崩溃。
3. **显式迁移脚本**：批量回填历史数据走 [`scripts/migrate-schema.mjs`](../scripts/migrate-schema.mjs)，支持 `--dry-run`。
4. **安全规则独立维护**：字段定义不包含 ACL，集合级权限在 CloudBase 控制台配置。

## 集合一览

| 集合 | 版本 | 用途 | TS 接口 |
|------|------|------|---------|
| posts | v2 | 讨论帖（学术/闲聊） | `PostDoc` |
| ideas | v2 | 灵感卡片 | `IdeaDoc` |
| books | v2 | 书籍资源 | `BookDoc` |
| workshops | v2 | 共创工作坊 | — |
| users_v2 | v1 | 用户档案（含声望、封禁状态） | — |
| votes | v1 | 回答投票去重 | — |
| favorites | v1 | 书籍收藏去重 | — |
| reputation_events | v1 | 声望加分幂等事件（eventId 唯一） | — |
| notifications | v1 | 站内通知 | — |
| reports | v1 | 举报记录 | — |
| tags | v1 | 标签计数 | — |
| announcements | v1 | 站点公告 | — |
| user_roles | v1 | 管理员角色（只写不允许客户端读） | — |

## 核心集合字段

### posts (v2)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | CloudBase 自动生成 |
| `title` | string | 是 | 标题（≤200 字符） |
| `excerpt` | string | 是 | 列表摘要（body 前 120 字符 + …） |
| `body` | string | 是 | 正文 Markdown |
| `author` | string | 是 | 作者显示名 |
| `authorUid` | string | 是 | 作者 uid（v2 迁移回填 ""） |
| `avatarColor` | string | 是 | 头像底色 |
| `tags` | string[] | 是 | 标签数组 |
| `bounty` | number? | 否 | 悬赏分值 |
| `category` | "academic" \| "casual"? | 否 | 分区 |
| `subCategory` | CasualSubCategory? | 否 | 闲聊区子分类 |
| `views` | number | 是 | 浏览量 |
| `votes` | number | 是 | 投票数 |
| `answersCount` | number | 是 | 回答数（原子 inc，避免漂移） |
| `answerList` | Answer[] | 是 | 回答数组（读改写，根治见 #105） |
| `isMock` | boolean? | 否 | 是否为 Mock 帖子 |
| `pinned` | boolean? | 否 | 置顶 |
| `locked` | boolean? | 否 | 锁定（禁止回答/评论） |
| `featured` | boolean? | 否 | 加精 |
| `createdAt` | string | 是 | ISO 时间戳 |

**迁移**：v1 → v2 回填 `authorUid: ""`。

### ideas (v2)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | |
| `title` | string | 是 | 标题 |
| `summary` | string | 是 | 简述 |
| `author` | string | 是 | |
| `authorUid` | string | 是 | v2 回填 |
| `avatarColor` | string | 是 | |
| `topic` | string | 是 | 所属主题 |
| `tags` | string[] | 是 | |
| `resonance` | number | 是 | 共鸣数 |
| `replies` | number | 是 | 评论数 |
| `resonatedBy` | string[] | 是 | 已共鸣 uid 列表（去重） |
| `comments` | IdeaComment[]? | 否 | 评论数组 |
| `createdAt` | string | 是 | |

### books (v2)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | |
| `title` | string | 是 | |
| `author` | string | 是 | 书籍作者（非上传者） |
| `authorUid` | string | 是 | 上传者 uid（v2 回填） |
| `category` | BookCategory | 是 | "基础理论" \| "AI工具实战" \| "项目实战" \| "编程基础" |
| `difficulty` | 1\|2\|3\|4\|5 | 是 | 难度 |
| `tags` | string[] | 是 | |
| `accent` | string | 是 | 卡片底色 |
| `summary` | string | 是 | 简介 |
| `favorites` | number | 是 | 收藏数 |
| `downloads` | number | 是 | 下载数 |
| `rating` | number | 是 | 评分缓存（真实值由 reviews 实时计算） |
| `year` | number | 是 | 出版年份 |
| `pages` | number | 是 | 页数 |
| `toc` | string[] | 是 | 目录 |
| `reviews` | Review[] | 是 | 读者评价数组 |
| `link` | string? | 否 | 外部链接 |
| `fileUrl` | string? | 否 | 上传文件下载 URL（临时） |
| `fileName` | string? | 否 | 原始文件名 |
| `createdAt` | string | 是 | |

## 迁移流程

### 1. 修改 schema

在 [`cloudbase-schema.json`](../cloudbase-schema.json) 中：
- 提升 `schemaVersion`
- 在 `migrations` 数组追加 `{ from, to, description, defaults }`
- 更新 `fields` 反映新结构

### 2. 更新 normalize 函数

在 [`src/lib/normalize.ts`](../src/lib/normalize.ts) 中为新字段添加兜底默认值，确保老文档读取不报错。

### 3. 执行迁移

```bash
# 先 dry-run 查看将要变更的文档数
node scripts/migrate-schema.mjs --dry-run

# 实际执行
node scripts/migrate-schema.mjs
```

迁移脚本会：
- 读取 `cloudbase-schema.json`
- 遍历每个集合，筛选 `schemaVersion` 低于目标的文档
- 按 migrations 数组顺序回填 `defaults` 字段
- 写回 `schemaVersion` 为目标版本

### 4. 更新本文档

同步字段表，保持与 JSON 一致。

## 防御性读取示例

```typescript
import { normalizePost } from "@/lib/normalize";
import type { PostDoc } from "@/lib/posts";

const { data } = await db.collection("posts").doc(id).get();
// 老文档可能缺 avatarColor / votes 等字段，normalize 兜底
const post: PostDoc = normalizePost(data[0] as Partial<PostDoc>);
```

`normalize` 函数只做读取侧兜底，不会修改数据库；持久化回填由迁移脚本负责。
