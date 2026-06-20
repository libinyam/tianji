import type { Doc } from "@/types";

export const docs: Doc[] = [
  {
    id: "d-ai-tools-handbook",
    title: "AI 编程工具实战手册",
    type: "教材",
    description:
      "由社区多人协作编写，系统覆盖 Codex、Claude Code、Trae、MCP 的配置与高效使用，专为跨专业新手降低工具入门门槛。",
    contributors: ["林照夜", "韩青圭", "苏望舒", "周怀瑾"],
    contributorColors: ["#7cc4ff", "#5aa6f0", "#7cc4ff", "#5aa6f0"],
    progress: 72,
    chapters: 8,
    updatedAt: "2025-06-12",
    accent: "#7cc4ff",
  },
  {
    id: "d-zero-to-one",
    title: "从零到一：项目实战指南",
    type: "教材",
    description:
      "从想法到可部署作品的完整方法论：需求拆解、MVP、用 AI 辅助开发、测试上线、写进作品集，帮「会学不会做」的同学打通最后一公里。",
    contributors: ["陆星阑", "柯北辰", "宋知遥"],
    contributorColors: ["#5aa6f0", "#f3c969", "#7cc4ff"],
    progress: 68,
    chapters: 7,
    updatedAt: "2025-06-11",
    accent: "#f3c969",
  },
  {
    id: "d-portfolio-cases",
    title: "跨专业转型作品集案例集",
    type: "教材",
    description:
      "收录数学、物理、金融等跨专业学习者从零做出首个作品集的真实案例，含思路、踩坑与复盘，给后来者一条可复制的路。",
    contributors: ["沈砚书", "秦望舒", "陆星阑", "韩青圭"],
    contributorColors: ["#7cc4ff", "#f3c969", "#5aa6f0", "#5aa6f0"],
    progress: 45,
    chapters: 9,
    updatedAt: "2025-06-09",
    accent: "#5aa6f0",
  },
  {
    id: "d-llm-app",
    title: "LLM 应用开发：从 API 到智能体",
    type: "教材",
    description:
      "协编中的大模型应用教程，从 API 调用、Prompt 工程到 RAG 与智能体，配真实可部署的小项目，让 AI 应用开发不再抽象。",
    contributors: ["林照夜", "沈砚书", "周怀瑾"],
    contributorColors: ["#7cc4ff", "#7cc4ff", "#5aa6f0"],
    progress: 54,
    chapters: 6,
    updatedAt: "2025-06-06",
    accent: "#eccd6b",
  },
  {
    id: "d-paper-repro",
    title: "经典论文复现笔记",
    type: "论文",
    description:
      "社区共笔的论文复现笔记，从理解动机到跑通代码，把「看懂论文」变成「能复现出来」，连接理论与工程实践。",
    contributors: ["柯北辰", "陆星阑", "秦望舒", "宋知遥", "林照夜"],
    contributorColors: ["#f3c969", "#5aa6f0", "#f3c969", "#7cc4ff", "#7cc4ff"],
    progress: 31,
    chapters: 7,
    updatedAt: "2025-06-03",
    accent: "#5aa6f0",
  },
];
