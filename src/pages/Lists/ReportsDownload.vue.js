import { ref, computed, onMounted } from "vue";
import { apiFetch, absoluteApiUrl, apiFetchBlob } from "@/services/http";
import { downloadBlob } from "@/services/download";
// ====== filtros ======
const start = ref("");
const end = ref("");
const onlyFinal = ref(true);
// ====== vista ======
const activeView = ref("detail");
// ====== datos ======
const loading = ref(false);
const error = ref(null);
const rawData = ref([]);
// ====== aplanado desde restaurants -> categories -> lines ======
function extractItems(json) {
    if (Array.isArray(json))
        return json.map(safeMapFlat).filter(Boolean);
    if (json && Array.isArray(json.items))
        return json.items.map(safeMapFlat).filter(Boolean);
    if (json && Array.isArray(json.results))
        return json.results.map(safeMapFlat).filter(Boolean);
    if (json && Array.isArray(json.data))
        return json.data.map(safeMapFlat).filter(Boolean);
    if (json && Array.isArray(json.restaurants)) {
        const out = [];
        for (const r of json.restaurants) {
            const rName = String(r?.restaurant ?? r?.restaurant_name ?? "—");
            const rId = r?.id ?? r?.restaurant_id ?? null;
            const cats = Array.isArray(r?.categories) ? r.categories : [];
            for (const c of cats) {
                const cName = String(c?.category ?? c?.category_name ?? "—");
                const cId = c?.id ?? c?.category_id ?? null;
                const lines = Array.isArray(c?.lines) ? c.lines : [];
                for (const it of lines) {
                    out.push(mapLine(it, rId, rName, cId, cName));
                }
            }
        }
        return out;
    }
    if (json && json.detail)
        return extractItems(json.detail);
    if (json && json.summary)
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
        restaurant_id,
        restaurant_name,
        category_id,
        category_name,
        product_id,
        product_name,
        unit_symbol: unit_symbol == null ? null : String(unit_symbol),
        qty,
        price_soles: price_soles == null ? null : Number(price_soles),
        subtotal_soles,
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
        date,
        restaurant_id: rId,
        restaurant_name: rName,
        category_id: cId,
        category_name: cName,
        product_id,
        product_name,
        unit_symbol: unit_symbol == null ? null : String(unit_symbol),
        qty,
        price_soles: price_soles == null ? null : Number(price_soles),
        subtotal_soles,
    };
}
const items = computed(() => extractItems(rawData.value));
// ====== helpers fechas ======
function toISO(d) { return d.toISOString().slice(0, 10); }
function setWeek() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    start.value = toISO(monday);
    end.value = toISO(sunday);
}
function setMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start.value = toISO(first);
    end.value = toISO(last);
}
// ====== fetch ======
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
function groupBy(key, rows) {
    return rows.reduce((acc, r) => {
        const k = String(r[key] ?? "");
        (acc[k] ||= []).push(r);
        return acc;
    }, {});
}
const summaryByRestaurant = computed(() => {
    const out = {};
    for (const it of items.value) {
        const rName = it.restaurant_name;
        const cName = it.category_name;
        const sub = Number(it.subtotal_soles ?? 0);
        if (!out[rName])
            out[rName] = { total: 0, categories: {} };
        out[rName].total += sub;
        out[rName].categories[cName] = (out[rName].categories[cName] ?? 0) + sub;
    }
    return out;
});
const generalTotal = computed(() => items.value.reduce((s, it) => s + Number(it.subtotal_soles ?? 0), 0));
// ====== PDF ======  (con auth → blob y descarga directa)
const pdfBase = `/api/purchase-lists/export/range/pdf/`; // ← única declaración
function buildPdfUrl(mode) {
    const qs = new URLSearchParams({
        start: start.value,
        end: end.value,
        only_final: onlyFinal.value ? "true" : "false",
        mode,
    });
    return absoluteApiUrl(`${pdfBase}?${qs.toString()}`);
}
async function openPDF() {
    const mode = activeView.value === "summary" ? "summary" : "detail";
    const url = buildPdfUrl(mode);
    try {
        const blob = await apiFetchBlob(url); // manda Authorization
        const filename = `reporte_${mode}_${start.value}_a_${end.value}.pdf`;
        downloadBlob(blob, filename); // ↓ descarga directa
    }
    catch (e) {
        error.value = e?.message || "No se pudo generar el PDF";
    }
}
// ====== init ======
onMounted(() => {
    setMonth();
    fetchData();
});
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
    ...{ class: "flex flex-wrap items-end gap-3 mb-4" },
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
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "inline-flex items-center gap-2 ml-2" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "checkbox",
});
(__VLS_ctx.onlyFinal);
// @ts-ignore
[onlyFinal,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.fetchData) },
    ...{ class: "ml-auto px-4 py-2 rounded bg-gray-100 hover:bg-gray-200" },
    disabled: (__VLS_ctx.loading),
});
// @ts-ignore
[fetchData, loading,];
(__VLS_ctx.loading ? "Cargando..." : "Ver " + (__VLS_ctx.activeView === 'summary' ? 'reporte' : 'reporte'));
// @ts-ignore
[loading, activeView,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex gap-2 mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeView = 'summary';
            // @ts-ignore
            [activeView,];
        } },
    ...{ class: "px-3 py-1 rounded border" },
    ...{ class: (__VLS_ctx.activeView === 'summary' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white') },
});
// @ts-ignore
[activeView,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeView = 'detail';
            // @ts-ignore
            [activeView,];
        } },
    ...{ class: "px-3 py-1 rounded border" },
    ...{ class: (__VLS_ctx.activeView === 'detail' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white') },
});
// @ts-ignore
[activeView,];
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
if (__VLS_ctx.activeView === 'summary') {
    // @ts-ignore
    [activeView,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    if (__VLS_ctx.loading) {
        // @ts-ignore
        [loading,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    }
    else {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex flex-col gap-4" },
        });
        for (const [obj, restName] of __VLS_getVForSourceType((__VLS_ctx.summaryByRestaurant))) {
            // @ts-ignore
            [summaryByRestaurant,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                key: (String(restName)),
                ...{ class: "rounded border p-4 bg-white" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "flex items-start justify-between mb-2 text-gray-900" },
            });
            __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
                ...{ class: "font-semibold text-lg" },
            });
            (restName);
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-right" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-xs text-gray-500" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-2xl font-extrabold" },
            });
            (obj.total.toFixed(2));
            __VLS_asFunctionalElement(__VLS_elements.ul, __VLS_elements.ul)({
                ...{ class: "list-disc pl-5" },
            });
            for (const [subtotal, catName] of __VLS_getVForSourceType((obj.categories))) {
                __VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({
                    key: (String(catName)),
                    ...{ class: "text-gray-900" },
                });
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    ...{ class: "font-medium" },
                });
                (catName);
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    ...{ class: "text-gray-500" },
                });
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    ...{ class: "font-semibold" },
                });
                (subtotal.toFixed(2));
            }
        }
        if (Object.keys(__VLS_ctx.summaryByRestaurant).length === 0) {
            // @ts-ignore
            [summaryByRestaurant,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-sm text-gray-500" },
            });
        }
    }
}
else {
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
        for (const [rowsByRestaurant, rKey] of __VLS_getVForSourceType((__VLS_ctx.groupBy('restaurant_name', __VLS_ctx.items)))) {
            // @ts-ignore
            [groupBy, items,];
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
        if (__VLS_ctx.items.length === 0) {
            // @ts-ignore
            [items,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-sm text-gray-500" },
            });
        }
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
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
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-extrabold']} */ ;
/** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
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
        start: start,
        end: end,
        onlyFinal: onlyFinal,
        activeView: activeView,
        loading: loading,
        error: error,
        items: items,
        setWeek: setWeek,
        setMonth: setMonth,
        fetchData: fetchData,
        groupBy: groupBy,
        summaryByRestaurant: summaryByRestaurant,
        generalTotal: generalTotal,
        openPDF: openPDF,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
