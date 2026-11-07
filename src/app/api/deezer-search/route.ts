import { NextRequest, NextResponse } from "next/server";

// iTunes Search API — free, no API key, globally available
// Maps response to DeezerTrack-compatible format for the client

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistId: number;
  artistName: string;
  collectionId: number;
  collectionName: string;
  artworkUrl60: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis: number;
}

interface ITunesResponse {
  resultCount: number;
  results: ITunesResult[];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ data: [], total: 0 });

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=10`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return NextResponse.json({ data: [], total: 0 });

    const itunes: ITunesResponse = await res.json();

    // Map iTunes results to DeezerTrack-compatible format
    const data = itunes.results
      .filter((r) => r.previewUrl) // Only include tracks with previews
      .map((r) => ({
        id: r.trackId,
        title: r.trackName,
        artist: { id: r.artistId, name: r.artistName },
        album: {
          id: r.collectionId,
          title: r.collectionName,
          cover_small: r.artworkUrl60,
          cover_medium: r.artworkUrl100,
          cover_big: r.artworkUrl100.replace("100x100", "600x600"),
        },
        preview: r.previewUrl,
        duration: Math.round(r.trackTimeMillis / 1000),
      }));

    return NextResponse.json({ data, total: itunes.resultCount });
  } catch {
    return NextResponse.json({ data: [], total: 0 }, { status: 500 });
  }
}
