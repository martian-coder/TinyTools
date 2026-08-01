import React from 'react';

/**
 * Brand mark: a bold headline bar over two lighter body lines — the silhouette of
 * a formatted post.
 *
 * Deliberately not LinkedIn's "in" wordmark. That mark is their trademark, and
 * putting it on a third-party tool implies an endorsement that does not exist.
 */
export default function Logo({ className = 'w-8 h-8' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`${className} shrink-0`}
      role="img"
      aria-label="LinkedIn Formatter"
    >
      <rect width="32" height="32" rx="8" fill="#0A66C2" />
      <rect x="8" y="9" width="16" height="4" rx="2" fill="#fff" />
      <rect x="8" y="16.5" width="12" height="2.5" rx="1.25" fill="#fff" opacity="0.72" />
      <rect x="8" y="21.5" width="8" height="2.5" rx="1.25" fill="#fff" opacity="0.5" />
    </svg>
  );
}
