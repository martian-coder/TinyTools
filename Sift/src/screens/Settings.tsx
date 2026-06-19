import React from 'react';
import { useSiftStore } from '../store';
import { Glass } from '../components/ui/Glass';
import { Switch } from '../components/ui/Switch';
import { Segment } from '../components/ui/Segment';
import { Avatar } from '../components/ui/Avatar';
import type { ThemeName } from '../types';
import { THEMES } from '../theme';

const THEMES_LIST: { id: ThemeName; label: string; emoji: string }[] = [
  { id: 'aurora',   label: 'Aurora',   emoji: '🌌' },
  { id: 'sunset',   label: 'Sunset',   emoji: '🌅' },
  { id: 'noir',     label: 'Noir',     emoji: '🖤' },
  { id: 'daylight', label: 'Daylight', emoji: '☀️' },
];

export function Settings() {
  const settings = useSiftStore(s => s.settings);
  const contacts = useSiftStore(s => s.contacts);
  const updateCivility = useSiftStore(s => s.updateCivility);
  const updateSpam = useSiftStore(s => s.updateSpam);
  const updateBusiness = useSiftStore(s => s.updateBusiness);
  const updateSettings = useSiftStore(s => s.updateSettings);
  const toggleTrusted = useSiftStore(s => s.toggleTrusted);
  const resetToSeed = useSiftStore(s => s.resetToSeed);

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '16px 16px 100px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <h2 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Settings</h2>

        {/* Theme */}
        <SectionLabel>Appearance</SectionLabel>
        <Glass style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Theme</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {THEMES_LIST.map(t => (
              <button
                key={t.id}
                onClick={() => updateSettings({ theme: t.id })}
                style={{
                  padding: '10px',
                  borderRadius: 12,
                  border: settings.theme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: settings.theme === t.id ? 'rgba(var(--accent),0.1)' : THEMES[t.id].surface,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease',
                  backgroundColor: settings.theme === t.id
                    ? THEMES[t.id].surface
                    : THEMES[t.id].surface,
                }}
              >
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${THEMES[t.id].accent}, ${THEMES[t.id].accent2})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                }}>
                  {t.emoji}
                </span>
                <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: settings.theme === t.id ? 600 : 400 }}>
                  {t.label}
                </span>
                {settings.theme === t.id && (
                  <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 14 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </Glass>

        {/* Civility Filter */}
        <SectionLabel>Civility Filter</SectionLabel>
        <Glass style={{ padding: '16px', marginBottom: 12 }}>
          <Row>
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Block Abusive Language</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Filter messages with foul or harmful content</div>
            </div>
            <Switch
              checked={settings.civility.enabled}
              onChange={v => updateCivility({ enabled: v })}
            />
          </Row>
          {settings.civility.enabled && (
            <>
              <Divider />
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: 'var(--text)', fontSize: 13, marginBottom: 8 }}>Sensitivity</div>
                <Segment
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                  ]}
                  value={settings.civility.sensitivity}
                  onChange={v => updateCivility({ sensitivity: v })}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: 'var(--text)', fontSize: 13, marginBottom: 8 }}>When blocked</div>
                <Segment
                  options={[
                    { value: 'review', label: 'Review' },
                    { value: 'silentDrop', label: 'Silent Drop' },
                    { value: 'askPerMessage', label: 'Ask Me' },
                  ]}
                  value={settings.civility.onBlock}
                  onChange={v => updateCivility({ onBlock: v })}
                />
              </div>
              <Row>
                <div>
                  <div style={{ color: 'var(--text)', fontSize: 13 }}>Notify Sender</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Auto-reply to blocked messages</div>
                </div>
                <Switch
                  checked={settings.civility.notifySender}
                  onChange={v => updateCivility({ notifySender: v })}
                />
              </Row>
            </>
          )}
        </Glass>

        {/* Business Sorting */}
        <SectionLabel>Business Sorting</SectionLabel>
        <Glass style={{ padding: '16px', marginBottom: 12 }}>
          <Row>
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Sort Business Messages</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>OTPs, invoices, delivery updates → Business folder</div>
            </div>
            <Switch
              checked={settings.business.enabled}
              onChange={v => updateBusiness({ enabled: v })}
            />
          </Row>
        </Glass>

        {/* Spam Filter */}
        <SectionLabel>Spam & Forwards</SectionLabel>
        <Glass style={{ padding: '16px', marginBottom: 12 }}>
          <Row>
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Block Spam & Forwards</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chain messages, unsolicited forwards</div>
            </div>
            <Switch
              checked={settings.spam.enabled}
              onChange={v => updateSpam({ enabled: v })}
            />
          </Row>
          {settings.spam.enabled && (
            <>
              <Divider />
              <div>
                <div style={{ color: 'var(--text)', fontSize: 13, marginBottom: 8 }}>When blocked</div>
                <Segment
                  options={[
                    { value: 'review', label: 'Review' },
                    { value: 'silentDrop', label: 'Silent Drop' },
                  ]}
                  value={settings.spam.onBlock}
                  onChange={v => updateSpam({ onBlock: v })}
                />
              </div>
            </>
          )}
        </Glass>

        {/* Trusted Contacts */}
        <SectionLabel>Trusted Contacts</SectionLabel>
        <Glass style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
            Trusted contacts bypass all filters
          </div>
          {contacts.map(c => (
            <Row key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={c.name} grad={c.grad} size={34} />
                <div style={{ color: 'var(--text)', fontSize: 14 }}>{c.name}</div>
              </div>
              <Switch
                checked={settings.trustedIds.includes(c.id)}
                onChange={() => toggleTrusted(c.id)}
              />
            </Row>
          ))}
        </Glass>

        {/* Reset */}
        <Glass style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Reset Demo</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
            Restore all seed data and settings to default
          </div>
          <button
            onClick={resetToSeed}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              border: '1px solid rgba(244,63,94,0.4)',
              background: 'rgba(244,63,94,0.12)',
              color: '#fb7185',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Reset to Demo Data
          </button>
        </Glass>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, marginTop: 4, paddingLeft: 4 }}>
      {children}
    </div>
  );
}

function Row({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, ...style }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />;
}
