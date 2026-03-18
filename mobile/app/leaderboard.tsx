import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useLeaderboard,
  type LeaderboardEntry,
  type LeaderboardType,
  type LeaderboardSortBy,
} from '@/api/hooks/useLeaderboard';
import { useUserStore, selectUser } from '@/store/userStore';
import { formatTime, getInitials, formatScore } from '@/utils/format';

// ─── Colour palette ───────────────────────────────────────────────────────────

const C = {
  bg: '#0f0617',
  card: '#1e1035',
  elevated: '#2a1d4a',
  accent: '#7c3aed',
  accentLight: 'rgba(124,58,237,0.25)',
  goldBg: 'rgba(251,191,36,0.18)',
  silverBg: 'rgba(156,163,175,0.18)',
  bronzeBg: 'rgba(217,119,6,0.18)',
  text: '#f3f0ff',
  subtext: '#9b8abf',
  myEntry: 'rgba(124,58,237,0.22)',
  myEntryBorder: 'rgba(124,58,237,0.7)',
} as const;

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  label: string;
  type: LeaderboardType;
  sort_by: LeaderboardSortBy;
}

const TABS: TabDef[] = [
  { label: 'Günlük', type: 'daily', sort_by: 'score' },
  { label: 'Tüm Zamanlar', type: 'all_time', sort_by: 'score' },
  { label: 'En Hızlı', type: 'all_time', sort_by: 'time' },
];

// ─── Fixed row height — enables FlatList.getItemLayout ────────────────────────

