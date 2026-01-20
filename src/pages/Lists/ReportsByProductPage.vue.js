import { ref, computed, onMounted } from "vue";
import { apiFetch, absoluteApiUrl, apiFetchBlob } from "@/services/http";
import MultiCheckDropdown from "@/components/MultiCheckDropdown.vue";
import { downloadBlob } from "@/services/download";
import { appendMulti } from "@/services/pdfFilters";
/* filtros base */
const start = ref("");
const end = ref("");
const onlyFinal = ref(true);
const selectedProductIds = ref([]);
/* estado/datos */
const loading = ref(false);
const error = ref(null);
const rawData = ref([]);
/* aplanado (igual al base) */
function extractItems(json) {
    if (Array.isArray(json))
        return json.map(safeMapFlat).filter(Boolean);
    if (json?.items)
        return json.items.map(safeMapFlat).filter(Boolean);
    if (json?.results)
        return json.results.map(safeMapFlat).filter(Boolean);
    if (json?.data)
        return json.data.map(safeMapFlat).filter(Boolean);
    if (json?.restaurants) {
        const out = [];
        for (const r of json.restaurants) {
            const rName = String(r?.restaurant ?? r?.restaurant_name ?? "—");
            const rId = r?.id ?? r?.restaurant_id ?? null;
            const cats = Array.isArray(r?.categories) ? r.categories : [];
            for (const c of cats) {
                const cName = String(c?.category ?? c?.category_name ?? "—");
                const cId = c?.id ?? c?.category_id ?? null;
                const lines = Array.isArray(c?.lines) ? c.lines : [];
                for (const it of lines)
                    out.push(mapLine(it, rId, rName, cId, cName));
            }
        }
        return out;
    }
    if (json?.detail)
        return extractItems(json.detail);
    if (json?.summary)
        return extractItems(json.summary);
    return [];
}
function safeMapFlat(x) {
    if (!x || typeof x !== "object")
        return null;
    const date = String(x.created_at ?? x.date ?? x.day ?? "");
    const restaurant_id = x.restaurant_id ?? x.rid ?? null;
    const restaurant_name = String(x.restaurant_name ?? x.restaurant ?? x.rname ?? "—");
    const category_id = x.category_id ?? x.cid ?? null;
    const category_name = String(x.category_name ?? x.category ?? x.cname ?? "—");
    const product_id = x.product_id ?? x.pid ?? null;
    const product_name = String(x.product_name ?? x.product ?? x.pname ?? "—");
    const unit_symbol = x.unit_symbol ?? x.unit ?? x.usym ?? null;
    const qty = Number(x.qty ?? x.quantity ?? 0);
    const price_soles = x.price_soles == null ? (x.price ?? null) : Number(x.price_soles);
    const subtotal_raw = x.subtotal_soles ?? x.subtotal ?? (qty * (price_soles ?? 0));
    const subtotal_soles = Number(subtotal_raw ?? 0);
    return {
        date,
        restaurant_id, restaurant_name, category_id, category_name,
        product_id, product_name, unit_symbol: unit_symbol == null ? null : String(unit_symbol),
        qty, price_soles: price_soles == null ? null : Number(price_soles), subtotal_soles,
    };
}
function mapLine(it, rId, rName, cId, cName) {
    const date = String(it?.created_at ?? it?.date ?? it?.day ?? "");
    const product_id = it?.product_id ?? it?.pid ?? null;
    const product_name = String(it?.product ?? it?.product_name ?? it?.pname ?? "—");
    const unit_symbol = it?.unit ?? it?.unit_symbol ?? it?.usym ?? null;
    const qty = Number(it?.qty ?? it?.quantity ?? 0);
    const price_soles = it?.price == null ? (it?.price_soles ?? null) : Number(it?.price);
    const subtotal_raw = it?.subtotal ?? it?.subtotal_soles ?? (qty * (price_soles ?? 0));
    const subtotal_soles = Number(subtotal_raw ?? 0);
    return {
        date, restaurant_id: rId, restaurant_name: rName, category_id: cId, category_name: cName,
        product_id, product_name, unit_symbol: unit_symbol == null ? null : String(unit_symbol),
        qty, price_soles: price_soles == null ? null : Number(price_soles), subtotal_soles
    };
}
const items = computed(() => extractItems(rawData.value));
/* fechas */
function toISO(d) { return d.toISOString().slice(0, 10); }
function setWeek() { const n = new Date(); const day = n.getDay() || 7; const m = new Date(n); m.setDate(n.getDate() - (day - 1)); const s = new Date(m); s.setDate(m.getDate() + 6); start.value = toISO(m); end.value = toISO(s); }
function setMonth() { const n = new Date(); start.value = toISO(new Date(n.getFullYear(), n.getMonth(), 1)); end.value = toISO(new Date(n.getFullYear(), n.getMonth() + 1, 0)); }
/* fetch */
async function fetchData() {
    loading.value = true;
    error.value = null;
    try {
        const url = `/api/purchase-lists/export/range/?start=${start.value}&end=${end.value}&only_final=${onlyFinal.value ? "true" : "false"}`;
        rawData.value = await apiFetch(url);
    }
    catch (e) {
        error.value = e?.message ?? "Error al cargar reportes";
        rawData.value = [];
    }
    finally {
        loading.value = false;
    }
}
/* opciones productos (respaldo por nombre si falta id) */
const productOptions = computed(() => {
    const m = new Map(); // key estable
    for (const it of items.value) {
        const key = (it.product_id ?? it.product_name ?? "—").toString();
        const name = it.product_name || "—";
        if (!m.has(key))
            m.set(key, name);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
});
/* filtrado múltiple */
const filteredItems = computed(() => {
    if (selectedProductIds.value.length === 0)
        return items.value;
    const set = new Set(selectedProductIds.value.map(String));
    return items.value.filter(r => set.has(String(r.product_id ?? r.product_name)));
});
function groupBy(key, rows) {
    return rows.reduce((acc, r) => { const k = String(r[key] ?? ""); (acc[k] ||= []).push(r); return acc; }, {});
}
const generalTotal = computed(() => filteredItems.value.reduce((s, it) => s + Number(it.subtotal_soles ?? 0), 0));
/* badges extra (resumen del/los productos seleccionados) */
const showBadges = computed(() => selectedProductIds.value.length > 0);
const totalQtySel = computed(() => showBadges.value ? filteredItems.value.reduce((s, it) => s + Number(it.qty ?? 0), 0) : 0);
const unitSummary = computed(() => {
    if (!showBadges.value)
        return "";
    const set = new Set(filteredItems.value.map(i => i.unit_symbol || ""));
    if (set.size <= 1)
        return [...set][0] || "";
    return [...set][0] + " (+)";
});
const unitPriceHomogeneous = computed(() => {
    if (!showBadges.value)
        return null;
    const vals = [...new Set(filteredItems.value.map(i => i.price_soles == null ? NaN : Number(i.price_soles.toFixed(2))))].filter(v => !Number.isNaN(v));
    return vals.length > 0 && new Set(vals).size === 1 ? vals[0] : null;
});
// ===== PDF (GET con filtros) =====
const pdfBase = `/api/purchase-lists/export/range/pdf/`;
function buildPdfUrlWithFilters() {
    const qs = new URLSearchParams({
        start: start.value,
        end: end.value,
        only_final: onlyFinal.value ? "true" : "false",
        mode: "detail",
    });
    const selected = selectedProductIds.value.map(v => String(v));
    if (selected.length) {
        const idToName = new Map(productOptions.value.map(o => [String(o.id), o.name]));
        const ids = selected.filter(s => /^\d+$/.test(s));
        const names = selected.map(s => idToName.get(s) ?? s);
        // IDs
        appendMulti(qs, "product_ids", "product_id", ids);
        appendMulti(qs, "products", "product_ids[]", ids); // compat extra
        // Nombres
        appendMulti(qs, "product_names", "product", names);
        appendMulti(qs, "products_names", "product[]", names); // compat extra
    }
    return absoluteApiUrl(`${pdfBase}?${qs.toString()}`);
}
async function openPDF() {
    try {
        const url = buildPdfUrlWithFilters();
        const blob = await apiFetchBlob(url); // SOLO GET
        const filename = `reporte_productos_${start.value}_a_${end.value}` +
            (selectedProductIds.value.length ? `_filtrado` : ``) + `.pdf`;
        downloadBlob(blob, filename);
    }
    catch (e) {
        error.value = e?.message || "No se pudo generar el PDF";
    }
}
/* init */
onMounted(() => { setMonth(); fetchData(); });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-2xl font-semibold mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-col gap-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex gap-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "block text-sm mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "date",
    ...{ class: "border rounded px-3 py-2" },
});
(__VLS_ctx.start);
// @ts-ignore
[start,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "block text-sm mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "date",
    ...{ class: "border rounded px-3 py-2" },
});
(__VLS_ctx.end);
// @ts-ignore
[end,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex gap-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.setWeek) },
    ...{ class: "px-3 py-2 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
});
// @ts-ignore
[setWeek,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.setMonth) },
    ...{ class: "px-3 py-2 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
});
// @ts-ignore
[setMonth,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-wrap items-end gap-3" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "inline-flex items-center gap-2" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "checkbox",
});
(__VLS_ctx.onlyFinal);
// @ts-ignore
[onlyFinal,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grow min-w-[300px]" },
});
/** @type {[typeof MultiCheckDropdown, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(MultiCheckDropdown, new MultiCheckDropdown({
    label: "Productos (puedes elegir varios)",
    options: (__VLS_ctx.productOptions),
    modelValue: (__VLS_ctx.selectedProductIds),
    widthClass: "w-full",
}));
const __VLS_1 = __VLS_0({
    label: "Productos (puedes elegir varios)",
    options: (__VLS_ctx.productOptions),
    modelValue: (__VLS_ctx.selectedProductIds),
    widthClass: "w-full",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
// @ts-ignore
[productOptions, selectedProductIds,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.fetchData) },
    ...{ class: "ml-auto px-4 py-2 rounded bg-gray-100 hover:bg-gray-200" },
    disabled: (__VLS_ctx.loading),
});
// @ts-ignore
[fetchData, loading,];
(__VLS_ctx.loading ? "Cargando..." : "Ver reporte");
// @ts-ignore
[loading,];
if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-red-600 mb-3" },
    });
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
}
if (__VLS_ctx.showBadges) {
    // @ts-ignore
    [showBadges,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mb-3 flex flex-wrap gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "px-3 py-1 rounded-full border bg-indigo-50 border-indigo-200 font-semibold" },
    });
    (__VLS_ctx.totalQtySel);
    (__VLS_ctx.unitSummary);
    // @ts-ignore
    [totalQtySel, unitSummary,];
    if (__VLS_ctx.unitPriceHomogeneous !== null) {
        // @ts-ignore
        [unitPriceHomogeneous,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "px-3 py-1 rounded-full border bg-green-50 border-green-200 font-semibold" },
        });
        (__VLS_ctx.unitPriceHomogeneous.toFixed(2));
        // @ts-ignore
        [unitPriceHomogeneous,];
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex flex-col gap-6" },
    });
    for (const [rowsByRestaurant, rKey] of __VLS_getVForSourceType((__VLS_ctx.groupBy('restaurant_name', __VLS_ctx.filteredItems)))) {
        // @ts-ignore
        [groupBy, filteredItems,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (String(rKey)),
            ...{ class: "rounded border bg-white" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "p-4 border-b text-gray-900" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
            ...{ class: "font-semibold text-lg" },
        });
        (rKey);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "p-4 flex flex-col gap-6" },
        });
        for (const [rowsByCategory, cKey] of __VLS_getVForSourceType((__VLS_ctx.groupBy('category_name', rowsByRestaurant)))) {
            // @ts-ignore
            [groupBy,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                key: (String(cKey)),
            });
            __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
                ...{ class: "font-medium mb-2 text-gray-900" },
            });
            (cKey);
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "overflow-x-auto" },
            });
            __VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({
                ...{ class: "min-w-full border" },
            });
            __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
            __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
                ...{ class: "bg-gray-50" },
            });
            __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
                ...{ class: "border px-3 py-2 text-left" },
            });
            __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
                ...{ class: "border px-3 py-2 text-left" },
            });
            __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
                ...{ class: "border px-3 py-2 text-left" },
            });
            __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
                ...{ class: "border px-3 py-2 text-right" },
            });
            __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
                ...{ class: "border px-3 py-2 text-right" },
            });
            __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
                ...{ class: "border px-3 py-2 text-right" },
            });
            __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
            for (const [row] of __VLS_getVForSourceType((rowsByCategory))) {
                __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
                    key: (row.date + '-' + (row.product_id ?? row.product_name)),
                });
                __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                    ...{ class: "border px-3 py-2" },
                });
                (row.date);
                __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                    ...{ class: "border px-3 py-2" },
                });
                (row.product_name);
                __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                    ...{ class: "border px-3 py-2" },
                });
                (row.unit_symbol || '');
                __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                    ...{ class: "border px-3 py-2 text-right" },
                });
                (row.qty);
                __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                    ...{ class: "border px-3 py-2 text-right" },
                });
                (row.price_soles ?? '-');
                __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                    ...{ class: "border px-3 py-2 text-right" },
                });
                (Number(row.subtotal_soles ?? 0).toFixed(2));
            }
            __VLS_asFunctionalElement(__VLS_elements.tfoot, __VLS_elements.tfoot)({});
            __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
                ...{ class: "text-gray-900" },
            });
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                ...{ class: "border px-3 py-2 text-right font-semibold" },
                colspan: "5",
            });
            __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
                ...{ class: "border px-3 py-2 text-right font-semibold" },
            });
            (rowsByCategory.reduce((s, r) => s + Number(r.subtotal_soles ?? 0), 0).toFixed(2));
        }
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-right font-semibold text-gray-900" },
        });
        (rowsByRestaurant.reduce((s, r) => s + Number(r.subtotal_soles ?? 0), 0).toFixed(2));
    }
    if (__VLS_ctx.filteredItems.length === 0) {
        // @ts-ignore
        [filteredItems,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm text-gray-500" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-4 mb-2 rounded border bg-white p-4 flex items-center justify-end text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-xs text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-3xl font-extrabold" },
});
(__VLS_ctx.generalTotal.toFixed(2));
// @ts-ignore
[generalTotal,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.openPDF) },
    ...{ class: "px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" },
});
// @ts-ignore
[openPDF,];
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[300px]']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-200']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-green-200']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-extrabold']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        MultiCheckDropdown: MultiCheckDropdown,
        start: start,
        end: end,
        onlyFinal: onlyFinal,
        selectedProductIds: selectedProductIds,
        loading: loading,
        error: error,
        setWeek: setWeek,
        setMonth: setMonth,
        fetchData: fetchData,
        productOptions: productOptions,
        filteredItems: filteredItems,
        groupBy: groupBy,
        generalTotal: generalTotal,
        showBadges: showBadges,
        totalQtySel: totalQtySel,
        unitSummary: unitSummary,
        unitPriceHomogeneous: unitPriceHomogeneous,
        openPDF: openPDF,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
