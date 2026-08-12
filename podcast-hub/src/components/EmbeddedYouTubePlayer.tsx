import React, { useState } from 'react';
import { extractYouTubeVideoId, timestampToSeconds } from '../utils/youtube';
import {
  Play,
  Clock,
  ExternalLink,
  Minimize2,
  Maximize2,
  Bookmark,
  Check,
  Tv,
} from 'lucide-react';

interface EmbeddedYouTubePlayerProps {
  sourceUrlOrId: string;
  title: string;
  channel?: string;
  keyTimestamps?: Array<{ timestamp: string; topic: string; summary: string }>;
  onBookmarkTimestamp?: (timestamp: string, topic: string) => void;
}

export const EmbeddedYouTubePlayer: React.FC<EmbeddedYouTubePlayerProps> = ({
  sourceUrlOrId,
  title,
  channel,
  keyTimestamps = [],
  onBookmarkTimestamp,
}) => {
  const videoId = extractYouTubeVideoId(sourceUrlOrId) || 'g4mHPeM11dc'; // Default fallback video ID if non-YouTube link
  const [currentStartSeconds, setCurrentStartSeconds] = useState<number>(0);
  const [activeTimestampStr, setActiveTimestampStr] = useState<string>('00:00');
  const [isMinimized, setIsMinimized] = useState(false);
  const [playerSize, setPlayerSize] = useState<'compact' | 'medium' | 'theater'>('compact');
  const [bookmarkedSaved, setBookmarkedSaved] = useState<string | null>(null);

  const handleJumpToTimestamp = (ts: string) => {
    const sec = timestampToSeconds(ts);
    setCurrentStartSeconds(sec);
    setActiveTimestampStr(ts);
  };

  const handleBookmark = (ts: string, topic: string) => {
    if (onBookmarkTimestamp) {
      onBookmarkTimestamp(ts, topic);
      setBookmarkedSaved(ts);
      setTimeout(() => setBookmarkedSaved(null), 2000);
    }
  };

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${currentStartSeconds}&enablejsapi=1`;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/40 rounded-2xl p-3 shadow-xl flex items-center gap-3 max-w-sm text-xs">
        <div className="w-16 h-10 rounded-lg overflow-hidden bg-black shrink-0 relative">
          <iframe
            src={embedUrl}
            title={title}
            className="w-full h-full object-cover"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-white truncate">{title}</p>
          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
            At {activeTimestampStr}
          </p>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
          title="Expand Video Player"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Calculate player container width class based on size preference
  const sizeContainerClass =
    playerSize === 'compact'
      ? 'max-w-xl sm:max-w-2xl mx-auto'
      : playerSize === 'medium'
      ? 'max-w-4xl mx-auto'
      : 'w-full';

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm space-y-3 transition-all ${sizeContainerClass}`}>
      {/* Player Header */}
      <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 flex items-center justify-center shrink-0">
            <Tv className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h3>
            {channel && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{channel}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          {/* Player Sizing Switches */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setPlayerSize('compact')}
              title="Compact Size (Default Browser YouTube size)"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                playerSize === 'compact' ? 'bg-red-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Small
            </button>
            <button
              onClick={() => setPlayerSize('medium')}
              title="Medium Size"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                playerSize === 'medium' ? 'bg-red-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setPlayerSize('theater')}
              title="Theater / Wide Size"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                playerSize === 'theater' ? 'bg-red-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Full
            </button>
          </div>

          <a
            href={`https://www.youtube.com/watch?v=${videoId}${
              currentStartSeconds ? `&t=${currentStartSeconds}s` : ''
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Open YT</span>
          </a>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
            title="Minimize Player"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Iframe Container */}
      <div className="relative w-full aspect-video bg-black shadow-inner">
        <iframe
          key={`${videoId}-${currentStartSeconds}`}
          src={embedUrl}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* Timestamp Controller Pills */}
      {keyTimestamps && keyTimestamps.length > 0 && (
        <div className="p-4 pt-0 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-3.5 h-3.5" />
              Interactive Timestamp Jumper (Click to Seek Video)
            </span>
            {activeTimestampStr !== '00:00' && (
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                Currently Playing at: {activeTimestampStr}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {keyTimestamps.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleJumpToTimestamp(item.timestamp)}
                  className={`px-3 py-1.5 rounded-xl border font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTimestampStr === item.timestamp
                      ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Play className="w-3 h-3 text-red-500 fill-red-500" />
                  <span>{item.timestamp}</span>
                  <span className="font-sans font-normal text-[11px] text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                    {item.topic}
                  </span>
                </button>

                {onBookmarkTimestamp && (
                  <button
                    onClick={() => handleBookmark(item.timestamp, item.topic)}
                    className="p-1.5 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
                    title="Bookmark Clip"
                  >
                    {bookmarkedSaved === item.timestamp ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Bookmark className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
