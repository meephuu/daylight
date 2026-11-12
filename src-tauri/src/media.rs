//! What Spotify is playing on this PC, read from Windows' media controls (the same system that drives
//! the volume flyout and the lock screen). No account, no network: Windows already knows the track the
//! Spotify desktop app is playing, its cover art and its position, and accepts play/pause/next/previous,
//! seeking, shuffle and repeat (when Spotify offers them). Spotify's own volume is its audio session in
//! the Windows mixer.

use serde::Serialize;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playing: bool,
    pub position_ms: Option<u64>,
    pub duration_ms: Option<u64>,
    /// The cover as a `data:` URL, only when asked for (it only changes with the track).
    pub art: Option<String>,
    /// None when Spotify does not report it.
    pub shuffle: Option<bool>,
    /// "off", "track" or "list"; None when Spotify does not report it.
    pub repeat: Option<String>,
    pub can_seek: bool,
    pub can_shuffle: bool,
    pub can_repeat: bool,
}

#[cfg(windows)]
mod imp {
    use super::NowPlaying;
    use base64::Engine;
    use windows::core::{Interface, PWSTR};
    use windows::Foundation::TimeSpan;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Media::MediaPlaybackAutoRepeatMode as Repeat;
    use windows::Storage::Streams::{DataReader, IRandomAccessStreamReference};
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator, ISimpleAudioVolume,
        MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

    /// Covers larger than this are skipped (Spotify's are ~30-60 KB).
    const MAX_ART_BYTES: u64 = 2_000_000;

    /// WinRT/COM needs the calling thread initialised; worker threads are not. Repeated calls are harmless.
    fn init() {
        unsafe {
            let _ = RoInitialize(RO_INIT_MULTITHREADED);
        }
    }

    /// The Spotify session among everything playing media (desktop or Microsoft Store build).
    fn spotify_session() -> windows::core::Result<Option<Session>> {
        let manager = Manager::RequestAsync()?.join()?;
        let sessions = manager.GetSessions()?;
        for index in 0..sessions.Size()? {
            let session = sessions.GetAt(index)?;
            if session.SourceAppUserModelId()?.to_string().to_lowercase().contains("spotify") {
                return Ok(Some(session));
            }
        }
        Ok(None)
    }

    fn read_art(reference: IRandomAccessStreamReference) -> windows::core::Result<Option<String>> {
        let stream = reference.OpenReadAsync()?.join()?;
        let size = stream.Size()?;
        if size == 0 || size > MAX_ART_BYTES {
            return Ok(None);
        }
        let content_type = stream.ContentType().map(|value| value.to_string()).unwrap_or_default();
        let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0)?)?;
        reader.LoadAsync(size as u32)?.join()?;
        let mut bytes = vec![0u8; size as usize];
        reader.ReadBytes(&mut bytes)?;
        let mime = if content_type.starts_with("image/") { content_type } else { "image/jpeg".to_string() };
        let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
        Ok(Some(format!("data:{mime};base64,{encoded}")))
    }

    fn millis(span: TimeSpan) -> u64 {
        // TimeSpan counts 100-nanosecond ticks.
        (span.Duration.max(0) / 10_000) as u64
    }

    fn repeat_name(mode: Repeat) -> &'static str {
        match mode {
            Repeat::Track => "track",
            Repeat::List => "list",
            _ => "off",
        }
    }

    pub fn now_playing(include_art: bool) -> Result<Option<NowPlaying>, String> {
        init();
        let read = || -> windows::core::Result<Option<NowPlaying>> {
            let Some(session) = spotify_session()? else { return Ok(None) };
            let props = session.TryGetMediaPropertiesAsync()?.join()?;
            let title = props.Title()?.to_string();
            // Spotify open but idle (nothing loaded yet).
            if title.is_empty() {
                return Ok(None);
            }
            let info = session.GetPlaybackInfo()?;
            let controls = info.Controls()?;
            let playing = info.PlaybackStatus()? == Status::Playing;
            let timeline = session.GetTimelineProperties()?;
            let start = millis(timeline.StartTime()?);
            let end = millis(timeline.EndTime()?);
            let duration = end.saturating_sub(start);
            let position = millis(timeline.Position()?).saturating_sub(start);
            let art = if include_art {
                props.Thumbnail().ok().and_then(|reference| read_art(reference).ok().flatten())
            } else {
                None
            };
            Ok(Some(NowPlaying {
                title,
                artist: props.Artist()?.to_string(),
                album: props.AlbumTitle()?.to_string(),
                playing,
                position_ms: (duration > 0).then_some(position.min(duration)),
                duration_ms: (duration > 0).then_some(duration),
                art,
                shuffle: info.IsShuffleActive().and_then(|value| value.Value()).ok(),
                repeat: info.AutoRepeatMode().and_then(|value| value.Value()).ok().map(|mode| repeat_name(mode).to_string()),
                can_seek: controls.IsPlaybackPositionEnabled().unwrap_or(false),
                can_shuffle: controls.IsShuffleEnabled().unwrap_or(false),
                can_repeat: controls.IsRepeatEnabled().unwrap_or(false),
            }))
        };
        read().map_err(|error| error.to_string())
    }

    /// "toggle", "next", "previous", "seek" (value = ms), "shuffle" (value = 0/1), "repeat" (value = 0 off, 1 track, 2 list).
    pub fn control(action: &str, value: f64) -> Result<bool, String> {
        init();
        let send = || -> windows::core::Result<bool> {
            let Some(session) = spotify_session()? else { return Ok(false) };
            match action {
                "toggle" => session.TryTogglePlayPauseAsync()?.join(),
                "next" => session.TrySkipNextAsync()?.join(),
                "previous" => session.TrySkipPreviousAsync()?.join(),
                "seek" => {
                    let start = session.GetTimelineProperties()?.StartTime()?.Duration;
                    session.TryChangePlaybackPositionAsync(start + (value.max(0.0) as i64) * 10_000)?.join()
                }
                "shuffle" => session.TryChangeShuffleActiveAsync(value > 0.5)?.join(),
                "repeat" => {
                    let mode = match value.round() as i32 {
                        1 => Repeat::Track,
                        2 => Repeat::List,
                        _ => Repeat::None,
                    };
                    session.TryChangeAutoRepeatModeAsync(mode)?.join()
                }
                _ => Ok(false),
            }
        };
        send().map_err(|error| error.to_string())
    }

    fn is_spotify_process(pid: u32) -> bool {
        unsafe {
            let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else { return false };
            let mut buffer = [0u16; 520];
            let mut size = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut size).is_ok();
            let _ = CloseHandle(handle);
            ok && String::from_utf16_lossy(&buffer[..size as usize]).to_lowercase().ends_with("\\spotify.exe")
        }
    }

    /// Spotify's audio sessions on the default speakers (it can have more than one).
    fn spotify_volumes() -> windows::core::Result<Vec<ISimpleAudioVolume>> {
        unsafe {
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
            let manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)?;
            let sessions = manager.GetSessionEnumerator()?;
            let mut found = Vec::new();
            for index in 0..sessions.GetCount()? {
                let control = sessions.GetSession(index)?;
                let Ok(control2) = control.cast::<IAudioSessionControl2>() else { continue };
                let Ok(pid) = control2.GetProcessId() else { continue };
                if is_spotify_process(pid) {
                    found.push(control.cast::<ISimpleAudioVolume>()?);
                }
            }
            Ok(found)
        }
    }

    /// Spotify's volume in the Windows mixer, 0..1 (None when it has no audio session yet).
    pub fn volume() -> Result<Option<f32>, String> {
        init();
        let read = || -> windows::core::Result<Option<f32>> {
            let volumes = spotify_volumes()?;
            match volumes.first() {
                Some(volume) => Ok(Some(unsafe { volume.GetMasterVolume()? })),
                None => Ok(None),
            }
        };
        read().map_err(|error| error.to_string())
    }

    pub fn set_volume(level: f32) -> Result<bool, String> {
        init();
        let write = || -> windows::core::Result<bool> {
            let volumes = spotify_volumes()?;
            for volume in &volumes {
                unsafe { volume.SetMasterVolume(level.clamp(0.0, 1.0), std::ptr::null())? };
            }
            Ok(!volumes.is_empty())
        };
        write().map_err(|error| error.to_string())
    }
}

