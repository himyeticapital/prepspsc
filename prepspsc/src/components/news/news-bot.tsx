"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, X } from "lucide-react";
import { useNewsStore } from "@/stores/news-store";
import { NewsPanel } from "./news-panel";

export function NewsBot() {
  const { isOpen, toggleOpen } = useNewsStore();

  return (
    <>
      {/* Floating Button - hidden on mobile, shown on desktop */}
      <motion.button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/30 hidden md:flex items-center justify-center text-white hover:shadow-xl hover:shadow-primary/40 transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Newspaper className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* News Panel */}
      <AnimatePresence>
        {isOpen && <NewsPanel />}
      </AnimatePresence>
    </>
  );
}
