<!-- src/pages/Catalog/ProductsPage.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { apiFetch } from "@/services/http";

type ID = number | string;
type ApiInit = Omit<RequestInit, "body"> & { body?: any };

type Product = {
  id: ID;
  name: string;
  category: ID;
  category_name?: string;
  default_unit: ID | null;
  default_unit_name?: string | null;
  ref_price?: number | null;
};

const loading = ref(false);
const error   = ref<string|null>(null);

const products   = ref<Product[]>([]);
const categories = ref<any[]>([]);
const units      = ref<any[]>([]);

/* ===== Filtros ===== */
const qName          = ref("");
const categoryFilter = ref<ID | "all">("all");
const letterFilter   = ref<string | "all">("all");

/* ===== Edición (cambiar unidad) ===== */
const editOpen = ref(false);
const editRow  = ref<Product | null>(null);
const editUnit = ref<ID | null>(null);

/* ===== Alta rápida (form superior) ===== */
const newName     = ref<string>("");
const newCategory = ref<ID | null>(null);
const newUnit     = ref<ID | null>(null);
const newRefPrice = ref<number | null>(null);

const canCreate = computed(() => !!newName.value.trim() && !!newCategory.value);

const catNameById  = computed(() => new Map(categories.value.map((c:any) => [c.id, c.name])));
const unitNameById = computed(() => new Map(units.value.map((u:any) => [u.id, u.name])));

async function loadAll() {
  loading.value = true; error.value = null;
  try {
    const [p, c, u] = await Promise.all([
      apiFetch("/api/products/"),
      apiFetch("/api/categories/"),
      apiFetch("/api/units/"),
    ]);

    categories.value = c;
    units.value      = u;

    const catMap  = catNameById.value;
    const unitMap = unitNameById.value;

    products.value = p.map((it: Product) => ({
      ...it,
      category_name: it.category_name ?? catMap.get(it.category) ?? "-",
      default_unit_name: it.default_unit_name ?? (it.default_unit ? unitMap.get(it.default_unit) : null),
    }));
  } catch (e:any) {
    error.value = e?.message || "No se pudo cargar";
  } finally {
    loading.value = false;
  }
}

