export type PodcastStatus = 'Completed' | 'In Progress' | 'Unread';

export interface DetailedSection {
  sectionTitle: string;
  timestampRange?: string;
  content: string;
  keyPoints: string[];
}

export interface MonetizationOpportunity {
  id: string;
  title: string;
  description: string;
  model: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  potentialRevenue: string;
  actionSteps: string[];
}

export interface EthicsAndDisciplineItem {
  id: string;
  topic: string;
  summary: string;
  disciplineTakeaway: string;
  ethicalConsideration: string;
  debatePoints: string[];
}

export interface ReflectionQuestion {
  id: string;
  question: string;
  type: string;
  options?: string[];
  answerHint?: string;
  userAnswer?: string;
  isAnswered?: boolean;
}

export interface KeyTimestamp {
  timestamp: string;
  topic: string;
  summary: string;
}

export interface SavedCollection {
  id: string;
  name: string;
  description: string;
  color: string;
  icon?: string;
}

export interface KnowledgeGroup {
  id: string;
  name: string;
  description: string;
  category: 'SaaS Products' | 'Content Creation' | 'AI & Tech Stack' | 'Mindset & Growth' | 'Custom';
  videoIds: string[]; // Array of YouTube video IDs or Podcast IDs
  customNotesPerVideo?: Record<string, string>; // Video ID -> User Note
  aiSynthesis?: {
    lastSynthesized: string;
    productIdeas: string[];
    monetizationModels: string[];
    actionBlueprint: string[];
    summary: string;
  };
}

export interface PodcastItem {
  id: string;
  title: string;
  source: string;
  channel: string;
  thumbnailUrl: string;
  youtubeVideoId?: string;
  dateAdded: string;
  duration: string;
  status: PodcastStatus;
  masteryLevel: number;
  shortSummary: string;
  detailedSummary: DetailedSection[];
  monetizationOpportunities: MonetizationOpportunity[];
  ethicsAndDiscipline: EthicsAndDisciplineItem[];
  reflectionQuestions: ReflectionQuestion[];
  keyTimestamps: KeyTimestamp[];
  actionableTakeaways: string[];
  tags: string[];
  userNotes: string;
  bookmarkedTimestamps: string[];
  collections?: string[]; // Collection IDs
  isFavorite?: boolean;
}

export interface UserProfile {
  name: string;
  role: string;
  bio: string;
  strategicGoals: string[];
  notes: string;
  savedInsights: Array<{
    id: string;
    podcastTitle: string;
    insight: string;
    category: string;
    dateAdded: string;
  }>;
}

export type ViewTab =
  | 'dashboard'
  | 'monetization'
  | 'ethics'
  | 'detail'
  | 'assistant'
  | 'yt_search'
  | 'content_studio'
  | 'collections'
  | 'knowledge_groups'
  | 'profile';

export interface DeepFocusResult {
  segmentTitle: string;
  deepSummary: string;
  keyQuotes: string[];
  businessBlueprint: string[];
  ethicalAssessment: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnailUrl: string;
  description: string;
  publishedAt?: string;
  isFavorite?: boolean;
  avatarUrl?: string;
  channelAvatar?: string;
}

export type ThemeMode = 'dark' | 'light';
