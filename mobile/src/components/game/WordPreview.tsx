// ─── Word preview (letter boxes above keyboard) ──────────────────────────────

import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, View, Text } from 'react-native';
import {
  makePreviewStyles,
  PREVIEW_PADDING_H,
  PREVIEW_PADDING_V,
  PREVIEW_GAP,
  PREVIEW_BOX_MIN,
  PREVIEW_BOX_MAX,
  PREVIEW_BOX_HEIGHT_RATIO,
  PREVIEW_CONTAINER_HEIGHT,
} from './levelScreen.styles';

interface WordPreviewProps {
  clueLength: number;
  buffer: string[];
  isDark: boolean;
  isChecking?: boolean;
  bottom?: number;
}

/**
 * Computes box size so all boxes fit in a single row within the fixed-height preview.
 * Constrained by BOTH:
 * - available width: (containerWidth - 2*paddingH - gap*(n-1)) / n
 * - available height: (PREVIEW_CONTAINER_HEIGHT - 2*paddingV) / PREVIEW_BOX_HEIGHT_RATIO
 * Final boxWidth = min(widthFromWidth, maxWidthFromHeight), clamped to [min, max].
 */
function computeBoxSize(
  containerWidth: number,
  count: number,
): { boxWidth: number; boxHeight: number; fontSize: number } {
  if (count <= 0 || containerWidth <= 0) {
    return { boxWidth: 44, boxHeight: 50, fontSize: 20 };
  }
  const availableWidth =
    containerWidth - 2 * PREVIEW_PADDING_H - PREVIEW_GAP * (count - 1);
  const rawWidth = Math.max(0, availableWidth) / count;

  const availableHeight = PREVIEW_CONTAINER_HEIGHT - 2 * PREVIEW_PADDING_V;
  const maxWidthFromHeight = availableHeight / PREVIEW_BOX_HEIGHT_RATIO;

  const boxWidth = Math.min(
    PREVIEW_BOX_MAX,
    Math.max(PREVIEW_BOX_MIN, Math.min(rawWidth, maxWidthFromHeight)),
  );
  const boxHeight = Math.round(boxWidth * PREVIEW_BOX_HEIGHT_RATIO);
  const fontSize = Math.round(
    Math.min(20, Math.max(12, boxWidth * 0.45)),
  );
  return { boxWidth, boxHeight, fontSize };
}

export function WordPreview({
  clueLength,
  buffer,
  isDark,
  isChecking,
  bottom = 0,
}: WordPreviewProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const s = makePreviewStyles(isDark);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const { boxWidth, boxHeight, fontSize } = useMemo(
    () => computeBoxSize(containerWidth, clueLength),
    [containerWidth, clueLength],
  );

  return (
    <View style={[s.container, { bottom }]} onLayout={onLayout}>
      {Array.from({ length: clueLength }).map((_, i) => {
        const letter = buffer[i] ?? '';
        const isFilled = letter.length > 0;
        const isCurrent = i === buffer.length && !isChecking;
        return (
          <View
            key={i}
            style={[
              s.box,
              { width: boxWidth, height: boxHeight },
              isFilled && s.boxFilled,
              isCurrent && s.boxCurrent,
            ]}
          >
            <Text
              style={[
                s.letter,
                { fontSize },
                isFilled && s.letterFilled,
              ]}
            >
              {letter}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
