const STORAGE_KEY = 'bulmaca-admin-todos'
const SEEDED_KEY = 'bulmaca-admin-todos-seeded'
const SEEDED_V2_KEY = 'bulmaca-admin-todos-seeded-v2'

export type TodoStatus = 'backlog' | 'ideas' | 'in_progress' | 'done' | 'blocked'

export interface Todo {
  id: string
  title: string
  body: string
  status: TodoStatus
  createdAt: string
  updatedAt: string
}

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

const SEED_TODOS: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Monetization & Store
  { title: 'RevenueCat API anahtarlarını yapılandır', body: 'app.json: revenueCatApiKeyIos, revenueCatApiKeyAndroid', status: 'backlog' },
  { title: "RevenueCat Dashboard'da product IDs ve offerings tanımla", body: '', status: 'backlog' },
  { title: 'Paywall ekranı ve premium level kilidi UI\'ı', body: '', status: 'backlog' },
  { title: 'Restore purchases butonu (ayarlar/profil)', body: '', status: 'backlog' },
  { title: 'AdMob SDK kurulumu (react-native-google-mobile-ads)', body: '', status: 'backlog' },
  { title: "AdMob unit ID'leri (banner, interstitial, rewarded) app.json'a ekle", body: '', status: 'backlog' },
  { title: 'Banner reklamları yerleştir', body: '', status: 'backlog' },
  { title: 'Interstitial ve rewarded reklamları entegre et', body: '', status: 'backlog' },
  { title: 'hasNoAds() entegrasyonu (reklamsız paket)', body: '', status: 'backlog' },
  { title: 'EAS projesi oluştur, eas.json build profilleri', body: '', status: 'backlog' },
  { title: 'App Store Connect hesabı aç', body: '', status: 'backlog' },
  { title: 'Google Play Console hesabı aç', body: '', status: 'backlog' },
  { title: 'Store listing metadata (açıklama, anahtar kelimeler)', body: '', status: 'backlog' },
  { title: 'Privacy policy URL', body: '', status: 'backlog' },
  { title: "Destek URL'i", body: '', status: 'backlog' },
  { title: 'Store ekran görüntüleri', body: '', status: 'backlog' },
  { title: 'Android feature graphic', body: '', status: 'backlog' },
  // Logo & Branding
  { title: 'App ikonu kalite kontrolü (1024x1024)', body: '', status: 'backlog' },
  { title: "Splash screen asset'leri doğrula", body: '', status: 'backlog' },
  { title: 'Uygulama logosu tasarımı (store için)', body: '', status: 'backlog' },
  // Frontend Eksikleri
  { title: 'getProfile endpoint (CR-006) — backend + frontend', body: '', status: 'backlog' },
  { title: 'Apple Sign-In implementasyonu', body: '', status: 'backlog' },
  { title: 'Google Sign-In implementasyonu', body: '', status: 'backlog' },
  { title: 'Analytics (PostHog) entegrasyonu', body: '', status: 'backlog' },
  { title: 'Leaderboard ekranını bağla (useDailyLeaderboard, useLevelLeaderboard)', body: '', status: 'backlog' },
  { title: 'Profil: avatar yükleme, ayarlar paneli (ses, haptik, tema)', body: '', status: 'backlog' },
  { title: 'getDailyChallenge path güncellemesi (CR-003)', body: '', status: 'backlog' },
  // Backend / Config
  { title: 'RevenueCat webhook (verifyPurchase)', body: '', status: 'backlog' },
  { title: 'Production secret management stratejisi dokümante et', body: '', status: 'backlog' },
  // Güvenlik
  { title: 'Edge Function rate limiting middleware', body: '', status: 'backlog' },
  { title: 'Storage bucket RLS (storage kullanılıyorsa)', body: '', status: 'backlog' },
  { title: 'Production CORS kısıtlaması', body: '', status: 'backlog' },
  { title: 'Admin şifresi production için güçlü değer', body: '', status: 'backlog' },
  { title: 'Frontend XSS kontrolü (dangerouslySetInnerHTML kullanımı)', body: '', status: 'backlog' },
  // Yapılandırılmamış Özellikler
  { title: 'Cron ayarları production ortamında test', body: '', status: 'backlog' },
  { title: 'AI review (Ollama) production URL yapılandırması', body: '', status: 'backlog' },
  { title: 'RevenueCat entitlement backend senkronizasyonu', body: '', status: 'backlog' },
  // Fikirler
  { title: 'Günlük meydan okuma ödülleri (coin, streak bonusu)', body: '', status: 'ideas' },
  { title: 'Ses efektleri (harf yazma, kelime tamamlama, hata)', body: '', status: 'ideas' },
  { title: 'Haptic feedback', body: '', status: 'ideas' },
  { title: 'Tema seçenekleri (açık/koyu)', body: '', status: 'ideas' },
  { title: 'Streak görselleştirmesi (ateş ikonu, animasyon)', body: '', status: 'ideas' },
  { title: 'Zorluk seçiminde önizleme (örnek grid)', body: '', status: 'ideas' },
  { title: 'Başarı rozetleri / achievement sistemi', body: '', status: 'ideas' },
  { title: 'Arkadaşlarla paylaşım (skor, bulmaca linki)', body: '', status: 'ideas' },
  { title: 'Offline modda daha fazla bulmaca önbellekleme', body: '', status: 'ideas' },
  { title: 'Zamanlayıcı modu (süreye karşı)', body: '', status: 'ideas' },
  { title: 'Günlük kelime ipucu / kelime öğrenme özelliği', body: '', status: 'ideas' },
]

