// src/services/reports.ts
import { apiFetch, absoluteApiUrl } from "@/services/http";

/** Estructura de cada fila del reporte */
export type ReportRow = {
  date: string;
  restaurant_id: number | string | null;
  restaurant_name: string;
  category_id: number | string | null;
  category_name: string;
  product_id: number | string | null;
  product_name: string;
  unit_symbol: string | null;
  qty: number;
  price_soles: number | null;
  subtotal_soles: number;
};

/** Helper: convierte cualquier respuesta en JSON */
async function toJson<T = unknown>(resOrJson: any): Promise<T> {
  return typeof resOrJson?.json === "function" ? await resOrJson.json() : (resOrJson as T);
}

/** Normaliza a array sin importar la forma que venga */
function normalizeToArray<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    // intenta campos comunes
    const candidates = ["results", "data", "rows", "items", "list"];
    for (const k of candidates) {
      const v = (payload as any)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  // último recurso: no es array -> vacío
  return [];
}

/** JSON para rango (garantiza ReportRow[]) */
export async function fetchReportRange(params: {
  start: string;
  end: string;
  only_final: boolean;
}): Promise<ReportRow[]> {
  const { start, end, only_final } = params;
  const qs = new URLSearchParams({
    start,
    end,
    only_final: String(!!only_final),
  });

  const raw = await apiFetch(`/api/purchase-lists/export/range/?${qs.toString()}`);
  const json = await toJson<any>(raw);
  return normalizeToArray<ReportRow>(json);
}

/** URL del PDF (para abrir/descargar) */
export function getReportPdfUrl(params: {
  start: string;
  end: string;
  only_final: boolean;
}): string {
  const { start, end, only_final } = params;
  const qs = new URLSearchParams({
    start,
    end,
    only_final: String(!!only_final),
  });
  return absoluteApiUrl(`/api/purchase-lists/export/range/pdf/?${qs.toString()}`);
}
