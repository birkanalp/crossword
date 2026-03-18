// ─── Guess history panel ────────────────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { GuessRecord } from './types';
import type { LevelScreenStyles } from './levelScreen.styles';

interface HistoryPanelProps {
  guessHistory: GuessRecord[];
  styles: LevelScreenStyles;
  /** Horizontal chips (inline) vs vertical list (sidebar). Default: horizontal */
  layout?: 'horizontal' | 'vertical';
  /** Show "TAHMİNLER" header. Default: true. Set false when parent provides header. */
  showHeader?: boolean;
}

export function HistoryPanel({
  guessHistory,
  styles,
  layout = 'horizontal',
  showHeader = true,
}: HistoryPanelProps) {
  const isVertical = layout === 'vertical';
  const contentStyle = isVertical ? styles.historyContentVertical : styles.historyContent;

  return (
    <View style={isVertical ? styles.historyPanelVertical : styles.historyPanel}>
      {showHeader && <Text style={styles.historyHeader}>TAHMİNLER</Text>}
      {guessHistory.length === 0 ? (
        <View style={styles.historyEmpty}>
          <Text style={styles.historyEmptyText}>—</Text>
        </View>
      ) : (
        <ScrollView
          horizontal={!isVertical}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={isVertical}
          contentContainerStyle={contentStyle}
        >
          {guessHistory.map((guess) => (
            <View
              key={guess.id}
              style={[
                styles.historyChip,
                guess.correct ? styles.historyChipCorrect : styles.historyChipWrong,
              ]}
            >
              <Text style={styles.historyChipRef}>
                {guess.clue.number}{guess.clue.direction === 'across' ? 'Y' : 'D'}
              </Text>
              <Text
                style={[
                  styles.historyChipWord,
                  !guess.correct && styles.historyChipWordWrong,
                ]}
              >
                {guess.word}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
