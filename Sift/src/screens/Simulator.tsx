import { useState } from 'react';
import { useSiftStore } from '../store';
import { moderate } from '../moderation/rules';
import { routeVerdict } from '../moderation/route';
import { Glass } from '../components/ui/Glass';
import { CategoryBadge } from '../components/ui/Badge';
import type { ModerationVerdict, RouteResult, Folder } from '../types';
import { CATEGORY_COLORS } from '../theme';

const FOLDER_LABELS: Record<Folder, string> = {
  primary: '💬 Primary',
  business: '🏢 Business',
  promotions: '🎁 Promotions',
  review: '🛡️ Review',
};

const QUICK_TESTS = [
  { label: '😊 Friendly', text: "Hey, are you free this weekend? Would love to catch up!" },
  { label: '🤬 Abusive',  text: "You're such an idiot and moron. Just shut up already!" },
  { label: '🏢 OTP',      text: "Your OTP is 847291. Valid for 10 minutes. Do not share." },
  { label: '🎁 Promo',    text: "MEGA SALE! 70% OFF today only! Shop now — limited stock!" },
  { label: '📨 Forward',  text: "Forwarded this message to 10 friends to get good luck! Share now!" },
  { label: '✅ Trusted',  text: "Bro you're such an idiot lol 😂 (from Rahul, trusted)" },
];

interface SimResult {
  text: string;
  verdict: ModerationVerdict;
  route: RouteResult;
  trusted: boolean;
  scanning: boolean;
}

export function Simulator() {
  const settings = useSiftStore(s => s.settings);
  const receiveMessage = useSiftStore(s => s.receiveMessage);
  const [input, setInput] = useState('');
  const [isTrusted, setIsTrusted] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [history, setHistory] = useState<SimResult[]>([]);

  const simulate = (text: string, trusted = isTrusted) => {
    if (!text.trim()) return;
    const scanning: SimResult = {
      text, verdict: { category: 'clean', confidence: 0, engine: 'rules' },
      route: { folder: 'primary', status: 'delivered' },
      trusted, scanning: true,
    };
    setResult(scanning);

    setTimeout(() => {
      const verdict = moderate(text, settings);
      const route = routeVerdict(verdict, settings, trusted);
      const final: SimResult = { text, verdict, route, trusted, scanning: false };
      setResult(final);
      setHistory(h => [final, ...h.slice(0, 9)]);

      // Actually inject into the store
      receiveMessage('c1', text, route, verdict);
    }, 1200);
  };

  const handleSend = () => {
    simulate(input);
    setInput('');
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '16px 16px 100px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0 }}>
            Filter Simulator
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Type a message and watch the filter decide in real-time
          </p>
        </div>

        {/* Quick tests */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Quick Tests
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_TESTS.map(q => (
              <button
                key={q.label}
                onClick={() => {
                  const trusted = q.label === '✅ Trusted';
                  simulate(q.text, trusted);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <Glass style={{ padding: '14px', marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Message
            </label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message as if an incoming sender…"
              rows={3}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <div
                onClick={() => setIsTrusted(!isTrusted)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: '2px solid var(--border)',
                  background: isTrusted ? 'linear-gradient(135deg,#34d399,#06b6d4)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: '#fff',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {isTrusted ? '✓' : ''}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Trusted sender</span>
            </label>

            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                padding: '9px 20px',
                borderRadius: 20,
                border: 'none',
                background: input.trim()
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'var(--surface-strong)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                boxShadow: input.trim() ? '0 0 16px var(--accent)44' : 'none',
              }}
            >
              Receive →
            </button>
          </div>
        </Glass>

        {/* Result */}
        {result && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Verdict
            </div>
            <Glass strong style={{ padding: '16px', animation: 'slideIn 0.3s ease both' }}>
              {result.scanning ? (
                <ScanAnimation />
              ) : (
                <VerdictDisplay result={result} />
              )}
            </Glass>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              History
            </div>
            {history.map((h, i) => (
              <Glass key={i} style={{ padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <CategoryBadge category={h.verdict.category} size="sm" />
                <span style={{ color: 'var(--text)', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.text}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                  {FOLDER_LABELS[h.route.folder]}
                </span>
              </Glass>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScanAnimation() {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: 36, marginBottom: 12, animation: 'pulse 0.8s ease-in-out infinite' }}>🔒</div>
      <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
        Checking on your device…
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
        On-device filter running privately
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--surface-strong)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            borderRadius: 2,
            animation: 'scanBar 1.2s ease-in-out',
          }}
        />
      </div>
    </div>
  );
}

function VerdictDisplay({ result }: { result: SimResult }) {
  const { verdict, route, trusted } = result;
  const cat = verdict.category;
  const colors = CATEGORY_COLORS[cat];

  return (
    <div>
      {/* Category + engine chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <CategoryBadge category={cat} />
        <span
          style={{
            background: 'rgba(124,131,255,0.15)',
            color: 'var(--accent)',
            border: '1px solid rgba(124,131,255,0.25)',
            borderRadius: 20,
            padding: '2px 9px',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          🔒 on-device
        </span>
        {trusted && (
          <span style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 600 }}>
            ✓ trusted
          </span>
        )}
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Confidence</span>
          <span style={{ color: colors.text, fontSize: 11, fontWeight: 600 }}>{Math.round(verdict.confidence * 100)}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--surface-strong)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${verdict.confidence * 100}%`,
              background: `linear-gradient(90deg, ${colors.text}88, ${colors.text})`,
              borderRadius: 3,
              transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
              animation: 'confBar 0.8s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          />
        </div>
      </div>

      {/* Routed to */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Routed to</span>
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
          {FOLDER_LABELS[route.folder]}
        </span>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: route.autoReply ? 10 : 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Status</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: route.status === 'delivered' ? '#34d399' :
                   route.status === 'held' ? '#fbbf24' :
                   route.status === 'dropped' ? '#fb7185' : 'var(--text)',
          }}
        >
          {route.status === 'delivered' ? '✓ Delivered' :
           route.status === 'held' ? '⏸ Held for review' :
           route.status === 'dropped' ? '✕ Silently dropped' : route.status}
        </span>
      </div>

      {route.autoReply && (
        <div
          style={{
            background: 'rgba(124,131,255,0.12)',
            border: '1px solid rgba(124,131,255,0.25)',
            borderRadius: 10,
            padding: '10px 12px',
            marginTop: 10,
          }}
        >
          <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            🤖 AUTO-REPLY SENT
          </div>
          <div style={{ color: 'var(--text)', fontSize: 13 }}>
            This person doesn't accept messages with abusive language.
          </div>
        </div>
      )}

      {verdict.reason && (
        <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
          {verdict.reason}
        </div>
      )}
    </div>
  );
}
