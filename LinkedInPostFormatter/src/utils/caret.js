/**
 * Locates a textarea's selection in viewport coordinates.
 *
 * A textarea has no DOM Range, so its selection cannot be measured directly. The
 * standard workaround is a mirror: an offscreen div copying every property that
 * affects text layout, filled with the text preceding the selection, with the
 * selected run wrapped in a span. Measuring that span gives the selection's
 * position inside the textarea.
 *
 * Anything that changes where a glyph lands must be copied, or the mirror wraps
 * differently and the measurement drifts — that is why the list below is long.
 */
const MIRRORED = [
  'boxSizing',
  'width',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'wordSpacing',
  'whiteSpace',
  'wordWrap',
  'overflowWrap',
  'wordBreak',
  'tabSize',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
];

/**
 * Returns viewport-relative bounds of the current selection, or null when there
 * is no selection or the element is not laid out.
 */
export function measureSelection(textarea) {
  if (!textarea) return null;
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart === selectionEnd) return null;

  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  MIRRORED.forEach((prop) => {
    mirror.style[prop] = computed[prop];
  });

  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.height = 'auto';
  mirror.style.overflow = 'hidden';
  mirror.style.visibility = 'hidden';
  // A textarea always wraps and preserves whitespace regardless of its own
  // white-space value, so pin these rather than trusting the copy.
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';

  mirror.textContent = value.slice(0, selectionStart);
  const marker = document.createElement('span');
  // An empty span has no box; a zero-width space gives it a measurable line.
  marker.textContent = value.slice(selectionStart, selectionEnd) || '​';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const relativeTop = markerRect.top - mirrorRect.top;
  const relativeLeft = markerRect.left - mirrorRect.left;
  const width = markerRect.width;
  const height = markerRect.height;
  document.body.removeChild(mirror);

  const box = textarea.getBoundingClientRect();
  return {
    top: box.top + relativeTop - textarea.scrollTop,
    left: box.left + relativeLeft,
    width,
    height,
    // Callers need the textarea's own bounds to tell whether the selection has
    // been scrolled out of sight.
    hostTop: box.top,
    hostBottom: box.bottom,
  };
}

/**
 * Clamps a floating element to the viewport and flips it below the anchor when
 * there is no room above.
 */
export function placeAbove(anchor, size, { margin = 8, boundaryTop = 0 } = {}) {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  let left = anchor.left + anchor.width / 2 - size.width / 2;
  left = Math.max(margin, Math.min(left, viewportWidth - size.width - margin));

  let top = anchor.top - size.height - margin;
  let flipped = false;
  // Flip below when there is no room above — either off-screen, or intruding on
  // whatever sits above the field (a toolbar, in practice).
  if (top < Math.max(margin, boundaryTop)) {
    top = anchor.top + anchor.height + margin;
    flipped = true;
  }
  top = Math.min(top, viewportHeight - size.height - margin);

  return { top, left, flipped };
}
