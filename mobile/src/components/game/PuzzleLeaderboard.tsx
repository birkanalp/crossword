import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLeaderboard, type LeaderboardEntry, type LeaderboardSortBy } from '@/api/hooks/useLeaderboard';
import { formatTime, getInitials, formatScore } from '@/utils/format';

// ─── Colour palette (dark purple game theme) ──────────────────────────────────

const C = {
  bg: '#0f0617',
  card: '#1e1035',
  accent: '#7c3aed',
  gold: '#fbbf24',
  silver: '#9ca3af',
  bronze: '#d97706',
  text: '#f3f0ff',
  subtext: '#9b8abf',
  surface: 'rgba(255,255,255,0.06)',
  myEntry: 'rgba(124,58,237,0.25)',
  myEntryBorder: '#7c3aed',
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PuzzleLeaderboardProps {
  levelId: string;
  /** Auth token — if available enables my_entry highlight */
  authToken?: string;
  /** Guest ID for anonymous users */
  guestId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
// Compact leaderboard designed to live inside a completion modal.
// Top-10 list, sort toggle, "full leaderboard" link.

export const PuzzleLeaderboard = React.memo(function PuzzleLeaderboard({
  levelId,
  authToken,
  guestId,
}: PuzzleLeaderboardProps) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('score');

  const { data, isLoading, isError, refetch } = useLeaderboard({
    type: 'puzzle',
    sort_by: sortBy,
    level_id: levelId,
    limit: 10,
    page: 0,
    ...(authToken !== undefined ? { authToken } : {}),
    ...(guestId !== undefined ? { guestId } : {}),
  });

  const handleSortToggle = useCallback((next: LeaderboardSortBy) => {
    setSortBy(next);
  }, []);

  const handleFullLeaderboard = useCallback(() => {
    // Navigate to full screen leaderboard filtered to this puzzle
    router.push(
      `/leaderboard?type=puzzle&level_id=${encodeURIComponent(levelId)}` as never,
    );
  }, [router, levelId]);

  const renderEntry = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <EntryRow
        entry={item}
        isMine={data?.my_entry?.user_id === item.user_id}
        sortBy={sortBy}
      />
    ),
    [data?.my_entry?.user_id, sortBy],
  );

  const keyExtractor = useCallback(
    (item: LeaderboardEntry) => `${item.user_id}-${item.rank}`,
    [],
  );

  return (
    <View style={styles.root}>
      {/* ─── Header row ─────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Bu Bulmacada</Text>
        <SortToggle current={sortBy} onChange={handleSortToggle} />
      </View>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.accent} size="small" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Yüklenemedi</Text>
          <TouchableOpacity onPress={() => void refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : !data || data.entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyText}>Henüz kayıt yok</Text>
          <Text style={styles.emptySub}>İlk sıraya gir!</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={data.entries}
            renderItem={renderEntry}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            style={{ maxHeight: 300 }}
          />

          {/* My entry at bottom if not in top-10 */}
          {data.my_entry &&
            !data.entries.some((e) => e.user_id === data.my_entry?.user_id) && (
              <View style={styles.myEntrySeparator}>
                <Text style={styles.myEntrySeparatorText}>Senin sıran</Text>
                <EntryRow
                  entry={data.my_entry}
                  isMine
                  sortBy={sortBy}
                />
              </View>
            )}

          <TouchableOpacity
            style={styles.fullBtn}
            onPress={handleFullLeaderboard}
            activeOpacity={0.8}
          >
            <Text style={styles.fullBtnText}>Tam Lider Tablosu →</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
});

// ─── Sort Toggle ──────────────────────────────────────────────────────────────

function SortToggle({
  current,
  onChange,
}: {
  current: LeaderboardSortBy;
  onChange: (v: LeaderboardSortBy) => void;
}) {
  return (
    <View style={toggleStyles.row}>
      <TouchableOpacity
        style={[
          toggleStyles.btn,
          current === 'score' && toggleStyles.btnActive,
        ]}
        onPress={() => onChange('score')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            toggleStyles.text,
            current === 'score' && toggleStyles.textActive,
          ]}
        >
          Puan
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          toggleStyles.btn,
          current === 'time' && toggleStyles.btnActive,
        ]}
        onPress={() => onChange('time')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            toggleStyles.text,
            current === 'time' && toggleStyles.textActive,
          ]}
        >
          Süre
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

interface EntryRowProps {
  entry: LeaderboardEntry;
  isMine: boolean;
  sortBy: LeaderboardSortBy;
}

// Memoised — only re-renders when entry data or highlight status changes
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
  const valueColor =
    sortBy === 'score' ? C.accent : '#3b82f6';

  return (
    <View
      style={[
        rowStyles.row,
        isMine && rowStyles.rowMine,
      ]}
    >
      {/* Rank badge */}
      <RankBadge rank={entry.rank} />

      {/* Avatar */}
      <View style={[rowStyles.avatar, { backgroundColor: entry.avatar_color }]}>
        <Text style={rowStyles.avatarText}>{initials}</Text>
      </View>

      {/* Name + subtitle */}
      <View style={rowStyles.nameBlock}>
        <View style={rowStyles.nameRow}>
          <Text style={rowStyles.name} numberOfLines={1}>
            {entry.display_name}
          </Text>
          {isMine && (
            <View style={rowStyles.senBadge}>
              <Text style={rowStyles.senText}>Sen</Text>
            </View>
          )}
        </View>
        <Text style={rowStyles.subtitle} numberOfLines={1}>
          Hata: {entry.mistakes} | İpucu: {entry.hints_used}
        </Text>
      </View>

      {/* Score or time */}
      <Text style={[rowStyles.value, { color: valueColor }]}>{valueText}</Text>
    </View>
  );
});

// ─── Rank Badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <View style={[rankStyles.badge, { backgroundColor: 'rgba(251,191,36,0.2)' }]}>
        <Text style={rankStyles.emoji}>🥇</Text>
      </View>
    );
  }
  if (rank === 2) {
    return (
      <View style={[rankStyles.badge, { backgroundColor: 'rgba(156,163,175,0.2)' }]}>
        <Text style={rankStyles.emoji}>🥈</Text>
      </View>
    );
  }
  if (rank === 3) {
    return (
      <View style={[rankStyles.badge, { backgroundColor: 'rgba(217,119,6,0.2)' }]}>
        <Text style={rankStyles.emoji}>🥉</Text>
      </View>
    );
  }
  return (
    <View style={[rankStyles.badge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
      <Text style={rankStyles.number}>{rank}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.accent,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  emptySub: { fontSize: 13, color: C.subtext },
  myEntrySeparator: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  myEntrySeparatorText: {
    fontSize: 11,
    color: C.subtext,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullBtn: {
    marginTop: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  fullBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.accent,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 2,
  },
  rowMine: {
    backgroundColor: C.myEntry,
    borderWidth: 1,
    borderColor: C.myEntryBorder,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  nameBlock: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    flexShrink: 1,
  },
  senBadge: {
    backgroundColor: 'rgba(124,58,237,0.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  senText: { fontSize: 10, fontWeight: '700', color: '#c4b5fd' },
  subtitle: { fontSize: 11, color: C.subtext, marginTop: 1 },
  value: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
});

const rankStyles = StyleSheet.create({
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 16 },
  number: {
    fontSize: 13,
    fontWeight: '800',
    color: C.subtext,
  },
});

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  btnActive: {
    backgroundColor: C.accent,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: C.subtext,
  },
  textActive: {
    color: '#fff',
  },
});
