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
  const avatar =
    video.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      video.channel || 'YT'
    )}&background=cc0000&color=fff&size=100&bold=true`;

  return (
    <div className="group flex flex-col space-y-3 cursor-pointer select-none">
      {/* 16:9 Thumbnail (Not Minimized) */}
      <div
        className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#212121] border border-[#272727] group-hover:border-[#3f3f3f] transition-all shadow-md group-hover:shadow-xl"
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
          <div className="w-12 h-12 rounded-full bg-[#3ea6ff] text-black flex items-center justify-center shadow-2xl scale-95 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6 fill-black ml-0.5" />
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
            className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition-all ${
              video.isFavorite
                ? 'bg-[#3ea6ff] text-black shadow-lg'
                : 'bg-black/60 text-slate-300 hover:text-white hover:bg-black/80'
            }`}
            title={video.isFavorite ? 'Favorited' : 'Add to Favorites'}
          >
            <Heart className={`w-4 h-4 ${video.isFavorite ? 'fill-black' : ''}`} />
          </button>
        )}
      </div>

      {/* YouTube Video Meta Block (Avatar + Title + Channel + Action Bar) */}
      <div className="flex gap-3 items-start">
        {/* Creator Channel Avatar */}
        <img
          src={avatar}
          alt={video.channel}
          className="w-9 h-9 rounded-full object-cover border border-[#303030] shrink-0 mt-0.5"
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <h3
            onClick={() => onSummarize && onSummarize(video)}
            className="text-sm font-semibold text-[#f1f1f1] leading-snug line-clamp-2 hover:text-[#3ea6ff] transition-colors"
            title={video.title}
          >
            {video.title}
          </h3>

          {/* Channel Name & Verified Badge */}
          <div className="flex items-center gap-1.5 text-xs text-[#aaaaaa]">
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onSubscribeChannel) onSubscribeChannel(video.channel, e);
              }}
              className="font-medium hover:text-[#3ea6ff] truncate"
            >
              {video.channel}
            </span>
            {isSubscribed && (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3ea6ff] shrink-0" />
            )}
            {video.publishedAt && (
              <span className="text-[#717171] truncate">• {video.publishedAt}</span>
            )}
          </div>

          {/* Action Chips Toolbar */}
          <div className="pt-2 flex items-center gap-1.5 flex-wrap">
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
                buttonClassName="px-2.5 py-1 rounded-full bg-[#272727] hover:bg-[#3f3f3f] text-[#f1f1f1] border border-[#3f3f3f] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
              />
            )}

            {onBrainstorm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBrainstorm(video);
                }}
                className="px-2.5 py-1 rounded-full bg-[#272727] hover:bg-blue-600 text-blue-300 hover:text-white border border-[#3f3f3f] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
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
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  video.isImported
                    ? 'bg-[#272727] hover:bg-[#3f3f3f] text-[#f1f1f1] border border-[#3f3f3f]'
                    : 'bg-[#3ea6ff] hover:bg-[#2697ff] text-black font-extrabold shadow-md'
                }`}
              >
                {isImporting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : video.isImported ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
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
