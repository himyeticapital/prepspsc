import { create } from "zustand";
import type { NewsArticle, NewsCategory } from "@/types/news.types";

interface NewsState {
  // State
  isOpen: boolean;
  articles: NewsArticle[];
  activeCategory: NewsCategory;
  isLoading: boolean;
  error: string | null;
  totalAvailable: number;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setCategory: (category: NewsCategory) => void;
  fetchNews: (category?: NewsCategory) => Promise<void>;
}

export const useNewsStore = create<NewsState>((set, get) => ({
  // Initial state
  isOpen: false,
  articles: [],
  activeCategory: "sikkim",
  isLoading: false,
  error: null,
  totalAvailable: 0,

  // Actions
  setOpen: (open) => set({ isOpen: open }),

  toggleOpen: () => {
    const { isOpen, articles, activeCategory, fetchNews } = get();
    const newOpen = !isOpen;
    set({ isOpen: newOpen });

    // Fetch news when opening if we don't have articles yet
    if (newOpen && articles.length === 0) {
      fetchNews(activeCategory);
    }
  },

  setCategory: (category) => {
    set({ activeCategory: category });
    get().fetchNews(category);
  },

  fetchNews: async (category) => {
    const cat = category || get().activeCategory;
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/news?category=${cat}`);

      if (!response.ok) {
        throw new Error("Failed to fetch news");
      }

      const data = await response.json();

      set({
        articles: data.articles || [],
        totalAvailable: data.totalAvailable || 0,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching news:", error);
      set({
        error: "Failed to load news. Please try again.",
        isLoading: false,
      });
    }
  },
}));
