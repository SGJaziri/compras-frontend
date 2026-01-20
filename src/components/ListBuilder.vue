<!-- src/components/ListBuilder.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useCatalog } from "@/composables/useCatalog";
import { getPdfUrlNoPrices } from "@/services/purchaseLists";
import { apiFetch, absoluteApiUrl } from "@/services/http";
import type { ID, Product, Unit } from "@/types";

/* ===== helpers estrictos ===== */
const idStr = (v: unknown) => (v == null ? "" : String(v));
const toIntStrict = (raw: unknown): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
};
const pad4 = (n: number) => String(n).padStart(4, "0");
const DEBUG = true;
const dbg = (...a: any[]) => { if (DEBUG) console.debug("[ListBuilder]", ...a); };

/* ===== catálogo ===== */
const { load, restaurants, categories, products, units, unitsById } = useCatalog();

/* ===== estado UI ===== */
const selectedRestaurantRaw = ref<string>("");
const selectedCategoryRaw   = ref<string>("");
const selectedProductRaw    = ref<string>("");
const selectedUnitRaw       = ref<string>("");
const qty                   = ref<number | null>(null);

const kgWhole = ref<number>(0);          // kilos enteros
const kgExtra = ref<string>("");         // "0.5" | "0.25" | "0.125" | ""
const kgQty = computed<number>(() => {
  const base = Number.isFinite(kgWhole.value) ? kgWhole.value : 0;
  const extra = kgExtra.value ? Number(kgExtra.value) : 0;
  return base + extra;
});

function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const selectedUnitText = computed(() => {
  const id = toIntStrict(selectedUnitRaw.value);
  if (id == null) return "";
  const list = units.value ?? [];
  const u = list.find((x: any) => Number(x.id) === id);
  return u?.name ?? "";
});

const isKgSelected = computed(() => {
  const t = norm(selectedUnitText.value);
  return t === "kg" || t.includes("kg") || t.includes("kilogram");
});

watch([kgWhole, kgExtra, isKgSelected], () => {
  if (!isKgSelected.value) return;
  // Mantén qty sincronizado con los kg enteros + adicional
  qty.value = Number(kgQty.value.toFixed(3));
});

watch(isKgSelected, (isKg) => {
  if (!isKg) {
    kgWhole.value = 0;
    kgExtra.value = "";
  } else {
    // cuando entras a kg, si qty ya tenía algo, intenta reflejarlo
    const current = Number(qty.value ?? 0);
    kgWhole.value = Math.floor(current);
    const frac = +(current - kgWhole.value).toFixed(3);
    kgExtra.value =
      frac === 0.5 ? "0.5" :
      frac === 0.25 ? "0.25" :
      frac === 0.125 ? "0.125" : "";
  }
});

const listId   = ref<ID | null>(null);
const creating = ref(false);
const adding   = ref(false);

const deletingIds = ref<Set<number>>(new Set());

/* ===== tabla local ===== */
type ListItemRow = { id?: ID; product: ID; unit: ID; qty: number; price_soles?: number | null; };
const items = ref<ListItemRow[]>([]);

/* ===== catálogo load + fallbacks ===== */
onMounted(async () => {
  await load().catch(() => {});
  if (!Array.isArray(restaurants.value) || restaurants.value.length === 0) {
    try { restaurants.value = await apiFetch("/api/restaurants/"); } catch {}
  }
  if (!Array.isArray(categories.value) || categories.value.length === 0) {
    try { categories.value = await apiFetch("/api/categories/"); } catch {}
  }
  if (!Array.isArray(products.value) || products.value.length === 0) {
    try { products.value = await apiFetch("/api/products/"); } catch {}
  }
  if (!Array.isArray(units.value) || units.value.length === 0) {
    try { units.value = await apiFetch("/api/units/"); } catch {}
  }
});

/* ===== computeds ===== */
const restaurantId = computed<number | null>(() => toIntStrict(selectedRestaurantRaw.value));
const categoryId   = computed<number | null>(() => toIntStrict(selectedCategoryRaw.value));
const productId    = computed<number | null>(() => toIntStrict(selectedProductRaw.value));
const unitId       = computed<number | null>(() => toIntStrict(selectedUnitRaw.value));

