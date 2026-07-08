import { useState } from 'react';
import { ShieldCheck, Sparkles, Lock, ChevronRight, Check, Clock, Ban } from 'lucide-react';
import { useSiftStore } from '../store';
import { getModerator, routeVerdict, ENGINE_LABELS } from '../moderation';
import { Switch } from '../components/ui/Switch';
import { CategoryBadge } from '../components/ui/Badge';
import type { ModerationVerdict, RouteResult, Folder } from '../types';

const FOLDER_LABELS: Record<Folder, string> = {
  primary:    'Primary',
  business:   'Business',
  promotions: 'Promotions',
  review:     'Review',
};

const EXAMPLES = [
  { l: 'Friendly',  t: "Hey, lunch tomorrow?" },
  { l: 'Abusive',   t: "you're an idiot, I hate you" },
  { l: 'Forward',   t: "Forward this to 10 friends for good luck! 🔥🔥🔥" },
  { l: 'Business',  t: "Your order #5510 is out for delivery, OTP 4471" },
  { l: 'Promo',     t: "Flash sale! 40% off, limited time offer" },
];

interface SimResult {
  v: ModerationVerdict;
  r: RouteResult;
  text: string;
}

function destLabel(r: RouteResult) {
  if (r.status === 'dropped')
    return r.autoReply ? 'Blocked · auto-rejected' : 'Silently dropped';
  if (r.status === 'held')
    return 'Held in Review · blurred until you reveal it';
  return 'Delivered to ' + FOLDER_LABELS[r.folder];
}

function senderStatus(r: RouteResult, sensitivity: string): { label: string; sub: string; Icon: React.ComponentType<{ size?: number }> } {
  if (r.status === 'held')
    return { label: 'Under review', sub: "The recipient's filter is holding this for review.", Icon: Clock };
  if (r.status === 'dropped' && r.autoReply)
    return { label: 'Auto-rejected', sub: `Recipient's civility filter (${sensitivity} sensitivity) wouldn't accept this.`, Icon: Ban };
  return { label: 'Delivered', sub: '', Icon: Check };
}

