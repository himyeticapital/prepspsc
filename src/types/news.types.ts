export type NewsCategory = "sikkim" | "national" | "international";

export interface NewsArticle {
  id: number;
  title: string;
  summary: string | null;
  source_url: string;
  source_name: string;
  category: NewsCategory;
  published_at: string;
  fetched_at: string;
  image_url: string | null;
}

export interface UserNewsView {
  id: number;
  user_id: string;
  view_date: string;
  view_count: number;
}

// Category display info
export const NEWS_CATEGORIES: {
  id: NewsCategory;
  label: string;
  icon: string;
  source: string;
}[] = [
  { id: "sikkim", label: "Sikkim", icon: "📍", source: "Sikkim Express" },
  { id: "national", label: "National", icon: "🏛", source: "The Hindu" },
  { id: "international", label: "International", icon: "🌍", source: "BBC World" },
];

// Daily view limit for free users
export const FREE_USER_DAILY_LIMIT = 3;
