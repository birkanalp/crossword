import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDailyPuzzle } from '@/api/hooks/useLevels';
import { useUserStore, selectUser } from '@/store/userStore';
import { Colors } from '@/constants/colors';

// ─── Levels Browser Screen ───────────────────────────────────────────────────
// Shows playable levels. Uses getDailyChallenge to get at least one level (UUID).
// Contract: getLevel requires UUID; listLevels is not yet in contract (CR pending).
// Navigation to /game/level/[id] uses actual level UUID from fetched data only.

export default function LevelsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);
  const user = useUserStore(selectUser);
  const guestId = user?.type === 'guest' ? user.guestId : undefined;

  const { data: daily, isLoading, isError, error, refetch } = useDailyPuzzle(
    guestId ? { guestId } : {},
  );

  const handlePlayLevel = (levelId: string) => {
    router.push(`/game/level/${levelId}`);
  };

  const handleBack = () => router.back();

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.text}>Seviyeler yükleniyor...</Text>
      </View>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error ? error.message : 'Seviyeler yüklenemedi';
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.errorTitle}>Seviyeler yüklenemedi</Text>
        <Text style={styles.errorDetail}>{errorMessage}</Text>
        <TouchableOpacity onPress={() => void refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backText}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backHeaderBtn}>
          <Text style={styles.backHeaderText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seviyeler</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {daily?.level && (
          <TouchableOpacity
            style={styles.levelCard}
            onPress={() => handlePlayLevel(daily.level.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardLabel}>GÜNLÜK BULMACA</Text>
            <Text style={styles.cardTitle}>{daily.level.title}</Text>
            <Text style={styles.cardSubtitle}>
              Her gün yeni bir meydan okuma
            </Text>
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText}>Oyna →</Text>
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>
            Daha fazla seviye yakında eklenecek.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(isDark: boolean) {
  const bg = isDark ? Colors.bgDark : Colors.bgLight;
  const text = isDark ? Colors.textOnDark : Colors.textPrimary;
  const sub = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: bg,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 16,
      gap: 12,
    },
    backHeaderBtn: {
      padding: 8,
    },
    backHeaderText: {
      fontSize: 16,
      color: Colors.primary,
      fontWeight: '600',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: text,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingTop: 0,
      gap: 16,
    },
    levelCard: {
      backgroundColor: Colors.primary,
      borderRadius: 18,
      padding: 20,
      gap: 6,
    },
    cardLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: 'rgba(255,255,255,0.7)',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.textOnPrimary,
    },
    cardSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    cardCta: {
      marginTop: 8,
    },
    cardCtaText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
    },
    comingSoon: {
      padding: 20,
      alignItems: 'center',
    },
    comingSoonText: {
      fontSize: 14,
      color: sub,
    },
    text: {
      fontSize: 16,
      color: text,
      textAlign: 'center',
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: text,
      textAlign: 'center',
      marginBottom: 8,
    },
    errorDetail: {
      fontSize: 14,
      color: sub,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryBtn: {
      marginTop: 8,
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
    backBtn: {
      marginTop: 16,
      paddingVertical: 8,
    },
    backText: {
      fontSize: 15,
      color: Colors.primary,
      fontWeight: '600',
    },
  });
}
