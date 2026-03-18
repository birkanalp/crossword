// GET /functions/v1/getLeaderboard?type=daily|all_time&sort_by=score|time&limit=50
// Contract: api.contract.json §getLeaderboard (v1.3.0)

export interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  avatar_color: string
  score: number
  time_seconds: number
  mistakes: number
}

export interface LeaderboardResponse {
  type: 'daily' | 'all_time'
  entries: LeaderboardEntry[]
  total: number
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export async function getLeaderboard(
  type: 'daily' | 'all_time',
  sortBy: 'score' | 'time' = 'score',
  limit = 50,
): Promise<LeaderboardResponse> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/getLeaderboard`)
  url.searchParams.set('type', type)
  url.searchParams.set('sort_by', sortBy)
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), {
    headers: { apikey: ANON_KEY },
    next: { revalidate: 60 }, // cache for 60s (Next.js server fetch)
  })

  if (!res.ok) {
    throw new Error(`Leaderboard fetch failed: ${res.status}`)
  }

  return res.json() as Promise<LeaderboardResponse>
}
