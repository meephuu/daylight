use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{Menu, MenuItem},
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
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quick_add, &open, &quit])?;

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

/// What Spotify is playing on this PC (None when it is closed or idle). Runs off the main thread:
/// the Windows media calls wait on async operations.
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

    tauri::Builder::default()
        // Must be registered first. A second launch just surfaces the running window instead of
        // starting another copy against the same database.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
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
            open_spotify
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(context)
        .expect("error while running tauri application");
}
