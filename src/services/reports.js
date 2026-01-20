// src/services/reports.ts
import { apiFetch, absoluteApiUrl } from "@/services/http";
/** Helper: convierte cualquier respuesta en JSON */
async function toJson(resOrJson) {
    return typeof resOrJson?.json === "function" ? await resOrJson.json() : resOrJson;
}
/** Normaliza a array sin importar la forma que venga */
function normalizeToArray(payload) {
    if (Array.isArray(payload))
        return payload;
    if (payload && typeof payload === "object") {
        // intenta campos comunes
        const candidates = ["results", "data", "rows", "items", "list"];
        for (const k of candidates) {
            const v = payload[k];
            if (Array.isArray(v))
                return v;
        }
    }
    // último recurso: no es array -> vacío
    return [];
}
/** JSON para rango (garantiza ReportRow[]) */
export async function fetchReportRange(params) {
    const { start, end, only_final } = params;
    const qs = new URLSearchParams({
        start,
        end,
        only_final: String(!!only_final),
    });
    const raw = await apiFetch(`/api/purchase-lists/export/range/?${qs.toString()}`);
    const json = await toJson(raw);
    return normalizeToArray(json);
}
/** URL del PDF (para abrir/descargar) */
export function getReportPdfUrl(params) {
    const { start, end, only_final } = params;
    const qs = new URLSearchParams({
        start,
        end,
        only_final: String(!!only_final),
    });
    return absoluteApiUrl(`/api/purchase-lists/export/range/pdf/?${qs.toString()}`);
}
