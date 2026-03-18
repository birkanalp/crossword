import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Generic Storage Helpers ──────────────────────────────────────────────────
// Wrap AsyncStorage with JSON serialization and typed generics.
// All errors are caught and logged — callers receive null on failure.

export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[storage] Failed to read key "${key}":`, error);
    return null;
  }
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[storage] Failed to write key "${key}":`, error);
  }
}

export async function storageRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn(`[storage] Failed to remove key "${key}":`, error);
  }
}

export async function storageMultiGet<T>(keys: string[]): Promise<Record<string, T | null>> {
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const result: Record<string, T | null> = {};
    for (const [key, raw] of pairs) {
      result[key] = raw ? (JSON.parse(raw) as T) : null;
    }
    return result;
  } catch (error) {
    console.warn('[storage] Failed to multiGet:', error);
    return {};
  }
}
