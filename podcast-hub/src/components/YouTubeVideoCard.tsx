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

const getRealChannelAvatar = (channelName: string, avatarUrl?: string, channelAvatar?: string) => {
  if (avatarUrl && avatarUrl.startsWith('http') && !avatarUrl.includes('ui-avatars')) return avatarUrl;
  if (channelAvatar && channelAvatar.startsWith('http') && !channelAvatar.includes('ui-avatars')) return channelAvatar;

  const normalized = (channelName || '').toLowerCase().trim();
  for (const [key, url] of Object.entries(KNOWN_CHANNEL_AVATARS)) {
    if (normalized.includes(key)) return url;
  }

  // High quality Unsplash image avatar fallback
  return `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200`;
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
    <div className="group flex flex-col space-y-3 bg-[#222736] border border-[#2d3245] hover:border-[#00c6ff]/40 rounded-2xl p-3 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer select-none">
      {/* 16:9 Thumbnail (Not Minimized) */}
      <div
        className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#141721] border border-[#2d3245] group-hover:border-[#00c6ff]/30 transition-all shadow-xs"
        onClick={() => onPlay && onPlay(video)}
      >
        <VideoThumbnail
          videoId={video.videoId}
          thumbnailUrl={video.thumbnailUrl}
          title={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Dark Hover Overlay with Big Play Icon */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-r from-[#5b51d8] to-[#00c6ff] text-white flex items-center justify-center shadow-xl scale-95 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* YouTube Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-md backdrop-blur-xs">
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
            className={`absolute top-2 right-2 p-2 rounded-xl backdrop-blur-md transition-all ${
              video.isFavorite
                ? 'bg-gradient-to-r from-[#5b51d8] to-[#00c6ff] text-white shadow-md'
                : 'bg-black/60 text-slate-300 hover:text-white hover:bg-black/80'
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
          className="w-8 h-8 rounded-full object-cover border border-[#2d3245] shrink-0 mt-0.5"
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <h3
            onClick={() => onSummarize && onSummarize(video)}
            className="text-xs sm:text-sm font-semibold text-white leading-snug line-clamp-2 hover:text-[#00c6ff] transition-colors"
            title={video.title}
          >
            {video.title}
          </h3>

          {/* Channel Name & Verified Badge */}
          <div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onSubscribeChannel) onSubscribeChannel(video.channel, e);
              }}
              className="font-medium hover:text-[#00c6ff] truncate text-[11px]"
            >
              {video.channel}
            </span>
            {isSubscribed && (
              <CheckCircle2 className="w-3 h-3 text-[#00c6ff] shrink-0" />
            )}
            {video.publishedAt && (
              <span className="text-[#64748b] truncate text-[10px]">• {video.publishedAt}</span>
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
                buttonClassName="px-2.5 py-1 rounded-xl bg-[#141721] hover:bg-[#2a3042] text-[#f1f5f9] border border-[#2d3245] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
              />
            )}

            {onBrainstorm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBrainstorm(video);
                }}
                className="px-2.5 py-1 rounded-xl bg-[#141721] hover:bg-indigo-600 text-indigo-300 hover:text-white border border-[#2d3245] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                title="Brainstorm with AI"
              >
                <Brain className="w-3.5 h-3.5" />
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
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  video.isImported
                    ? 'bg-[#141721] hover:bg-[#2a3042] text-[#f1f5f9] border border-[#2d3245]'
                    : 'bg-gradient-to-r from-[#5b51d8] to-[#00c6ff] text-white font-extrabold shadow-sm'
                }`}
              >
                {isImporting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : video.isImported ? (
                  <>
                    <Check className="w-3 h-3 text-[#2ecc71]" />
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
