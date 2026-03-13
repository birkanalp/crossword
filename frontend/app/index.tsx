import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore, selectUser, selectStreak, selectCoins } from '@/store/userStore';
import { Colors } from '@/constants/colors';
import { formatElapsedTime } from '@/hooks/useElapsedTimer';
import { AdBanner } from '@/components/ui/AdBanner';
import { hasNoAds } from '@/lib/revenuecat';

// ─── Home Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';

  const user = useUserStore(selectUser);
  const streak = useUserStore(selectStreak);
  const coins = useUserStore(selectCoins);

  const [noAdsActive, setNoAdsActive] = useState(false);
  useEffect(() => {
    hasNoAds().then(setNoAdsActive).catch(() => { /* default false */ });
  }, []);

  const styles = makeStyles(isDark);

  const displayName =
    !user ? 'Player' : user.type === 'guest' ? 'Guest' : user.username;

  const navigateToDaily = () => {
    router.push('/game/daily');
  };

  const navigateToLevels = () => {
    router.push('/game/levels');
  };

  const navigateToLeaderboard = () => {
    router.push('/leaderboard');
  };

  const navigateToStore = () => {
    router.push('/store');
  };

  const navigateToProfile = () => {
    router.push('/profile');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Merhaba, {displayName} 👋</Text>
          <Text style={styles.subtitle}>Bugünkü bulmacana hazır mısın?</Text>
        </View>
        <TouchableOpacity onPress={navigateToProfile} style={styles.coinBadge}>
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinText}>{coins}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Streak Banner ───────────────────────────────────────────────── */}
      <View style={styles.streakBanner}>
        <Text style={styles.streakFire}>🔥</Text>
        <View>
          <Text style={styles.streakCount}>{streak.currentStreak} günlük seri</Text>
          <Text style={styles.streakSub}>
            {streak.isTodayClaimed ? 'Bugün tamamlandı!' : 'Bugün oyna, seriyi koru!'}
          </Text>
        </View>
      </View>

      {/* ─── Daily Puzzle Card ───────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.card, styles.dailyCard]}
        onPress={navigateToDaily}
        activeOpacity={0.85}
      >
        <Text style={styles.cardLabel}>GÜNLÜK BULMACA</Text>
        <Text style={styles.cardTitle}>Her gün yeni bir meydan okuma</Text>
        <View style={styles.cardCta}>
          <Text style={styles.cardCtaText}>Oyna →</Text>
        </View>
      </TouchableOpacity>

      {/* ─── Continue / Level Browser ────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.card, styles.levelCard]}
        onPress={navigateToLevels}
        activeOpacity={0.85}
      >
        <Text style={styles.levelCardLabel}>SEVIYELER</Text>
        <Text style={styles.levelCardTitle}>Kolaydan zora tüm bulmacalar</Text>
        <View style={styles.cardCta}>
          <Text style={styles.levelCardCtaText}>Keşfet →</Text>
        </View>
      </TouchableOpacity>

      {/* ─── Quick Actions ────────────────────────────────────────────────── */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={navigateToLeaderboard}>
          <Text style={styles.quickIcon}>🏆</Text>
          <Text style={styles.quickLabel}>Sıralama</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={navigateToStore}>
          <Text style={styles.quickIcon}>🪙</Text>
          <Text style={styles.quickLabel}>Mağaza</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={navigateToProfile}>
          <Text style={styles.quickIcon}>👤</Text>
          <Text style={styles.quickLabel}>Profil</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Banner Ad ────────────────────────────────────────────────────── */}
      <AdBanner hideAds={noAdsActive} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(isDark: boolean) {
  const bg = isDark ? Colors.bgDark : Colors.bgLight;
  const cardBg = isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary;
  const text = isDark ? Colors.textOnDark : Colors.textPrimary;
  const sub = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: bg,
    },
    content: {
      padding: 20,
      paddingTop: 60,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    greeting: {
      fontSize: 22,
      fontWeight: '700',
      color: text,
    },
    subtitle: {
      fontSize: 14,
      color: sub,
      marginTop: 2,
    },
    coinBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? Colors.bgDarkSecondary : '#FFF8E1',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    coinIcon: { fontSize: 16 },
    coinText: {
      fontSize: 15,
      fontWeight: '700',
      color: Colors.coin,
    },
    streakBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDark ? '#2d1a00' : '#FFF3E0',
      padding: 14,
      borderRadius: 14,
    },
    streakFire: { fontSize: 28 },
    streakCount: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.warning,
    },
    streakSub: {
      fontSize: 12,
      color: sub,
      marginTop: 2,
    },
    card: {
      borderRadius: 18,
      padding: 20,
      gap: 6,
    },
    dailyCard: {
      backgroundColor: Colors.primary,
    },
    levelCard: {
      backgroundColor: cardBg,
      borderWidth: isDark ? 0 : 1,
      borderColor: '#EBEBEB',
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
    cardCta: {
      marginTop: 4,
    },
    cardCtaText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
    },
    levelCardLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: sub,
    },
    levelCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: text,
    },
    levelCardCtaText: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.primary,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    quickBtn: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      backgroundColor: cardBg,
      padding: 16,
      borderRadius: 14,
      borderWidth: isDark ? 0 : 1,
      borderColor: '#EBEBEB',
    },
    quickIcon: { fontSize: 24 },
    quickLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: sub,
    },
  });
}
