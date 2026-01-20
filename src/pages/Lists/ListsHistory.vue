<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch, apiFetchBlob } from '@/services/http';
import { downloadBlob } from '@/services/download';
import { useCatalog } from '@/composables/useCatalog';

type ID = number | string;
type ApiInit = Omit<RequestInit, 'body'> & { body?: any };

type UnitOpt = { id: ID; symbol: string; name?: string; is_currency?: boolean };
type ProductOpt = { id: ID; name: string; category?: any };

const addingItem = ref(false)

const addProductId = ref<ID | null>(null);
const addQty = ref<number>(1);
const addUnitId = ref<ID | null>(null);

function isKgUnit(unitId: ID | null) {
  if (!unitId) return false;
  const u = units.value.find(x => String(x.id) === String(unitId));
  const sym = (u?.symbol || '').toLowerCase().trim();
  const nam = (u?.name || '').toLowerCase().trim();

  // ajusta si en tu BD el símbolo es "Kg" o "KG"
  return sym === 'kg' || nam.includes('kilo') || nam.includes('kilogram');
}

function setFractionQty(fr: 0.5 | 0.25 | 0.125) {
  addQty.value = fr;
}

async function addItem() {
  if (!currentListId.value) return;

  if (!addProductId.value) return alert('Selecciona un producto');
  if (!addUnitId.value) return alert('Selecciona una unidad');

  const qty = Number(addQty.value);
  if (!qty || qty <= 0) return alert('Cantidad inválida');

  addingItem.value = true;
  try {
    const body = {
      product: Number(addProductId.value),
      unit: Number(addUnitId.value),
      qty,
    };

    await apiFetch(`/api/purchase-lists/${currentListId.value}/items/`, {
      method: 'POST',
      body, // ✅ body plano
    });

    // refresca items del modal (usa tu función actual)
    items.value = await loadItemsForList(currentListId.value);

    // limpia form
    addQty.value = 1;
    addProductId.value = null;
    addUnitId.value = null;

  } catch (e: any) {
    alert(String(e?.message || e?.detail || 'No se pudo agregar el item'));
  } finally {
    addingItem.value = false;
  }
}

const units = ref<UnitOpt[]>([]);
const products = ref<ProductOpt[]>([]);

async function loadUnits() {
  units.value = await apiFetch('/api/units/');
}

async function loadProducts() {
  products.value = await apiFetch('/api/products/');
}

const { categories: catalogCategories, load: loadCatalog } = useCatalog(); // mantenemos compat, aunque el modal usa categorías de la lista

function pad2(n:number){return n<10?`0${n}`:`${n}`;}
function fmtShort(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const y = d.getFullYear(), m = pad2(d.getMonth()+1), da = pad2(d.getDate());
  const hh = pad2(d.getHours()), mm = pad2(d.getMinutes());
  return `${y}-${m}-${da} | ${hh}:${mm}`;
}

type Row = {
  id: ID;
  restaurant: number | string;
  status: string;                 // 'final' | 'draft' | ...
  series_code: string | null;
  created_at: string;
  finalized_at: string | null;    // si es final, viene fecha
};

type ListItem = {
  id: ID;
  product_id: ID;
  product_name: string;
  unit_symbol: string | null;
  unit_is_currency: boolean;
  unit_id: ID | null;
  qty: number;
  price_soles: number | null;
  subtotal_soles?: number | null;
  quantity?: number
  price?: number | null
  subtotal?: number | null
};

const rows = ref<Row[]>([]);
const loading = ref(false);
const err = ref<string|null>(null);

async function load() {
  loading.value = true; err.value = null;
  try {
    const data = await apiFetch('/api/purchase-lists/');
    rows.value = data;
  } catch (e:any) {
    err.value = e?.message || 'No se pudo cargar';
  } finally { loading.value = false; }
}

function isFinal(r: Row) {
  return r.status?.toLowerCase() === 'final' || !!r.finalized_at;
}