const ITEM_HEIGHT = 66;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const router = useRouter();

  // Optional query params from in-game navigation
  // e.g. /leaderboard?type=puzzle&level_id=<uuid>
  const params = useLocalSearchParams<{
    type?: string;
    level_id?: string;
  }>();

  const isPuzzleMode = params.type === 'puzzle' && !!params.level_id;

  const [activeTab, setActiveTab] = useState(0);
  // Each tab carries its own independent page cursor so switching tabs doesn't
  // reset "load more" state on the previously viewed tab.
  const [pages, setPages] = useState<[number, number, number]>([0, 0, 0]);
  const [refreshing, setRefreshing] = useState(false);

  const user = useUserStore(selectUser);
  const guestId = user?.type === 'guest' ? user.guestId : undefined;

  const tab = TABS[activeTab] ?? TABS[0]!;
  const currentPage = pages[activeTab] ?? 0;

  const effectiveType: LeaderboardType = isPuzzleMode ? 'puzzle' : tab.type;
  const effectiveSortBy: LeaderboardSortBy = isPuzzleMode ? 'score' : tab.sort_by;
  const effectiveLevelId = isPuzzleMode ? params.level_id : undefined;

  const { data, isLoading, isFetching, isError, refetch } = useLeaderboard({
    type: effectiveType,
    sort_by: effectiveSortBy,
    ...(effectiveLevelId !== undefined ? { level_id: effectiveLevelId } : {}),
    limit: 50,
    page: currentPage,
    ...(guestId !== undefined ? { guestId } : {}),
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Reset page for current tab so we get fresh first-page data
    setPages((prev) => {
      const next: [number, number, number] = [...prev] as [number, number, number];
      next[activeTab] = 0;
      return next;
    });
    await refetch();
    setRefreshing(false);
  }, [refetch, activeTab]);

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!data || data.entries.length >= data.total) return;
    setPages((prev) => {
      const next: [number, number, number] = [...prev] as [number, number, number];
      next[activeTab] = (prev[activeTab] ?? 0) + 1;
      return next;
    });
  }, [data, activeTab]);

  const myUserId = data?.my_entry?.user_id;

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <EntryRow
        entry={item}
        isMine={myUserId === item.user_id}
        sortBy={effectiveSortBy}
      />
    ),
    [myUserId, effectiveSortBy],
  );

  const keyExtractor = useCallback(
    (item: LeaderboardEntry) => `${item.user_id}-${item.rank}`,
    [],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const ListFooter = useMemo(() => {
    if (!data || data.entries.length >= data.total) return null;
    return (
      <TouchableOpacity
        style={footerStyles.btn}
        onPress={handleLoadMore}
        activeOpacity={0.8}
      >
        {isFetching && currentPage > 0 ? (
          <ActivityIndicator color={C.accent} size="small" />
        ) : (
          <Text style={footerStyles.text}>Daha Fazla Yükle</Text>
        )}
      </TouchableOpacity>
    );
  }, [data, isFetching, currentPage, handleLoadMore]);

  const ListEmpty = useMemo(() => {
    if (isLoading) {
      // Skeleton rows while first page loads
      return (
        <View>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.centeredPadded}>
          <Text style={styles.errorText}>Lider tablosu yüklenemedi</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void refetch()}
          >
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centeredPadded}>
        <Text style={styles.emptyEmoji}>🏆</Text>
        <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
        <Text style={styles.emptySub}>İlk sıraya giren sen ol!</Text>
      </View>
    );
  }, [isLoading, isError, refetch]);

  // Show my_entry pinned at screen bottom when not in the visible list
  const myEntryPinned =
    data?.my_entry &&
    data.entries.length > 0 &&
    !data.entries.some((e) => e.user_id === data.my_entry?.user_id);

  return (
    <View style={styles.root}>
      {/* ─── Gradient header ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1a0533', '#2d1b69']}
        style={styles.gradientHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          {/* Title row */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isPuzzleMode ? 'Bulmaca Sıralaması' : 'Lider Tablosu'}
            </Text>
            {/* Spacer keeps title centred */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Tab bar — hidden in puzzle mode (only one view) */}
          {!isPuzzleMode && (
            <View style={styles.tabBar}>
              {TABS.map((t, i) => (
                <TouchableOpacity
                  key={t.label}
                  style={[styles.tab, activeTab === i && styles.tabActive]}
                  onPress={() => handleTabChange(i)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === i && styles.tabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* ─── Entry list ────────────────────────────────────────────────────── */}
      <FlatList
        data={isLoading ? [] : (data?.entries ?? [])}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
      />

      {/* ─── Pinned "my entry" when outside visible window ─────────────────── */}
      {myEntryPinned && data?.my_entry && (
        <View style={styles.myEntryFooter}>
          <Text style={styles.myEntryLabel}>Senin sıran</Text>
          <EntryRow
            entry={data.my_entry}
            isMine
            sortBy={effectiveSortBy}
          />
        </View>
      )}
    </View>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
// Shown during initial load to avoid layout jumps.

function SkeletonRow() {
  return (
    <View style={skeletonStyles.row}>
      <View style={skeletonStyles.rank} />
      <View style={skeletonStyles.avatar} />
      <View style={skeletonStyles.textBlock}>
        <View style={skeletonStyles.nameLine} />
        <View style={skeletonStyles.subLine} />
      </View>
      <View style={skeletonStyles.value} />
    </View>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

interface EntryRowProps {
  entry: LeaderboardEntry;
  isMine: boolean;
  sortBy: LeaderboardSortBy;
}

// Memoised: only re-renders when entry data or highlight status changes.
// With getItemLayout + memo this makes 50-row lists run at 60 fps.
const EntryRow = React.memo(function EntryRow({
  entry,
  isMine,
  sortBy,
}: EntryRowProps) {
  const initials = getInitials(entry.display_name);
  const valueText =
    sortBy === 'time'
      ? formatTime(entry.completion_time)
      : formatScore(entry.score);
  const valueColor = sortBy === 'time' ? '#60a5fa' : C.accent;

  return (
    <View
      style={[
        itemStyles.row,
        isMine && itemStyles.rowMine,
      ]}
    >
      <RankBadge rank={entry.rank} />

      <View style={[itemStyles.avatar, { backgroundColor: entry.avatar_color }]}>
        <Text style={itemStyles.avatarText}>{initials}</Text>
      </View>

      <View style={itemStyles.nameBlock}>
        <View style={itemStyles.nameRow}>
          <Text style={itemStyles.name} numberOfLines={1}>
            {entry.display_name}
          </Text>
          {isMine && (
            <View style={itemStyles.senBadge}>
              <Text style={itemStyles.senText}>Sen</Text>
            </View>
          )}
        </View>
        <Text style={itemStyles.subtitle} numberOfLines={1}>
          Hata: {entry.mistakes} | İpucu: {entry.hints_used}
        </Text>
      </View>

      <Text style={[itemStyles.value, { color: valueColor }]}>{valueText}</Text>
    </View>
  );
});

// ─── Rank Badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <View style={[badgeStyles.badge, { backgroundColor: C.goldBg }]}>
        <Text style={badgeStyles.emoji}>🥇</Text>
      </View>
    );
  }
  if (rank === 2) {
    return (
      <View style={[badgeStyles.badge, { backgroundColor: C.silverBg }]}>
        <Text style={badgeStyles.emoji}>🥈</Text>
      </View>
    );
  }
  if (rank === 3) {
    return (
      <View style={[badgeStyles.badge, { backgroundColor: C.bronzeBg }]}>
        <Text style={badgeStyles.emoji}>🥉</Text>
      </View>
    );
  }
  return (
    <View style={[badgeStyles.badge, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
      <Text style={badgeStyles.number}>{rank}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  gradientHeader: {
    // Height determined by SafeAreaView + content
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: '#fff',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  headerSpacer: {
    width: 36,
  },

  // ── Tab bar ──────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
  },
  tabTextActive: {
    color: '#2d1b69',
  },

  // ── List ────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // ── Empty / error states ─────────────────────────────────────────────
  centeredPadded: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: C.subtext,
    textAlign: 'center',
  },

  // ── My entry pinned footer ────────────────────────────────────────────
  myEntryFooter: {
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(124,58,237,0.6)',
  },
  myEntryLabel: {
    fontSize: 11,
    color: C.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    height: ITEM_HEIGHT,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: C.card,
  },
  rowMine: {
    backgroundColor: C.myEntry,
    borderWidth: 1.5,
    borderColor: C.myEntryBorder,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    flexShrink: 1,
  },
  senBadge: {
    backgroundColor: 'rgba(124,58,237,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  senText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c4b5fd',
  },
  subtitle: {
    fontSize: 11,
    color: C.subtext,
    marginTop: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 52,
    textAlign: 'right',
  },
});

const badgeStyles = StyleSheet.create({
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  number: {
    fontSize: 14,
    fontWeight: '800',
    color: C.subtext,
  },
});

const footerStyles = StyleSheet.create({
  btn: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 13,
    backgroundColor: C.elevated,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    color: C.accent,
  },
});

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    height: ITEM_HEIGHT,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: C.card,
  },
  rank: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  textBlock: { flex: 1, gap: 6 },
  nameLine: {
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.07)',
    width: '50%',
  },
  subLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    width: '35%',
  },
  value: {
    width: 44,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
});
