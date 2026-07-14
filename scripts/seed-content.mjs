#!/usr/bin/env node
/**
 * 比赛演示用种子内容注入脚本（#308）
 *
 * 设计 2 条主题路线，每条覆盖资源/灵感/协作三个模块
 * （讨论区已有 C++ 帖子等种子内容，不在此脚本范围内）：
 *
 * 路线 1：C++ / CLI Notes / AI 知识系统
 * 路线 2：GitHub + TRAE + CloudBase 部署
 *
 * 用法：
 *   node scripts/seed-content.mjs --envId <envId> --uid <yourUid> [--dry-run]
 *
 * 需要在 .env 中配置 TCB_SECRET_ID 和 TCB_SECRET_KEY（管理端密钥）
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 从 .env 加载环境变量
function loadEnv() {
  try {
    const envContent = readFileSync(resolve(__dirname, "../.env"), "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.+)/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // .env 不存在时静默跳过，依赖已设置的环境变量
  }
}

loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const uidArg = args.indexOf("--uid");
const uid = uidArg !== -1 && uidArg + 1 < args.length ? args[uidArg + 1] : process.env.SEED_AUTHOR_UID;
const envIdIndex = args.indexOf("--envId");
const envIdArg = envIdIndex !== -1 && envIdIndex + 1 < args.length ? args[envIdIndex + 1] : null;
const envId = envIdArg || process.env.VITE_CLOUDBASE_ENV_ID;

if (!envId) {
  console.error("错误：未指定环境 ID。用 --envId 参数或在 .env 中设置 VITE_CLOUDBASE_ENV_ID");
  process.exit(1);
}
if (!uid) {
  console.error("错误：未指定作者 UID。用 --uid 参数指定你的用户 UID");
  process.exit(1);
}

const AUTHOR_NAME = "天玑种子";
const AVATAR_COLOR = "#f59e0b";
const NOW = new Date().toISOString();

// ==================== 路线 1：C++ / CLI Notes / AI 知识系统 ====================

const route1Books = [
  {
    title: "C++ Primer 中文版（第5版）",
    author: "Stanley B. Lippman",
    category: "编程基础",
    difficulty: 3,
    tags: ["C++", "编程基础", "入门"],
    summary: "C++ 经典入门教材，从基础语法到面向对象、模板、标准库全覆盖。适合有编程基础的同学系统学习 C++，每章配有练习题。",
    toc: ["第1章 开始", "第2章 变量和基本类型", "第3章 字符串、向量和数组", "第6章 函数", "第7章 类", "第12章 动态内存", "第16章 模板与泛型编程"],
  },
  {
    title: "Effective C++：改善程序与设计的55个具体做法",
    author: "Scott Meyers",
    category: "编程基础",
    difficulty: 4,
    tags: ["C++", "进阶", "最佳实践"],
    summary: "C++ 进阶必读，55 条最佳实践，涵盖资源管理、模板、泛型编程等。每条都有正反例对比，帮你写出更安全高效的 C++ 代码。",
    toc: ["第一章 让自己习惯 C++", "第二章 构造/析构/赋值运算", "第三章 资源管理", "第四章 设计与声明", "第五章 实现", "第六章 继承与面向对象"],
  },
  {
    title: "用 C++ 构建命令行笔记系统",
    author: "天玑社区",
    category: "项目实战",
    difficulty: 3,
    tags: ["C++", "CLI", "项目实战", "笔记"],
    summary: "从零开始用 C++ 构建一个命令行笔记管理工具，涵盖文件 I/O、字符串处理、简单解析器设计。适合学完 C++ Primer 后的第一个实战项目。",
    toc: ["1. 项目规划与环境搭建", "2. 文件读写与存储格式", "3. 命令行参数解析", "4. 笔记的增删改查", "5. 全文搜索实现", "6. 导出 Markdown"],
  },
];

const route1Ideas = [
  {
    title: "用 C++ 做一个 CLI 笔记知识系统",
    summary: "学完 C++ 基础后想做一个实战项目：命令行笔记工具，支持 Markdown 存储、标签分类、全文搜索。最终目标是把它变成个人的 AI 知识系统后端——笔记可被检索、关联、问答。",
    topic: "把 C++ 学成真项目",
    tags: ["C++", "CLI", "笔记", "知识管理"],
  },
  {
    title: "C++ 学习路线里的「最小可用项目」是什么？",
    summary: "很多人学完语法就卡住，不知道做什么。我整理了一个递进式项目清单：计算器 → 待办列表 → 笔记系统 → 简易数据库，每一步只增加一个核心概念，避免一上来就做太大的东西。",
    topic: "学习路线设计",
    tags: ["C++", "学习路线", "项目"],
  },
];

const route1Workshop = {
  title: "CLI Notes 知识系统 — 协作工坊",
  type: "教材",
  description: "协作编写「用 C++ 构建命令行笔记系统」的完整教程，从环境搭建到全文搜索。目标是产出一套新手跟着做就能跑起来的项目教程。",
  content: "## 项目目标\n\n构建一个命令行笔记管理工具，支持：\n- Markdown 格式笔记的增删改查\n- 标签分类与按标签筛选\n- 全文搜索\n- 导出为单个 Markdown 文件\n\n## 技术选型\n\n- C++17（文件系统库）\n- 第三方库：cxxopts（命令行解析）、spdlog（日志）\n- 存储：每条笔记一个 .md 文件 + index.json 索引\n\n## 协作分工\n\n- 环境搭建与项目骨架\n- 文件 I/O 与存储格式设计\n- 命令行参数解析\n- 搜索功能实现\n- 文档撰写与示例",
  outline: [
    { id: "ch1", title: "项目规划与环境搭建", brief: "CMake 项目结构、依赖管理、开发环境配置" },
    { id: "ch2", title: "文件读写与存储格式", brief: "笔记文件格式设计、index.json 索引、CRUD 实现" },
    { id: "ch3", title: "命令行参数解析", brief: "cxxopts 集成、子命令设计（add/list/search/export）" },
    { id: "ch4", title: "全文搜索实现", brief: "倒排索引、中文分词、搜索结果高亮" },
    { id: "ch5", title: "导出与集成", brief: "Markdown 导出、与编辑器集成、后续扩展方向" },
  ],
  tags: ["C++", "CLI", "笔记", "教程"],
};

// ==================== 路线 2：GitHub + TRAE + CloudBase 部署 ====================

const route2Books = [
  {
    title: "GitHub Actions 实战：从 CI 到 CD",
    author: "天玑社区",
    category: "AI工具实战",
    difficulty: 2,
    tags: ["GitHub", "CI/CD", "部署", "自动化"],
    summary: "面向新手的 GitHub Actions 教程，从第一个 workflow 到自动部署。包含天玑项目真实的 CI 配置案例：lint、test、audit、分支保护。",
    toc: ["1. GitHub Actions 基础概念", "2. 第一个 workflow", "3. CI：lint + test + type check", "4. CD：自动部署到 Vercel", "5. 分支保护与 PR 流程", "6. 实战：天玑项目的 CI 配置"],
  },
  {
    title: "CloudBase 云开发部署指南",
    author: "天玑社区",
    category: "AI工具实战",
    difficulty: 2,
    tags: ["CloudBase", "部署", "云函数", "数据库"],
    summary: "腾讯云 CloudBase 全栈部署指南：静态托管、云函数、NoSQL 数据库、安全规则。以天玑项目为案例，覆盖从环境创建到生产部署的完整流程。",
    toc: ["1. CloudBase 环境创建", "2. 静态托管部署", "3. 云函数开发与部署", "4. NoSQL 数据库与安全规则", "5. 自定义域名与 ICP 备案", "6. 生产环境监控"],
  },
  {
    title: "TRAE AI 协作开发实践",
    author: "天玑社区",
    category: "AI工具实战",
    difficulty: 2,
    tags: ["TRAE", "AI", "协作", "开发效率"],
    summary: "记录用 TRAE 开发天玑项目的全过程：需求拆解、代码生成、bug 修复、测试。展示人机协作的真实工作流——人提方向，AI 辅助实现。",
    toc: ["1. TRAE 是什么", "2. 项目初始化协作", "3. 多模块并行开发", "4. AI 集成与调试", "5. 性能优化协作", "6. 部署与稳定性"],
  },
];

const route2Ideas = [
  {
    title: "一键部署跨平台 AI 应用的最佳实践",
    summary: "现在 AI 应用部署门槛还是太高：前端、后端、模型 API、数据库各搞各的。想探索一套模板：Vercel 前端 + CloudBase 后端 + DeepSeek API，新项目 fork 后改改就能上线。",
    topic: "部署模板化",
    tags: ["部署", "CloudBase", "Vercel", "AI"],
  },
  {
    title: "用 AI 协作开发时，人应该做什么？",
    summary: "用 TRAE 开发天玑几个月后的反思：AI 最擅长的是拆解和生成，人最该做的是判断和取舍。具体来说——人定方向、定验收标准、review 代码，AI 负责实现。不要让 AI 替你做产品决策。",
    topic: "AI 协作方法论",
    tags: ["TRAE", "AI", "协作", "方法论"],
  },
];

const route2Workshop = {
  title: "全栈部署最佳实践 — 协作工坊",
  type: "教材",
  description: "协作整理全栈应用的部署最佳实践文档，覆盖 Vercel 前端、CloudBase 后端、安全规则、CI/CD、自定义域名。目标产出一套可复用的部署 checklist。",
  content: "## 目标\n\n整理一套全栈应用部署的标准化 checklist，新人照着做就能上线。\n\n## 覆盖范围\n\n1. 前端部署（Vercel）\n2. 后端部署（CloudBase 云函数 + 数据库）\n3. 安全配置（安全规则、环境变量、分支保护）\n4. CI/CD（GitHub Actions）\n5. 域名与备案\n6. 监控与告警",
  outline: [
    { id: "ch1", title: "前端部署：Vercel 配置要点", brief: "构建配置、环境变量、安全头、缓存策略" },
    { id: "ch2", title: "后端部署：CloudBase 云函数", brief: "云函数开发、依赖管理、环境变量、定时任务" },
    { id: "ch3", title: "数据库安全规则", brief: "NoSQL 权限模型、owner 校验、admin 角色" },
    { id: "ch4", title: "CI/CD 流水线", brief: "lint、test、audit、deploy 的自动化" },
    { id: "ch5", title: "域名、备案与监控", brief: "ICP 备案、自定义域名、Sentry 错误监控" },
  ],
  tags: ["部署", "CloudBase", "Vercel", "CI/CD"],
};

// ==================== 写入逻辑 ====================

async function main() {
  const cloudbase = (await import("@cloudbase/node-sdk")).default;
  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TCB_SECRET_ID,
    secretKey: process.env.TCB_SECRET_KEY,
  });
  const db = app.database();

  console.log(`\n🌱 种子内容注入脚本（#308）`);
  console.log(`   环境: ${envId}`);
  console.log(`   作者 UID: ${uid}`);
  console.log(`   模式: ${dryRun ? "DRY RUN（不实际写入）" : "实际写入"}\n`);

  let bookCount = 0;
  let ideaCount = 0;
  let workshopCount = 0;

  // 检查是否已存在种子内容（避免重复注入）
  const { data: existingBooks } = await db
    .collection("books")
    .where({ authorUid: uid, author: AUTHOR_NAME })
    .limit(50)
    .get();
  if (existingBooks.length > 0) {
    console.log(`⚠️  已发现 ${existingBooks.length} 条种子书籍，跳过书籍注入（如需重新注入请先删除）`);
  } else {
    const allBooks = [...route1Books, ...route2Books];
    for (const book of allBooks) {
      const doc = {
        ...book,
        author: AUTHOR_NAME,
        authorUid: uid,
        accent: AVATAR_COLOR,
        favorites: 0,
        downloads: 0,
        rating: 0,
        year: new Date().getFullYear(),
        pages: 0,
        reviews: [],
        createdAt: NOW,
      };
      if (dryRun) {
        console.log(`  [DRY] book: ${book.title}`);
      } else {
        const res = await db.collection("books").add(doc);
        console.log(`  ✅ book: ${book.title} → ${res.id}`);
      }
      bookCount++;
    }
  }

  const { data: existingIdeas } = await db
    .collection("ideas")
    .where({ authorUid: uid, author: AUTHOR_NAME })
    .limit(50)
    .get();
  if (existingIdeas.length > 0) {
    console.log(`⚠️  已发现 ${existingIdeas.length} 条种子灵感，跳过灵感注入`);
  } else {
    const allIdeas = [...route1Ideas, ...route2Ideas];
    for (const idea of allIdeas) {
      const doc = {
        ...idea,
        author: AUTHOR_NAME,
        authorUid: uid,
        avatarColor: AVATAR_COLOR,
        resonance: 0,
        replies: 0,
        comments: [],
        resonatedBy: [],
        createdAt: NOW,
      };
      if (dryRun) {
        console.log(`  [DRY] idea: ${idea.title}`);
      } else {
        const res = await db.collection("ideas").add(doc);
        console.log(`  ✅ idea: ${idea.title} → ${res.id}`);
      }
      ideaCount++;
    }
  }

  const { data: existingWorkshops } = await db
    .collection("workshops")
    .where({ creatorUid: uid, creator: AUTHOR_NAME })
    .limit(50)
    .get();
  if (existingWorkshops.length > 0) {
    console.log(`⚠️  已发现 ${existingWorkshops.length} 条种子协作项目，跳过协作注入`);
  } else {
    const allWorkshops = [route1Workshop, route2Workshop];
    for (const ws of allWorkshops) {
      const doc = {
        ...ws,
        creator: AUTHOR_NAME,
        creatorUid: uid,
        avatarColor: AVATAR_COLOR,
        participants: [uid],
        contributions: [],
        annotations: [],
        status: "招募中",
        createdAt: NOW,
        updatedAt: NOW,
      };
      if (dryRun) {
        console.log(`  [DRY] workshop: ${ws.title}`);
      } else {
        const res = await db.collection("workshops").add(doc);
        console.log(`  ✅ workshop: ${ws.title} → ${res.id}`);
      }
      workshopCount++;
    }
  }

  console.log(`\n📊 注入汇总：${bookCount} 本书 + ${ideaCount} 条灵感 + ${workshopCount} 个协作项目`);
  console.log(`   路线 1：C++ / CLI Notes / AI 知识系统`);
  console.log(`   路线 2：GitHub + TRAE + CloudBase 部署\n`);
}

main().catch((err) => {
  console.error("❌ 注入失败：", err);
  process.exit(1);
});
