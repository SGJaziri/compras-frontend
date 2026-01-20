<!-- src/components/Login.vue -->
<script setup lang="ts">
import { ref } from "vue";
import { apiFetch, setToken as httpSetToken } from "@/services/http";
import { useRouter } from "vue-router";

const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const loading = ref(false);
const router = useRouter();

async function onSubmit() {
  if (loading.value) return;
  loading.value = true;
  error.value = null;

  try {
    // apiFetch YA devuelve JSON parseado
    const data: any = await apiFetch("/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Cast a any para que TS no se queje; http.ts se encarga de serializar
      body: { username: username.value, password: password.value } as any,
    });

    // DRF TokenAuth suele responder { token: "..." } (a veces { key: "..." })
    const token = (data && (data.token || data.key)) as string | undefined;
    if (!token) throw new Error("Login inválido: token no recibido");

    httpSetToken(token);          // guarda en localStorage
    await router.push("/");       // redirige a la home (ajusta si quieres otra ruta)
  } catch (e: any) {
    error.value = e?.message || "No se pudo iniciar sesión";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <form
      class="w-full max-w-sm bg-white shadow rounded p-6"
      @submit.prevent="onSubmit"
    >
      <h1 class="text-xl font-semibold mb-4">Iniciar sesión</h1>

      <div class="space-y-3">
        <input
          v-model="username"
          placeholder="Usuario"
          autocomplete="username"
          class="w-full border rounded p-2"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Contraseña"
          autocomplete="current-password"
          class="w-full border rounded p-2"
        />

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
        >
          {{ loading ? "Entrando…" : "Entrar" }}
        </button>

        <p v-if="error" class="text-red-600 text-sm mt-2">
          {{ error }}
        </p>
      </div>
    </form>
  </div>
</template>
