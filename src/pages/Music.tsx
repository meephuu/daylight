import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListeningStats } from "@/components/music/ListeningStats";
import { PlayerControls } from "@/components/music/PlayerControls";
import { RecordStyleMenu } from "@/components/music/RecordStyleMenu";
import { SpotifyLibrary } from "@/components/music/SpotifyLibrary";
import { Turntable } from "@/components/music/Turntable";
import { Switch } from "@/components/ui/switch";
import { livePosition, media, useNowPlaying, useNowPlayingStore } from "@/lib/nowPlaying";
import { disconnectSpotify, useSpotify } from "@/lib/spotify";

/**
 * Music: the song Spotify is playing on this PC, on a turntable (the record turns and the arm drifts
 * in through the song), with the controls under it; on the right, how much you have listened and
 * Spotify itself (search, the queue, playlists).
 */
export default function MusicPage() {
  const { track, receivedAt, last } = useNowPlaying();
  const coverColor = useNowPlayingStore((state) => state.coverColor);
  const skyTint = useNowPlayingStore((state) => state.skyTint);
  const setSkyTint = useNowPlayingStore((state) => state.setSkyTint);
  const connected = useSpotify((state) => state.auth !== null);

  // Move the arm and the progress between polls while playing.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!track?.playing) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [track?.playing]);

  const position = livePosition(track, receivedAt);
  const progress = track?.durationMs && position !== null ? position / track.durationMs : 0;
  const shown = track ?? last;

  const playing = !!track?.playing;

  // The needle put down by hand: on the record plays from that point; back on its rest pauses.
  const onNeedle = (point: number | null) => {
    if (!track) return;
    if (point === null) {
      if (track.playing) void media.control("toggle");
      return;
    }
    const seek = track.durationMs && track.canSeek ? media.seek(point * track.durationMs) : Promise.resolve();
    void seek.then(() => {
      if (!useNowPlayingStore.getState().track?.playing) void media.control("toggle");
    });
  };

  return (
    // lg:-mb-6 takes back part of the shell's bottom padding, so both columns end 12px above the window's
    // edge, level with the sidebar, and the page fills the window without scrolling.
    <div className="grid gap-x-4 gap-y-6 lg:-mb-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,5fr)]">
      {/* The turntable column: the record and its sleeve, level with the title on the right. */}
      <div className="flex flex-col lg:sticky lg:top-11 lg:h-[calc(100vh-56px)] lg:self-start">
        <div>
          <Turntable
            title={shown?.title ?? null}
            artist={shown?.artist ?? null}
            album={shown?.album ?? null}
            art={shown?.art ?? null}
            color={track ? coverColor : null}
            playing={playing}
            progress={track ? progress : 0}
            durationMs={track?.durationMs ?? null}
            onNeedle={track ? onNeedle : undefined}
            accessory={<RecordStyleMenu />}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:min-h-[calc(100vh-56px)]">
        <PageHeader
          title="Spotify"
          className="pb-3"
          actions={
            <>
              <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-full px-3 text-[13px] text-foreground/85">
                <Switch checked={skyTint} onCheckedChange={setSkyTint} aria-label="Album colour in the sky" />
                Album colour in the sky
              </label>
              {connected && (
                <button
                  type="button"
                  onClick={disconnectSpotify}
                  className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  title="Sign out of Spotify in Daylight"
                >
                  <LogOut className="size-3.5" />
                  Disconnect
                </button>
              )}
            </>
          }
        />
        <ListeningStats
          beside={
            <PlayerControls
              track={track}
              position={position}
              color={coverColor}
              art={shown?.art ?? null}
              className="justify-between"
            />
          }
        />
        <div className="flex min-h-[460px] flex-1 flex-col gap-3 lg:h-0">
          <SpotifyLibrary />
        </div>
      </div>
    </div>
  );
}
