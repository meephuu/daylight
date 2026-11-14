import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowLeft, Check, Copy, ListMusic, ListPlus, Pin, Loader2, Music2, Play, Search, X } from "lucide-react";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useSpotifyAddToQueue,
  useSpotifyPlay,
  useSpotifyPlaylists,
  useSpotifyPlaylistTracks,
  useSpotifyQueue,
  useSpotifySearch,
} from "@/hooks/useMusic";
import { formatTrackTime, trackKey, useNowPlaying } from "@/lib/nowPlaying";
import {
  artistNames,
  connectSpotify,
  explain,
  imageFor,
  REDIRECT_URI,
  usePinnedPlaylists,
  useSpotify,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from "@/lib/spotify";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "grid size-8 shrink-0 place-items-center rounded-full text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

function Cover({ src, size = "size-10", round = false }: { src: string | null; size?: string; round?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-foreground/10",
        size,
        round ? "rounded-full" : "rounded-[5px]",
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Music2 className="size-4 text-foreground/50" aria-hidden="true" />
      )}
    </span>
  );
}

function usePlayer() {
  const play = useSpotifyPlay();
  const queue = useSpotifyAddToQueue();
  // The song (its Spotify URI) that was just asked to play, until Spotify answers.
  const [starting, setStarting] = useState<string | null>(null);
  return {
    starting,
    play: (target: Parameters<typeof play.mutate>[0], name?: string) => {
      setStarting(target.offsetUri ?? target.uris?.[0] ?? target.contextUri ?? null);
      play.mutate(target, {
        onSuccess: (result) => {
          // Not certainly this PC (another computer, or Spotify here did not open): say where it plays.
          if (!result.thisPc) showToast({ message: `Playing${name ? ` "${name}"` : ""} on ${result.device}` });
          else if (name) showToast({ message: `Playing "${name}"` });
        },
        onError: (error) => showToast({ message: explain(error) }),
        onSettled: () => setStarting(null),
      });
    },
    queue: (track: SpotifyTrack) =>
      queue.mutate(track.uri, {
        onSuccess: () => showToast({ message: `Added "${track.name}" to the queue` }),
        onError: (error) => showToast({ message: explain(error) }),
      }),
  };
}

