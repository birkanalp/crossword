import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore, selectUser, selectProfile, selectStreak } from '@/store/userStore';
import {
  useSettingsStore,
  selectSoundEnabled,
  selectHapticsEnabled,
  selectTheme,
} from '@/store/settingsStore';
import { Colors } from '@/constants/colors';
import { restorePurchases, ENTITLEMENTS } from '@/lib/revenuecat';
import { apiRequest } from '@/api/client';

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);

  const user = useUserStore(selectUser);
  const profile = useUserStore(selectProfile);
  const streak = useUserStore(selectStreak);
  const logout = useUserStore((s) => s.logout);

  // ─── Settings store ───────────────────────────────────────────────────────
  const soundEnabled = useSettingsStore(selectSoundEnabled);
  const hapticsEnabled = useSettingsStore(selectHapticsEnabled);
  const currentTheme = useSettingsStore(selectTheme);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isGuest = !user || user.type === 'guest';
  const displayName = isGuest ? 'Misafir' : (user as { username: string }).username;
  const avatarInitial = displayName[0]?.toUpperCase() ?? '?';

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  const authToken =
    user?.type === 'authenticated' ? (user.jwt ?? undefined) : undefined;

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Hesabı Sil',
      'Bu işlem geri alınamaz. Tüm ilerleme ve veriler kalıcı olarak silinecek.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: async () => {
            if (!authToken) {
              Alert.alert('Hata', 'Bu işlem için giriş yapmanız gerekiyor.');
              return;
            }
            setDeleting(true);
            try {
              const result = await apiRequest('/deleteAccount', {
                method: 'DELETE',
                authToken,
              });
              if (result.error) {
                Alert.alert('Hata', result.error);
                return;
              }
              logout();
              router.replace('/');
              Alert.alert('Hesap Silindi', 'Hesabınız başarıyla silindi.');
            } catch {
              Alert.alert('Hata', 'Hesap silinemedi. Lütfen tekrar deneyin.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [authToken, logout, router]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabından çıkış yapmak istediğine emin misin? İlerleme yerel olarak korunur.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/');
          },
        },
      ],
    );
  }, [logout, router]);

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          {!isGuest && (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>Çıkış</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Avatar + Name ───────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {isGuest ? (
            <TouchableOpacity onPress={handleSignIn} style={styles.signInCta}>
              <Text style={styles.signInText}>Giriş yap ve ilerlemeni kaydet →</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.emailLabel}>
              {(user as { email?: string }).email ?? ''}
            </Text>
          )}
        </View>

        {/* ─── Stats ───────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            label="Tamamlanan"
            value={String(profile?.levelsCompleted ?? 0)}
            isDark={isDark}
          />
          <StatCard label="Seri" value={`${streak.currentStreak}🔥`} isDark={isDark} />
          <StatCard label="Puan" value={String(profile?.totalScore ?? 0)} isDark={isDark} />
        </View>

        {/* ─── Settings Section ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ayarlar</Text>

          <ToggleRow
            icon="🔊"
            label="Ses Efektleri"
            value={soundEnabled}
            onToggle={setSoundEnabled}
            isDark={isDark}
          />
          <ToggleRow
            icon="📳"
            label="Titreşim (Haptik)"
            value={hapticsEnabled}
            onToggle={setHapticsEnabled}
            isDark={isDark}
          />

          {/* Theme picker */}
          <View style={[themeStyles.container, { backgroundColor: isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary }]}>
            <Text style={themeStyles.icon}>🎨</Text>
            <Text style={[themeStyles.label, { color: isDark ? Colors.textOnDark : Colors.textPrimary }]}>Tema</Text>
            <View style={themeStyles.buttons}>
              {THEME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    themeStyles.btn,
                    currentTheme === opt.value && themeStyles.btnActive,
                  ]}
                  onPress={() => setTheme(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    themeStyles.btnText,
                    currentTheme === opt.value && themeStyles.btnTextActive,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ─── Purchases Section ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Satın Alımlar</Text>
          <SettingsRow
            icon="🔄"
            label="Satın Alımları Geri Yükle"
            onPress={handleRestorePurchases}
            disabled={restoring}
            isDark={isDark}
            rightContent={
              restoring ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : undefined
            }
          />
        </View>

        {/* ─── Danger Zone ─────────────────────────────────────────────────── */}
        {!isGuest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hesap</Text>
            <SettingsRow
              icon="🚪"
              label="Çıkış Yap"
              onPress={handleLogout}
              isDark={isDark}
              destructive
            />
            <SettingsRow
              icon="🗑️"
              label="Hesabı Sil"
              onPress={handleDeleteAccount}
              disabled={deleting}
              isDark={isDark}
              destructive
              rightContent={
                deleting ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : undefined
              }
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View
      style={[
        statStyles.card,
        { backgroundColor: isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary },
      ]}
    >
      <Text
        style={[statStyles.value, { color: isDark ? Colors.textOnDark : Colors.textPrimary }]}
      >
        {value}
      </Text>
      <Text
        style={[
          statStyles.label,
          { color: isDark ? Colors.textOnDarkSecondary : Colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 12 },
});

// ─── SettingsRow ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  onPress,
  disabled,
  isDark,
  destructive,
  rightContent,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
  destructive?: boolean;
  rightContent?: React.ReactNode;
}) {
  const rowBg = isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary;
  const labelColor = destructive
    ? Colors.error
    : isDark
      ? Colors.textOnDark
      : Colors.textPrimary;
  const chevronColor = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;

  return (
    <TouchableOpacity
      style={[rowStyles.row, { backgroundColor: rowBg }, disabled && rowStyles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={rowStyles.icon}>{icon}</Text>
      <Text style={[rowStyles.label, { color: labelColor }]}>{label}</Text>
      {rightContent ?? <Text style={[rowStyles.chevron, { color: chevronColor }]}>›</Text>}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 12,
  },
  disabled: { opacity: 0.6 },
  icon: { fontSize: 18 },
  label: { flex: 1, fontSize: 15, fontWeight: '500' },
  chevron: { fontSize: 20 },
});

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  isDark,
}: {
  icon: string;
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isDark: boolean;
}) {
  const rowBg = isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary;
  const labelColor = isDark ? Colors.textOnDark : Colors.textPrimary;

  return (
    <TouchableOpacity
      style={[rowStyles.row, { backgroundColor: rowBg }]}
      onPress={() => onToggle(!value)}
      activeOpacity={0.7}
    >
      <Text style={rowStyles.icon}>{icon}</Text>
      <Text style={[rowStyles.label, { color: labelColor }]}>{label}</Text>
      <View style={[toggleStyles.track, value && toggleStyles.trackOn]}>
        <View style={[toggleStyles.knob, value && toggleStyles.knobOn]} />
      </View>
    </TouchableOpacity>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackOn: { backgroundColor: Colors.primary },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  knobOn: { alignSelf: 'flex-end' },
});

