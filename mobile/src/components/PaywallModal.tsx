import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type PurchasesPackage } from 'react-native-purchases';
import {
  fetchOfferings,
  purchasePackage,
  restorePurchases,
  ENTITLEMENTS,
} from '@/lib/revenuecat';

// ─── PaywallModal ─────────────────────────────────────────────────────────────
// Slides up from the bottom when the user taps a premium-locked level.
// Loads RevenueCat offerings and allows purchase / restore.

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful purchase that grants the premium entitlement */
  onPremiumUnlocked: () => void;
}

export function PaywallModal({ visible, onClose, onPremiumUnlocked }: Props) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Load offerings whenever modal opens
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchOfferings()
      .then((pkgs) => setPackages(pkgs))
      .finally(() => setLoading(false));
  }, [visible]);

  const handlePurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setPurchasing(true);
      try {
        const success = await purchasePackage(pkg);
        if (success) {
          onClose();
          onPremiumUnlocked();
          Alert.alert(
            'Premium Aktif!',
            'Tüm premium seviyeler artık erişilebilir.',
          );
        } else {
          Alert.alert(
            'Satın Alma Tamamlanamadı',
            'Lütfen tekrar deneyin.',
          );
        }
      } finally {
        setPurchasing(false);
      }
    },
    [onClose, onPremiumUnlocked],
  );

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      const hasPremium =
        info?.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
      if (hasPremium) {
        onClose();
        onPremiumUnlocked();
        Alert.alert('Satın Alımlar Geri Yüklendi', 'Premium erişiminiz aktifleştirildi.');
      } else {
        Alert.alert(
          'Geri Yükleme Başarısız',
          'Bu hesapta premium abonelik bulunamadı.',
        );
      }
    } finally {
      setRestoring(false);
    }
  }, [onClose, onPremiumUnlocked]);

  const busy = purchasing || restoring;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#1C1C2E', '#2C1F4A']}
            style={styles.gradient}
          >
            {/* Handle */}
            <View style={styles.handle} />

            {/* Hero */}
            <Text style={styles.lockEmoji}>🔒</Text>
            <Text style={styles.title}>Premium Seviye</Text>
            <Text style={styles.subtitle}>
              Bu seviyeye erişmek için premium üyelik gereklidir.
            </Text>

            {/* Feature list */}
            <View style={styles.features}>
              {FEATURE_LIST.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {/* Offerings */}
            {loading ? (
              <ActivityIndicator color="#AF52DE" style={styles.loader} />
            ) : packages.length > 0 ? (
              packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.purchaseBtn, busy && styles.disabled]}
                  onPress={() => handlePurchase(pkg)}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#AF52DE', '#5856D6']}
                    style={styles.purchaseBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.purchaseBtnText}>
                        {pkg.product.priceString} — Premium Satın Al
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))
            ) : (
              // No RC offerings loaded (no API key / offline) — show placeholder
              <View style={styles.noOfferings}>
                <Text style={styles.noOfferingsText}>
                  Paketler şu an yüklenemiyor.
                </Text>
              </View>
            )}

            {/* Restore */}
            <TouchableOpacity
              style={[styles.restoreBtn, busy && styles.disabled]}
              onPress={handleRestore}
              disabled={busy}
            >
              {restoring ? (
                <ActivityIndicator color="#AF52DE" size="small" />
              ) : (
                <Text style={styles.restoreText}>
                  Satın alımları geri yükle
                </Text>
              )}
            </TouchableOpacity>

            {/* Close */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.closeText}>Kapat</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && <View style={styles.iosSpacer} />}
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURE_LIST = [
  'Tüm premium seviyelere erişim',
  'Reklamsız oyun deneyimi',
  'Özel zorluk seviyeleri',
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 24,
  },
  lockEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  features: {
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheck: {
    fontSize: 16,
    color: '#34C759',
    fontWeight: '700',
  },
  featureText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  loader: {
    marginVertical: 24,
  },
  purchaseBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  purchaseBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  purchaseBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  noOfferings: {
    paddingVertical: 16,
    marginBottom: 12,
  },
  noOfferingsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
  restoreBtn: {
    paddingVertical: 12,
    marginBottom: 4,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreText: {
    color: '#AF52DE',
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    paddingVertical: 10,
  },
  closeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  iosSpacer: {
    height: 16,
  },
});
