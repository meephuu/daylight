//! Quick Access on the App page: the apps on this PC (the same list as Start's "All apps"), their icons,
//! website icons, the browsers that are installed, and opening any of them.
//!
//! Apps come from the shell's AppsFolder, so desktop programs and Store apps (Settings, Spotify from the
//! Store, ...) are listed, opened and drawn the same way: `shell:AppsFolder\<id>`. A shortcut can also
//! point at any .exe or .lnk picked with Browse. Website icons are fetched straight from the site (no
//! third-party icon service) and kept in the database by the caller, so they work offline afterwards.

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    /// What to open: `shell:AppsFolder\<id>`.
    pub target: String,
}

/// Browsers a website shortcut can name, as (id, exe name in Windows' App Paths).
const BROWSERS: [(&str, &str); 4] = [
    ("chrome", "chrome.exe"),
    ("edge", "msedge.exe"),
    ("firefox", "firefox.exe"),
    ("brave", "brave.exe"),
];

#[cfg(windows)]
mod imp {
    use super::{InstalledApp, BROWSERS};
    use base64::Engine;
    use std::sync::{mpsc, OnceLock};
    use std::time::Duration;
    use windows::core::{w, HSTRING, PCWSTR};
    use windows::Foundation::Uri;
    use windows::Storage::Streams::DataReader;
    use windows::Web::Http::HttpClient;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::System::Com::{CoInitializeEx, CoTaskMemFree, IBindCtx, COINIT};
    use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE};
    use windows::Win32::System::Registry::{RegGetValueW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ};
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
    use windows::Win32::UI::Shell::{
        IEnumShellItems, IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SHGetKnownFolderItem,
        ShellExecuteW, BHID_EnumItems, FOLDERID_AppsFolder, KF_FLAG_DEFAULT, SIGDN, SIGDN_NORMALDISPLAY,
        SIGDN_PARENTRELATIVEPARSING, SIIGBF_ICONONLY,
    };
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    const APPS_FOLDER: &str = "shell:AppsFolder\\";
    /// Website icons and chosen images larger than this are refused (a favicon is a few KB).
    const MAX_IMAGE_BYTES: usize = 2_000_000;
    /// Pages are only read for their <link rel="icon"> tags, which sit in the <head>.
    const MAX_PAGE_BYTES: usize = 3_000_000;
    const FETCH_TIMEOUT: Duration = Duration::from_secs(10);
    const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

    type Job = Box<dyn FnOnce() + Send>;
    static SHELL: OnceLock<mpsc::Sender<Job>> = OnceLock::new();

    /// Runs `f` on one long-lived thread set up the way the Windows shell wants (single-threaded COM).
    /// Tokio's blocking threads are shared with the media code, which uses multi-threaded COM.
    fn on_shell_thread<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
        let sender = SHELL.get_or_init(|| {
            let (tx, rx) = mpsc::channel::<Job>();
            let _ = std::thread::Builder::new().name("daylight-shell".into()).spawn(move || {
                unsafe {
                    let _ = CoInitializeEx(None, COINIT(COINIT_APARTMENTTHREADED.0 | COINIT_DISABLE_OLE1DDE.0));
                }
                for job in rx {
                    job();
                }
            });
            tx
        });
        let (done_tx, done_rx) = mpsc::channel();
        sender
            .send(Box::new(move || {
                let _ = done_tx.send(f());
            }))
            .map_err(|_| "The shell helper stopped.".to_string())?;
        done_rx.recv().map_err(|_| "The shell helper stopped.".to_string())
    }

    fn display_name(item: &IShellItem, kind: SIGDN) -> Option<String> {
        unsafe {
            let raw = item.GetDisplayName(kind).ok()?;
            let text = raw.to_string().ok();
            CoTaskMemFree(Some(raw.0 as *const _));
            text
        }
    }

    /// Entries in "All apps" that are not apps: uninstallers, help files and web links.
    fn is_noise(name: &str, id: &str) -> bool {
        let name = name.to_lowercase();
        let id = id.to_lowercase();
        name.contains("uninstall")
            || id.starts_with("http:")
            || id.starts_with("https:")
            || [".chm", ".txt", ".pdf", ".htm", ".html", ".url", ".rtf"].iter().any(|ext| id.ends_with(ext))
    }

    fn list_apps() -> windows::core::Result<Vec<InstalledApp>> {
        unsafe {
            let folder: IShellItem = SHGetKnownFolderItem(&FOLDERID_AppsFolder, KF_FLAG_DEFAULT, None)?;
            let items: IEnumShellItems = folder.BindToHandler(None::<&IBindCtx>, &BHID_EnumItems)?;
            let mut apps: Vec<InstalledApp> = Vec::new();
            loop {
                let mut batch: [Option<IShellItem>; 1] = [None];
                let mut fetched = 0u32;
                if items.Next(&mut batch, Some(&mut fetched)).is_err() || fetched == 0 {
                    break;
                }
                let Some(item) = batch[0].take() else { break };
                let (Some(name), Some(id)) = (display_name(&item, SIGDN_NORMALDISPLAY), display_name(&item, SIGDN_PARENTRELATIVEPARSING)) else {
                    continue;
                };
                if name.trim().is_empty() || is_noise(&name, &id) {
                    continue;
                }
                apps.push(InstalledApp { name, target: format!("{APPS_FOLDER}{id}") });
            }
            apps.sort_by_key(|app| app.name.to_lowercase());
            apps.dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name) && a.target.eq_ignore_ascii_case(&b.target));
            Ok(apps)
        }
    }

    pub fn installed_apps() -> Result<Vec<InstalledApp>, String> {
        on_shell_thread(|| list_apps().map_err(|error| error.message().to_string()))?
    }

    /// The icon of an AppsFolder entry or a file (.exe, .lnk, ...), trimmed to its drawn edges, squared,
    /// as a PNG `data:` URL. None when Windows has no icon for it.
    pub fn app_icon(target: String, size: i32) -> Option<String> {
        on_shell_thread(move || unsafe { shell_icon(&target, size.clamp(16, 256)) }).ok().flatten()
    }

    unsafe fn shell_icon(target: &str, size: i32) -> Option<String> {
        unsafe {
            let factory: IShellItemImageFactory = SHCreateItemFromParsingName(&HSTRING::from(target), None::<&IBindCtx>).ok()?;
            let bitmap = factory.GetImage(SIZE { cx: size, cy: size }, SIIGBF_ICONONLY).ok()?;
            let object = HGDIOBJ(bitmap.0);
            let pixels = read_bitmap(object);
            let _ = DeleteObject(object);
            let (width, height, mut bgra) = pixels?;
            to_png_data_url(width, height, &mut bgra)
        }
    }

    /// The bitmap's pixels as top-down 32-bit BGRA.
    unsafe fn read_bitmap(object: HGDIOBJ) -> Option<(u32, u32, Vec<u8>)> {
        unsafe {
            let mut info = BITMAP::default();
            if GetObjectW(object, size_of::<BITMAP>() as i32, Some(&mut info as *mut _ as *mut _)) == 0 {
                return None;
            }
            let (width, height) = (info.bmWidth, info.bmHeight.abs());
            if width <= 0 || height <= 0 {
                return None;
            }
            let mut header = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width,
                    biHeight: -height,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut buffer = vec![0u8; (width * height * 4) as usize];
            let dc = CreateCompatibleDC(None);
            let lines = GetDIBits(dc, windows::Win32::Graphics::Gdi::HBITMAP(object.0), 0, height as u32, Some(buffer.as_mut_ptr() as *mut _), &mut header, DIB_RGB_COLORS);
            let _ = DeleteDC(dc);
            (lines == height).then_some((width as u32, height as u32, buffer))
        }
    }

    /// BGRA (premultiplied, as the shell hands it over) -> a PNG `data:` URL, cropped to the drawn pixels and
    /// centred on a square canvas, so every icon fills its tile the same way however much padding it shipped with.
    fn to_png_data_url(width: u32, height: u32, bgra: &mut [u8]) -> Option<String> {
        let has_alpha = bgra.chunks_exact(4).any(|px| px[3] != 0);
        let mut rgba = Vec::with_capacity(bgra.len());
        for px in bgra.chunks_exact(4) {
            let (b, g, r) = (px[0] as u32, px[1] as u32, px[2] as u32);
            let a = if has_alpha { px[3] as u32 } else { 255 };
            let un = |c: u32| if a == 0 { 0 } else if a == 255 { c } else { (c * 255 / a).min(255) };
            rgba.extend_from_slice(&[un(r) as u8, un(g) as u8, un(b) as u8, a as u8]);
        }
        // The box around everything that is not (nearly) transparent.
        let (mut left, mut top, mut right, mut bottom) = (width, height, 0u32, 0u32);
        for y in 0..height {
            for x in 0..width {
                if rgba[((y * width + x) * 4 + 3) as usize] > 8 {
                    left = left.min(x);
                    top = top.min(y);
                    right = right.max(x);
                    bottom = bottom.max(y);
                }
            }
        }
        if right < left || bottom < top {
            return None;
        }
        let (w, h) = (right - left + 1, bottom - top + 1);
        let side = w.max(h);
        let (ox, oy) = ((side - w) / 2, (side - h) / 2);
        let mut square = vec![0u8; (side * side * 4) as usize];
        for y in 0..h {
            let from = (((top + y) * width + left) * 4) as usize;
            let to = (((oy + y) * side + ox) * 4) as usize;
            square[to..to + (w * 4) as usize].copy_from_slice(&rgba[from..from + (w * 4) as usize]);
        }
        let mut png_bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut png_bytes, side, side);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().ok()?;
            writer.write_image_data(&square).ok()?;
        }
        Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png_bytes)))
    }

    /// The full path of an installed browser, from Windows' App Paths (machine-wide, then per user).
    fn browser_path(exe: &str) -> Option<String> {
        let key = HSTRING::from(format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{exe}"));
        [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER].into_iter().find_map(|root: HKEY| unsafe {
            let mut buffer = [0u16; 1024];
            let mut bytes = (buffer.len() * 2) as u32;
            let status = RegGetValueW(root, &key, PCWSTR::null(), RRF_RT_REG_SZ, None, Some(buffer.as_mut_ptr() as *mut _), Some(&mut bytes));
            if status.is_err() {
                return None;
            }
            let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
            let path = String::from_utf16_lossy(&buffer[..len]).trim_matches('"').to_string();
            std::path::Path::new(&path).exists().then_some(path)
        })
    }

    pub fn installed_browsers() -> Vec<String> {
        BROWSERS.iter().filter(|(_, exe)| browser_path(exe).is_some()).map(|(id, _)| id.to_string()).collect()
    }

    fn shell_execute(file: &str, parameters: Option<&str>, directory: Option<&str>) -> Result<(), String> {
        let file = HSTRING::from(file);
        let parameters = parameters.map(HSTRING::from);
        let directory = directory.map(HSTRING::from);
        let code = unsafe {
            ShellExecuteW(
                None,
                w!("open"),
                &file,
                parameters.as_ref().map_or(PCWSTR::null(), |p| PCWSTR(p.as_ptr())),
                directory.as_ref().map_or(PCWSTR::null(), |d| PCWSTR(d.as_ptr())),
                SW_SHOWNORMAL,
            )
        }
        .0 as isize;
        match code {
            c if c > 32 => Ok(()),
            2 | 3 => Err("Windows couldn't find it. It may have been moved or uninstalled.".into()),
            5 => Err("Windows didn't allow it to open.".into()),
            8 => Err("There isn't enough memory to open it.".into()),
            26 | 32 => Err("It is busy. Try again in a moment.".into()),
            27 | 31 => Err("No app is set up to open it.".into()),
            c => Err(format!("Windows couldn't open it (error {c}).")),
        }
    }

    /// Opens a shortcut: an app target, or a website in the named browser ("default" = Windows' default).
    pub fn open(kind: String, target: String, browser: String) -> Result<(), String> {
        on_shell_thread(move || {
            if kind == "website" {
                let lower = target.to_lowercase();
                if !(lower.starts_with("http://") || lower.starts_with("https://")) {
                    return Err("Only http and https addresses can be opened.".to_string());
                }
                if browser == "default" {
                    return shell_execute(&target, None, None);
                }
                let (_, exe) = BROWSERS.iter().find(|(id, _)| *id == browser).ok_or("Unknown browser.")?;
                let path = browser_path(exe).ok_or("That browser isn't installed on this PC.")?;
                return shell_execute(&path, Some(&format!("\"{target}\"")), None);
            }
            // A program picked with Browse starts in its own folder, as it would from Explorer.
            let path = std::path::Path::new(&target);
            let directory = (target.to_lowercase().ends_with(".exe") && path.is_absolute())
                .then(|| path.parent().map(|parent| parent.to_string_lossy().to_string()))
                .flatten();
            shell_execute(&target, None, directory.as_deref())
        })?
    }

    /// What kind of image `bytes` holds, by its first bytes.
    fn sniff(bytes: &[u8]) -> Option<&'static str> {
        if bytes.starts_with(b"\x89PNG") {
            Some("image/png")
        } else if bytes.starts_with(&[0, 0, 1, 0]) {
            Some("image/x-icon")
        } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
            Some("image/jpeg")
        } else if bytes.starts_with(b"GIF8") {
            Some("image/gif")
        } else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
            Some("image/webp")
        } else {
            let head = String::from_utf8_lossy(&bytes[..bytes.len().min(1024)]).to_lowercase();
            head.contains("<svg").then_some("image/svg+xml")
        }
    }

    fn data_url(bytes: &[u8]) -> Option<String> {
        if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
            return None;
        }
        let mime = sniff(bytes)?;
        Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
    }

    /// A chosen image file (or the icon of a chosen .exe / .lnk) as a `data:` URL, for a shortcut's icon.
    pub fn read_image(path: String) -> Result<String, String> {
        let lower = path.to_lowercase();
        if lower.ends_with(".exe") || lower.ends_with(".lnk") {
            return app_icon(path, 128).ok_or_else(|| "That file has no icon.".to_string());
        }
        let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
        if bytes.len() > MAX_IMAGE_BYTES {
            return Err("That image is over 2 MB. Pick a smaller one.".into());
        }
        data_url(&bytes).ok_or_else(|| "That file isn't an image Daylight can show.".to_string())
    }

    /// GETs `uri` and returns the body with the address it finally came from (after redirects).
    fn fetch(client: &HttpClient, uri: &Uri, limit: usize) -> windows::core::Result<Option<(Vec<u8>, Uri)>> {
        let response = client.GetAsync(uri)?.join()?;
        if !response.IsSuccessStatusCode()? {
            return Ok(None);
        }
        let final_uri = response.RequestMessage().and_then(|request| request.RequestUri()).unwrap_or_else(|_| uri.clone());
        let buffer = response.Content()?.ReadAsBufferAsync()?.join()?;
        let length = buffer.Length()? as usize;
        if length == 0 || length > limit {
            return Ok(None);
        }
        let reader = DataReader::FromBuffer(&buffer)?;
        let mut bytes = vec![0u8; length];
        reader.ReadBytes(&mut bytes)?;
        Ok(Some((bytes, final_uri)))
    }

    /// The value of `name="..."` (or '...' or bare) inside one tag, from the original text.
    fn attribute(tag: &str, lower: &str, name: &str) -> Option<String> {
        let mut from = 0;
        while let Some(found) = lower[from..].find(name) {
            let start = from + found;
            from = start + name.len();
            let before_ok = start == 0 || lower.as_bytes()[start - 1].is_ascii_whitespace();
            let rest = lower[from..].trim_start();
            if !before_ok || !rest.starts_with('=') {
                continue;
            }
            let offset = lower.len() - rest.len() + 1;
            let value = tag[offset..].trim_start();
            let value = match value.chars().next()? {
                quote @ ('"' | '\'') => value[1..].split(quote).next()?,
                _ => value.split(|c: char| c.is_whitespace() || c == '>').next()?,
            };
            return Some(value.replace("&amp;", "&"));
        }
        None
    }

    /// The page's icon links, best first: an SVG logo (sharp at any size, usually on transparent), then a
    /// large touch icon (the app lifts the logo off its white square), then the biggest plain favicon.
    fn icon_links(html: &str) -> Vec<String> {
        let lower = html.to_ascii_lowercase();
        let mut found: Vec<(u32, String)> = Vec::new();
        let mut from = 0;
        while let Some(index) = lower[from..].find("<link") {
            let start = from + index;
            let end = lower[start..].find('>').map_or(lower.len(), |e| start + e);
            from = end;
            let (tag, tag_lower) = (&html[start..end], &lower[start..end]);
            let Some(rel) = attribute(tag, tag_lower, "rel") else { continue };
            let rel = rel.to_lowercase();
            let Some(href) = attribute(tag, tag_lower, "href") else { continue };
            if href.is_empty() || href.starts_with("data:") || rel.contains("mask-icon") || !rel.contains("icon") {
                continue;
            }
            let size = attribute(tag, tag_lower, "sizes")
                .and_then(|sizes| sizes.split_whitespace().filter_map(|s| s.split('x').next()?.parse::<u32>().ok()).max());
            let svg = href.to_lowercase().split('?').next().unwrap_or("").ends_with(".svg");
            let score = if svg {
                2000
            } else if rel.contains("apple-touch-icon") {
                1000 + size.unwrap_or(180)
            } else {
                size.unwrap_or(32)
            };
            found.push((score, href));
        }
        found.sort_by(|a, b| b.0.cmp(&a.0));
        found.into_iter().map(|(_, href)| href).collect()
    }

    fn find_site_icon(url: &str) -> windows::core::Result<Option<String>> {
        let client = HttpClient::new()?;
        let _ = client.DefaultRequestHeaders()?.UserAgent()?.TryParseAdd(&HSTRING::from(USER_AGENT));
        let page_uri = Uri::CreateUri(&HSTRING::from(url))?;
        let mut candidates: Vec<Uri> = Vec::new();
        let mut base = page_uri.clone();
        if let Ok(Some((bytes, final_uri))) = fetch(&client, &page_uri, MAX_PAGE_BYTES) {
            base = final_uri;
            let html = String::from_utf8_lossy(&bytes);
            for href in icon_links(&html).into_iter().take(3) {
                if let Ok(uri) = base.CombineUri(&HSTRING::from(href)) {
                    candidates.push(uri);
                }
            }
        }
        for fallback in ["/favicon.ico", "/apple-touch-icon.png"] {
            if let Ok(uri) = base.CombineUri(&HSTRING::from(fallback)) {
                candidates.push(uri);
            }
        }
        for uri in candidates {
            if let Ok(Some((bytes, _))) = fetch(&client, &uri, MAX_IMAGE_BYTES) {
                if let Some(url) = data_url(&bytes) {
                    return Ok(Some(url));
                }
            }
        }
        Ok(None)
    }

    /// The website's own icon as a `data:` URL, fetched from the site itself. None when it has none, or
    /// the site cannot be reached within a few seconds.
    pub fn site_icon(url: String) -> Option<String> {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            unsafe {
                let _ = RoInitialize(RO_INIT_MULTITHREADED);
            }
            let _ = tx.send(find_site_icon(&url).ok().flatten());
        });
        rx.recv_timeout(FETCH_TIMEOUT).ok().flatten()
    }
}

#[cfg(windows)]
pub use imp::{app_icon, installed_apps, installed_browsers, open, read_image, site_icon};

#[cfg(not(windows))]
mod fallback {
    use super::InstalledApp;
    pub fn installed_apps() -> Result<Vec<InstalledApp>, String> {
        Ok(Vec::new())
    }
    pub fn app_icon(_target: String, _size: i32) -> Option<String> {
        None
    }
    pub fn site_icon(_url: String) -> Option<String> {
        None
    }
    pub fn installed_browsers() -> Vec<String> {
        Vec::new()
    }
    pub fn open(_kind: String, _target: String, _browser: String) -> Result<(), String> {
        Err("Opening apps is only supported on Windows.".into())
    }
    pub fn read_image(_path: String) -> Result<String, String> {
        Err("Only supported on Windows.".into())
    }
}

#[cfg(not(windows))]
pub use fallback::{app_icon, installed_apps, installed_browsers, open, read_image, site_icon};
