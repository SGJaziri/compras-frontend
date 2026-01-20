<!-- src/pages/Lists/ReportsDownload.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { apiFetch, absoluteApiUrl, apiFetchBlob } from "@/services/http";
import { downloadBlob } from "@/services/download";

type ID = number | string;

type ReportItem = {
  date: string;
  restaurant_id: ID | null;
  restaurant_name: string;
  category_id: ID | null;
  category_name: string;
  product_id: ID | null;
  product_name: string;
  unit_symbol: string | null;
  qty: number;
  qty_display?: string | null
  price_soles: number | null;
  subtotal_soles: number;
};

// ====== filtros ======
const start = ref<string>("");
const end   = ref<string>("");
const onlyFinal = ref<boolean>(true);

// ====== vista ======
const activeView = ref<"summary" | "detail">("detail");

// ====== datos ======
const loading = ref(false);
const error   = ref<string | null>(null);
const rawData = ref<any>([]);

// ====== aplanado desde restaurants -> categories -> lines ======
function extractItems(json: any): ReportItem[] {
  if (Array.isArray(json)) return json.map(safeMapFlat).filter(Boolean) as ReportItem[];
  if (json && Array.isArray(json.items))   return json.items.map(safeMapFlat).filter(Boolean) as ReportItem[];
  if (json && Array.isArray(json.results)) return json.results.map(safeMapFlat).filter(Boolean) as ReportItem[];
  if (json && Array.isArray(json.data))    return json.data.map(safeMapFlat).filter(Boolean) as ReportItem[];

  if (json && Array.isArray(json.restaurants)) {
    const out: ReportItem[] = [];
    for (const r of json.restaurants) {
      const rName = String(r?.restaurant ?? r?.restaurant_name ?? "—");
      const rId   = r?.id ?? r?.restaurant_id ?? null;
      const cats  = Array.isArray(r?.categories) ? r.categories : [];
      for (const c of cats) {
        const cName = String(c?.category ?? c?.category_name ?? "—");
        const cId   = c?.id ?? c?.category_id ?? null;
        const lines = Array.isArray(c?.lines) ? c.lines : [];
        for (const it of lines) {
          out.push(mapLine(it, rId, rName, cId, cName));
        }
      }
    }
    return out;
  }

  if (json && json.detail)  return extractItems(json.detail);
  if (json && json.summary) return extractItems(json.summary);
  return [];
}

function safeMapFlat(x: any): ReportItem | null {
  if (!x || typeof x !== "object") return null;
  const date           = String(x.created_at ?? x.date ?? x.day ?? "");
  const restaurant_id  = x.restaurant_id ?? x.rid ?? null;
  const restaurant_name= String(x.restaurant_name ?? x.restaurant ?? x.rname ?? "—");
  const category_id    = x.category_id ?? x.cid ?? null;
  const category_name  = String(x.category_name ?? x.category ?? x.cname ?? "—");
  const product_id     = x.product_id ?? x.pid ?? null;
  const product_name   = String(x.product_name ?? x.product ?? x.pname ?? "—");
  const unit_symbol    = x.unit_symbol ?? x.unit ?? x.usym ?? null;
  const qty            = Number(x.qty ?? x.quantity ?? 0);
  const qty_display    = (x as any).qty_display ?? null
  const price_soles    = x.price_soles == null ? (x.price ?? null) : Number(x.price_soles);
  const subtotal_raw   = x.subtotal_soles ?? x.subtotal ?? (qty * (price_soles ?? 0));
  const subtotal_soles = Number(subtotal_raw ?? 0);

  return {
    date,
    restaurant_id,
    restaurant_name,
    category_id,
    category_name,
    product_id,
    product_name,
    unit_symbol: unit_symbol == null ? null : String(unit_symbol),
    qty,
    qty_display,
    price_soles: price_soles == null ? null : Number(price_soles),
    subtotal_soles,
  };
}

function mapLine(it: any, rId: ID | null, rName: string, cId: ID | null, cName: string): ReportItem {
  const date         = String(it?.created_at ?? it?.date ?? it?.day ?? "");
  const product_id   = it?.product_id ?? it?.pid ?? null;
  const product_name = String(it?.product ?? it?.product_name ?? it?.pname ?? "—");
  const unit_symbol  = it?.unit ?? it?.unit_symbol ?? it?.usym ?? null;
  const qty          = Number(it?.qty ?? it?.quantity ?? 0);
  const price_soles  = it?.price == null ? (it?.price_soles ?? null) : Number(it?.price);
  const subtotal_raw = it?.subtotal ?? it?.subtotal_soles ?? (qty * (price_soles ?? 0));
  const subtotal_soles = Number(subtotal_raw ?? 0);

  return {
    date,
    restaurant_id: rId,
    restaurant_name: rName,
    category_id: cId,
    category_name: cName,
    product_id,
    product_name,
    unit_symbol: unit_symbol == null ? null : String(unit_symbol),
    qty,
    price_soles: price_soles == null ? null : Number(price_soles),
    subtotal_soles,
  };
}

