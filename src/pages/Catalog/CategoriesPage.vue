<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiFetch } from "@/services/http";

type Id = number | string;
// Permite pasar objetos en body sin pelear con TS
type ApiInit = Omit<RequestInit, "body"> & { body?: any };

const loading = ref(false);
const error   = ref<string|null>(null);
const items   = ref<any[]>([]);
const name    = ref<string>("");

async function load() {
  loading.value = true; error.value = null;
  try {
    items.value = await apiFetch("/api/categories/");
  } catch (e:any) {
    error.value = e?.message || "No se pudo cargar categorías";
  } finally {
    loading.value = false;
  }
}

async function onAdd() {
  const n = name.value.trim();
  if (!n) return;
  try {
    await apiFetch("/api/categories/", {
      method: "POST",
      body: { name: n },
    } as ApiInit);
    name.value = "";
    await load();
  } catch (e:any) {
    alert(e?.message || "No se pudo crear la categoría");
  }
}

async function onDelete(id: Id) {
  if (!confirm("¿Eliminar categoría?")) return;
  try {
    await apiFetch(`/api/categories/${id}/`, { method: "DELETE" });
    await load();
  } catch (e:any) {
    alert(e?.message || "No se pudo eliminar");
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold mb-4">Categorías</h1>

    <div class="flex gap-2 mb-4">
      <input
        v-model="name"
        class="border rounded p-2 w-full"
        placeholder="Nueva categoría"
        @keyup.enter="onAdd"
      />
      <button
        :disabled="!name"
        @click="onAdd"
        class="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Agregar
      </button>
    </div>

    <div v-if="loading" class="text-gray-600">Cargando…</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <table v-else class="w-full bg-white border">
      <thead>
        <tr class="bg-gray-100">
          <th class="p-2 border text-left">Nombre</th>
          <th class="p-2 border text-center">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in items" :key="c.id">
          <td class="p-2 border">{{ c.name }}</td>
          <td class="p-2 border text-center">
            <button class="text-red-600" @click="onDelete(c.id)">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
