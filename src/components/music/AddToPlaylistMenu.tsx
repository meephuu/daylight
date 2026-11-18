import { useState } from "react";
import { Check, Loader2, Music2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useSpotifyAddToPlaylist,
  useSpotifyMyId,
  useSpotifyPlayingTrack,
  useSpotifyPlaylists,
  useSpotifyPlaylistUris,
  useSpotifyRemoveFromPlaylist,
} from "@/hooks/useMusic";
import type { Track } from "@/lib/nowPlaying";
import {
  canAddTo,
  canEditPlaylists,
  connectSpotify,
  explain,
  imageFor,
  usePinnedPlaylists,
  useSpotify,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from "@/lib/spotify";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function songCount(playlist: SpotifyPlaylist): string | null {
  const count = playlist.items?.total ?? playlist.tracks?.total;
  return count === undefined ? null : `${count} ${count === 1 ? "song" : "songs"}`;
}

/**
 * The button's mark: an outlined circle with a plus, or, once the song is in one of your playlists, a
 * circle filled in the sky accent with a check (the check says it, not only the colour).
 */
function Mark({ added }: { added: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[18px] place-items-center rounded-full transition-[background-color,box-shadow,color] duration-200",
        added
          ? "bg-sky-accent text-white shadow-[0_2px_8px_-2px_var(--sky-accent)] dark:text-[#0b1033]"
          : "ring-[1.5px] ring-current ring-inset",
      )}
    >
      {added ? <Check className="size-3" strokeWidth={3.25} /> : <Plus className="size-3" strokeWidth={2.5} />}
    </span>
  );
}

