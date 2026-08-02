import React, { useState } from 'react';
import { hasStyling } from '../utils/unicode.js';
import { TRUNCATE_DESKTOP, TRUNCATE_MOBILE } from '../utils/analyze.js';

const LINKABLE = /(#[^\s#]+|\bhttps?:\/\/\S+|\bwww\.\S+)/g;

/**
 * Renders the post the way LinkedIn will: hashtags and URLs turn blue only when
 * they are plain characters. A styled hashtag stays black here for the same reason
 * it stays dead on LinkedIn — the matcher never recognises it.
 */
function renderTokens(text, dark) {
  const parts = text.split(LINKABLE);
  return parts.map((part, i) => {
    if (!part) return null;
    const isLinkable = LINKABLE.test(part);
    LINKABLE.lastIndex = 0;
    if (isLinkable && !hasStyling(part)) {
      return (
        <span key={i} className={dark ? 'text-[#71B7FB]' : 'text-[#0A66C2]'} style={{ fontWeight: 600 }}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function ReactionBar({ dark }) {
  const muted = dark ? 'text-[#FFFFFF99]' : 'text-[#00000099]';
  return (
    <>
      <div className={`flex items-center justify-between text-xs ${muted} pt-2`}>
        <span>👍 💡 ❤️ 47</span>
        <span>12 comments · 3 reposts</span>
      </div>
      <div
        className={`mt-1 pt-1 border-t flex items-center justify-around text-sm font-semibold ${muted}`}
        style={{ borderColor: dark ? '#38434F' : '#E0E0E0' }}
      >
        {['Like', 'Comment', 'Repost', 'Send'].map((action) => (
          <span key={action} className="py-2">
            {action}
          </span>
        ))}
      </div>
    </>
  );
}

export default function Preview({ text, image }) {
  const [device, setDevice] = useState('mobile');
  const [dark, setDark] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const limit = device === 'mobile' ? TRUNCATE_MOBILE : TRUNCATE_DESKTOP;
  const chars = [...text];
  const isTruncated = chars.length > limit;
  const shown = expanded || !isTruncated ? text : chars.slice(0, limit).join('');

  const bg = dark ? '#1B1F23' : '#FFFFFF';
  const border = dark ? '#38434F' : '#E0E0E0';
  const primary = dark ? '#FFFFFFE6' : '#000000E6';
  const muted = dark ? '#FFFFFF99' : '#00000099';

  const control =
    'px-3 py-1 text-xs font-medium rounded-full border transition ' +
    'border-slate-300 text-slate-600 hover:border-linkedin hover:text-linkedin ' +
    'dark:border-slate-600 dark:text-slate-300';
  const controlActive = 'px-3 py-1 text-xs font-medium rounded-full border transition bg-linkedin border-linkedin text-white';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={device === 'mobile' ? controlActive : control} onClick={() => setDevice('mobile')}>
          Mobile
        </button>
        <button type="button" className={device === 'desktop' ? controlActive : control} onClick={() => setDevice('desktop')}>
          Desktop
        </button>
        <span className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
        <button type="button" className={dark ? controlActive : control} onClick={() => setDark((v) => !v)}>
          {dark ? 'Dark' : 'Light'}
        </button>
      </div>

      <div className="flex justify-center">
        <div
          className="rounded-lg border shadow-sm transition-all w-full"
          style={{
            backgroundColor: bg,
            borderColor: border,
            maxWidth: device === 'mobile' ? 360 : 555,
          }}
        >
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                style={{ backgroundColor: '#0A66C2' }}
              >
                You
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: primary }}>
                  Your Name
                </div>
                <div className="text-xs truncate" style={{ color: muted }}>
                  Your headline goes here
                </div>
                <div className="text-xs" style={{ color: muted }}>
                  now · 🌐
                </div>
              </div>
            </div>

            <div
              className="text-sm leading-[1.45] whitespace-pre-wrap break-words"
              style={{ color: primary, fontFamily: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif' }}
            >
              {text ? renderTokens(shown, dark) : (
                <span style={{ color: muted }}>Your post will appear here, exactly as LinkedIn will render it.</span>
              )}
              {isTruncated && !expanded && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="ml-1 font-medium"
                  style={{ color: muted }}
                >
                  …see more
                </button>
              )}
            </div>

            {isTruncated && expanded && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="mt-2 text-xs font-medium"
                style={{ color: muted }}
              >
                Collapse
              </button>
            )}

          </div>

          {/* LinkedIn crops very tall images in the feed rather than letting them run
              the length of the screen, so cap it and keep the preview honest. */}
          {image && (
            <img
              src={image}
              alt="Attached preview"
              className="w-full block"
              style={{
                maxHeight: 460,
                objectFit: 'cover',
                borderTop: `1px solid ${border}`,
                borderBottom: `1px solid ${border}`,
              }}
            />
          )}

          <div className="px-3 pb-3">
            {(text || image) && <ReactionBar dark={dark} />}
          </div>
        </div>
      </div>

      {isTruncated && !expanded && (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Everything after the cut is only seen by people who tap. Make the visible part earn it.
        </p>
      )}
    </div>
  );
}
