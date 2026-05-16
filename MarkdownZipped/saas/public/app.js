// Shared client helpers. No framework.
export async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error((data && data.error) || `HTTP ${r.status}`);
  return data;
}

export async function me() {
  try { return (await api("/api/me")).user; } catch { return null; }
}

export function headerHTML(user) {
  const right = user
    ? `<a href="/account">account</a>${user.role === "admin" ? ' <a href="/admin">admin</a>' : ""} <a href="#" id="logout">logout</a>`
    : `<a href="/login">login</a> <a class="btn sm primary" href="/signup">Sign up</a>`;
  return `<a class="brand" href="/">MD<em>.zipped</em></a>
    <nav class="links"><a href="/studio/">Studio</a><a href="/pricing">Pricing</a>${right}</nav>`;
}

export async function mountHeader() {
  const el = document.querySelector("header.top");
  if (!el) return null;
  const user = await me();
  el.innerHTML = headerHTML(user);
  const lo = document.getElementById("logout");
  if (lo) lo.onclick = async (e) => {
    e.preventDefault();
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/";
  };
  return user;
}

export function qs(k) {
  return new URLSearchParams(location.search).get(k);
}
