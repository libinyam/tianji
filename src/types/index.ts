// 天玑平台数据类型定义

export type BookCategory = "基础理论" | "深度学习" | "优化" | "概率统计";

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
}

export interface Answer {
  id: string;
  author: string;
  avatarColor: string;
  votes: number;
  accepted: boolean;
  content: string;
  date: string;
}

export interface Question {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  avatarColor: string;
  tags: string[];
  answers: number;
  views: number;
  votes: number;
  bounty?: number;
  createdAt: string;
  body: string; // 含 LaTeX 行间公式占位
  answerList: Answer[];
}

export interface Idea {
  id: string;
  title: string;
  summary: string;
  author: string;
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
