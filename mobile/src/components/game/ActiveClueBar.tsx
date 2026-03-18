// ─── Active clue bar ─────────────────────────────────────────────────────────

import React from 'react';
import { View, Text } from 'react-native';
import type { Clue } from '@/domain/crossword/types';
import type { LevelScreenStyles } from './levelScreen.styles';

interface ActiveClueBarProps {
  clue: Clue;
  styles: LevelScreenStyles;
}

export function ActiveClueBar({ clue, styles }: ActiveClueBarProps) {
  return (
    <View style={styles.activeClueBar}>
      <Text style={styles.activeClueNumber}>
        {clue.number} {clue.direction === 'across' ? 'Yatay →' : 'Dikey ↓'}
      </Text>
      <Text style={styles.activeClueText} numberOfLines={2}>
        {clue.text}
      </Text>
    </View>
  );
}