/** A song row: click (or Enter) plays it; the queue button adds it after the current song. */
function TrackRow({
  track,
  index,
  playing,
  starting,
  onPlay,
  onQueue,
}: {
  track: SpotifyTrack;
  index?: number;
  playing?: boolean;
  /** Asked to play, waiting for Spotify. */
  starting?: boolean;
  onPlay?: () => void;
  onQueue?: () => void;
}) {
  return (
    <li
      className={cn(
        "group/row relative flex min-w-0 items-center gap-3 rounded-[16px] px-2 py-1.5 transition-colors hover:bg-foreground/[0.06]",
        onPlay && "cursor-pointer active:bg-foreground/[0.09]",
      )}
      onClick={onPlay}
    >
      {index !== undefined && <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{index}</span>}
      <Cover src={imageFor(track.album?.images, 64)} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13.5px] leading-snug font-medium", playing && "text-sky-accent")} title={track.name}>
          {track.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{artistNames(track.artists)}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatTrackTime(track.duration_ms)}</span>
      {onQueue && (
        <button
          type="button"
          className={cn(ICON_BUTTON, "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100")}
          onClick={(event) => {
            event.stopPropagation();
            onQueue();
          }}
          aria-label={`Add ${track.name} to the queue`}
          title="Add to queue"
        >
          <ListPlus className="size-4" />
        </button>
      )}
      {onPlay && (
        <button
          type="button"
          className={cn(ICON_BUTTON, starting ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100")}
          onClick={(event) => {
            event.stopPropagation();
            onPlay();
          }}
          aria-label={`Play ${track.name}`}
          title="Play"
        >
          {starting ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Play className="size-4" fill="currentColor" />
          )}
        </button>
      )}
    </li>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function Loading() {
  return (
    <div className="grid place-items-center py-10 text-muted-foreground">
      <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-label="Loading" />
    </div>
  );
}

function UpNext() {
  const { track } = useNowPlaying();
  const { data, isLoading, error } = useSpotifyQueue(track ? trackKey(track) : null);
  const { queue } = usePlayer();
  if (isLoading) return <Loading />;
  if (error) return <Message>{explain(error)}</Message>;
  if (!data?.current) return <Message>Nothing is playing on Spotify right now.</Message>;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="mb-1 px-2 text-[13px] font-semibold text-foreground/85">Now playing</h3>
        <ul>
          <TrackRow track={data.current} playing />
        </ul>
      </div>
      <div>
        <h3 className="mb-1 px-2 text-[13px] font-semibold text-foreground/85">Up next</h3>
        {data.queue.length === 0 ? (
          <Message>The queue is empty. Add songs from search or a playlist.</Message>
        ) : (
          <ul>
            {data.queue.map((item, index) => (
              <TrackRow key={`${item.uri}-${index}`} track={item} index={index + 1} onQueue={() => queue(item)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PlaylistDetail({ playlist, onBack, backLabel }: { playlist: SpotifyPlaylist; onBack: () => void; backLabel: string }) {
  const { data, isLoading, error } = useSpotifyPlaylistTracks(playlist.id);
  const { play, queue, starting } = usePlayer();
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 rounded-full py-1 pr-3 pl-2 text-[13px] text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </button>
      <div className="flex items-end gap-4 px-2 pb-1">
        <Cover src={imageFor(playlist.images, 300)} size="size-24 rounded-[10px] shadow-[0_14px_30px_-16px_rgb(0_0_0/0.8)]" />
        <div className="min-w-0 flex-1 pb-0.5">
          <p className="line-clamp-2 font-display text-[24px] leading-[1.1] font-semibold tracking-[-0.02em]">{playlist.name}</p>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">{playlistLine(playlist)}</p>
        </div>
        <Button
          className="mb-0.5 rounded-full transition-transform hover:scale-[1.03] active:scale-[0.97]"
          onClick={() => play({ contextUri: playlist.uri })}
        >
          <Play className="size-3.5" fill="currentColor" />
          Play
        </Button>
      </div>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <Message>{explain(error)}</Message>
      ) : (
        <ul>
          {(data ?? []).map((track, index) => (
            <TrackRow
              key={`${track.uri}-${index}`}
              track={track}
              index={index + 1}
              starting={starting === track.uri}
              onPlay={() => play({ contextUri: playlist.uri, offsetUri: track.uri }, track.name)}
              onQueue={() => queue(track)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A cover in a grid (playlists, albums): the cover leads, the name and one line under it. Hover lifts the
 * tile 2px, zooms the cover a touch inside its frame and brings up a play button on it.
 */
function CoverTile({
  title,
  subtitle,
  image,
  onOpen,
  onPlay,
  pinned,
  onPin,
}: {
  title: string;
  subtitle: string;
  image: string | null;
  onOpen: () => void;
  onPlay: () => void;
  /** Playlists only: pinned ones sit first in Playlists and wear a pin on the cover. */
  pinned?: boolean;
  onPin?: () => void;
}) {
  return (
    <li className="group/tile relative transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <button
        type="button"
        onClick={onOpen}
        title={title}
        className="flex w-full flex-col gap-2.5 rounded-[18px] p-2 text-left outline-none transition-colors duration-200 hover:bg-foreground/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="relative block aspect-square overflow-hidden rounded-[10px] bg-foreground/10 shadow-[0_10px_22px_-14px_rgb(0_0_0/0.7)] transition-shadow duration-200 group-hover/tile:shadow-[0_16px_30px_-14px_rgb(0_0_0/0.8)]">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              draggable={false}
              className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tile:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <ListMusic className="absolute inset-0 m-auto size-8 text-foreground/40" aria-hidden="true" />
          )}
        </span>
        <span className="block min-w-0 px-0.5 pb-0.5">
          <span className="block truncate text-[13.5px] leading-snug font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </button>
      {/* Laid over the cover's corner: a sibling of the tile's button, never a button inside a button. */}
      <div className="pointer-events-none absolute inset-x-2 top-2 aspect-square">
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${title}`}
          className="pointer-events-auto absolute right-2 bottom-2 grid size-10 translate-y-1 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-[0_8px_18px_-8px_rgb(0_0_0/0.7)] outline-none transition-[opacity,translate,scale] duration-200 ease-out group-hover/tile:translate-y-0 group-hover/tile:opacity-100 hover:scale-105 focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 motion-reduce:translate-y-0"
        >
          <Play className="ml-0.5 size-4" fill="currentColor" />
        </button>
        {onPin && (
          <button
            type="button"
            onClick={onPin}
            aria-pressed={!!pinned}
            aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
            title={pinned ? "Unpin" : "Pin to the top of Playlists"}
            className={cn(
              "pointer-events-auto absolute top-2 left-2 grid size-8 place-items-center rounded-full outline-none transition-[opacity,background-color,scale] duration-200 hover:scale-105 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
              pinned
                ? "glass text-foreground opacity-100"
                : "glass text-foreground opacity-0 group-hover/tile:opacity-100",
            )}
          >
            {pinned ? <Pin className="size-3.5" fill="currentColor" /> : <Pin className="size-3.5" />}
          </button>
        )}
      </div>
    </li>
  );
}

const TILE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-1 gap-y-2";

function playlistLine(playlist: SpotifyPlaylist): string {
  const count = playlist.items?.total ?? playlist.tracks?.total;
  return [playlist.owner.display_name, count !== undefined ? `${count} songs` : null].filter(Boolean).join(" · ");
}

function Playlists() {
  const { data, isLoading, error } = useSpotifyPlaylists();
  const { play } = usePlayer();
  const { pins, togglePin } = usePinnedPlaylists();
  const [open, setOpen] = useState<SpotifyPlaylist | null>(null);
  if (open) return <PlaylistDetail playlist={open} onBack={() => setOpen(null)} backLabel="Playlists" />;
  if (isLoading) return <Loading />;
  if (error) return <Message>{explain(error)}</Message>;
  const library = data ?? [];
  const pinnedIds = new Set(pins.map((item) => item.id));
  const ordered = [
    ...pins.map((pin) => library.find((item) => item.id === pin.id) ?? pin),
    ...library.filter((item) => !pinnedIds.has(item.id)),
  ];
  if (!ordered.length) return <Message>No playlists on this account yet.</Message>;
  return (
    <ul className={TILE_GRID}>
      {ordered.map((playlist) => (
        <CoverTile
          key={playlist.id}
          title={playlist.name}
          subtitle={playlistLine(playlist)}
          image={imageFor(playlist.images, 300)}
          onOpen={() => setOpen(playlist)}
          onPlay={() => play({ contextUri: playlist.uri })}
          pinned={pinnedIds.has(playlist.id)}
          onPin={() => togglePin(playlist)}
        />
      ))}
    </ul>
  );
}

function SearchResults({ query }: { query: string }) {
  const { data, isLoading, error } = useSpotifySearch(query);
  const { play, queue, starting } = usePlayer();
  const { pins, togglePin } = usePinnedPlaylists();
  const [open, setOpen] = useState<SpotifyPlaylist | null>(null);
  useEffect(() => setOpen(null), [query]);
  if (open) return <PlaylistDetail playlist={open} onBack={() => setOpen(null)} backLabel="Results" />;
  if (isLoading && !data) return <Loading />;
  if (error) return <Message>{explain(error)}</Message>;
  if (!data) return null;
  const nothing = !data.tracks.length && !data.albums.length && !data.playlists.length;
  if (nothing) return <Message>Nothing on Spotify matches "{query}".</Message>;
  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", isLoading && "opacity-60")}>
      {data.tracks.length > 0 && (
        <div>
          <h3 className="mb-1 px-2 text-[13px] font-semibold text-foreground/85">Songs</h3>
          <ul>
            {data.tracks.map((track) => (
              <TrackRow
                key={track.uri}
                track={track}
                starting={starting === track.uri}
                // Played the way playlists are (a context and a song in it): its album, from this song on.
                // Asking for the song on its own does not start playback on this PC.
                onPlay={() =>
                  play(
                    track.album?.uri ? { contextUri: track.album.uri, offsetUri: track.uri } : { uris: [track.uri] },
                    track.name,
                  )
                }
                onQueue={() => queue(track)}
              />
            ))}
          </ul>
        </div>
      )}
      {data.albums.length > 0 && (
        <div>
          <h3 className="mb-1 px-2 text-[13px] font-semibold text-foreground/85">Albums</h3>
          <ul className={TILE_GRID}>
            {data.albums.map((album) => (
              <CoverTile
                key={album.uri}
                title={album.name}
                subtitle={artistNames(album.artists)}
                image={imageFor(album.images, 300)}
                onOpen={() => play({ contextUri: album.uri })}
                onPlay={() => play({ contextUri: album.uri })}
              />
            ))}
          </ul>
        </div>
      )}
      {data.playlists.length > 0 && (
        <div>
          <h3 className="mb-1 px-2 text-[13px] font-semibold text-foreground/85">Playlists</h3>
          <ul className={TILE_GRID}>
            {data.playlists.map((playlist) => (
              <CoverTile
                key={playlist.id}
                title={playlist.name}
                subtitle={playlistLine(playlist)}
                image={imageFor(playlist.images, 300)}
                onOpen={() => setOpen(playlist)}
                onPlay={() => play({ contextUri: playlist.uri })}
                pinned={pins.some((item) => item.id === playlist.id)}
                onPin={() => togglePin(playlist)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** First use: the owner's own Spotify developer app, then sign in once. */
function ConnectSpotify() {
  const { connecting, error } = useSpotify();
  const [clientId, setClientId] = useState(() => useSpotify.getState().auth?.clientId ?? "");
  const [copied, setCopied] = useState(false);

  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-4 py-4">
      <div>
        <h3 className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">Connect your Spotify account</h3>
        <p className="mt-1.5 text-sm text-foreground/75">
          Search, playlists and the queue come from Spotify itself. That needs a free Spotify developer app, set up once:
        </p>
      </div>
      <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-sm text-foreground/85 marker:text-muted-foreground">
        <li>
          Open{" "}
          <a
            href="https://developer.spotify.com/dashboard"
            onClick={(event) => {
              event.preventDefault();
              void openUrl("https://developer.spotify.com/dashboard");
            }}
            className="font-medium underline underline-offset-3"
          >
            developer.spotify.com/dashboard
          </a>{" "}
          and choose <span className="font-medium">Create app</span>.
        </li>
        <li>
          Add this Redirect URI and tick <span className="font-medium">Web API</span>:
          <span className="glass-well mt-1.5 flex items-center gap-2 rounded-[14px] py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 truncate text-[12.5px]">{REDIRECT_URI}</code>
            <button
              type="button"
              className={ICON_BUTTON}
              onClick={() => {
                void navigator.clipboard.writeText(REDIRECT_URI).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              aria-label="Copy redirect URI"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </span>
        </li>
        <li>Copy the app's Client ID here and connect.</li>
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void connectSpotify(clientId);
        }}
      >
        <Input
          value={clientId}
          onChange={(event) => setClientId(event.currentTarget.value)}
          placeholder="Client ID"
          aria-label="Spotify Client ID"
          spellCheck={false}
          className="h-9 rounded-full px-3.5"
        />
        <Button type="submit" className="rounded-full" disabled={!clientId.trim() || connecting}>
          {connecting && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          {connecting ? "Waiting for Spotify" : "Connect"}
        </Button>
      </form>
      {connecting && (
        <p className="text-xs text-muted-foreground">Approve Daylight in the browser tab that opened, then come back here.</p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Playing songs from Daylight needs Spotify Premium. Browsing works on any account.
      </p>
    </div>
  );
}

type Tab = "next" | "playlists";

/** Search Spotify, see what is up next, and play from your playlists. */
export function SpotifyLibrary() {
  const connected = useSpotify((state) => state.auth !== null);
  const [tab, setTab] = useState<Tab>("playlists");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  // Search once typing pauses.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(text.trim()), 350);
    return () => window.clearTimeout(id);
  }, [text]);

  if (!connected) {
    return (
      <section className="pane min-h-0 flex-1 overflow-y-auto p-4" aria-label="Spotify">
        <ConnectSpotify />
      </section>
    );
  }

  // Two panes: the search bar (with the Up next / Playlists switch), then what it shows.
  return (
    <>
      <div className="pane flex shrink-0 flex-wrap items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 focus-within:ring-3 focus-within:ring-ring/50">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => event.key === "Escape" && setText("")}
          placeholder="Search songs, albums and playlists"
          aria-label="Search Spotify"
          className="h-9 min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {text && (
          <button type="button" className={cn(ICON_BUTTON, "size-7")} onClick={() => setText("")} aria-label="Clear search">
            <X className="size-3.5" />
          </button>
        )}
        {!query && (
          <Segmented
            size="sm"
            semantics="tabs"
            aria-label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: "playlists", label: "Playlists" },
              { value: "next", label: "Up next" },
            ]}
          />
        )}
      </div>
      <section
        className="pane min-h-0 flex-1 overflow-y-auto p-3"
        aria-label={query ? `Spotify results for ${query}` : tab === "next" ? "Up next" : "Playlists"}
      >
        {query ? <SearchResults query={query} /> : tab === "next" ? <UpNext /> : <Playlists />}
      </section>
    </>
  );
}
