import { ShieldCheck, Inbox, Briefcase, Megaphone, Check, X, Eye, Forward, ChevronRight, AlertTriangle, UserCheck } from 'lucide-react';
import { useSiftStore } from '../store';
import { Avatar } from '../components/ui/Avatar';
import { CategoryBadge } from '../components/ui/Badge';
import type { Folder, Contact, Message } from '../types';
import { explainHold } from '../moderation/insights';

const FOLDERS: { id: Folder; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'primary',    label: 'Primary',    Icon: Inbox      },
  { id: 'business',   label: 'Business',   Icon: Briefcase  },
  { id: 'promotions', label: 'Promotions', Icon: Megaphone  },
  { id: 'review',     label: 'Review',     Icon: ShieldCheck },
];

export function ChatList() {
  const messages          = useSiftStore(s => s.messages);
  const contacts          = useSiftStore(s => s.contacts);
  const activeFolder      = useSiftStore(s => s.activeFolder);
  const setFolder         = useSiftStore(s => s.setFolder);
  const openConversation  = useSiftStore(s => s.openConversation);
  const approveMessage    = useSiftStore(s => s.approveMessage);
  const rejectMessage     = useSiftStore(s => s.rejectMessage);

  const reviewCount = messages.filter(m => m.status === 'held').length;

  const cById = (id: string) => contacts.find(c => c.id === id);

  // Threads: unique contact IDs with at least one delivered in-message in this folder
  const threads = (() => {
    const ids = [...new Set(
      messages.filter(m => m.dir === 'in' && m.status === 'delivered' && m.folder === activeFolder)
              .map(m => m.contactId)
    )];
    return ids.map(id => {
      const cm = messages.filter(m => m.contactId === id);
      const last = [...cm].reverse().find(m => m.status === 'delivered' || m.dir === 'out');
      return { id, c: cById(id), last };
    });
  })();

  const held    = messages.filter(m => m.status === 'held');
  const dropped = messages.filter(m => m.status === 'dropped');

  const revealed    = useSiftStore(s => s.revealed);
  const setRevealed = useSiftStore(s => s.setRevealed);

  return (
    <>
      {/* Folder pills */}
      <div className="px-3 py-2 flex gap-2 overflow-x-auto no-bar">
        {FOLDERS.map(f => {
          const active = activeFolder === f.id;
          return (
            <button key={f.id} onClick={() => setFolder(f.id)} className={`pill ${active ? 'pill-on' : ''}`}>
              <f.Icon size={13} /> {f.label}
              {f.id === 'review' && reviewCount > 0 && <span className="rev-dot">{reviewCount}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-28 no-bar">
        {activeFolder === 'review' ? (
          <ReviewFolder held={held} dropped={dropped} contacts={contacts} revealed={revealed} setRevealed={setRevealed} onApprove={approveMessage} onReject={rejectMessage} />
        ) : threads.length === 0 ? (
          <EmptyState icon={Inbox} title="Nothing here yet" body="Messages sorted to this folder land here. Try the Test tab." />
        ) : (
          <div className="space-y-2 pt-1">
            {threads.map(({ id, c, last }, i) => (
              <button
                key={id}
                onClick={() => openConversation(id)}
                className="row glass w-full flex items-center gap-3 p-3 text-left pop"
                style={{ animationDelay: `${i * 40}ms`, borderRadius: 18 }}
              >
                <Avatar name={c?.name || '?'} grad={c?.grad || ''} size={44} trusted={c?.trusted} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-semibold text-main truncate">{c?.name}</span>
                    <span className="text-[11px] dim shrink-0">{last?.time}</span>
                  </div>
                  <div className="text-sm dim truncate">{last?.text}</div>
                </div>
                <ChevronRight size={16} className="dim shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ReviewFolder({
  held, dropped, contacts, revealed, setRevealed, onApprove, onReject
}: {
  held: Message[]; dropped: Message[]; contacts: Contact[];
  revealed: Record<string, boolean>; setRevealed: (id: string) => void;
  onApprove: (id: string) => void; onReject: (id: string) => void;
}) {
  const cById = (id: string) => contacts.find(c => c.id === id);
  const settings = useSiftStore(s => s.settings);
  const setContactTrusted = useSiftStore(s => s.setContactTrusted);

  if (held.length === 0 && dropped.length === 0)
    return <EmptyState icon={ShieldCheck} title="All clear" body="No filtered messages need your attention." />;

  return (
    <div className="space-y-3 pt-1">
      {held.map((m, i) => (
        <div key={m.id} className="glass p-3 pop" style={{ borderRadius: 20, animationDelay: `${i * 50}ms` }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Avatar name={cById(m.contactId)?.name || '?'} grad={cById(m.contactId)?.grad || ''} size={30} />
              <span className="text-sm font-medium text-main">{cById(m.contactId)?.name}</span>
            </div>
            <CategoryBadge category={m.verdict?.category || 'clean'} />
          </div>

          {/* Blurred message */}
          <div className="relative mb-2">
            <p
              className={`text-sm text-main p-3 ${revealed[m.id] ? '' : 'blur-md select-none'}`}
              style={{ background: 'var(--in)', borderRadius: 14, transition: 'filter .4s ease' }}
            >
              {m.text}
            </p>
            {!revealed[m.id] && (
              <button
                onClick={() => setRevealed(m.id)}
                className="absolute inset-0 grid place-items-center text-xs font-semibold text-main"
              >
                <span className="glass2 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Eye size={13} /> Hidden — tap to reveal
                </span>
              </button>
            )}
          </div>

          {/* Why it was held — the filter is never a black box */}
          {(() => {
            const { why, tip } = explainHold(m);
            return (
              <div className="mb-2.5 p-2.5" style={{ background: 'var(--glass)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <p className="text-[11px] text-main flex items-start gap-1.5">
                  <ShieldCheck size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span><span className="font-semibold">Why held:</span> {why}</span>
                </p>
                {tip && (
                  <p className="text-[11px] mt-1.5 flex items-start gap-1.5" style={{ color: '#fbbf24' }}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </p>
                )}
              </div>
            );
          })()}

          <p className="text-[11px] dim mb-2.5 flex items-start gap-1.5">
            <Forward size={12} className="mt-0.5 shrink-0" />
            Sender sees "Under review"{m.autoReply ? ` · filter set to ${settings.civility.sensitivity}` : ''}.
          </p>

          <div className="flex gap-2">
            <button onClick={() => onApprove(m.id)} className="act act-ok"><Check size={15} /> Let through</button>
            <button onClick={() => onReject(m.id)}  className="act act-no"><X    size={15} /> Reject</button>
            <button
              onClick={() => { setContactTrusted(m.contactId, true); onApprove(m.id); }}
              className="act"
              style={{ background: 'rgba(124,131,255,0.14)', border: '1px solid rgba(124,131,255,0.35)', color: 'var(--accent)' }}
            >
              <UserCheck size={15} /> Trust sender
            </button>
          </div>
        </div>
      ))}

      {dropped.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide dim px-1 mb-1.5">
            Silently dropped · hidden in real use
          </div>
          {dropped.map(m => (
            <div key={m.id} className="glass p-3 mb-2 opacity-60" style={{ borderRadius: 18 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs dim">{contacts.find(c => c.id === m.contactId)?.name}</span>
                <CategoryBadge category={m.verdict?.category || 'spam'} />
              </div>
              <p className="text-sm dim line-through">{m.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <div className="glass grid place-items-center mb-3" style={{ width: 62, height: 62, borderRadius: 20 }}>
        <Icon size={26} className="dim" />
      </div>
      <div className="font-semibold text-main">{title}</div>
      <div className="text-sm dim mt-1">{body}</div>
    </div>
  );
}
