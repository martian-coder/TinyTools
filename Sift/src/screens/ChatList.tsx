import { useSiftStore, selectFolderThreads, selectReviewMessages, selectUnreadCount } from '../store';
import { Glass } from '../components/ui/Glass';
import { Avatar } from '../components/ui/Avatar';
import { CategoryBadge } from '../components/ui/Badge';
import type { Folder, Message } from '../types';

const FOLDER_TABS: { id: Folder; label: string; icon: string }[] = [
  { id: 'primary',    label: 'Primary',    icon: '💬' },
  { id: 'business',   label: 'Business',   icon: '🏢' },
  { id: 'promotions', label: 'Promos',     icon: '🎁' },
  { id: 'review',     label: 'Review',     icon: '🛡️' },
];

export function ChatList() {
  const activeFolder = useSiftStore(s => s.activeFolder);
  const setFolder = useSiftStore(s => s.setFolder);
  const contacts = useSiftStore(s => s.contacts);
  const openConversation = useSiftStore(s => s.openConversation);
  const approveMessage = useSiftStore(s => s.approveMessage);
  const rejectMessage = useSiftStore(s => s.rejectMessage);
  const clearReview = useSiftStore(s => s.clearReview);

  const threads = useSiftStore(s =>
    activeFolder !== 'review' ? selectFolderThreads(s, activeFolder) : []
  );
  const reviewMsgs = useSiftStore(s =>
    activeFolder === 'review' ? selectReviewMessages(s) : []
  );
  const counts = {
    primary:    useSiftStore(s => selectUnreadCount(s, 'primary')),
    business:   useSiftStore(s => selectUnreadCount(s, 'business')),
    promotions: useSiftStore(s => selectUnreadCount(s, 'promotions')),
    review:     useSiftStore(s => selectUnreadCount(s, 'review')),
  };

  const getContact = (id: string) => contacts.find(c => c.id === id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 8px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
              Sift
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
              Your messages, filtered
            </p>
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              boxShadow: '0 0 16px var(--accent)44',
            }}
          >
            🔮
          </div>
        </div>

        {/* Folder Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {FOLDER_TABS.map(tab => {
            const active = activeFolder === tab.id;
            const count = counts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setFolder(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '7px 14px',
                  borderRadius: 20,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: active
                    ? 'linear-gradient(135deg, var(--accent)22, var(--accent2)22)'
                    : 'var(--surface)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                {tab.label}
                {count > 0 && (
                  <span
                    style={{
                      background: tab.id === 'review' ? '#fb7185' : 'var(--accent)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: '1px 5px',
                      minWidth: 16,
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {activeFolder === 'review' ? (
          <ReviewFolder
            messages={reviewMsgs}
            contacts={contacts}
            onApprove={approveMessage}
            onReject={rejectMessage}
            onClearAll={clearReview}
          />
        ) : threads.length === 0 ? (
          <EmptyState folder={activeFolder} />
        ) : (
          threads.map(msg => {
            const contact = getContact(msg.contactId);
            if (!contact) return null;
            return (
              <Glass
                key={msg.contactId}
                onClick={() => openConversation(msg.contactId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  marginBottom: 8,
                  cursor: 'pointer',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                  animation: 'slideIn 0.3s ease both',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                }}
              >
                <Avatar name={contact.name} grad={contact.grad} trusted={contact.trusted} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15 }}>
                      {contact.name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{msg.time}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        marginRight: 8,
                      }}
                    >
                      {msg.dir === 'out' ? 'You: ' : ''}
                      {msg.text}
                    </span>
                    {msg.verdict && msg.verdict.category !== 'clean' && (
                      <CategoryBadge category={msg.verdict.category} size="sm" />
                    )}
                  </div>
                </div>
              </Glass>
            );
          })
        )}
      </div>
    </div>
  );
}

function ReviewFolder({
  messages,
  contacts,
  onApprove,
  onReject,
  onClearAll,
}: {
  messages: Message[];
  contacts: import('../types').Contact[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClearAll: () => void;
}) {
  if (messages.length === 0) {
    return <EmptyState folder="review" />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {messages.length} message{messages.length !== 1 ? 's' : ''} held for review
        </span>
        <button
          onClick={onClearAll}
          style={{
            background: 'rgba(244,63,94,0.15)',
            color: '#fb7185',
            border: '1px solid rgba(244,63,94,0.3)',
            borderRadius: 10,
            padding: '5px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Clear All
        </button>
      </div>

      {messages.map(msg => {
        const contact = contacts.find(c => c.id === msg.contactId);
        if (!contact) return null;
        return (
          <Glass key={msg.id} style={{ padding: '14px', marginBottom: 10, animation: 'slideIn 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Avatar name={contact.name} grad={contact.grad} size={36} />
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{contact.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{msg.time}</div>
              </div>
              {msg.verdict && <CategoryBadge category={msg.verdict.category} />}
            </div>

            {/* Blurred content */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 10,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <p
                style={{
                  color: 'var(--text)',
                  fontSize: 14,
                  margin: 0,
                  filter: 'blur(5px)',
                  userSelect: 'none',
                  lineHeight: 1.5,
                }}
              >
                {msg.text}
              </p>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                }}
              >
                🛡️ Content held — click Reveal to read
              </div>
            </div>

            {msg.verdict?.flaggedTerms && msg.verdict.flaggedTerms.length > 0 && (
              <div style={{ marginBottom: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {msg.verdict.flaggedTerms.map(term => (
                  <span
                    key={term}
                    style={{
                      background: 'rgba(244,63,94,0.12)',
                      color: '#fb7185',
                      border: '1px solid rgba(244,63,94,0.25)',
                      borderRadius: 6,
                      padding: '2px 7px',
                      fontSize: 11,
                    }}
                  >
                    "{term}"
                  </span>
                ))}
              </div>
            )}

            {msg.autoReply && (
              <div
                style={{
                  background: 'rgba(124,131,255,0.12)',
                  border: '1px solid rgba(124,131,255,0.25)',
                  borderRadius: 8,
                  padding: '7px 10px',
                  marginBottom: 10,
                  fontSize: 12,
                  color: 'var(--accent)',
                }}
              >
                🤖 Auto-reply sent: "This person doesn't accept messages with abusive language."
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onApprove(msg.id)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 10,
                  border: '1px solid rgba(16,185,129,0.4)',
                  background: 'rgba(16,185,129,0.15)',
                  color: '#34d399',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                ✓ Approve
              </button>
              <button
                onClick={() => onReject(msg.id)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 10,
                  border: '1px solid rgba(244,63,94,0.4)',
                  background: 'rgba(244,63,94,0.15)',
                  color: '#fb7185',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                ✕ Reject
              </button>
            </div>
          </Glass>
        );
      })}
    </div>
  );
}

function EmptyState({ folder }: { folder: Folder }) {
  const EMPTY: Record<Folder, { icon: string; text: string }> = {
    primary:    { icon: '💬', text: 'No messages yet. Say hello!' },
    business:   { icon: '🏢', text: 'Business messages will appear here.' },
    promotions: { icon: '🎁', text: 'Promotional messages land here.' },
    review:     { icon: '🛡️', text: 'No messages pending review.' },
  };
  const e = EMPTY[folder];
  return (
    <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{e.icon}</div>
      <p style={{ fontSize: 14 }}>{e.text}</p>
    </div>
  );
}
