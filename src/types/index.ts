// 天玑平台数据类型定义

export type BookCategory = "基础理论" | "AI工具实战" | "项目实战" | "编程基础";

export interface Review {
  author: string;
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
  rating: number;
  year: number;
  pages: number;
  toc: string[];
  reviews: Review[];
  link?: string; // 外部链接
  fileUrl?: string; // 上传文件的临时下载 URL
  fileName?: string; // 上传文件的原始文件名
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
  createdAt: string;
  body: string; // 含 LaTeX 行间公式占位
  answerList: Answer[];
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

export interface Contributor {
  name: string;
  role: string;
  avatarColor: string;
  contributions: number;
}

export interface CommunityStat {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
}
