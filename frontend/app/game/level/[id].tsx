import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  Modal,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useGameStore,
  selectFilledCells,
  selectSelectedCell,
  selectSelectedClue,
  selectWrongCells,
  selectElapsedTime,
  selectIsCompleted,
  selectCorrectClueIds,
  selectScoreBreakdown,
} from '@/store/gameStore';
import { useLevel, checkWord, revealLetter, isValidLevelId } from '@/api/hooks/useLevels';
import { useUserStore, selectUser, selectCoins } from '@/store/userStore';
import { buildCellStates } from '@/components/grid/CrosswordGrid';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useElapsedTimer, formatElapsedTime } from '@/hooks/useElapsedTimer';
import { useHaptics } from '@/hooks/useHaptics';
import { Colors } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { cellKey, getCellsForClue } from '@/domain/crossword/logic';
import { v4 as uuidv4 } from 'uuid';
import type { GridPosition, Clue } from '@/domain/crossword/types';
import { track } from '@/lib/analytics';
import { LevelTopBar } from '@/components/game/LevelTopBar';
import { LevelGridRow } from '@/components/game/LevelGridRow';
import { ActiveClueBar } from '@/components/game/ActiveClueBar';
import { HistorySidebar } from '@/components/game/HistorySidebar';
import { WordPreview } from '@/components/game/WordPreview';
import { HintModal } from '@/components/game/HintModal';
import { HintActionModal } from '@/components/game/HintActionModal';
import { CluesSidebar } from '@/components/game/CluesSidebar';
import { PuzzleLeaderboard } from '@/components/game/PuzzleLeaderboard';
import { ProfileSetupModal } from '@/components/ProfileSetupModal';
import { makeStyles } from '@/components/game/levelScreen.styles';
import type { GuessRecord } from '@/components/game/types';
import { showRewardedAd } from '@/lib/admob';
import { logAdEvent } from '@/api/adEvents';
import { normalizeTurkishWord, toTurkishUpper } from '@/utils/turkish';
import { hasNoAds } from '@/lib/revenuecat';

// ─── Level Screen ─────────────────────────────────────────────────────────────

