import { ref, onMounted } from 'vue';
import { apiFetch, apiFetchBlob } from '@/services/http';
import { downloadBlob } from '@/services/download';
import { useCatalog } from '@/composables/useCatalog';
const { categories: catalogCategories, load: loadCatalog } = useCatalog(); // mantenemos compat, aunque el modal usa categorías de la lista
function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function fmtShort(iso) {
    if (!iso)
        return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime()))
        return String(iso);
    const y = d.getFullYear(), m = pad2(d.getMonth() + 1), da = pad2(d.getDate());
    const hh = pad2(d.getHours()), mm = pad2(d.getMinutes());
    return `${y}-${m}-${da} | ${hh}:${mm}`;
}
const rows = ref([]);
const loading = ref(false);
const err = ref(null);
async function load() {
    loading.value = true;
    err.value = null;
    try {
        const data = await apiFetch('/api/purchase-lists/');
        rows.value = data;
    }
    catch (e) {
        err.value = e?.message || 'No se pudo cargar';
    }
    finally {
        loading.value = false;
    }
}
function isFinal(r) {
    return r.status?.toLowerCase() === 'final' || !!r.finalized_at;
}
/* ========== Descargar PDF (autenticado, usando apiFetchBlob) ========== */
function safeFileName(name) {
    return name.replace(/[\\/:*?"<>|]+/g, "_");
}
// PDF normal (con precios por defecto). Si hidePrices=true, agrega ?hide_prices=1
async function downloadPdf(row, hidePrices = false) {
    try {
        const qs = hidePrices ? `?hide_prices=1` : ``;
        const path = `/api/purchase-lists/${row.id}/pdf/${qs}`;
        const blob = await apiFetchBlob(path); // incluye Authorization/cookies
        const suffix = hidePrices ? '-sin-precios' : '';
        const filename = safeFileName(`${row.series_code || `lista-${row.id}`}${suffix}.pdf`);
        downloadBlob(blob, filename);
    }
    catch (e) {
        alert(e?.message || 'No se pudo descargar el PDF');
    }
}
/* ========== PDF SIN PRECIOS (modal con UNA categoría opcional) ========== */
const pdfModalOpen = ref(false);
const pdfListId = ref(null);
const pdfSeriesCode = ref(null);
const pdfCategories = ref([]);
const selectedCategoryId = ref('');
/** Extrae las categorías ÚNICAS presentes en los items de una lista */
async function fetchCategoriesFromItems(listId) {
    const uniq = new Map();
    try {
        const data = await apiFetch(`/api/purchase-list-items/?purchase_list=${listId}&_=${Date.now()}`, { cache: 'no-store' });
        for (const it of (data || [])) {
            const cid = it.category_id ??
                it.category?.id ??
                it.categoryId ??
                it.category ??
                it.product?.category_id ??
                it.product?.category?.id ??
                null;
            const cname = it.category?.name ??
                it.category_name ??
                it.categoryName ??
                it.product?.category_name ??
                it.product?.category?.name ??
                "";
            if (cid != null && cname)
                uniq.set(cid, cname);
        }
    }
    catch { /* ignore */ }
    const arr = Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
    arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return arr;
}
/** Pide categorías por restaurant directamente al backend */
async function fetchCategoriesByRestaurant(restaurantId) {
    try {
        const data = await apiFetch(`/api/categories/?restaurant=${restaurantId}`);
        const arr = (data || [])
            .map((c) => ({ id: c.id, name: c.name }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        return arr;
    }
    catch {
        return [];
    }
}
/** Carga categorías para el modal: Ítems -> Restaurante -> (último) todas las categorías sin filtro */
async function fetchCategoriesForList(listId, restaurantHint) {
    // 1) por ítems
    const byItems = await fetchCategoriesFromItems(listId);
    if (byItems.length > 0)
        return byItems;
    // 2) por detalle (para obtener restaurant id fiable)
    let restaurantId = restaurantHint;
    try {
        const detail = await apiFetch(`/api/purchase-lists/${listId}/`);
        restaurantId =
            detail?.restaurant ??
                detail?.restaurant_id ??
                restaurantHint;
    }
    catch { /* ignore */ }
    // 3) por restaurant
    if (restaurantId != null && restaurantId !== '') {
        const byR = await fetchCategoriesByRestaurant(restaurantId);
        if (byR.length > 0)
            return byR;
    }
    // 4) último recurso: traer todas (sin filtro)
    try {
        const all = await apiFetch(`/api/categories/`);
        const arr = (all || [])
            .map((c) => ({ id: c.id, name: c.name }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        return arr;
    }
    catch {
        return [];
    }
}
async function fallbackCategoriesForRestaurant(restaurantId) {
    // 1) intenta usar el catálogo en memoria
    if (!catalogCategories.value || catalogCategories.value.length === 0) {
        try {
            await loadCatalog();
        }
        catch { }
    }
    const inMemory = (catalogCategories.value || [])
        .filter((c) => 
    // intenta varias llaves comunes
    (c.restaurant === restaurantId) ||
        (c.restaurant_id === restaurantId) ||
        (String(c.restaurant_id ?? c.restaurant ?? '') === String(restaurantId)))
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (inMemory.length > 0)
        return inMemory;
    // 2) si no hay en memoria, pide al backend
    try {
        const data = await apiFetch(`/api/categories/?restaurant=${restaurantId}`);
        return (data || [])
            .map((c) => ({ id: c.id, name: c.name }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
    catch {
        return [];
    }
}
async function openPdfModal(r) {
    pdfListId.value = r.id;
    pdfSeriesCode.value = r.series_code || null;
    pdfModalOpen.value = true;
    selectedCategoryId.value = '';
    try {
        // Carga robusta (ítems -> restaurant -> todas)
        pdfCategories.value = await fetchCategoriesForList(r.id, r.restaurant);
    }
    catch {
        pdfCategories.value = [];
    }
}
async function confirmPdf() {
    if (!pdfListId.value)
        return;
    try {
        const qs = new URLSearchParams();
        qs.set("hide_prices", "1");
        if (selectedCategoryId.value !== '') {
            const cid = String(selectedCategoryId.value);
            qs.set("category_id", cid);
            qs.set("category_ids", cid); // CSV con 1 id, por compat
        }
        const path = `/api/purchase-lists/${pdfListId.value}/pdf/?${qs.toString()}`;
        const blob = await apiFetchBlob(path);
        const catSuffix = selectedCategoryId.value ? `-cat-${selectedCategoryId.value}` : "";
        const filename = safeFileName(`${(pdfSeriesCode.value || `lista-${pdfListId.value}`)}-sin-precios${catSuffix}.pdf`);
        downloadBlob(blob, filename);
    }
    catch (e) {
        alert(e?.message || "No se pudo descargar el PDF");
    }
    finally {
        pdfModalOpen.value = false;
    }
}
/* ========== Completar precios (solo listas NO finales) + Observaciones dentro del modal ========== */
const priceModalOpen = ref(false);
const currentListId = ref(null);
const items = ref([]);
const savingPrices = ref(false);
// Observaciones (solo en el modal de precios)
const obsText = ref('');
const obsFieldKey = ref('observation');
async function loadItemsForList(listId) {
    const data = await apiFetch(`/api/purchase-list-items/?purchase_list=${listId}&_=${Date.now()}`, { cache: 'no-store' });
    return (data || []).map((it) => ({
        id: it.id,
        product_id: it.product ?? it.product_id,
        product_name: it.product_name ?? it.product_label ?? '',
        unit_symbol: it.unit_symbol ?? it.unit?.symbol ?? null,
        unit_is_currency: !!(it.unit_is_currency ?? it.unit?.is_currency),
        qty: Number(it.qty ?? 0),
        price_soles: it.price_soles == null ? null : Number(it.price_soles),
        subtotal_soles: it.subtotal_soles == null ? null : Number(it.subtotal_soles),
        quantity: Number(it.qty ?? 0),
        price: it.price_soles == null ? null : Number(it.price_soles),
        subtotal: it.subtotal_soles == null ? 0 : Number(it.subtotal_soles),
    }));
}
async function loadListDetail(listId) {
    try {
        const detail = await apiFetch(`/api/purchase-lists/${listId}/`);
        const key = (('observation' in detail) && 'observation')
            || (('notes' in detail) && 'notes')
            || (('note' in detail) && 'note')
            || 'observation';
        obsFieldKey.value = key;
        obsText.value = detail[key] ?? '';
    }
    catch {
        obsText.value = '';
    }
}
async function openPriceModal(r) {
    currentListId.value = r.id;
    priceModalOpen.value = true;
    items.value = [];
    await Promise.all([
        (async () => {
            items.value = (await loadItemsForList(r.id)).map((it) => ({
                id: it.id,
                product_id: it.product_id ?? it.product,
                product_name: it.product_name ?? it.product_label ?? '',
                unit_symbol: it.unit_symbol ?? it.unit?.symbol ?? null,
                unit_is_currency: !!(it.unit_is_currency ?? it.unit?.is_currency),
                qty: Number(it.qty),
                price_soles: it.price_soles ?? null,
                subtotal_soles: it.subtotal_soles ?? null,
                quantity: Number(it.qty),
                price: it.price_soles ?? null,
                subtotal: it.subtotal_soles ?? null,
            }));
        })(),
        loadListDetail(r.id),
    ]);
}
async function savePrices() {
    if (!currentListId.value)
        return;
    savingPrices.value = true;
    try {
        const listId = currentListId.value;
        // 1) Guardar ítems
        const results = await Promise.allSettled(items.value.map((it) => {
            const price = it.price_soles === "" || it.price_soles === undefined
                ? null
                : Number(it.price_soles);
            const quantity = it.qty === "" || it.qty === undefined ? null : Number(it.qty);
            const body = { price, price_soles: price, quantity, qty: quantity };
            return apiFetch(`/api/purchase-list-items/${it.id}/`, {
                method: "PATCH",
                body,
            });
        }));
        const failed = results.filter(r => r.status === "rejected");
        if (failed.length) {
            console.error("Fallos al guardar ítems:", failed);
            throw new Error("Uno o más ítems no se pudieron guardar.");
        }
        // 2) Observaciones de la lista
        await apiFetch(`/api/purchase-lists/${listId}/`, {
            method: "PATCH",
            body: (obsFieldKey.value === 'observation'
                ? { observation: obsText.value ?? "" }
                : { observation: obsText.value ?? "", [obsFieldKey.value]: obsText.value ?? "" }),
        });
        // 3) Recargar ítems desde el backend
        const fresh = await apiFetch(`/api/purchase-list-items/?purchase_list=${listId}`);
        items.value = (fresh || []).map((it) => ({
            id: it.id,
            product_id: it.product ?? it.product_id,
            product_name: it.product_name ?? "",
            unit_symbol: it.unit_symbol ?? it.unit?.symbol ?? null,
            qty: Number(it.qty ?? 0),
            price_soles: it.price_soles == null ? null : Number(it.price_soles),
            subtotal_soles: it.subtotal_soles == null ? null : Number(it.subtotal_soles),
            quantity: Number(it.qty ?? 0),
            price: it.price_soles == null ? null : Number(it.price_soles),
            subtotal: Number(it.subtotal_soles ?? 0),
        }));
        // 4) Cerrar modal y refrescar la grilla
        priceModalOpen.value = false;
        await load();
    }
    catch (e) {
        console.error(e);
        alert(e?.message || "No se pudieron guardar los cambios");
    }
    finally {
        savingPrices.value = false;
    }
}
onMounted(load);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-xl font-semibold mb-4" },
});
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
}
else if (__VLS_ctx.err) {
    // @ts-ignore
    [err,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-red-600" },
    });
    (__VLS_ctx.err);
    // @ts-ignore
    [err,];
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({
        ...{ class: "w-full border-collapse" },
    });
    __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
    __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
        ...{ class: "text-left" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "border-b p-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "border-b p-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "border-b p-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "border-b p-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "border-b p-2 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
    for (const [r] of __VLS_getVForSourceType((__VLS_ctx.rows))) {
        // @ts-ignore
        [rows,];
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
            key: (r.id),
            ...{ class: "border-b" },
        });
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2" },
        });
        (r.series_code || '(sin serie)');
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2" },
        });
        (r.status);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2" },
        });
        (__VLS_ctx.fmtShort(r.created_at));
        // @ts-ignore
        [fmtShort,];
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2" },
        });
        (__VLS_ctx.fmtShort(r.finalized_at));
        // @ts-ignore
        [fmtShort,];
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 text-center space-x-3" },
        });
        if (__VLS_ctx.isFinal(r)) {
            // @ts-ignore
            [isFinal,];
            __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.err))
                            return;
                        if (!(__VLS_ctx.isFinal(r)))
                            return;
                        __VLS_ctx.downloadPdf(r);
                        // @ts-ignore
                        [downloadPdf,];
                    } },
                ...{ class: "text-blue-600 cursor-pointer" },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.err))
                            return;
                        if (!!(__VLS_ctx.isFinal(r)))
                            return;
                        __VLS_ctx.openPriceModal(r);
                        // @ts-ignore
                        [openPriceModal,];
                    } },
                ...{ class: "text-emerald-600 cursor-pointer" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "mx-1" },
            });
            __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.err))
                            return;
                        if (!!(__VLS_ctx.isFinal(r)))
                            return;
                        __VLS_ctx.openPdfModal(r);
                        // @ts-ignore
                        [openPdfModal,];
                    } },
                ...{ class: "text-indigo-600 cursor-pointer" },
            });
        }
    }
}
if (__VLS_ctx.priceModalOpen) {
    // @ts-ignore
    [priceModalOpen,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 bg-black/30 flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-white rounded-2xl p-5 w-[900px] max-h-[85vh] overflow-auto shadow" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({
        ...{ class: "w-full border mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
    __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
        ...{ class: "bg-gray-100" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-left" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
    for (const [it] of __VLS_getVForSourceType((__VLS_ctx.items))) {
        // @ts-ignore
        [items,];
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
            key: (it.id),
        });
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (it.product_name);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-center" },
        });
        (it.unit_symbol || '-');
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-right" },
        });
        if (it.unit_is_currency) {
            __VLS_asFunctionalElement(__VLS_elements.input)({
                type: "number",
                step: "0.01",
                ...{ class: "border rounded p-1 w-28 text-right" },
            });
            (it.qty);
        }
        else {
            (it.qty);
        }
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-right" },
        });
        if (!it.unit_is_currency) {
            __VLS_asFunctionalElement(__VLS_elements.input)({
                type: "number",
                step: "0.01",
                ...{ class: "border rounded p-1 w-28 text-right" },
            });
            (it.price_soles);
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "text-gray-400" },
            });
        }
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-right" },
        });
        ((it.subtotal_soles
            ?? (it.unit_is_currency
                ? Number(it.qty ?? 0)
                : Number(it.price_soles ?? 0) * Number(it.qty ?? 0))).toFixed(2));
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block font-medium mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.textarea, __VLS_elements.textarea)({
        value: (__VLS_ctx.obsText),
        rows: "5",
        ...{ class: "w-full border rounded p-2" },
        placeholder: "Escribe aquí las observaciones de la lista...",
    });
    // @ts-ignore
    [obsText,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.priceModalOpen))
                    return;
                __VLS_ctx.priceModalOpen = false;
                // @ts-ignore
                [priceModalOpen,];
            } },
        ...{ class: "px-3 py-2 border rounded" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.savePrices) },
        ...{ class: "px-3 py-2 rounded text-white" },
        ...{ class: (__VLS_ctx.savingPrices ? 'bg-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700') },
        disabled: (__VLS_ctx.savingPrices),
    });
    // @ts-ignore
    [savePrices, savingPrices, savingPrices,];
    (__VLS_ctx.savingPrices ? 'Guardando…' : 'Guardar');
    // @ts-ignore
    [savingPrices,];
}
if (__VLS_ctx.pdfModalOpen) {
    // @ts-ignore
    [pdfModalOpen,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 bg-black/40 flex items-center justify-center z-50" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-white rounded-xl shadow-xl w-full max-w-lg p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "text-lg font-semibold" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.pdfModalOpen))
                    return;
                __VLS_ctx.pdfModalOpen = false;
                // @ts-ignore
                [pdfModalOpen,];
            } },
        ...{ class: "text-gray-500" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-xs text-gray-500 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
        value: (__VLS_ctx.selectedCategoryId),
        ...{ class: "border rounded px-2 py-2 w-full text-sm" },
    });
    // @ts-ignore
    [selectedCategoryId,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "",
    });
    for (const [c] of __VLS_getVForSourceType((__VLS_ctx.pdfCategories))) {
        // @ts-ignore
        [pdfCategories,];
        __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
            key: (c.id),
            value: (c.id),
        });
        (c.name);
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-6 flex justify-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.pdfModalOpen))
                    return;
                __VLS_ctx.pdfModalOpen = false;
                // @ts-ignore
                [pdfModalOpen,];
            } },
        ...{ class: "px-3 py-2 border rounded" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.confirmPdf) },
        ...{ class: "px-3 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700" },
    });
    // @ts-ignore
    [confirmPdf,];
}
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['text-emerald-600']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[900px]']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[85vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-28']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-28']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/40']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-700']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        fmtShort: fmtShort,
        rows: rows,
        loading: loading,
        err: err,
        isFinal: isFinal,
        downloadPdf: downloadPdf,
        pdfModalOpen: pdfModalOpen,
        pdfCategories: pdfCategories,
        selectedCategoryId: selectedCategoryId,
        openPdfModal: openPdfModal,
        confirmPdf: confirmPdf,
        priceModalOpen: priceModalOpen,
        items: items,
        savingPrices: savingPrices,
        obsText: obsText,
        openPriceModal: openPriceModal,
        savePrices: savePrices,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
