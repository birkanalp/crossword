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
  styles: LevelScreenStyles;
}

export function LevelTopBar({
  title,
  elapsedTime,
  coins,
  sidebarOpen,
  onBack,
  onToggleSidebar,
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
