// ─── Level top bar ───────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { LevelScreenStyles } from './levelScreen.styles';

interface LevelTopBarProps {
  title: string;
  elapsedTime: string;
  coins: number;
  sidebarOpen: boolean;
  onBack: () => void;
  onToggleSidebar: () => void;
  /** Optional — when provided a trophy button is shown in the top bar */
  onLeaderboard?: () => void;
  styles: LevelScreenStyles;
}

export function LevelTopBar({
  title,
  elapsedTime,
  coins,
  sidebarOpen,
  onBack,
  onToggleSidebar,
  onLeaderboard,
  styles,
}: LevelTopBarProps) {
  const iconColor = sidebarOpen
    ? (styles.sidebarToggleIcon as { color?: string }).color ?? undefined
    : Colors.primary;

  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={styles.levelTitle}>{title}</Text>
      <Text style={styles.timer}>{elapsedTime}</Text>
      <View style={styles.coinBadge}>
        <Text style={styles.coinBadgeText}>{coins}</Text>
      </View>
      {/* Trophy button — only rendered when a handler is provided */}
      {onLeaderboard && (
        <TouchableOpacity
          onPress={onLeaderboard}
          style={styles.sidebarToggleBtn}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 18 }}>🏆</Text>
        </TouchableOpacity>
      )}
      <View style={{ position: 'relative' }}>
        <TouchableOpacity onPress={onToggleSidebar} style={styles.sidebarToggleBtn}>
          <MaterialCommunityIcons
            name="format-list-numbered"
            size={22}
            color={iconColor}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
