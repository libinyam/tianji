import type { Doc } from "@/types";

export const docs: Doc[] = [
  {
    id: "d-math-dl",
    title: "数学视角的深度学习",
    type: "教材",
    description:
      "从线性代数、微积分、概率论出发，系统重建深度学习的数学基础，由社区多人协作撰写。",
    contributors: ["柯北辰", "陆星阑", "沈砚书", "苏望舒"],
    contributorColors: ["#f3c969", "#5aa6f0", "#7cc4ff", "#7cc4ff"],
    progress: 68,
    chapters: 12,
    updatedAt: "2025-06-11",
    accent: "#5aa6f0",
  },
  {
    id: "d-opt-paper",
    title: "非凸优化的几何分析：从鞍点到泛化",
    type: "论文",
    description:
      "探讨高维非凸损失曲面的几何结构，结合随机微分方程刻画 SGD 轨迹，分析平坦极小与泛化的关系。",
    contributors: ["陆星阑", "宋知遥"],
    contributorColors: ["#5aa6f0", "#7cc4ff"],
    progress: 42,
    chapters: 6,
    updatedAt: "2025-06-09",
    accent: "#f3c969",
  },
  {
    id: "d-info-geom",
    title: "信息几何讲义：统计流形与自然梯度",
    type: "教材",
    description:
      "以 Amari 信息几何为主线，从 Fisher 度量到自然梯度，配以变分推断与梯度流的应用实例。",
    contributors: ["秦望舒", "柯北辰", "沈砚书"],
    contributorColors: ["#f3c969", "#f3c969", "#7cc4ff"],
    progress: 35,
    chapters: 8,
    updatedAt: "2025-06-06",
    accent: "#7cc4ff",
  },
  {
    id: "d-spectral",
    title: "谱方法在机器学习中的应用",
    type: "教材",
    description:
      "统一讲解 PCA、谱聚类、核方法与图神经网络中的谱分析，强调算子理论与图拉普拉斯的联系。",
    contributors: ["周怀瑾", "韩青圭", "蒋明烛"],
    contributorColors: ["#5aa6f0", "#5aa6f0", "#f3c969"],
    progress: 81,
    chapters: 10,
    updatedAt: "2025-06-12",
    accent: "#eccd6b",
  },
  {
    id: "d-ot-gen",
    title: "最优传输与生成模型：理论综述",
    type: "论文",
    description:
      "从 Monge-Kantorovich 问题出发，综述 Wasserstein GAN、扩散模型与 Schrödinger 桥的统一传输视角。",
    contributors: ["陆星阑", "林照夜", "秦望舒", "沈砚书", "苏望舒"],
    contributorColors: ["#5aa6f0", "#7cc4ff", "#f3c969", "#7cc4ff", "#7cc4ff"],
    progress: 24,
    chapters: 7,
    updatedAt: "2025-06-03",
    accent: "#5aa6f0",
  },
];
