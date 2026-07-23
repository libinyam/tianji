// 天玑平台数据类型定义

export type BookCategory = "基础理论" | "AI工具实战" | "项目实战" | "编程基础";

export interface Review {
  author: string;
  authorUid?: string;
  rating: number;
  content: string;
  date: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  accent: string; // 封面主色
  summary: string;
  favorites: number;
  downloads: number; // #96 下载数（详情页/书卡展示）
  rating: number;
  year: number;
  pages: number;
  toc: string[];
  reviews: Review[];
  link?: string; // 外部链接
  fileUrl?: string; // 上传文件的临时下载 URL
  fileName?: string; // 上传文件的原始文件名
  createdAt: string; // #96 创建时间（"最新"排序使用）
  authorUid?: string; // #96 上传者 uid（编辑/删除权限校验）
}

export interface Comment {
  id: string;
  author: string;
  authorUid?: string;
  avatarColor: string;
  content: string;
  date: string;
  replyTo?: string; // 回复的评论 id（可选，用于嵌套回复）
}

export interface Answer {
  id: string;
  author: string;
  authorUid?: string;
  avatarColor: string;
  votes: number;
  accepted: boolean;
  content: string;
  date: string;
  comments?: Comment[];
}

export type PostCategory = "academic" | "casual";
export type CasualSubCategory = "灌水" | "动态" | "新闻" | "其他";

export interface Question {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  authorUid?: string;
  avatarColor: string;
  tags: string[];
  answers: number;
  views: number;
  votes: number;
  bounty?: number;
  category?: PostCategory;
  subCategory?: CasualSubCategory;
  createdAt: string;
  body: string; // 含 LaTeX 行间公式占位
  answerList: Answer[];
  pinned?: boolean; // 置顶
  locked?: boolean; // 锁定
  featured?: boolean; // 加精
}

export interface IdeaComment {
  id: string;
  author: string;
  authorUid: string;
  avatarColor: string;
  content: string;
  createdAt: string;
}

export interface Idea {
  id: string;
  title: string;
  summary: string;
  author: string;
  authorUid?: string;
  avatarColor: string;
  topic: string;
  tags: string[];
  resonance: number;
  replies: number;
  createdAt: string;
  comments?: IdeaComment[];
  resonatedBy?: string[];
}

export interface Doc {
  id: string;
  title: string;
  type: "教材" | "论文";
  description: string;
  contributors: string[];
  contributorColors: string[];
  progress: number;
  chapters: number;
  updatedAt: string;
  accent: string;
}
