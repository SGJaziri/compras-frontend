<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiFetch } from "@/services/http";

type ApiInit = Omit<RequestInit, "body"> & { body?: any };

const restaurants = ref<any[]>([]);
const loading = ref(false);
const error   = ref<string|null>(null);

const name    = ref<string>("");
const code    = ref<string>("");
const addr    = ref<string>("");
const contact = ref<string>("");

async function load(){
  loading.value = true; error.value = null;
  try {
    restaurants.value = await apiFetch("/api/restaurants/");
  } catch (e:any) {
    error.value = e?.message || "No se pudo cargar restaurantes";
  } finally {
    loading.value = false;
  }
}

async function onCreate(){
  if(!name.value.trim() || !code.value.trim()) return;
  try {
    await apiFetch("/api/restaurants/", {
      method: "POST",
      body: {
        name: name.value.trim(),
        code: code.value.trim(),
        address: addr.value || null,
        contact: contact.value || null,
      },
    } as ApiInit);
    name.value = ""; code.value = ""; addr.value = ""; contact.value = "";
    await load();
  } catch (e:any) {
    alert(e?.message || "No se pudo crear");
  }
}

async function onDelete(id:number){
  if(!confirm("¿Eliminar restaurante?")) return;
  try {
    await apiFetch(`/api/restaurants/${id}/`, { method: "DELETE" });
    await load();
  } catch (e:any) {
    alert(e?.message || "No se pudo eliminar");
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold mb-4">Restaurantes</h1>

    <div class="grid gap-3 md:grid-cols-5 items-end mb-6">
      <input class="border rounded p-2 w-full" placeholder="Nombre" v-model="name" />
      <input class="border rounded p-2 w-full" placeholder="Código (3 letras)" v-model="code" />
      <input class="border rounded p-2 w-full" placeholder="Dirección (opcional)" v-model="addr" />
      <input class="border rounded p-2 w-full" placeholder="Contacto (opcional)" v-model="contact" />
      <button class="bg-emerald-600 text-white px-4 py-2 rounded" @click="onCreate">Agregar</button>
    </div>

    <div v-if="loading" class="text-gray-600">Cargando…</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <table v-else class="w-full bg-white border">
      <thead>
        <tr class="bg-gray-100">
          <th class="p-2 border text-left">Nombre</th>
          <th class="p-2 border text-left">Código</th>
          <th class="p-2 border text-left">Dirección</th>
          <th class="p-2 border text-left">Contacto</th>
          <th class="p-2 border text-center">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in restaurants" :key="r.id">
          <td class="p-2 border">{{ r.name }}</td>
          <td class="p-2 border">{{ r.code }}</td>
          <td class="p-2 border">{{ r.address || '-' }}</td>
          <td class="p-2 border">{{ r.contact || '-' }}</td>
          <td class="p-2 border text-center">
            <button class="text-red-600" @click="onDelete(r.id)">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
