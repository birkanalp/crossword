import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  Alert,
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
} from '@/store/gameStore';
import { useLevel, checkWord } from '@/api/hooks/useLevels';
import { useUserStore, selectUser, selectCoins } from '@/store/userStore';
import { buildCellStates } from '@/components/grid/CrosswordGrid';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useElapsedTimer, formatElapsedTime } from '@/hooks/useElapsedTimer';
import { useHaptics } from '@/hooks/useHaptics';
import { Colors } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { cellKey, getCellsForClue } from '@/domain/crossword/logic';
import type { GridPosition, Clue } from '@/domain/crossword/types';
import { track } from '@/lib/analytics';
import { LevelTopBar } from '@/components/game/LevelTopBar';
import { LevelGridRow } from '@/components/game/LevelGridRow';
import { ActiveClueBar } from '@/components/game/ActiveClueBar';
import { HistorySidebar } from '@/components/game/HistorySidebar';
import { WordPreview } from '@/components/game/WordPreview';
import { HintModal } from '@/components/game/HintModal';
import { CluesSidebar } from '@/components/game/CluesSidebar';
import { makeStyles } from '@/components/game/levelScreen.styles';
import type { GuessRecord } from '@/components/game/types';

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

  // ─── Remote data ─────────────────────────────────────────────────────────
  const { data: levelData, isLoading, isError } = useLevel(id ?? null, guestId ? { guestId } : {});

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

  // ─── Flash / shake animation state ───────────────────────────────────────
  const [wordFlash, setWordFlash] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [flashClueId, setFlashClueId] = useState<string | null>(null);

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
    loadLevel(level, serverProgress?.filledCells, serverProgress?.elapsedTime);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted]);

  const level = levelData?.level ?? null;

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

  const submitWord = useCallback(
    async (buffer: string[]) => {
      if (isCheckingRef.current) return;

      const store = useGameStore.getState();
      const clue = store.selectedClue;
      if (!clue || buffer.length < clue.length) return;

      const levelId = levelData?.level.id;
      if (!levelId) return;

      isCheckingRef.current = true;
      setIsChecking(true);

      let correct = false;
      try {
        correct = await checkWord(
          levelId,
          clue.number,
          clue.direction,
          buffer.join(''),
          guestId ? { guestId } : undefined,
        );
      } finally {
        isCheckingRef.current = false;
        setIsChecking(false);
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
    [levelData?.level.id, guestId, authToken, haptics, shakeX],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      if (text.length === 0) return;
      const store = useGameStore.getState();
      const clue = store.selectedClue;
      if (!clue || store.correctClueIds.has(clue.id)) return;

      const char = text[text.length - 1]?.toUpperCase() ?? '';
      if (!/^[A-ZÇĞIİÖŞÜ]$/i.test(char)) return;
      if (wordBuffer.length >= clue.length) return;

      haptics.light();
      const newBuffer = [...wordBuffer, char];
      setWordBuffer(newBuffer);

      if (newBuffer.length >= clue.length) {
        submitWord(newBuffer);
      }
    },
    [wordBuffer, haptics, submitWord],
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

  const handleRevealLetter = useCallback(() => {
    const store = useGameStore.getState();
    const clue = store.selectedClue;
    if (!clue || store.correctClueIds.has(clue.id)) return;

    if (!useUserStore.getState().spendCoins(REVEAL_LETTER_COST)) {
      Alert.alert('Yetersiz Coin', "Harf açmak için yeterli coin'iniz yok.");
      return;
    }

    const cells = getCellsForClue(clue);
    const emptyCells = cells.filter(
      (pos) => !store.filledCells[cellKey(pos.row, pos.col)],
    );
    if (emptyCells.length === 0) return;

    const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    if (!target) return;
    store.revealLetter(target.row, target.col);
    haptics.success();
    track({
      name: 'hint_used',
      level_id: levelData?.level.id ?? '',
      hint_type: 'reveal_letter',
    });
  }, [haptics, levelData?.level.id]);

  const handleShowHint = useCallback(() => {
    const store = useGameStore.getState();
    const clue = store.selectedClue;
    if (!clue) return;

    if (!useUserStore.getState().spendCoins(SHOW_HINT_COST)) {
      Alert.alert('Yetersiz Coin', "İpucu almak için yeterli coin'iniz yok.");
      return;
    }

    const hintText = clue.hint || 'Bu soru için ek ipucu bulunmuyor.';
    setHintModalText(hintText);
    haptics.light();
    track({
      name: 'hint_used',
      level_id: levelData?.level.id ?? '',
      hint_type: 'show_hint',
    });
  }, [haptics, levelData?.level.id]);

  const styles = makeStyles(isDark);

  // ─── Render states ────────────────────────────────────────────────────────

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
        elapsedTime={formatElapsedTime(elapsedTime)}
        coins={coins}
        sidebarOpen={sidebarOpen}
        onBack={handleBack}
        onToggleSidebar={toggleSidebar}
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
          <TouchableOpacity
            style={[
              styles.hintBtn,
              (!selectedClue ||
                correctClueIds.has(selectedClue.id) ||
                coins < REVEAL_LETTER_COST) &&
                styles.hintBtnDisabled,
            ]}
            onPress={handleRevealLetter}
            disabled={
              !selectedClue ||
              correctClueIds.has(selectedClue.id) ||
              coins < REVEAL_LETTER_COST
            }
            activeOpacity={0.7}
          >
            <Text style={styles.hintBtnIcon}>💡</Text>
            <View style={styles.hintCoinBadge}>
              <Text style={styles.hintCoinText}>{REVEAL_LETTER_COST}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.hintBtn,
              (!selectedClue ||
                correctClueIds.has(selectedClue.id) ||
                coins < SHOW_HINT_COST) &&
                styles.hintBtnDisabled,
            ]}
            onPress={handleShowHint}
            disabled={
              !selectedClue ||
              correctClueIds.has(selectedClue.id) ||
              coins < SHOW_HINT_COST
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
    </View>
  );
}
