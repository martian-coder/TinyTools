import type { HTMLAttributes } from 'react';

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
}

export function Glass({ strong = false, className = '', children, ...props }: GlassProps) {
  return (
    <div className={`${strong ? 'glass2' : 'glass'} ${className}`} {...props}>
      {children}
    </div>
  );
}
