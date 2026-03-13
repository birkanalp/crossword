// =============================================================================
// Account Deletion Page
//
// Public page — no auth required.
// URL: /delete-account
//
// Required by:
//  - Apple App Store Review Guideline 5.1.1(v) — apps that create accounts
//    must offer account deletion inside the app AND via a web URL.
//  - Google Play — account deletion policy requires a link to this page in
//    Play Console (Data safety section).
//
// This page explains how to delete an account via the app, and provides an
// email fallback for users who cannot access the app.
// =============================================================================

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hesap Silme — Bulmaca',
  description: 'Bulmaca uygulamasından hesabınızı nasıl sileceğinizi öğrenin.',
};

export default function DeleteAccountPage() {
  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>Hesap Silme</h1>
        <p style={styles.intro}>
          Bulmaca uygulaması, hesabınızı ve ilgili tüm verilerinizi kalıcı olarak
          silmenize imkan tanır. Bu işlem geri alınamaz.
        </p>

        <h2 style={styles.sectionTitle}>Uygulama Üzerinden Silme</h2>
        <ol style={styles.list}>
          <li>Bulmaca uygulamasını açın ve giriş yapın.</li>
          <li>Sağ alt köşedeki <strong>Profil</strong> simgesine dokunun.</li>
          <li>Sayfayı aşağı kaydırarak <strong>Hesap</strong> bölümüne gelin.</li>
          <li><strong>Hesabı Sil</strong> seçeneğine dokunun.</li>
          <li>Onay ekranında silme işlemini onaylayın.</li>
        </ol>

        <h2 style={styles.sectionTitle}>Hangi Veriler Silinir?</h2>
        <ul style={styles.list}>
          <li>Oyun ilerlemesi ve tamamlanan bulmacalar</li>
          <li>Liderlik tablosu girişleri ve puanlar</li>
          <li>Profil bilgileri (kullanıcı adı, avatar)</li>
          <li>Kimlik doğrulama hesabı</li>
        </ul>

        <p style={styles.note}>
          <strong>Not:</strong> Coin bakiyesi ve satın alımlar uygulama içi işlemdir;
          RevenueCat abonelikleri için lütfen App Store veya Google Play
          abonelik yönetimi sayfasını kullanın.
        </p>

        <h2 style={styles.sectionTitle}>E-posta ile Silme Talebi</h2>
        <p style={styles.text}>
          Uygulamaya erişiminiz yoksa aşağıdaki adrese e-posta göndererek
          hesap silme talebinde bulunabilirsiniz:
        </p>
        <p style={styles.email}>
          <a href="mailto:support@bulmaca.app" style={styles.emailLink}>
            support@bulmaca.app
          </a>
        </p>
        <p style={styles.text}>
          E-postanızda kayıtlı e-posta adresinizi belirtin. Talebiniz en
          fazla 30 gün içinde işleme alınacaktır.
        </p>

        <p style={styles.footer}>
          Son güncelleme: Mart 2026
        </p>
      </div>
    </main>
  );
}

// ─── Inline styles (no external CSS dependency for this public page) ──────────

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    backgroundColor: '#0d0d14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    maxWidth: '640px',
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: '16px',
    padding: '40px',
    color: '#e8e8ed',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '16px',
  },
  intro: {
    fontSize: '16px',
    color: '#a0a0b0',
    lineHeight: '1.6',
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '12px',
    marginTop: '28px',
  },
  list: {
    fontSize: '15px',
    color: '#c8c8d8',
    lineHeight: '1.8',
    paddingLeft: '20px',
    marginBottom: '16px',
  },
  note: {
    fontSize: '14px',
    color: '#a0a0b0',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    padding: '16px',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  text: {
    fontSize: '15px',
    color: '#c8c8d8',
    lineHeight: '1.6',
    marginBottom: '8px',
  },
  email: {
    marginBottom: '8px',
  },
  emailLink: {
    color: '#6b9fff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
  },
  footer: {
    fontSize: '12px',
    color: '#606070',
    marginTop: '32px',
  },
};
