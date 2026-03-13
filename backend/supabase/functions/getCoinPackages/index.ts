// =============================================================================
// Edge Function: getCoinPackages
//
// Public endpoint — no authentication required.
// Returns all active coin packages ordered by sort_order.
// Used by the frontend shop/store screen.
//
// GET /getCoinPackages
//   Response: { packages: CoinPackage[] }
// =============================================================================

import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/auth.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const { data, error } = await serviceClient()
    .from("coin_packages")
    .select(
      "id, name, description, coin_amount, price_usd, original_price_usd, " +
      "discount_percent, badge, is_featured, sort_order, revenuecat_product_id",
    )
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("[getCoinPackages]", error);
    return errorResponse(error.message, 500);
  }

  return jsonResponse({ packages: data ?? [] });
});
