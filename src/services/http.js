// src/services/http.ts
// === Base de API ===
const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;
/** Lee/guarda el token en localStorage */
export function getToken() {
    try {
        return localStorage.getItem('token');
    }
    catch {
        return null;
    }
}
export function setToken(token) {
    try {
        token ? localStorage.setItem('token', token) : localStorage.removeItem('token');
    }
    catch { }
}
/** Convierte una ruta relativa en URL absoluta contra API_BASE */
export function absoluteApiUrl(path) {
    if (/^https?:\/\//i.test(path))
        return path;
    return new URL(path, API_BASE).toString();
}
/** Construye Headers fusionando los del caller con Authorization si hay token */
function buildHeaders(init) {
    const h = new Headers(init?.headers || undefined);
    const token = getToken();
    if (token && !h.has('Authorization'))
        h.set('Authorization', `Token ${token}`);
    if (!h.has('Accept'))
        h.set('Accept', 'application/json, text/plain, */*');
    const body = init?.body;
    const isFormData = (typeof FormData !== 'undefined') && body instanceof FormData;
    if (!isFormData && body != null && !h.has('Content-Type'))
        h.set('Content-Type', 'application/json');
    return h;
}
/** Normaliza el body: si es objeto y no es FormData, lo serializa a JSON */
function normalizeBody(init) {
    const body = init?.body;
    if (body == null)
        return undefined;
    const isFormData = (typeof FormData !== 'undefined') && body instanceof FormData;
    if (isFormData)
        return body;
    if (typeof body === 'string')
        return body;
    try {
        return JSON.stringify(body);
    }
    catch {
        return body;
    }
}
/**
 * Fetch principal:
 * - Usa credenciales (cookies si las hubiera)
 * - Añade Authorization si hay token
 * - Serializa body a JSON automáticamente (si aplica)
 * - Devuelve JSON si el servidor responde JSON; si no, texto
 */
export async function apiFetch(path, init) {
    const url = absoluteApiUrl(path);
    const headers = buildHeaders(init);
    const body = normalizeBody(init);
    const res = await fetch(url, { credentials: 'include', ...init, headers, body });
    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                const j = await res.json();
                if (j?.detail && typeof j.detail === 'string') {
                    message = j.detail;
                }
                else if (j && typeof j === 'object') {
                    for (const k of Object.keys(j)) {
                        const v = j[k];
                        if (Array.isArray(v) && v.length) {
                            message = `${k}: ${v[0]}`;
                            break;
                        }
                        if (typeof v === 'string') {
                            message = `${k}: ${v}`;
                            break;
                        }
                    }
                    if (message.startsWith('HTTP'))
                        message = JSON.stringify(j);
                }
            }
            else {
                const t = await res.text();
                if (t)
                    message = t;
            }
        }
        catch { }
        throw new Error(message);
    }
    if (res.status === 204)
        return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json'))
        return res.json();
    return res.text();
}
/** Para endpoints que devuelven archivos (PDF/Excel/etc.) */
export async function apiFetchBlob(path, init) {
    const url = absoluteApiUrl(path);
    const headers = buildHeaders(init);
    const body = normalizeBody(init);
    const res = await fetch(url, { credentials: 'include', ...init, headers, body });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.blob();
}
/** Helper cómodo para abrir PDFs en nueva pestaña (con fallback si bloquean popups) */
export function openPdfUrl(href) {
    const url = absoluteApiUrl(href);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w)
        window.location.href = url;
}
