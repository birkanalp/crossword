import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { type PurchasesPackage } from 'react-native-purchases';
import { useCoinPackages, type CoinPackage } from '@/api/hooks/useCoinPackages';
import { useUserStore, selectCoins } from '@/store/userStore';
import { Colors } from '@/constants/colors';
import { fetchOfferings } from '@/lib/revenuecat';
import { captureError } from '@/lib/sentry';

// ─── Badge configuration ───────────────────────────────────────────────────────

const BADGE_CONFIG = {
  popular: { label: 'Popüler', color: '#5AC8FA', bg: 'rgba(90,200,250,0.15)' },
  best_value: { label: 'En İyi Değer', color: '#34C759', bg: 'rgba(52,199,89,0.15)' },
  new: { label: 'Yeni', color: '#AF52DE', bg: 'rgba(175,82,222,0.15)' },
  limited: { label: 'Sınırlı', color: '#FF9500', bg: 'rgba(255,149,0,0.15)' },
} as const;

// ─── Store Screen ─────────────────────────────────────────────────────────────

export default function StoreScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';

  const { data: packages = [], isLoading, error, refetch } = useCoinPackages();

  // Use the Zustand selector (reactive — re-renders when coins change)
  const coins = useUserStore(selectCoins);

  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  // RevenueCat packages loaded once when the store screen mounts
  const [rcPackages, setRcPackages] = useState<PurchasesPackage[]>([]);
  const rcLoadedRef = useRef(false);

  useEffect(() => {
    if (rcLoadedRef.current) return;
    rcLoadedRef.current = true;
    fetchOfferings()
      .then(setRcPackages)
      .catch((err) => captureError(err, { context: 'store_fetchOfferings' }));
  }, []);

  const addCoins = useUserStore((s) => s.addCoins);

  const handlePurchase = useCallback((pkg: CoinPackage) => {
    setSelectedPackage(pkg);
  }, []);

  const dismissModal = useCallback(() => {
    if (!purchasing) setSelectedPackage(null);
  }, [purchasing]);

  const confirmPurchase = useCallback(async () => {
    if (!selectedPackage) return;
    setPurchasing(true);

    try {
      // Match the DB coin package to the RevenueCat package by product ID
      const rcPkg = rcPackages.find(
        (p) => p.product.identifier === selectedPackage.revenuecat_product_id,
      );

      if (!rcPkg) {
        // No RC offering matched — RC not configured or package not found
        // Fall back to a graceful error rather than silently succeeding
        Alert.alert(
          'Satın Alma Yapılamıyor',
          'Bu ürün şu anda satın alınamıyor. Lütfen daha sonra tekrar deneyin.',
        );
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: Purchases } = require('react-native-purchases') as typeof import('react-native-purchases');
      const { customerInfo } = await Purchases.purchasePackage(rcPkg);

      // Credit coins to local balance on success
      // Authoritative server credit happens via RevenueCat webhook (verifyPurchase)
      addCoins(selectedPackage.coin_amount);

      setSelectedPackage(null);
      Alert.alert(
        'Satın Alma Başarılı',
        `${selectedPackage.coin_amount} coin hesabınıza eklendi!`,
      );

      // Log for debugging in dev
      if (__DEV__) {
        console.log('[Store] Purchase success, active entitlements:', Object.keys(customerInfo.entitlements.active));
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      // User cancelled — don't show an error
      if (error?.code === '1') return;
      captureError(err instanceof Error ? err : new Error(String(err)), {
        context: 'store_confirmPurchase',
        product_id: selectedPackage.revenuecat_product_id,
      });
      Alert.alert(
        'Satın Alma Başarısız',
        error?.message ?? 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
      );
    } finally {
      setPurchasing(false);
    }
  }, [selectedPackage, rcPackages, addCoins]);

  const styles = makeStyles(isDark);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mağaza</Text>
        {/* Coin balance chip — reactive to store changes */}
        <View style={styles.balanceChip}>
          <Text style={styles.balanceEmoji}>🪙</Text>
          <Text style={styles.balanceText}>{coins}</Text>
        </View>
      </View>

      {/* ─── Hero Banner ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={isDark ? ['#1C1C2E', '#2C1F4A'] : ['#F0E6FF', '#E8F4FF']}
        style={styles.heroBanner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.heroEmoji}>🪙</Text>
        <View>
          <Text style={styles.heroTitle}>Coin Satın Al</Text>
          <Text style={styles.heroSubtitle}>İpuçlarını açmak için coin kullan</Text>
        </View>
      </LinearGradient>

      {/* ─── Content Area ────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Paketler yüklenemedi</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Coin Paketleri</Text>

          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              isDark={isDark}
              onPress={() => handlePurchase(pkg)}
            />
          ))}

          <Text style={styles.disclaimer}>
            Satın alımlar App Store / Google Play üzerinden gerçekleşir.{'\n'}
            RevenueCat ile güvenli ödeme altyapısı.
          </Text>
        </ScrollView>
      )}

      {/* ─── Purchase Confirm Modal ───────────────────────────────────────── */}
      <Modal
        visible={!!selectedPackage}
        transparent
        animationType="slide"
        onRequestClose={dismissModal}
      >
        <Pressable style={styles.modalOverlay} onPress={dismissModal}>
          {/* Inner Pressable prevents tap-through to overlay when tapping the sheet */}
          <Pressable
            style={[styles.modalSheet, { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedPackage && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalEmoji}>🪙</Text>
                <Text style={[styles.modalCoinAmount, { color: isDark ? '#FFF' : '#1C1C1E' }]}>
                  {selectedPackage.coin_amount} Coin
                </Text>
                <Text style={[styles.modalPackageName, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]}>
                  {selectedPackage.name}
                </Text>
                <View style={styles.modalPriceRow}>
                  <Text style={styles.modalPrice}>${selectedPackage.price_usd.toFixed(2)}</Text>
                  {selectedPackage.discount_percent > 0 && selectedPackage.original_price_usd && (
                    <View style={styles.modalDiscountGroup}>
                      <Text style={styles.modalOriginalPrice}>
                        ${selectedPackage.original_price_usd.toFixed(2)}
                      </Text>
                      <View style={styles.modalDiscountBadge}>
                        <Text style={styles.modalDiscountBadgeText}>
                          %{selectedPackage.discount_percent} INDIRIM
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.modalBuyBtn, purchasing && styles.modalBuyBtnDisabled]}
                  onPress={confirmPurchase}
                  disabled={purchasing}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#AF52DE', '#5AC8FA']}
                    style={styles.modalBuyGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.modalBuyText}>
                        {`${selectedPackage.coin_amount} Coin Satın Al`}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={dismissModal} style={styles.modalCancelBtn}>
                  <Text
                    style={[
                      styles.modalCancelText,
                      { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' },
                    ]}
                  >
                    İptal
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Package Card ─────────────────────────────────────────────────────────────

interface PackageCardProps {
  pkg: CoinPackage;
  isDark: boolean;
  onPress: () => void;
}

// Memoised to avoid re-rendering all cards when unrelated state changes (e.g., modal open)
const PackageCard = React.memo(function PackageCard({ pkg, isDark, onPress }: PackageCardProps) {
  const badge = pkg.badge ? BADGE_CONFIG[pkg.badge] : null;
  const isFeatured = pkg.is_featured;
  const hasDiscount = pkg.discount_percent > 0 && pkg.original_price_usd != null;

  if (isFeatured) {
    return <FeaturedCard pkg={pkg} badge={badge} hasDiscount={hasDiscount} onPress={onPress} />;
  }

  return (
    <RegularCard
      pkg={pkg}
      badge={badge}
      hasDiscount={hasDiscount}
      isDark={isDark}
      onPress={onPress}
    />
  );
});

// ─── Featured Card (gradient background) ──────────────────────────────────────

function FeaturedCard({
  pkg,
  badge,
  hasDiscount,
  onPress,
}: {
  pkg: CoinPackage;
  badge: (typeof BADGE_CONFIG)[keyof typeof BADGE_CONFIG] | null;
  hasDiscount: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={cardStyles.featuredWrapper}>
      <LinearGradient
        colors={['#AF52DE', '#5856D6']}
        style={cardStyles.featuredCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {badge && (
          <View style={[cardStyles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={[cardStyles.badgeText, { color: '#FFF' }]}>{badge.label}</Text>
          </View>
        )}

        <View style={cardStyles.featuredContent}>
          {/* Left: icon + text */}
          <View style={cardStyles.featuredLeft}>
            <Text style={cardStyles.featuredCoinEmoji}>🪙</Text>
            <View>
              <Text style={cardStyles.featuredCoinAmount}>{pkg.coin_amount} Coin</Text>
              <Text style={cardStyles.featuredName}>{pkg.name}</Text>
              {pkg.description && (
                <Text style={cardStyles.featuredDesc}>{pkg.description}</Text>
              )}
            </View>
          </View>

          {/* Right: pricing */}
          <View style={cardStyles.featuredRight}>
            {hasDiscount && pkg.original_price_usd && (
              <Text style={cardStyles.featuredOriginalPrice}>
                ${pkg.original_price_usd.toFixed(2)}
              </Text>
            )}
            <Text style={cardStyles.featuredPrice}>${pkg.price_usd.toFixed(2)}</Text>
            {hasDiscount && (
              <View style={cardStyles.featuredDiscountBadge}>
                <Text style={cardStyles.featuredDiscountBadgeText}>%{pkg.discount_percent}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={cardStyles.featuredBuyBtn}>
          <Text style={cardStyles.featuredBuyText}>Satin Al →</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Regular Card ─────────────────────────────────────────────────────────────

function RegularCard({
  pkg,
  badge,
  hasDiscount,
  isDark,
  onPress,
}: {
  pkg: CoinPackage;
  badge: (typeof BADGE_CONFIG)[keyof typeof BADGE_CONFIG] | null;
  hasDiscount: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const cardBg = isDark ? '#1C1C2E' : '#FFFFFF';
  const textColor = isDark ? '#FFF' : '#1C1C1E';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const descColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const origPriceColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        cardStyles.card,
        { backgroundColor: cardBg },
        hasDiscount && cardStyles.cardDiscountBorder,
      ]}
    >
      {/* Discount ribbon at top-left */}
      {hasDiscount && (
        <View style={cardStyles.discountRibbon}>
          <Text style={cardStyles.discountRibbonText}>%{pkg.discount_percent} INDIRIM</Text>
        </View>
      )}

      <View style={cardStyles.cardContent}>
        {/* Left: coin icon + info */}
        <View style={cardStyles.cardLeft}>
          <View
            style={[
              cardStyles.coinIconBg,
              hasDiscount && { backgroundColor: 'rgba(52,199,89,0.12)' },
            ]}
          >
            <Text style={cardStyles.coinIconEmoji}>🪙</Text>
          </View>
          <View style={cardStyles.cardTextBlock}>
            <Text style={[cardStyles.coinAmount, { color: textColor }]}>
              {pkg.coin_amount} Coin
            </Text>
            <Text style={[cardStyles.packageName, { color: subColor }]}>{pkg.name}</Text>
            {pkg.description && (
              <Text style={[cardStyles.packageDesc, { color: descColor }]}>
                {pkg.description}
              </Text>
            )}
          </View>
        </View>

        {/* Right: badge + price + buy button */}
        <View style={cardStyles.cardRight}>
          {badge && !hasDiscount && (
            <View style={[cardStyles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[cardStyles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          )}
          {hasDiscount && pkg.original_price_usd && (
            <Text style={[cardStyles.originalPrice, { color: origPriceColor }]}>
              ${pkg.original_price_usd.toFixed(2)}
            </Text>
          )}
          <Text style={[cardStyles.price, { color: textColor }]}>
            ${pkg.price_usd.toFixed(2)}
          </Text>
          <View style={cardStyles.buyBtn}>
            <Text style={cardStyles.buyBtnText}>Al</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Card StyleSheet (static — not affected by dark mode, colours handled inline) ───

const cardStyles = StyleSheet.create({
  // Featured
  featuredWrapper: { marginBottom: 16 },
  featuredCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#AF52DE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  featuredLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featuredCoinEmoji: { fontSize: 36 },
  featuredCoinAmount: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  featuredName: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  featuredDesc: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  featuredRight: { alignItems: 'flex-end', gap: 4 },
  featuredOriginalPrice: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },
  featuredPrice: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  featuredDiscountBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  featuredDiscountBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  featuredBuyBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  featuredBuyText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Regular card
  card: {
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardDiscountBorder: { borderColor: '#34C759', borderWidth: 1.5 },
  discountRibbon: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderBottomRightRadius: 10,
  },
  discountRibbonText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  coinIconBg: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,200,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinIconEmoji: { fontSize: 24 },
  cardTextBlock: { flex: 1 },
  coinAmount: { fontSize: 17, fontWeight: '700' },
  packageName: { fontSize: 12, marginTop: 2 },
  packageDesc: { fontSize: 11, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4, marginLeft: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  originalPrice: { fontSize: 12, textDecorationLine: 'line-through' },
  price: { fontSize: 18, fontWeight: '800' },
  buyBtn: {
    backgroundColor: '#AF52DE',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 4,
  },
  buyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});

// ─── Screen StyleSheet (dynamic — dark/light) ──────────────────────────────────

function makeStyles(isDark: boolean) {
  const bg = isDark ? '#0D0D14' : '#F5F5F7';
  const text = isDark ? '#FFFFFF' : '#1C1C1E';
  const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: bg },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    backBtn: { padding: 8 },
    backIcon: { fontSize: 22, color: text },
    title: { flex: 1, fontSize: 20, fontWeight: '700', color: text },
    balanceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255,200,0,0.15)' : 'rgba(255,200,0,0.12)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    balanceEmoji: { fontSize: 14 },
    balanceText: { fontSize: 14, fontWeight: '700', color: Colors.warning },

    // Hero banner
    heroBanner: {
      marginHorizontal: 16,
      borderRadius: 20,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 8,
    },
    heroEmoji: { fontSize: 44 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: text },
    heroSubtitle: { fontSize: 13, color: sub, marginTop: 2 },

    // List
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingTop: 12, paddingBottom: 40 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: sub,
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    disclaimer: {
      fontSize: 11,
      color: sub,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 17,
    },

    // Loading / error states
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    loadingText: { color: sub, fontSize: 16 },
    errorText: { color: Colors.error, fontSize: 16, marginBottom: 12, textAlign: 'center' },
    retryBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    retryText: { color: '#FFF', fontWeight: '600' },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      alignItems: 'center',
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(128,128,128,0.3)',
      marginBottom: 20,
    },
    modalEmoji: { fontSize: 56, marginBottom: 8 },
    modalCoinAmount: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
    modalPackageName: { fontSize: 14, marginBottom: 16 },
    modalPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    modalPrice: { fontSize: 32, fontWeight: '800', color: '#AF52DE' },
    modalDiscountGroup: { alignItems: 'flex-start', gap: 4 },
    modalOriginalPrice: {
      fontSize: 14,
      textDecorationLine: 'line-through',
      color: 'rgba(128,128,128,0.7)',
    },
    modalDiscountBadge: {
      backgroundColor: 'rgba(52,199,89,0.12)',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    modalDiscountBadgeText: { fontSize: 11, fontWeight: '800', color: '#34C759' },
    modalBuyBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    modalBuyBtnDisabled: { opacity: 0.7 },
    modalBuyGradient: { paddingVertical: 16, alignItems: 'center' },
    modalBuyText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
    modalCancelBtn: { paddingVertical: 12 },
    modalCancelText: { fontSize: 15 },
  });
}
