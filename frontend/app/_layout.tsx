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

// ─── Keep the splash screen visible until boot completes ─────────────────────
SplashScreen.preventAutoHideAsync();

// ─── Initialise Sentry as early as possible ───────────────────────────────────
initSentry();

// ─── Wire up persistence subscriptions ───────────────────────────────────────
setupStoreSubscriptions();

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// ─── Inner component so hooks can run inside providers ────────────────────────

function RootNavigator() {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const { isReady } = useAppBoot();

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    // Splash screen is still visible — render nothing
    return null;
  }

  return (
    <>
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
