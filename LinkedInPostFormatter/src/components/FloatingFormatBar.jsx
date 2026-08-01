import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STYLES, applyStyle } from '../utils/unicode.js';
import { measureSelection, placeAbove } from '../utils/caret.js';

// The six that carry almost all real use. The rest are one tap away.
const PRIMARY = ['bold', 'italic', 'boldItalic', 'underline', 'strikethrough', 'monospace'];

const byId = (id) => STYLES.find((s) => s.id === id);
const SECONDARY = STYLES.filter((s) => !PRIMARY.includes(s.id));

function StyleButton({ style, onApply }) {
  return (
    <button
      type="button"
      onClick={() => onApply(style.id)}
      aria-label={style.label}
      title={`${style.label} — ${style.description}`}
      className="px-2.5 py-1 rounded text-[15px] leading-none text-white/90 hover:bg-white/15
                 focus:bg-white/15 focus:outline-none transition"
    >
      {applyStyle(style.short, style.id)}
    </button>
  );
}

/**
 * Formatting toolbar that appears at the selection, the way Medium and Notion do
 * it.
 *
 * Every style needs a selection to act on, so a permanently visible row of style
 * buttons is disabled most of the time — it takes space above the editor while
 * doing nothing. Surfacing them only when they can actually be used gives the
 * writing area back and puts the controls under the cursor instead of across the
 * page.
 */
export default function FloatingFormatBar({ textareaRef, selection, onApply }) {
  const barRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [showMore, setShowMore] = useState(false);

  const active = selection.end > selection.start;

  const reposition = useCallback(() => {
    const textarea = textareaRef.current;
    const bar = barRef.current;
    if (!textarea || !bar || !active) {
      setPosition(null);
      return;
    }
    const anchor = measureSelection(textarea);
    if (!anchor) {
      setPosition(null);
      return;
    }
    // Hide when the selection has been scrolled out of the editor's viewport,
    // otherwise the bar floats detached from the text it belongs to.
    if (anchor.top < anchor.hostTop - 4 || anchor.top > anchor.hostBottom) {
      setPosition(null);
      return;
    }
    const size = { width: bar.offsetWidth, height: bar.offsetHeight };
    // Selections on the first line would otherwise push the bar over the toolbar.
    setPosition(placeAbove(anchor, size, { boundaryTop: anchor.hostTop }));
  }, [textareaRef, active]);

  useLayoutEffect(() => {
    if (!active) {
      setPosition(null);
      setShowMore(false);
      return;
    }
    reposition();
  }, [active, selection.start, selection.end, showMore, reposition]);

  useEffect(() => {
    if (!active) return undefined;
    const onChange = () => reposition();
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('resize', onChange);
    };
  }, [active, reposition]);

  if (!active) return null;

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Format selection"
      // Keeping focus in the textarea means the selection stays highlighted and
      // the caret does not jump when a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        opacity: position ? 1 : 0,
        zIndex: 50,
      }}
      className="transition-opacity duration-100 rounded-lg bg-slate-900 dark:bg-slate-700
                 shadow-xl ring-1 ring-black/20 p-1"
    >
      <div className="flex items-center gap-0.5">
        {PRIMARY.map((id) => {
          const style = byId(id);
          return style ? <StyleButton key={id} style={style} onApply={onApply} /> : null;
        })}

        <span className="w-px h-5 bg-white/20 mx-0.5" />

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-label="More styles"
          aria-expanded={showMore}
          className="px-2 py-1 rounded text-white/70 hover:bg-white/15 text-sm leading-none transition"
        >
          {showMore ? '−' : '⋯'}
        </button>

        <button
          type="button"
          onClick={() => onApply('plain')}
          aria-label="Remove formatting"
          title="Remove formatting from the selection"
          className="px-2 py-1 rounded text-white/70 hover:bg-white/15 text-xs transition"
        >
          Clear
        </button>
      </div>

      {showMore && (
        <div className="flex items-center gap-0.5 mt-1 pt-1 border-t border-white/15">
          {SECONDARY.map((style) => (
            <StyleButton key={style.id} style={style} onApply={onApply} />
          ))}
        </div>
      )}
    </div>
  );
}
