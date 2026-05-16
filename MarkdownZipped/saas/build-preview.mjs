// Builds a STATIC visual preview of the SaaS frontend for GitHub Pages.
//
// The real SaaS (saas/src/server.js) needs a Node backend + DB and cannot
// run on Pages. This script takes the unmodified saas/public/ pages and
// produces a self-contained static copy that:
//   - rewrites server routes (/login, /pricing, ...) to .html files
//   - replaces app.js with a preview shim that returns canned demo data
//     instead of calling /api (so every page renders fully populated)
//   - injects a visible "STATIC PREVIEW" banner so nobody mistakes it
//     for a working product (no real accounts, auth or payments)
//
// Usage: node build-preview.mjs <srcPublicDir> <outDir>
import { promises as fs } from "node:fs";
import path from "node:path";

const [, , srcDir, outDir] = process.argv;
if (!srcDir || !outDir) {
  console.error("usage: node build-preview.mjs <srcPublicDir> <outDir>");
  process.exit(1);
}

const ROUTE_REWRITES = [
  ['href="/assets.css"', 'href="assets.css"'],
  ['"/app.js"', '"./app.js"'],
  ['href="/studio/"', 'href="../"'],
  ['href="/pricing"', 'href="pricing.html"'],
  ['href="/login"', 'href="login.html"'],
  ['href="/signup"', 'href="signup.html"'],
  ['href="/account"', 'href="account.html"'],
  ['href="/admin"', 'href="admin.html"'],
  ['href="/"', 'href="index.html"'],
];

const BANNER = `<div style="position:sticky;top:0;z-index:999;background:#14140f;color:#fbf8f0;font:600 11px/1.5 'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;text-align:center;border-bottom:2px solid #d4ff00">
STATIC PREVIEW · demo data only · no real backend, accounts or payments ·
<a href="../" style="color:#d4ff00">back to live studio</a> ·
<a href="https://github.com/martian-coder/TinyTools/tree/main/MarkdownZipped/saas" style="color:#d4ff00">source</a>
</div>`;

