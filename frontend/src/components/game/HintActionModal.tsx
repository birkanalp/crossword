// ─── HintActionModal ──────────────────────────────────────────────────────────
// Shown when the user taps a hint button (reveal letter or show hint).
// Lets the user choose between watching a rewarded ad (free) or spending coins.

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';

// ─── Props ────────────────────────────────────────────────────────────────────

type HintActionModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Which hint action triggered this modal */
  actionType: 'reveal_letter' | 'show_hint';
  /** Coin cost for this action */
  cost: number;
  /** User's current coin balance */
  coinBalance: number;
  /** Called when the user confirms they want to watch an ad */
  onWatchAd: () => void;
  /** Called when the user confirms they want to spend coins */
  onSpendCoins: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function HintActionModal({
  visible,
  onClose,
  actionType,
  cost,
  coinBalance,
  onWatchAd,
  onSpendCoins,
}: HintActionModalProps) {
  const canAfford = coinBalance >= cost;
  const title = actionType === 'reveal_letter' ? 'Harf Aç' : 'İpucu Al';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Tapping the backdrop dismisses the modal */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner card: absorb taps so they don't bubble to the backdrop */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>

          {/* ── Watch Ad button (always enabled) ─────────────────────────── */}
          <TouchableOpacity
            style={[styles.button, styles.adButton]}
            onPress={onWatchAd}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonIcon}>📺</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonLabel}>Reklam İzle</Text>
              <Text style={styles.buttonSub}>Ücretsiz</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.divider}>veya</Text>

          {/* ── Spend Coins button (disabled when balance is insufficient) ─ */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.coinButton,
              !canAfford && styles.coinButtonDisabled,
            ]}
            onPress={canAfford ? onSpendCoins : undefined}
            activeOpacity={canAfford ? 0.8 : 1}
            disabled={!canAfford}
          >
            <Text style={styles.buttonIcon}>🪙</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={[styles.buttonLabel, !canAfford && styles.disabledText]}>
                {cost} Coin Harca
              </Text>
              <Text
                style={[styles.buttonSub, !canAfford && styles.insufficientText]}
              >
                {canAfford
                  ? `Bakiye: ${coinBalance} coin`
                  : `Yetersiz Bakiye (${coinBalance} coin)`}
              </Text>
            </View>
          </TouchableOpacity>

          {/* ── Cancel ────────────────────────────────────────────────────── */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>İptal</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#e8e8ed',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  adButton: {
    backgroundColor: '#2a3f6b',
    borderWidth: 1,
    borderColor: '#6b9fff',
  },
  coinButton: {
    backgroundColor: '#2d2a1e',
    borderWidth: 1,
    borderColor: '#f5c842',
  },
  coinButtonDisabled: {
    opacity: 0.45,
    borderColor: '#555',
    backgroundColor: '#222',
  },
  buttonIcon: {
    fontSize: 28,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonLabel: {
    color: '#e8e8ed',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSub: {
    color: '#a0a0b0',
    fontSize: 13,
    marginTop: 2,
  },
  disabledText: {
    color: '#888',
  },
  insufficientText: {
    color: '#e05555',
  },
  divider: {
    color: '#666',
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 8,
    padding: 8,
  },
  cancelText: {
    color: '#888',
    fontSize: 15,
  },
});
