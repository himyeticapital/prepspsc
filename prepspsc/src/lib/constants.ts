// Table constants
export const TABLE_CONSTANTS = {
  MAX_CAPACITY: 4,
  DEFAULT_MAX_TABLES_PER_ROOM: 20,
  MIN_MAX_TABLES: 5,
  MAX_MAX_TABLES: 50,
  TABLE_NAME_MAX_LENGTH: 50,
  TABLE_NAME_MIN_LENGTH: 3,
} as const;

// Room icons for admin selection
export const ROOM_ICONS = [
  "users",
  "book-open",
  "landmark",
  "newspaper",
  "briefcase",
  "crown",
  "coffee",
  "lamp",
  "library",
  "graduation-cap",
  "brain",
  "target",
] as const;

// Room colors for admin selection
export const ROOM_COLORS = [
  "teal",
  "blue",
  "amber",
  "cyan",
  "rose",
  "orange",
  "purple",
  "green",
  "indigo",
  "pink",
] as const;

// Room categories
export const ROOM_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "prelims", label: "Prelims" },
  { value: "mains", label: "Mains" },
  { value: "history", label: "History" },
  { value: "geography", label: "Geography" },
  { value: "polity", label: "Polity" },
  { value: "economy", label: "Economy" },
  { value: "current-affairs", label: "Current Affairs" },
  { value: "science", label: "Science" },
  { value: "maths", label: "Maths & Reasoning" },
  { value: "english", label: "English" },
  { value: "sikkim-gk", label: "Sikkim GK" },
  { value: "block-officer", label: "Block Officer" },
  { value: "late-night", label: "Late Night Focus" },
] as const;

export type RoomIcon = (typeof ROOM_ICONS)[number];
export type RoomColor = (typeof ROOM_COLORS)[number];
export type RoomCategory = (typeof ROOM_CATEGORIES)[number]["value"];
