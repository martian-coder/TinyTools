//! Olus — a featherweight browser on the WebView2 (Chromium) engine.
//!
//! Reliability-first design: webview *creation* (`add_child`) only works during
//! `setup()` on this Tauri/WebView2 combo (from a command thread it deadlocks on
//! WebView2's async controller init). So Olus creates exactly four webviews at
//! startup and never creates any at runtime:
//!   1. "shell"    — our HTML/CSS/JS chrome (toolbar + tab strip), full window.
//!   2. "content"  — the single page viewport. "Tabs" are saved URLs we navigate
//!                   this viewport between (lighter than N engines, and rock solid).
//!   3. "sidebar"  — an AI assistant panel, parked offscreen until toggled.
//!   4. "devpanel" — the Dev Dock (Console / API / Terminal / Serve), bottom dock.

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

use serde::{Deserialize, Serialize};
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, Window, WindowEvent,
};

const TOOLBAR_H: f64 = 84.0;
const SIDEBAR_W: f64 = 400.0;
const DOCK_H: f64 = 320.0;
const HOME: &str = "olus://start";
const HOME_URL: &str = "http://tauri.localhost/start.html";
const CHROME_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SIDEBAR_DEFAULT: &str = "https://claude.ai";

struct ServerHandle {
    running: Arc<AtomicBool>,
}

#[derive(Default)]
struct Browser {
    tabs: Mutex<Vec<String>>,
    active: Mutex<usize>,
    sidebar_open: Mutex<bool>,
    dock_open: Mutex<bool>,
    cwd: Mutex<String>,
    server: Mutex<Option<ServerHandle>>,
}

#[derive(Clone, Serialize)]
struct TabsPayload {
    tabs: Vec<String>,
    active: usize,
    sidebar_open: bool,
    dock_open: bool,
}

#[derive(Serialize)]
struct CommandResult {
    stdout: String,
    stderr: String,
    code: i32,
    cwd: String,
}

// ---------------------------------------------------------------------------
// On-disk settings + session  (%APPDATA%\Olus\*.json)
// ---------------------------------------------------------------------------

fn config_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("Olus"))
}

fn parse_json<T: for<'de> Deserialize<'de>>(s: &str) -> Option<T> {
    serde_json::from_str(s.trim_start_matches('\u{feff}')).ok()
}

#[derive(Serialize, Deserialize, Default, Clone)]
struct Settings {
    #[serde(default)]
    region: String,
    #[serde(default)]
    proxy: String,
}

fn read_settings() -> Settings {
    config_dir()
        .map(|d| d.join("settings.json"))
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| parse_json(&s))
        .unwrap_or_default()
}

fn write_settings(s: &Settings) {
    if let Some(dir) = config_dir() {
        let _ = fs::create_dir_all(&dir);
        let _ = fs::write(
            dir.join("settings.json"),
            serde_json::to_string_pretty(s).unwrap(),
        );
    }
}

#[derive(Serialize, Deserialize, Default)]
struct Session {
    urls: Vec<String>,
    active: usize,
}

fn read_session() -> Session {
    config_dir()
        .map(|d| d.join("session.json"))
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| parse_json(&s))
        .unwrap_or_default()
}

fn save_session(app: &AppHandle) {
    let b = app.state::<Browser>();
    let urls = b.tabs.lock().unwrap().clone();
    let active = *b.active.lock().unwrap();
    if let Some(dir) = config_dir() {
        let _ = fs::create_dir_all(&dir);
        let _ = fs::write(
            dir.join("session.json"),
            serde_json::to_string(&Session { urls, active }).unwrap(),
        );
    }
}

fn default_cwd() -> String {
    std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::current_dir().ok().map(|p| p.display().to_string()))
        .unwrap_or_else(|| ".".to_string())
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

fn window_size(win: &Window) -> (f64, f64) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let s = win.inner_size().unwrap_or_default().to_logical::<f64>(scale);
    (s.width.max(1.0), s.height.max(1.0))
}

