import { ref, computed, onMounted, watch } from "vue";
import { useCatalog } from "@/composables/useCatalog";
import { getPdfUrlNoPrices } from "@/services/purchaseLists";
import { apiFetch, absoluteApiUrl } from "@/services/http";
/* ===== helpers estrictos ===== */
const idStr = (v) => (v == null ? "" : String(v));
const toIntStrict = (raw) => {
    if (raw == null)
        return null;
    const s = String(raw).trim();
    if (!/^\d+$/.test(s))
        return null;
    const n = Number(s);
    return Number.isSafeInteger(n) ? n : null;
};
const pad4 = (n) => String(n).padStart(4, "0");
const DEBUG = true;
const dbg = (...a) => { if (DEBUG)
    console.debug("[ListBuilder]", ...a); };
/* ===== catálogo ===== */
const { load, restaurants, categories, products, units, unitsById } = useCatalog();
/* ===== estado UI ===== */
const selectedRestaurantRaw = ref("");
const selectedCategoryRaw = ref("");
const selectedProductRaw = ref("");
const selectedUnitRaw = ref("");
const qty = ref(null);
const listId = ref(null);
const creating = ref(false);
const adding = ref(false);
const items = ref([]);
/* ===== catálogo load + fallbacks ===== */
onMounted(async () => {
    await load().catch(() => { });
    if (!Array.isArray(restaurants.value) || restaurants.value.length === 0) {
        try {
            restaurants.value = await apiFetch("/api/restaurants/");
        }
        catch { }
    }
    if (!Array.isArray(categories.value) || categories.value.length === 0) {
        try {
            categories.value = await apiFetch("/api/categories/");
        }
        catch { }
    }
    if (!Array.isArray(products.value) || products.value.length === 0) {
        try {
            products.value = await apiFetch("/api/products/");
        }
        catch { }
    }
    if (!Array.isArray(units.value) || units.value.length === 0) {
        try {
            units.value = await apiFetch("/api/units/");
        }
        catch { }
    }
});
/* ===== computeds ===== */
const restaurantId = computed(() => toIntStrict(selectedRestaurantRaw.value));
const categoryId = computed(() => toIntStrict(selectedCategoryRaw.value));
const productId = computed(() => toIntStrict(selectedProductRaw.value));
const unitId = computed(() => toIntStrict(selectedUnitRaw.value));
const currentRestaurant = computed(() => {
    const rid = selectedRestaurantRaw.value;
    if (!rid)
        return null;
    return restaurants.value.find((r) => idStr(r.id) === rid) ?? null;
});
const isCurrency = computed(() => {
    const uid = unitId.value;
    return uid != null ? !!unitsById.value.get(uid)?.is_currency : false;
});
const selectedProducts = computed(() => {
    const cat = selectedCategoryRaw.value;
    if (!cat)
        return [];
    return products.value.filter((p) => idStr(p.category) === cat);
});
watch(selectedCategoryRaw, () => {
    selectedProductRaw.value = "";
    selectedUnitRaw.value = "";
});
watch(selectedProductRaw, (pid) => {
    if (!pid) {
        selectedUnitRaw.value = "";
        return;
    }
    const p = products.value.find((x) => idStr(x.id) === pid);
    selectedUnitRaw.value = p?.default_unit != null ? String(p.default_unit) : "";
});
const canAdd = computed(() => !!listId.value &&
    productId.value != null &&
    unitId.value != null &&
    typeof qty.value === "number" &&
    isFinite(qty.value));