const currentRestaurant = computed(() => {
  const rid = selectedRestaurantRaw.value;
  if (!rid) return null as any;
  return restaurants.value.find((r: any) => idStr(r.id) === rid) ?? null;
});

const isCurrency = computed<boolean>(() => {
  const uid = unitId.value;
  return uid != null ? !!unitsById.value.get(uid)?.is_currency : false;
});

const selectedProducts = computed(() => {
  const cat = selectedCategoryRaw.value;
  if (!cat) return [];
  return products.value.filter((p: any) => idStr(p.category) === cat);
});

watch(selectedCategoryRaw, () => {
  selectedProductRaw.value = "";
  selectedUnitRaw.value = "";
});

watch(selectedProductRaw, (pid) => {
  if (!pid) { selectedUnitRaw.value = ""; return; }
  const p = products.value.find((x: any) => idStr(x.id) === pid);
  selectedUnitRaw.value = p?.default_unit != null ? String(p.default_unit) : "";
});

const canAdd = computed(() =>
  !!listId.value &&
  productId.value != null &&
  unitId.value    != null &&
  typeof qty.value === "number" &&
  isFinite(qty.value)
);

/* ===== helpers para tablas ===== */
const productsById = computed<Map<ID, Product>>(() => {
  const m = new Map<ID, Product>();
  products.value.forEach((p: any) => m.set(p.id, p));
  return m;
});

const productName = (id: ID | null) => {
  if (id == null) return "-";
  const p = productsById.value.get(id) as any | undefined;
  return (p?.name ?? String(id)) as string;
};

const unitLabel = (id: ID | null) => {
  if (id == null) return "-";
  const u = unitsById.value.get(id) as Unit | undefined;
  return (u?.symbol || u?.name || String(id)) as string;
};

function isUnitKgById(unitId: any): boolean {
  if (unitId == null) return false;

  const u = unitsById.value.get(Number(unitId));
  if (!u) return false;

  const name = norm(String(u.name || ""));
  return name === "kg" || name.includes("kilogram");
}

function formatKgHuman(qty: any): string {
  const n = Number(qty ?? 0);
  const whole = Math.floor(n);
  const frac = +(n - whole).toFixed(3);

  const fracLabel =
    frac === 0.5 ? "1/2" :
    frac === 0.25 ? "1/4" :
    frac === 0.125 ? "1/8" :
    "";

  // fallback si no calza exacto con fracciones
  if (!fracLabel) return String(n);

  if (whole > 0) return `${whole} kg ${fracLabel}`;
  return `${fracLabel} kg`;
}

/* ===== auth/fetch ===== */
function tokenCandidates(): string[] {
  return [
    localStorage.getItem("access_token"),
    localStorage.getItem("token"),
    localStorage.getItem("authToken"),
  ].filter(Boolean) as string[];
}
const schemes = ["Token", "Bearer"] as const;

async function postJson(url: string, body: any): Promise<Response> {
  const payload = JSON.stringify(body);
  for (const t of tokenCandidates()) {
    for (const s of schemes) {
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `${s} ${t}` },
        body: payload,
      });
      if (resp.ok) return resp;
      if (resp.status !== 401 && resp.status !== 405 && resp.status !== 404) return resp;
    }
  }
  return await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
}

async function deleteAuth(url: string): Promise<Response> {
  for (const t of tokenCandidates()) {
    for (const s of schemes) {
      const resp = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Authorization: `${s} ${t}`,
        },
      });
      if (resp.ok) return resp;
      if (resp.status !== 401 && resp.status !== 405 && resp.status !== 404)
        return resp;
    }
  }

  return await fetch(url, {
    method: "DELETE",
    credentials: "include",
  });
}

