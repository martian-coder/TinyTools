import React from 'react';
import { VideoThumbnail } from './VideoThumbnail';
import { AddToGroupDropdown } from './AddToGroupDropdown';
import { KnowledgeGroup } from '../types';
import {
  Play,
  Heart,
  Brain,
  Sparkles,
  Share2,
  Check,
  CheckCircle2,
  Clock,
  MoreVertical,
} from 'lucide-react';

export interface YouTubeCardItem {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  duration?: string;
  publishedAt?: string;
  description?: string;
  avatarUrl?: string;
  channelAvatar?: string;
  isFavorite?: boolean;
  isImported?: boolean;
}

interface YouTubeVideoCardProps {
  video: YouTubeCardItem;
  groups?: KnowledgeGroup[];
  onAddToGroup?: (groupId: string, video: any) => void;
  onCreateGroup?: (name: string) => void;
  onPlay?: (video: YouTubeCardItem) => void;
  onBrainstorm?: (video: YouTubeCardItem) => void;
  onSummarize?: (video: YouTubeCardItem) => void;
  onToggleFavorite?: (videoId: string, e: React.MouseEvent) => void;
  onSubscribeChannel?: (channel: string, e: React.MouseEvent) => void;
  isSubscribed?: boolean;
  isImporting?: boolean;
}

const KNOWN_CHANNEL_AVATARS: Record<string, string> = {
  'scott hanselman': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'this week in startups': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200',
  'lenny': 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200',
  'founders podcast': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  'huberman lab': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
  'lex fridman': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
  'tech burner': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
  'mkbhd': 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
  'y combinator': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
};

const AVATAR_POOL = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=200',
];

const getRealChannelAvatar = (channelName: string, avatarUrl?: string, channelAvatar?: string) => {
  if (avatarUrl && avatarUrl.startsWith('http') && !avatarUrl.includes('ui-avatars')) return avatarUrl;
  if (channelAvatar && channelAvatar.startsWith('http') && !channelAvatar.includes('ui-avatars')) return channelAvatar;

  const normalized = (channelName || '').toLowerCase().trim();
  for (const [key, url] of Object.entries(KNOWN_CHANNEL_AVATARS)) {
    if (normalized.includes(key)) return url;
  }

  // Deterministic avatar index based on channel name
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash + normalized.charCodeAt(i)) % AVATAR_POOL.length;
  }

  return AVATAR_POOL[hash];
};

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
    <div className="group flex flex-col space-y-3 bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer select-none">
      {/* 16:9 Thumbnail (Not Minimized) */}
      <div
        className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group-hover:border-sky-200 transition-all shadow-2xs"
        onClick={() => onPlay && onPlay(video)}
      >
        <VideoThumbnail
          videoId={video.videoId}
          thumbnailUrl={video.thumbnailUrl}
          title={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Dark Hover Overlay with Big Play Icon */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-md scale-95 group-hover:scale-100 transition-transform border border-sky-400">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* YouTube Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-slate-900/90 text-white text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
          {video.duration || '20:00'}
        </div>

        {/* Favorite Heart Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(video.videoId, e);
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all ${
              video.isFavorite
                ? 'bg-sky-500 text-white shadow-sm border border-sky-400'
                : 'bg-slate-900/60 text-slate-200 hover:text-white hover:bg-slate-900/80'
            }`}
            title={video.isFavorite ? 'Favorited' : 'Add to Favorites'}
          >
            <Heart className={`w-3.5 h-3.5 ${video.isFavorite ? 'fill-white' : ''}`} />
          </button>
        )}
      </div>

      {/* YouTube Video Meta Block (Avatar + Title + Channel + Action Bar) */}
      <div className="flex gap-2.5 items-start">
        {/* Creator Channel Avatar */}
        <img
          src={avatar}
          alt={video.channel}
          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 mt-0.5 shadow-2xs"
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <h3
            onClick={() => onSummarize && onSummarize(video)}
            className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug line-clamp-2 hover:text-sky-600 transition-colors"
            title={video.title}
          >
            {video.title}
          </h3>

          {/* Channel Name & Verified Badge */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onSubscribeChannel) onSubscribeChannel(video.channel, e);
              }}
              className="font-bold hover:text-sky-600 truncate text-[11px]"
            >
              {video.channel}
            </span>
            {isSubscribed && (
              <CheckCircle2 className="w-3 h-3 text-sky-500 shrink-0" />
            )}
            {video.publishedAt && (
              <span className="text-slate-400 truncate text-[10px]">• {video.publishedAt}</span>
            )}
          </div>

          {/* Action Chips Toolbar */}
          <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
            {onAddToGroup && (
              <AddToGroupDropdown
                video={{
                  videoId: video.videoId,
                  title: video.title,
                  channel: video.channel,
                  thumbnailUrl: video.thumbnailUrl,
                  description: video.description,
                }}
                groups={groups}
                onAddToGroup={onAddToGroup}
                onCreateGroup={onCreateGroup}
                buttonClassName="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              />
            )}

            {onBrainstorm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBrainstorm(video);
                }}
                className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Brainstorm with AI"
              >
                <Brain className="w-3.5 h-3.5 text-sky-600" />
                <span>AI Brainstorm</span>
              </button>
            )}

            {onSummarize && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSummarize(video);
                }}
                disabled={isImporting}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  video.isImported
                    ? 'bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 shadow-2xs'
                    : 'bg-sky-500 hover:bg-sky-600 text-white font-extrabold shadow-2xs border border-sky-400'
                }`}
              >
                {isImporting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : video.isImported ? (
                  <>
                    <Check className="w-3 h-3 text-[#10b981]" />
                    <span>View Notes</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span>Watch &amp; Analyze</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
