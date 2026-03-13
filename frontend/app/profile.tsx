import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore, selectUser, selectProfile, selectStreak } from '@/store/userStore';
import { Colors } from '@/constants/colors';
import { restorePurchases, ENTITLEMENTS } from '@/lib/revenuecat';

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);

  const user = useUserStore(selectUser);
  const profile = useUserStore(selectProfile);
  const streak = useUserStore(selectStreak);

  const [restoring, setRestoring] = useState(false);

  const isGuest = !user || user.type === 'guest';
  const displayName = isGuest ? 'Misafir' : (user as { username: string }).username;

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  const handleRestorePurchases = useCallback(async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      const hasPremium =
        info?.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
      if (hasPremium) {
        Alert.alert(
          'Satın Alımlar Geri Yüklendi',
          'Premium erişiminiz aktifleştirildi.',
        );
      } else {
        Alert.alert(
          'Geri Yükleme Tamamlandı',
          'Bu hesapta aktif bir satın alım bulunamadı.',
        );
      }
    } catch {
      Alert.alert('Hata', 'Satın alımlar geri yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setRestoring(false);
    }
  }, []);

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

      {/* ─── Settings Section ──────────────────────────────────────────── */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Ayarlar</Text>

        <TouchableOpacity
          style={[styles.settingsRow, restoring && styles.settingsRowDisabled]}
          onPress={handleRestorePurchases}
          disabled={restoring}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsRowIcon}>🔄</Text>
          <Text style={styles.settingsRowLabel}>Satın Alımları Geri Yükle</Text>
          {restoring ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.settingsRowChevron}>›</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(isDark: boolean) {
  const text = isDark ? Colors.textOnDark : Colors.textPrimary;
  const sub = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;
  const rowBg = isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? Colors.bgDark : Colors.bgLight,
      padding: 24,
      paddingTop: 52,
      alignItems: 'center',
    },
    backBtn: { alignSelf: 'flex-start', marginBottom: 24 },
    backIcon: { fontSize: 22, color: text },
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
    name: { fontSize: 22, fontWeight: '700', color: text },
    signInCta: { marginTop: 8, marginBottom: 4 },
    signInText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
    stats: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },

    // Settings section
    settingsSection: {
      width: '100%',
      marginTop: 32,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: sub,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: rowBg,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 8,
      gap: 12,
    },
    settingsRowDisabled: {
      opacity: 0.6,
    },
    settingsRowIcon: {
      fontSize: 18,
    },
    settingsRowLabel: {
      flex: 1,
      fontSize: 15,
      color: text,
      fontWeight: '500',
    },
    settingsRowChevron: {
      fontSize: 20,
      color: sub,
    },
  });
}