/* ===== crear lista ===== */
async function ensureList() {
  if (restaurantId.value == null) { alert("Selecciona un restaurante primero."); return; }
  if (listId.value || creating.value) return;

  creating.value = true;
  try {
    const url = absoluteApiUrl("/api/purchase-lists/");
    const resp = await postJson(url, { restaurant: restaurantId.value });
    if (!resp.ok) {
      try { const j = await resp.clone().json(); throw new Error(j?.detail || JSON.stringify(j)); }
      catch { throw new Error(await resp.text()); }
    }
    const data = await resp.json();
    listId.value = toIntStrict(data?.id);
    if (listId.value == null) throw new Error("ID de lista inválido.");
    dbg("Lista creada:", listId.value);
  } catch (e: any) {
    alert(e?.message || "No se pudo crear la lista (POST /api/purchase-lists/).");
  } finally {
    creating.value = false;
  }
}

/* ===== autodetección endpoint items ===== */
let cachedItemsEndpoint: "nested" | "flat" | null = null;

async function detectItemsEndpoint(purchaseListId: number): Promise<"nested" | "flat"> {
  if (cachedItemsEndpoint) return cachedItemsEndpoint;
  const nested = absoluteApiUrl(`/api/purchase-lists/${purchaseListId}/items/`);
  try {
    const probe = await fetch(nested, { method: "HEAD", credentials: "include" });
    if (probe.ok || [401, 403, 405].includes(probe.status)) {
      cachedItemsEndpoint = "nested";
      dbg("Endpoint detectado: nested", nested, "status:", probe.status);
      return cachedItemsEndpoint;
    }
  } catch {}
  try {
    const probe = await fetch(nested, { method: "OPTIONS", credentials: "include" });
    if (probe.ok || [200, 204, 401, 403, 405].includes(probe.status)) {
      cachedItemsEndpoint = "nested";
      dbg("Endpoint detectado (OPTIONS): nested", nested, "status:", probe.status);
      return cachedItemsEndpoint;
    }
  } catch {}
  cachedItemsEndpoint = "flat";
  dbg("Endpoint detectado: flat (/api/items/)");
  return cachedItemsEndpoint;
}

/* ===== agregar ítem ===== */
async function onAdd() {
  await ensureList();
  const p = productId.value, u = unitId.value, q = Number(qty.value);
  if (!listId.value || p == null || u == null || !Number.isFinite(q)) {
    alert("Selecciona producto, unidad y una cantidad válida.");
    return;
  }

  adding.value = true;
  try {
    const which = await detectItemsEndpoint(Number(listId.value));
    let url: string;
    let body: any;

    if (which === "nested") {
      url  = absoluteApiUrl(`/api/purchase-lists/${listId.value}/items/`);
      body = { product: p, unit: u, qty: q };
    } else {
      url  = absoluteApiUrl(`/api/items/`);
      body = { purchase_list: Number(listId.value), product: p, unit: u, qty: q };
    }

    dbg("POST →", which, url);
    dbg("Body →", body);

    const resp = await postJson(url, body);
    if (!resp.ok) {
      try { const j = await resp.clone().json(); throw new Error(j?.detail || JSON.stringify(j)); }
      catch { throw new Error(await resp.text()); }
    }

    const saved = await resp.json();
    items.value.push({
      id: saved?.id,
      product: saved?.product ?? p,
      unit: saved?.unit ?? u,
      qty: saved?.qty ?? q,
    });

    // limpiar selección
    selectedProductRaw.value = "";
    selectedUnitRaw.value = "";
    qty.value = null;
  } catch (e: any) {
    alert(e?.message || "No se pudo agregar el ítem.");
  } finally {
    adding.value = false;
  }
}

