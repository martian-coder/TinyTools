import React from 'react';
import { PodcastItem, KnowledgeGroup } from '../types';
import { CheckCircle2, Heart, Play, Sparkles, Check, Brain } from 'lucide-react';
import { AddToGroupDropdown } from './AddToGroupDropdown';

/* ── Thumbnail with fallback ── */
const VideoThumbnail: React.FC<{ videoId: string; thumbnailUrl?: string; title: string; className?: string }> = ({ videoId, thumbnailUrl, title, className }) => {
  const [src, setSrc] = React.useState(
    thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  );
  return (
    <img
      src={src}
      alt={title}
      className={className}
      loading="lazy"
      onError={() => setSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)}
    />
  );
};

/* ── Real YouTube channel avatar lookup & fallback generator ── */
const KNOWN_AVATARS: Record<string, string> = {
  'this week in startups': 'https://yt3.googleusercontent.com/ytc/AIdro_nN6-R8w3m_b59-93m93m=s176-c-k-c0x00ffffff-no-rj',
  'scott hanselman': 'https://yt3.googleusercontent.com/ytc/AIdro_lD8P_75-Z7_989_9=s176-c-k-c0x00ffffff-no-rj',
  'all-in podcast': 'https://yt3.googleusercontent.com/ytc/AIdro_m4_X9=s176-c-k-c0x00ffffff-no-rj',
  'all in podcast': 'https://yt3.googleusercontent.com/ytc/AIdro_m4_X9=s176-c-k-c0x00ffffff-no-rj',
  'lex fridman': 'https://yt3.googleusercontent.com/ytc/AIdro_k6K0wN7b5_9w_Xg_J_x8=s176-c-k-c0x00ffffff-no-rj',
  'huberman': 'https://yt3.googleusercontent.com/vC4aQ8t-g65t6S_y4Z_e9p7f_0=s176-c-k-c0x00ffffff-no-rj',
  'y combinator': 'https://yt3.googleusercontent.com/ytc/AIdro_n8c9z_5e0g_v0_8g=s176-c-k-c0x00ffffff-no-rj',
  'mkbhd': 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5M37G9IbDx5zpacWYioCioPOJwAbYC6yi-obJhPJKOwEF7Pch1Z=s176-c-k-c0x00ffffff-no-rj',
};

const getRealChannelAvatar = (channelName: string, avatarUrl?: string, channelAvatar?: string) => {
  if (avatarUrl && avatarUrl.startsWith('http')) {
    return avatarUrl;
  }
  if (channelAvatar && channelAvatar.startsWith('http')) {
    return channelAvatar;
  }

  const n = (channelName || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(KNOWN_AVATARS)) {
    if (n.includes(k)) return v;
  }

  const cleanName = channelName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName || 'YT')}&background=11A888&color=fff&size=128&bold=true&font-size=0.4`;
};

/* ── Types ── */
interface VideoCardVideo {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl?: string;
  duration?: string;
  publishedAt?: string;
  description?: string;
  isFavorite?: boolean;
  isImported?: boolean;
  avatarUrl?: string;
  channelAvatar?: string;
}

interface YouTubeVideoCardProps {
  video: VideoCardVideo;
  groups?: any[];
  onAddToGroup?: (groupId: string, video: any) => void;
  onCreateGroup?: (name: string) => void;
  onPlay?: (v: VideoCardVideo) => void;
  onBrainstorm?: (v: VideoCardVideo) => void;
  onSummarize?: (v: VideoCardVideo) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  onSubscribeChannel?: (channel: string, e: React.MouseEvent) => void;
  isSubscribed?: boolean;
  isImporting?: boolean;
}

/* ── Card ── */
export const YouTubeVideoCard: React.FC<YouTubeVideoCardProps> = ({
  video,
  groups = [],
  onAddToGroup,
  onCreateGroup,
  onPlay,
  onBrainstorm,
  onSummarize,
  onToggleFavorite,
  onSubscribeChannel,
  isSubscribed = false,
  isImporting = false,
}) => {
  const avatar = getRealChannelAvatar(video.channel, video.avatarUrl, video.channelAvatar);

  return (
    <div className="group flex flex-col bg-white border border-slate-200/80 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer">

      {/* ── Thumbnail ── */}
      <div
        className="relative aspect-video w-full overflow-hidden bg-slate-100"
        onClick={() => onPlay && onPlay(video)}
      >
        <VideoThumbnail
          videoId={video.videoId}
          thumbnailUrl={video.thumbnailUrl}
          title={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 fill-slate-800 text-slate-800 ml-0.5" />
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {video.duration || '20:00'}
        </div>

        {/* Favorite */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleFavorite(video.videoId, e); }}
            className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-all ${
              video.isFavorite
                ? 'bg-red-500 text-white'
                : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-white'
            }`}
          >
            <Heart className={`w-3 h-3 ${video.isFavorite ? 'fill-white' : ''}`} />
          </button>
        )}
      </div>

      {/* ── Meta ── */}
      <div className="flex gap-2.5 p-3 items-start">
        {/* Avatar */}
        <img
          src={avatar}
          alt={video.channel}
          className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(video.channel || 'YT')}&background=cc0000&color=fff&size=128&bold=true`;
          }}
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p
            onClick={() => onSummarize && onSummarize(video)}
            className="card-title line-clamp-2 cursor-pointer"
            title={video.title}
          >
            {video.title}
          </p>

          {/* Channel + date */}
          <div className="flex items-center gap-1 mt-0.5 text-[11px]">
            <span
              onClick={e => { e.stopPropagation(); if (onSubscribeChannel) onSubscribeChannel(video.channel, e); }}
              className="font-medium text-slate-500 hover:text-slate-800 cursor-pointer truncate max-w-[120px] transition-colors"
            >
              {video.channel}
            </span>
            {isSubscribed && <CheckCircle2 className="w-3 h-3 text-teal-500 shrink-0" />}
            {video.publishedAt && <span className="truncate">· {video.publishedAt}</span>}
          </div>

          {/* Action row */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {/* Add to group */}
            {onAddToGroup && (
              <AddToGroupDropdown
                video={{ videoId: video.videoId, title: video.title, channel: video.channel, thumbnailUrl: video.thumbnailUrl, description: video.description }}
                groups={groups}
                onAddToGroup={onAddToGroup}
                onCreateGroup={onCreateGroup}
                buttonClassName="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition-colors cursor-pointer border border-slate-200"
              />
            )}

            {/* Brainstorm */}
            {onBrainstorm && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onBrainstorm(video); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition-colors cursor-pointer border border-slate-200"
              >
                <Brain className="w-3 h-3" />
                Brainstorm
              </button>
            )}

            {/* Summarize / Analyze */}
            {onSummarize && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onSummarize(video); }}
                disabled={isImporting}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  video.isImported
                    ? 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                    : 'bg-[#11A888] hover:bg-[#0e9478] text-white border border-[#0e9478]'
                }`}
              >
                {isImporting ? (
                  <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /><span>Analyzing…</span></>
                ) : video.isImported ? (
                  <><Check className="w-3 h-3" /><span>View Notes</span></>
                ) : (
                  <><Sparkles className="w-3 h-3" /><span>Analyze</span></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
