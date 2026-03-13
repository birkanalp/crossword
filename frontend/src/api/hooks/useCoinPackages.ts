import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────
// Matches api.contract.json#/components/CoinPackage (contract v1.2.5)

export interface CoinPackage {
  id: string;
  name: string;
  description: string | null;
  coin_amount: number;
  price_usd: number;
  original_price_usd: number | null;
  discount_percent: number;
  badge: 'popular' | 'best_value' | 'new' | 'limited' | null;
  is_featured: boolean;
  sort_order: number;
  revenuecat_product_id: string | null;
}

interface CoinPackagesResponse {
  packages: CoinPackage[];
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const coinPackageKeys = {
  all: ['coin-packages'] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Contract: GET /getCoinPackages — no auth required, returns active packages.
// (api.contract.json#/endpoints/getCoinPackages)

export function useCoinPackages() {
  return useQuery<CoinPackage[], Error>({
    queryKey: coinPackageKeys.all,
    queryFn: async () => {
      const res = await apiRequest<CoinPackagesResponse>('/getCoinPackages', {
        method: 'GET',
      });
      if (res.error || !res.data) {
        throw new Error(res.error ?? 'Coin paketleri yüklenemedi');
      }
      return res.data.packages;
    },
    // Packages change infrequently; 5-minute stale time avoids redundant requests
    staleTime: 5 * 60 * 1000,
  });
}