/* ===== borrar ítem ===== */
async function onDeleteItem(it: ListItemRow, idx: number) {
  // Si aún no existe en BD, solo quítalo local
  if (!it.id) {
    items.value.splice(idx, 1);
    return;
  }
  if (!listId.value) {
    alert("No existe lista activa.");
    return;
  }

  const ok = confirm(`¿Borrar "${productName(it.product)}" de la lista?`);
  if (!ok) return;

  const itemId = Number(it.id);
  deletingIds.value.add(itemId);

  try {
    // Endpoint principal (nested)
    const nestedUrl = absoluteApiUrl(`/api/purchase-lists/${listId.value}/items/${itemId}/`);
    let resp = await deleteAuth(nestedUrl);

    // Fallback por si alguna versión antigua usa endpoint plano
    if (!resp.ok && resp.status === 404) {
      const flatUrl = absoluteApiUrl(`/api/purchase-list-items/${itemId}/`);
      resp = await deleteAuth(flatUrl);
    }

    if (!resp.ok && resp.status !== 204) {
      try {
        const j = await resp.clone().json();
        throw new Error(j?.detail || JSON.stringify(j));
      } catch {
        throw new Error(await resp.text());
      }
    }

    items.value.splice(idx, 1);
  } catch (e: any) {
    alert(e?.message || "No se pudo borrar el ítem.");
  } finally {
    deletingIds.value.delete(itemId);
  }
}

const isDeleting = (it: ListItemRow) =>
  (it.id != null ? deletingIds.value.has(Number(it.id)) : false);

/* ===== nombre de archivo “serie-like” ===== */
function buildSeriesLikeName(withSn = true) {
  const year = new Date().getFullYear();
  const code = (currentRestaurant.value?.code || currentRestaurant.value?.name || "R").toString().trim().replace(/\s+/g, "-").toUpperCase();
  const num = listId.value != null ? pad4(Number(listId.value)) : "0000";
  return withSn ? `${year}-${code}-Sn-${num}` : `${year}-${code}-${num}`;
}

