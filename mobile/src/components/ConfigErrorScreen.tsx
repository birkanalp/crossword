import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

interface ConfigErrorScreenProps {
  issues: string[];
}

export function ConfigErrorScreen({ issues }: ConfigErrorScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Release Config Error</Text>
        <Text style={styles.subtitle}>
          Bu build gerekli runtime ayarlari olmadan acildi. Devam etmeden once release env degerlerini tanimlayin.
        </Text>
        {issues.map((issue) => (
          <Text key={issue} style={styles.issue}>
            • {issue}
          </Text>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgDark,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.bgDarkSecondary,
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  title: {
    color: Colors.textOnDark,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.textOnDarkSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  issue: {
    color: Colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
});
