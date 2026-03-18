import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';

// ─── Constants ────────────────────────────────────────────────────────────────

// 8 preset avatar colours the user can pick from
const PRESET_COLORS = [
  '#6366F1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
] as const;

const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,20}$/;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProfileSetupModalProps {
  visible: boolean;
  /** Called with the chosen username and avatar colour after successful save */
  onComplete: (username: string, avatarColor: string) => void;
  onSkip: () => void;
  /** Optional JWT — if provided the POST to /rest/v1/profiles includes Authorization */
  authToken?: string;
  /** User ID to persist in the profiles row */
  userId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileSetupModal({
  visible,
  onComplete,
  onSkip,
  authToken,
  userId,
}: ProfileSetupModalProps) {
  const [username, setUsername] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Derive initials preview from current input
  const initials =
    username.trim().length >= 2
      ? username.trim().slice(0, 2).toUpperCase()
      : username.trim().length === 1
      ? username.trim()[0]?.toUpperCase() ?? '?'
      : '??';

  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
    if (validationError) setValidationError(null);
  }, [validationError]);

  const handleSave = useCallback(async () => {
    const trimmed = username.trim();

    if (trimmed.length < 2) {
      setValidationError('Kullanıcı adı en az 2 karakter olmalıdır.');
      return;
    }
    if (trimmed.length > 20) {
      setValidationError('Kullanıcı adı en fazla 20 karakter olabilir.');
      return;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setValidationError('Sadece harf, rakam ve alt çizgi (_) kullanabilirsin.');
      return;
    }

    setSaving(true);
    setValidationError(null);

    try {
      // Profile data is stored via PostgREST (/rest/v1/profiles), NOT an edge function.
      // We construct the URL from SUPABASE_URL directly to avoid the /functions/v1 prefix
      // that apiRequest always prepends.
      const supabaseUrl =
        (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? '';

      if (supabaseUrl) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // PostgREST requires Prefer: return=minimal for INSERT
          Prefer: 'return=minimal',
        };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const body: Record<string, string> = {
          username: trimmed,
          avatar_color: selectedColor,
        };
        if (userId) body['user_id'] = userId;

        await fetch(`${supabaseUrl}/rest/v1/profiles`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        // We proceed regardless of HTTP status — profile saving is best-effort.
        // The leaderboard display_name will be populated by the backend on next
        // score submission using the profiles row.
      }

      onComplete(trimmed, selectedColor);
    } catch {
      // Network failure is non-fatal — allow the user to proceed
      onComplete(trimmed, selectedColor);
    } finally {
      setSaving(false);
    }
  }, [username, selectedColor, authToken, userId, onComplete]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <Pressable style={styles.overlay} onPress={onSkip}>
        {/* Inner Pressable stops tap-through to the overlay */}
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            contentContainerStyle={styles.cardContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={styles.title}>Kullanıcı Adın Ne Olsun?</Text>
            <Text style={styles.subtitle}>
              Lider tablosunda bu isimle görüneceksin.
            </Text>

            {/* Avatar preview */}
            <View style={styles.previewRow}>
              <View style={[styles.avatarPreview, { backgroundColor: selectedColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
              <View style={styles.previewTextBlock}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {username.trim() || 'Kullanıcı adı'}
                </Text>
                <Text style={styles.previewSub}>Lider tablosunda böyle görünür</Text>
              </View>
            </View>

            {/* Username input */}
            <TextInput
              style={[styles.input, validationError ? styles.inputError : null]}
              placeholder="kullanici_adi"
              placeholderTextColor="#7a7a9a"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            {validationError ? (
              <Text style={styles.errorText}>{validationError}</Text>
            ) : (
              <Text style={styles.hint}>2-20 karakter, harf/rakam/alt çizgi</Text>
            )}

            {/* Colour picker */}
            <Text style={styles.colorLabel}>Avatar Rengi</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorDotSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  {selectedColor === color && (
                    <Text style={styles.colorDotCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Kaydet</Text>
              )}
            </TouchableOpacity>

            {/* Skip link */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Atla</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e1035',
    borderRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  cardContent: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f3f0ff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9b8abf',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  // ── Preview ──────────────────────────────────────────────────────────
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 14,
  },
  avatarPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  previewTextBlock: { flex: 1 },
  previewName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f3f0ff',
  },
  previewSub: {
    fontSize: 12,
    color: '#9b8abf',
    marginTop: 2,
  },

  // ── Input ────────────────────────────────────────────────────────────
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: '#f3f0ff',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 6,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 12,
    color: '#9b8abf',
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  // ── Colour picker ────────────────────────────────────────────────────
  colorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9b8abf',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  colorDotCheck: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
  },

  // ── Buttons ──────────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#9b8abf',
  },
});
