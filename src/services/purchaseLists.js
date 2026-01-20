// src/services/purchaseLists.ts
// Utilidades para Purchase Lists (PDFs con/sin precios, por categoría, etc.)
import { apiFetch, apiFetchBlob, absoluteApiUrl } from "@/services/http";
import { downloadBlob } from "@/services/download";
/* ===================== Helpers básicos ===================== */
/** Construye un URLSearchParams respetando null/undefined y arrays como CSV. */
function buildParams(obj) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === undefined || v === null || v === "")
            continue;
        if (Array.isArray(v)) {
            if (v.length === 0)
                continue;
            usp.set(k, v.join(","));
        }
        else {
            usp.set(k, String(v));
        }
    }
    return usp;
}
/** Serializa las opciones de PDF a params compatibles con el backend existente. */
function serializePdfOpts(opts) {
    const p = {};
    if (opts?.hide_prices)
        p["hide_prices"] = "1"; // backend entiende 1/true
    if (opts?.category_id != null && opts.category_id !== "")
        p["category_id"] = String(opts.category_id);
    if (opts?.category_ids && opts.category_ids.length > 0)
        p["category_ids"] = opts.category_ids.map(String);
    // Passthrough de extras si existieran (p. ej., restaurant_id, only_final, etc.)
    for (const [k, v] of Object.entries(opts || {})) {
        if (k in p)
            continue; // ya serializado arriba
        if (v === undefined || v === null || v === "")
            continue;
        p[k] = v;
    }
    return buildParams(p);
}
/* ===================== Detalles de la lista ===================== */
/** Devuelve el detalle de una purchase list (incluye items para extraer categorías). */
export async function fetchPurchaseListDetail(listId) {
    return apiFetch(`/purchase-lists/${listId}/`);
}
/* ===================== URLs de PDF ===================== */
/** URL base al endpoint PDF de una purchase list. */
export function getPdfUrlBase(listId) {
    return absoluteApiUrl(`/purchase-lists/${listId}/pdf/`);
}
/**
 * URL del PDF con opciones. Por defecto incluye precios.
 * Ejemplos:
 *  - getPdfUrl(81)                          -> PDF normal con precios
 *  - getPdfUrl(81, { hide_prices: true })   -> PDF sin precios
 *  - getPdfUrl(81, { hide_prices: true, category_id: 5 }) -> sin precios, solo categoría 5
 */
export function getPdfUrl(listId, opts) {
    const usp = serializePdfOpts(opts);
    const base = getPdfUrlBase(listId);
    const qs = usp.toString();
    return qs ? `${base}?${qs}` : base;
}
/** Atajo para URL de PDF sin precios (opcionalmente por una categoría). */
export function getPdfUrlNoPrices(listId, opts) {
    return getPdfUrl(listId, {
        hide_prices: true,
        category_id: opts?.category_id ?? null,
    });
}
/* ===================== Descargas (Blob) ===================== */
/**
 * Descarga un PDF (con o sin precios). Respeta la preferencia de descarga directa.
 * El nombre del archivo intenta ser informativo; cámbialo si prefieres series_code.
 */
export async function downloadPdf(listId, opts) {
    const url = getPdfUrl(listId, opts);
    const blob = await apiFetchBlob(url);
    const suffixPrice = opts?.hide_prices ? "sin-precios" : "con-precios";
    let suffixCat = "";
    if (opts?.category_id != null && opts.category_id !== "") {
        suffixCat = `_cat-${opts.category_id}`;
    }
    else if (opts?.category_ids && opts.category_ids.length > 0) {
        suffixCat = `_cats-${opts.category_ids.join("-")}`;
    }
    downloadBlob(blob, `PL-${listId}-${suffixPrice}${suffixCat}.pdf`);
}
/** Atajo para descargar PDF sin precios (todo o por una categoría). */
export async function downloadPdfNoPrices(listId, opts) {
    return downloadPdf(listId, { hide_prices: true, category_id: opts?.category_id ?? null });
}
/* ===================== Helpers opcionales ya usados en tu UI ===================== */
/**
 * Devuelve un set único de categorías presentes en los items de una purchase list.
 * Útil para poblar el <select> del modal.
 */
export async function fetchUniqueCategoriesFromList(listId) {
    const detail = await fetchPurchaseListDetail(listId);
    const items = detail?.items || detail?.purchase_list_items || [];
    const uniq = new Map();
    for (const it of items) {
        const cid = it.category_id ?? it.category?.id ?? null;
        const cname = it.category?.name ?? it.category_name ?? "";
        if (cid != null && cname)
            uniq.set(cid, cname);
    }
    return Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
}