function seed(): Todo[] {
  const ts = now()
  const todos: Todo[] = SEED_TODOS.map((s) => ({
    ...s,
    id: generateId(),
    createdAt: ts,
    updatedAt: ts,
  }))
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
    localStorage.setItem(SEEDED_KEY, '1')
  }
  return todos
}

const SEED_TODOS_V2: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: '[BEKLEYEN BİLGİ] AdMob iOS App ID',
    body: 'Google AdMob hesabı açıldıktan sonra iOS uygulamasını kaydet ve App ID\'yi al.\nFormat: ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX\nBu değer frontend/app.json → plugins → react-native-google-mobile-ads → iosAppId alanına girilecek.',
    status: 'blocked',
  },
  {
    title: '[BEKLEYEN BİLGİ] AdMob Android App ID',
    body: 'Google AdMob hesabı açıldıktan sonra Android uygulamasını kaydet ve App ID\'yi al.\nFormat: ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX\nBu değer frontend/app.json → plugins → react-native-google-mobile-ads → androidAppId alanına girilecek.',
    status: 'blocked',
  },
  {
    title: '[BEKLEYEN BİLGİ] AdMob Rewarded Ad Unit ID – iOS',
    body: 'Google AdMob > iOS Uygulaması > Ad Units > Rewarded bölümünden oluştur.\nFormat: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX\nBu değer frontend/app.json → extra → admobRewardedIos alanına girilecek.\nDev ortamı için test ID zaten ayarlı, üretim build\'i için gerekli.',
    status: 'blocked',
  },
  {
    title: '[BEKLEYEN BİLGİ] AdMob Rewarded Ad Unit ID – Android',
    body: 'Google AdMob > Android Uygulaması > Ad Units > Rewarded bölümünden oluştur.\nFormat: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX\nBu değer frontend/app.json → extra → admobRewardedAndroid alanına girilecek.\nDev ortamı için test ID zaten ayarlı, üretim build\'i için gerekli.',
    status: 'blocked',
  },
]

function seedV2(existing: Todo[]): Todo[] {
  const ts = new Date().toISOString()
  const newTodos: Todo[] = SEED_TODOS_V2.map((s) => ({
    ...s,
    id: crypto.randomUUID(),
    createdAt: ts,
    updatedAt: ts,
  }))
  const merged = [...existing, ...newTodos]
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    localStorage.setItem(SEEDED_V2_KEY, '1')
  }
  return merged
}

export function getTodos(): Todo[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  const alreadySeeded = localStorage.getItem(SEEDED_KEY) === '1'
  const alreadySeededV2 = localStorage.getItem(SEEDED_V2_KEY) === '1'

  let todos: Todo[]
  if (!raw || raw === '[]') {
    if (!alreadySeeded) {
      todos = seed()
    } else {
      todos = []
    }
  } else {
    try {
      const parsed = JSON.parse(raw) as Todo[]
      todos = Array.isArray(parsed) ? parsed : (alreadySeeded ? [] : seed())
    } catch {
      todos = alreadySeeded ? [] : seed()
    }
  }

  if (!alreadySeededV2) {
    todos = seedV2(todos)
  }

  return todos
}

export function saveTodos(todos: Todo[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
}

export function updateTodo(id: string, patch: Partial<Pick<Todo, 'title' | 'body' | 'status'>>): Todo | null {
  const todos = getTodos()
  const idx = todos.findIndex((t) => t.id === id)
  if (idx === -1) return null
  const updated = { ...todos[idx], ...patch, updatedAt: now() }
  todos[idx] = updated
  saveTodos(todos)
  return updated
}

export function createTodo(todo: Pick<Todo, 'title' | 'body' | 'status'>): Todo {
  const now = new Date().toISOString()
  const newTodo: Todo = {
    id: generateId(),
    title: todo.title,
    body: todo.body,
    status: todo.status,
    createdAt: now,
    updatedAt: now,
  }
  const todos = getTodos()
  todos.push(newTodo)
  saveTodos(todos)
  return newTodo
}

export function deleteTodo(id: string): boolean {
  const todos = getTodos()
  const filtered = todos.filter((t) => t.id !== id)
  if (filtered.length === todos.length) return false
  saveTodos(filtered)
  return true
}