/* ========== Descargar PDF (autenticado, usando apiFetchBlob) ========== */
function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_");
}

// PDF normal (con precios por defecto). Si hidePrices=true, agrega ?hide_prices=1
async function downloadPdf(row: Row, hidePrices = false): Promise<void> {
  try {
    const qs = hidePrices ? `?hide_prices=1` : ``;
    const path = `/api/purchase-lists/${row.id}/pdf/${qs}`;
    const blob = await apiFetchBlob(path); // incluye Authorization/cookies
    const suffix = hidePrices ? '-sin-precios' : '';
    const filename = safeFileName(`${row.series_code || `lista-${row.id}`}${suffix}.pdf`);
    downloadBlob(blob, filename);
  } catch (e:any) {
    alert(e?.message || 'No se pudo descargar el PDF');
  }
}

/* ========== PDF SIN PRECIOS (modal con UNA categoría opcional) ========== */
const pdfModalOpen = ref(false);
const pdfListId = ref<ID | null>(null)
const pdfSeriesCode = ref<string | null>(null);
const pdfCategories = ref<{ id: ID; name: string }[]>([]);
const selectedCategoryId = ref<ID | ''>('');

/** Extrae las categorías ÚNICAS presentes en los items de una lista */
async function fetchCategoriesFromItems(listId: ID) {
  const uniq = new Map<ID, string>();
  try {
    const data = await apiFetch(
      `/api/purchase-list-items/?purchase_list=${listId}&_=${Date.now()}`,
      { cache: 'no-store' } as any
    );
    for (const it of (data || [])) {
      const cid: ID | null =
        it.category_id ??
        it.category?.id ??
        it.categoryId ??
        it.category ??
        it.product?.category_id ??
        it.product?.category?.id ??
        null;

      const cname: string =
        it.category?.name ??
        it.category_name ??
        it.categoryName ??
        it.product?.category_name ??
        it.product?.category?.name ??
        "";

      if (cid != null && cname) uniq.set(cid, cname);
    }
  } catch { /* ignore */ }

  const arr = Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
  arr.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return arr;
}

/** Pide categorías por restaurant directamente al backend */
async function fetchCategoriesByRestaurant(restaurantId: ID) {
  try {
    const data = await apiFetch(`/api/categories/?restaurant=${restaurantId}`);
    const arr = (data || [])
      .map((c: any) => ({ id: c.id, name: c.name }))
      .sort((a:any,b:any)=>String(a.name).localeCompare(String(b.name)));
    return arr;
  } catch {
    return [];
  }
}

/** Carga categorías para el modal: Ítems -> Restaurante -> (último) todas las categorías sin filtro */
async function fetchCategoriesForList(listId: ID, restaurantHint?: ID) {
  // 1) por ítems
  const byItems = await fetchCategoriesFromItems(listId);
  if (byItems.length > 0) return byItems;

  // 2) por detalle (para obtener restaurant id fiable)
  let restaurantId: ID | undefined = restaurantHint as any;
  try {
    const detail = await apiFetch(`/api/purchase-lists/${listId}/`);
    restaurantId =
      detail?.restaurant ??
      detail?.restaurant_id ??
      restaurantHint;
  } catch { /* ignore */ }

  // 3) por restaurant
  if (restaurantId != null && restaurantId !== '') {
    const byR = await fetchCategoriesByRestaurant(restaurantId);
    if (byR.length > 0) return byR;
  }

  // 4) último recurso: traer todas (sin filtro)
  try {
    const all = await apiFetch(`/api/categories/`);
    const arr = (all || [])
      .map((c: any) => ({ id: c.id, name: c.name }))
      .sort((a:any,b:any)=>String(a.name).localeCompare(String(b.name)));
    return arr;
  } catch {
    return [];
  }
}