/* ===== helpers para tabla ===== */
const productsById = computed(() => {
    const m = new Map();
    products.value.forEach((p) => m.set(p.id, p));
    return m;
});
const productName = (id) => {
    if (id == null)
        return "-";
    const p = productsById.value.get(id);
    return (p?.name ?? String(id));
};
const unitLabel = (id) => {
    if (id == null)
        return "-";
    const u = unitsById.value.get(id);
    return (u?.symbol || u?.name || String(id));
};
/* ===== auth/fetch ===== */
function tokenCandidates() {
    return [
        localStorage.getItem("access_token"),
        localStorage.getItem("token"),
        localStorage.getItem("authToken"),
    ].filter(Boolean);
}
const schemes = ["Token", "Bearer"];
async function postJson(url, body) {
    const payload = JSON.stringify(body);
    for (const t of tokenCandidates()) {
        for (const s of schemes) {
            const resp = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", Authorization: `${s} ${t}` },
                body: payload,
            });
            if (resp.ok)
                return resp;
            if (resp.status !== 401 && resp.status !== 405 && resp.status !== 404)
                return resp;
        }
    }
    return await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: payload,
    });
}
/* ===== crear lista ===== */
async function ensureList() {
    if (restaurantId.value == null) {
        alert("Selecciona un restaurante primero.");
        return;
    }
    if (listId.value || creating.value)
        return;
    creating.value = true;
    try {
        const url = absoluteApiUrl("/api/purchase-lists/");
        const resp = await postJson(url, { restaurant: restaurantId.value });
        if (!resp.ok) {
            try {
                const j = await resp.clone().json();
                throw new Error(j?.detail || JSON.stringify(j));
            }
            catch {
                throw new Error(await resp.text());
            }
        }
        const data = await resp.json();
        listId.value = toIntStrict(data?.id);
        if (listId.value == null)
            throw new Error("ID de lista inválido.");
        dbg("Lista creada:", listId.value);
    }
    catch (e) {
        alert(e?.message || "No se pudo crear la lista (POST /api/purchase-lists/).");
    }
    finally {
        creating.value = false;
    }
}
/* ===== autodetección endpoint items ===== */
let cachedItemsEndpoint = null;
async function detectItemsEndpoint(purchaseListId) {
    if (cachedItemsEndpoint)
        return cachedItemsEndpoint;
    const nested = absoluteApiUrl(`/api/purchase-lists/${purchaseListId}/items/`);
    try {
        const probe = await fetch(nested, { method: "HEAD", credentials: "include" });
        if (probe.ok || [401, 403, 405].includes(probe.status)) {
            cachedItemsEndpoint = "nested";
            dbg("Endpoint detectado: nested", nested, "status:", probe.status);
            return cachedItemsEndpoint;
        }
    }
    catch { }
    try {
        const probe = await fetch(nested, { method: "OPTIONS", credentials: "include" });
        if (probe.ok || [200, 204, 401, 403, 405].includes(probe.status)) {
            cachedItemsEndpoint = "nested";
            dbg("Endpoint detectado (OPTIONS): nested", nested, "status:", probe.status);
            return cachedItemsEndpoint;
        }
    }
    catch { }
    cachedItemsEndpoint = "flat";
    dbg("Endpoint detectado: flat (/api/items/)");
    return cachedItemsEndpoint;
}
/* ===== agregar ítem ===== */
async function onAdd() {
    await ensureList();
    const p = productId.value, u = unitId.value, q = Number(qty.value);
    if (!listId.value || p == null || u == null || !Number.isFinite(q)) {
        alert("Selecciona producto, unidad y una cantidad válida.");
        return;
    }
    adding.value = true;
    try {
        const which = await detectItemsEndpoint(Number(listId.value));
        let url;
        let body;
        if (which === "nested") {
            url = absoluteApiUrl(`/api/purchase-lists/${listId.value}/items/`);
            body = { product: p, unit: u, qty: q };
        }
        else {
            url = absoluteApiUrl(`/api/items/`);
            body = { purchase_list: Number(listId.value), product: p, unit: u, qty: q };
        }
        dbg("POST →", which, url);
        dbg("Body →", body);
        const resp = await postJson(url, body);
        if (!resp.ok) {
            try {
                const j = await resp.clone().json();
                throw new Error(j?.detail || JSON.stringify(j));
            }
            catch {
                throw new Error(await resp.text());
            }
        }
        const saved = await resp.json();
        items.value.push({
            id: saved?.id,
            product: saved?.product ?? p,
            unit: saved?.unit ?? u,
            qty: saved?.qty ?? q,
        });
        // limpiar selección
        selectedProductRaw.value = "";
        selectedUnitRaw.value = "";
        qty.value = null;
    }
    catch (e) {
        alert(e?.message || "No se pudo agregar el ítem.");
    }
    finally {
        adding.value = false;
    }
}
/* ===== nombre de archivo “serie-like” ===== */
function buildSeriesLikeName(withSn = true) {
    const year = new Date().getFullYear();
    const code = (currentRestaurant.value?.code || currentRestaurant.value?.name || "R").toString().trim().replace(/\s+/g, "-").toUpperCase();
    const num = listId.value != null ? pad4(Number(listId.value)) : "0000";
    return withSn ? `${year}-${code}-Sn-${num}` : `${year}-${code}-${num}`;
}
/* ===== PDF sin precios (descarga directa + reset + nueva lista) ===== */
function safeFileName(name) { return name.replace(/[\\/:*?"<>|]+/g, "_"); }
async function downloadPdfNoPrices() {
    if (!listId.value)
        return;
    const url = absoluteApiUrl(`/api/purchase-lists/${listId.value}/pdf/?hide_prices=1`);
    const desiredName = safeFileName(`${buildSeriesLikeName(true)}.pdf`);
    const tryFetchDownload = async (headers) => {
        const resp = await fetch(url, { method: "GET", credentials: "include", headers });
        if (!resp.ok)
            throw resp;
        const blob = await resp.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = desiredName; // 👈 nombre “AÑO-COD-Sn-NNNN.pdf”
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 60_000);
    };
    try {
        // primero con Authorization, por si el endpoint lo exige
        for (const t of tokenCandidates()) {
            for (const s of schemes) {
                try {
                    await tryFetchDownload({ Authorization: `${s} ${t}` });
                    // éxito: reset y crear nueva lista
                    resetBuilder({ keepRestaurant: true });
                    return;
                }
                catch (e) {
                    if (!(e instanceof Response && e.status === 401)) {
                        const msg = e instanceof Response ? await e.text() : e?.message;
                        alert(msg || "No se pudo descargar el PDF");
                        return;
                    }
                }
            }
        }
        await tryFetchDownload({});
        resetBuilder({ keepRestaurant: true });
    }
    catch {
        // último recurso: navegar (deja que el servidor haga attachment)
        window.location.href = url;
        // al navegar no podemos resetear; pero si vuelve, lo hará manualmente.
    }
}
/* ===== reset ===== */
function resetBuilder(opts = {}) {
    const keep = opts.keepRestaurant ?? false;
    const r = selectedRestaurantRaw.value;
    listId.value = null;
    items.value = [];
    selectedCategoryRaw.value = "";
    selectedProductRaw.value = "";
    selectedUnitRaw.value = "";
    qty.value = null;
    selectedRestaurantRaw.value = keep ? r : "";
}
const pdfUrl = computed(() => (listId.value ? getPdfUrlNoPrices(listId.value) : "#"));
async function onViewPdf() { await downloadPdfNoPrices(); }
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6 max-w-3xl mx-auto space-y-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-xl font-semibold" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid gap-2" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.selectedRestaurantRaw),
    ...{ class: "border rounded p-2" },
});
// @ts-ignore
[selectedRestaurantRaw,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
for (const [r] of __VLS_getVForSourceType((__VLS_ctx.restaurants))) {
    // @ts-ignore
    [restaurants,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (r.id),
        value: (__VLS_ctx.idStr(r.id)),
    });
    // @ts-ignore
    [idStr,];
    (r.name);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.selectedCategoryRaw),
    ...{ class: "border rounded p-2 w-full" },
});
// @ts-ignore
[selectedCategoryRaw,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
for (const [c] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
    // @ts-ignore
    [categories,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (c.id),
        value: (__VLS_ctx.idStr(c.id)),
    });
    // @ts-ignore
    [idStr,];
    (c.name);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.selectedProductRaw),
    ...{ class: "border rounded p-2 w-full" },
    disabled: (!__VLS_ctx.selectedCategoryRaw),
});
// @ts-ignore
[selectedCategoryRaw, selectedProductRaw,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
for (const [p] of __VLS_getVForSourceType((__VLS_ctx.selectedProducts))) {
    // @ts-ignore
    [selectedProducts,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (p.id),
        value: (__VLS_ctx.idStr(p.id)),
    });
    // @ts-ignore
    [idStr,];
    (p.name);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-3 gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.selectedUnitRaw),
    ...{ class: "border rounded p-2 w-full" },
});
// @ts-ignore
[selectedUnitRaw,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
for (const [u] of __VLS_getVForSourceType((__VLS_ctx.units))) {
    // @ts-ignore
    [units,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (u.id),
        value: (__VLS_ctx.idStr(u.id)),
    });
    // @ts-ignore
    [idStr,];
    (u.name);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "text-sm" },
});
(__VLS_ctx.isCurrency ? 'Importe (S/)' : 'Cantidad');
// @ts-ignore
[isCurrency,];
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "number",
    step: "0.001",
    ...{ class: "border rounded p-2 w-full" },
});
(__VLS_ctx.qty);
// @ts-ignore
[qty,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-end" },
});
__VLS_asFunctionalElement(__VLS_elements.small, __VLS_elements.small)({
    ...{ class: "text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex gap-3" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.ensureList) },
    disabled: (__VLS_ctx.restaurantId === null || __VLS_ctx.creating),
    ...{ class: "bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50" },
});
// @ts-ignore
[ensureList, restaurantId, creating,];
(__VLS_ctx.creating ? 'Creando…' : 'Crear lista (si no existe)');
// @ts-ignore
[creating,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.onAdd) },
    disabled: (!__VLS_ctx.canAdd || __VLS_ctx.adding),
    ...{ class: "bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50" },
});
// @ts-ignore
[onAdd, canAdd, adding,];
(__VLS_ctx.adding ? 'Agregando…' : 'Agregar ítem');
// @ts-ignore
[adding,];
if (__VLS_ctx.listId) {
    // @ts-ignore
    [listId,];
    __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
        ...{ onClick: (__VLS_ctx.onViewPdf) },
        href: (__VLS_ctx.pdfUrl),
        ...{ class: "bg-gray-700 text-white px-4 py-2 rounded" },
    });
    // @ts-ignore
    [onViewPdf, pdfUrl,];
}
if (__VLS_ctx.items.length) {
    // @ts-ignore
    [items,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({
        ...{ class: "w-full border table-fixed" },
    });
    __VLS_asFunctionalElement(__VLS_elements.colgroup, __VLS_elements.colgroup)({});
    __VLS_asFunctionalElement(__VLS_elements.col)({
        ...{ class: "w-1/2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.col)({
        ...{ class: "w-1/4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.col)({
        ...{ class: "w-1/4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
    __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
        ...{ class: "bg-gray-100" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-left" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-left" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
    for (const [it] of __VLS_getVForSourceType((__VLS_ctx.items))) {
        // @ts-ignore
        [items,];
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
            key: (it.id ?? `${it.product}-${it.unit}-${it.qty}`),
        });
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (__VLS_ctx.productName(it.product));
        // @ts-ignore
        [productName,];
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (__VLS_ctx.unitLabel(it.unit));
        // @ts-ignore
        [unitLabel,];
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-right font-mono tabular-nums" },
        });
        (it.qty);
    }
}
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        idStr: idStr,
        restaurants: restaurants,
        categories: categories,
        units: units,
        selectedRestaurantRaw: selectedRestaurantRaw,
        selectedCategoryRaw: selectedCategoryRaw,
        selectedProductRaw: selectedProductRaw,
        selectedUnitRaw: selectedUnitRaw,
        qty: qty,
        listId: listId,
        creating: creating,
        adding: adding,
        items: items,
        restaurantId: restaurantId,
        isCurrency: isCurrency,
        selectedProducts: selectedProducts,
        canAdd: canAdd,
        productName: productName,
        unitLabel: unitLabel,
        ensureList: ensureList,
        onAdd: onAdd,
        pdfUrl: pdfUrl,
        onViewPdf: onViewPdf,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
