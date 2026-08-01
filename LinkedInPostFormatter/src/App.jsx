import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import Preview from './components/Preview';
import Insights from './components/Insights';
import TemplateLibrary from './components/TemplateLibrary';
import BlockComposer from './components/BlockComposer';
import About from './components/About';
import { applyStyle, stripStyle } from './utils/unicode.js';
import { analyze, fixSpacing } from './utils/analyze.js';
import { compileBlocks, starterBlocks } from './utils/blocks.js';

const DRAFT_KEY = 'lpf.draft';
const DRAFTS_KEY = 'lpf.drafts';
const THEME_KEY = 'lpf.theme';
const MODE_KEY = 'lpf.mode';
const BLOCKS_KEY = 'lpf.blocks';

export default function App() {
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

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, text);
  }, [text]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

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

  /** Replaces a range and restores the caret, so styling never loses the user's place. */
  const replaceRange = useCallback((start, end, replacement) => {
    setText((current) => current.slice(0, start) + replacement + current.slice(end));
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const caret = start + replacement.length;
      ta.setSelectionRange(start, caret);
      setSelection({ start, end: caret });
    });
  }, []);

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

  const handleFixSpacing = useCallback(() => setText((t) => fixSpacing(t)), []);

  const handleClear = useCallback(() => {
    if (text && !window.confirm('Clear the whole post? This cannot be undone.')) return;
    setText('');
    setSelection({ start: 0, end: 0 });
  }, [text]);

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
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-bold text-linkedin text-lg">in</span>
            <h1 className="font-semibold truncate">
              Postline
              <span className="hidden sm:inline font-normal text-slate-500 dark:text-slate-400">
                {' '}— LinkedIn Post Formatter
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDark((v) => !v)}
              className="px-2.5 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:border-linkedin transition"
              aria-label="Toggle theme"
            >
              {dark ? '☀' : '☾'}
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!activeText.trim()}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:border-linkedin transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!activeText}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-linkedin text-white hover:bg-linkedin-dark transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? 'Copied ✓' : 'Copy for LinkedIn'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 grid lg:grid-cols-2 gap-5 items-start">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="flex items-center gap-3 px-3 pt-3">
            <div className="inline-flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              <button type="button" className={modeClass(mode === 'write')} onClick={() => setMode('write')}>
                Write
              </button>
              <button type="button" className={modeClass(mode === 'build')} onClick={() => setMode('build')}>
                Build
              </button>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'write'
                ? 'Freeform, with styling.'
                : 'Assemble from blocks, then send it across to style.'}
            </span>
          </div>

          {mode === 'write' ? (
            <>
              <Toolbar
                onApply={handleApply}
                onInsert={handleInsert}
                onFixSpacing={handleFixSpacing}
                onClear={handleClear}
                hasSelection={hasSelection}
                hasText={text.length > 0}
              />
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  syncSelection();
                }}
                onSelect={syncSelection}
                onKeyUp={syncSelection}
                onClick={syncSelection}
                placeholder={
                  'Write your post here.\n\nSelect any text and pick a style — what you see is exactly what publishes.'
                }
                spellCheck
                className="w-full h-[460px] p-4 resize-y bg-transparent outline-none text-[15px] leading-relaxed
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
                Send to editor to style →
              </button>
            </div>
          )}

          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex justify-between gap-3">
            <span>Saved to this browser automatically.</span>
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
              Preview
            </button>
            <button type="button" className={tabClass('insights')} onClick={() => setTab('insights')}>
              Checks
              {errorCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 text-white">
                  {errorCount}
                </span>
              )}
            </button>
            <button type="button" className={tabClass('templates')} onClick={() => setTab('templates')}>
              Templates
            </button>
          </div>

          {tab === 'preview' && <Preview text={activeText} />}
          {tab === 'insights' && <Insights result={result} />}
          {tab === 'templates' && (
            <TemplateLibrary
              onUse={loadInto}
              onInsert={handleInsert}
              drafts={drafts}
              onLoadDraft={(d) => loadInto(d.text)}
              onDeleteDraft={handleDeleteDraft}
            />
          )}
        </section>
      </main>

      <About />
    </div>
  );
}
