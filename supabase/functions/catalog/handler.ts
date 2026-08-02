/**
 * Catalog business logic (issue #9).
 *
 * Returns the public active-SKU catalog. No auth required — catalog is public.
 * No random rolls — fixed-price/effect SKUs only (STACK_LOCK: no RNG).
 *
 * All DB access injected for Node testability.
 */

export interface SkuRow {
  id: string;
  name: string;
  priceCents: number;
  onChainSkuId: number | null;
}

export interface CatalogDeps {
  fetchCatalog(): Promise<SkuRow[]>;
}

export async function handleCatalog(
  req: Request,
  deps: CatalogDeps,
): Promise<Response> {
  if (req.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  let skus: SkuRow[];
  try {
    skus = await deps.fetchCatalog();
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  return Response.json({ skus });
}
