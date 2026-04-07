import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import {
  createClient,
  type Session,
  type User,
  type SupportedStorage,
} from '@supabase/supabase-js';
import type { AuthenticatedUser, UserProfile } from '@/domain/user/types';
import { runtimeConfig } from '@/config/runtime';

const STORAGE_KEY = 'bulmaca.supabase.auth.token';

const secureStoreAdapter: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase =
  runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey
    ? createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
        auth: {
          storage: secureStoreAdapter,
          storageKey: STORAGE_KEY,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

function deriveDisplayName(user: User, fallbackProfile?: UserProfile | null): string {
  const metadataName =
    typeof user.user_metadata?.['full_name'] === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.['name'] === 'string'
        ? user.user_metadata.name
        : typeof user.user_metadata?.['user_name'] === 'string'
          ? user.user_metadata.user_name
          : undefined;

  if (fallbackProfile?.username) return fallbackProfile.username;
  if (metadataName) return metadataName;
  if (user.email) return user.email.split('@')[0] ?? 'Kullanici';
  return 'Kullanici';
}

export function buildAuthenticatedUser(
  session: Session,
  guestId: string | null,
  fallbackProfile?: UserProfile | null,
): AuthenticatedUser {
  return {
    type: 'authenticated',
    id: session.user.id,
    username: deriveDisplayName(session.user, fallbackProfile),
    email: session.user.email ?? '',
    avatarUrl: null,
    guestId,
    createdAt: session.user.created_at ?? new Date().toISOString(),
    jwt: session.access_token,
  };
}

export function createDefaultProfile(userId: string, username?: string): UserProfile {
  return {
    userId,
    totalScore: 0,
    levelsCompleted: 0,
    coins: 0,
    streak: 0,
    lastActiveDate: new Date().toISOString().slice(0, 10),
    isPremium: false,
    rank: null,
    ...(username ? { username } : {}),
  };
}

export function createAuthenticatedProfile(
  userId: string,
  username: string,
  remoteProfile?: UserProfile | null,
  fallbackProfile?: UserProfile | null,
): UserProfile {
  const profile = remoteProfile ?? fallbackProfile;
  if (!profile) return createDefaultProfile(userId, username);

  return {
    ...profile,
    userId,
    username: profile.username ?? username,
  };
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[Supabase] getSession failed:', error.message);
    return null;
  }
  return data.session;
}

export async function beginOAuthSignIn(provider: 'apple' | 'google'): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase auth client is not configured');
  }

  const redirectTo = Linking.createURL('/auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Auth URL not returned');

  await Linking.openURL(data.url);
}

export async function exchangeCodeForSessionFromUrl(url: string): Promise<Session | null> {
  if (!supabase) {
    throw new Error('Supabase auth client is not configured');
  }

  const codeMatch = url.match(/[?&]code=([^&#]+)/);
  const errorMatch = url.match(/[?&#]error_description=([^&#]+)/);

  if (errorMatch) {
    throw new Error(decodeURIComponent(errorMatch[1] ?? 'OAuth error'));
  }

  if (!codeMatch?.[1]) {
    return null;
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(
    decodeURIComponent(codeMatch[1]),
  );

  if (error) throw error;
  return data.session;
}

export async function signOutFromSupabase(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
