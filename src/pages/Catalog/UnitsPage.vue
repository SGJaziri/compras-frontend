<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue"; // ⟵ añadido watch
import { apiFetch } from "@/services/http";

type ApiInit = Omit<RequestInit, "body"> & { body?: any };

const units   = ref<any[]>([]);
const name    = ref<string>("");
const kind    = ref<string>("other");
const symbol  = ref<string>("");
const isCurr  = ref<boolean>(false);
const loading = ref(false);
const error   = ref<string|null>(null);

// ——— NUEVO: símbolo por defecto cuando es moneda ———
const DEFAULT_CURRENCY_SYMBOL = "S/";

// ——— NUEVO: si seleccionan "Moneda", marcar checkbox y sugerir símbolo ———
watch(kind, (val) => {
  if (val === "currency") {
    isCurr.value = true;
    if (!symbol.value.trim()) symbol.value = DEFAULT_CURRENCY_SYMBOL;
  }
});

async function load(){
  loading.value = true; error.value = null;
  try{
    units.value = await apiFetch("/api/units/");
  }catch(e:any){
    error.value = e?.message || "No se pudo cargar";
  }finally{
    loading.value = false;
  }
}

async function onCreate(){
  if(!name.value.trim()) return;
  try{
    await apiFetch("/api/units/", {
      method: "POST",
      body: {
        name: name.value.trim(),
        kind: kind.value,
        symbol: symbol.value || null,
        is_currency: isCurr.value,
      },
    } as ApiInit);
    // reset a estado inicial
    name.value = "";
    symbol.value = "";
    isCurr.value = false;
    kind.value = "other";
    await load();
  }catch(e:any){
    alert(e?.message || "No se pudo crear");
  }
}

async function onDelete(id:number){
  if(!confirm("¿Eliminar unidad?")) return;
  try {
    await apiFetch(`/api/units/${id}/`, { method: "DELETE" });
    await load();
  } catch (e:any) {
    const msg = e?.detail || e?.message || "No se pudo eliminar";
    alert(msg);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold mb-4">Unidades</h1>

    <div class="grid gap-3 md:grid-cols-5 items-end mb-6">
      <input class="border rounded p-2 w-full" placeholder="Nombre" v-model="name" />
      <select class="border rounded p-2 w-full" v-model="kind">
        <option value="mass">Masa</option>
        <option value="count">Conteo</option>
        <option value="currency">Moneda</option>
        <option value="package">Paquete</option>
        <option value="other">Otro</option>
      </select>
      <input class="border rounded p-2 w-full" placeholder="Símbolo (kg, S/, etc.)" v-model="symbol" />
      <label class="inline-flex items-center gap-2">
        <input type="checkbox" v-model="isCurr" /> ¿Es moneda?
      </label>
      <button class="bg-emerald-600 text-white px-4 py-2 rounded" @click="onCreate">Agregar</button>
    </div>

    <div v-if="loading" class="text-gray-600">Cargando…</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <table v-else class="w-full bg-white border">
      <thead>
        <tr class="bg-gray-100">
          <th class="p-2 border text-left">Nombre</th>
          <th class="p-2 border text-left">Tipo</th>
          <th class="p-2 border text-left">Símbolo</th>
          <th class="p-2 border text-center">Moneda</th>
          <th class="p-2 border text-center">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in units" :key="u.id">
          <td class="p-2 border">{{ u.name }}</td>
          <td class="p-2 border">{{ u.kind }}</td>
          <td class="p-2 border">{{ u.symbol || '-' }}</td>
          <td class="p-2 border text-center">{{ u.is_currency ? 'Sí' : 'No' }}</td>
          <td class="p-2 border text-center">
            <button class="text-red-600" @click="onDelete(u.id)">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
