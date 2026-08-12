import React from 'react';
import { PodcastItem, KnowledgeGroup } from '../types';
import { YouTubeVideoCard } from './YouTubeVideoCard';

interface PodcastCardProps {
  podcast: PodcastItem;
  onSelect: (podcast: PodcastItem) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  knowledgeGroups?: KnowledgeGroup[];
  onAddVideoToGroup?: (groupId: string, video: any) => void;
  onCreateKnowledgeGroup?: (name: string) => void;
}

export const PodcastCard: React.FC<PodcastCardProps> = ({
  podcast,
  onSelect,
  onDelete,
  onToggleStatus,
  onToggleFavorite,
  knowledgeGroups = [],
  onAddVideoToGroup,
  onCreateKnowledgeGroup,
}) => {
  return (
    <YouTubeVideoCard
      video={{
        videoId: podcast.youtubeVideoId || podcast.id,
        title: podcast.title,
        channel: podcast.channel,
        thumbnailUrl: podcast.thumbnailUrl,
        duration: podcast.duration,
        publishedAt: podcast.dateAdded,
        description: podcast.shortSummary,
        isFavorite: podcast.isFavorite,
        isImported: true,
        channelAvatar: podcast.channelAvatar,
      }}
      groups={knowledgeGroups}
      onAddToGroup={onAddVideoToGroup}
      onCreateGroup={onCreateKnowledgeGroup}
      onPlay={() => onSelect(podcast)}
      onSummarize={() => onSelect(podcast)}
      onToggleFavorite={(id, e) => onToggleFavorite && onToggleFavorite(podcast.id)}
    />
  );
};
