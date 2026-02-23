import React from 'react';
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore, selectUser, selectProfile, selectStreak } from '@/store/userStore';
import { Colors } from '@/constants/colors';

// ─── Profile Screen ───────────────────────────────────────────────────────────
// TODO: Add avatar upload, settings panel, sign-out confirmation.

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);

  const user = useUserStore(selectUser);
  const profile = useUserStore(selectProfile);
  const streak = useUserStore(selectStreak);

  const isGuest = !user || user.type === 'guest';
  const displayName = isGuest ? 'Misafir' : (user as { username: string }).username;

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  return (
    <View style={styles.root}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() ?? '?'}</Text>
      </View>

      <Text style={styles.name}>{displayName}</Text>
      {isGuest && (
        <TouchableOpacity onPress={handleSignIn} style={styles.signInCta}>
          <Text style={styles.signInText}>Giriş yap ve ilerlemeni kaydet →</Text>
        </TouchableOpacity>
      )}

      <View style={styles.stats}>
        <StatCard label="Tamamlanan" value={String(profile?.levelsCompleted ?? 0)} isDark={isDark} />
        <StatCard label="Seri" value={`${streak.currentStreak}🔥`} isDark={isDark} />
        <StatCard label="Puan" value={String(profile?.totalScore ?? 0)} isDark={isDark} />
      </View>

      {/* TODO: Settings panel (sound, haptics, theme) */}
    </View>
  );
}

function StatCard({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={[statStyles.card, { backgroundColor: isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary }]}>
      <Text style={[statStyles.value, { color: isDark ? Colors.textOnDark : Colors.textPrimary }]}>{value}</Text>
      <Text style={[statStyles.label, { color: isDark ? Colors.textOnDarkSecondary : Colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 12 },
});

function makeStyles(isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? Colors.bgDark : Colors.bgLight,
      padding: 24,
      paddingTop: 52,
      alignItems: 'center',
    },
    backBtn: { alignSelf: 'flex-start', marginBottom: 24 },
    backIcon: { fontSize: 22, color: isDark ? Colors.textOnDark : Colors.textPrimary },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    avatarText: { fontSize: 36, fontWeight: '700', color: Colors.textOnPrimary },
    name: { fontSize: 22, fontWeight: '700', color: isDark ? Colors.textOnDark : Colors.textPrimary },
    signInCta: { marginTop: 8, marginBottom: 4 },
    signInText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
    stats: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
  });
}