async function fallbackCategoriesForRestaurant(restaurantId: ID) {
  // 1) intenta usar el catálogo en memoria
  if (!catalogCategories.value || catalogCategories.value.length === 0) {
    try { await loadCatalog(); } catch {}
  }
  const inMemory = (catalogCategories.value || [])
    .filter((c: any) =>
      // intenta varias llaves comunes
      (c.restaurant === restaurantId) ||
      (c.restaurant_id === restaurantId) ||
      (String(c.restaurant_id ?? c.restaurant ?? '') === String(restaurantId))
    )
    .map((c: any) => ({ id: c.id, name: c.name }))
    .sort((a:any,b:any)=>String(a.name).localeCompare(String(b.name)));
  if (inMemory.length > 0) return inMemory;

  // 2) si no hay en memoria, pide al backend
  try {
    const data = await apiFetch(`/api/categories/?restaurant=${restaurantId}`);
    return (data || [])
      .map((c: any) => ({ id: c.id, name: c.name }))
      .sort((a:any,b:any)=>String(a.name).localeCompare(String(b.name)));
  } catch {
    return [];
  }
}

async function openPdfModal(r: Row) {
  pdfListId.value = r.id;
  pdfSeriesCode.value = r.series_code || null;
  pdfModalOpen.value = true;
  selectedCategoryId.value = '';

  try {
// Carga robusta (ítems -> restaurant -> todas)
   pdfCategories.value = await fetchCategoriesForList(r.id, r.restaurant);
 } catch {
   pdfCategories.value = [];
 }
}

async function confirmPdf() {
  if (!pdfListId.value) return;
  try {
    const qs = new URLSearchParams();
    qs.set("hide_prices","1");
    if (selectedCategoryId.value !== '') {
      const cid = String(selectedCategoryId.value);
      qs.set("category_id", cid);
      qs.set("category_ids", cid); // CSV con 1 id, por compat
    }

    const path = `/api/purchase-lists/${pdfListId.value}/pdf/?${qs.toString()}`;
    const blob = await apiFetchBlob(path);
    const catSuffix = selectedCategoryId.value ? `-cat-${selectedCategoryId.value}` : "";
    const filename = safeFileName(`${(pdfSeriesCode.value || `lista-${pdfListId.value}`)}-sin-precios${catSuffix}.pdf`);
    downloadBlob(blob, filename);
  } catch (e:any) {
    alert(e?.message || "No se pudo descargar el PDF");
  } finally {
    pdfModalOpen.value = false;
  }
}

/* ========== Completar precios (solo listas NO finales) + Observaciones dentro del modal ========== */
const priceModalOpen = ref(false);
const currentListId  = ref<ID | null>(null);
const items          = ref<ListItem[]>([]);
const savingPrices   = ref(false);

// Observaciones (solo en el modal de precios)
const obsText = ref<string>('');
const obsFieldKey = ref<'observation'|'notes'|'note'>('observation');

async function loadItemsForList(listId: ID): Promise<ListItem[]> {
  const data = await apiFetch(
    `/api/purchase-list-items/?purchase_list=${listId}&_=${Date.now()}`,
    { cache: 'no-store' } as any
  );
  return (data || []).map((it: any) => ({
    id: it.id,
    product_id: it.product ?? it.product_id,
    product_name: it.product_name ?? it.product_label ?? '',
    unit_symbol: it.unit_symbol ?? it.unit?.symbol ?? null,
    unit_is_currency: !!(it.unit_is_currency ?? it.unit?.is_currency),
    unit_id: it.unit_id ?? it.unit?.id ?? null,
    qty: Number(it.qty ?? 0),
    price_soles: it.price_soles == null ? null : Number(it.price_soles),
    subtotal_soles: it.subtotal_soles == null ? null : Number(it.subtotal_soles),
    quantity: Number(it.qty ?? 0),
    price: it.price_soles == null ? null : Number(it.price_soles),
    subtotal: it.subtotal_soles == null ? 0 : Number(it.subtotal_soles),
  }));
}

