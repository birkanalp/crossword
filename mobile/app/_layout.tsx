import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { queryClient } from '@/api/queryClient';
import { initSentry } from '@/lib/sentry';
import { useAppBoot } from '@/hooks/useAppBoot';
import { setupStoreSubscriptions } from '@/store/storeSubscriptions';
import { Colors } from '@/constants/colors';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ConfigErrorScreen } from '@/components/ConfigErrorScreen';
import { getCriticalConfigIssues } from '@/config/runtime';
import { supabase, buildAuthenticatedUser, createAuthenticatedProfile } from '@/lib/supabase';
import { useUserStore } from '@/store/userStore';
import { apiRequest } from '@/api/client';
import { clearUserContext, setUserContext } from '@/lib/sentry';
import { initAnalytics, resetAnalytics } from '@/lib/analytics';
import { initRevenueCat } from '@/lib/revenuecat';
import type { UserProfile } from '@/domain/user/types';

interface ApiProfileResponse {
  user_id: string;
  username: string | null;
  avatar_color: string | null;
  levels_completed: number;
  total_score: number;
  best_score: number;
  total_time_spent: number;
  total_entries: number;
  created_at: string | null;
}

function adaptProfileResponse(response: ApiProfileResponse): UserProfile {
  return {
    userId: response.user_id,
    totalScore: response.total_score,
    levelsCompleted: response.levels_completed,
    coins: 0,
    streak: 0,
    lastActiveDate: new Date().toISOString().slice(0, 10),
    isPremium: false,
    rank: response.total_entries > 0 ? response.total_entries : null,
    ...(response.username ? { username: response.username } : {}),
    ...(response.avatar_color ? { avatarColor: response.avatar_color } : {}),
  };
}

async function fetchRemoteProfile(authToken: string): Promise<UserProfile | null> {
  const result = await apiRequest<ApiProfileResponse>('/getProfile', { authToken });
  if (result.error || !result.data) {
    return null;
  }
  return adaptProfileResponse(result.data);
}

// ─── Keep the splash screen visible until boot completes ─────────────────────
SplashScreen.preventAutoHideAsync();

// ─── Initialise Sentry as early as possible ───────────────────────────────────
initSentry();

// ─── Wire up persistence subscriptions ───────────────────────────────────────
setupStoreSubscriptions();

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// ─── Inner component so hooks can run inside providers ────────────────────────

function RootNavigator() {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const { isReady } = useAppBoot();
  const configIssues = getCriticalConfigIssues();

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !supabase) return;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      void (async () => {
        const currentUser = useUserStore.getState().user;
        const currentProfile = useUserStore.getState().profile;

        if (session) {
          const guestId =
            currentUser?.type === 'guest'
              ? currentUser.guestId
              : currentUser?.guestId ?? null;
          const remoteProfile = await fetchRemoteProfile(session.access_token);
          let mergedGuestId = guestId;

          if (guestId && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
            const mergeResult = await apiRequest<{ merged_count: number; skipped_count: number }>(
              '/mergeGuestProgress',
              {
                method: 'POST',
                body: { guest_id: guestId },
                authToken: session.access_token,
              },
            );

            if (!mergeResult.error) {
              mergedGuestId = null;
              void queryClient.invalidateQueries({ queryKey: ['levels'] });
              void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
              void queryClient.invalidateQueries({ queryKey: ['profile'] });
            } else {
              console.warn('[auth] guest progress merge failed:', mergeResult.error);
            }
          }

          const authenticatedUser = buildAuthenticatedUser(
            session,
            mergedGuestId,
            remoteProfile ?? currentProfile,
          );
          useUserStore
            .getState()
            .setAuthenticatedUser(
              authenticatedUser,
              createAuthenticatedProfile(
                authenticatedUser.id,
                authenticatedUser.username,
                remoteProfile,
                currentProfile,
              ),
            );
          setUserContext(authenticatedUser.id, false);
          initAnalytics(authenticatedUser.id);
          await initRevenueCat(authenticatedUser.id);
          return;
        }

        if (currentUser?.type === 'authenticated') {
          resetAnalytics();
          clearUserContext();
          useUserStore.getState().initGuest();
        }
      })();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [isReady]);

  if (!isReady) {
    // Splash screen is still visible — render nothing
    return null;
  }

  if (configIssues.length > 0) {
    return <ConfigErrorScreen issues={configIssues} />;
  }

  return (
    <>
      <OfflineBanner />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: isDark ? Colors.bgDark : Colors.bgLight,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/callback" options={{ animation: 'fade' }} />
        <Stack.Screen name="game" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="store" />
      </Stack>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