const items = computed<ReportItem[]>(() => extractItems(rawData.value));

// ====== helpers fechas ======
function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function setWeek() {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  start.value = toISO(monday);
  end.value   = toISO(sunday);
}
function setMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  start.value = toISO(first);
  end.value   = toISO(last);
}

// ====== fetch ======
async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const url = `/api/purchase-lists/export/range/?start=${start.value}&end=${end.value}&only_final=${onlyFinal.value ? "true" : "false"}`;
    rawData.value = await apiFetch(url);
  } catch (e: any) {
    error.value = e?.message ?? "Error al cargar reportes";
    rawData.value = [];
  } finally {
    loading.value = false;
  }
}

// ====== agrupadores y totales ======
type Grouped = Record<string, ReportItem[]>;

function groupBy<T extends keyof ReportItem>(key: T, rows: ReportItem[]): Record<string, ReportItem[]> {
  return rows.reduce((acc, r) => {
    const k = String(r[key] ?? "");
    (acc[k] ||= []).push(r);
    return acc;
  }, {} as Grouped);
}

const summaryByRestaurant = computed(() => {
  const out: Record<string, { total: number; categories: Record<string, number> }> = {};
  for (const it of items.value) {
    const rName = it.restaurant_name;
    const cName = it.category_name;
    const sub = Number(it.subtotal_soles ?? 0);
    if (!out[rName]) out[rName] = { total: 0, categories: {} };
    out[rName].total += sub;
    out[rName].categories[cName] = (out[rName].categories[cName] ?? 0) + sub;
  }
  return out;
});

const generalTotal = computed(() =>
  items.value.reduce((s, it) => s + Number(it.subtotal_soles ?? 0), 0)
);

// ====== PDF ======  (con auth → blob y descarga directa)

const pdfBase = `/api/purchase-lists/export/range/pdf/`; // ← única declaración

function buildPdfUrl(mode: "summary" | "detail") {
  const qs = new URLSearchParams({
    start: start.value,
    end: end.value,
    only_final: onlyFinal.value ? "true" : "false",
    mode,
  });
  return absoluteApiUrl(`${pdfBase}?${qs.toString()}`);
}

async function openPDF() {
  const mode = activeView.value === "summary" ? "summary" : "detail";
  const url = buildPdfUrl(mode);

  try {
    const blob = await apiFetchBlob(url); // manda Authorization
    const filename = `reporte_${mode}_${start.value}_a_${end.value}.pdf`;
    downloadBlob(blob, filename);         // ↓ descarga directa
  } catch (e: any) {
    error.value = e?.message || "No se pudo generar el PDF";
  }
}

