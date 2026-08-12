import React, { useState } from 'react';
import { PodcastItem, UserProfile } from '../types';
import {
  User,
  Edit3,
  Save,
  Plus,
  Trash2,
  FileText,
  Search,
  Sparkles,
  BookOpen,
  Lightbulb,
  Check,
  Share2,
  Copy,
  Brain,
  Target,
  Bookmark,
} from 'lucide-react';

interface UserProfileViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  podcasts: PodcastItem[];
  onSelectPodcast?: (podcast: PodcastItem) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  podcasts,
  onSelectPodcast,
}) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [editRole, setEditRole] = useState(userProfile.role);
  const [editBio, setEditBio] = useState(userProfile.bio);
  const [editGoals, setEditGoals] = useState(userProfile.strategicGoals.join('\n'));
  const [editNotes, setEditNotes] = useState(userProfile.notes);

  // New Insight Form State
  const [newInsightText, setNewInsightText] = useState('');
  const [newInsightCategory, setNewInsightCategory] = useState('Monetization');
  const [newInsightSource, setNewInsightSource] = useState('Personal Strategy');

  // Search & Filter for Vault
  const [vaultSearch, setVaultSearch] = useState('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  const handleSaveProfileHeader = () => {
    const goalsArray = editGoals
      .split('\n')
      .map((g) => g.trim())
      .filter(Boolean);

    onUpdateProfile({
      ...userProfile,
      name: editName,
      role: editRole,
      bio: editBio,
      strategicGoals: goalsArray,
      notes: editNotes,
    });
    setIsEditingProfile(false);
  };

  const handleAddInsight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsightText.trim()) return;

    const newInsight = {
      id: `ins-${Date.now()}`,
      podcastTitle: newInsightSource,
      insight: newInsightText.trim(),
      category: newInsightCategory,
      dateAdded: new Date().toISOString().split('T')[0],
    };

    onUpdateProfile({
      ...userProfile,
      savedInsights: [newInsight, ...userProfile.savedInsights],
    });

    setNewInsightText('');
  };

  const handleDeleteInsight = (id: string) => {
    onUpdateProfile({
      ...userProfile,
      savedInsights: userProfile.savedInsights.filter((ins) => ins.id !== id),
    });
  };

  const handleCopyNote = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNoteId(id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  // Podcasts with non-empty user notes
  const podcastNotesList = podcasts.filter((p) => p.userNotes && p.userNotes.trim().length > 0);

  // Combine and filter user notes for vault view
  const filteredInsights = userProfile.savedInsights.filter(
    (ins) =>
      ins.insight.toLowerCase().includes(vaultSearch.toLowerCase()) ||
      ins.podcastTitle.toLowerCase().includes(vaultSearch.toLowerCase()) ||
      ins.category.toLowerCase().includes(vaultSearch.toLowerCase())
  );

  const [ytProfile] = useState<{ name: string; handle: string; avatar: string; email?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('user_yt_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  return (
    <div className="space-y-6">
      {/* Profile Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {/* Avatar / Photo */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-xl shadow-indigo-500/20 shrink-0">
              {ytProfile?.avatar ? (
                <img
                  src={ytProfile.avatar}
                  alt={ytProfile.name}
                  className="w-full h-full rounded-[14px] object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white text-xl font-black">
                  {userProfile.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || 'U'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">{ytProfile?.name || userProfile.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
                  PRO AI Researcher
                </span>
                {ytProfile && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                    Connected Google &amp; YouTube
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-indigo-300 font-medium">
                {ytProfile?.handle ? `${ytProfile.handle} • ${ytProfile.email || userProfile.role}` : userProfile.role}
              </p>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">{userProfile.bio}</p>
            </div>
          </div>

          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isEditingProfile ? 'Cancel Editing' : 'Edit Profile & Goals'}</span>
          </button>
        </div>

        {/* Edit Form Drawer */}
        {isEditingProfile && (
          <div className="bg-slate-950 p-5 rounded-2xl border border-indigo-500/40 space-y-4 animate-in fade-in duration-200">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-indigo-400 flex items-center gap-2">
              <User className="w-4 h-4" /> Edit Profile Information & Strategic Targets
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Full Name / Handle</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Headline / Focus Role</label>
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-xs font-medium">Bio & Focus Thesis</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-xs font-medium">
                Strategic Targets & Growth Goals (1 per line)
              </label>
              <textarea
                value={editGoals}
                onChange={(e) => setEditGoals(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveProfileHeader}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* Strategic Growth Goals Chips */}
        {userProfile.strategicGoals.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" /> Strategic Growth Targets:
            </span>
            <div className="flex flex-wrap gap-2">
              {userProfile.strategicGoals.map((goal, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/30 text-slate-200 text-xs font-semibold flex items-center gap-2 shadow"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile Notes & Knowledge Vault Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Profile Strategy Notes Journal */}
        <div className="lg:col-span-1 space-y-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              General Strategy Journal
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Auto-Saved</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your high-level strategy notebook for overarching principles, project blueprints, and personal goals.
          </p>

          <textarea
            value={editNotes}
            onChange={(e) => {
              setEditNotes(e.target.value);
              onUpdateProfile({ ...userProfile, notes: e.target.value });
            }}
            placeholder="Write strategic notes, business ideas, frameworks, and daily focus protocols here..."
            className="w-full flex-1 min-h-[300px] bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 leading-relaxed placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none font-mono"
          />

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-500">{editNotes.length} chars</span>
            <button
              onClick={() => handleCopyNote('profile-notes', editNotes)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1"
            >
              {copiedNoteId === 'profile-notes' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedNoteId === 'profile-notes' ? 'Copied' : 'Copy Journal'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Add Insights & Aggregated Podcast Notes Vault */}
        <div className="lg:col-span-2 space-y-5">
          {/* Add New Strategic Insight Card */}
          <div className="bg-slate-900 border border-indigo-500/30 p-5 rounded-2xl shadow-xl space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Add Key Insight / Learning to Profile
            </h2>

            <form onSubmit={handleAddInsight} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Category Tag</label>
                  <select
                    value={newInsightCategory}
                    onChange={(e) => setNewInsightCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Monetization">💰 Monetization Tactic</option>
                    <option value="AI & Automation">🤖 AI & Agentic Workflow</option>
                    <option value="Mindset & Focus">🧠 Mindset & Focus</option>
                    <option value="Leadership">🚀 Leadership & Growth</option>
                    <option value="General Strategy">📌 General Strategy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Source / Reference</label>
                  <input
                    type="text"
                    value={newInsightSource}
                    onChange={(e) => setNewInsightSource(e.target.value)}
                    placeholder="e.g. Y Combinator, Huberman, Personal..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={newInsightText}
                  onChange={(e) => setNewInsightText(e.target.value)}
                  placeholder="Enter a key takeaway, principle, or actionable rule..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newInsightText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-indigo-600/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Insight to Profile</span>
                </button>
              </div>
            </form>
          </div>

          {/* Profile Insights & Podcast Notes Vault */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-emerald-400" />
                  Saved Insights & Episode Study Notes
                </h2>
                <p className="text-xs text-slate-400">
                  All saved insights and user notes from your podcast library in one place.
                </p>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Custom Saved Profile Insights */}
            <div className="space-y-3">
              {filteredInsights.length > 0 ? (
                filteredInsights.map((ins) => (
                  <div
                    key={ins.id}
                    className="p-3.5 bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl space-y-2 transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                          {ins.category}
                        </span>
                        <span className="text-slate-400 font-semibold">{ins.podcastTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>{ins.dateAdded}</span>
                        <button
                          onClick={() => handleCopyNote(ins.id, ins.insight)}
                          className="hover:text-white transition-colors cursor-pointer"
                          title="Copy Note"
                        >
                          {copiedNoteId === ins.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteInsight(ins.id)}
                          className="hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-mono">{ins.insight}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No saved profile insights match your search. Add one above!
                </div>
              )}
            </div>

            {/* Podcast Episode Specific Notes Section */}
            {podcastNotesList.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wide">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Notes from Summarized Episodes ({podcastNotesList.length})
                </h3>

                <div className="space-y-3">
                  {podcastNotesList.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          onClick={() => onSelectPodcast && onSelectPodcast(p)}
                          className="font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer underline underline-offset-2"
                        >
                          {p.title}
                        </span>
                        <span className="text-[10px] text-slate-500">{p.channel}</span>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {p.userNotes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
