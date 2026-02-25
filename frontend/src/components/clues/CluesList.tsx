import React, { memo, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import type { Clue } from '@/domain/crossword/types';
import { Colors } from '@/constants/colors';

// ─── CluesList ────────────────────────────────────────────────────────────────
// Scrollable list of clues, grouped by direction.
// Auto-scrolls to the active clue when it changes.

interface CluesListProps {
  clues: Clue[];
  selectedClue: Clue | null;
  onCluePress: (clue: Clue) => void;
  /** Extra bottom padding so content isn't hidden behind a floating bar (e.g. WordPreview) */
  extraBottomPadding?: number;
}

function CluesListComponent({ clues, selectedClue, onCluePress, extraBottomPadding = 0 }: CluesListProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const scrollRef = useRef<ScrollView>(null);
  const itemRefs = useRef<Record<string, View | null>>({});

  const acrossClues = clues.filter((c) => c.direction === 'across');
  const downClues = clues.filter((c) => c.direction === 'down');

  // Auto-scroll to the active clue
  useEffect(() => {
    if (!selectedClue) return;
    const ref = itemRefs.current[selectedClue.id];
    if (ref) {
      ref.measureLayout(
        scrollRef.current as unknown as Parameters<View['measureLayout']>[0],
        (_x, y) => {
          scrollRef.current?.scrollTo({ y: y - 16, animated: true });
        },
        () => {},
      );
    }
  }, [selectedClue?.id]);

  const styles = makeStyles(isDark);

  const renderClue = (clue: Clue) => {
    const isActive = clue.id === selectedClue?.id;
    return (
      <TouchableOpacity
        key={clue.id}
        ref={(ref) => {
          itemRefs.current[clue.id] = ref as View | null;
        }}
        style={[styles.clueItem, isActive && styles.clueItemActive]}
        onPress={() => onCluePress(clue)}
        activeOpacity={0.7}
      >
        <Text style={[styles.clueNumber, isActive && styles.clueNumberActive]}>
          {clue.number}
        </Text>
        <Text style={[styles.clueText, isActive && styles.clueTextActive]} numberOfLines={3}>
          {clue.text}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, extraBottomPadding > 0 && { paddingBottom: extraBottomPadding }]}
    >
      {acrossClues.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>YATAY</Text>
          {acrossClues.map(renderClue)}
        </>
      )}
      {downClues.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>DİKEY</Text>
          {downClues.map(renderClue)}
        </>
      )}
    </ScrollView>
  );
}

export const CluesList = memo(CluesListComponent);

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingBottom: 24,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: isDark ? Colors.textOnDarkSecondary : Colors.textSecondary,
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 4,
    },
    clueItem: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginHorizontal: 4,
    },
    clueItemActive: {
      backgroundColor: isDark ? Colors.clueActiveBgDark : Colors.clueActiveBg,
    },
    clueNumber: {
      width: 28,
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? Colors.textOnDarkSecondary : Colors.textSecondary,
    },
    clueNumberActive: {
      color: Colors.primary,
    },
    clueText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: isDark ? Colors.textOnDark : Colors.textPrimary,
    },
    clueTextActive: {
      color: isDark ? Colors.textOnDark : Colors.textPrimary,
      fontWeight: '600',
    },
  });
}
