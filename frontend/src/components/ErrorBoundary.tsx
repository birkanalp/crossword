import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { captureError } from '@/lib/sentry';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Class component required by React's error boundary API.

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureError(error, { componentStack: info.componentStack ?? undefined });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Bir hata oluştu</Text>
          <Text style={styles.message}>
            Beklenmeyen bir sorun meydana geldi. Lütfen tekrar deneyin.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.debugMessage} numberOfLines={4}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e8e8ed',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  debugMessage: {
    fontSize: 12,
    color: '#ff6b6b',
    fontFamily: 'monospace',
    textAlign: 'left',
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#2a1a1a',
    borderRadius: 8,
    width: '100%',
  },
  button: {
    backgroundColor: '#6b9fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
