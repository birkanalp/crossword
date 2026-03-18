'use client'

import { useState, useEffect } from 'react'
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api'
import type { Dictionary } from '@/dictionaries/tr'

interface LeaderboardTableProps {
  dict: Dictionary['leaderboard']
  initialType?: 'daily' | 'all_time'
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LeaderboardTable({ dict, initialType = 'daily' }: LeaderboardTableProps) {
  const [type, setType] = useState<'daily' | 'all_time'>(initialType)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    getLeaderboard(type)
      .then((res) => setEntries(res.entries))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [type])

  const tabs: { key: 'daily' | 'all_time'; label: string }[] = [
    { key: 'daily', label: dict.tabDaily },
    { key: 'all_time', label: dict.tabAllTime },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              type === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-center text-gray-500 py-12">{dict.loading}</p>
      )}

      {error && !loading && (
        <p className="text-center text-red-500 py-12">{dict.error}</p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-center text-gray-500 py-12">{dict.empty}</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-3 pr-4 font-medium w-10">{dict.colRank}</th>
                <th className="pb-3 pr-4 font-medium">{dict.colPlayer}</th>
                <th className="pb-3 pr-4 font-medium text-right">{dict.colScore}</th>
                <th className="pb-3 font-medium text-right">{dict.colTime}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 pr-4 text-gray-400 font-medium">
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0"
                        style={{ backgroundColor: entry.avatar_color }}
                      >
                        {entry.display_name[0]?.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-900">{entry.display_name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-gray-700">
                    {entry.score.toLocaleString()}
                  </td>
                  <td className="py-3 text-right font-mono text-gray-500">
                    {formatTime(entry.time_seconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
