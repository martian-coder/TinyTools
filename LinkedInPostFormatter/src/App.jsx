import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Ribbon from './components/Ribbon';
import Preview from './components/Preview';
import Insights from './components/Insights';
import TemplateGallery from './components/TemplateGallery';
import BlockComposer from './components/BlockComposer';
import About from './components/About';
import Logo from './components/Logo';
import EmailCapture from './components/EmailCapture';
import AccountPanel from './components/AccountPanel';
import { applyStyle, stripStyle } from './utils/unicode.js';
import { analyze, fixSpacing } from './utils/analyze.js';
import { compileBlocks, starterBlocks } from './utils/blocks.js';
import { lineRange, toggleList } from './utils/lists.js';
import { useI18n, LANGUAGES } from './i18n/index.js';

const DRAFT_KEY = 'lpf.draft';
const DRAFTS_KEY = 'lpf.drafts';
const THEME_KEY = 'lpf.theme';
const MODE_KEY = 'lpf.mode';
const BLOCKS_KEY = 'lpf.blocks';
const IDENTITY_KEY = 'lpf.identity';

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) || '');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState('preview');
  const [drafts, setDrafts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');
  // Preview-only, and intentionally not persisted — see the note in Ribbon.
  const [previewImage, setPreviewImage] = useState(null);
  const [identity, setIdentity] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
      return saved && typeof saved === 'object'
        ? { name: '', headline: '', avatar: null, ...saved }
        : { name: '', headline: '', avatar: null };
    } catch {
      return { name: '', headline: '', avatar: null };
    }
  });
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || 'write');
  const [blocks, setBlocks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(BLOCKS_KEY) || 'null');
      return Array.isArray(saved) && saved.length ? saved : starterBlocks();
    } catch {
      return starterBlocks();
    }
  });

  const textareaRef = useRef(null);
  const history = useRef({ past: [], future: [], lastPush: 0 });
  const [histTick, setHistTick] = useState(0);

  /**
   * Records a snapshot. Consecutive keystrokes coalesce into one entry so undo
   * steps back by a phrase rather than a character.
   */
  const pushHistory = useCallback((snapshot, coalesce) => {
    const h = history.current;
    const now = Date.now();
    const isRun = coalesce && h.past.length > 0 && now - h.lastPush < 700;
    if (!isRun) {
      h.past.push(snapshot);
      if (h.past.length > 120) h.past.shift();
    }
    h.lastPush = now;
    h.future.length = 0;
    setHistTick((t) => t + 1);
  }, []);

  const undo = useCallback(() => {
    const h = history.current;
    if (!h.past.length) return;
    h.future.push(text);
    const previous = h.past.pop();
    h.lastPush = 0;
    setText(previous);
    setHistTick((t) => t + 1);
  }, [text]);

  const redo = useCallback(() => {
    const h = history.current;
    if (!h.future.length) return;
    h.past.push(text);
    const next = h.future.pop();
    h.lastPush = 0;
    setText(next);
    setHistTick((t) => t + 1);
  }, [text]);

  const { canUndo, canRedo } = useMemo(
    () => ({ canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0 }),
    [histTick]
  );

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, text);
  }, [text]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } catch {
      // A quota failure here must not take down the editor; the avatar is
      // already downscaled, so this only trips if storage is near full.
    }
  }, [identity]);

  useEffect(() => {
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
  }, [blocks]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  // In build mode the blocks are the source of truth and the freeform text is
  // ignored, so everything downstream — preview, checks, copy — reads activeText.
  const blockText = useMemo(() => compileBlocks(blocks), [blocks]);
  const activeText = mode === 'write' ? text : blockText;

  const result = useMemo(() => analyze(activeText), [activeText]);
  const hasSelection = selection.end > selection.start;

  const syncSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) setSelection({ start: ta.selectionStart, end: ta.selectionEnd });
  }, []);

  /**
   * React's onSelect misses selections that end outside the textarea — the most
   * ordinary case being a mouse drag released over the page. The document-level
   * selectionchange event fires for every one of them, so it is the reliable
   * source of truth for whether anything is selected.
   */
  useEffect(() => {
    const onSelectionChange = () => {
      const ta = textareaRef.current;
      if (ta && document.activeElement === ta) {
        setSelection({ start: ta.selectionStart, end: ta.selectionEnd });
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  /** Replaces a range and restores the caret, so styling never loses the user's place. */
  const replaceRange = useCallback((start, end, replacement) => {
    pushHistory(text, false);
    setText(text.slice(0, start) + replacement + text.slice(end));
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const caret = start + replacement.length;
      ta.setSelectionRange(start, caret);
      setSelection({ start, end: caret });
    });
  }, [text, pushHistory]);

  const handleApply = useCallback(
    (style) => {
      const { start, end } = selection;
      if (start === end) return;
      const selected = text.slice(start, end);
      // Strip first so switching bold -> italic replaces the style rather than
      // trying to layer one transformation on top of another.
      const styled = applyStyle(stripStyle(selected), style);
      replaceRange(start, end, styled);
    },
    [selection, text, replaceRange]
  );

  const handleInsert = useCallback(
    (snippet) => {
      const { start, end } = selection;
      replaceRange(start, end, snippet);
    },
    [selection, replaceRange]
  );

  const handleToggleList = useCallback(
    (kind) => {
      const { from, to } = lineRange(text, selection.start, selection.end);
      const block = text.slice(from, to);
      const next = toggleList(block, kind);
      if (next !== block) replaceRange(from, to, next);
    },
    [text, selection, replaceRange]
  );

  const handleFixSpacing = useCallback(() => {
    pushHistory(text, false);
    setText(fixSpacing(text));
  }, [text, pushHistory]);

  const handleClear = useCallback(() => {
    if (text && !window.confirm('Clear the whole post?')) return;
    pushHistory(text, false);
    setText('');
    setSelection({ start: 0, end: 0 });
  }, [text, pushHistory]);

  /**
   * Writes plain text only. This is the whole trick: the styling lives in the
   * characters themselves, so there is no HTML for LinkedIn to strip on paste —
   * which is exactly why rich-text copied from a document falls apart and this doesn't.
   */
  const handleCopy = useCallback(async () => {
    if (!activeText) return;
    try {
      await navigator.clipboard.writeText(activeText);
    } catch {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.select();
        document.execCommand('copy');
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeText]);

  const handleSaveDraft = useCallback(() => {
    if (!activeText.trim()) return;
    const name = window.prompt('Name this draft:', activeText.slice(0, 40).replace(/\n/g, ' '));
    if (!name) return;
    setDrafts((current) => {
      const next = [
        { id: Date.now(), name, text: activeText, savedAt: Date.now() },
        ...current,
      ].slice(0, 20);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      return next;
    });
  }, [activeText]);

  const handleDeleteDraft = useCallback((id) => {
    setDrafts((current) => {
      const next = current.filter((d) => d.id !== id);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const loadInto = useCallback(
    (body) => {
      if (text.trim() && !window.confirm('Replace what you have written?')) return;
      setText(body);
      setMode('write');
      setTab('preview');
    },
    [text]
  );

  /** Compiles the blocks into the freeform editor so they can be styled. */
  const sendBlocksToEditor = useCallback(() => {
    if (!blockText.trim()) return;
    if (text.trim() && !window.confirm('Replace what is in the editor?')) return;
    setText(blockText);
    setMode('write');
  }, [text, blockText]);

  /** The shortcuts people already have in their fingers from every other editor. */
  const handleKeyDown = useCallback(
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      const shortcuts = { b: 'bold', i: 'italic', u: 'underline' };
      if (shortcuts[key]) {
        e.preventDefault();
        handleApply(shortcuts[key]);
      } else if (key === 'z' && !e.shiftKey) {
        // Our own history replaces the browser's, which cannot see programmatic edits.
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    },
    [handleApply, undo, redo]
  );

  const errorCount = result.findings.filter((f) => f.severity === 'error').length;

  const modeClass = (isActive) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition ${
      isActive
        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  const tabClass = (id) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition ${
      tab === id
        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-0 sm:h-14 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-2 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo />
            <div className="min-w-0 leading-tight">
              <h1 className="font-semibold sm:truncate text-[15px] sm:text-base">
                LinkedIn Formatter
                <span className="hidden sm:inline font-normal text-slate-500 dark:text-slate-400">
                  {' '}— {t('app.tagline')}
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 sm:truncate">
                {t('app.developedBy')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label={t('lang.label')}
              title={t('lang.note')}
              className="px-2 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600
                         bg-transparent hover:border-linkedin transition cursor-pointer
                         dark:bg-slate-800"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.native}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDark((v) => !v)}
              className="px-2.5 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:border-linkedin transition"
              aria-label={t('header.theme')}
            >
              {dark ? '☀' : '☾'}
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!activeText.trim()}
              className="px-2.5 sm:px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:border-linkedin transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('header.save')}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!activeText}
              className="px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md bg-linkedin text-white hover:bg-linkedin-dark transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? t('header.copied') : (
                <>
                  <span className="sm:hidden">{t('header.copyShort')}</span>
                  <span className="hidden sm:inline">{t('header.copy')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 grid lg:grid-cols-2 gap-5 items-start">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="flex items-center gap-3 px-3 pt-3">
            <div className="inline-flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              <button type="button" className={modeClass(mode === 'write')} onClick={() => setMode('write')}>
                {t('mode.write')}
              </button>
              <button type="button" className={modeClass(mode === 'build')} onClick={() => setMode('build')}>
                {t('mode.build')}
              </button>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'write' ? t('mode.writeHint') : t('mode.buildHint')}
            </span>
          </div>

          {mode === 'write' ? (
            <>
              <Ribbon
                onApply={handleApply}
                onToggleList={handleToggleList}
                onInsert={handleInsert}
                onFixSpacing={handleFixSpacing}
                onClear={handleClear}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                hasSelection={hasSelection}
                hasText={text.length > 0}
                used={result.counts.utf16}
                onImage={setPreviewImage}
                onRemoveImage={() => setPreviewImage(null)}
                hasImage={Boolean(previewImage)}
              />
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  pushHistory(text, true);
                  setText(e.target.value);
                  syncSelection();
                }}
                onKeyDown={handleKeyDown}
                onSelect={syncSelection}
                onKeyUp={syncSelection}
                onClick={syncSelection}
                placeholder={
                  'Write your post here.\n\nSelect any text, then pick a style from the ribbon above — what you see is exactly what publishes.'
                }
                spellCheck
                className="w-full h-[520px] p-4 resize-y bg-transparent outline-none text-[15px] leading-relaxed
                           placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </>
          ) : (
            <div className="p-3">
              <BlockComposer blocks={blocks} onChange={setBlocks} />
              <button
                type="button"
                onClick={sendBlocksToEditor}
                disabled={!blockText.trim()}
                className="mt-3 w-full px-4 py-2 text-sm font-medium rounded-md border border-linkedin
                           text-linkedin hover:bg-linkedin-light dark:hover:bg-slate-700 transition
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('mode.sendToEditor')}
              </button>
            </div>
          )}

          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex justify-between gap-3">
            <span>{t('editor.saved')}</span>
            {errorCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {errorCount} thing{errorCount > 1 ? 's' : ''} to fix
              </span>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 lg:sticky lg:top-[4.5rem]">
          <div className="inline-flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 mb-4">
            <button type="button" className={tabClass('preview')} onClick={() => setTab('preview')}>
              {t('tabs.preview')}
            </button>
            <button type="button" className={tabClass('insights')} onClick={() => setTab('insights')}>
              {t('tabs.checks')}
              {errorCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 text-white">
                  {errorCount}
                </span>
              )}
            </button>
          </div>

          {tab === 'preview' && (
            <Preview
              text={activeText}
              image={previewImage}
              identity={identity}
              onIdentityChange={setIdentity}
            />
          )}
          {tab === 'insights' && <Insights result={result} />}
        </section>
      </main>

      <TemplateGallery
        onUse={loadInto}
        onInsert={handleInsert}
        drafts={drafts}
        onLoadDraft={(d) => loadInto(d.text)}
        onDeleteDraft={handleDeleteDraft}
      />

      <AccountPanel />

      <EmailCapture />

      <About />
    </div>
  );
}
