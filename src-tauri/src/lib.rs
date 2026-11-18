use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sql::{Migration, MigrationKind};

mod media;

// Database file name, stored in the app's config directory (see Settings page later).
const DB_URL: &str = "sqlite:my-dashboard.db";

// Argument the autostart entry launches us with, so boot-time starts stay in the tray.
const MINIMIZED_ARG: &str = "--minimized";

// Migrations are append-only: never edit an existing entry, add a new one with the next version.
// `include_str!` embeds the .sql file into the compiled binary at build time.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "notes_board_and_settings",
            sql: include_str!("../migrations/002_notes_board_and_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "training",
            sql: include_str!("../migrations/003_training.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "calendar_items",
            sql: include_str!("../migrations/004_calendar_items.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "bigger_postits",
            sql: include_str!("../migrations/005_bigger_postits.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "sunday_weeks",
            sql: include_str!("../migrations/006_sunday_weeks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "expense_categories",
            sql: include_str!("../migrations/007_expense_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "recurring expenses and pending status",
            sql: include_str!("../migrations/008_recurring_expenses.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "weekly reflections",
            sql: include_str!("../migrations/009_weekly_reflections.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "habit order",
            sql: include_str!("../migrations/010_habit_order.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "note images",
            sql: include_str!("../migrations/011_note_images.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "workout history",
            sql: include_str!("../migrations/012_workout_history.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "music history",
            sql: include_str!("../migrations/013_music_history.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "focus sessions",
            sql: include_str!("../migrations/014_focus_sessions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "focus session notes",
            sql: include_str!("../migrations/015_focus_session_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "focus sessions rebuild",
            sql: include_str!("../migrations/016_focus_sessions_rebuild.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Current UTC date and time as "YYYYMMDD-HHMMSS", for backup folder names (no date crate needed).
fn utc_stamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    // Days since 1970-01-01 -> calendar date (Howard Hinnant's civil-from-days algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    format!(
        "{year:04}{month:02}{day:02}-{:02}{:02}{:02}",
        rem / 3_600,
        rem % 3_600 / 60,
        rem % 60
    )
}

/// Copies the database (and its WAL files) into `backups/<label>-<time>/`, once, before a risky migration runs.
/// A marker file keeps it from repeating on every launch. Nothing happens on a brand-new install (no database yet).
fn backup_database_once(identifier: &str, label: &str) {
    let Some(appdata) = std::env::var_os("APPDATA") else {
        return;
    };
    let data_dir = PathBuf::from(appdata).join(identifier);
    let db = data_dir.join("my-dashboard.db");
    let backups = data_dir.join("backups");
    let marker = backups.join(format!(".backed-up-{label}"));
    if !db.exists() || marker.exists() {
        return;
    }
    let dest = backups.join(format!("{label}-{}", utc_stamp()));
    if fs::create_dir_all(&dest).is_err() {
        return;
    }
    for name in ["my-dashboard.db", "my-dashboard.db-wal", "my-dashboard.db-shm"] {
        let from = data_dir.join(name);
        if from.exists() {
            let _ = fs::copy(&from, dest.join(name));
        }
    }
    let _ = fs::write(&marker, b"");
}

/// Bring the (possibly hidden or minimized) main window to the front.
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Tray icon with a small menu. Left-clicking the icon opens the dashboard.
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let quick_add = MenuItem::with_id(app, "quick-add", "Quick add task", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open dashboard", true, None::<&str>)?;
    let focus_toggle = MenuItem::with_id(app, "focus-toggle", "Start focus", true, None::<&str>)?;
    let focus_skip = MenuItem::with_id(app, "focus-skip", "Skip to next", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[&quick_add, &open, &separator, &focus_toggle, &focus_skip, &separator2, &quit],
    )?;
    // Kept so the Focus page can relabel it ("Pause focus" while the timer runs).
    app.manage(FocusTrayItem(focus_toggle.clone()));

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Daylight")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quick-add" => {
                show_main_window(app);
                // The frontend listens for this event and focuses the quick-add input.
                let _ = app.emit("quick-add-task", ());
            }
            "open" => show_main_window(app),
            // The Focus timer lives in the window (FocusService); these just pass the press on.
            "focus-toggle" => {
                let _ = app.emit("focus-toggle", ());
            }
            "focus-skip" => {
                let _ = app.emit("focus-skip", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// The tray menu's "Start focus" / "Pause focus" item.
struct FocusTrayItem(MenuItem<tauri::Wry>);

/// Bumped by every focus_schedule call, so only the latest scheduled alarm fires.
static FOCUS_ALARM: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Updates the tray for the Focus timer: the icon's tooltip (e.g. "Focus · 18 min left") and the
/// start/pause item's label.
#[tauri::command]
fn focus_tray(app: AppHandle, tooltip: String, running: bool) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
    if let Some(item) = app.try_state::<FocusTrayItem>() {
        let _ = item.0.set_text(if running { "Pause focus" } else { "Start focus" });
    }
}

/// Sets the Focus timer's alarm: at `at_ms` (Unix time, ms) a Windows notification shows and the window
/// gets a "focus-ended" event. The window's own timers slow down while it is hidden in the tray, so the
/// alarm is kept here. Any later call (with at_ms = 0 to only cancel) replaces it.
#[tauri::command]
fn focus_schedule(app: AppHandle, at_ms: u64, title: String, body: String) {
    use std::sync::atomic::Ordering;
    let generation = FOCUS_ALARM.fetch_add(1, Ordering::SeqCst) + 1;
    if at_ms == 0 {
        return;
    }
    std::thread::spawn(move || {
        loop {
            if FOCUS_ALARM.load(Ordering::SeqCst) != generation {
                return;
            }
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            if now >= at_ms {
                break;
            }
            // Short sleeps, so a cancelled alarm's thread ends soon.
            std::thread::sleep(std::time::Duration::from_millis((at_ms - now).min(500)));
        }
        use tauri_plugin_notification::NotificationExt;
        let _ = app.notification().builder().title(title).body(body).show();
        let _ = app.emit("focus-ended", ());
    });
}

const MINI_LABEL: &str = "mini";
const MINI_WIDTH: f64 = 264.0;
const MINI_HEIGHT: f64 = 92.0;
const PLAYER_LABEL: &str = "player";
const PLAYER_WIDTH: f64 = 380.0;
const PLAYER_HEIGHT: f64 = 92.0;
/// Room between the screen's edge and the floating windows, and between the two.
const FLOAT_MARGIN: f64 = 24.0;
const FLOAT_GAP: f64 = 10.0;

/// Opens (or closes) one of the floating windows: small, frameless and see-through, always on top of
/// other apps, in the top-right corner of the screen the main window is on, `top` below the margin.
/// Must be called from an async command: building a window from a synchronous command deadlocks the app
/// on Windows (the command would hold the main thread that the new window needs).
fn open_floating(app: &AppHandle, label: &str, route: &str, title: &str, width: f64, height: f64, top: f64, open: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(label) {
        if open {
            let _ = window.show();
            let _ = window.set_focus();
        } else {
            let _ = window.close();
        }
        return Ok(());
    }
    if !open {
        return Ok(());
    }
    let mut builder = tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(route.into()))
        .title(title)
        .inner_size(width, height)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false);
    let monitor = app
        .get_webview_window("main")
        .and_then(|main| main.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        let origin = monitor.position().to_logical::<f64>(scale);
        let size = monitor.size().to_logical::<f64>(scale);
        builder = builder.position(origin.x + size.width - width - FLOAT_MARGIN, origin.y + FLOAT_MARGIN + top);
    }
    builder.build().map_err(|error| error.to_string())?;
    Ok(())
}

/// Opens (or closes) the mini timer, showing the Focus timer (the /mini route).
#[tauri::command]
async fn focus_mini(app: AppHandle, open: bool) -> Result<(), String> {
    open_floating(&app, MINI_LABEL, "mini", "Daylight focus", MINI_WIDTH, MINI_HEIGHT, 0.0, open)
}

/// Opens (or closes) the mini player, showing what Spotify plays (the /mini-player route). It sits under
/// the mini timer's spot, so the two never cover each other.
#[tauri::command]
async fn music_mini(app: AppHandle, open: bool) -> Result<(), String> {
    open_floating(&app, PLAYER_LABEL, "mini-player", "Daylight music", PLAYER_WIDTH, PLAYER_HEIGHT, MINI_HEIGHT + FLOAT_GAP, open)
}

/// Brings the main window up (from the mini timer).
#[tauri::command]
fn show_main(app: AppHandle) {
    show_main_window(&app);
}

/// What Spotify is playing on this PC (None when it is closed or idle). Runs off the main thread:
/// the Windows media calls wait on async operations.
/// Whether the sound pulse is running; turned off by `audio_pulse(false)` (or when the window closes).
static PULSE_RUNNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Starts or stops the sound pulse: while on, Spotify's level (0..1) is sent to the window as
/// "spotify-peak" events about 30 times a second, read from its meter in the Windows volume mixer.
#[tauri::command]
fn audio_pulse(app: tauri::AppHandle, on: bool) {
    use std::sync::atomic::Ordering;
    use tauri::Emitter;
    if !on {
        PULSE_RUNNING.store(false, Ordering::Relaxed);
        return;
    }
    // Already running: nothing to start.
    if PULSE_RUNNING.swap(true, Ordering::Relaxed) {
        return;
    }
    std::thread::spawn(move || {
        media::pulse_loop(&PULSE_RUNNING, |peak| {
            let _ = app.emit("spotify-peak", peak);
        });
    });
}

#[tauri::command]
async fn now_playing(include_art: bool) -> Result<Option<media::NowPlaying>, String> {
    tauri::async_runtime::spawn_blocking(move || media::now_playing(include_art))
        .await
        .map_err(|error| error.to_string())?
}

/// Play/pause ("toggle"), "next", "previous", "seek", "shuffle" or "repeat" on Spotify (see media::control).
/// Returns whether Spotify accepted it.
#[tauri::command]
async fn media_control(action: String, value: Option<f64>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || media::control(&action, value.unwrap_or(0.0)))
        .await
        .map_err(|error| error.to_string())?
}

/// Spotify's own volume in the Windows mixer (0..1), None when it has no audio session.
#[tauri::command]
async fn spotify_volume() -> Result<Option<f32>, String> {
    tauri::async_runtime::spawn_blocking(media::volume)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn set_spotify_volume(level: f32) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || media::set_volume(level))
        .await
        .map_err(|error| error.to_string())?
}

/// Spotify sign-in: waits for the browser's redirect to 127.0.0.1:<port>/callback and returns its query.
#[tauri::command]
async fn spotify_auth_wait(port: u16) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || media::wait_for_auth_redirect(port))
        .await
        .map_err(|error| error.to_string())?
}

/// This PC's name. Spotify's desktop app appears in the Web API's device list under it, which is how
/// Daylight tells this PC's Spotify from a phone or another computer.
#[tauri::command]
fn computer_name() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_default()
}

/// Opens the Spotify desktop app (or brings it forward if it is already running).
#[tauri::command]
fn open_spotify() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: no console window flashes up while `start` hands the link to Spotify.
        std::process::Command::new("cmd")
            .args(["/C", "start", "", "spotify:"])
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    // Before the new expense migrations can touch the data, keep a copy of the database (once).
    backup_database_once(&context.config().identifier, "before-expenses-v2");
    backup_database_once(&context.config().identifier, "before-recurring-expenses");
    backup_database_once(&context.config().identifier, "before-weekly-reflections");
    backup_database_once(&context.config().identifier, "before-habit-order");
    backup_database_once(&context.config().identifier, "before-note-images");
    backup_database_once(&context.config().identifier, "before-workout-history");
    backup_database_once(&context.config().identifier, "before-music-history");
    backup_database_once(&context.config().identifier, "before-focus-sessions");
    backup_database_once(&context.config().identifier, "before-focus-notes");
    backup_database_once(&context.config().identifier, "before-focus-rebuild");

    tauri::Builder::default()
        // Must be registered first. A second launch just surfaces the running window instead of
        // starting another copy against the same database.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .setup(|app| {
            setup_tray(app)?;
            // The window starts hidden (see tauri.conf.json); show it unless this is a boot-time
            // autostart, which should stay quietly in the tray.
            if !std::env::args().any(|arg| arg == MINIMIZED_ARG) {
                show_main_window(app.handle());
            }
            Ok(())
        })
        // Closing the window hides it to the tray; "Quit" in the tray menu really exits.
        .invoke_handler(tauri::generate_handler![
            now_playing,
            media_control,
            spotify_volume,
            set_spotify_volume,
            spotify_auth_wait,
            computer_name,
            open_spotify,
            audio_pulse,
            focus_tray,
            focus_schedule,
            focus_mini,
            music_mini,
            show_main
        ])
        .on_window_event(|window, event| {
            // Only the main window hides to the tray; the floating windows really close.
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(context)
        .expect("error while running tauri application");
}
