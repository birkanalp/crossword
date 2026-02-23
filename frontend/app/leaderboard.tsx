import React from 'react';
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

// ─── Leaderboard Screen ───────────────────────────────────────────────────────
// TODO: Wire up useDailyLeaderboard and useLevelLeaderboard hooks.
// TODO: Add tab switcher (Daily / Level).
// TODO: Animate rank entry on mount.

export default function LeaderboardScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);

  return (
    <View style={styles.root}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>🏆 Sıralama</Text>
      <Text style={styles.placeholder}>Yakında — liderlik tablosu burada görünecek.</Text>
    </View>
  );
}

function makeStyles(isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? Colors.bgDark : Colors.bgLight,
      padding: 24,
      paddingTop: 52,
    },
    backBtn: { marginBottom: 16 },
    backIcon: { fontSize: 22, color: isDark ? Colors.textOnDark : Colors.textPrimary },
    title: { fontSize: 26, fontWeight: '800', color: isDark ? Colors.textOnDark : Colors.textPrimary },
    placeholder: { marginTop: 12, color: isDark ? Colors.textOnDarkSecondary : Colors.textSecondary },
  });
}
