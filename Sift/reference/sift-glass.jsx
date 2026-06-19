import React, { useState, useMemo } from "react";
import {
  MessageSquare, FlaskConical, Settings as SettingsIcon, Send, ArrowLeft,
  Check, X, ShieldCheck, AlertTriangle, Forward, Briefcase, Megaphone,
  Inbox, ChevronRight, Sparkles, RotateCcw, Eye, Clock, Ban, Palette, Lock,
} from "lucide-react";

/* ----------------------------- themes ----------------------------- */
const THEMES = {
  aurora: { label: "Aurora", swatch: "linear-gradient(135deg,#7c83ff,#22d3ee)", vars: {
    "--base": "#0b1020", "--g1": "rgba(124,131,255,.55)", "--g2": "rgba(34,211,238,.38)", "--g3": "rgba(168,85,247,.45)",
    "--accent": "#7c83ff", "--accent2": "#22d3ee", "--text": "#eef1ff", "--dim": "rgba(238,241,255,.55)",
    "--glass": "rgba(255,255,255,.07)", "--glass2": "rgba(255,255,255,.13)", "--line": "rgba(255,255,255,.14)", "--in": "rgba(255,255,255,.10)" } },
  sunset: { label: "Sunset", swatch: "linear-gradient(135deg,#fb7185,#fb923c)", vars: {
    "--base": "#1a0b14", "--g1": "rgba(244,63,94,.5)", "--g2": "rgba(249,115,22,.42)", "--g3": "rgba(217,70,239,.45)",
    "--accent": "#fb7185", "--accent2": "#fb923c", "--text": "#fff0f3", "--dim": "rgba(255,240,243,.55)",
    "--glass": "rgba(255,255,255,.07)", "--glass2": "rgba(255,255,255,.13)", "--line": "rgba(255,255,255,.15)", "--in": "rgba(255,255,255,.10)" } },
  noir: { label: "Noir", swatch: "linear-gradient(135deg,#60a5fa,#818cf8)", vars: {
    "--base": "#08080d", "--g1": "rgba(59,130,246,.34)", "--g2": "rgba(99,102,241,.3)", "--g3": "rgba(14,165,233,.26)",
    "--accent": "#60a5fa", "--accent2": "#818cf8", "--text": "#eaf0ff", "--dim": "rgba(234,240,255,.5)",
    "--glass": "rgba(255,255,255,.05)", "--glass2": "rgba(255,255,255,.1)", "--line": "rgba(255,255,255,.1)", "--in": "rgba(255,255,255,.07)" } },
  daylight: { label: "Daylight", swatch: "linear-gradient(135deg,#6366f1,#06b6d4)", vars: {
    "--base": "#e9ecf9", "--g1": "rgba(124,131,255,.4)", "--g2": "rgba(34,211,238,.3)", "--g3": "rgba(196,181,253,.45)",
    "--accent": "#6366f1", "--accent2": "#06b6d4", "--text": "#1c2030", "--dim": "rgba(28,32,48,.55)",
    "--glass": "rgba(255,255,255,.55)", "--glass2": "rgba(255,255,255,.72)", "--line": "rgba(255,255,255,.85)", "--in": "rgba(255,255,255,.78)" } },
};

const GRADS = ["linear-gradient(135deg,#7c83ff,#22d3ee)", "linear-gradient(135deg,#fb7185,#fb923c)",
  "linear-gradient(135deg,#34d399,#06b6d4)", "linear-gradient(135deg,#a78bfa,#f472b6)", "linear-gradient(135deg,#38bdf8,#6366f1)"];

const CAT = {
  clean:    { label: "Clean",            Icon: Check },
  abusive:  { label: "Abusive language", Icon: AlertTriangle },
  spam:     { label: "Spam / forward",   Icon: Forward },
  business: { label: "Business",         Icon: Briefcase },
  promo:    { label: "Promotion",        Icon: Megaphone },
};
const FOLDERS = [
  { id: "primary", label: "Primary", Icon: Inbox },
  { id: "business", label: "Business", Icon: Briefcase },
  { id: "promotions", label: "Promotions", Icon: Megaphone },
  { id: "review", label: "Review", Icon: ShieldCheck },
];

/* --------------------------- moderation --------------------------- */
const ABUSIVE = ["idiot", "stupid", "hate you", "shut up", "loser", "moron", "trash", "kill", "dumb", "worthless"];
const SPAM = ["forwarded", "share with", "forward to", "10 people", "10 friends", "click here", "good luck", "bad luck", "win free", "http"];
const BUSINESS = ["order", "invoice", "otp", "delivery", "tracking", "shipped", "payment", "receipt", "appointment", "booking"];
const PROMO = ["sale", "discount", "% off", "offer", "deal", "coupon", "limited time", "buy now", "free shipping"];