// Preview shim that replaces public/app.js. Same exported API surface,
// but api() resolves canned demo data and auth/checkout fail loudly so
// the demo never pretends to take a payment or create an account.
const PREVIEW_APP_JS = `// PREVIEW BUILD — no network. Canned demo data so pages render.
const PLANS = ${'${PLANS_JSON}'};
const NOW = Math.floor(Date.now()/1000);
const demoUser = { id:1, email:"amit@demo.dev", role:"admin", plan:"pro",
  planName:"Pro", plan_status:"active", plan_until: NOW + 30*86400,
  limits:{ savedPrompts:500 } };
let prompts = [
  { id:1, name:"support-agent system", size:1840 },
  { id:2, name:"sql copilot preamble", size:920 },
  { id:3, name:"changelog summarizer", size:610 },
];
const users = [
  { id:1, email:"amit@demo.dev", role:"admin", plan:"pro",  plan_status:"active" },
  { id:2, email:"dev@acme.io",   role:"user",  plan:"team",  plan_status:"active" },
  { id:3, email:"trial@foo.com", role:"user",  plan:"free",  plan_status:"active" },
  { id:4, email:"lapsed@bar.io", role:"user",  plan:"pro",   plan_status:"canceled" },
];
const audit = [
  { created_at:NOW-300,  user_id:2, action:"checkout.paid",   detail:"team via stripe" },
  { created_at:NOW-3600, user_id:3, action:"auth.signup",     detail:"free" },
  { created_at:NOW-7200, user_id:1, action:"admin.grant",     detail:"user 4 -> pro" },
  { created_at:NOW-9000, user_id:4, action:"subscription.canceled", detail:"pro" },
];
function fail(msg){ return Promise.reject(new Error(msg)); }

export async function api(p, opts = {}) {
  const m = (opts.method || "GET").toUpperCase();
  if (p === "/api/me")            return { user: demoUser, plans: PLANS };
  if (p === "/api/providers")     return { stripe:true, razorpay:true };
  if (p === "/api/prompts" && m === "GET") return prompts;
  if (p === "/api/prompts" && m === "POST") {
    const b = JSON.parse(opts.body || "{}");
    prompts.push({ id: Date.now(), name: b.name || "untitled",
      size: (b.body || "").length });
    return { ok:true };
  }
  if (p.startsWith("/api/prompts/") && m === "DELETE") {
    prompts = prompts.filter(x => String(x.id) !== p.split("/").pop());
    return { ok:true };
  }
  if (p === "/api/checkout/stripe")
    return fail("Static preview — Stripe Checkout would open here. Connect the backend to take real card payments.");
  if (p === "/api/checkout/razorpay")
    return { orderId:"order_PREVIEW", amount:74900, keyId:"rzp_live_PREVIEW" };
  if (p === "/api/admin/metrics")
    return { users: users.length, paid: 2, mrrUsd: 38,
      providers:{ stripe:true, razorpay:true } };
  if (p === "/api/admin/payment-config")
    return { stripe_secret_key:true, stripe_webhook_secret:true,
      razorpay_key_id:true, razorpay_key_secret:false,
      razorpay_webhook_secret:false };
  if (p === "/api/admin/audit")  return audit;
  if (p.startsWith("/api/admin/users")) {
    const q = decodeURIComponent((p.split("q=")[1] || "")).toLowerCase();
    return q ? users.filter(u => u.email.toLowerCase().includes(q)) : users;
  }
  if (p === "/api/admin/grant" || p === "/api/admin/revoke")
    return { ok:true };
  if (p === "/api/admin/payment-config" && m === "POST")
    return { ok:true, updated: 1 };
  if (p.startsWith("/api/auth/"))
    return fail("Static preview — sign-in / sign-up is disabled in this UI demo.");
  return { ok:true };
}

export async function me(){ try { return (await api("/api/me")).user; } catch { return null; } }

export function headerHTML(user){
  const right = user
    ? \`<a href="account.html">account</a> <a href="admin.html">admin</a> <a href="#" id="logout">logout</a>\`
    : \`<a href="login.html">login</a> <a class="btn sm primary" href="signup.html">Sign up</a>\`;
  return \`<a class="brand" href="index.html">MD<em>.zipped</em></a>
    <nav class="links"><a href="../">Studio</a><a href="pricing.html">Pricing</a>\${right}</nav>\`;
}
export async function mountHeader(){
  const el = document.querySelector("header.top");
  if (!el) return null;
  const user = await me();
  el.innerHTML = headerHTML(user);
  const lo = document.getElementById("logout");
  if (lo) lo.onclick = (e) => { e.preventDefault();
    alert("Static preview — logout is a no-op here."); };
  return user;
}
export function qs(k){ return new URLSearchParams(location.search).get(k); }
`;

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const entries = await fs.readdir(srcDir);

  for (const name of entries) {
    const src = path.join(srcDir, name);
    const stat = await fs.stat(src);
    if (!stat.isFile()) continue;

    if (name === "app.js") {
      const { PLANS } = await import(
        path.resolve(srcDir, "../src/plans.js")
      );
      const js = PREVIEW_APP_JS.replace(
        "${PLANS_JSON}",
        JSON.stringify(PLANS)
      );
      await fs.writeFile(path.join(outDir, name), js);
      continue;
    }

    if (name.endsWith(".html")) {
      let html = await fs.readFile(src, "utf8");
      for (const [from, to] of ROUTE_REWRITES) html = html.split(from).join(to);
      html = html.replace(/<body>/i, "<body>\n" + BANNER);
      await fs.writeFile(path.join(outDir, name), html);
      continue;
    }

    await fs.copyFile(src, path.join(outDir, name)); // assets.css etc.
  }
  console.log("preview built ->", outDir);
}

main().catch((e) => { console.error(e); process.exit(1); });
