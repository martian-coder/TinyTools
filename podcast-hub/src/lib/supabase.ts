import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PodcastItem, UserProfile, KnowledgeGroup } from '../types';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl !== 'https://your-project.supabase.co' &&
      !supabaseUrl.includes('placeholder')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * ── Database Sync Functions ──
 */

// Save podcast list to Supabase
export const savePodcastsToCloud = async (
  userId: string,
  podcasts: PodcastItem[]
): Promise<boolean> => {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from('user_libraries').upsert(
      {
        user_id: userId,
        podcasts_data: podcasts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to sync podcasts to cloud:', err);
    return false;
  }
};

// Fetch podcast list from Supabase
export const loadPodcastsFromCloud = async (
  userId: string
): Promise<PodcastItem[] | null> => {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_libraries')
      .select('podcasts_data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Row not found
      throw error;
    }
    return data?.podcasts_data || null;
  } catch (err) {
    console.warn('[Supabase] Failed to load podcasts from cloud:', err);
    return null;
  }
};

// Save user profile & goals to Supabase
export const saveProfileToCloud = async (
  userId: string,
  profile: UserProfile
): Promise<boolean> => {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        profile_data: profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to sync profile to cloud:', err);
    return false;
  }
};

// Fetch user profile from Supabase
export const loadProfileFromCloud = async (
  userId: string
): Promise<UserProfile | null> => {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data?.profile_data || null;
  } catch (err) {
    console.warn('[Supabase] Failed to load profile from cloud:', err);
    return null;
  }
};

// Save knowledge groups to Supabase
export const saveKnowledgeGroupsToCloud = async (
  userId: string,
  groups: KnowledgeGroup[]
): Promise<boolean> => {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from('user_knowledge_groups').upsert(
      {
        user_id: userId,
        groups_data: groups,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to sync knowledge groups to cloud:', err);
    return false;
  }
};

// Fetch knowledge groups from Supabase
export const loadKnowledgeGroupsFromCloud = async (
  userId: string
): Promise<KnowledgeGroup[] | null> => {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_knowledge_groups')
      .select('groups_data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data?.groups_data || null;
  } catch (err) {
    console.warn('[Supabase] Failed to load knowledge groups from cloud:', err);
    return null;
  }
};
