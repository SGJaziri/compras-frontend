import { ref, computed, onMounted } from "vue";
import { apiFetch } from "@/services/http";
const loading = ref(false);
const error = ref(null);
const products = ref([]);
const categories = ref([]);
const units = ref([]);
/* ===== Filtros ===== */
const qName = ref("");
const categoryFilter = ref("all");
const letterFilter = ref("all");
/* ===== Edición (cambiar unidad) ===== */
const editOpen = ref(false);
const editRow = ref(null);
const editUnit = ref(null);
/* ===== Alta rápida (form superior) ===== */
const newName = ref("");
const newCategory = ref(null);
const newUnit = ref(null);
const newRefPrice = ref(null);
const canCreate = computed(() => !!newName.value.trim() && !!newCategory.value);
const catNameById = computed(() => new Map(categories.value.map((c) => [c.id, c.name])));
const unitNameById = computed(() => new Map(units.value.map((u) => [u.id, u.name])));
async function loadAll() {
    loading.value = true;
    error.value = null;
    try {
        const [p, c, u] = await Promise.all([
            apiFetch("/api/products/"),
            apiFetch("/api/categories/"),
            apiFetch("/api/units/"),
        ]);
        categories.value = c;
        units.value = u;
        const catMap = catNameById.value;
        const unitMap = unitNameById.value;
        products.value = p.map((it) => ({
            ...it,
            category_name: it.category_name ?? catMap.get(it.category) ?? "-",
            default_unit_name: it.default_unit_name ?? (it.default_unit ? unitMap.get(it.default_unit) : null),
        }));
    }
    catch (e) {
        error.value = e?.message || "No se pudo cargar";
    }
    finally {
        loading.value = false;
    }
}
const letters = computed(() => {
    const set = new Set();
    products.value.forEach(p => {
        const L = (p.name?.[0] || "").toUpperCase();
        if (L)
            set.add(L);
    });
    return Array.from(set).sort();
});
const filtered = computed(() => {
    let list = products.value;
    if (categoryFilter.value !== "all") {
        list = list.filter(p => p.category === categoryFilter.value);
    }
    if (letterFilter.value !== "all") {
        list = list.filter(p => (p.name?.[0] || "").toUpperCase() === letterFilter.value);
    }
    if (qName.value.trim()) {
        const t = qName.value.trim().toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(t));
    }
    return list;
});
function openEdit(row) {
    editRow.value = row;
    editUnit.value = row.default_unit;
    editOpen.value = true;
}
async function saveEdit() {
    if (!editRow.value)
        return;
    try {
        const updated = await apiFetch(`/api/products/${editRow.value.id}/`, {
            method: "PATCH",
            body: { default_unit: editUnit.value },
        });
        const idx = products.value.findIndex(p => p.id === editRow.value.id);
        const unitName = unitNameById.value.get(updated?.default_unit ?? editUnit.value);
        if (idx >= 0) {
            products.value[idx] = {
                ...products.value[idx],
                default_unit: updated?.default_unit ?? editUnit.value,
                default_unit_name: unitName ?? null,
            };
        }
        editOpen.value = false;
    }
    catch (e) {
        alert(e?.message || "No se pudo actualizar");
    }
}
async function onCreate() {
    if (!canCreate.value)
        return;
    try {
        const payload = {
            name: newName.value.trim(),
            category: newCategory.value,
            default_unit: newUnit.value ?? null,
            ref_price: newRefPrice.value ?? null,
        };
        const created = await apiFetch("/api/products/", {
            method: "POST",
            body: payload,
        });
        const item = {
            ...created,
            category_name: catNameById.value.get(created.category) ?? "-",
            default_unit_name: created.default_unit ? unitNameById.value.get(created.default_unit) ?? null : null,
        };
        products.value.unshift(item);
        newName.value = "";
        newCategory.value = null;
        newUnit.value = null;
        newRefPrice.value = null;
    }
    catch (e) {
        alert(e?.message || "No se pudo crear el producto");
    }
}
async function onDelete(row) {
    if (!confirm(`¿Eliminar "${row.name}"?`))
        return;
    try {
        await apiFetch(`/api/products/${row.id}/`, { method: "DELETE" });
        products.value = products.value.filter(p => p.id !== row.id);
    }
    catch (e) {
        const msg = e?.detail || e?.message || "No se pudo eliminar";
        alert(msg);
    }
}
onMounted(loadAll);
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
    ...{ class: "mb-5 rounded-xl p-4 ring-1 ring-emerald-200 bg-emerald-50/70" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "font-medium mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid gap-3 md:grid-cols-5 items-end" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    ...{ class: "border rounded p-2 w-full" },
    placeholder: "Nombre",
});
(__VLS_ctx.newName);
// @ts-ignore
[newName,];
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.newCategory),
    ...{ class: "border rounded p-2 w-full" },
});
// @ts-ignore
[newCategory,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: (null),
});
for (const [c] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
    // @ts-ignore
    [categories,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (c.id),
        value: (c.id),
    });
    (c.name);
}
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.newUnit),
    ...{ class: "border rounded p-2 w-full" },
});
// @ts-ignore
[newUnit,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: (null),
});
for (const [u] of __VLS_getVForSourceType((__VLS_ctx.units))) {
    // @ts-ignore
    [units,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (u.id),
        value: (u.id),
    });
    (u.name);
    if (u.symbol) {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (u.symbol);
    }
}
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "number",
    step: "0.01",
    ...{ class: "border rounded p-2 w-full" },
    placeholder: "Precio ref. (opcional)",
});
(__VLS_ctx.newRefPrice);
// @ts-ignore
[newRefPrice,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.onCreate) },
    disabled: (!__VLS_ctx.canCreate),
    ...{ class: "px-4 py-2 rounded text-white" },
    ...{ class: (__VLS_ctx.canCreate ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-300 cursor-not-allowed') },
});
// @ts-ignore
[onCreate, canCreate, canCreate,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-wrap items-center gap-2 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    placeholder: "Buscar por nombre",
    ...{ class: "border rounded p-2 w-64" },
});
(__VLS_ctx.qName);
// @ts-ignore
[qName,];
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.categoryFilter),
    ...{ class: "border rounded p-2" },
});
// @ts-ignore
[categoryFilter,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "all",
});
for (const [c] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
    // @ts-ignore
    [categories,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (c.id),
        value: (c.id),
    });
    (c.name);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center gap-1" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.letterFilter = 'all';
            // @ts-ignore
            [letterFilter,];
        } },
    ...{ class: "px-2 py-1 border rounded" },
    ...{ class: ({ 'bg-emerald-600 text-white': __VLS_ctx.letterFilter === 'all' }) },
});
// @ts-ignore
[letterFilter,];
for (const [L] of __VLS_getVForSourceType((__VLS_ctx.letters))) {
    // @ts-ignore
    [letters,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.letterFilter = L;
                // @ts-ignore
                [letterFilter,];
            } },
        key: (L),
        ...{ class: "px-2 py-1 border rounded" },
        ...{ class: ({ 'bg-emerald-600 text-white': __VLS_ctx.letterFilter === L }) },
    });
    // @ts-ignore
    [letterFilter,];
    (L);
}
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
        ...{ class: "p-2 border text-left" },
    });
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
        ...{ class: "p-2 border text-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
    for (const [p] of __VLS_getVForSourceType((__VLS_ctx.filtered))) {
        // @ts-ignore
        [filtered,];
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
            key: (p.id),
        });
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (p.name);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (p.category_name);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (p.default_unit_name || '-');
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border" },
        });
        (p.ref_price ?? '-');
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
            ...{ class: "p-2 border text-center space-x-3" },
        });
        __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.openEdit(p);
                    // @ts-ignore
                    [openEdit,];
                } },
            ...{ class: "text-blue-600 cursor-pointer" },
        });
        __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.error))
                        return;
                    __VLS_ctx.onDelete(p);
                    // @ts-ignore
                    [onDelete,];
                } },
            ...{ class: "text-red-600 cursor-pointer" },
        });
    }
}
if (__VLS_ctx.editOpen) {
    // @ts-ignore
    [editOpen,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 bg-black/30 flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-white rounded-2xl p-5 w-[420px] shadow" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
        value: (__VLS_ctx.editUnit),
        ...{ class: "border rounded p-2 w-full mb-4" },
    });
    // @ts-ignore
    [editUnit,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: (null),
    });
    for (const [u] of __VLS_getVForSourceType((__VLS_ctx.units))) {
        // @ts-ignore
        [units,];
        __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
            key: (u.id),
            value: (u.id),
        });
        (u.name);
        if (u.symbol) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            (u.symbol);
        }
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.editOpen))
                    return;
                __VLS_ctx.editOpen = false;
                // @ts-ignore
                [editOpen,];
            } },
        ...{ class: "px-3 py-2 border rounded" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.saveEdit) },
        ...{ class: "px-3 py-2 rounded bg-emerald-600 text-white" },
    });
    // @ts-ignore
    [saveEdit,];
}
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-emerald-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-50/70']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-5']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
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
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-emerald-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
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
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
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
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
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
/** @type {__VLS_StyleScopedClasses['w-[420px]']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
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
/** @type {__VLS_StyleScopedClasses['bg-emerald-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        loading: loading,
        error: error,
        categories: categories,
        units: units,
        qName: qName,
        categoryFilter: categoryFilter,
        letterFilter: letterFilter,
        editOpen: editOpen,
        editUnit: editUnit,
        newName: newName,
        newCategory: newCategory,
        newUnit: newUnit,
        newRefPrice: newRefPrice,
        canCreate: canCreate,
        letters: letters,
        filtered: filtered,
        openEdit: openEdit,
        saveEdit: saveEdit,
        onCreate: onCreate,
        onDelete: onDelete,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