fn relayout(app: &AppHandle) {
    let Some(win) = app.get_window("main") else {
        return;
    };
    let (w, h) = window_size(&win);
    if w < 300.0 || h < 200.0 {
        return;
    }
    let (sidebar_open, dock_open) = {
        let b = app.state::<Browser>();
        (*b.sidebar_open.lock().unwrap(), *b.dock_open.lock().unwrap())
    };
    let body_h = (h - TOOLBAR_H).max(1.0);
    let dock_h = if dock_open { DOCK_H.min(body_h * 0.6) } else { 0.0 };
    let avail_h = (body_h - dock_h).max(1.0);
    let content_w = if sidebar_open { (w - SIDEBAR_W).max(1.0) } else { w };

    if let Some(shell) = app.get_webview("shell") {
        let _ = shell.set_position(LogicalPosition::new(0.0, 0.0));
        let _ = shell.set_size(LogicalSize::new(w, h));
    }
    if let Some(content) = app.get_webview("content") {
        let _ = content.set_size(LogicalSize::new(content_w, avail_h));
        let _ = content.set_position(LogicalPosition::new(0.0, TOOLBAR_H));
    }
    if let Some(sidebar) = app.get_webview("sidebar") {
        if sidebar_open {
            let _ = sidebar.set_size(LogicalSize::new(SIDEBAR_W, avail_h));
            let _ = sidebar.set_position(LogicalPosition::new((w - SIDEBAR_W).max(0.0), TOOLBAR_H));
        } else {
            let _ = sidebar.set_position(LogicalPosition::new(-100_000.0, 0.0));
        }
    }
    if let Some(dock) = app.get_webview("devpanel") {
        if dock_open {
            let _ = dock.set_size(LogicalSize::new(w, dock_h));
            let _ = dock.set_position(LogicalPosition::new(0.0, TOOLBAR_H + avail_h));
        } else {
            let _ = dock.set_position(LogicalPosition::new(-100_000.0, 0.0));
        }
    }
}

// ---------------------------------------------------------------------------
// URL handling
// ---------------------------------------------------------------------------

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn normalize_url(input: &str) -> String {
    let s = input.trim();
    if s.is_empty() || s == HOME {
        return HOME_URL.to_string();
    }
    if s.starts_with("http://") || s.starts_with("https://") || s.starts_with("about:") {
        return s.to_string();
    }
    let looks_like_host = s.contains('.') && !s.contains(' ');
    if looks_like_host {
        format!("https://{s}")
    } else {
        format!("https://www.google.com/search?q={}", percent_encode(s))
    }
}

fn resolve(url: &str) -> String {
    if url == HOME || url.is_empty() {
        HOME_URL.to_string()
    } else {
        url.to_string()
    }
}

fn eval_in(app: &AppHandle, label: &str, script: &str) {
    if let Some(wv) = app.get_webview(label) {
        let _ = wv.eval(script);
    }
}

fn nav_content(app: &AppHandle, url: &str) {
    let js = format!(
        "window.location.href = {};",
        serde_json::to_string(url).unwrap()
    );
    eval_in(app, "content", &js);
}

fn emit_tabs(app: &AppHandle) {
    let b = app.state::<Browser>();
    let tabs = b.tabs.lock().unwrap().clone();
    let active = *b.active.lock().unwrap();
    let sidebar_open = *b.sidebar_open.lock().unwrap();
    let dock_open = *b.dock_open.lock().unwrap();
    let payload = TabsPayload {
        tabs,
        active,
        sidebar_open,
        dock_open,
    };
    let _ = app.emit("tabs:update", payload);
    save_session(app);
}

// ---------------------------------------------------------------------------
// Tab / navigation commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn list_tabs(app: AppHandle) -> TabsPayload {
    let b = app.state::<Browser>();
    TabsPayload {
        tabs: b.tabs.lock().unwrap().clone(),
        active: *b.active.lock().unwrap(),
        sidebar_open: *b.sidebar_open.lock().unwrap(),
        dock_open: *b.dock_open.lock().unwrap(),
    }
}

#[tauri::command]
fn new_tab(app: AppHandle, url: Option<String>) {
    let target = url.unwrap_or_else(|| HOME.to_string());
    {
        let b = app.state::<Browser>();
        let mut tabs = b.tabs.lock().unwrap();
        tabs.push(target.clone());
        *b.active.lock().unwrap() = tabs.len() - 1;
    }
    nav_content(&app, &resolve(&target));
    emit_tabs(&app);
}

#[tauri::command]
fn switch_tab(app: AppHandle, index: usize) {
    let url = {
        let b = app.state::<Browser>();
        let tabs = b.tabs.lock().unwrap();
        if index >= tabs.len() {
            return;
        }
        *b.active.lock().unwrap() = index;
        tabs[index].clone()
    };
    nav_content(&app, &resolve(&url));
    emit_tabs(&app);
}

