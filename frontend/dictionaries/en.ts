import type { Dictionary } from './tr'

export const en: Dictionary = {
  lang: 'en',
  nav: {
    home: 'Home',
    leaderboard: 'Leaderboard',
    support: 'Support',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    cookies: 'Cookie Policy',
  },
  landing: {
    badge: 'Turkish Crossword Puzzle Game',
    headline: 'Think in Words,\nWin with Bulmaca',
    sub: 'Discover the richness of Turkish. Daily crossword puzzles, endless fun.',
    downloadIos: 'Download on the App Store',
    downloadAndroid: 'Get it on Google Play',
    comingSoon: 'Coming Soon',
    features: {
      title: 'Why Bulmaca?',
      items: [
        {
          icon: '🧩',
          title: 'New Puzzle Every Day',
          desc: 'Our AI-powered system generates fresh puzzles daily.',
        },
        {
          icon: '🏆',
          title: 'Leaderboard',
          desc: 'Compete with friends and make your name on daily and all-time charts.',
        },
        {
          icon: '📖',
          title: 'Turkish-Focused',
          desc: 'Entirely in Turkish — learn and improve the language while having fun.',
        },
        {
          icon: '🌐',
          title: 'Offline Mode',
          desc: 'Play without internet — progress syncs automatically when you reconnect.',
        },
      ],
    },
  },
  leaderboard: {
    title: 'Leaderboard',
    subtitle: 'Discover the best players',
    tabDaily: 'Daily',
    tabAllTime: 'All Time',
    colRank: '#',
    colPlayer: 'Player',
    colScore: 'Score',
    colTime: 'Time',
    empty: 'No scores yet.',
    loading: 'Loading...',
    error: 'Could not load scores.',
  },
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: March 2026',
  },
  terms: {
    title: 'Terms of Service',
    lastUpdated: 'Last updated: March 2026',
  },
  cookies: {
    title: 'Cookie Policy',
    lastUpdated: 'Last updated: March 2026',
  },
  support: {
    title: 'Support',
    subtitle: 'How can we help you?',
    emailLabel: 'Contact us via email',
    faq: {
      title: 'Frequently Asked Questions',
      items: [
        {
          q: 'How do I restore my purchases?',
          a: "Open the Store screen in the app and tap the 'Restore Purchases' button.",
        },
        {
          q: 'How often are puzzles updated?',
          a: 'New puzzles are added to the system every day.',
        },
        {
          q: 'Can I play offline?',
          a: 'Yes, you can play downloaded puzzles without an internet connection.',
        },
      ],
    },
  },
  footer: {
    rights: 'All rights reserved.',
  },
}
