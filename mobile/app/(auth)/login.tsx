import React from 'react';
import { Alert, Text, StyleSheet, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { runtimeConfig } from '@/config/runtime';
import { beginOAuthSignIn } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const styles = makeStyles(isDark);

  const providers = [
    {
      key: 'apple',
      label: 'Apple ile Giriş Yap',
      enabled: runtimeConfig.authAppleEnabled,
      variant: 'primary' as const,
    },
    {
      key: 'google',
      label: 'Google ile Giriş Yap',
      enabled: runtimeConfig.authGoogleEnabled,
      variant: 'secondary' as const,
    },
  ];

  const handleGuestContinue = () => {
    router.back();
  };

  const handleProviderSignIn = async (provider: 'apple' | 'google') => {
    try {
      await beginOAuthSignIn(provider);
    } catch (error) {
      Alert.alert(
        'Giris Baslatilamadi',
        error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.',
      );
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Bulmaca</Text>
      <Text style={styles.subtitle}>Oturum aç veya misafir olarak devam et</Text>

      {providers.map((provider) => (
        <Button
          key={provider.key}
          label={provider.label}
          onPress={() => {
            void handleProviderSignIn(provider.key as 'apple' | 'google');
          }}
          variant={provider.variant}
          style={styles.btn}
          disabled={!provider.enabled}
        />
      ))}

      {!runtimeConfig.authAppleEnabled && !runtimeConfig.authGoogleEnabled ? (
        <Text style={styles.providerHint}>
          Bu buildde sosyal giriş kapalı. Provider ayarlari açıldığında aynı ekran gerçek OAuth akışını kullanacak.
        </Text>
      ) : null}

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
    providerHint: {
      color: isDark ? Colors.textOnDarkSecondary : Colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: -4,
      marginBottom: 4,
    },
  });
}
