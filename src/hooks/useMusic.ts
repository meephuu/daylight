import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listListeningDays, listTopArtists, listTopTracks } from "@/lib/db/music";
import { addToQueue, getArtistImage, getPlaylists, getPlaylistTracks, getQueue, play, search, useSpotify } from "@/lib/spotify";

/** Listening history (written by NowPlayingService, which invalidates ["music"] as it saves). */
export const MUSIC_KEY = ["music"] as const;

export function useListeningDays(from: string) {
  return useQuery({ queryKey: [...MUSIC_KEY, "days", from], queryFn: () => listListeningDays(from) });
}

export function useTopTracks(from: string) {
  return useQuery({ queryKey: [...MUSIC_KEY, "topTracks", from], queryFn: () => listTopTracks(from, 5) });
}

export function useTopArtists(from: string) {
  return useQuery({ queryKey: [...MUSIC_KEY, "topArtists", from], queryFn: () => listTopArtists(from, 5) });
}

/* --- Spotify Web API ------------------------------------------------------------------------------- */

export const SPOTIFY_KEY = ["spotify"] as const;

const useConnected = () => useSpotify((state) => state.auth !== null);

export function useSpotifyPlaylists() {
  const connected = useConnected();
  return useQuery({ queryKey: [...SPOTIFY_KEY, "playlists"], queryFn: getPlaylists, enabled: connected, staleTime: 5 * 60_000, retry: 1 });
}

export function useSpotifyPlaylistTracks(id: string | null) {
  const connected = useConnected();
  return useQuery({
    queryKey: [...SPOTIFY_KEY, "playlist", id],
    queryFn: () => getPlaylistTracks(id!),
    enabled: connected && id !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** The queue; `songKey` (the playing song) refetches it when the song changes. */
export function useSpotifyQueue(songKey: string | null) {
  const connected = useConnected();
  return useQuery({
    queryKey: [...SPOTIFY_KEY, "queue", songKey],
    queryFn: getQueue,
    enabled: connected,
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
    retry: 1,
  });
}

export function useSpotifySearch(query: string) {
  const connected = useConnected();
  return useQuery({
    queryKey: [...SPOTIFY_KEY, "search", query],
    queryFn: () => search(query),
    enabled: connected && query.length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    retry: 1,
  });
}

/** An artist's photo from Spotify (kept for a day; artist photos rarely change). */
export function useSpotifyArtistImage(name: string | null) {
  const connected = useConnected();
  return useQuery({
    queryKey: [...SPOTIFY_KEY, "artistImage", name],
    queryFn: () => getArtistImage(name!),
    enabled: connected && !!name,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });
}

export function useSpotifyPlay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: play,
    onSuccess: () => window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: [...SPOTIFY_KEY, "queue"] }), 800),
  });
}

export function useSpotifyAddToQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addToQueue,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...SPOTIFY_KEY, "queue"] }),
  });
}