#[tauri::command]
fn close_tab(app: AppHandle, index: usize) {
    let to_show = {
        let b = app.state::<Browser>();
        let mut tabs = b.tabs.lock().unwrap();
        if index >= tabs.len() {
            return;
        }
        tabs.remove(index);
        if tabs.is_empty() {
            tabs.push(HOME.to_string());
        }
        let mut active = b.active.lock().unwrap();
        if *active >= tabs.len() {
            *active = tabs.len() - 1;
        } else if index < *active {
            *active -= 1;
        }
        tabs[*active].clone()
    };
    nav_content(&app, &resolve(&to_show));
    emit_tabs(&app);
}

#[tauri::command]
fn navigate(app: AppHandle, url: String) {
    let target = normalize_url(&url);
    {
        let b = app.state::<Browser>();
        let a = *b.active.lock().unwrap();
        let mut tabs = b.tabs.lock().unwrap();
        if a < tabs.len() {
            tabs[a] = target.clone();
        }
    }
    nav_content(&app, &target);
}

#[tauri::command]
fn go_home(app: AppHandle) {
    new_tab(app, None);
}

#[tauri::command]
fn go_back(app: AppHandle) {
    eval_in(&app, "content", "history.back();");
}

#[tauri::command]
fn go_forward(app: AppHandle) {
    eval_in(&app, "content", "history.forward();");
}

#[tauri::command]
fn reload(app: AppHandle) {
    eval_in(&app, "content", "location.reload();");
}

#[tauri::command]
fn toggle_sidebar(app: AppHandle) {
    {
        let b = app.state::<Browser>();
        let mut s = b.sidebar_open.lock().unwrap();
        *s = !*s;
    }
    relayout(&app);
    emit_tabs(&app);
}

#[tauri::command]
fn set_sidebar_url(app: AppHandle, url: String) {
    let target = normalize_url(&url);
    let js = format!(
        "window.location.href = {};",
        serde_json::to_string(&target).unwrap()
    );
    eval_in(&app, "sidebar", &js);
}

/// Push the chosen theme into the content viewport (so the local start page
/// updates live). Harmless on external sites.
#[tauri::command]
fn set_theme(app: AppHandle, theme: String) {
    let safe = if theme == "dark" { "dark" } else { "light" };
    eval_in(
        &app,
        "content",
        &format!("document.documentElement.setAttribute('data-theme','{safe}');"),
    );
}

#[tauri::command]
fn get_settings() -> Settings {
    read_settings()
}

#[tauri::command]
fn set_region(app: AppHandle, region: String, proxy: String) {
    write_settings(&Settings { region, proxy });
    app.restart();
}

// ---------------------------------------------------------------------------
// Tor — request a new circuit (new identity) via the control port
// ---------------------------------------------------------------------------

#[tauri::command]
fn tor_new_identity() -> Result<String, String> {
    let mut stream = TcpStream::connect("127.0.0.1:9051").map_err(|e| {
        format!("Can't reach the Tor control port (9051): {e}. Enable ControlPort 9051 in your torrc.")
    })?;
    stream.set_read_timeout(Some(Duration::from_secs(4))).ok();

    let read_reply = |s: &mut TcpStream| -> Result<String, String> {
        let mut buf = [0u8; 512];
        let n = s.read(&mut buf).map_err(|e| e.to_string())?;
        Ok(String::from_utf8_lossy(&buf[..n]).to_string())
    };

    stream
        .write_all(b"AUTHENTICATE \"\"\r\n")
        .map_err(|e| e.to_string())?;
    let auth = read_reply(&mut stream)?;
    if !auth.starts_with("250") {
        return Err(format!(
            "Tor auth failed: {}. (Olus needs a cookie-less control port.)",
            auth.trim()
        ));
    }

    stream
        .write_all(b"SIGNAL NEWNYM\r\n")
        .map_err(|e| e.to_string())?;
    let sig = read_reply(&mut stream)?;
    if sig.starts_with("250") {
        Ok("New Tor identity acquired — fresh circuit in use.".into())
    } else {
        Err(format!("NEWNYM rejected: {}", sig.trim()))
    }
}

// ---------------------------------------------------------------------------
// Dev Dock — console (native devtools), terminal, API client, local server
// ---------------------------------------------------------------------------

#[tauri::command]
fn toggle_dock(app: AppHandle) {
    {
        let b = app.state::<Browser>();
        let mut d = b.dock_open.lock().unwrap();
        *d = !*d;
    }
    relayout(&app);
    emit_tabs(&app);
}

#[tauri::command]
fn open_devtools(app: AppHandle) {
    if let Some(wv) = app.get_webview("content") {
        wv.open_devtools();
    }
}