// ====== init ======
onMounted(() => {
  setMonth();
  fetchData();
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-semibold mb-4">Descargar reportes</h1>

    <!-- Filtros -->
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <div>
        <label class="block text-sm mb-1">Inicio</label>
        <input type="date" v-model="start" class="border rounded px-3 py-2" />
      </div>
      <div>
        <label class="block text-sm mb-1">Fin</label>
        <input type="date" v-model="end" class="border rounded px-3 py-2" />
      </div>

      <button
        class="px-3 py-2 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
        @click="setWeek">
        Semana actual
      </button>
      <button
        class="px-3 py-2 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
        @click="setMonth">
        Mes actual
      </button>

      <label class="inline-flex items-center gap-2 ml-2">
        <input type="checkbox" v-model="onlyFinal" />
        <span>Solo listas finalizadas</span>
      </label>

      <button class="ml-auto px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
              @click="fetchData" :disabled="loading">
        {{ loading ? "Cargando..." : "Ver " + (activeView==='summary' ? 'reporte' : 'reporte') }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-3">
      <button
        class="px-3 py-1 rounded border"
        :class="activeView==='summary' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'"
        @click="activeView='summary'">
        Resumen
      </button>
      <button
        class="px-3 py-1 rounded border"
        :class="activeView==='detail' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'"
        @click="activeView='detail'">
        Detalle
      </button>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>

    <!-- Vista Resumen -->
    <div v-if="activeView==='summary'">
      <div v-if="loading">Cargando resumen…</div>
      <div v-else class="flex flex-col gap-4">
        <div
          v-for="(obj, restName) in summaryByRestaurant"
          :key="String(restName)"
          class="rounded border p-4 bg-white"
        >
          <div class="flex items-start justify-between mb-2 text-gray-900">
            <h3 class="font-semibold text-lg">{{ restName }}</h3>
            <div class="text-right">
              <div class="text-xs text-gray-500">Total restaurante</div>
              <div class="text-2xl font-extrabold">S/ {{ obj.total.toFixed(2) }}</div>
            </div>
          </div>

          <ul class="list-disc pl-5">
            <li v-for="(subtotal, catName) in obj.categories" :key="String(catName)" class="text-gray-900">
              <span class="font-medium">{{ catName }}</span>
              <span class="text-gray-500"> — </span>
              <span class="font-semibold">S/ {{ subtotal.toFixed(2) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="Object.keys(summaryByRestaurant).length===0" class="text-sm text-gray-500">
          No hay datos en el rango seleccionado.
        </div>
      </div>
    </div>

    <!-- Vista Detalle -->
    <div v-else>
      <div v-if="loading">Cargando detalle…</div>
      <div v-else class="flex flex-col gap-6">
        <div v-for="(rowsByRestaurant, rKey) in groupBy('restaurant_name', items)" :key="String(rKey)"
             class="rounded border bg-white">
          <div class="p-4 border-b text-gray-900">
            <h3 class="font-semibold text-lg">Restaurante: {{ rKey }}</h3>
          </div>

          <div class="p-4 flex flex-col gap-6">
            <div v-for="(rowsByCategory, cKey) in groupBy('category_name', rowsByRestaurant)" :key="String(cKey)">
              <h4 class="font-medium mb-2 text-gray-900">Categoría: {{ cKey }}</h4>
              <div class="overflow-x-auto">
                <table class="min-w-full border">
                  <thead>
                    <tr class="bg-gray-50">
                      <th class="border px-3 py-2 text-left">Fecha</th>
                      <th class="border px-3 py-2 text-left">Producto</th>
                      <th class="border px-3 py-2 text-left">Unidad</th>
                      <th class="border px-3 py-2 text-right">Cantidad</th>
                      <th class="border px-3 py-2 text-right">Precio</th>
                      <th class="border px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in rowsByCategory" :key="row.date + '-' + (row.product_id ?? row.product_name)">
                      <td class="border px-3 py-2">{{ row.date }}</td>
                      <td class="border px-3 py-2">{{ row.product_name }}</td>
                      <td class="border px-3 py-2">{{ row.unit_symbol || '' }}</td>
                      <td class="border px-3 py-2 text-right">{{ row.qty_display ?? row.qty }}</td>
                      <td class="border px-3 py-2 text-right">{{ row.price_soles ?? '-' }}</td>
                      <td class="border px-3 py-2 text-right">{{ Number(row.subtotal_soles ?? 0).toFixed(2) }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="text-gray-900">
                      <td class="border px-3 py-2 text-right font-semibold" colspan="5">Subtotal categoría</td>
                      <td class="border px-3 py-2 text-right font-semibold">
                        {{ rowsByCategory.reduce((s, r) => s + Number(r.subtotal_soles ?? 0), 0).toFixed(2) }}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div class="text-right font-semibold text-gray-900">
              Total restaurante:
              S/
              {{ rowsByRestaurant.reduce((s, r) => s + Number(r.subtotal_soles ?? 0), 0).toFixed(2) }}
            </div>
          </div>
        </div>

        <div v-if="items.length===0" class="text-sm text-gray-500">
          No hay datos en el rango seleccionado.
        </div>
      </div>
    </div>

    <!-- Total general -->
    <div class="mt-4 mb-2 rounded border bg-white p-4 flex items-center justify-end text-gray-900">
      <div class="text-right">
        <div class="text-xs text-gray-500">Total general</div>
        <div class="text-3xl font-extrabold">S/ {{ generalTotal.toFixed(2) }}</div>
      </div>
    </div>

    <!-- Acciones -->
    <div class="mt-2">
      <button class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              @click="openPDF">
        Descargar reporte (PDF)
      </button>
    </div>
  </div>
</template>

<style scoped>
/* estilos mínimos para coherencia visual */
</style>
