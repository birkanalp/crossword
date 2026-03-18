// ─── Hint modal ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import type { LevelScreenStyles } from './levelScreen.styles';

interface HintModalProps {
  visible: boolean;
  hintText: string | null;
  onClose: () => void;
  styles: LevelScreenStyles;
}

export function HintModal({ visible, hintText, onClose, styles }: HintModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.hintModalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.hintModalCard}>
          <Text style={styles.hintModalTitle}>İpucu</Text>
          <Text style={styles.hintModalBody}>{hintText ?? ''}</Text>
          <TouchableOpacity style={styles.hintModalClose} onPress={onClose}>
            <Text style={styles.hintModalCloseText}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
