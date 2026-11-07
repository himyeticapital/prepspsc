// Avatar configuration with metadata
export interface AvatarOption {
  id: string;
  src: string;
  label: string;
}

export const PRESET_AVATARS: AvatarOption[] = [
  { id: "avatar-1", src: "/avatars/avatar-1.svg", label: "Alex" },
  { id: "avatar-2", src: "/avatars/avatar-2.svg", label: "Maya" },
  { id: "avatar-3", src: "/avatars/avatar-3.svg", label: "Raj" },
  { id: "avatar-4", src: "/avatars/avatar-4.svg", label: "Priya" },
  { id: "avatar-5", src: "/avatars/avatar-5.svg", label: "Dev" },
  { id: "avatar-6", src: "/avatars/avatar-6.svg", label: "Anita" },
  { id: "avatar-7", src: "/avatars/avatar-7.svg", label: "Arjun" },
  { id: "avatar-8", src: "/avatars/avatar-8.svg", label: "Sneha" },
  { id: "avatar-9", src: "/avatars/avatar-9.svg", label: "Sunny" },
  { id: "avatar-10", src: "/avatars/avatar-10.svg", label: "River" },
];

// Special builder avatar (mohawk + glasses) - exclusive to app creator
export const BUILDER_AVATAR: AvatarOption = {
  id: "builder",
  src: "/avatars/builder.svg",
  label: "Builder (Exclusive)",
};

// Default avatar for new users
export const DEFAULT_AVATAR = "/avatars/avatar-1.svg";

// Helper to check if a URL is a preset avatar
export function isPresetAvatar(url: string | null | undefined): boolean {
  if (!url) return false;
  return PRESET_AVATARS.some((avatar) => avatar.src === url);
}

// Get avatar option by src
export function getAvatarBySrc(src: string): AvatarOption | undefined {
  return PRESET_AVATARS.find((avatar) => avatar.src === src);
}
