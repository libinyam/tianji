import type { CommunityStat, Contributor } from "@/types";

export const communityStats: CommunityStat[] = [
  { label: "注册成员", value: 8642, suffix: "+", icon: "users" },
  { label: "共享资源", value: 1320, suffix: "+", icon: "book" },
  { label: "解答问题", value: 4715, suffix: "+", icon: "message" },
  { label: "协作文档", value: 326, suffix: "+", icon: "edit" },
];

export const contributors: Contributor[] = [
  { name: "柯北辰", role: "优化理论 / 概率论", avatarColor: "#f3c969", contributions: 284 },
  { name: "陆星阑", role: "非凸优化 / 最优传输", avatarColor: "#5aa6f0", contributions: 263 },
  { name: "沈砚书", role: "信息论 / 拓扑", avatarColor: "#7cc4ff", contributions: 219 },
  { name: "秦望舒", role: "信息几何 / 测度论", avatarColor: "#f3c969", contributions: 198 },
  { name: "苏望舒", role: "线性代数 / 贝叶斯", avatarColor: "#7cc4ff", contributions: 176 },
  { name: "周怀瑾", role: "图论 / 谱方法", avatarColor: "#5aa6f0", contributions: 154 },
  { name: "宋知遥", role: "范畴论 / 泛函分析", avatarColor: "#7cc4ff", contributions: 142 },
  { name: "林照夜", role: "信息论 / 自动微分", avatarColor: "#7cc4ff", contributions: 131 },
];
