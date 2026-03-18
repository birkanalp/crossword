// ─── Format Utilities ─────────────────────────────────────────────────────────

/**
 * Formats a duration in seconds to "M:SS" display string.
 * Examples: 65 → "1:05", 3600 → "60:00"
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Returns the first 2 characters of a name, upper-cased.
 * Used for avatar initials inside colored circles.
 * Falls back to "??" if name is empty.
 */
export function getInitials(name: string): string {
  if (!name || name.trim().length === 0) return '??';
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Formats a large number with a "k" suffix above 999.
 * Examples: 1200 → "1.2k", 950 → "950"
 */
export function formatScore(score: number): string {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(score);
}
