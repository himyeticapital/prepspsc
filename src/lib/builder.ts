// Builder/Founder configuration
// This identifies the app creator for special recognition

// The builder's username (used to identify the founder)
export const BUILDER_USERNAME = "yeti";

// Special builder avatar (mohawk with glasses)
export const BUILDER_AVATAR = "/avatars/builder.svg";

// Check if a user is the builder
export function isBuilder(username: string | null | undefined): boolean {
  if (!username) return false;
  return username.toLowerCase() === BUILDER_USERNAME.toLowerCase();
}
