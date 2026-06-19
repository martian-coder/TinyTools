import React from 'react';

interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  children: React.ReactNode;
  radius?: number;
}

export function Glass({ strong = false, children, radius = 18, className = '', style = {}, ...props }: GlassProps) {
  return (
    <div
      className={className}
      style={{
        background: strong ? 'var(--surface-strong)' : 'var(--surface)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        border: '1px solid var(--border)',
        borderRadius: radius,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