// ─── Theme picker constants ────────────────────────────────────────────────────

const THEME_OPTIONS: Array<{ value: 'light' | 'dark' | 'system'; label: string }> = [
  { value: 'light', label: 'Açık' },
  { value: 'dark', label: 'Koyu' },
  { value: 'system', label: 'Sistem' },
];

const themeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
  },
  icon: { fontSize: 18 },
  label: { flex: 1, fontSize: 15, fontWeight: '500' },
  buttons: { flexDirection: 'row', gap: 6 },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  btnActive: { backgroundColor: Colors.primary },
  btnText: { fontSize: 12, fontWeight: '600', color: '#888' },
  btnTextActive: { color: '#fff' },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────

function makeStyles(isDark: boolean) {
  const bg = isDark ? Colors.bgDark : Colors.bgLight;
  const text = isDark ? Colors.textOnDark : Colors.textPrimary;
  const sub = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: bg },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 48 },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    backBtn: { padding: 8, marginRight: 8 },
    backIcon: { fontSize: 22, color: text },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: text,
    },
    logoutBtn: {
      padding: 8,
    },
    logoutBtnText: {
      fontSize: 15,
      color: Colors.error,
      fontWeight: '600',
    },

    avatarSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
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
    name: { fontSize: 22, fontWeight: '700', color: text, marginBottom: 4 },
    emailLabel: { fontSize: 14, color: sub },
    signInCta: { marginTop: 8 },
    signInText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },

    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: sub,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
  });
}
