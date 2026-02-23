import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGameStore, selectFilledCells, selectSelectedCell, selectSelectedClue, selectWrongCells, selectElapsedTime, selectIsCompleted } from '@/store/gameStore';
import { useLevel } from '@/api/hooks/useLevels';
import { useUserStore, selectUser } from '@/store/userStore';
import { CrosswordGrid, buildCellStates } from '@/components/grid/CrosswordGrid';
import { CluesList } from '@/components/clues/CluesList';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useElapsedTimer, formatElapsedTime } from '@/hooks/useElapsedTimer';
import { useHaptics } from '@/hooks/useHaptics';
import { Colors } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import type { GridPosition, Clue } from '@/domain/crossword/types';
import { track } from '@/lib/analytics';

// ─── Level Screen ─────────────────────────────────────────────────────────────

export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const { width: screenWidth } = useWindowDimensions();

  const haptics = useHaptics();

  // ─── Auth context for API calls ──────────────────────────────────────────────
  const user = useUserStore(selectUser);
  const guestId = user?.type === 'guest' ? user.guestId : undefined;
  // TODO: pass authToken from auth store once login is implemented
  const authToken: string | undefined = undefined;

  // ─── Remote data ─────────────────────────────────────────────────────────────
  // useLevel returns { level, progress } — progress is server-merged saved state.
  const { data: levelData, isLoading, isError } = useLevel(id ?? null, { guestId, authToken });

  // ─── Game state ─────────────────────────────────────────────────────────────
  const filledCells = useGameStore(selectFilledCells);
  const selectedCell = useGameStore(selectSelectedCell);
  const selectedClue = useGameStore(selectSelectedClue);
  const wrongCells = useGameStore(selectWrongCells);
  const elapsedTime = useGameStore(selectElapsedTime);
  const isCompleted = useGameStore(selectIsCompleted);

  const { loadLevel, tapCell, selectClue, setTimerRunning } = useGameStore.getState();

  // ─── Start hooks ────────────────────────────────────────────────────────────
  useElapsedTimer();
  useAutoSave();

  // ─── Load level and restore progress ────────────────────────────────────────
  // Server progress takes priority over local AsyncStorage (it may include
  // completions from another device). Local progress is a fallback for offline.
  useEffect(() => {
    if (!levelData) return;
    const { level, progress: serverProgress } = levelData;

    loadLevel(
      level,
      serverProgress?.filledCells,
      serverProgress?.elapsedTime,
    );

    track({
      name: 'puzzle_started',
      level_id: level.id,
      difficulty: level.difficulty,
      is_premium: level.isPremium,
      is_daily: false, // TODO: pass through from navigation params
      is_guest: user?.type === 'guest' ?? true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelData?.level.id]);

  // ─── Handle completion ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCompleted || !levelData) return;
    haptics.success();

    const gameState = useGameStore.getState();
    // TODO: call useSubmitScore (requires authToken — guests see local score only)
    // TODO: Show completion modal with server-returned rank
    // TODO: Trigger interstitial ad (admob.showInterstitialAd)
    track({
      name: 'puzzle_completed',
      level_id: levelData.level.id,
      difficulty: levelData.level.difficulty,
      score: gameState.scoreBreakdown?.finalScore ?? 0, // preview only — server is authoritative
      rank: 0,          // will be populated from submitScore response
      is_new_best: false, // will be populated from submitScore response
      time_spent: elapsedTime,
      hints_used: gameState.hintsUsed,
      mistakes: gameState.mistakes,
      is_daily: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted]);

  const level = levelData?.level ?? null;

  // ─── Cell state derivation ───────────────────────────────────────────────────
  const cellStates = useMemo(() => {
    if (!level) return [];
    return buildCellStates(level, filledCells, selectedCell, selectedClue, wrongCells);
  }, [level, filledCells, selectedCell, selectedClue, wrongCells]);

  // ─── Grid layout ────────────────────────────────────────────────────────────
  const availableWidth = screenWidth * APP_CONFIG.GRID_WIDTH_FRACTION;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleCellPress = useCallback(
    (position: GridPosition) => {
      haptics.light();
      tapCell(position.row, position.col);
    },
    [haptics, tapCell],
  );

  const handleCluePress = useCallback(
    (clue: Clue) => {
      haptics.light();
      selectClue(clue);
    },
    [haptics, selectClue],
  );

  const handleBack = () => {
    setTimerRunning(false);
    router.back();
  };

  const styles = makeStyles(isDark);

  // ─── Render states ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.statusText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (isError || !level) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.statusText}>Seviye yüklenemedi.</Text>
        <TouchableOpacity onPress={handleBack} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary }}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ─── Top bar ───────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.levelTitle}>{level.title}</Text>
        <Text style={styles.timer}>{formatElapsedTime(elapsedTime)}</Text>
      </View>

      {/* ─── Grid ──────────────────────────────────────────────────────── */}
      <View style={styles.gridContainer}>
        {cellStates.length > 0 && (
          <CrosswordGrid
            rows={level.rows}
            cols={level.cols}
            cellStates={cellStates}
            onCellPress={handleCellPress}
            availableWidth={availableWidth}
          />
        )}
      </View>

      {/* ─── Active clue bar ───────────────────────────────────────────── */}
      {selectedClue && (
        <View style={styles.activeClueBar}>
          <Text style={styles.activeClueNumber}>
            {selectedClue.number} {selectedClue.direction === 'across' ? 'Yatay' : 'Dikey'}
          </Text>
          <Text style={styles.activeClueText} numberOfLines={2}>
            {selectedClue.text}
          </Text>
        </View>
      )}

      {/* ─── Clues panel ───────────────────────────────────────────────── */}
      <View style={styles.cluesPanel}>
        <CluesList
          clues={level.clues}
          selectedClue={selectedClue}
          onCluePress={handleCluePress}
        />
      </View>

      {/* ─── TODO: Keyboard component will be inserted here ────────────── */}
      {/* <CrosswordKeyboard onKey={enterLetter} onDelete={deleteLetter} /> */}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(isDark: boolean) {
  const bg = isDark ? Colors.bgDark : Colors.bgLight;
  const text = isDark ? Colors.textOnDark : Colors.textPrimary;
  const sub = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;
  const cardBg = isDark ? Colors.bgDarkSecondary : Colors.bgLightSecondary;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: bg,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      fontSize: 16,
      color: text,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 52,
      paddingBottom: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: {
      fontSize: 22,
      color: text,
    },
    levelTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: text,
      flex: 1,
      textAlign: 'center',
    },
    timer: {
      fontSize: 15,
      fontWeight: '600',
      color: sub,
      width: 56,
      textAlign: 'right',
    },
    gridContainer: {
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    activeClueBar: {
      backgroundColor: cardBg,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? Colors.cellBorderDark : Colors.cellBorder,
    },
    activeClueNumber: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    activeClueText: {
      fontSize: 14,
      color: text,
      lineHeight: 19,
    },
    cluesPanel: {
      flex: 1,
      borderTopWidth: 1,
      borderTopColor: isDark ? Colors.cellBorderDark : Colors.cellBorder,
    },
  });
}