async function deleteItem(it: ListItem) {
  if (!confirm(`¿Eliminar "${it.product_name}" de la lista?`)) return;
  try {
    await apiFetch(`/api/purchase-list-items/${it.id}/`, { method: 'DELETE' });
    // quitarlo del array local
    items.value = items.value.filter((x:any) => x.id !== it.id);
  } catch (e:any) {
    const msg = String(e?.message || e?.detail || '')
    const status = (e?.status || e?.response?.status)

    if (status === 403 || msg.includes('403')) {
      alert('⚠️ Esta lista ya está cerrada y no puede modificarse.')
      priceModalOpen.value = false
      await load()
      return
    }
    alert(e?.message || 'No se pudo eliminar el item');
  }
}

async function loadListDetail(listId: ID) {
  try {
    const detail = await apiFetch(`/api/purchase-lists/${listId}/`);
    const key = (('observation' in detail) && 'observation')
      || (('notes' in detail) && 'notes')
      || (('note' in detail) && 'note')
      || 'observation';
    obsFieldKey.value = key as any;
    obsText.value = detail[key] ?? '';
  } catch {
    obsText.value = '';
  }
}

async function openEditorModal(r: Row) {
  currentListId.value = r.id;
  priceModalOpen.value = true;
  items.value = [];
  await Promise.all([
    (async () => { 
      items.value = (await loadItemsForList(r.id)).map((it:any) => ({
        id: it.id,
        product_id: it.product_id ?? it.product,
        product_name: it.product_name ?? it.product_label ?? '',
        unit_symbol: it.unit_symbol ?? it.unit?.symbol ?? null,
        unit_is_currency: !!(it.unit_is_currency ?? it.unit?.is_currency),
        unit_id: it.unit_id ?? it.unit?.id ?? null,
        qty: Number(it.qty),
        price_soles: it.price_soles ?? null,
        subtotal_soles: it.subtotal_soles ?? null,
        quantity: Number(it.qty),
        price: it.price_soles ?? null,
        subtotal: it.subtotal_soles ?? null,
      }));
    })(),
    loadListDetail(r.id),
  ]);
}

async function savePrices() {
  if (!currentListId.value) return;
  savingPrices.value = true;

  try {
    const listId = currentListId.value;

    // 1) Guardar ítems
    const results = await Promise.allSettled(
      items.value.map((it: any) => {
        const price =
          it.price_soles === "" || it.price_soles === undefined
            ? null
            : Number(it.price_soles);
        const quantity =
          it.qty === "" || it.qty === undefined ? null : Number(it.qty);

        const body: any = {
          price, price_soles: price,
          quantity, qty: quantity,
          unit_id: it.unit_id,
          unit: it.unit_id, // compat si tu serializer usa "unit"
        };
        return apiFetch(`/api/purchase-list-items/${it.id}/`, {
          method: "PATCH",
          body,
        } as ApiInit);
      })
    );

    const failed = results.filter(r => r.status === "rejected");
    if (failed.length) {
      console.error("Fallos al guardar ítems:", failed);
      throw new Error("Uno o más ítems no se pudieron guardar.");
    }

    // 2) Observaciones de la lista
    await apiFetch(`/api/purchase-lists/${listId}/`, {
      method: "PATCH",
      body: (
        obsFieldKey.value === 'observation'
          ? { observation: obsText.value ?? "" }
          : { observation: obsText.value ?? "", [obsFieldKey.value]: obsText.value ?? "" }
      ),
    } as ApiInit);

    // 3) Recargar ítems desde el backend
    const fresh = await apiFetch(`/api/purchase-list-items/?purchase_list=${listId}`);
    items.value = (fresh || []).map((it: any) => ({
      id: it.id,
      product_id: it.product ?? it.product_id,
      product_name: it.product_name ?? "",
      unit_symbol: it.unit_symbol ?? it.unit?.symbol ?? null,
      qty: Number(it.qty ?? 0),
      price_soles: it.price_soles == null ? null : Number(it.price_soles),
      subtotal_soles: it.subtotal_soles == null ? null : Number(it.subtotal_soles),
      quantity: Number(it.qty ?? 0),
      price: it.price_soles == null ? null : Number(it.price_soles),
      subtotal: Number(it.subtotal_soles ?? 0),
    }));

    // 4) Cerrar modal y refrescar la grilla
    priceModalOpen.value = false;
    await load();
  } catch (e: any) {
    console.error(e);
    alert(e?.message || "No se pudieron guardar los cambios");
  } finally {
    savingPrices.value = false;
  }
}

