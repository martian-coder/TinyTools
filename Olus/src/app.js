// Olus shell UI — talks to the Rust backend over the Tauri bridge.
// Tabs are indices into a backend-held URL list; the single content viewport is
// navigated between them. The shell builds engine-aware URLs and owns themes.

const ENGINES = {
  google: "https://www.google.com/search?q=%s",
  duckduckgo: "https://duckduckgo.com/?q=%s",
  bing: "https://www.bing.com/search?q=%s",
  brave: "https://search.brave.com/search?q=%s",
  startpage: "https://www.startpage.com/sp/search?query=%s",
  ecosia: "https://www.ecosia.org/search?q=%s",
};
const HOME = "olus://start";

const currentEngine = () => localStorage.getItem("olus.engine") || "google";
const currentTheme = () => localStorage.getItem("olus.theme") || "light";
const applyTheme = (t) => (document.documentElement.dataset.theme = t);
applyTheme(currentTheme());

function isHome(url) {
  return !url || url === HOME || url.includes("tauri.localhost");
}
function prettyTitle(url) {
  if (isHome(url)) return "Start";
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "New Tab";
  } catch {
    return "New Tab";
  }
}
function buildTarget(input) {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || s.startsWith("about:")) return s;
  const looksLikeHost = /^[^\s/]+\.[^\s/]+/.test(s) && !s.includes(" ");
  if (looksLikeHost) return "https://" + s;
  return (ENGINES[currentEngine()] || ENGINES.google).replace("%s", encodeURIComponent(s));
}

function boot(attempt = 0) {
  const T = window.__TAURI__;
  if (T && T.core && T.event) return start(T.core.invoke, T.event.listen);
  if (attempt > 150) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="position:fixed;inset:0;background:#7a1020;color:#fff;font:600 14px sans-serif;display:grid;place-items:center;z-index:9999">Tauri bridge unavailable</div>'
    );
    return;
  }
  setTimeout(() => boot(attempt + 1), 30);
}

