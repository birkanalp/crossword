// ─── Clues sidebar (slides from right) ───────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { CluesList } from '@/components/clues/CluesList';
import type { Clue } from '@/domain/crossword/types';
import type { LevelScreenStyles } from './levelScreen.styles';

interface CluesSidebarProps {
  clues: Clue[];
  selectedClue: Clue | null;
  onCluePress: (clue: Clue) => void;
  onClose: () => void;
  styles: LevelScreenStyles;
  sidebarWidth: number;
  keyboardHeight: number;
  animatedStyle: AnimatedStyle<ViewStyle>;
}

export function CluesSidebar({
  clues,
  selectedClue,
  onCluePress,
  onClose,
  styles,
  sidebarWidth,
  keyboardHeight,
  animatedStyle,
}: CluesSidebarProps) {
  return (
    <Animated.View style={[styles.sidebar, { width: sidebarWidth }, animatedStyle]}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>SORULAR</Text>
        <TouchableOpacity onPress={onClose} style={styles.sidebarCloseBtn}>
          <Text style={styles.sidebarCloseIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <CluesList
        clues={clues}
        selectedClue={selectedClue}
        onCluePress={onCluePress}
        extraBottomPadding={keyboardHeight > 0 ? 80 : 24}
      />
    </Animated.View>
  );
}
