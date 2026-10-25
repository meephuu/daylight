use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sql::{Migration, MigrationKind};

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
    ]
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