/** The list inside the menu: the playlists the account can add to, filtered by name. */
function PlaylistPicker({
  track,
  song,
  findingSong,
  playlists,
  contains,
  loading,
  error,
}: {
  track: Track;
  song: SpotifyTrack | null | undefined;
  findingSong: boolean;
  playlists: SpotifyPlaylist[];
  /** Whether a playlist has the song: true, false, or undefined while unknown. */
  contains: (playlist: SpotifyPlaylist) => boolean | undefined;
  loading: boolean;
  error: unknown;
}) {
  const add = useSpotifyAddToPlaylist();
  const remove = useSpotifyRemoveFromPlaylist();
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const wanted = filter.trim().toLowerCase();
  const shown = wanted ? playlists.filter((playlist) => playlist.name.toLowerCase().includes(wanted)) : playlists;

  // A click adds the song, or, where it is already in, takes it out again (with Undo).
  const toggle = (playlist: SpotifyPlaylist) => {
    if (adding) return;
    if (!song) {
      showToast({ message: `Could not find "${track.title}" on Spotify.` });
      return;
    }
    const target = { playlist, uri: song.uri };
    setAdding(playlist.id);
    if (contains(playlist)) {
      remove.mutate(target, {
        onSuccess: () =>
          showToast({
            message: `Removed "${song.name}" from ${playlist.name}`,
            actionLabel: "Undo",
            onAction: () => add.mutate(target, { onError: (failure) => showToast({ message: explain(failure) }) }),
          }),
        onError: (failure) => showToast({ message: explain(failure) }),
        onSettled: () => setAdding(null),
      });
      return;
    }
    add.mutate(target, {
      onSuccess: () => showToast({ message: `Added "${song.name}" to ${playlist.name}` }),
      onError: (failure) => showToast({ message: explain(failure) }),
      onSettled: () => setAdding(null),
    });
  };

  if (loading) {
    return (
      <div className="grid h-24 place-items-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-label="Loading playlists" />
      </div>
    );
  }
  if (error) return <p className="px-2 py-3 text-sm text-muted-foreground">{explain(error)}</p>;
  if (!playlists.length) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">No playlists of yours yet. Make one in Spotify first.</p>;
  }

  return (
    <>
      {playlists.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Find a playlist"
            aria-label="Find a playlist"
            className="h-9 pl-8"
            autoFocus
          />
        </div>
      )}
      <ul className="-mr-3 max-h-[300px] overflow-y-auto [scrollbar-gutter:stable]" aria-label="Your playlists">
        {shown.map((playlist) => {
          const busy = adding === playlist.id;
          const inIt = contains(playlist);
          const cover = imageFor(playlist.images, 64);
          return (
            <li key={playlist.id}>
              <button
                type="button"
                disabled={!!adding || findingSong}
                onClick={() => toggle(playlist)}
                aria-label={inIt ? `Remove from ${playlist.name}` : `Add to ${playlist.name}`}
                title={inIt ? `In ${playlist.name}. Click to remove it` : undefined}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 rounded-[16px] px-2 py-1.5 text-left outline-none transition-colors hover:bg-foreground/[0.07] focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-foreground/[0.1]",
                  adding && !busy && "opacity-50",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-foreground/10">
                  {cover ? (
                    <img src={cover} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <Music2 className="size-4 text-foreground/50" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{playlist.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[inIt ? "Added" : null, playlist.collaborative ? "Collaborative" : null, songCount(playlist)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="grid size-[18px] shrink-0 place-items-center text-foreground/60">
                  {busy || inIt === undefined ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <Mark added={inIt} />
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="px-2 py-3 text-sm text-muted-foreground">No playlist called "{filter.trim()}".</li>}
      </ul>
    </>
  );
}

/**
 * Adds the song playing now to one of your Spotify playlists, picked from a small menu by the player.
 * The button shows whether the song is already in one of them. Needs the Spotify sign-in with the
 * playlist permission (older sign-ins are asked to connect again).
 */
export function AddToPlaylistMenu({ track, className }: { track: Track | null; className?: string }) {
  const connected = useSpotify((state) => state.auth !== null);
  const allowed = useSpotify((state) => canEditPlaylists(state.auth));
  const clientId = useSpotify((state) => state.auth?.clientId ?? "");
  const reconnecting = useSpotify((state) => state.connecting);
  const [open, setOpen] = useState(false);
  const usable = connected && track !== null;

  const playlistsQuery = useSpotifyPlaylists();
  const myId = useSpotifyMyId();
  const songQuery = useSpotifyPlayingTrack(allowed ? (track?.title ?? null) : null, track?.artist ?? null);
  const pins = usePinnedPlaylists((state) => state.pins);
  // Pinned playlists first, in the order they were pinned (as on the Playlists tab), then the rest.
  const pinOrder = new Map(pins.map((pin, index) => [pin.id, index]));
  const playlists = (playlistsQuery.data ?? [])
    .filter((playlist) => canAddTo(playlist, myId.data))
    .sort((a, b) => (pinOrder.get(a.id) ?? pins.length) - (pinOrder.get(b.id) ?? pins.length));
  const uriSets = useSpotifyPlaylistUris(playlists, allowed && !!myId.data);
  const song = songQuery.data;

  const contains = (playlist: SpotifyPlaylist): boolean | undefined => {
    const set = uriSets[playlists.indexOf(playlist)]?.data;
    if (!set || song === undefined) return undefined;
    return !!song && set.has(song.uri);
  };
  const addedTo = song ? playlists.filter((playlist) => contains(playlist)) : [];
  const added = addedTo.length > 0;

  const label = !connected
    ? "Connect Spotify below to add songs to playlists"
    : !track
      ? "Nothing is playing"
      : added
        ? `In ${addedTo.map((playlist) => playlist.name).join(", ")}`
        : "Add to playlist";

  return (
    <Popover open={open && usable} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={!usable}
        aria-label={added ? `Add to playlist. ${label}` : "Add to playlist"}
        title={label}
        className={cn(className, added && "text-foreground")}
      >
        <Mark added={added} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] gap-3 p-3">
        <div className="px-2">
          <p className="font-display text-[17px] leading-tight font-semibold">Add to playlist</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={track ? `${track.title} · ${track.artist}` : undefined}>
            {track?.title} · {track?.artist}
          </p>
        </div>
        {track &&
          (allowed ? (
            <PlaylistPicker
              track={track}
              song={song}
              findingSong={songQuery.isLoading}
              playlists={playlists}
              contains={contains}
              loading={playlistsQuery.isLoading || myId.isLoading}
              error={playlistsQuery.error ?? myId.error}
            />
          ) : (
            <p className="px-2 pb-1 text-sm text-muted-foreground">
              Spotify needs one more permission to change your playlists.{" "}
              <button
                type="button"
                disabled={reconnecting}
                onClick={() => void connectSpotify(clientId)}
                className="font-medium text-foreground underline underline-offset-2 outline-none hover:text-sky-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                {reconnecting ? "Waiting for Spotify…" : "Connect again"}
              </button>
            </p>
          ))}
      </PopoverContent>
    </Popover>
  );
}
