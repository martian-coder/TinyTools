import Dexie, { Table } from 'dexie';
import { PodcastItem, UserProfile, KnowledgeGroup, SavedCollection } from '../types';

export interface ChatHistoryRecord {
  podcastId: string;
  messages: Array<{
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: string;
  }>;
  updatedAt: string;
}

export interface UserProfileRecord {
  id: string; // 'current_user'
  profile: UserProfile;
  updatedAt: string;
}

export class PodcastHubDatabase extends Dexie {
  podcasts!: Table<PodcastItem, string>;
  userProfiles!: Table<UserProfileRecord, string>;
  knowledgeGroups!: Table<KnowledgeGroup, string>;
  collections!: Table<SavedCollection, string>;
  chatHistories!: Table<ChatHistoryRecord, string>;

  constructor() {
    super('PodcastHubDB');
    this.version(1).stores({
      podcasts: 'id, youtubeVideoId, channel, status, dateAdded, *tags, isFavorite',
      userProfiles: 'id',
      knowledgeGroups: 'id, category',
      collections: 'id',
      chatHistories: 'podcastId, updatedAt',
    });
  }
}

export const db = new PodcastHubDatabase();

/**
 * Migrate existing data from localStorage to IndexedDB on initial run
 */
export const initIndexedDb = async (
  initialPodcasts: PodcastItem[],
  defaultProfile: UserProfile,
  defaultCollections: SavedCollection[],
  defaultGroups: KnowledgeGroup[]
): Promise<{
  podcasts: PodcastItem[];
  profile: UserProfile;
  collections: SavedCollection[];
  groups: KnowledgeGroup[];
}> => {
  try {
    const podcastCount = await db.podcasts.count();

    if (podcastCount === 0) {
      // 1. Try reading from localStorage to migrate
      let seedPodcasts = initialPodcasts;
      const savedLibrary = localStorage.getItem('podsummarizer_library');
      if (savedLibrary) {
        try {
          const parsed = JSON.parse(savedLibrary);
          if (Array.isArray(parsed) && parsed.length > 0) seedPodcasts = parsed;
        } catch {}
      }
      await db.podcasts.bulkPut(seedPodcasts);

      // 2. Profile
      let seedProfile = defaultProfile;
      const savedProfile = localStorage.getItem('podsummarizer_profile');
      if (savedProfile) {
        try {
          seedProfile = JSON.parse(savedProfile);
        } catch {}
      }
      await db.userProfiles.put({
        id: 'current_user',
        profile: seedProfile,
        updatedAt: new Date().toISOString(),
      });

      // 3. Collections
      let seedCollections = defaultCollections;
      const savedCollections = localStorage.getItem('podsummarizer_collections');
      if (savedCollections) {
        try {
          const parsed = JSON.parse(savedCollections);
          if (Array.isArray(parsed) && parsed.length > 0) seedCollections = parsed;
        } catch {}
      }
      await db.collections.bulkPut(seedCollections);

      // 4. Knowledge Groups
      let seedGroups = defaultGroups;
      const savedGroups = localStorage.getItem('podsummarizer_knowledge_groups');
      if (savedGroups) {
        try {
          const parsed = JSON.parse(savedGroups);
          if (Array.isArray(parsed) && parsed.length > 0) seedGroups = parsed;
        } catch {}
      }
      await db.knowledgeGroups.bulkPut(seedGroups);
    }

    // Load fresh data from IndexedDB
    const [allPodcasts, profileRec, allCollections, allGroups] = await Promise.all([
      db.podcasts.toArray(),
      db.userProfiles.get('current_user'),
      db.collections.toArray(),
      db.knowledgeGroups.toArray(),
    ]);

    return {
      podcasts: allPodcasts.length > 0 ? allPodcasts : initialPodcasts,
      profile: profileRec?.profile || defaultProfile,
      collections: allCollections.length > 0 ? allCollections : defaultCollections,
      groups: allGroups.length > 0 ? allGroups : defaultGroups,
    };
  } catch (err) {
    console.warn('[IndexedDB] Init error, falling back to in-memory/localStorage:', err);
    return {
      podcasts: initialPodcasts,
      profile: defaultProfile,
      collections: defaultCollections,
      groups: defaultGroups,
    };
  }
};

/**
 * ── Helper Sync Functions ──
 */

export const dbSavePodcasts = async (podcasts: PodcastItem[]) => {
  try {
    await db.transaction('rw', db.podcasts, async () => {
      await db.podcasts.clear();
      await db.podcasts.bulkPut(podcasts);
    });
  } catch (e) {
    console.error('[IndexedDB] Save podcasts error:', e);
  }
};

export const dbUpsertPodcast = async (podcast: PodcastItem) => {
  try {
    await db.podcasts.put(podcast);
  } catch (e) {
    console.error('[IndexedDB] Upsert podcast error:', e);
  }
};

export const dbDeletePodcast = async (id: string) => {
  try {
    await db.podcasts.delete(id);
  } catch (e) {
    console.error('[IndexedDB] Delete podcast error:', e);
  }
};

export const dbSaveProfile = async (profile: UserProfile) => {
  try {
    await db.userProfiles.put({
      id: 'current_user',
      profile,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[IndexedDB] Save profile error:', e);
  }
};

export const dbSaveCollections = async (collections: SavedCollection[]) => {
  try {
    await db.transaction('rw', db.collections, async () => {
      await db.collections.clear();
      await db.collections.bulkPut(collections);
    });
  } catch (e) {
    console.error('[IndexedDB] Save collections error:', e);
  }
};

export const dbSaveKnowledgeGroups = async (groups: KnowledgeGroup[]) => {
  try {
    await db.transaction('rw', db.knowledgeGroups, async () => {
      await db.knowledgeGroups.clear();
      await db.knowledgeGroups.bulkPut(groups);
    });
  } catch (e) {
    console.error('[IndexedDB] Save knowledge groups error:', e);
  }
};

export const dbGetChatHistory = async (podcastId: string) => {
  try {
    const rec = await db.chatHistories.get(podcastId);
    return rec?.messages || null;
  } catch {
    return null;
  }
};

export const dbSaveChatHistory = async (podcastId: string, messages: any[]) => {
  try {
    await db.chatHistories.put({
      podcastId,
      messages,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[IndexedDB] Save chat history error:', e);
  }
};
