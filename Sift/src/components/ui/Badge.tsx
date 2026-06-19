import { CATEGORY_COLORS } from '../../theme';
import type { Category } from '../../types';

interface BadgeProps {
  category: Category;
  size?: 'sm' | 'md';
}

const LABELS: Record<Category, string> = {
  clean: 'Clean',
  abusive: 'Abusive',
  spam: 'Spam',
  business: 'Business',
  promo: 'Promo',
};

export function CategoryBadge({ category, size = 'md' }: BadgeProps) {
  const colors = CATEGORY_COLORS[category];
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: 20,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        fontSize: size === 'sm' ? 10 : 11,
        fontWeight: 600,
        letterSpacing: '0.03em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {LABELS[category]}
    </span>
  );
}

interface FolderBadgeProps {
  count: number;
  accent?: boolean;
}

export function UnreadBadge({ count, accent = false }: FolderBadgeProps) {
  if (count === 0) return null;
  return (
    <span
      style={{
        background: accent ? 'var(--accent)' : 'rgba(244,63,94,0.85)',
        color: '#fff',
        borderRadius: 10,
        padding: '1px 6px',
        fontSize: 11,
        fontWeight: 700,
        minWidth: 18,
        textAlign: 'center',
      }}
    >
      {count}
    </span>
  );
}