onMounted(async () => {
  await Promise.all([load(), loadUnits(), loadProducts(), loadCatalog()]);
});
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold mb-4">Historial de listas</h1>

    <p v-if="loading">Cargando…</p>
    <p v-else-if="err" class="text-red-600">{{ err }}</p>

    <div v-else>
      <table class="w-full border-collapse">
        <thead>
          <tr class="text-left">
            <th class="border-b p-2">Serie</th>
            <th class="border-b p-2">Estado</th>
            <th class="border-b p-2">Creada</th>
            <th class="border-b p-2">Finalizada</th>
            <th class="border-b p-2 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="border-b">
            <td class="p-2">{{ r.series_code || '(sin serie)' }}</td>
            <td class="p-2">{{ r.status }}</td>
            <td class="p-2">{{ fmtShort(r.created_at) }}</td>
            <td class="p-2">{{ fmtShort(r.finalized_at) }}</td>
            <td class="p-2 text-center space-x-3">
              <!-- Si la lista está FINAL: solo PDF normal (con precios) -->
              <a v-if="isFinal(r)"
                class="text-blue-600 cursor-pointer"
                @click="downloadPdf(r)"
              >
                PDF
              </a>

              <!-- Si la lista NO está final: Completar la lista + PDF sin precios -->
              <template v-else>
                <a class="text-emerald-600 cursor-pointer"
                  @click="openEditorModal(r)"
                >
                  Modificar Lista
                </a>
                <span class="mx-1">·</span>
                <a class="text-indigo-600 cursor-pointer"
                  @click="openPdfModal(r)"
                >
                  PDF sin precios
                </a>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Completar precios + Observaciones -->
    <div v-if="priceModalOpen" class="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div class="bg-white rounded-2xl p-5 w-[900px] max-h-[85vh] overflow-auto shadow">
        <h3 class="text-lg mb-3">Editar lista</h3>

        <table class="w-full border mb-4">
          <thead>
            <tr class="bg-gray-100">
              <th class="p-2 border text-left">Producto</th>
              <th class="p-2 border text-center">Unidad</th>
              <th class="p-2 border text-right">Cantidad</th>
              <th class="p-2 border text-right">Precio (S/)</th>
              <th class="p-2 border text-right">Subtotal (S/)</th>
              <th class="p-2 border text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.id">
              <td class="p-2 border">{{ it.product_name }}</td>
              <td class="p-2 border text-center">
                <select
                  v-model="it.unit_id"
                  class="border rounded p-1 w-full"
                >
                  <option :value="null" disabled>Unidad</option>
                  <option
                    v-for="u in units"
                    :key="u.id"
                    :value="u.id"
                  >
                    {{ u.symbol || u.name }}
                  </option>
                </select>
              </td>

              <!-- Cantidad -->
              <td class="p-2 border text-right">
                <template v-if="it.unit_is_currency">
                  <input
                    type="number"
                    step="0.01"
                    class="border rounded p-1 w-28 text-right"
                    v-model.number="it.qty"
                  />
                </template>
                <template v-else>
                  {{ it.qty }}
                </template>
              </td>

              <!-- Precio -->
              <td class="p-2 border text-right">
                <template v-if="!it.unit_is_currency">
                  <input
                    type="number"
                    step="0.01"
                    class="border rounded p-1 w-28 text-right"
                    v-model.number="it.price_soles"
                  />
                </template>
                <template v-else>
                  <span class="text-gray-400">—</span>
                </template>
              </td>

              <!-- Subtotal -->
              <td class="p-2 border text-right">
                {{
                  (
                    it.subtotal_soles
                      ?? (
                        it.unit_is_currency
                          ? Number(it.qty ?? 0)
                          : Number(it.price_soles ?? 0) * Number(it.qty ?? 0)
                      )
                  ).toFixed(2)
                }}
              </td>
              <td class="p-2 border text-center">
                <button
                  class="text-red-600 hover:underline"
                  @click="deleteItem(it)"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Agregar producto -->
        <div class="mt-4 border-t pt-4">
          <h4 class="font-semibold mb-2">Agregar producto</h4>

          <div class="flex gap-2 items-center flex-wrap">
            <select class="border rounded p-2 min-w-[260px]" v-model="addProductId">
              <option :value="null" disabled>Selecciona producto</option>
              <option v-for="p in products" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>

            <div class="flex flex-col gap-1">
              <input
                type="number"
                step="0.01"
                class="border rounded p-2 w-28 text-right"
                v-model.number="addQty"
                placeholder="Qty"
              />

              <!-- Presets SOLO cuando unidad sea KG -->
              <div v-if="isKgUnit(addUnitId)" class="flex gap-2">
                <button type="button" class="border rounded px-2 py-1 text-xs" @click="setFractionQty(0.5)">1/2</button>
                <button type="button" class="border rounded px-2 py-1 text-xs" @click="setFractionQty(0.25)">1/4</button>
                <button type="button" class="border rounded px-2 py-1 text-xs" @click="setFractionQty(0.125)">1/8</button>
              </div>
            </div>

            <select class="border rounded p-2 w-40" v-model="addUnitId">
              <option :value="null" disabled>Unidad</option>
              <option v-for="u in units" :key="u.id" :value="u.id">
                {{ u.symbol || u.name }}
              </option>
            </select>

            <button
              class="bg-emerald-600 text-white rounded px-3 py-2"
              :disabled="addingItem"
              @click="addItem"
            >
              {{ addingItem ? 'Agregando...' : 'Agregar' }}
            </button>
          </div>
        </div>

        <!-- Observaciones SOLO aquí -->
        <div class="mb-4">
          <label class="block font-medium mb-1">Observaciones</label>
          <textarea
            v-model="obsText"
            rows="5"
            class="w-full border rounded p-2"
            placeholder="Escribe aquí las observaciones de la lista..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-2">
          <button class="px-3 py-2 border rounded" @click="priceModalOpen = false">Cerrar</button>
          <button
            class="px-3 py-2 rounded text-white"
            :class="savingPrices ? 'bg-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'"
            :disabled="savingPrices"
            @click="savePrices"
          >
            {{ savingPrices ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal PDF sin precios (una categoría opcional) -->
  <div v-if="pdfModalOpen" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Generar PDF sin precios</h2>
        <button class="text-gray-500" @click="pdfModalOpen = false">✕</button>
      </div>
      <div class="space-y-3">
        <p class="text-sm text-gray-600">
          Puedes descargar el PDF sin precios de toda la lista o seleccionar una categoría específica.
        </p>

        <div>
          <label class="block text-xs text-gray-500 mb-1">Categoría (opcional)</label>
          <select
            v-model="selectedCategoryId"
            class="border rounded px-2 py-2 w-full text-sm"
          >
            <option value="">— Todas las categorías —</option>
            <option v-for="c in pdfCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <button class="px-3 py-2 border rounded" @click="pdfModalOpen = false">Cancelar</button>
        <button class="px-3 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700" @click="confirmPdf">
          Descargar PDF
        </button>
      </div>
    </div>
  </div>
</template>
