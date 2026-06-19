import { Check, AlertTriangle, Forward, Briefcase, Megaphone } from 'lucide-react';
import type { Category } from '../../types';

const CAT_META: Record<Category, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  clean:    { label: 'Clean',             Icon: Check          },
  abusive:  { label: 'Abusive language',  Icon: AlertTriangle  },
  spam:     { label: 'Spam / forward',    Icon: Forward        },
  business: { label: 'Business',          Icon: Briefcase      },
  promo:    { label: 'Promotion',         Icon: Megaphone      },
};

export function CategoryBadge({ category }: { category: Category }) {
  const meta = CAT_META[category] || CAT_META.clean;
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cat-${category}`}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}
