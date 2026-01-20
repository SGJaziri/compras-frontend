import { ref, onMounted, watch } from "vue"; // ⟵ añadido watch
import { apiFetch } from "@/services/http";
const units = ref([]);
const name = ref("");
const kind = ref("other");
const symbol = ref("");
const isCurr = ref(false);
const loading = ref(false);
const error = ref(null);
// ——— NUEVO: símbolo por defecto cuando es moneda ———
const DEFAULT_CURRENCY_SYMBOL = "S/";
// ——— NUEVO: si seleccionan "Moneda", marcar checkbox y sugerir símbolo ———
watch(kind, (val) => {
    if (val === "currency") {
        isCurr.value = true;
        if (!symbol.value.trim())
            symbol.value = DEFAULT_CURRENCY_SYMBOL;
    }
});
async function load() {
    loading.value = true;
    error.value = null;
    try {
        units.value = await apiFetch("/api/units/");
    }
    catch (e) {
        error.value = e?.message || "No se pudo cargar";
    }
    finally {
        loading.value = false;
    }
}
async function onCreate() {
    if (!name.value.trim())
        return;
    try {
        await apiFetch("/api/units/", {
            method: "POST",
            body: {
                name: name.value.trim(),
                kind: kind.value,
                symbol: symbol.value || null,
                is_currency: isCurr.value,
            },
        });
        // reset a estado inicial
        name.value = "";
        symbol.value = "";
        isCurr.value = false;
        kind.value = "other";
        await load();
    }
    catch (e) {
        alert(e?.message || "No se pudo crear");
    }
}
async function onDelete(id) {
    if (!confirm("¿Eliminar unidad?"))
        return;
    try {
        await apiFetch(`/api/units/${id}/`, { method: "DELETE" });
        await load();
    }
    catch (e) {
        const msg = e?.detail || e?.message || "No se pudo eliminar";
        alert(msg);
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
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid gap-3 md:grid-cols-5 items-end mb-6" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    ...{ class: "border rounded p-2 w-full" },
    placeholder: "Nombre",
});
(__VLS_ctx.name);
// @ts-ignore
[name,];
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    ...{ class: "border rounded p-2 w-full" },
    value: (__VLS_ctx.kind),
});
// @ts-ignore
[kind,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "mass",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "count",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "currency",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "package",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "other",
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    ...{ class: "border rounded p-2 w-full" },
    placeholder: "Símbolo (kg, S/, etc.)",
});
(__VLS_ctx.symbol);
// @ts-ignore
[symbol,];
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "inline-flex items-center gap-2" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "checkbox",
});
(__VLS_ctx.isCurr);
// @ts-ignore
[isCurr,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.onCreate) },
    ...{ class: "bg-emerald-600 text-white px-4 py-2 rounded" },
});
// @ts-ignore
[onCreate,];
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-gray-600" },
    });
}
else if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-red-600" },
    });
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
}
else {
    __VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({
        ...{ class: "w-full bg-white border" },
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
        ...{ class: "p-2 border text-left" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
    for (const [u] of __VLS_getVForSourceType((__VLS_ctx.units))) {
        // @ts-ignore
        [units,];
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
            key: (u.id),
        });
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (u.name);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (u.kind);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (u.symbol || '-');
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-center" },
        });
        (u.is_currency ? 'Sí' : 'No');
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-center" },
        });
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.onDelete(u.id);
                    // @ts-ignore
                    [onDelete,];
                } },
            ...{ class: "text-red-600" },
        });
    }
}
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-5']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        units: units,
        name: name,
        kind: kind,
        symbol: symbol,
        isCurr: isCurr,
        loading: loading,
        error: error,
        onCreate: onCreate,
        onDelete: onDelete,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