function moderate(text, s) {
  const t = text.toLowerCase();
  const hit = (l) => l.filter((w) => t.includes(w));
  const ab = hit(ABUSIVE);
  if (s.civility.enabled && ab.length) {
    const base = s.civility.sensitivity === "high" ? 0.7 : s.civility.sensitivity === "low" ? 0.55 : 0.62;
    return { category: "abusive", confidence: Math.min(0.97, base + ab.length * 0.12), flaggedTerms: ab };
  }
  const sp = hit(SPAM);
  const emoji = (t.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length >= 3;
  const shout = text.replace(/[^A-Z]/g, "").length > 8 && text === text.toUpperCase();
  if (s.spam.enabled && (sp.length || emoji || shout))
    return { category: "spam", confidence: Math.min(0.96, 0.6 + (sp.length + (emoji ? 1 : 0)) * 0.12), flaggedTerms: sp };
  const bz = hit(BUSINESS);
  if (s.business.enabled && bz.length) return { category: "business", confidence: Math.min(0.95, 0.62 + bz.length * 0.1), flaggedTerms: bz };
  const pr = hit(PROMO);
  if (pr.length) return { category: "promo", confidence: Math.min(0.95, 0.6 + pr.length * 0.1), flaggedTerms: pr };
  return { category: "clean", confidence: 0.92, flaggedTerms: [] };
}
function routeVerdict(v, s, trusted) {
  if (trusted) return { folder: "primary", status: "delivered" };
  if (v.category === "abusive") {
    if (!s.civility.enabled) return { folder: "primary", status: "delivered" };
    const autoReply = s.civility.notifySender;
    if (s.civility.onBlock === "silentDrop") return { folder: "review", status: "dropped", autoReply };
    return { folder: "review", status: "held", ask: s.civility.onBlock === "askPerMessage", autoReply };
  }
  if (v.category === "spam") {
    if (!s.spam.enabled) return { folder: "promotions", status: "delivered" };
    if (s.spam.onBlock === "silentDrop") return { folder: "review", status: "dropped" };
    return { folder: "review", status: "held" };
  }
  if (v.category === "business") return { folder: s.business.enabled ? "business" : "primary", status: "delivered" };
  if (v.category === "promo") return { folder: "promotions", status: "delivered" };
  return { folder: "primary", status: "delivered" };
}

/* ------------------------------ seed ------------------------------ */
let idc = 100; const nid = () => `m${idc++}`;
const seedContacts = [
  { id: "maya", name: "Maya", trusted: false, grad: GRADS[0] },
  { id: "unknown", name: "+1 (555) 0142", trusted: false, grad: "linear-gradient(135deg,#94a3b8,#64748b)" },
  { id: "quickcart", name: "QuickCart", trusted: false, grad: GRADS[4] },
  { id: "megadeals", name: "MegaDeals", trusted: false, grad: GRADS[3] },
  { id: "groupfwd", name: "Group Forward", trusted: false, grad: GRADS[1] },
  { id: "dad", name: "Dad", trusted: true, grad: GRADS[2] },
];
const seedMessages = [
  { id: nid(), contactId: "maya", name: "Maya", text: "Hey! Are we still on for Saturday?", dir: "in", time: "9:41", folder: "primary", status: "delivered", verdict: { category: "clean" } },
  { id: nid(), contactId: "maya", name: "Maya", text: "I found a great trail 🥾", dir: "in", time: "9:42", folder: "primary", status: "delivered", verdict: { category: "clean" } },
  { id: nid(), contactId: "dad", name: "Dad", text: "this stupid traffic is killing me, running late lol", dir: "in", time: "8:30", folder: "primary", status: "delivered", verdict: { category: "abusive" } },
  { id: nid(), contactId: "quickcart", name: "QuickCart", text: "Your order #4821 has shipped — track delivery here.", dir: "in", time: "Tue", folder: "business", status: "delivered", verdict: { category: "business", flaggedTerms: ["order", "shipped"] } },
  { id: nid(), contactId: "megadeals", name: "MegaDeals", text: "Limited time! 50% off everything — shop the sale now.", dir: "in", time: "Mon", folder: "promotions", status: "delivered", verdict: { category: "promo", flaggedTerms: ["limited time", "sale"] } },
  { id: nid(), contactId: "unknown", name: "+1 (555) 0142", text: "you're such an idiot, I hate you", dir: "in", time: "7:12", folder: "review", status: "held", verdict: { category: "abusive", confidence: 0.94, flaggedTerms: ["idiot", "hate you"] }, autoReply: true },
  { id: nid(), contactId: "groupfwd", name: "Group Forward", text: "URGENT!! Forward this to 10 people or bad luck 😱😱😱", dir: "in", time: "6:05", folder: "review", status: "held", verdict: { category: "spam", confidence: 0.91, flaggedTerms: ["forward", "10 people"] } },
];
const defaultSettings = {
  civility: { enabled: true, sensitivity: "medium", onBlock: "review", notifySender: true },
  business: { enabled: true },
  spam: { enabled: true, onBlock: "review" },
};

/* --------------------------- atoms --------------------------- */
const Avatar = ({ c, size = 44 }) => (
  <div className="shrink-0 grid place-items-center font-semibold text-white"
    style={{ width: size, height: size, borderRadius: 999, background: c?.grad || GRADS[0], boxShadow: "0 6px 16px -8px rgba(0,0,0,.55)" }}>
    {(c?.name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "#"}
  </div>
);
const Badge = ({ cat }) => { const m = CAT[cat] || CAT.clean; const I = m.Icon;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cat-${cat}`}><I size={12} /> {m.label}</span>; };
const Switch = ({ on, onClick }) => <button onClick={onClick} className={`sw ${on ? "on" : ""}`}><span className="knob" /></button>;
const Segment = ({ value, options, onChange }) => (
  <div className="seg">{options.map((o) => <button key={o.v} onClick={() => onChange(o.v)} className={value === o.v ? "on" : ""}>{o.l}</button>)}</div>
);
const Empty = ({ icon: I, title, body }) => (
  <div className="flex flex-col items-center justify-center text-center px-8 py-16">
    <div className="glass grid place-items-center mb-3" style={{ width: 62, height: 62, borderRadius: 20 }}><I size={26} className="dim" /></div>
    <div className="font-semibold text-main">{title}</div><div className="text-sm dim mt-1">{body}</div>
  </div>
);

/* ============================ APP ============================ */
export default function SiftGlass() {
  const [contacts, setContacts] = useState(seedContacts);
  const [messages, setMessages] = useState(seedMessages);
  const [settings, setSettings] = useState(defaultSettings);
  const [tab, setTab] = useState("chats");
  const [folder, setFolder] = useState("primary");
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [theme, setTheme] = useState("aurora");
  const [showThemes, setShowThemes] = useState(false);
  // tester state (lifted so it survives parent re-renders)
  const [tName, setTName] = useState("New number");
  const [tTrusted, setTTrusted] = useState(false);
  const [tText, setTText] = useState("");
  const [tResult, setTResult] = useState(null);
  const [tScan, setTScan] = useState(false);

  const cById = (id) => contacts.find((c) => c.id === id);
  const reviewCount = messages.filter((m) => m.status === "held").length;
  const threads = useMemo(() => {
    const ids = [...new Set(messages.filter((m) => m.dir === "in" && m.status === "delivered" && m.folder === folder).map((m) => m.contactId))];
    return ids.map((id) => { const cm = messages.filter((m) => m.contactId === id);
      return { id, c: cById(id), last: [...cm].reverse().find((m) => m.status === "delivered" || m.dir === "out") }; });
  }, [messages, folder, contacts]);
  const held = messages.filter((m) => m.status === "held");
  const dropped = messages.filter((m) => m.status === "dropped");

  const approve = (mid) => setMessages((ms) => ms.map((m) => m.id === mid ? { ...m, status: "delivered", folder: "primary" } : m));
  const reject = (mid) => setMessages((ms) => ms.map((m) => m.id === mid ? { ...m, status: "rejected" } : m));
  const resetAll = () => { setMessages(seedMessages); setContacts(seedContacts); setSettings(defaultSettings); setBanner(null); setTResult(null); };
  const sendOut = () => { if (!draft.trim() || !open) return;
    setMessages((ms) => [...ms, { id: nid(), contactId: open, name: cById(open)?.name, text: draft.trim(), dir: "out", time: "now", folder, status: "delivered" }]); setDraft(""); };

  const receive = () => {
    if (!tText.trim()) return; const txt = tText.trim();
    setTScan(true); setTResult(null);
    setTimeout(() => {
      const v = moderate(txt, settings); const r = routeVerdict(v, settings, tTrusted);
      const cid = (tName.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "newnumber");
      if (!cById(cid)) setContacts((cs) => [...cs, { id: cid, name: tName.trim() || "New number", trusted: tTrusted, grad: GRADS[cs.length % GRADS.length] }]);
      setMessages((ms) => [...ms, { id: nid(), contactId: cid, name: tName.trim() || "New number", text: txt, dir: "in", time: "now", folder: r.folder, status: r.status, verdict: v, autoReply: r.autoReply }]);
      setTResult({ v, r, text: txt }); setTScan(false);
      if (r.ask) setBanner("A message was filtered — review it.");
    }, 750);
  };
  const destLabel = (r) => r.status === "dropped" ? (r.autoReply ? "Blocked · auto-rejected" : "Silently dropped")
    : r.status === "held" ? "Held in Review · blurred until you reveal it"
    : "Delivered to " + (FOLDERS.find((f) => f.id === r.folder)?.label || r.folder);
  const senderStatus = (r) => r.status === "held" ? { label: "Under review", sub: "The recipient’s filter is holding this for review.", icon: Clock }
    : r.status === "dropped" ? (r.autoReply ? { label: "Auto-rejected", sub: `Recipient’s civility filter (${settings.civility.sensitivity} sensitivity) wouldn’t accept this.`, icon: Ban } : { label: "Delivered", sub: "", icon: Check })
    : { label: "Delivered", sub: "", icon: Check };

  /* ----------------------- screens ----------------------- */
  const Header = (title, sub) => (
    <div className="glass-h px-4 pt-4 pb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 11, background: "linear-gradient(135deg,var(--accent),var(--accent2))", boxShadow: "0 6px 18px -6px var(--accent)" }}>
          <ShieldCheck size={18} color="#fff" />
        </div>
        <div><div className="font-semibold text-main leading-tight tracking-tight">{title}</div>{sub && <div className="text-[11px] dim leading-tight">{sub}</div>}</div>
      </div>
      <button onClick={() => setShowThemes(true)} className="glass grid place-items-center" style={{ width: 34, height: 34, borderRadius: 11 }}><Palette size={16} className="text-main" /></button>
    </div>
  );

  const ChatList = () => (
    <>
      {Header("Sift", "private by design")}
      <div className="px-3 py-2 flex gap-2 overflow-x-auto no-bar">
        {FOLDERS.map((f) => { const a = folder === f.id;
          return <button key={f.id} onClick={() => setFolder(f.id)} className={`pill ${a ? "pill-on" : ""}`}>
            <f.Icon size={13} /> {f.label}
            {f.id === "review" && reviewCount > 0 && <span className="rev-dot">{reviewCount}</span>}
          </button>; })}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-28 no-bar">{folder === "review" ? <Review /> : <Delivered />}</div>
    </>
  );

  const Delivered = () => threads.length === 0
    ? <Empty icon={Inbox} title="Nothing here yet" body="Messages sorted to this folder land here. Try the Test tab." />
    : <div className="space-y-2 pt-1">{threads.map(({ id, c, last }, i) => (
        <button key={id} onClick={() => setOpen(id)} className="row glass w-full flex items-center gap-3 p-3 text-left pop" style={{ animationDelay: `${i * 40}ms` }}>
          <Avatar c={c} />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-baseline gap-2"><span className="font-semibold text-main truncate">{c?.name}</span><span className="text-[11px] dim shrink-0">{last?.time}</span></div>
            <div className="text-sm dim truncate">{last?.text}</div>
          </div>
          <ChevronRight size={16} className="dim shrink-0" />
        </button>))}</div>;

  const Review = () => (held.length === 0 && dropped.length === 0)
    ? <Empty icon={ShieldCheck} title="All clear" body="No filtered messages need your attention." />
    : <div className="space-y-3 pt-1">
        {held.map((m, i) => (
          <div key={m.id} className="glass p-3 pop" style={{ borderRadius: 20, animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2"><Avatar c={cById(m.contactId)} size={30} /><span className="text-sm font-medium text-main">{m.name}</span></div>
              <Badge cat={m.verdict?.category} />
            </div>
            <div className="relative mb-2">
              <p className={`text-sm text-main p-3 ${revealed[m.id] ? "" : "blur-md select-none"}`} style={{ background: "var(--in)", borderRadius: 14 }}>{m.text}</p>
              {!revealed[m.id] && <button onClick={() => setRevealed((r) => ({ ...r, [m.id]: true }))}
                className="absolute inset-0 grid place-items-center text-xs font-semibold text-main"><span className="glass2 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Eye size={13} /> Hidden — tap to reveal</span></button>}
            </div>
            <p className="text-[11px] dim mb-2.5 flex items-start gap-1.5"><Forward size={12} className="mt-0.5 shrink-0" /> Sender sees “Under review”{m.autoReply ? ` · filter set to ${settings.civility.sensitivity}` : ""}.</p>
            <div className="flex gap-2">
              <button onClick={() => approve(m.id)} className="act act-ok"><Check size={15} /> Let through</button>
              <button onClick={() => reject(m.id)} className="act act-no"><X size={15} /> Reject</button>
            </div>
          </div>))}
        {dropped.length > 0 && <div>
          <div className="text-[11px] uppercase tracking-wide dim px-1 mb-1.5">Silently dropped · hidden in real use</div>
          {dropped.map((m) => <div key={m.id} className="glass p-3 mb-2 opacity-60" style={{ borderRadius: 18 }}>
            <div className="flex items-center justify-between mb-1"><span className="text-xs dim">{m.name}</span><Badge cat={m.verdict?.category} /></div>
            <p className="text-sm dim line-through">{m.text}</p></div>)}
        </div>}
      </div>;

  const Conversation = () => { const c = cById(open);
    const msgs = messages.filter((m) => m.contactId === open && (m.status === "delivered" || m.dir === "out"));
    return <>
      <div className="glass-h px-3 py-3 flex items-center gap-3">
        <button onClick={() => setOpen(null)} className="text-main"><ArrowLeft size={20} /></button>
        <Avatar c={c} size={36} />
        <div className="flex-1"><div className="font-semibold text-main leading-tight">{c?.name}</div>
          {c?.trusted && <div className="text-[11px] flex items-center gap-1 accent-t"><ShieldCheck size={11} /> Trusted · filters off</div>}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-24 no-bar convo">
        {msgs.map((m) => <div key={m.id} className={`flex ${m.dir === "out" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[78%] px-3.5 py-2 text-sm pop ${m.dir === "out" ? "bubble-out" : "bubble-in text-main"}`} style={{ borderRadius: 18, borderBottomRightRadius: m.dir === "out" ? 6 : 18, borderBottomLeftRadius: m.dir === "out" ? 18 : 6 }}>
            {m.text}<div className={`text-[10px] mt-0.5 ${m.dir === "out" ? "out-time" : "dim"}`}>{m.time}</div>
          </div></div>)}
      </div>
      <div className="px-3 pb-3 pt-1"><div className="glass2 flex items-center gap-2 p-1.5" style={{ borderRadius: 999 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendOut()} placeholder="Message" className="flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:dim" />
        <button onClick={sendOut} className="grid place-items-center send-btn" style={{ width: 38, height: 38, borderRadius: 999 }}><Send size={16} color="#fff" /></button>
      </div></div>
    </>; };

  const Tester = () => { const ex = [
      { l: "Friendly", t: "Hey, lunch tomorrow?" }, { l: "Abusive", t: "you're an idiot, I hate you" },
      { l: "Forward", t: "Forward this to 10 friends for good luck! 🔥🔥🔥" },
      { l: "Business", t: "Your order #5510 is out for delivery, OTP 4471" }, { l: "Promo", t: "Flash sale! 40% off, limited time offer" }];
    const st = tResult ? senderStatus(tResult.r) : null; const SI = st?.icon;
    return <>
      {Header("Test the filter", "send yourself an incoming message")}
      <div className="flex-1 overflow-y-auto px-4 pb-28 no-bar space-y-4 pt-1">
        <div className="flex flex-wrap gap-1.5">{ex.map((e) => <button key={e.l} onClick={() => setTText(e.t)} className="chip text-xs px-3 py-1.5 rounded-full">{e.l}</button>)}</div>
        <div><label className="text-xs font-medium dim">From</label><input value={tName} onChange={(e) => setTName(e.target.value)} className="inp w-full mt-1.5 px-3.5 py-2.5 text-sm" /></div>
        <div><label className="text-xs font-medium dim">Message</label><textarea value={tText} onChange={(e) => setTText(e.target.value)} rows={3} placeholder="Type a message as if it’s coming in…" className="inp w-full mt-1.5 px-3.5 py-2.5 text-sm resize-none" /></div>
        <label className="flex items-center justify-between text-sm text-main"><span className="flex items-center gap-2"><ShieldCheck size={15} className="accent-t" /> Sender is a trusted contact</span><Switch on={tTrusted} onClick={() => setTTrusted(!tTrusted)} /></label>
        <button onClick={receive} className="btn-accent w-full py-3.5 font-semibold flex items-center justify-center gap-2"><Sparkles size={16} /> Receive message</button>

        {tScan && <div className="glass p-5 pop flex flex-col items-center text-center" style={{ borderRadius: 22 }}>
          <div className="scan-ring grid place-items-center mb-3" style={{ width: 56, height: 56, borderRadius: 999 }}><Lock size={22} className="text-main" /></div>
          <div className="text-sm font-medium text-main">Checking on your device…</div>
          <div className="scan-bar mt-3" /></div>}

        {tResult && !tScan && <div className="glass p-4 pop" style={{ borderRadius: 22 }}>
          <div className="flex items-center justify-between mb-3"><Badge cat={tResult.v.category} /><span className="onchip"><Lock size={10} /> on-device</span></div>
          <div className="bar mb-3"><div className="bar-fill" style={{ width: `${Math.round((tResult.v.confidence || .9) * 100)}%` }} /></div>
          {tResult.v.flaggedTerms?.length > 0 && <div className="text-xs dim mb-3">Triggered by: {tResult.v.flaggedTerms.map((w) => `“${w}”`).join(", ")}</div>}
          <div className="text-[11px] uppercase tracking-wide dim mb-1">On your phone (recipient)</div>
          <div className="flex items-center gap-2 text-sm font-medium text-main mb-3"><ChevronRight size={15} className="accent-t" /> {destLabel(tResult.r)}</div>
          <div className="text-[11px] uppercase tracking-wide dim mb-2">What the sender sees</div>
          <div className="flex justify-end"><div className="bubble-out max-w-[80%] px-3.5 py-2 text-sm" style={{ borderRadius: 18, borderBottomRightRadius: 6 }}>{tResult.text}<div className="flex items-center gap-1 justify-end mt-1 text-[10px] out-time">{SI && <SI size={11} />} {st.label}</div></div></div>
          {st.sub && <div className="text-[11px] dim mt-1.5 text-right">{st.sub}</div>}
          {tResult.r.status !== "dropped" && <button onClick={() => { setTab("chats"); setFolder(tResult.r.status === "held" ? "review" : tResult.r.folder); }} className="mt-3 text-xs accent-t font-semibold">Open the {tResult.r.status === "held" ? "Review" : FOLDERS.find((f) => f.id === tResult.r.folder)?.label} folder →</button>}
        </div>}
      </div>
    </>; };

  const Settings = () => { const s = settings; const set = (p) => setSettings((x) => ({ ...x, ...p }));
    return <>
      {Header("Settings", "you’re in control of the filter")}
      <div className="flex-1 overflow-y-auto px-3 pb-28 no-bar space-y-3 pt-1">
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium text-main"><AlertTriangle size={16} className="cat-ic-rose" /> Civility filter</div><Switch on={s.civility.enabled} onClick={() => set({ civility: { ...s.civility, enabled: !s.civility.enabled } })} /></div>
          {s.civility.enabled && <>
            <div><div className="text-xs dim mb-1.5">Sensitivity</div><Segment value={s.civility.sensitivity} onChange={(v) => set({ civility: { ...s.civility, sensitivity: v } })} options={[{ v: "low", l: "Low" }, { v: "medium", l: "Medium" }, { v: "high", l: "High" }]} /></div>
            <div><div className="text-xs dim mb-1.5">When a message is flagged</div><Segment value={s.civility.onBlock} onChange={(v) => set({ civility: { ...s.civility, onBlock: v } })} options={[{ v: "review", l: "Review" }, { v: "askPerMessage", l: "Ask each" }, { v: "silentDrop", l: "Drop" }]} /></div>
            <label className="flex items-center justify-between text-sm text-main pt-0.5"><span>Tell the sender it was blocked</span><Switch on={s.civility.notifySender} onClick={() => set({ civility: { ...s.civility, notifySender: !s.civility.notifySender } })} /></label>
          </>}
        </div>
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium text-main"><Briefcase size={16} className="cat-ic-sky" /> Business sorting</div><Switch on={s.business.enabled} onClick={() => set({ business: { enabled: !s.business.enabled } })} /></div>
          <p className="text-xs dim mt-1.5">Orders, deliveries and receipts get their own folder.</p>
        </div>
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium text-main"><Forward size={16} className="cat-ic-amber" /> Spam &amp; forwards</div><Switch on={s.spam.enabled} onClick={() => set({ spam: { ...s.spam, enabled: !s.spam.enabled } })} /></div>
          {s.spam.enabled && <div><div className="text-xs dim mb-1.5">When junk is detected</div><Segment value={s.spam.onBlock} onChange={(v) => set({ spam: { ...s.spam, onBlock: v } })} options={[{ v: "review", l: "Review" }, { v: "silentDrop", l: "Drop" }]} /></div>}
        </div>
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-2 font-medium text-main mb-1"><ShieldCheck size={16} className="cat-ic-emerald" /> Trusted contacts</div>
          <p className="text-xs dim mb-2">Trusted people bypass every filter.</p>
          {contacts.map((c) => <label key={c.id} className="flex items-center justify-between py-1.5"><span className="flex items-center gap-2 text-sm text-main"><Avatar c={c} size={28} /> {c.name}</span><Switch on={c.trusted} onClick={() => setContacts((cs) => cs.map((x) => x.id === c.id ? { ...x, trusted: !x.trusted } : x))} /></label>)}
        </div>
        <button onClick={resetAll} className="w-full flex items-center justify-center gap-2 text-sm dim py-3"><RotateCcw size={14} /> Reset demo</button>
      </div>
    </>; };

  return (
    <div className="wrap app-bg" style={THEMES[theme].vars}>
      <style>{CSS}</style>
      <div className="phone">
        {banner && <div className="absolute top-3 left-3 right-3 z-30 glass2 text-main text-xs px-3 py-2.5 flex items-center justify-between slide-up" style={{ borderRadius: 14 }}>
          <span>{banner}</span><button onClick={() => setBanner(null)}><X size={14} /></button></div>}

        <div key={open ? `c${open}` : tab} className="flex-1 flex flex-col overflow-hidden screen">
          {open ? <Conversation /> : tab === "chats" ? <ChatList /> : tab === "test" ? <Tester /> : <Settings />}
        </div>

        {!open && <div className="nav-wrap"><div className="nav flex">
          {[{ id: "chats", l: "Chats", I: MessageSquare }, { id: "test", l: "Test", I: FlaskConical }, { id: "settings", l: "Settings", I: SettingsIcon }].map((t) => {
            const a = tab === t.id; return <button key={t.id} onClick={() => setTab(t.id)} className={`nav-item ${a ? "nav-on" : ""}`}><t.I size={20} /><span className="text-[11px]">{t.l}</span></button>; })}
        </div></div>}

        {showThemes && <div className="absolute inset-0 z-40 flex items-end" onClick={() => setShowThemes(false)}>
          <div className="sheet-bg" /><div className="glass2 relative w-full p-4 slide-up" style={{ borderTopLeftRadius: 26, borderTopRightRadius: 26 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 font-semibold text-main mb-3"><Palette size={16} /> Theme</div>
            <div className="grid grid-cols-2 gap-2.5">{Object.entries(THEMES).map(([k, t]) => (
              <button key={k} onClick={() => { setTheme(k); setShowThemes(false); }} className={`th-card ${theme === k ? "th-on" : ""}`}>
                <span className="th-swatch" style={{ background: t.swatch }} /><span className="text-sm font-medium text-main">{t.label}</span>{theme === k && <Check size={14} className="accent-t ml-auto" />}
              </button>))}</div>
          </div></div>}
      </div>
    </div>
  );
}

/* ----------------------------- styles ----------------------------- */
const CSS = `
*{box-sizing:border-box}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text)}
@media(min-width:640px){.wrap{padding:24px}}
.app-bg{background:
  radial-gradient(40% 35% at 18% 18%,var(--g1),transparent 70%),
  radial-gradient(42% 38% at 84% 26%,var(--g2),transparent 70%),
  radial-gradient(46% 42% at 50% 88%,var(--g3),transparent 72%),
  var(--base);
  background-size:180% 180%,180% 180%,200% 200%,auto;
  animation:drift 22s ease-in-out infinite alternate}
@keyframes drift{0%{background-position:0% 0%,100% 0%,50% 100%}100%{background-position:60% 50%,20% 60%,50% 10%}}
.phone{position:relative;width:100%;height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
@media(min-width:640px){.phone{width:392px;height:824px;border-radius:40px;box-shadow:0 50px 90px -30px rgba(0,0,0,.65),0 0 0 1px var(--line),inset 0 0 0 1px rgba(255,255,255,.04)}}
.text-main{color:var(--text)} .dim{color:var(--dim)} .accent-t{color:var(--accent)}
.no-bar::-webkit-scrollbar{display:none} .no-bar{scrollbar-width:none}
.glass{background:var(--glass);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);border:1px solid var(--line)}
.glass2{background:var(--glass2);backdrop-filter:blur(26px) saturate(160%);-webkit-backdrop-filter:blur(26px) saturate(160%);border:1px solid var(--line)}
.glass-h{background:var(--glass);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
.row{border-radius:18px;transition:transform .15s ease,background .2s ease}
.row:active{transform:scale(.985)}
.convo{position:relative}
.pill{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;color:var(--dim);background:var(--glass);border:1px solid var(--line);transition:.2s}
.pill-on{color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent2));border-color:transparent;box-shadow:0 8px 20px -8px var(--accent)}
.rev-dot{margin-left:2px;background:#f43f5e;color:#fff;font-size:10px;padding:0 6px;border-radius:999px}
.bubble-out{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;box-shadow:0 10px 24px -10px var(--accent)}
.bubble-in{background:var(--in);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid var(--line)}
.out-time{color:rgba(255,255,255,.75)}
.send-btn{background:linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 8px 20px -8px var(--accent);transition:.18s}.send-btn:active{transform:scale(.92)}
.inp{background:var(--glass);border:1px solid var(--line);color:var(--text);border-radius:14px;outline:none}
.inp::placeholder{color:var(--dim)}
.chip{background:var(--glass);border:1px solid var(--line);color:var(--dim);transition:.18s}.chip:hover{color:var(--text)}
.btn-accent{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border-radius:16px;box-shadow:0 14px 30px -10px var(--accent);transition:.18s}.btn-accent:active{transform:scale(.98)}
.act{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 0;border-radius:13px;font-size:13px;font-weight:600}
.act-ok{background:rgba(16,185,129,.16);color:#34d399;border:1px solid rgba(16,185,129,.3)}
.act-no{background:rgba(244,63,94,.16);color:#fb7185;border:1px solid rgba(244,63,94,.3)}
.sw{width:44px;height:26px;border-radius:999px;position:relative;background:var(--line);transition:.25s;flex-shrink:0}
.sw.on{background:linear-gradient(135deg,var(--accent),var(--accent2))}
.sw .knob{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:999px;background:#fff;transition:.25s;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.sw.on .knob{left:21px}
.seg{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--glass);border:1px solid var(--line)}
.seg button{flex:1;font-size:12px;font-weight:600;padding:7px 0;border-radius:10px;color:var(--dim);transition:.18s}
.seg button.on{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;box-shadow:0 6px 16px -6px var(--accent)}
.cat-clean{background:rgba(16,185,129,.16);color:#34d399;border:1px solid rgba(16,185,129,.3)}
.cat-abusive{background:rgba(244,63,94,.16);color:#fb7185;border:1px solid rgba(244,63,94,.3)}
.cat-spam{background:rgba(245,158,11,.16);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}
.cat-business{background:rgba(14,165,233,.16);color:#38bdf8;border:1px solid rgba(14,165,233,.3)}
.cat-promo{background:rgba(139,92,246,.16);color:#a78bfa;border:1px solid rgba(139,92,246,.3)}
.cat-ic-rose{color:#fb7185}.cat-ic-sky{color:#38bdf8}.cat-ic-amber{color:#fbbf24}.cat-ic-emerald{color:#34d399}
.onchip{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px;background:var(--glass);border:1px solid var(--line);color:var(--dim)}
.bar{height:7px;border-radius:999px;background:var(--glass);overflow:hidden;border:1px solid var(--line)}
.bar-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .6s cubic-bezier(.2,.8,.2,1)}
.scan-ring{background:var(--glass);border:1px solid var(--line);animation:pulse 1s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,131,255,.0)}50%{box-shadow:0 0 26px 2px var(--accent)}}
.scan-bar{width:160px;height:5px;border-radius:999px;background:linear-gradient(90deg,transparent,var(--accent),transparent);background-size:200% 100%;animation:shimmer 1s linear infinite}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.nav-wrap{position:absolute;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;justify-content:center;z-index:20}
.nav{background:var(--glass2);backdrop-filter:blur(28px) saturate(170%);-webkit-backdrop-filter:blur(28px) saturate(170%);border:1px solid var(--line);border-radius:24px;padding:6px;box-shadow:0 20px 40px -16px rgba(0,0,0,.5);gap:4px}
.nav-item{display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--dim);padding:8px 22px;border-radius:18px;transition:.2s}
.nav-on{color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 8px 20px -8px var(--accent)}
.sheet-bg{position:absolute;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(2px)}
.th-card{display:flex;align-items:center;gap:10px;padding:12px;border-radius:16px;background:var(--glass);border:1px solid var(--line);transition:.18s}
.th-on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.th-swatch{width:26px;height:26px;border-radius:9px;box-shadow:0 4px 12px -4px rgba(0,0,0,.5)}
.pop{animation:popIn .36s cubic-bezier(.2,.85,.25,1.15) both}
@keyframes popIn{0%{transform:scale(.85) translateY(8px);opacity:0}60%{transform:scale(1.02)}100%{transform:scale(1) translateY(0);opacity:1}}
.slide-up{animation:slideUp .3s ease both}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.screen{animation:fade .28s ease both}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;animation-iteration-count:1!important}}
`;
