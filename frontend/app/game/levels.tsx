import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useListLevels, type LevelSummary } from '@/api/hooks/useLevels';
import { useUserStore, selectUser } from '@/store/userStore';
import { Colors } from '@/constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PaywallModal } from '@/components/PaywallModal';

// ─── Levels Browser Screen ───────────────────────────────────────────────────
// 3-column grid, difficulty-colored boxes, completion states, Load more, filter sidebar.
// Contract: listLevels (api.contract.json#/endpoints/listLevels)

const DIFFICULTY_ORDER: Array<'easy' | 'medium' | 'hard' | 'expert'> = [
  'easy',
  'medium',
  'hard',
  'expert',
];

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
  expert: 'Uzman',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#34C759',
  medium: '#5AC8FA',
  hard: '#FF9500',
  expert: '#AF52DE',
};

type LevelStatus = 'completed' | 'in_progress' | 'not_started';

function getLevelStatus(level: LevelSummary): LevelStatus {
  if (!level.progress) return 'not_started';
  return level.progress.completed_at ? 'completed' : 'in_progress';
}

export default function LevelsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const { width } = useWindowDimensions();
  const styles = makeStyles(isDark, width);
  const user = useUserStore(selectUser);
  const guestId = user?.type === 'guest' ? user.guestId : undefined;

  const [filterOpen, setFilterOpen] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<Set<string>>(
    new Set(DIFFICULTY_ORDER),
  );
  const [pages, setPages] = useState<Record<string, number>>({
    easy: 0,
    medium: 0,
    hard: 0,
    expert: 0,
  });

  const difficulties = Array.from(difficultyFilter).sort(
    (a, b) =>
      DIFFICULTY_ORDER.indexOf(a as (typeof DIFFICULTY_ORDER)[number]) -
      DIFFICULTY_ORDER.indexOf(b as (typeof DIFFICULTY_ORDER)[number]),
  ) as Array<'easy' | 'medium' | 'hard' | 'expert'>;

  const handleLoadMore = useCallback((diff: string) => {
    setPages((p) => ({ ...p, [diff]: (p[diff] ?? 0) + 1 }));
  }, []);

  const toggleDifficulty = useCallback((diff: string) => {
    setDifficultyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(diff)) next.delete(diff);
      else next.add(diff);
      return next;
    });
  }, []);

  const handlePlayLevel = (level: LevelSummary) => {
    if (level.is_premium) {
      setPaywallVisible(true);
      return;
    }
    router.push(`/game/level/${level.id}`);
  };

  const handleBack = () => router.back();

  // ── 4 queries (hooks must be called unconditionally) ───────────────────────
  const INITIAL_LIMIT = 14;
  const PAGE_SIZE = 10;
  const limit = (diff: string) =>
    INITIAL_LIMIT + PAGE_SIZE * (pages[diff] ?? 0);
  const sharedListOpts = {
    ...(guestId !== undefined ? { guestId } : {}),
    hide_completed: hideCompleted,
    sort: 'last_completed_first' as const,
    offset: 0,
  };
  const easyData = useListLevels({
    ...sharedListOpts,
    difficulty: 'easy',
    limit: limit('easy'),
  });
  const mediumData = useListLevels({
    ...sharedListOpts,
    difficulty: 'medium',
    limit: limit('medium'),
  });
  const hardData = useListLevels({
    ...sharedListOpts,
    difficulty: 'hard',
    limit: limit('hard'),
  });
  const expertData = useListLevels({
    ...sharedListOpts,
    difficulty: 'expert',
    limit: limit('expert'),
  });

  const queries = {
    easy: easyData,
    medium: mediumData,
    hard: hardData,
    expert: expertData,
  };

  const anyLoading = Object.values(queries).some((q) => q.isLoading);
  const anyError = Object.values(queries).some((q) => q.isError);
  const firstError = Object.values(queries).find((q) => q.isError);
  const refetch = () => {
    Object.values(queries).forEach((q) => void q.refetch());
  };

  if (anyLoading && difficulties.length > 0) {
    const hasAnyData = difficulties.some(
      (d) => (queries[d as keyof typeof queries]?.data?.levels?.length ?? 0) > 0,
    );
    if (!hasAnyData) {
      return (
        <View style={[styles.root, styles.centered]}>
          <Text style={styles.text}>Seviyeler yükleniyor...</Text>
        </View>
      );
    }
  }

  if (anyError) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.errorTitle}>Seviyeler yüklenemedi</Text>
        <Text style={styles.errorDetail}>
          {firstError?.error instanceof Error
            ? firstError.error.message
            : 'Bilinmeyen hata'}
        </Text>
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
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={styles.filterBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={24}
            color={isDark ? Colors.textOnDark : Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {difficulties.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Filtre seçin</Text>
            <Text style={styles.emptySubtitle}>
              En az bir zorluk seviyesi seçin.
            </Text>
          </View>
        ) : (
          difficulties.map((diff) => {
            const q = queries[diff as keyof typeof queries];
            const items = q?.data?.levels ?? [];
            const total = q?.data?.total ?? 0;
            const diffLimit = limit(diff);
            const showLoadMore = items.length >= PAGE_SIZE && total > diffLimit;
            const diffColor = DIFFICULTY_COLORS[diff] ?? Colors.primary;
            return (
              <View key={diff} style={styles.diffBlock}>
                <View style={styles.grid}>
                  {items.map((level) => (
                    <LevelBox
                      key={level.id}
                      level={level}
                      onPress={() => handlePlayLevel(level)}
                      styles={styles}
                    />
                  ))}
                  {showLoadMore && (
                    <TouchableOpacity
                      style={[styles.loadMoreBox, { borderColor: diffColor }]}
                      onPress={() => handleLoadMore(diff)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.loadMoreText, { color: diffColor }]}>
                        + Daha fazla
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPremiumUnlocked={() => {
          // Refetch level list so premium levels become playable
          Object.values(queries).forEach((q) => void q.refetch());
        }}
      />

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setFilterOpen(false)}
        >
          <Pressable
            style={styles.filterSidebar}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filtreler</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}>
                <Text style={styles.filterClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.filterRow}
              onPress={() => setHideCompleted((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterLabel}>Tamamlananları gizle</Text>
              <View style={[styles.toggle, hideCompleted && styles.toggleOn]}>
                <View
                  style={[styles.toggleKnob, hideCompleted && styles.toggleKnobOn]}
                />
              </View>
            </TouchableOpacity>
            <Text style={styles.filterSectionTitle}>Zorluk seviyeleri</Text>
            {DIFFICULTY_ORDER.map((d) => (
              <TouchableOpacity
                key={d}
                style={styles.filterRow}
                onPress={() => toggleDifficulty(d)}
                activeOpacity={0.7}
              >
                <Text style={styles.filterLabel}>{DIFFICULTY_LABELS[d]}</Text>
                <View
                  style={[
                    styles.checkbox,
                    difficultyFilter.has(d) && {
                      backgroundColor: DIFFICULTY_COLORS[d],
                    },
                  ]}
                >
                  {difficultyFilter.has(d) && (
                    <Text style={styles.checkboxCheck}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function LevelBox({
  level,
  onPress,
  styles: s,
}: {
  level: LevelSummary;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const status = getLevelStatus(level);
  const diffColor = DIFFICULTY_COLORS[level.difficulty] ?? Colors.primary;
  const isPremiumLocked = level.is_premium;

  return (
    <TouchableOpacity
      style={[
        s.levelBox,
        { backgroundColor: diffColor },
        isPremiumLocked && s.levelBoxLocked,
        status === 'completed' && s.levelBoxCompleted,
        status === 'in_progress' && { borderWidth: 3, borderColor: diffColor },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {isPremiumLocked && (
        <View style={s.lockOverlay}>
          <MaterialCommunityIcons name="lock" size={22} color="rgba(255,255,255,0.9)" />
        </View>
      )}
      {!isPremiumLocked && status === 'completed' && (
        <View style={s.levelBoxCheck}>
          <MaterialCommunityIcons name="check" size={28} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(isDark: boolean, screenWidth: number) {
  const padding = 20;
  const gap = 12;
  const cols = 5;
  const boxSize = (screenWidth - padding * 2 - gap * (cols - 1)) / cols;
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
      flex: 1,
      fontSize: 22,
      fontWeight: '700',
      color: text,
    },
    filterBtn: {
      padding: 8,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding,
      paddingTop: 0,
      paddingBottom: 40,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: sub,
    },
    diffBlock: {
      marginBottom: 24,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap,
    },
    levelBox: {
      width: boxSize,
      height: boxSize,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelBoxCompleted: {
      opacity: 0.6,
    },
    levelBoxLocked: {
      opacity: 0.55,
    },
    levelBoxCheck: {
      position: 'absolute',
    },
    lockOverlay: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadMoreBox: {
      width: boxSize,
      height: boxSize,
      borderRadius: 16,
      borderWidth: 2,
      borderStyle: 'dashed',
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadMoreText: {
      fontSize: 12,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    filterSidebar: {
      width: 280,
      height: '100%',
      backgroundColor: isDark ? Colors.bgDarkSecondary : Colors.bgLight,
      paddingTop: 60,
      paddingHorizontal: 20,
    },
    filterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    filterTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: text,
    },
    filterClose: {
      fontSize: 24,
      color: sub,
      padding: 8,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    },
    filterLabel: {
      fontSize: 16,
      color: text,
    },
    filterSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: sub,
      marginTop: 20,
      marginBottom: 8,
    },
    toggle: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? '#444' : '#ccc',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    toggleOn: {
      backgroundColor: Colors.primary,
    },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#fff',
      alignSelf: 'flex-start',
    },
    toggleKnobOn: {
      alignSelf: 'flex-end',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: isDark ? '#666' : '#999',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxCheck: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
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
