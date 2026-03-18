// ─── History sidebar (slides from right, guess history) ───────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { HistoryPanel } from './HistoryPanel';
import type { GuessRecord } from './types';
import type { LevelScreenStyles } from './levelScreen.styles';

interface HistorySidebarProps {
  guessHistory: GuessRecord[];
  styles: LevelScreenStyles;
  sidebarWidth: number;
  animatedStyle: AnimatedStyle<ViewStyle>;
  isOpen: boolean;
  onClose: () => void;
}

export function HistorySidebar({
  guessHistory,
  styles,
  sidebarWidth,
  animatedStyle,
  isOpen,
  onClose,
}: HistorySidebarProps) {
  return (
    <Animated.View
      style={[styles.sidebar, { width: sidebarWidth }, animatedStyle]}
      pointerEvents={isOpen ? 'auto' : 'none'}
    >
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>TAHMİN GEÇMİŞİ</Text>
        <TouchableOpacity onPress={onClose} style={styles.sidebarCloseBtn}>
          <Text style={styles.sidebarCloseIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <HistoryPanel
        guessHistory={guessHistory}
        styles={styles}
        layout="vertical"
        showHeader={false}
      />
    </Animated.View>
  );
}
