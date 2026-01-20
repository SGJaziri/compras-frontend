import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";
const props = defineProps();
const emit = defineEmits();
const open = ref(false);
const internal = ref([...props.modelValue]);
watch(() => props.modelValue, v => { internal.value = [...v]; });
function toggle() { open.value = !open.value; }
function close() { open.value = false; }
function onCheck(id, checked) {
    const set = new Set(internal.value.map(String));
    if (checked)
        set.add(String(id));
    else
        set.delete(String(id));
    internal.value = Array.from(set);
    emit("update:modelValue", internal.value);
}
function selectAll() {
    internal.value = props.options.map(o => o.id);
    emit("update:modelValue", internal.value);
}
function clearAll() {
    internal.value = [];
    emit("update:modelValue", internal.value);
}
const summaryText = computed(() => {
    if (!internal.value.length)
        return props.placeholder ?? "— Seleccionar —";
    if (internal.value.length === props.options.length)
        return "Todos";
    const names = props.options
        .filter(o => internal.value.map(String).includes(String(o.id)))
        .map(o => o.name);
    return names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "");
});
// cerrar al click fuera
function onDocClick(e) {
    const target = e.target;
    if (!target.closest?.("[data-mcd-root]"))
        close();
}
onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-col gap-1" },
    'data-mcd-root': true,
});
if (__VLS_ctx.label) {
    // @ts-ignore
    [label,];
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm" },
    });
    (__VLS_ctx.label);
    // @ts-ignore
    [label,];
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggle) },
    type: "button",
    ...{ class: "border rounded px-3 py-2 bg-white text-left flex items-center justify-between" },
    ...{ class: (__VLS_ctx.widthClass ?? 'min-w-[280px]') },
});
// @ts-ignore
[toggle, widthClass,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "truncate" },
});
(__VLS_ctx.summaryText);
// @ts-ignore
[summaryText,];
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    xmlns: "http://www.w3.org/2000/svg",
    ...{ class: "h-4 w-4 opacity-70" },
    viewBox: "0 0 20 20",
    fill: "currentColor",
});
__VLS_asFunctionalElement(__VLS_elements.path)({
    'fill-rule': "evenodd",
    d: "M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.24 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z",
    'clip-rule': "evenodd",
});
if (__VLS_ctx.open) {
    // @ts-ignore
    [open,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute z-20 mt-1 border rounded bg-white shadow-lg p-2 max-h-64 overflow-auto" },
        ...{ class: (__VLS_ctx.widthClass ?? 'min-w-[280px]') },
    });
    // @ts-ignore
    [widthClass,];
    __VLS_asFunctionalElement(__VLS_elements.ul, __VLS_elements.ul)({
        ...{ class: "flex flex-col gap-1" },
    });
    for (const [opt] of __VLS_getVForSourceType((__VLS_ctx.options))) {
        // @ts-ignore
        [options,];
        __VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({
            key: (String(opt.id)),
            ...{ class: "flex items-center gap-2 px-1" },
        });
        __VLS_asFunctionalElement(__VLS_elements.input)({
            ...{ onChange: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    __VLS_ctx.onCheck(opt.id, $event.target.checked);
                    // @ts-ignore
                    [onCheck,];
                } },
            type: "checkbox",
            ...{ class: "h-4 w-4" },
            checked: (__VLS_ctx.internal.map(String).includes(String(opt.id))),
        });
        // @ts-ignore
        [internal,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-sm" },
        });
        (opt.name);
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex gap-2 mt-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.clearAll) },
        ...{ class: "px-2 py-1 text-sm border rounded bg-gray-50 hover:bg-gray-100" },
    });
    // @ts-ignore
    [clearAll,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.selectAll) },
        ...{ class: "px-2 py-1 text-sm border rounded bg-gray-50 hover:bg-gray-100" },
    });
    // @ts-ignore
    [selectAll,];
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        open: open,
        internal: internal,
        toggle: toggle,
        onCheck: onCheck,
        selectAll: selectAll,
        clearAll: clearAll,
        summaryText: summaryText,
    }),
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
