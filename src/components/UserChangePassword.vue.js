import { ref, watch, computed } from 'vue';
import { changePassword } from '@/services/auth';
const current = ref('');
const next = ref('');
const confirm = ref('');
const showCurrent = ref(false);
const showNext = ref(false);
const showConfirm = ref(false);
const loading = ref(false);
const ok = ref(null);
const err = ref(null);
const isInvalid = computed(() => !current.value || !next.value || !confirm.value || next.value !== confirm.value);
watch([current, next, confirm], () => {
    ok.value = null;
    err.value = null;
});
async function submit() {
    if (isInvalid.value || loading.value)
        return;
    ok.value = null;
    err.value = null;
    loading.value = true;
    try {
        // Firma: (current_password, new_password)
        const resp = await changePassword(current.value, next.value);
        ok.value = resp?.detail || 'Contraseña actualizada correctamente ✅';
        current.value = '';
        next.value = '';
        confirm.value = '';
    }
    catch (e) {
        console.error('Error al cambiar contraseña:', e);
        // mostramos texto exacto (el que viene del backend o del servicio)
        err.value = e?.message || JSON.stringify(e) || 'Error desconocido.';
    }
    finally {
        loading.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-w-md p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "text-lg font-semibold mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.form, __VLS_elements.form)({
    ...{ onSubmit: (__VLS_ctx.submit) },
    ...{ class: "space-y-3" },
});
// @ts-ignore
[submit,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "block text-sm font-medium mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: (__VLS_ctx.showCurrent ? 'text' : 'password'),
    ...{ class: "w-full border rounded p-2 pr-10" },
    autocomplete: "current-password",
    required: true,
});
(__VLS_ctx.current);
// @ts-ignore
[showCurrent, current,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCurrent = !__VLS_ctx.showCurrent;
            // @ts-ignore
            [showCurrent, showCurrent,];
        } },
    type: "button",
    ...{ class: "absolute right-2 top-8 text-gray-500 text-sm" },
    'aria-label': (__VLS_ctx.showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'),
});
// @ts-ignore
[showCurrent,];
(__VLS_ctx.showCurrent ? '👁️' : '👁️‍🗨️');
// @ts-ignore
[showCurrent,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "block text-sm font-medium mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: (__VLS_ctx.showNext ? 'text' : 'password'),
    ...{ class: "w-full border rounded p-2 pr-10" },
    autocomplete: "new-password",
    required: true,
});
(__VLS_ctx.next);
// @ts-ignore
[showNext, next,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showNext = !__VLS_ctx.showNext;
            // @ts-ignore
            [showNext, showNext,];
        } },
    type: "button",
    ...{ class: "absolute right-2 top-8 text-gray-500 text-sm" },
    'aria-label': (__VLS_ctx.showNext ? 'Ocultar contraseña' : 'Mostrar contraseña'),
});
// @ts-ignore
[showNext,];
(__VLS_ctx.showNext ? '👁️' : '👁️‍🗨️');
// @ts-ignore
[showNext,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "block text-sm font-medium mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: (__VLS_ctx.showConfirm ? 'text' : 'password'),
    ...{ class: "w-full border rounded p-2 pr-10" },
    autocomplete: "new-password",
    required: true,
});
(__VLS_ctx.confirm);
// @ts-ignore
[showConfirm, confirm,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showConfirm = !__VLS_ctx.showConfirm;
            // @ts-ignore
            [showConfirm, showConfirm,];
        } },
    type: "button",
    ...{ class: "absolute right-2 top-8 text-gray-500 text-sm" },
    'aria-label': (__VLS_ctx.showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'),
});
// @ts-ignore
[showConfirm,];
(__VLS_ctx.showConfirm ? '👁️' : '👁️‍🗨️');
// @ts-ignore
[showConfirm,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    type: "submit",
    disabled: (__VLS_ctx.loading || __VLS_ctx.isInvalid),
    ...{ class: "px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60" },
});
// @ts-ignore
[loading, isInvalid,];
(__VLS_ctx.loading ? 'Guardando…' : 'Guardar');
// @ts-ignore
[loading,];
if (__VLS_ctx.ok) {
    // @ts-ignore
    [ok,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-green-600 text-sm mt-2" },
    });
    (__VLS_ctx.ok);
    // @ts-ignore
    [ok,];
}
if (__VLS_ctx.err) {
    // @ts-ignore
    [err,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-red-600 text-sm mt-2" },
    });
    (__VLS_ctx.err);
    // @ts-ignore
    [err,];
}
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-10']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-10']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-10']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        current: current,
        next: next,
        confirm: confirm,
        showCurrent: showCurrent,
        showNext: showNext,
        showConfirm: showConfirm,
        loading: loading,
        ok: ok,
        err: err,
        isInvalid: isInvalid,
        submit: submit,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