const letters = computed(() => {
  const set = new Set<string>();
  products.value.forEach(p => {
    const L = (p.name?.[0] || "").toUpperCase();
    if (L) set.add(L);
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

function openEdit(row: Product) {
  editRow.value  = row;
  editUnit.value = row.default_unit;
  editOpen.value = true;
}

async function saveEdit() {
  if (!editRow.value) return;
  try {
    const updated = await apiFetch(`/api/products/${editRow.value.id}/`, {
      method: "PATCH",
      body: { default_unit: editUnit.value },
    } as ApiInit);

    const idx = products.value.findIndex(p => p.id === editRow.value!.id);
    const unitName = unitNameById.value.get(updated?.default_unit ?? editUnit.value);
    if (idx >= 0) {
      products.value[idx] = {
        ...products.value[idx],
        default_unit: updated?.default_unit ?? editUnit.value,
        default_unit_name: unitName ?? null,
      };
    }
    editOpen.value = false;
  } catch (e:any) {
    alert(e?.message || "No se pudo actualizar");
  }
}

async function onCreate() {
  if (!canCreate.value) return;
  try {
    const payload:any = {
      name: newName.value.trim(),
      category: newCategory.value,
      default_unit: newUnit.value ?? null,
      ref_price: newRefPrice.value ?? null,
    };
    const created = await apiFetch("/api/products/", {
      method: "POST",
      body: payload,
    } as ApiInit);

    const item: Product = {
      ...created,
      category_name: catNameById.value.get(created.category) ?? "-",
      default_unit_name: created.default_unit ? unitNameById.value.get(created.default_unit) ?? null : null,
    };
    products.value.unshift(item);

    newName.value = "";
    newCategory.value = null;
    newUnit.value = null;
    newRefPrice.value = null;
  } catch (e:any) {
    alert(e?.message || "No se pudo crear el producto");
  }
}

async function onDelete(row: Product) {
  if (!confirm(`¿Eliminar "${row.name}"?`)) return;
  try {
    await apiFetch(`/api/products/${row.id}/`, { method: "DELETE" } as ApiInit);
    products.value = products.value.filter(p => p.id !== row.id);
  } catch (e:any) {
    const msg = e?.detail || e?.message || "No se pudo eliminar";
    alert(msg);
  }
}

onMounted(loadAll);
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold mb-4">Productos</h1>

    <!-- Alta rápida destacada -->
    <div class="mb-5 rounded-xl p-4 ring-1 ring-emerald-200 bg-emerald-50/70">
      <h2 class="font-medium mb-3">Agregar producto</h2>
      <div class="grid gap-3 md:grid-cols-5 items-end">
        <input v-model="newName" class="border rounded p-2 w-full" placeholder="Nombre" />
        <select v-model="newCategory" class="border rounded p-2 w-full">
          <option :value="null">— Categoría —</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <select v-model="newUnit" class="border rounded p-2 w-full">
          <option :value="null">— Unidad por defecto (opcional) —</option>
          <option v-for="u in units" :key="u.id" :value="u.id">
            {{ u.name }} <span v-if="u.symbol">({{ u.symbol }})</span>
          </option>
        </select>
        <input v-model.number="newRefPrice" type="number" step="0.01"
               class="border rounded p-2 w-full" placeholder="Precio ref. (opcional)" />
        <button :disabled="!canCreate"
                class="px-4 py-2 rounded text-white"
                :class="canCreate ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-300 cursor-not-allowed'"
                @click="onCreate">
          Agregar
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <input v-model="qName" placeholder="Buscar por nombre" class="border rounded p-2 w-64" />
      <select v-model="categoryFilter" class="border rounded p-2">
        <option value="all">— Categoría —</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <div class="flex items-center gap-1">
        <button class="px-2 py-1 border rounded" :class="{'bg-emerald-600 text-white': letterFilter==='all'}" @click="letterFilter='all'">Todos</button>
        <button v-for="L in letters" :key="L" class="px-2 py-1 border rounded"
                :class="{'bg-emerald-600 text-white': letterFilter===L}"
                @click="letterFilter=L">{{ L }}</button>
      </div>
    </div>

    <div v-if="loading" class="text-gray-600">Cargando…</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <table v-else class="w-full bg-white border">
      <thead>
        <tr class="bg-gray-100">
          <th class="p-2 border text-left">Nombre</th>
          <th class="p-2 border text-left">Categoría</th>
          <th class="p-2 border text-left">Unidad por defecto</th>
          <th class="p-2 border text-left">Precio ref.</th>
          <th class="p-2 border text-center">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in filtered" :key="p.id">
          <td class="p-2 border">{{ p.name }}</td>
          <td class="p-2 border">{{ p.category_name }}</td>
          <td class="p-2 border">{{ p.default_unit_name || '-' }}</td>
          <td class="p-2 border">{{ p.ref_price ?? '-' }}</td>
          <td class="p-2 border text-center space-x-3">
            <a class="text-blue-600 cursor-pointer" @click="openEdit(p)">Editar</a>
            <a class="text-red-600 cursor-pointer" @click="onDelete(p)">Eliminar</a>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Modal edición -->
    <div v-if="editOpen" class="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div class="bg-white rounded-2xl p-5 w-[420px] shadow">
        <h3 class="text-lg mb-3">Cambiar unidad por defecto</h3>
        <select v-model="editUnit" class="border rounded p-2 w-full mb-4">
          <option :value="null">— Sin unidad —</option>
          <option v-for="u in units" :key="u.id" :value="u.id">
            {{ u.name }} <span v-if="u.symbol">({{ u.symbol }})</span>
          </option>
        </select>
        <div class="flex justify-end gap-2">
          <button class="px-3 py-2 border rounded" @click="editOpen=false">Cancelar</button>
          <button class="px-3 py-2 rounded bg-emerald-600 text-white" @click="saveEdit">Guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>
