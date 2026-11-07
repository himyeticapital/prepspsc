export type WidgetId =
  | "timer"
  | "tests"
  | "stats"
  | "leaderboard"
  | "chat"
  | "bookmarks"
  | "notes"
  | "background"
  | "settings"
  | "music"
  | "notifications";

export interface WidgetConfig {
  id: WidgetId;
  title: string;
  size: "sm" | "md" | "lg";
}

export interface BackgroundOption {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
}

export interface LofiStream {
  id: string;
  name: string;
  youtubeId: string;
}

export const BACKGROUNDS: BackgroundOption[] = [
  // Local backgrounds
  {
    id: "lofi-study-desk",
    name: "Study Desk",
    url: "/backgrounds/lofi-study-desk.jpg",
    thumbnail: "/backgrounds/lofi-study-desk.jpg",
  },
  {
    id: "lofi-rain-window",
    name: "Rainy Window",
    url: "/backgrounds/lofi-rain-window.jpg",
    thumbnail: "/backgrounds/lofi-rain-window.jpg",
  },
  {
    id: "lofi-cafe",
    name: "Cozy Cafe",
    url: "/backgrounds/lofi-cafe.jpg",
    thumbnail: "/backgrounds/lofi-cafe.jpg",
  },
  {
    id: "lofi-night-city",
    name: "Night City",
    url: "/backgrounds/lofi-night-city.jpg",
    thumbnail: "/backgrounds/lofi-night-city.jpg",
  },
  {
    id: "lofi-library",
    name: "Library",
    url: "/backgrounds/lofi-library.jpg",
    thumbnail: "/backgrounds/lofi-library.jpg",
  },
  // Unsplash backgrounds - cozy study vibes
  {
    id: "cozy-desk-lamp",
    name: "Desk Lamp",
    url: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=400&q=60",
  },
  {
    id: "rainy-window-coffee",
    name: "Rainy Day",
    url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&q=60",
  },
  {
    id: "bookshelf-cozy",
    name: "Bookshelf",
    url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&q=60",
  },
  {
    id: "night-city-lights",
    name: "City Lights",
    url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=60",
  },
  {
    id: "mountain-cabin",
    name: "Mountain View",
    url: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=400&q=60",
  },
  {
    id: "coffee-shop-window",
    name: "Coffee Shop",
    url: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=400&q=60",
  },
  {
    id: "sunset-clouds",
    name: "Sunset",
    url: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&q=60",
  },
  {
    id: "autumn-leaves",
    name: "Autumn",
    url: "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=400&q=60",
  },
  {
    id: "cozy-window",
    name: "Window Seat",
    url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&q=60",
  },
  {
    id: "starry-night",
    name: "Starry Night",
    url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=60",
  },
  {
    id: "japanese-garden",
    name: "Zen Garden",
    url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=60",
  },
  // Lofi-style backgrounds from Unsplash lofi collection
  {
    id: "neon-city",
    name: "Neon City",
    url: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&q=60",
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=60",
  },
  {
    id: "vinyl-records",
    name: "Vinyl Vibes",
    url: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=400&q=60",
  },
  {
    id: "foggy-forest",
    name: "Misty Forest",
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=60",
  },
  {
    id: "cozy-bedroom",
    name: "Cozy Room",
    url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&q=60",
  },
  {
    id: "purple-sky",
    name: "Purple Sky",
    url: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=400&q=60",
  },
  {
    id: "neon-alley",
    name: "Neon Alley",
    url: "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?w=400&q=60",
  },
  {
    id: "ocean-sunset",
    name: "Ocean Sunset",
    url: "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1920&q=80",
    thumbnail: "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=400&q=60",
  },
  // Solid color backgrounds
  {
    id: "solid-black",
    name: "Pure Black",
    url: "solid:#000000",
    thumbnail: "solid:#000000",
  },
  {
    id: "solid-charcoal",
    name: "Charcoal",
    url: "solid:#1a1a1a",
    thumbnail: "solid:#1a1a1a",
  },
  {
    id: "solid-espresso",
    name: "Espresso",
    url: "solid:#2c1810",
    thumbnail: "solid:#2c1810",
  },
  {
    id: "solid-burgundy",
    name: "Burgundy",
    url: "solid:#4a1f1f",
    thumbnail: "solid:#4a1f1f",
  },
  {
    id: "solid-warm-brown",
    name: "Warm Brown",
    url: "solid:#3e2723",
    thumbnail: "solid:#3e2723",
  },
  {
    id: "solid-slate",
    name: "Slate Gray",
    url: "solid:#4a4a4a",
    thumbnail: "solid:#4a4a4a",
  },
];

export const LOFI_STREAMS: LofiStream[] = [
  { id: "lofi-girl", name: "Lofi Girl", youtubeId: "jfKfPfyJRdk" },
  { id: "coffee-shop", name: "Jazz", youtubeId: "VMAPTo7RVCo" },
];

export const WIDGET_CONFIGS: Record<WidgetId, WidgetConfig> = {
  timer: { id: "timer", title: "Study Timer", size: "lg" },
  tests: { id: "tests", title: "Mock Tests", size: "md" },
  stats: { id: "stats", title: "My Stats", size: "sm" },
  leaderboard: { id: "leaderboard", title: "Leaderboard", size: "md" },
  chat: { id: "chat", title: "Study Room", size: "lg" },
  bookmarks: { id: "bookmarks", title: "Saved Questions", size: "md" },
  notes: { id: "notes", title: "Tasks", size: "md" },
  background: { id: "background", title: "Background", size: "md" },
  settings: { id: "settings", title: "Settings", size: "sm" },
  music: { id: "music", title: "Lofi Music", size: "md" },
  notifications: { id: "notifications", title: "Notifications", size: "md" },
};
