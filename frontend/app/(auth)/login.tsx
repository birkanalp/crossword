import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

// ─── Login Screen ─────────────────────────────────────────────────────────────
// Skeleton only. TODO: Implement Apple/Google sign-in + backend auth flow.

export default function LoginScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);

  const handleGuestContinue = () => {
    router.back();
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Bulmaca</Text>
      <Text style={styles.subtitle}>Oturum aç veya misafir olarak devam et</Text>

      {/* TODO: Implement Apple Sign-In */}
      <Button
        label="Apple ile Giriş Yap"
        onPress={() => {
          /* TODO */
        }}
        variant="primary"
        style={styles.btn}
      />

      {/* TODO: Implement Google Sign-In */}
      <Button
        label="Google ile Giriş Yap"
        onPress={() => {
          /* TODO */
        }}
        variant="secondary"
        style={styles.btn}
      />

      <Button
        label="Misafir olarak devam et"
        onPress={handleGuestContinue}
        variant="ghost"
        style={styles.btn}
      />
    </View>
  );
}

function makeStyles(isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? Colors.bgDark : Colors.bgLight,
      padding: 32,
      justifyContent: 'center',
      gap: 12,
    },
    title: {
      fontSize: 42,
      fontWeight: '800',
      color: Colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? Colors.textOnDarkSecondary : Colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    btn: {
      width: '100%',
    },
  });
}
