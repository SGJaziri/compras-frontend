<!-- src/components/UserChangePassword.vue -->
<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { changePassword } from '@/services/auth';

const current = ref('');
const next = ref('');
const confirm = ref('');

const showCurrent = ref(false);
const showNext = ref(false);
const showConfirm = ref(false);

const loading = ref(false);
const ok = ref<string | null>(null);
const err = ref<string | null>(null);

const isInvalid = computed(() =>
  !current.value || !next.value || !confirm.value || next.value !== confirm.value
);

watch([current, next, confirm], () => {
  ok.value = null;
  err.value = null;
});

async function submit() {
  if (isInvalid.value || loading.value) return;

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
  } catch (e: any) {
    console.error('Error al cambiar contraseña:', e);
    // mostramos texto exacto (el que viene del backend o del servicio)
    err.value = e?.message || JSON.stringify(e) || 'Error desconocido.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-md p-4">
    <h2 class="text-lg font-semibold mb-3">Cambiar contraseña</h2>

    <form class="space-y-3" @submit.prevent="submit">
      <!-- Actual -->
      <div class="relative">
        <label class="block text-sm font-medium mb-1">Contraseña actual</label>
        <input
          v-model="current"
          :type="showCurrent ? 'text' : 'password'"
          class="w-full border rounded p-2 pr-10"
          autocomplete="current-password"
          required
        />
        <button
          type="button"
          class="absolute right-2 top-8 text-gray-500 text-sm"
          :aria-label="showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showCurrent = !showCurrent"
        >
          {{ showCurrent ? '👁️' : '👁️‍🗨️' }}
        </button>
      </div>

      <!-- Nueva -->
      <div class="relative">
        <label class="block text-sm font-medium mb-1">Nueva contraseña</label>
        <input
          v-model="next"
          :type="showNext ? 'text' : 'password'"
          class="w-full border rounded p-2 pr-10"
          autocomplete="new-password"
          required
        />
        <button
          type="button"
          class="absolute right-2 top-8 text-gray-500 text-sm"
          :aria-label="showNext ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showNext = !showNext"
        >
          {{ showNext ? '👁️' : '👁️‍🗨️' }}
        </button>
      </div>

      <!-- Confirmar -->
      <div class="relative">
        <label class="block text-sm font-medium mb-1">Confirmar nueva contraseña</label>
        <input
          v-model="confirm"
          :type="showConfirm ? 'text' : 'password'"
          class="w-full border rounded p-2 pr-10"
          autocomplete="new-password"
          required
        />
        <button
          type="button"
          class="absolute right-2 top-8 text-gray-500 text-sm"
          :aria-label="showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showConfirm = !showConfirm"
        >
          {{ showConfirm ? '👁️' : '👁️‍🗨️' }}
        </button>
      </div>

      <button
        type="submit"
        :disabled="loading || isInvalid"
        class="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
      >
        {{ loading ? 'Guardando…' : 'Guardar' }}
      </button>

      <p v-if="ok" class="text-green-600 text-sm mt-2">{{ ok }}</p>
      <p v-if="err" class="text-red-600 text-sm mt-2">{{ err }}</p>
    </form>
  </div>
</template>