export function Simulator() {
  const settings  = useSiftStore(s => s.settings);
  const contacts  = useSiftStore(s => s.contacts);
  const checkAndReceiveMsg = useSiftStore(s => s.checkAndReceiveMessage);
  const setBanner = useSiftStore(s => s.setBanner);
  const setScreen = useSiftStore(s => s.setScreen);
  const setFolder = useSiftStore(s => s.setFolder);

  const [tName,    setTName]    = useState('New number');
  const [tTrusted, setTTrusted] = useState(false);
  const [tText,    setTText]    = useState('');
  const [tResult,  setTResult]  = useState<SimResult | null>(null);
  const [tScan,    setTScan]    = useState(false);

  const cById = (id: string) => contacts.find(c => c.id === id);

  const receive = async () => {
    if (!tText.trim() || tScan) return;
    const txt = tText.trim();
    setTScan(true); setTResult(null);

    // Classification runs entirely on-device (Moderator.classify). The minimum
    // delay keeps the "Checking on your device…" scan animation legible even
    // when the verdict comes back instantly.
    const minDelay = new Promise<void>(res => setTimeout(res, 750));
    const classify = getModerator().then(m =>
      m.classify(txt, { sensitivity: settings.civility.sensitivity })
    );
    const [v] = await Promise.all([classify, minDelay]);

    const cid = (tName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'newnumber');
    const existingContact = cById(cid);
    const circleAllowed = existingContact?.circle === 'family' || existingContact?.circle === 'vip';
    const r = routeVerdict(v, settings, tTrusted, existingContact?.isEmergency ?? false, circleAllowed);

    useSiftStore.setState(s => {
      const contacts = cById(cid)
        ? s.contacts
        : [...s.contacts, {
            id: cid,
            name: tName.trim() || 'New number',
            trusted: tTrusted,
            grad: `linear-gradient(135deg,#94a3b8,#64748b)`,
          }];
      return { contacts };
    });

    const apiKey = settings.aiReplies?.anthropicKey ?? '';
    // Dynamic rules ("no rants today") can escalate the route — display the
    // route the message actually took, not the pre-rule one.
    const finalRoute = await checkAndReceiveMsg(cid, txt, r, v, apiKey);
    setTResult({ v, r: finalRoute, text: txt }); setTScan(false);
    if (finalRoute.ask) setBanner('A message was filtered — review it.');
  };

  const st = tResult ? senderStatus(tResult.r, settings.civility.sensitivity) : null;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pb-28 no-bar space-y-4 pt-3">
        {/* Quick examples */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map(e => (
            <button key={e.l} onClick={() => setTText(e.t)} className="chip text-xs px-3 py-1.5 rounded-full">
              {e.l}
            </button>
          ))}
        </div>

        {/* From field */}
        <div>
          <label className="text-xs font-medium dim">From</label>
          <input
            value={tName}
            onChange={e => setTName(e.target.value)}
            className="inp w-full mt-1.5 px-3.5 py-2.5 text-sm"
          />
        </div>

        {/* Message textarea */}
        <div>
          <label className="text-xs font-medium dim">Message</label>
          <textarea
            value={tText}
            onChange={e => setTText(e.target.value)}
            rows={3}
            placeholder="Type a message as if it's coming in…"
            className="inp w-full mt-1.5 px-3.5 py-2.5 text-sm resize-none"
          />
        </div>

        {/* Trusted toggle */}
        <label className="flex items-center justify-between text-sm text-main">
          <span className="flex items-center gap-2">
            <ShieldCheck size={15} className="accent-t" /> Sender is a trusted contact
          </span>
          <Switch on={tTrusted} onClick={() => setTTrusted(t => !t)} />
        </label>

        {/* Receive button */}
        <button onClick={receive} className="btn-accent w-full py-3.5 font-semibold flex items-center justify-center gap-2">
          <Sparkles size={16} /> Receive message
        </button>

        {/* Scanning state */}
        {tScan && (
          <div className="glass p-5 pop flex flex-col items-center text-center" style={{ borderRadius: 22 }}>
            <div className="scan-ring grid place-items-center mb-3" style={{ width: 56, height: 56, borderRadius: 999 }}>
              <Lock size={22} className="text-main" />
            </div>
            <div className="text-sm font-medium text-main">Checking on your device…</div>
            <div className="scan-bar mt-3" />
          </div>
        )}

        {/* Result card */}
        {tResult && !tScan && (() => {
          const { v, r, text } = tResult;
          const SI = st!.Icon;
          return (
            <div className="glass p-4 pop" style={{ borderRadius: 22 }}>
              {/* Badge + on-device chip */}
              <div className="flex items-center justify-between mb-3">
                <CategoryBadge category={v.category} />
                <span className="onchip"><Lock size={10} /> {ENGINE_LABELS[v.engine]}</span>
              </div>

              {/* Confidence bar */}
              <div className="bar mb-3">
                <div className="bar-fill" style={{ width: `${Math.round((v.confidence || .9) * 100)}%` }} />
              </div>

              {/* Flagged terms (rules) or model reason */}
              {v.flaggedTerms && v.flaggedTerms.length > 0 ? (
                <div className="text-xs dim mb-3">
                  Triggered by: {v.flaggedTerms.map(w => `"${w}"`).join(', ')}
                </div>
              ) : v.reason ? (
                <div className="text-xs dim mb-3">{v.reason}</div>
              ) : null}

              {/* Recipient's view */}
              <div className="text-[11px] uppercase tracking-wide dim mb-1">On your phone (recipient)</div>
              <div className="flex items-center gap-2 text-sm font-medium text-main mb-3">
                <ChevronRight size={15} className="accent-t" /> {destLabel(r)}
              </div>

              {/* Sender's view */}
              <div className="text-[11px] uppercase tracking-wide dim mb-2">What the sender sees</div>
              <div className="flex justify-end">
                <div
                  className="bubble-out max-w-[80%] px-3.5 py-2 text-sm"
                  style={{ borderRadius: 18, borderBottomRightRadius: 6 }}
                >
                  {text}
                  <div className="flex items-center gap-1 justify-end mt-1 text-[10px] out-time">
                    <SI size={11} /> {st!.label}
                  </div>
                </div>
              </div>
              {st!.sub && <div className="text-[11px] dim mt-1.5 text-right">{st!.sub}</div>}

              {/* Jump to folder */}
              {r.status !== 'dropped' && (
                <button
                  onClick={() => {
                    setScreen('chats');
                    setFolder(r.status === 'held' ? 'review' : r.folder);
                  }}
                  className="mt-3 text-xs accent-t font-semibold block"
                >
                  Open the {r.status === 'held' ? 'Review' : FOLDER_LABELS[r.folder]} folder →
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </>
  );
}
