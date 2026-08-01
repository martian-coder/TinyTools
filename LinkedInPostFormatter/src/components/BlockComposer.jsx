import React, { useRef, useState } from 'react';
import { BLOCK_TYPES, BLOCK_ORDER, makeBlock, moveBlock } from '../utils/blocks.js';
import EmojiPicker from './EmojiPicker.jsx';

/**
 * Drag-and-drop post builder.
 *
 * Reordering is available three ways — pointer drag, the move buttons, and those
 * same buttons under keyboard focus. Drag-and-drop on its own is unusable with a
 * keyboard or a screen reader, and shipping it alone in a tool that warns authors
 * about accessibility would be hard to defend.
 */
export default function BlockComposer({ blocks, onChange }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [grabbedId, setGrabbedId] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [active, setActive] = useState({ id: null, caret: 0 });
  const [announcement, setAnnouncement] = useState('');

  const refs = useRef({});

  const update = (id, content) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)));

  const remove = (id) => onChange(blocks.filter((b) => b.id !== id));

  const add = (type) => onChange([...blocks, makeBlock(type)]);

  const move = (from, to) => {
    if (to < 0 || to >= blocks.length) return;
    onChange(moveBlock(blocks, from, to));
    setAnnouncement(
      `${BLOCK_TYPES[blocks[from].type].label} moved to position ${to + 1} of ${blocks.length}`
    );
  };

  /**
   * The source block is read back out of the dataTransfer rather than from
   * component state. State set during dragstart has not necessarily flushed by the
   * time drop fires, and the dataTransfer is the one thing the browser guarantees
   * survives the whole gesture.
   */
  const handleDrop = (event, target) => {
    const id = event.dataTransfer.getData('text/plain');
    const from = blocks.findIndex((b) => b.id === id);
    if (from !== -1) move(from, target);
    setDragIndex(null);
    setOverIndex(null);
    setGrabbedId(null);
  };

  const insertEmoji = (char) => {
    const target = active.id ? blocks.find((b) => b.id === active.id) : null;
    if (!target) {
      setAnnouncement('Click into a block first, then pick an emoji.');
      return;
    }
    const content = target.content || '';
    const caret = Math.min(active.caret, content.length);
    update(target.id, content.slice(0, caret) + char + content.slice(caret));
    const node = refs.current[target.id];
    requestAnimationFrame(() => {
      if (!node) return;
      node.focus();
      node.setSelectionRange(caret + char.length, caret + char.length);
      setActive({ id: target.id, caret: caret + char.length });
    });
  };

  const syncCaret = (id) => {
    const node = refs.current[id];
    if (node) setActive({ id, caret: node.selectionStart });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600
                     hover:border-linkedin transition"
        >
          {showEmoji ? 'Hide emoji' : 'Emoji'}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Drag a block by its handle to reorder — or use the arrows, which also work on touch
          screens and with a keyboard.
        </span>
      </div>

      {showEmoji && <EmojiPicker onPick={insertEmoji} />}

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <ol className="space-y-2">
        {blocks.map((block, index) => {
          const spec = BLOCK_TYPES[block.type];
          if (!spec) return null;
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== index;

          return (
            <li
              key={block.id}
              draggable={grabbedId === block.id}
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                // Firefox refuses to start a drag without data set.
                e.dataTransfer.setData('text/plain', block.id);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
                setGrabbedId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(e, index);
              }}
              className={`rounded-lg border bg-white dark:bg-slate-800 transition ${
                isDragging ? 'opacity-40' : ''
              } ${
                isOver
                  ? 'border-linkedin ring-2 ring-linkedin/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
                <span
                  onMouseDown={() => setGrabbedId(block.id)}
                  onMouseUp={() => setGrabbedId(null)}
                  aria-hidden="true"
                  title="Drag to reorder"
                  className="cursor-grab active:cursor-grabbing px-1 text-slate-400 select-none"
                >
                  ⠿
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {spec.label}
                </span>
                <span className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${spec.label} up`}
                    className="px-1.5 py-0.5 text-xs rounded text-slate-500 hover:bg-slate-100
                               dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === blocks.length - 1}
                    aria-label={`Move ${spec.label} down`}
                    className="px-1.5 py-0.5 text-xs rounded text-slate-500 hover:bg-slate-100
                               dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(block.id)}
                    aria-label={`Delete ${spec.label}`}
                    className="px-1.5 py-0.5 text-xs rounded text-slate-400 hover:text-red-600
                               hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    ✕
                  </button>
                </span>
              </div>

              {!spec.noContent && (
                <div className="p-2">
                  <textarea
                    ref={(el) => {
                      if (el) refs.current[block.id] = el;
                      else delete refs.current[block.id];
                    }}
                    value={block.content}
                    onChange={(e) => {
                      update(block.id, e.target.value);
                      syncCaret(block.id);
                    }}
                    onFocus={() => syncCaret(block.id)}
                    onClick={() => syncCaret(block.id)}
                    onKeyUp={() => syncCaret(block.id)}
                    placeholder={spec.placeholder}
                    rows={block.type === 'hook' || block.type === 'cta' ? 2 : 3}
                    aria-label={spec.label}
                    className="w-full resize-y bg-transparent outline-none text-sm leading-relaxed
                               placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{spec.hint}</p>
                </div>
              )}

              {spec.noContent && (
                <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">{spec.hint}</p>
              )}
            </li>
          );
        })}
      </ol>

      {blocks.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
          No blocks yet. Add one below to start building.
        </p>
      )}

      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          Add a block
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => add(type)}
              title={BLOCK_TYPES[type].hint}
              className="px-2.5 py-1 text-sm rounded-md border border-slate-300 dark:border-slate-600
                         hover:border-linkedin hover:bg-linkedin-light dark:hover:bg-slate-700 transition"
            >
              + {BLOCK_TYPES[type].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
