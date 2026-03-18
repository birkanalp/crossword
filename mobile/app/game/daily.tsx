import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useDailyPuzzle } from '@/api/hooks/useLevels';
import { Colors } from '@/constants/colors';

// ─── Daily Puzzle Screen ──────────────────────────────────────────────────────
// Fetches the daily puzzle and navigates into the level screen.
// Acts as a thin routing bridge — the game engine lives in [id].tsx.

export default function DailyScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);

  const { data: daily, isLoading, isError, refetch } = useDailyPuzzle();

  // Once the daily is loaded, navigate into it as a regular level
  useEffect(() => {
    if (daily?.level?.id) {
      // Replace so pressing back from the level goes to home, not this bridge
      router.replace(`/game/level/${daily.level.id}`);
    }
  }, [daily?.level?.id, router]);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.text}>Günlük bulmaca yükleniyor...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.text}>Yüklenemedi. İnternet bağlantını kontrol et.</Text>
        <TouchableOpacity onPress={() => void refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

function makeStyles(isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? Colors.bgDark : Colors.bgLight,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    text: {
      fontSize: 16,
      color: isDark ? Colors.textOnDark : Colors.textPrimary,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: Colors.primary,
      borderRadius: 12,
    },
    retryText: {
      color: Colors.textOnPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
  });
}