#[tauri::command]
fn get_cwd(app: AppHandle) -> String {
    let b = app.state::<Browser>();
    let mut cwd = b.cwd.lock().unwrap();
    if cwd.is_empty() {
        *cwd = default_cwd();
    }
    cwd.clone()
}

#[tauri::command]
fn run_command(app: AppHandle, cmd: String) -> CommandResult {
    let b = app.state::<Browser>();
    let mut cwd = b.cwd.lock().unwrap();
    if cwd.is_empty() {
        *cwd = default_cwd();
    }
    let trimmed = cmd.trim().to_string();

    if trimmed == "cd" || trimmed.starts_with("cd ") {
        let target = trimmed[2..].trim();
        let newp = if target.is_empty() {
            PathBuf::from(default_cwd())
        } else {
            let p = Path::new(target);
            if p.is_absolute() {
                p.to_path_buf()
            } else {
                Path::new(&*cwd).join(p)
            }
        };
        return match fs::canonicalize(&newp) {
            Ok(c) if c.is_dir() => {
                let disp = c.display().to_string();
                *cwd = disp.trim_start_matches(r"\\?\").to_string();
                CommandResult {
                    stdout: String::new(),
                    stderr: String::new(),
                    code: 0,
                    cwd: cwd.clone(),
                }
            }
            _ => CommandResult {
                stdout: String::new(),
                stderr: format!("cd: no such directory: {target}"),
                code: 1,
                cwd: cwd.clone(),
            },
        };
    }

    let mut command = Command::new("cmd");
    command.arg("/C").arg(&trimmed).current_dir(&*cwd);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    match command.output() {
        Ok(o) => CommandResult {
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            code: o.status.code().unwrap_or(-1),
            cwd: cwd.clone(),
        },
        Err(e) => CommandResult {
            stdout: String::new(),
            stderr: format!("failed to run: {e}"),
            code: -1,
            cwd: cwd.clone(),
        },
    }
}

/// REST client backed by curl (ships with Windows 10+). `-i` includes the
/// status line and headers so the panel can show everything.
#[tauri::command]
fn http_request(method: String, url: String, headers: String, body: String) -> String {
    if url.trim().is_empty() {
        return "Enter a URL.".into();
    }
    let mut c = Command::new("curl");
    c.arg("-sS").arg("-i").arg("-X").arg(&method);
    for line in headers.lines() {
        let l = line.trim();
        if !l.is_empty() {
            c.arg("-H").arg(l);
        }
    }
    if !body.trim().is_empty() {
        c.arg("--data-binary").arg(&body);
    }
    c.arg(url.trim());
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);

    match c.output() {
        Ok(o) => {
            let mut s = String::from_utf8_lossy(&o.stdout).to_string();
            let err = String::from_utf8_lossy(&o.stderr);
            if !err.trim().is_empty() {
                s.push_str("\n\n[curl] ");
                s.push_str(&err);
            }
            if s.trim().is_empty() {
                s = "(empty response)".into();
            }
            s
        }
        Err(e) => format!("Failed to run curl: {e}"),
    }
}

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn handle_conn(mut stream: TcpStream, dir: &Path) {
    let _ = stream.set_nonblocking(false);
    let mut buf = [0u8; 2048];
    let n = match stream.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return,
    };
    let req = String::from_utf8_lossy(&buf[..n]);
    let raw_path = req.split_whitespace().nth(1).unwrap_or("/");
    let mut rel = raw_path
        .split('?')
        .next()
        .unwrap_or("/")
        .trim_start_matches('/')
        .to_string();
    if rel.is_empty() {
        rel = "index.html".to_string();
    }
    let full = dir.join(&rel);
    let safe = full.starts_with(dir) && !rel.contains("..");

    if safe {
        if let Ok(data) = fs::read(&full) {
            let header = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
                content_type(&full),
                data.len()
            );
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(&data);
            return;
        }
    }
    let body = b"404 Not Found";
    let header = format!(
        "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
}

#[tauri::command]
fn serve_start(app: AppHandle, path: String, port: u16) -> Result<String, String> {
    serve_stop(app.clone());
    let dir = if path.trim().is_empty() {
        PathBuf::from(get_cwd(app.clone()))
    } else {
        PathBuf::from(path.trim())
    };
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", dir.display()));
    }
    let listener = TcpListener::bind(("127.0.0.1", port))
        .map_err(|e| format!("Couldn't bind 127.0.0.1:{port} — {e}"))?;
    listener.set_nonblocking(true).ok();

    let running = Arc::new(AtomicBool::new(true));
    let run2 = running.clone();
    let dir2 = dir.clone();
    thread::spawn(move || {
        while run2.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let d = dir2.clone();
                    thread::spawn(move || handle_conn(stream, &d));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(40));
                }
                Err(_) => break,
            }
        }
    });

    *app.state::<Browser>().server.lock().unwrap() = Some(ServerHandle { running });
    Ok(format!("http://127.0.0.1:{port}"))
}

