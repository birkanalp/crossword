import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { exchangeCodeForSessionFromUrl } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('Giris tamamlanıyor...');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const initialUrl = await Linking.getInitialURL();
        const url = initialUrl ?? Linking.createURL('/auth/callback');
        await exchangeCodeForSessionFromUrl(url);
        if (!cancelled) {
          router.replace('/');
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Giris tamamlanamadi');
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  text: {
    color: Colors.textOnDark,
    fontSize: 16,
    textAlign: 'center',
  },
});
