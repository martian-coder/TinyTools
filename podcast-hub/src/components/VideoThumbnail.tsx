import React, { useState, useEffect } from 'react';
import { getYouTubeThumbnailUrl, getFallbackThumbnail, extractYouTubeVideoId } from '../utils/youtube';

interface VideoThumbnailProps {
  videoId?: string;
  thumbnailUrl?: string;
  title: string;
  className?: string;
  alt?: string;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  videoId,
  thumbnailUrl,
  title,
  className = 'w-full h-full object-cover',
  alt,
}) => {
  const cleanId = extractYouTubeVideoId(videoId || '') || videoId;
  const initialUrl = thumbnailUrl || getYouTubeThumbnailUrl(cleanId);

  const [src, setSrc] = useState<string>(initialUrl);
  const [hasFailed, setHasFailed] = useState<boolean>(false);

  useEffect(() => {
    const freshId = extractYouTubeVideoId(videoId || '') || videoId;
    setSrc(thumbnailUrl || getYouTubeThumbnailUrl(freshId));
    setHasFailed(false);
  }, [videoId, thumbnailUrl]);

  const triggerFallback = () => {
    if (!hasFailed) {
      setHasFailed(true);
      setSrc(getFallbackThumbnail(cleanId || title, title));
    }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // YouTube returns a tiny 120x90 pixel gray placeholder image when video ID is invalid or unavailable
    if ((img.naturalWidth <= 120 || img.naturalHeight <= 90) && !hasFailed) {
      triggerFallback();
    }
  };

  return (
    <img
      src={src}
      alt={alt || title}
      referrerPolicy="no-referrer"
      onError={triggerFallback}
      onLoad={handleLoad}
      className={className}
    />
  );
};
