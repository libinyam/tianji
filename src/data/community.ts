import type { CommunityStat, Contributor } from "@/types";

export const communityStats: CommunityStat[] = [
  { label: "跨界学习者", value: 8642, suffix: "+", icon: "users" },
  { label: "学习资源", value: 1320, suffix: "+", icon: "book" },
  { label: "解答疑问", value: 4715, suffix: "+", icon: "message" },
  { label: "共创作品", value: 326, suffix: "+", icon: "edit" },
];

export const contributors: Contributor[] = [
  { name: "陆星阑", role: "数学 → AI / 项目实战", avatarColor: "#5aa6f0", contributions: 284 },
  { name: "林照夜", role: "AI 编程工具 / Claude Code", avatarColor: "#7cc4ff", contributions: 263 },
  { name: "沈砚书", role: "LLM 应用 / RAG", avatarColor: "#7cc4ff", contributions: 219 },
  { name: "柯北辰", role: "理论 → 工程落地", avatarColor: "#f3c969", contributions: 198 },
  { name: "宋知遥", role: "金融科技 / 跨专业转型", avatarColor: "#7cc4ff", contributions: 176 },
  { name: "秦望舒", role: "物理仿真 / 可视化", avatarColor: "#f3c969", contributions: 154 },
  { name: "周怀瑾", role: "GitHub / 部署 / 科研辅助", avatarColor: "#5aa6f0", contributions: 142 },
  { name: "韩青圭", role: "前端 / 作品集打磨", avatarColor: "#5aa6f0", contributions: 131 },
];