/* ===== PDF sin precios (descarga directa + reset + nueva lista) ===== */
function safeFileName(name: string) { return name.replace(/[\\/:*?"<>|]+/g, "_"); }
async function downloadPdfNoPrices() {
  if (!listId.value) return;
  const url = absoluteApiUrl(`/api/purchase-lists/${listId.value}/pdf/?hide_prices=1`);
  const desiredName = safeFileName(`${buildSeriesLikeName(true)}.pdf`);

  const tryFetchDownload = async (headers: Record<string, string>) => {
    const resp = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!resp.ok) throw resp;
    const blob = await resp.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = desiredName;            // 👈 nombre “AÑO-COD-Sn-NNNN.pdf”
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  };

  try {
    // primero con Authorization, por si el endpoint lo exige
    for (const t of tokenCandidates()) {
      for (const s of schemes) {
        try { await tryFetchDownload({ Authorization: `${s} ${t}` }); 
              // éxito: reset y crear nueva lista
              resetBuilder({ keepRestaurant: true });
              return;
        } catch (e) {
          if (!(e instanceof Response && e.status === 401)) {
            const msg = e instanceof Response ? await e.text() : (e as any)?.message;
            alert(msg || "No se pudo descargar el PDF");
            return;
          }
        }
      }
    }
    await tryFetchDownload({});
    resetBuilder({ keepRestaurant: true });
    
  } catch {
    // último recurso: navegar (deja que el servidor haga attachment)
    window.location.href = url;
    // al navegar no podemos resetear; pero si vuelve, lo hará manualmente.
  }
}

/* ===== reset ===== */
function resetBuilder(opts: { keepRestaurant?: boolean } = {}) {
  const keep = opts.keepRestaurant ?? false;
  const r = selectedRestaurantRaw.value;
  listId.value = null;
  items.value = [];
  selectedCategoryRaw.value = "";
  selectedProductRaw.value = "";
  selectedUnitRaw.value = "";
  qty.value = null;
  selectedRestaurantRaw.value = keep ? r : "";
}

const pdfUrl = computed(() => (listId.value ? getPdfUrlNoPrices(listId.value) : "#"));
async function onViewPdf() { await downloadPdfNoPrices(); }
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-4">
    <h1 class="text-xl font-semibold">Lista de compras</h1>

    <!-- Restaurante -->
    <div class="grid gap-2">
      <label class="text-sm">Restaurante</label>
      <select v-model="selectedRestaurantRaw" class="border rounded p-2">
        <option value="">-- Selecciona --</option>
        <option v-for="r in restaurants" :key="r.id" :value="idStr(r.id)">
          {{ r.name }}
        </option>
      </select>
    </div>

    <!-- Categoría / Producto -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="text-sm">Categoría</label>
        <select v-model="selectedCategoryRaw" class="border rounded p-2 w-full">
          <option value="">-- Selecciona --</option>
          <option v-for="c in categories" :key="c.id" :value="idStr(c.id)">
            {{ c.name }}
          </option>
        </select>
      </div>
      <div>
        <label class="text-sm">Producto</label>
        <select
          v-model="selectedProductRaw"
          class="border rounded p-2 w-full"
          :disabled="!selectedCategoryRaw"
        >
          <option value="">-- Selecciona --</option>
          <option v-for="p in selectedProducts" :key="p.id" :value="idStr(p.id)">
            {{ p.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Unidad / Cantidad -->
    <div class="grid grid-cols-3 gap-4">
      <!-- Unidad -->
      <div>
        <label class="text-sm">Unidad</label>
        <select v-model="selectedUnitRaw" class="border rounded p-2 w-full">
          <option value="">-- Selecciona --</option>
          <option v-for="u in units" :key="u.id" :value="idStr(u.id)">
            {{ u.name }}
          </option>
        </select>
      </div>

      <!-- Cantidad -->
      <div>
        <label class="text-sm">{{ isCurrency ? 'Importe (S/)' : 'Cantidad' }}</label>

        <!-- KG: enteros + adicional -->
        <div v-if="isKgSelected" class="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            v-model.number="kgWhole"
            class="border rounded p-2 w-full"
            placeholder="Kg enteros"
          />
          <select v-model="kgExtra" class="border rounded p-2 w-32">
            <option value="">—</option>
            <option value="0.5">1/2</option>
            <option value="0.25">1/4</option>
            <option value="0.125">1/8</option>
          </select>
        </div>

        <!-- NO KG -->
        <input
          v-else
          type="number"
          step="0.001"
          v-model.number="qty"
          class="border rounded p-2 w-full"
        />
      </div>

      <!-- Spacer -->
      <div class="flex items-end">
        <small class="text-gray-500"></small>
      </div>
    </div>

    <!-- Acciones -->
    <div class="flex gap-3">
      <button
        :disabled="restaurantId === null || creating"
        @click="ensureList"
        class="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {{ creating ? 'Creando…' : 'Crear lista (si no existe)' }}
      </button>

      <button
        :disabled="!canAdd || adding"
        @click="onAdd"
        class="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {{ adding ? 'Agregando…' : 'Agregar ítem' }}
      </button>

      <a v-if="listId"
         :href="pdfUrl"
         @click.prevent="onViewPdf"
         class="bg-gray-700 text-white px-4 py-2 rounded">
        Descargar PDF
      </a>
    </div>

    <!-- Tabla -->
    <div v-if="items.length" class="mt-4">
      <table class="w-full border table-fixed">
        <colgroup>
          <col class="w-1/2" />
          <col class="w-1/4" />
          <col class="w-1/4" />
        </colgroup>

        <thead>
          <tr class="bg-gray-100">
            <th class="p-2 border text-left">Producto</th>
            <th class="p-2 border text-left">Unidad</th>
            <th class="p-2 border text-right">Cantidad / Importe</th>
            <th class="p-2 border text-center">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(it, idx) in items" :key="it.id ?? `${it.product}-${it.unit}-${it.qty}`">
            <td class="p-2 border">{{ productName(it.product) }}</td>
            <td class="p-2 border">{{ unitLabel(it.unit) }}</td>
            <td class="p-2 border text-right font-mono tabular-nums">{{ it.qty }}</td>
            <td class="p-2 border text-center">
              <button
                @click="onDeleteItem(it, idx)"
                :disabled="isDeleting(it)"
                class="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {{ isDeleting(it) ? 'Borrando…' : 'Borrar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
