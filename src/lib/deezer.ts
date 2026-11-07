// Music search types (backed by iTunes Search API, mapped to DeezerTrack format)
export interface DeezerTrack {
  id: number;
  title: string;
  artist: { id: number; name: string };
  album: { id: number; title: string; cover_small: string; cover_medium: string; cover_big: string };
  preview: string; // 30s preview URL (m4a)
  duration: number;
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
}

/**
 * Search for tracks via iTunes Search API (proxied through Next.js API route).
 * Free, no auth required, globally available.
 * Returns up to 10 tracks with 30s preview URLs.
 */
export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  if (!query.trim()) return [];

  try {
    const res = await fetch(`/api/deezer-search?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    const data: DeezerSearchResponse = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Get a direct link to the track on Apple Music
 */
export function getDeezerTrackUrl(id: number): string {
  return `https://music.apple.com/search?term=${id}`;
}
