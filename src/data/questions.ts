import type { Question } from "@/types";

export const questions: Question[] = [
  {
    id: "q-grad-convex",
    title: "为什么梯度下降在非凸问题上依然有效？背后的数学依据是什么？",
    excerpt:
      "深度学习的损失曲面高度非凸，但梯度下降却常能收敛到良好的局部极小。能否从优化理论与几何角度解释这一现象？",
    author: "陆星阑",
    avatarColor: "#5aa6f0",
    tags: ["优化", "非凸优化", "损失曲面"],
    answers: 7,
    views: 2184,
    votes: 156,
    bounty: 50,
    createdAt: "2025-06-08",
    body:
      "深度学习中损失函数 $L(\\theta)$ 通常是高度非凸的，但经验上随机梯度下降（SGD）仍能找到泛化良好的解。我的疑问是：\n\n1. 在高维参数空间中，局部极小值是否在某种意义下接近全局最优？\n2. 鞍点与局部极小的分布如何影响收敛？\n3. 能否用 $\\nabla L(\\theta)$ 的几何性质给出收敛性保证？\n\n我了解凸优化中梯度下降的收敛率 $O(1/t)$，但非凸情形似乎缺乏类似的理论。希望从数学视角得到解答。",
    answerList: [
      {
        id: "a1",
        author: "柯北辰",
        avatarColor: "#f3c969",
        votes: 88,
        accepted: true,
        content:
          "高维空间是关键。在超高维参数空间中，所有局部极小往往与全局最小非常接近，真正的障碍是鞍点而非局部极小。Dauphin 等人提出的鞍点消除（saddle-free Newton）方法正是基于此。可以参考神经网络的 spin glass 理论模型：当 $N \\to \\infty$ 时，局部极小的期望损失趋近全局最优。",
        date: "2025-06-08",
      },
      {
        id: "a2",
        author: "宋知遥",
        avatarColor: "#7cc4ff",
        votes: 41,
        accepted: false,
        content:
          "补充一个几何视角：随机梯度下降的噪声实际上帮助逃离尖锐的极小值，偏好平坦的极小值，而平坦极小值通常对应更好的泛化。这可以从损失曲面的 Hessian 谱来刻画：$\\nabla^2 L$ 的特征值越小，解越平坦。",
        date: "2025-06-09",
      },
    ],
  },
  {
    id: "q-pca-eigen",
    title: "PCA 的特征值分解与协方差矩阵的谱有何深刻联系？",
    excerpt:
      "主成分分析本质上是协方差矩阵的特征值分解，能否从谱定理与二次型角度深入理解其几何意义？",
    author: "苏望舒",
    avatarColor: "#7cc4ff",
    tags: ["线性代数", "谱理论", "降维"],
    answers: 5,
    views: 1432,
    votes: 92,
    createdAt: "2025-06-05",
    body:
      "PCA 通过对协方差矩阵 $\\Sigma = \\frac{1}{n}X^\\top X$ 做特征值分解 $\\Sigma = Q\\Lambda Q^\\top$ 实现降维。\n\n我想理解：为何特征向量恰好是方差最大的方向？这与谱定理 $\\Sigma = \\sum_i \\lambda_i v_i v_i^\\top$ 的关系如何？\n\n是否存在从 Rayleigh 商 $R(v) = \\frac{v^\\top \\Sigma v}{v^\\top v}$ 出发的更严格推导？",
    answerList: [
      {
        id: "a1",
        author: "陆星阑",
        avatarColor: "#5aa6f0",
        votes: 63,
        accepted: true,
        content:
          "PCA 本质上是带约束的 Rayleigh 商极大化问题：$\\max_{\\|v\\|=1} v^\\top \\Sigma v$。由 Rayleigh-Ritz 定理，其最大值恰为 $\\Sigma$ 的最大特征值 $\\lambda_1$，对应特征向量 $v_1$。逐次在正交补空间上求解即得所有主成分，这正是谱定理的体现。",
        date: "2025-06-05",
      },
    ],
  },
  {
    id: "q-info-geom",
    title: "信息几何如何解释自然梯度的优越性？",
    excerpt:
      "自然梯度用 Fisher 信息矩阵修正梯度方向，其背后的黎曼几何结构是什么？为何能加速收敛？",
    author: "秦望舒",
    avatarColor: "#f3c969",
    tags: ["信息几何", "黎曼流形", "自然梯度"],
    answers: 4,
    views: 986,
    votes: 78,
    bounty: 30,
    createdAt: "2025-06-02",
    body:
      "普通梯度 $\\nabla L$ 依赖于参数化，而自然梯度 $\\tilde{\\nabla} L = F^{-1}\\nabla L$（$F$ 为 Fisher 信息矩阵）据称与参数化无关。\n\n我的理解是 Fisher 矩阵定义了统计流形上的黎曼度量 $g_{ij} = F_{ij}$。请解释：\n\n1. 为何这一度量使自然梯度具有参数化不变性？\n2. KL 散度的一阶近似与 Fisher 矩阵的关系 $D_{KL}(p_\\theta \\| p_{\\theta+d\\theta}) \\approx \\frac{1}{2} d\\theta^\\top F\\, d\\theta$ 如何导出？",
    answerList: [
      {
        id: "a1",
        author: "沈砚书",
        avatarColor: "#7cc4ff",
        votes: 55,
        accepted: true,
        content:
          "Fisher 信息矩阵正是模型分布族构成的统计流形上的黎曼度量，由 Amari 提出。由于它由分布本身定义而非参数化，自然梯度在坐标变换下保持不变。KL 散度的二阶展开给出 $D_{KL} \\approx \\frac{1}{2}d\\theta^\\top F d\\theta$，因此沿自然梯度下降等价于在分布空间（而非参数空间）上做最速下降。",
        date: "2025-06-03",
      },
    ],
  },
  {
    id: "q-backprop-chain",
    title: "反向传播本质上就是链式法则吗？如何用矩阵微分严格表述？",
    excerpt:
      "反向传播被说成链式法则的应用，但与计算图、雅可比矩阵的关系如何？请给出严格的矩阵微分推导。",
    author: "林照夜",
    avatarColor: "#7cc4ff",
    tags: ["微积分", "矩阵微分", "自动微分"],
    answers: 9,
    views: 3051,
    votes: 134,
    createdAt: "2025-05-28",
    body:
      "反向传播算法计算 $\\frac{\\partial L}{\\partial W}$。若前向计算为 $z = Wa + b$，$a' = \\sigma(z)$，损失 $L$，则：\n\n$$\\frac{\\partial L}{\\partial W} = \\frac{\\partial L}{\\partial a'} \\frac{\\partial a'}{\\partial z} \\frac{\\partial z}{\\partial W}$$\n\n这是链式法则。但如何用雅可比矩阵 $J = \\frac{\\partial z}{\\partial a}$ 的语言统一表述？前向模式与反向模式自动微分的复杂度差异根源何在？",
    answerList: [
      {
        id: "a1",
        author: "韩青圭",
        avatarColor: "#5aa6f0",
        votes: 97,
        accepted: true,
        content:
          "反向传播 = 反向模式自动微分，本质是链式法则 + 动态规划。计算图中每个节点的局部雅可比 $J_k$ 的乘积给出整体导数。前向模式复杂度 $O(n)$ 对单输出 $O(1)$，反向模式 $O(m)$ 对单输入——当输出维度远小于输入维度时（损失为标量），反向模式更高效，这正是反向传播高效的根本原因。",
        date: "2025-05-28",
      },
    ],
  },
  {
    id: "q-spectral-cluster",
    title: "谱聚类的图拉普拉斯矩阵为何能揭示聚类结构？",
    excerpt:
      "谱聚类用图拉普拉斯 $L = D - W$ 的最小特征向量进行聚类，其与图分割、随机游走的关系是什么？",
    author: "周怀瑾",
    avatarColor: "#5aa6f0",
    tags: ["图论", "谱聚类", "随机游走"],
    answers: 3,
    views: 874,
    votes: 61,
    createdAt: "2025-05-24",
    body:
      "谱聚类构造相似度图，用归一化拉普拉斯 $L_{sym} = I - D^{-1/2}WD^{-1/2}$ 的最小 $k$ 个特征向量做嵌入再聚类。\n\n问题：\n1. 最小特征值 0 对应的特征向量为何编码了连通分量？\n2. 这与 RatioCut / NCut 目标函数的松弛有何关系？\n3. 图拉普拉斯与随机游走转移矩阵 $P = D^{-1}W$ 的谱有何联系？",
    answerList: [
      {
        id: "a1",
        author: "蒋明烛",
        avatarColor: "#f3c969",
        votes: 44,
        accepted: true,
        content:
          "当图有 $k$ 个连通分量时，$L$ 的零特征值重数恰为 $k$，对应特征向量在每个分量上为常数——这就是谱聚类的代数根源。归一化割 NCut 是 NP 难的离散问题，其连续松弛恰为 $L_{sym}$ 的广义特征值问题。随机游走视角下，$L_{rw}$ 的特征向量描述了随机游走混合时间，揭示流形结构。",
        date: "2025-05-25",
      },
    ],
  },
  {
    id: "q-kl-bayes",
    title: "KL 散度为何不是真正的距离？它与贝叶斯推断有何深层联系？",
    excerpt:
      "KL 散度非对称且不满足三角不等式，却在变分推断、ELBO 中扮演核心角色。其数学本质是什么？",
    author: "沈砚书",
    avatarColor: "#7cc4ff",
    tags: ["信息论", "变分推断", "贝叶斯"],
    answers: 6,
    views: 1721,
    votes: 109,
    bounty: 40,
    createdAt: "2025-05-20",
    body:
      "KL 散度 $D_{KL}(q \\| p) = \\int q \\log \\frac{q}{p}$ 非对称、不满足三角不等式，却无处不在。\n\n请解释：\n1. 为何 $D_{KL}(q\\|p) \\geq 0$（Gibbs 不等式）的证明揭示其本质？\n2. ELBO $\\mathcal{L} = \\log p(x) - D_{KL}(q(z|x) \\| p(z|x))$ 中，最大化 ELBO 与最小化 KL 的等价性如何严格得到？",
    answerList: [
      {
        id: "a1",
        author: "柯北辰",
        avatarColor: "#f3c969",
        votes: 72,
        accepted: true,
        content:
          "Gibbs 不等式由 Jensen 不等式给出：$-D_{KL} = \\int q \\log \\frac{p}{q} \\leq \\log \\int q \\frac{p}{q} = \\log 1 = 0$。变分推断中，对数证据可分解为 $\\log p(x) = \\mathcal{L}(q) + D_{KL}(q(z|x)\\|p(z|x))$。由于 $\\log p(x)$ 与 $q$ 无关，最大化 ELBO $\\mathcal{L}$ 等价于最小化 KL 散度，使 $q$ 逼近真实后验。",
        date: "2025-05-20",
      },
    ],
  },
];
