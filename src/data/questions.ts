import type { Question } from "@/types";

export const questions: Question[] = [
  {
    id: "q-claude-code-setup",
    title: "Claude Code 安装后无法识别命令，PowerShell 报错怎么办？",
    excerpt:
      "按教程装完 Claude Code，终端却提示「不是内部或外部命令」。环境变量、Node 版本、执行策略都排查过了，还是不行，求一份完整的配置流程。",
    author: "苏望舒",
    authorUid: "demo-su-wangshu",
    avatarColor: "#7cc4ff",
    tags: ["Claude Code", "PowerShell", "环境配置"],
    answers: 8,
    views: 2841,
    votes: 142,
    bounty: 30,
    createdAt: "2025-06-11",
    body:
      "我是数学专业，第一次用 Windows 配置 AI 编程工具。按视频装了 Node 和 Claude Code，但在 PowerShell 里输入 `claude` 提示「不是内部或外部命令」。\n\n我已经检查过：\n1. Node 版本是 v20+，`node -v` 能正常输出\n2. npm 全局包目录似乎没加进 PATH\n3. PowerShell 执行策略可能限制了脚本运行\n\n希望有人能给一份 Windows 下从零到跑通 Claude Code 的完整步骤。",
    answerList: [
      {
        id: "a1",
        author: "林照夜",
        authorUid: "demo-lin-zhaoye",
        avatarColor: "#7cc4ff",
        votes: 96,
        accepted: true,
        content:
          "这是 Windows 新手最常踩的坑。核心是 npm 全局目录没进 PATH。步骤：\n1. 先 `npm config get prefix` 查看全局目录；\n2. 把该目录加入系统环境变量 PATH；\n3. PowerShell 执行策略用 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 解锁；\n4. 重开终端再 `claude --version`。社区《AI 编程工具实战》手册里有图文版，照着走十分钟就能跑通。",
        date: "2025-06-11",
      },
      {
        id: "a2",
        author: "韩青圭",
        authorUid: "demo-han-qinggui",
        avatarColor: "#5aa6f0",
        votes: 38,
        accepted: false,
        content:
          "补充：如果还是不行，检查是不是用了 `npm.cmd` 而非 `npm`，以及全局装的是不是 `@anthropic-ai/claude-code` 这个包名。Windows 下建议直接用 PowerShell 而不是老 cmd。",
        date: "2025-06-11",
      },
    ],
  },
  {
    id: "q-math-to-project",
    title: "数学专业想做 AI 项目，但完全不会写代码，第一步该从哪开始？",
    excerpt:
      "会推导、会做题，但面对一个空的项目文件夹就无从下手。从理论到能做出一个可展示的作品，到底该怎么规划学习路线？",
    author: "秦望舒",
    authorUid: "demo-qin-wangshu",
    avatarColor: "#f3c969",
    tags: ["跨专业转型", "学习路线", "作品集"],
    answers: 11,
    views: 4127,
    votes: 218,
    bounty: 50,
    createdAt: "2025-06-09",
    body:
      "我是数学系大三，想转向 AI 方向。理论课学得还行，概率论、线性代数、最优化都有基础，但代码能力几乎为零，GitHub、部署这些更是一窍不通。\n\n我想知道：\n1. 第一步到底学 Python 还是直接上手 AI 工具？\n2. 理论基础好，怎么最快转化成能跑的项目？\n3. 有没有适合数学背景的「第一个项目」推荐？\n\n希望有过来人分享一条清晰的路线，不要让我再在各种视频里反复试错了。",
    answerList: [
      {
        id: "a1",
        author: "陆星阑",
        authorUid: "demo-lu-xinglan",
        avatarColor: "#5aa6f0",
        votes: 154,
        accepted: true,
        content:
          "过来人经验：你的理论底子是巨大优势，缺的只是「工程化」那一层。建议三步走：\n第一步，花 1 周学 Python 基础 + NumPy（用矩阵运算切入，你会很顺）；\n第二步，直接上手 Claude Code / Trae 这类 AI 编程工具，让 AI 帮你补工程短板，边做边学；\n第三步，挑一个能用上你数学知识的小项目，比如「手写一个线性回归并可视化」。做完传 GitHub、部署上线，就是第一个作品。天玑的《从零到一》手册就是为这条路写的。",
        date: "2025-06-09",
      },
      {
        id: "a2",
        author: "柯北辰",
        authorUid: "demo-ke-beichen",
        avatarColor: "#f3c969",
        votes: 67,
        accepted: false,
        content:
          "同意楼上。补充一点：不要等「学完再开始做」，边做边学效率高十倍。第一个项目可以是把你熟悉的某个证明或算法用代码可视化出来，既发挥优势又有成就感。",
        date: "2025-06-09",
      },
    ],
  },
  {
    id: "q-github-first-push",
    title: "第一次把项目传上 GitHub，push 一直被拒绝怎么处理？",
    excerpt:
      "本地建了仓库，远程也建了，但 push 时报错 rejected / non-fast-forward。新人不太敢乱用 force，求稳妥的处理方法。",
    author: "周怀瑾",
    authorUid: "demo-zhou-huaijin",
    avatarColor: "#5aa6f0",
    tags: ["GitHub", "Git", "协作"],
    answers: 6,
    views: 1986,
    votes: 88,
    createdAt: "2025-06-07",
    body:
      "第一次用 GitHub，本地 `git init` 后 commit 了，远程也建了空仓库。`git push -u origin main` 时报：\n\n```\n! [rejected] main -> main (fetch first)\n```\n\n网上说要 force push，但我怕把东西搞没。求一个新人能理解的安全流程。",
    answerList: [
      {
        id: "a1",
        author: "宋知遥",
        authorUid: "demo-song-zhiyao",
        avatarColor: "#7cc4ff",
        votes: 71,
        accepted: true,
        content:
          "千万别一上来 force。这是因为远程建仓库时勾选了「添加 README」，远程比本地多一个提交。安全做法：先 `git pull origin main --rebase` 把远程的合并进来，解决可能的冲突，再 `git push -u origin main`。或者更简单——建远程仓库时什么都别勾，保持完全空仓库再 push。社区《GitHub 实操手册》第一章专门讲这个。",
        date: "2025-06-07",
      },
    ],
  },
  {
    id: "q-deploy-vercel",
    title: "Vercel 部署前端项目，构建成功但页面空白是什么原因？",
    excerpt:
      "本地跑得好好的，推到 GitHub 用 Vercel 自动部署后打开是白屏。控制台一堆 404，怀疑是路径或构建配置问题。",
    author: "韩青圭",
    authorUid: "demo-han-qinggui",
    avatarColor: "#5aa6f0",
    tags: ["部署", "Vercel", "前端"],
    answers: 5,
    views: 1432,
    votes: 76,
    createdAt: "2025-06-05",
    body:
      "React + Vite 项目，本地 `npm run dev` 一切正常。推上 GitHub 后 Vercel 自动构建显示成功，但访问域名是白屏。\n\n控制台报：\n- `Failed to load resource: 404 /assets/index.js`\n- 资源路径像是绝对的 `/assets/...`\n\n查了说是 base 路径问题，但不知道怎么改，求大佬指点。",
    answerList: [
      {
        id: "a1",
        author: "林照夜",
        authorUid: "demo-lin-zhaoye",
        avatarColor: "#7cc4ff",
        votes: 58,
        accepted: true,
        content:
          "典型的 Vite 资源路径问题。两个方向排查：\n1. 如果是子路径部署，在 `vite.config.ts` 里加 `base: './'` 或对应子路径；\n2. 多半是构建输出目录配错了——Vercel 的 Output Directory 要设成 `dist`，Framework Preset 选 Vite。去 Vercel 项目设置里检查 Build & Development Settings，确认 Build Command 是 `npm run build`、Output 是 `dist`。《项目部署入门》手册第五章有完整排查清单。",
        date: "2025-06-05",
      },
    ],
  },
  {
    id: "q-grad-convex",
    title: "为什么梯度下降在非凸问题上依然有效？背后的数学依据是什么？",
    excerpt:
      "深度学习损失曲面高度非凸，但梯度下降却常能收敛到良好局部极小。能否从优化理论与几何角度解释这一现象？",
    author: "陆星阑",
    authorUid: "demo-lu-xinglan",
    avatarColor: "#5aa6f0",
    tags: ["优化", "非凸优化", "理论"],
    answers: 7,
    views: 2184,
    votes: 156,
    createdAt: "2025-06-02",
    body:
      "深度学习中损失函数 $L(\\theta)$ 通常是高度非凸的，但经验上随机梯度下降（SGD）仍能找到泛化良好的解。我的疑问是：\n\n1. 在高维参数空间中，局部极小值是否在某种意义下接近全局最优？\n2. 鞍点与局部极小的分布如何影响收敛？\n\n我了解凸优化中梯度下降的收敛率 $O(1/t)$，但非凸情形似乎缺乏类似理论。希望从数学视角得到解答。",
    answerList: [
      {
        id: "a1",
        author: "柯北辰",
        authorUid: "demo-ke-beichen",
        avatarColor: "#f3c969",
        votes: 88,
        accepted: true,
        content:
          "高维空间是关键。在超高维参数空间中，所有局部极小往往与全局最小非常接近，真正的障碍是鞍点而非局部极小。Dauphin 等人提出的鞍点消除方法正是基于此。可以参考神经网络的 spin glass 理论模型：当 $N \\to \\infty$ 时，局部极小的期望损失趋近全局最优。",
        date: "2025-06-02",
      },
    ],
  },
  {
    id: "q-portfolio-idea",
    title: "想用 AI 工具一个月做出能投简历的作品集，有哪些项目方向推荐？",
    excerpt:
      "非科班，想转向 AI 应用开发。用 Claude Code 配合学习，计划一个月内做出 2-3 个可展示项目，求方向和难度梯度建议。",
    author: "沈砚书",
    authorUid: "demo-shen-yanshu",
    avatarColor: "#7cc4ff",
    tags: ["作品集", "项目实战", "求职"],
    answers: 9,
    views: 3051,
    votes: 134,
    bounty: 40,
    createdAt: "2025-05-28",
    body:
      "非计算机专业，想转 AI 应用方向找工作。已经能用 Claude Code 和 Trae 写简单前端。想用一个月做出 2-3 个能写进简历的项目。\n\n希望项目：\n1. 难度由浅入深，第一个能快速出成果建立信心\n2. 最好能体现「用 AI 解决实际问题」的能力\n3. 可部署、可分享、能写好 README\n\n求过来人给个方向清单。",
    answerList: [
      {
        id: "a1",
        author: "陆星阑",
        authorUid: "demo-lu-xinglan",
        avatarColor: "#5aa6f0",
        votes: 112,
        accepted: true,
        content:
          "推荐三档梯度：\n入门（1 周）：个人作品集网站，纯前端 + 部署，先把「会上线」这个能力点亮；\n进阶（1-2 周）：基于 RAG 的「问我笔记/文档」助手，调用 LLM API + 本地知识库，能体现 AI 应用能力；\n进阶（1-2 周）：结合你专业背景的小工具，比如金融同学做「财报快速解读」、数学同学做「公式可视化讲解器」。每个项目都传 GitHub、写好 README、部署上线。一个月下来作品集就成型了。《从零到一》手册和《LLM 应用开发入门》正好覆盖这条路。",
        date: "2025-05-28",
      },
    ],
  },
];
