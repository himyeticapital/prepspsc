"use client";

import { motion } from "framer-motion";
import { ExternalLink, Loader2, RefreshCw, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useNewsStore } from "@/stores/news-store";
import { NEWS_CATEGORIES } from "@/types/news.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// UPSC Coaching Resources - Direct links to daily current affairs
const UPSC_RESOURCES = [
  {
    name: "Vision IAS",
    url: "https://visionias.in/current-affairs/",
    description: "Daily News & Analysis",
    icon: "📚",
  },
  {
    name: "Vajiram & Ravi",
    url: "https://vajiramandravi.com/current-affairs/",
    description: "Daily Current Affairs",
    icon: "📖",
  },
  {
    name: "Drishti IAS",
    url: "https://www.drishtiias.com/current-affairs-news-analysis-editorials",
    description: "Daily News Analysis",
    icon: "📰",
  },
  {
    name: "Insights IAS",
    url: "https://www.insightsonindia.com/current-affairs-upsc/",
    description: "Daily Current Affairs",
    icon: "💡",
  },
];

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function NewsPanel() {
  const {
    articles,
    activeCategory,
    isLoading,
    error,
    totalAvailable,
    setCategory,
    fetchNews,
  } = useNewsStore();

  const [showResources, setShowResources] = useState(false);

  const handleArticleClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed bottom-24 right-6 z-50 w-[380px] h-[500px] rounded-2xl bg-background/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📰</span>
            <h3 className="font-semibold text-white">Current Affairs Bot</h3>
          </div>
          <button
            onClick={() => fetchNews(activeCategory)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1">
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                activeCategory === cat.id
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content - Scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-white/60">
            <p>{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNews(activeCategory)}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            <p>No news available for this category.</p>
          </div>
        ) : (
          <>
            {articles.map((article, index) => (
              <motion.button
                key={article.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleArticleClick(article.source_url)}
                className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
              >
                <h4 className="text-sm font-medium text-white line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">
                  {article.title}
                </h4>
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>{article.source_name}</span>
                  <div className="flex items-center gap-1">
                    <span>{formatTimeAgo(article.published_at)}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.button>
            ))}
          </>
        )}
      </div>

      {/* UPSC Resources Section */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowResources(!showResources)}
          className="w-full p-3 flex items-center justify-between text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>UPSC Coaching Current Affairs</span>
          </div>
          {showResources ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showResources && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3 space-y-2"
          >
            {UPSC_RESOURCES.map((resource) => (
              <button
                key={resource.name}
                onClick={() => handleArticleClick(resource.url)}
                className="w-full text-left p-2.5 rounded-lg bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 border border-orange-500/20 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{resource.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-orange-300 transition-colors">
                      {resource.name}
                    </div>
                    <div className="text-xs text-white/50">{resource.description}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-orange-400 transition-colors" />
                </div>
              </button>
            ))}
            <p className="text-[10px] text-white/40 text-center pt-1">
              Daily current affairs from top UPSC coaching institutes
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <div className="text-center text-xs text-white/50">
          <span>{totalAvailable} articles available</span>
        </div>
      </div>
    </motion.div>
  );
}
