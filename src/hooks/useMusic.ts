import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { listListeningDays, listTopArtists, listTopTracks } from "@/lib/db/music";
import { addToPlaylist, addToQueue, removeFromPlaylist, findPlayingTrack, getArtistImage, getMyId, getPlaylistUris, type SpotifyPlaylist, getPlaylists, getPlaylistTracks, getQueue, play, search, useSpotify } from "@/lib/spotify";

/** Listening history (written by NowPlayingService, which invalidates ["music"] as it saves). */
export const MUSIC_KEY = ["music"] as const;

/** `before` is the day after the period (YYYY-MM-DD); left out, the period runs on to now. */
export function useListeningDays(from: string, before?: string) {
  return useQuery({
    queryKey: [...MUSIC_KEY, "days", from, before],
    queryFn: () => listListeningDays(from, before),
    placeholderData: (previous) => previous,
  });
}

export function useTopTracks(from: string, before?: string) {
  return useQuery({
    queryKey: [...MUSIC_KEY, "topTracks", from, before],
    queryFn: () => listTopTracks(from, before, 5),
    placeholderData: (previous) => previous,
  });
}

export function useTopArtists(from: string, before?: string) {
  return useQuery({
    queryKey: [...MUSIC_KEY, "topArtists", from, before],
    queryFn: () => listTopArtists(from, before, 5),
    placeholderData: (previous) => previous,
  });
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

export function useSpotifyMyId() {
  const connected = useConnected();
  return useQuery({ queryKey: [...SPOTIFY_KEY, "me"], queryFn: getMyId, enabled: connected, staleTime: Infinity, retry: 1 });
}

/** The playing song (as Windows reports it) on Spotify, looked up once per song. */
export function useSpotifyPlayingTrack(title: string | null, artist: string | null) {
  const connected = useConnected();
  return useQuery({
    queryKey: [...SPOTIFY_KEY, "playingTrack", title, artist],
    queryFn: () => findPlayingTrack(title!, artist ?? ""),
    enabled: connected && !!title,
    staleTime: Infinity,
    retry: 1,
  });
}

const urisKey = (playlist: SpotifyPlaylist) => [...SPOTIFY_KEY, "playlistUris", playlist.id, playlist.snapshot_id ?? ""];

/**
 * The songs in each of these playlists, as sets of URIs (undefined while loading). Kept per playlist
 * version (its snapshot id), so a playlist is read again only after it changes.
 */
export function useSpotifyPlaylistUris(playlists: SpotifyPlaylist[], enabled: boolean) {
  const queryClient = useQueryClient();
  return useQueries({
    queries: playlists.map((playlist) => ({
      queryKey: urisKey(playlist),
      queryFn: async () => new Set(await getPlaylistUris(playlist.id)),
      // While a changed playlist is read again, its last known songs stand in (no flicker).
      placeholderData: () =>
        queryClient
          .getQueriesData<Set<string>>({ queryKey: [...SPOTIFY_KEY, "playlistUris", playlist.id] })
          .map(([, data]) => data)
          .find(Boolean),
      enabled,
      staleTime: Infinity,
      gcTime: 60 * 60_000,
      retry: 1,
    })),
  });
}

export function useSpotifyAddToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlist, uri }: { playlist: SpotifyPlaylist; uri: string }) => addToPlaylist(playlist.id, uri),
    onSuccess: (_, { playlist, uri }) => {
      const playlistId = playlist.id;
      // Shown as added at once; the playlist list then refetches with the new snapshot id.
      queryClient.setQueryData<Set<string>>(urisKey(playlist), (old) => new Set([...(old ?? []), uri]));
      queryClient.setQueriesData<Set<string>>({ queryKey: [...SPOTIFY_KEY, "playlistUris", playlistId] }, (old) =>
        old ? new Set([...old, uri]) : old,
      );
      void queryClient.invalidateQueries({ queryKey: [...SPOTIFY_KEY, "playlist", playlistId] });
      void queryClient.invalidateQueries({ queryKey: [...SPOTIFY_KEY, "playlists"] });
    },
  });
}

export function useSpotifyRemoveFromPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlist, uri }: { playlist: SpotifyPlaylist; uri: string }) => removeFromPlaylist(playlist.id, uri),
    onSuccess: (_, { playlist, uri }) => {
      queryClient.setQueriesData<Set<string>>({ queryKey: [...SPOTIFY_KEY, "playlistUris", playlist.id] }, (old) => {
        if (!old) return old;
        const next = new Set(old);
        next.delete(uri);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: [...SPOTIFY_KEY, "playlist", playlist.id] });
      void queryClient.invalidateQueries({ queryKey: [...SPOTIFY_KEY, "playlists"] });
    },
  });
}
