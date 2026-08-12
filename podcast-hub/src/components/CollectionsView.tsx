import React, { useState } from 'react';
import { PodcastItem, SavedCollection } from '../types';
import { PodcastCard } from './PodcastCard';
import {
  FolderPlus,
  Folder,
  Plus,
  BookOpen,
  Sparkles,
  Trash2,
  Tag,
} from 'lucide-react';

interface CollectionsViewProps {
  podcasts: PodcastItem[];
  collections: SavedCollection[];
  onCreateCollection: (name: string, description: string, color: string) => void;
  onDeleteCollection: (id: string) => void;
  onSelectPodcast: (p: PodcastItem) => void;
  onDeletePodcast: (id: string) => void;
  onToggleStatus: (id: string) => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  podcasts,
  collections,
  onCreateCollection,
  onDeleteCollection,
  onSelectPodcast,
  onDeletePodcast,
  onToggleStatus,
}) => {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColColor, setNewColColor] = useState('indigo');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    onCreateCollection(newColName, newColDesc, newColColor);
    setNewColName('');
    setNewColDesc('');
    setIsModalOpen(false);
  };

  const filteredPodcasts =
    selectedCollectionId === 'all'
      ? podcasts
      : podcasts.filter((p) => p.collections?.includes(selectedCollectionId));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-cyan-950/60 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Playlists & Learning Collections
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Organize your podcasts and video analyses into custom playlists for monetization, technical research, and content creation
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-2 shrink-0"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Playlist Folder</span>
          </button>
        </div>

        {/* Collections Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCollectionId('all')}
            className={`px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedCollectionId === 'all'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            All Podcasts ({podcasts.length})
          </button>

          {collections.map((col) => {
            const count = podcasts.filter((p) => p.collections?.includes(col.id)).length;
            const isSelected = selectedCollectionId === col.id;

            return (
              <div key={col.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{col.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>

                {isSelected && col.id !== 'default-1' && (
                  <button
                    onClick={() => onDeleteCollection(col.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 cursor-pointer"
                    title="Delete Collection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Podcast Grid */}
      {filteredPodcasts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPodcasts.map((p) => (
            <PodcastCard
              key={p.id}
              podcast={p}
              onSelect={onSelectPodcast}
              onDelete={onDeletePodcast}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <Folder className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No podcasts in this playlist collection yet</p>
          <p className="text-xs text-slate-500">
            You can assign podcasts to playlists from the podcast cards or import new ones!
          </p>
        </div>
      )}

      {/* New Collection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              Create New Playlist Folder
            </h3>

            <form onSubmit={handleCreate} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. Micro-SaaS Blueprints, Mindset & Habits"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  placeholder="Short summary of what podcasts belong here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
