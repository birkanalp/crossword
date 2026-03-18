export const tr = {
  lang: 'tr',
  nav: {
    home: 'Ana Sayfa',
    leaderboard: 'Skor Tablosu',
    support: 'Destek',
    privacy: 'Gizlilik Politikası',
    terms: 'Kullanım Şartları',
    cookies: 'Çerez Politikası',
  },
  landing: {
    badge: 'Türkçe Bulmaca Oyunu',
    headline: 'Kelimelerle Düşün,\nBulmacayla Kazan',
    sub: "Türkçe'nin zenginliğini keşfet. Günlük bulmacalar, sonsuz eğlence.",
    downloadIos: 'App Store\'dan İndir',
    downloadAndroid: 'Google Play\'den İndir',
    comingSoon: 'Yakında',
    features: {
      title: 'Neden Bulmaca?',
      items: [
        {
          icon: '🧩',
          title: 'Her Gün Yeni Bulmaca',
          desc: 'Yapay zeka destekli sistem her gün taze bulmacalar üretir.',
        },
        {
          icon: '🏆',
          title: 'Skor Tablosu',
          desc: 'Arkadaşlarınla yarış, günlük ve tüm zamanlar listelerinde adını yaz.',
        },
        {
          icon: '📖',
          title: 'Türkçe Odaklı',
          desc: "Tamamen Türkçe içerik; dili eğlenerek öğren ve geliştir.",
        },
        {
          icon: '🌐',
          title: 'Çevrimdışı Mod',
          desc: 'İnternet olmadan da oyna — ilerleme otomatik olarak senkronize edilir.',
        },
      ],
    },
  },
  leaderboard: {
    title: 'Skor Tablosu',
    subtitle: 'En iyi oyuncuları keşfet',
    tabDaily: 'Günlük',
    tabAllTime: 'Tüm Zamanlar',
    colRank: '#',
    colPlayer: 'Oyuncu',
    colScore: 'Puan',
    colTime: 'Süre',
    empty: 'Henüz skor yok.',
    loading: 'Yükleniyor...',
    error: 'Skorlar yüklenemedi.',
  },
  privacy: {
    title: 'Gizlilik Politikası',
    lastUpdated: 'Son güncelleme: Mart 2026',
  },
  terms: {
    title: 'Kullanım Şartları',
    lastUpdated: 'Son güncelleme: Mart 2026',
  },
  cookies: {
    title: 'Çerez Politikası',
    lastUpdated: 'Son güncelleme: Mart 2026',
  },
  support: {
    title: 'Destek',
    subtitle: 'Size nasıl yardımcı olabiliriz?',
    emailLabel: 'E-posta ile ulaşın',
    faq: {
      title: 'Sık Sorulan Sorular',
      items: [
        {
          q: 'Satın aldığım içerikler nasıl geri yüklenir?',
          a: "Uygulamada Mağaza ekranını açın ve 'Satın Alımları Geri Yükle' butonuna dokunun.",
        },
        {
          q: 'Bulmacalar ne sıklıkla güncelleniyor?',
          a: 'Her gün yeni bulmacalar sisteme eklenir.',
        },
        {
          q: 'Çevrimdışı oynayabilir miyim?',
          a: 'Evet, indirilen bulmacaları internet bağlantısı olmadan oynayabilirsiniz.',
        },
      ],
    },
  },
  footer: {
    rights: 'Tüm hakları saklıdır.',
  },
}

export type Dictionary = typeof tr