#[tauri::command]
fn serve_stop(app: AppHandle) {
    if let Some(h) = app.state::<Browser>().server.lock().unwrap().take() {
        h.running.store(false, Ordering::Relaxed);
    }
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

pub fn run() {
    let proxy = read_settings().proxy;
    if !proxy.is_empty() {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            format!("--proxy-server={proxy}"),
        );
    }

    tauri::Builder::default()
        .manage(Browser::default())
        .invoke_handler(tauri::generate_handler![
            list_tabs,
            new_tab,
            switch_tab,
            close_tab,
            navigate,
            go_home,
            go_back,
            go_forward,
            reload,
            toggle_sidebar,
            set_sidebar_url,
            set_theme,
            get_settings,
            set_region,
            tor_new_identity,
            toggle_dock,
            open_devtools,
            get_cwd,
            run_command,
            http_request,
            serve_start,
            serve_stop
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            *handle.state::<Browser>().cwd.lock().unwrap() = default_cwd();

            let session = read_session();
            let tabs: Vec<String> = if session.urls.is_empty() {
                vec![HOME.to_string()]
            } else {
                session.urls
            };
            let active = session.active.min(tabs.len() - 1);
            let start = resolve(&tabs[active]);
            {
                let b = handle.state::<Browser>();
                *b.tabs.lock().unwrap() = tabs;
                *b.active.lock().unwrap() = active;
            }

            let win = WindowBuilder::new(app, "main")
                .title("Olus")
                .inner_size(1280.0, 820.0)
                .min_inner_size(720.0, 480.0)
                .build()?;
            let _ = win.set_size(LogicalSize::new(1280.0, 820.0));
            let _ = win.center();
            let _ = win.show();

            let (w, h) = window_size(&win);
            let body_h = (h - TOOLBAR_H).max(1.0);

            // 1) shell (chrome)
            win.add_child(
                WebviewBuilder::new("shell", WebviewUrl::App("index.html".into())),
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(w, h),
            )?;

            // 2) content viewport
            let start_url: WebviewUrl = if start == HOME_URL {
                WebviewUrl::App("start.html".into())
            } else {
                match start.parse() {
                    Ok(u) => WebviewUrl::External(u),
                    Err(_) => WebviewUrl::App("start.html".into()),
                }
            };
            let nav_handle = handle.clone();
            let content = WebviewBuilder::new("content", start_url)
                .user_agent(CHROME_UA)
                .on_navigation(move |u| {
                    let url = u.to_string();
                    let stored = if url.contains("tauri.localhost") {
                        HOME.to_string()
                    } else {
                        url.clone()
                    };
                    {
                        let b = nav_handle.state::<Browser>();
                        let a = *b.active.lock().unwrap();
                        let mut tabs = b.tabs.lock().unwrap();
                        if a < tabs.len() {
                            tabs[a] = stored;
                        }
                    }
                    let _ = nav_handle.emit("content:navigated", url);
                    save_session(&nav_handle);
                    true
                });
            win.add_child(
                content,
                LogicalPosition::new(0.0, TOOLBAR_H),
                LogicalSize::new(w, body_h),
            )?;

            // 3) AI sidebar — parked offscreen.
            let sidebar = WebviewBuilder::new(
                "sidebar",
                WebviewUrl::External(SIDEBAR_DEFAULT.parse().unwrap()),
            )
            .user_agent(CHROME_UA);
            win.add_child(
                sidebar,
                LogicalPosition::new(-100_000.0, 0.0),
                LogicalSize::new(SIDEBAR_W, body_h),
            )?;

            // 4) Dev Dock — parked offscreen until toggled.
            win.add_child(
                WebviewBuilder::new("devpanel", WebviewUrl::App("dev.html".into())),
                LogicalPosition::new(-100_000.0, 0.0),
                LogicalSize::new(w, DOCK_H),
            )?;

            let resize_handle = handle.clone();
            win.on_window_event(move |ev| {
                if let WindowEvent::Resized(_) = ev {
                    relayout(&resize_handle);
                }
            });

            relayout(&handle);
            emit_tabs(&handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Olus");
}
