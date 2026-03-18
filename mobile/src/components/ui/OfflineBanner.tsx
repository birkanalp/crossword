import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Colors } from '@/constants/colors';

/**
 * A sticky banner that slides in from the top when the device goes offline and
 * slides out once connectivity is restored.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOffline = !isConnected || !isInternetReachable;

  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, translateY]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Text style={styles.text}>İnternet bağlantısı yok</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: Colors.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.textOnDark,
    fontWeight: '600',
    fontSize: 13,
  },
});
