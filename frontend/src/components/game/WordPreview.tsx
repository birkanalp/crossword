// ─── Word preview (letter boxes above keyboard) ──────────────────────────────

import React from 'react';
import { View, Text } from 'react-native';
import { makePreviewStyles } from './levelScreen.styles';

interface WordPreviewProps {
  clueLength: number;
  buffer: string[];
  isDark: boolean;
  isChecking?: boolean;
  bottom?: number;
}

export function WordPreview({
  clueLength,
  buffer,
  isDark,
  isChecking,
  bottom = 0,
}: WordPreviewProps) {
  const s = makePreviewStyles(isDark);
  return (
    <View style={[s.container, { bottom }]}>
      {Array.from({ length: clueLength }).map((_, i) => {
        const letter = buffer[i] ?? '';
        const isFilled = letter.length > 0;
        const isCurrent = i === buffer.length && !isChecking;
        return (
          <View
            key={i}
            style={[s.box, isFilled && s.boxFilled, isCurrent && s.boxCurrent]}
          >
            <Text style={[s.letter, isFilled && s.letterFilled]}>{letter}</Text>
          </View>
        );
      })}
    </View>
  );
}