export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const haptics = useHaptics();

  // ─── Auth context ─────────────────────────────────────────────────────────
  const user = useUserStore(selectUser);
  const coins = useUserStore(selectCoins);
  const guestId: string | undefined = user?.type === 'guest' ? user.guestId : undefined;
  const authToken: string | undefined = undefined;

  const REVEAL_LETTER_COST = 2;
  const SHOW_HINT_COST = 1;

  // ─── No-ads entitlement check ─────────────────────────────────────────────
  const [noAdsActive, setNoAdsActive] = useState(false);
  useEffect(() => {
    hasNoAds().then(setNoAdsActive).catch(() => { /* ignore — default false */ });
  }, []);

  // ─── Remote data ─────────────────────────────────────────────────────────
  const { data: levelData, isLoading, isError, error, refetch } = useLevel(
    id ?? null,
    guestId ? { guestId } : {},
  );
  const idInvalid = id != null && !isValidLevelId(id);

  // ─── Game state ──────────────────────────────────────────────────────────
  const filledCells = useGameStore(selectFilledCells);
  const selectedCell = useGameStore(selectSelectedCell);
  const selectedClue = useGameStore(selectSelectedClue);
  const wrongCells = useGameStore(selectWrongCells);
  const correctClueIds = useGameStore(selectCorrectClueIds);
  const elapsedTime = useGameStore(selectElapsedTime);
  const isCompleted = useGameStore(selectIsCompleted);

  const { loadLevel, tapCell, selectClue, setTimerRunning } = useGameStore.getState();

  // ─── Hidden TextInput ref (triggers native keyboard) ─────────────────────
  const inputRef = useRef<TextInput>(null);

  // ─── Word buffer (preview area) ───────────────────────────────────────────
  const [wordBuffer, setWordBuffer] = useState<string[]>([]);

  const isCheckingRef = useRef(false);
  const [isChecking, setIsChecking] = useState(false);

  // ─── Guess history ───────────────────────────────────────────────────────
  const [guessHistory, setGuessHistory] = useState<GuessRecord[]>([]);
  const guessIdRef = useRef(0);

  // ─── Hint modal state ─────────────────────────────────────────────────────
  const [hintModalText, setHintModalText] = useState<string | null>(null);

  // ─── HintActionModal state ────────────────────────────────────────────────
  // Controls the "Watch Ad vs Spend Coins" choice sheet.
  const [hintActionVisible, setHintActionVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'show_hint' | 'reveal_letter' | null>(null);

  // ─── Flash / shake animation state ───────────────────────────────────────
  const [wordFlash, setWordFlash] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [flashClueId, setFlashClueId] = useState<string | null>(null);

  // ─── Completion overlay state ─────────────────────────────────────────────
  // Shown as a modal after the puzzle is solved.
  const [completionVisible, setCompletionVisible] = useState(false);

  // ─── Profile setup state ──────────────────────────────────────────────────
  // Shown once per session when user completes a puzzle without a username.
  const [profileSetupVisible, setProfileSetupVisible] = useState(false);

  const scoreBreakdown = useGameStore(selectScoreBreakdown);

  const shakeX = useSharedValue(0);

  // ─── Clues sidebar state + animation ─────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarWidth = screenWidth * 0.78;
  const sidebarTranslateX = useSharedValue(0);

  // ─── History panel state + animation ─────────────────────────────────────
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const historyPanelTranslateX = useSharedValue(sidebarWidth);

  // ─── Keyboard height tracking ─────────────────────────────────────────────
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ─── Safe area + ActiveClueBar measurement (for bottom stacking) ───────────
  const insets = useSafeAreaInsets();
  const [activeClueBarHeight, setActiveClueBarHeight] = useState(52);

  // WordPreview: single row of boxes (50px) + padding (10*2) ≈ 70
  const WORD_PREVIEW_HEIGHT = 70;

  useEffect(() => {
    setWordBuffer([]);
    if (selectedClue) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedClue?.id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // ─── Timer & auto-save ───────────────────────────────────────────────────
  useElapsedTimer();
  useAutoSave();

  // ─── Load level ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!levelData) return;
    const { level, progress: serverProgress } = levelData;
    loadLevel(level, serverProgress ?? null);
    track({
      name: 'puzzle_started',
      level_id: level.id,
      difficulty: level.difficulty,
      is_premium: level.isPremium,
      is_daily: false,
      is_guest: user?.type === 'guest' ? true : false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelData?.level.id]);

  // ─── Handle puzzle completion ─────────────────────────────────────────────
  useEffect(() => {
    if (!isCompleted || !levelData) return;
    haptics.success();
    useUserStore.getState().addCoins(1);
    const gameState = useGameStore.getState();
    track({
      name: 'puzzle_completed',
      level_id: levelData.level.id,
      difficulty: levelData.level.difficulty,
      score: gameState.scoreBreakdown?.finalScore ?? 0,
      rank: 0,
      is_new_best: false,
      time_spent: elapsedTime,
      hints_used: gameState.hintsUsed,
      mistakes: gameState.mistakes,
      is_daily: false,
    });

    // Show completion overlay with leaderboard — brief delay lets the correct
    // animation finish before the modal appears.
    const completionTimer = setTimeout(() => {
      setCompletionVisible(true);

      // Show profile setup on first completion if user has no username stored.
      // We check Zustand profile — username will be undefined for guest users
      // who have never set one.
      const profile = useUserStore.getState().profile;
      const hasUsername =
        profile != null &&
        'username' in profile &&
        typeof (profile as { username?: string }).username === 'string' &&
        ((profile as { username?: string }).username ?? '').length > 0;

      if (!hasUsername) {
        setProfileSetupVisible(true);
      }
    }, 700);

    return () => clearTimeout(completionTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted]);

  const level = levelData?.level ?? null;
  const isReplay = !!(levelData?.progress?.completedAt != null);

  // ─── Replay mode: stop timer, disable hints ──────────────────────────────
  useEffect(() => {
    if (isReplay) {
      setTimerRunning(false);
    }
  }, [isReplay, setTimerRunning]);

  // ─── Flash cells set ─────────────────────────────────────────────────────
  const flashCells = useMemo(() => {
    if (wordFlash === 'idle' || !flashClueId || !level) return new Set<string>();
    const clue = level.clues.find((c) => c.id === flashClueId);
    if (!clue) return new Set<string>();
    const keys = new Set<string>();
    for (const pos of getCellsForClue(clue)) {
      keys.add(cellKey(pos.row, pos.col));
    }
    return keys;
  }, [wordFlash, flashClueId, level]);

  // ─── Cell state derivation ───────────────────────────────────────────────
  const cellStates = useMemo(() => {
    if (!level) return [];
    return buildCellStates(
      level,
      filledCells,
      selectedCell,
      selectedClue,
      wrongCells,
      flashCells,
      wordFlash === 'idle' ? 'idle' : wordFlash,
    );
  }, [level, filledCells, selectedCell, selectedClue, wrongCells, flashCells, wordFlash]);

  // ─── Grid layout ─────────────────────────────────────────────────────────
  const HINT_COLUMN_WIDTH = 50;
  const availableWidth = screenWidth * APP_CONFIG.GRID_WIDTH_FRACTION - HINT_COLUMN_WIDTH;
  const CHROME_HEIGHT = 104 + 60 + 46 + 16;
  const availableHeight = screenHeight - CHROME_HEIGHT;

  // Reserved bottom area: keyboard + ActiveClueBar (when clue selected) + WordPreview (when visible) + safe area (when keyboard closed)
  const wordPreviewVisible =
    !!selectedClue &&
    keyboardHeight > 0 &&
    !correctClueIds.has(selectedClue.id);
  const reservedBottomHeight =
    keyboardHeight +
    (selectedClue ? activeClueBarHeight : 0) +
    (wordPreviewVisible ? WORD_PREVIEW_HEIGHT : 0) +
    (keyboardHeight === 0 ? insets.bottom : 0);

  // ─── Animated styles ───────────────────────────────────────────────────
  const animatedGridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const sidebarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslateX.value }],
  }));

  const historyPanelAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: historyPanelTranslateX.value }],
  }));

  const toggleSidebar = useCallback(() => {
    setHistoryPanelOpen(false);
    historyPanelTranslateX.value = withTiming(sidebarWidth, { duration: 280 });
    setSidebarOpen((prev) => {
      const next = !prev;
      sidebarTranslateX.value = withTiming(next ? 0 : sidebarWidth, { duration: 280 });
      return next;
    });
  }, [sidebarTranslateX, sidebarWidth, historyPanelTranslateX]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    sidebarTranslateX.value = withTiming(sidebarWidth, { duration: 280 });
  }, [sidebarTranslateX, sidebarWidth]);

  const openHistoryPanel = useCallback(() => {
    setSidebarOpen(false);
    sidebarTranslateX.value = withTiming(sidebarWidth, { duration: 280 });
    setHistoryPanelOpen(true);
    historyPanelTranslateX.value = withTiming(0, { duration: 280 });
  }, [sidebarTranslateX, sidebarWidth, historyPanelTranslateX]);

  const closeHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(false);
    historyPanelTranslateX.value = withTiming(sidebarWidth, { duration: 280 });
  }, [historyPanelTranslateX, sidebarWidth]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleCellPress = useCallback(
    (position: GridPosition) => {
      haptics.light();
      tapCell(position.row, position.col);
      inputRef.current?.focus();
    },
    [haptics, tapCell],
  );

  const handleCluePress = useCallback(
    (clue: Clue) => {
      haptics.light();
      selectClue(clue);
      closeSidebar();
      inputRef.current?.focus();
    },
    [haptics, selectClue, closeSidebar],
  );

  const handleBack = useCallback(() => {
    inputRef.current?.blur();
    setTimerRunning(false);
    router.back();
  }, [router, setTimerRunning]);

  // Navigate to the full leaderboard screen filtered to this puzzle
  const handleLeaderboard = useCallback(() => {
    if (!levelData?.level.id) return;
    router.push(
      `/leaderboard?type=puzzle&level_id=${encodeURIComponent(levelData.level.id)}` as never,
    );
  }, [router, levelData?.level.id]);

  const submitWord = useCallback(
    async (buffer: string[]) => {
      if (isReplay || isCheckingRef.current) return;

      const store = useGameStore.getState();
      const clue = store.selectedClue;
      if (!clue || buffer.length < clue.length) return;

      const levelId = levelData?.level.id;
      if (!levelId) return;

      isCheckingRef.current = true;
      setIsChecking(true);

      const storeAtSubmit = useGameStore.getState();
      let correct = false;
      let checkError: string | null = null;
      try {
        const result = await checkWord(
          levelId,
          clue.number,
          clue.direction,
          normalizeTurkishWord(buffer.join('')),
          {
            ...(guestId ? { guestId } : {}),
            requestId: uuidv4(),
            stateJson: storeAtSubmit.filledCells,
            timeSpent: storeAtSubmit.elapsedTime,
            hintsUsed: storeAtSubmit.hintsUsed,
            mistakes: storeAtSubmit.mistakes,
          },
        );
        correct = result.correct;
        checkError = result.error;
      } finally {
        isCheckingRef.current = false;
        setIsChecking(false);
      }

      if (checkError) {
        Alert.alert('Doğrulama hatası', checkError);
        return;
      }

      setFlashClueId(clue.id);

      guessIdRef.current += 1;
      setGuessHistory((prev) => [
        { id: guessIdRef.current, clue, word: buffer.join(''), correct },
        ...prev,
      ]);

      if (correct) {
        useGameStore.getState().commitWord(clue, buffer);
        haptics.success();
        setWordFlash('correct');
        useGameStore.getState().advanceToNextClue();
      } else {
        useGameStore.getState().clearCluePreview(clue);
        haptics.error();
        setWordFlash('wrong');
        shakeX.value = withSequence(
          withTiming(10, { duration: 60 }),
          withTiming(-10, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(-8, { duration: 60 }),
          withTiming(0, { duration: 60 }),
        );
      }

      setWordBuffer([]);
      setTimeout(() => {
        setWordFlash('idle');
        setFlashClueId(null);
      }, 850);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelData?.level.id, guestId, authToken, haptics, shakeX, isReplay],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      if (isReplay || text.length === 0) return;
      const store = useGameStore.getState();
      const clue = store.selectedClue;
      if (!clue || store.correctClueIds.has(clue.id)) return;

      const char = toTurkishUpper(text[text.length - 1] ?? '');
      if (!/^[A-ZÇĞIİÖŞÜ]$/i.test(char)) return;
      if (wordBuffer.length >= clue.length) return;

      haptics.light();
      const newBuffer = [...wordBuffer, char];
      setWordBuffer(newBuffer);

      if (newBuffer.length >= clue.length) {
        submitWord(newBuffer);
      }
    },
    [wordBuffer, haptics, submitWord, isReplay],
  );

  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === 'Backspace') {
        setWordBuffer((prev) => {
          if (prev.length === 0) return prev;
          haptics.light();
          return prev.slice(0, -1);
        });
      }
    },
    [haptics],
  );

  const handleTamam = useCallback(() => {
    setWordBuffer((prev) => {
      submitWord(prev);
      return prev;
    });
  }, [submitWord]);

  // ─── Execute the pending hint action (shared by both ad and coin paths) ─────
  // Extracted so both onWatchAd and onSpendCoins can call it without duplication.
  // reveal_letter calls backend API (answers never sent to client); show_hint is local-only.
  const executePendingHintAction = useCallback(
    async (action: 'show_hint' | 'reveal_letter') => {
      const store = useGameStore.getState();
      const clue = store.selectedClue;
      if (!clue || store.correctClueIds.has(clue.id)) return;

      if (action === 'reveal_letter') {
        const cells = getCellsForClue(clue);
        const emptyCells = cells.filter(
          (pos) => !store.filledCells[cellKey(pos.row, pos.col)],
        );
        if (emptyCells.length === 0) return;
        const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        if (!target) return;

        const levelId = levelData?.level.id;
        if (!levelId) return;

        const result = await revealLetter(levelId, target.row, target.col, {
          ...(guestId ? { guestId } : {}),
          ...(authToken ? { authToken } : {}),
        });
        if (result?.letter) {
          store.revealLetter(target.row, target.col, result.letter);
          haptics.success();
          track({
            name: 'hint_used',
            level_id: levelId,
            hint_type: 'reveal_letter',
          });
        }
      } else {
        const hintText = clue.hint || 'Bu soru için ek ipucu bulunmuyor.';
        setHintModalText(hintText);
        haptics.light();
        track({
          name: 'hint_used',
          level_id: levelData?.level.id ?? '',
          hint_type: 'show_hint',
        });
      }
    },
    [haptics, levelData?.level.id, guestId, authToken],
  );

  // ─── Open HintActionModal (replaces direct coin-spend on button tap) ────────
  const handleRevealLetter = useCallback(() => {
    if (isReplay) return;
    const store = useGameStore.getState();
    if (!store.selectedClue || store.correctClueIds.has(store.selectedClue.id)) return;
    setPendingAction('reveal_letter');
    setHintActionVisible(true);
  }, [isReplay]);

  const handleShowHint = useCallback(() => {
    if (isReplay) return;
    const store = useGameStore.getState();
    if (!store.selectedClue) return;
    setPendingAction('show_hint');
    setHintActionVisible(true);
  }, [isReplay]);

  // ─── Watch Ad path ───────────────────────────────────────────────────────────
  const handleWatchAd = useCallback(async () => {
    const action = pendingAction;
    const levelId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;

    // Close the choice modal before showing the ad overlay
    setHintActionVisible(false);
    setPendingAction(null);

    if (!action) return;

    const result = await showRewardedAd();

    if (result.rewarded) {
      // Log analytics event (fire-and-forget)
      logAdEvent({
        event_type: 'completed',
        action_type: action,
        ...(levelId !== undefined ? { level_id: levelId } : {}),
        ad_unit_id: 'rewarded',
      });
      await executePendingHintAction(action);
    }
    // If not rewarded (skipped / error), silently do nothing — user keeps coins
  }, [pendingAction, id, executePendingHintAction]);

  // ─── Spend Coins path ────────────────────────────────────────────────────────
  const handleSpendCoinsForHint = useCallback(async () => {
    const action = pendingAction;
    setHintActionVisible(false);
    setPendingAction(null);

    if (!action) return;

    const cost = action === 'reveal_letter' ? REVEAL_LETTER_COST : SHOW_HINT_COST;
    const spent = useUserStore.getState().spendCoins(cost);
    if (spent) {
      await executePendingHintAction(action);
    }
    // If spendCoins returns false the modal already shows "Yetersiz Bakiye"
    // so no additional Alert is needed here
  }, [pendingAction, executePendingHintAction]);

  const styles = makeStyles(isDark);

  // ─── Render states ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.statusText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (idInvalid) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.statusText}>
          Geçersiz seviye kimliği. Lütfen seviye listesinden seçin.
        </Text>
        <TouchableOpacity onPress={handleBack} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isError || !level) {
    const errorMessage =
      error instanceof Error ? error.message : 'Seviye yüklenemedi.';
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.statusText}>Seviye yüklenemedi</Text>
        <Text style={[styles.statusText, { fontSize: 14, marginTop: 8, opacity: 0.8 }]}>
          {errorMessage}
        </Text>
        <TouchableOpacity
          onPress={() => void refetch()}
          style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: 12 }}
        >
          <Text style={{ color: Colors.textOnPrimary, fontWeight: '700' }}>Tekrar dene</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBack} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value=""
        onChangeText={handleTextChange}
        onKeyPress={handleKeyPress}
        onSubmitEditing={handleTamam}
        autoCorrect={false}
        autoCapitalize="characters"
        spellCheck={false}
        keyboardType="default"
        returnKeyType="done"
        returnKeyLabel="Tamam"
        blurOnSubmit={false}
      />

      <LevelTopBar
        title={level.title}
        elapsedTime={isReplay ? 'Tamamlandı' : formatElapsedTime(elapsedTime)}
        coins={coins}
        sidebarOpen={sidebarOpen}
        onBack={handleBack}
        onToggleSidebar={toggleSidebar}
        onLeaderboard={handleLeaderboard}
        styles={styles}
      />

      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingBottom: reservedBottomHeight,
          paddingLeft: HINT_COLUMN_WIDTH,
          position: 'relative',
        }}
      >
        <LevelGridRow
          level={level}
          cellStates={cellStates}
          onCellPress={handleCellPress}
          styles={styles}
          availableWidth={availableWidth}
          availableHeight={availableHeight}
          animatedStyle={animatedGridStyle}
        />

        {/* Hint column — absolute overlay, same visual position as before */}
        <View
          style={[
            styles.hintColumn,
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: reservedBottomHeight,
              justifyContent: 'center',
            },
          ]}
        >
          {/*
            Reveal Letter: disabled only when no clue is active or already correct.
            Coin insufficiency is handled inside HintActionModal (not here) because
            the user can always choose the "Watch Ad" path instead.
          */}
          <TouchableOpacity
            style={[
              styles.hintBtn,
              (isReplay ||
                !selectedClue ||
                correctClueIds.has(selectedClue.id)) &&
                styles.hintBtnDisabled,
            ]}
            onPress={handleRevealLetter}
            disabled={
              isReplay ||
              !selectedClue ||
              correctClueIds.has(selectedClue.id)
            }
            activeOpacity={0.7}
          >
            <Text style={styles.hintBtnIcon}>💡</Text>
            <View style={styles.hintCoinBadge}>
              <Text style={styles.hintCoinText}>{REVEAL_LETTER_COST}</Text>
            </View>
          </TouchableOpacity>

          {/* Show Hint: same rationale — coin check is in the modal */}
          <TouchableOpacity
            style={[
              styles.hintBtn,
              (isReplay ||
                !selectedClue ||
                correctClueIds.has(selectedClue.id)) &&
                styles.hintBtnDisabled,
            ]}
            onPress={handleShowHint}
            disabled={
              isReplay ||
              !selectedClue ||
              correctClueIds.has(selectedClue.id)
            }
            activeOpacity={0.7}
          >
            <Text style={styles.hintBtnIcon}>❓</Text>
            <View style={styles.hintCoinBadge}>
              <Text style={styles.hintCoinText}>{SHOW_HINT_COST}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.hintBtn}
            onPress={openHistoryPanel}
            activeOpacity={0.7}
          >
            <Text style={styles.hintBtnIcon}>📜</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom stack: ActiveClueBar bottom-anchored, WordPreview directly above it */}
      {selectedClue && (
        <View
          style={{
            position: 'absolute',
            bottom: keyboardHeight > 0 ? keyboardHeight : 0,
            left: 0,
            right: 0,
            paddingBottom: keyboardHeight > 0 ? 0 : insets.bottom,
          }}
          onLayout={(e) => setActiveClueBarHeight(e.nativeEvent.layout.height)}
        >
          <ActiveClueBar clue={selectedClue} styles={styles} />
        </View>
      )}

      {selectedClue &&
        keyboardHeight > 0 &&
        !correctClueIds.has(selectedClue.id) && (
          <WordPreview
            clueLength={selectedClue.length}
            buffer={wordBuffer}
            isDark={isDark}
            isChecking={isChecking}
            bottom={keyboardHeight + activeClueBarHeight}
          />
        )}

      <HintModal
        visible={hintModalText !== null}
        hintText={hintModalText}
        onClose={() => setHintModalText(null)}
        styles={styles}
      />

      {/* HintActionModal: shown when user taps reveal-letter or show-hint buttons */}
      <HintActionModal
        visible={hintActionVisible}
        onClose={() => {
          setHintActionVisible(false);
          setPendingAction(null);
        }}
        actionType={pendingAction ?? 'show_hint'}
        cost={pendingAction === 'reveal_letter' ? REVEAL_LETTER_COST : SHOW_HINT_COST}
        coinBalance={coins}
        onWatchAd={handleWatchAd}
        onSpendCoins={handleSpendCoinsForHint}
        hideAds={noAdsActive}
      />

      {(sidebarOpen || historyPanelOpen) && (
        <TouchableOpacity
          style={styles.sidebarBackdrop}
          activeOpacity={1}
          onPress={() => {
            sidebarOpen && closeSidebar();
            historyPanelOpen && closeHistoryPanel();
          }}
        />
      )}

      <CluesSidebar
        clues={level.clues}
        selectedClue={selectedClue}
        onCluePress={handleCluePress}
        onClose={closeSidebar}
        styles={styles}
        sidebarWidth={sidebarWidth}
        keyboardHeight={keyboardHeight}
        animatedStyle={sidebarAnimStyle}
      />

      <HistorySidebar
        guessHistory={guessHistory}
        styles={styles}
        sidebarWidth={sidebarWidth}
        animatedStyle={historyPanelAnimStyle}
        isOpen={historyPanelOpen}
        onClose={closeHistoryPanel}
      />

      {/* ─── Completion Modal ─────────────────────────────────────────────
          Shown after puzzle is solved. Contains score summary and compact
          leaderboard so the user can see their rank without leaving the screen.
      */}
      <Modal
        visible={completionVisible && isCompleted}
        transparent
        animationType="slide"
        onRequestClose={() => setCompletionVisible(false)}
      >
        <View style={completionStyles.overlay}>
          <View style={completionStyles.sheet}>
            {/* Drag handle */}
            <View style={completionStyles.handle} />

            <ScrollView
              contentContainerStyle={completionStyles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Trophy + title */}
              <Text style={completionStyles.trophy}>🏆</Text>
              <Text style={completionStyles.title}>Tebrikler!</Text>
              <Text style={completionStyles.subtitle}>{level?.title}</Text>

              {/* Score row */}
              {scoreBreakdown && (
                <View style={completionStyles.scoreRow}>
                  <View style={completionStyles.scoreItem}>
                    <Text style={completionStyles.scoreValue}>
                      {scoreBreakdown.finalScore}
                    </Text>
                    <Text style={completionStyles.scoreLabel}>Puan</Text>
                  </View>
                  <View style={completionStyles.scoreDivider} />
                  <View style={completionStyles.scoreItem}>
                    <Text style={completionStyles.scoreValue}>
                      {useGameStore.getState().mistakes}
                    </Text>
                    <Text style={completionStyles.scoreLabel}>Hata</Text>
                  </View>
                  <View style={completionStyles.scoreDivider} />
                  <View style={completionStyles.scoreItem}>
                    <Text style={completionStyles.scoreValue}>
                      {useGameStore.getState().hintsUsed}
                    </Text>
                    <Text style={completionStyles.scoreLabel}>İpucu</Text>
                  </View>
                </View>
              )}

              {/* Compact puzzle leaderboard */}
              {level && (
                <PuzzleLeaderboard
                  levelId={level.id}
                  {...(guestId !== undefined ? { guestId } : {})}
                />
              )}

              {/* Action buttons */}
              <TouchableOpacity
                style={completionStyles.continueBtn}
                onPress={() => {
                  setCompletionVisible(false);
                  router.back();
                }}
                activeOpacity={0.85}
              >
                <Text style={completionStyles.continueBtnText}>Devam Et</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={completionStyles.leaderboardBtn}
                onPress={() => {
                  setCompletionVisible(false);
                  handleLeaderboard();
                }}
                activeOpacity={0.8}
              >
                <Text style={completionStyles.leaderboardBtnText}>
                  Tam Lider Tablosu
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Profile Setup Modal ──────────────────────────────────────────────
          Shown on first completion so the user can set a username before their
          score appears on the leaderboard.
      */}
      <ProfileSetupModal
        visible={profileSetupVisible}
        onComplete={(username, avatarColor) => {
          // Persist username + avatarColor into Zustand profile so subsequent
          // completions in the same session skip the setup modal.
          useUserStore.getState().updateProfile({ username, avatarColor });
          setProfileSetupVisible(false);
        }}
        onSkip={() => setProfileSetupVisible(false)}
        {...(user?.type === 'guest' ? { userId: user.guestId } : {})}
      />
    </View>
  );
}

// ─── Completion Modal Styles ──────────────────────────────────────────────────

const completionStyles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    backgroundColor: '#0f0617',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%' as const,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center' as const,
    marginBottom: 20,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center' as const,
  },
  trophy: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#f3f0ff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#9b8abf',
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row' as const,
    backgroundColor: '#1e1035',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 4,
    width: '100%' as const,
    alignItems: 'center' as const,
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center' as const,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#f3f0ff',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#9b8abf',
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  scoreDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  continueBtn: {
    width: '100%' as const,
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center' as const,
    marginTop: 16,
    marginBottom: 10,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#fff',
  },
  leaderboardBtn: {
    width: '100%' as const,
    paddingVertical: 13,
    alignItems: 'center' as const,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  leaderboardBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#a78bfa',
  },
};