#[cfg(windows)]
pub use imp::{control, now_playing, set_volume, volume};

/// Windows only: elsewhere there is simply nothing playing.
#[cfg(not(windows))]
pub fn now_playing(_include_art: bool) -> Result<Option<NowPlaying>, String> {
    Ok(None)
}

#[cfg(not(windows))]
pub fn control(_action: &str, _value: f64) -> Result<bool, String> {
    Ok(false)
}

#[cfg(not(windows))]
pub fn volume() -> Result<Option<f32>, String> {
    Ok(None)
}

#[cfg(not(windows))]
pub fn set_volume(_level: f32) -> Result<bool, String> {
    Ok(false)
}

/// Spotify sign-in: waits (up to five minutes) for the browser to come back to
/// `http://127.0.0.1:<port>/callback?...` and returns the query string. One request, then it closes.
pub fn wait_for_auth_redirect(port: u16) -> Result<String, String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::time::{Duration, Instant};

    let listener = TcpListener::bind(("127.0.0.1", port)).map_err(|error| error.to_string())?;
    listener.set_nonblocking(true).map_err(|error| error.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(300);
    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_nonblocking(false);
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let mut buffer = [0u8; 8192];
                let read = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..read]).to_string();
                let path = request.split_whitespace().nth(1).unwrap_or("").to_string();
                if !path.starts_with("/callback") {
                    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                    continue;
                }
                let body = "<!doctype html><meta charset=utf-8><title>Daylight</title>\
                    <body style=\"font:16px system-ui;background:#0d1430;color:#f1f4ff;display:grid;place-items:center;height:100vh;margin:0\">\
                    <p>Spotify is connected. You can close this tab and go back to Daylight.</p>";
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(response.as_bytes());
                return Ok(path.split_once('?').map(|(_, query)| query.to_string()).unwrap_or_default());
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("Timed out waiting for Spotify sign-in".into());
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(error) => return Err(error.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    /// Reads the real media controls; run by hand with Spotify open:
    /// `cargo test --lib media -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn prints_what_spotify_is_playing() {
        match super::now_playing(true) {
            Ok(Some(track)) => println!(
                "title={:?} artist={:?} playing={} position={:?} duration={:?} art_bytes={} shuffle={:?} repeat={:?} can_seek={} can_shuffle={} can_repeat={} volume={:?}",
                track.title,
                track.artist,
                track.playing,
                track.position_ms,
                track.duration_ms,
                track.art.as_ref().map_or(0, |art| art.len()),
                track.shuffle,
                track.repeat,
                track.can_seek,
                track.can_shuffle,
                track.can_repeat,
                super::volume()
            ),
            Ok(None) => println!("Spotify is not playing anything (or not running)"),
            Err(error) => panic!("media controls failed: {error}"),
        }
    }
}
