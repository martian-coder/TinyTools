import React, { useState, useRef, useEffect } from 'react';
import { KnowledgeGroup } from '../types';
import { FolderPlus, Check, Plus, Sparkles, Folder } from 'lucide-react';

interface AddToGroupDropdownProps {
  video: {
    videoId: string;
    title: string;
    channel: string;
    thumbnailUrl: string;
    description?: string;
  };
  groups: KnowledgeGroup[];
  onAddToGroup: (groupId: string, video: any) => void;
  onCreateGroup?: (name: string) => void;
  buttonClassName?: string;
}

export const AddToGroupDropdown: React.FC<AddToGroupDropdownProps> = ({
  video,
  groups,
  onAddToGroup,
  onCreateGroup,
  buttonClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [addedGroupId, setAddedGroupId] = useState<string | null>(null);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCreateInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectGroup = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToGroup(groupId, video);
    setAddedGroupId(groupId);
    setTimeout(() => {
      setAddedGroupId(null);
      setIsOpen(false);
    }, 1200);
  };

  const handleCreateNewGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newGroupName.trim() || !onCreateGroup) return;
    onCreateGroup(newGroupName.trim());
    setNewGroupName('');
    setShowCreateInput(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={
          buttonClassName ||
          'px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-slate-700 hover:border-indigo-500 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs'
        }
        title="Add to AI Knowledge Group for Brainstorming"
      >
        <FolderPlus className="w-3.5 h-3.5" />
        <span>+ Add to Group</span>
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 text-xs space-y-1 animate-in fade-in duration-150"
        >
          <div className="px-2.5 py-1.5 font-bold text-slate-300 border-b border-slate-800 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Sparkles className="w-3.5 h-3.5" /> AI Knowledge Groups
            </span>
            <span className="text-[10px] text-slate-500">Brainstorm Cluster</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 py-1 scrollbar-none">
            {groups.map((g) => {
              const inGroup = g.videoIds.includes(video.videoId);
              const isJustAdded = addedGroupId === g.id;

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={(e) => handleSelectGroup(g.id, e)}
                  className={`w-full px-2.5 py-2 rounded-xl text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    inGroup || isJustAdded
                      ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{g.name}</span>
                  </div>
                  {isJustAdded ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Added!
                    </span>
                  ) : inGroup ? (
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  ) : (
                    <Plus className="w-3 h-3 text-slate-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {onCreateGroup && (
            <div className="pt-1 border-t border-slate-800">
              {showCreateInput ? (
                <form onSubmit={handleCreateNewGroupSubmit} className="p-1 space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New Group Name..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateInput(false)}
                      className="px-2 py-1 bg-slate-800 text-slate-400 rounded-lg text-[10px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateInput(true)}
                  className="w-full px-2.5 py-1.5 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 font-bold text-[11px] text-left flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Group</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