function start(invoke, listen) {
  const $ = (id) => document.getElementById(id);
  const tabsEl = $("tabs");
  const address = $("address");
  const toastEl = $("toast");

  let state = { tabs: [HOME], active: 0, sidebar_open: false, dock_open: false };
  let liveUrl = "";

  function toast(msg, kind = "ok") {
    toastEl.textContent = msg;
    toastEl.className = "show " + kind;
    setTimeout(() => (toastEl.className = ""), 3200);
  }

  function render() {
    tabsEl.innerHTML = "";
    state.tabs.forEach((url, i) => {
      const tab = document.createElement("div");
      tab.className = "tab" + (i === state.active ? " active" : "");
      tab.title = isHome(url) ? "Start" : url;

      const dot = document.createElement("span");
      dot.className = "dot";
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = prettyTitle(url);
      const close = document.createElement("span");
      close.className = "close";
      close.innerHTML =
        '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
      close.onclick = (e) => {
        e.stopPropagation();
        invoke("close_tab", { index: i });
      };

      tab.append(dot, title, close);
      tab.onclick = () => invoke("switch_tab", { index: i });
      tabsEl.appendChild(tab);
    });

    $("ai").classList.toggle("on", state.sidebar_open);
    $("dev").classList.toggle("on", state.dock_open);

    if (document.activeElement !== address) {
      const u = liveUrl || state.tabs[state.active];
      address.value = isHome(u) ? "" : u;
    }
  }

  // ---- backend events ----
  listen("tabs:update", (e) => {
    state = e.payload;
    liveUrl = state.tabs[state.active];
    render();
  });
  listen("content:navigated", (e) => {
    liveUrl = e.payload;
    render();
  });

  // ---- toolbar ----
  $("back").onclick = () => invoke("go_back");
  $("forward").onclick = () => invoke("go_forward");
  $("reload").onclick = () => invoke("reload");
  $("home").onclick = () => invoke("go_home");
  $("newtab").onclick = () => invoke("new_tab", {});
  $("ai").onclick = () => invoke("toggle_sidebar");
  $("dev").onclick = () => invoke("toggle_dock");

  address.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const target = buildTarget(address.value);
      if (target) invoke("navigate", { url: target });
      address.blur();
    } else if (e.key === "Escape") {
      address.value = isHome(liveUrl) ? "" : liveUrl;
      address.blur();
    }
  });

  // ---- theme: update chrome + live-push to the content/start page ----
  function setTheme(t) {
    localStorage.setItem("olus.theme", t);
    applyTheme(t);
    invoke("set_theme", { theme: t });
  }
  $("theme").onclick = () => setTheme(currentTheme() === "dark" ? "light" : "dark");

  // ---- engine picker ----
  const engineSel = $("engine");
  engineSel.value = currentEngine();
  engineSel.addEventListener("change", () => localStorage.setItem("olus.engine", engineSel.value));

  // ---- region picker + Tor new-identity ----
  const regionSel = $("region");
  const torId = $("tor-id");
  let lastRegion = "direct";
  const reflectRegion = (r) => torId.classList.toggle("hidden", r !== "tor");

  invoke("get_settings").then((s) => {
    const r = (s.region || "Direct").toLowerCase();
    lastRegion = r === "tor" ? "tor" : r === "custom" ? "custom" : "direct";
    regionSel.value = lastRegion;
    reflectRegion(lastRegion);
  });

  regionSel.addEventListener("change", () => {
    const v = regionSel.value;
    if (v === "direct") invoke("set_region", { region: "Direct", proxy: "" });
    else if (v === "tor") invoke("set_region", { region: "Tor", proxy: "socks5://127.0.0.1:9050" });
    else if (v === "custom")
      askProxy(
        (proxy) => invoke("set_region", { region: "Custom", proxy }),
        () => {
          regionSel.value = lastRegion;
          reflectRegion(lastRegion);
        }
      );
    reflectRegion(v);
  });

  torId.onclick = () => {
    torId.classList.add("spin");
    invoke("tor_new_identity")
      .then((msg) => toast(msg, "ok"))
      .catch((err) => toast(String(err), "err"))
      .finally(() => setTimeout(() => torId.classList.remove("spin"), 600));
  };

  function askProxy(onOk, onCancel) {
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    wrap.innerHTML =
      '<div class="modal"><h3>Connect through a proxy</h3>' +
      "<p>Enter a proxy for the region you want to browse from. Example:<br>" +
      "<code>socks5://127.0.0.1:9050</code> or <code>http://user:pass@host:port</code></p>" +
      '<input id="proxy-in" placeholder="socks5://host:port" spellcheck="false" autocomplete="off" />' +
      '<div class="modal-row"><button id="proxy-cancel">Cancel</button>' +
      '<button id="proxy-ok" class="primary">Apply &amp; restart</button></div></div>';
    document.body.appendChild(wrap);
    const input = wrap.querySelector("#proxy-in");
    input.focus();
    const done = (ok) => {
      const val = input.value.trim();
      wrap.remove();
      ok && val ? onOk(val) : onCancel();
    };
    wrap.querySelector("#proxy-ok").onclick = () => done(true);
    wrap.querySelector("#proxy-cancel").onclick = () => done(false);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done(true);
      if (e.key === "Escape") done(false);
    });
  }

  // ---- shortcuts ----
  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey) return;
    if (e.key === "t") (e.preventDefault(), invoke("new_tab", {}));
    else if (e.key === "w") (e.preventDefault(), invoke("close_tab", { index: state.active }));
    else if (e.key === "l") (e.preventDefault(), address.focus(), address.select());
    else if (e.key === "r") (e.preventDefault(), invoke("reload"));
    else if (e.key === "j") (e.preventDefault(), invoke("toggle_sidebar"));
    else if (e.key === "`") (e.preventDefault(), invoke("toggle_dock"));
  });

  // ---- init ----
  invoke("list_tabs").then((s) => {
    state = s;
    liveUrl = state.tabs[state.active] || HOME;
    render();
  });
}

boot();
