<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { apiFetch, absoluteApiUrl, apiFetchBlob } from "@/services/http";
import MultiCheckDropdown from "@/components/MultiCheckDropdown.vue";
import { downloadBlob } from "@/services/download";
import { appendMulti } from "@/services/pdfFilters";

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
  price_soles: number | null;
  subtotal_soles: number;
};

/* ===== filtros base ===== */
const start = ref<string>(""); const end = ref<string>(""); const onlyFinal = ref<boolean>(true);

/* ===== multiselección de categorías ===== */
type CatOpt = { id: ID; name: string };
const selectedCategoryIds = ref<ID[]>([]);   // ← múltiples

/* ===== estado/datos ===== */
const loading = ref(false); const error = ref<string|null>(null);
const rawData = ref<any>([]);

/* ===== util aplanado (igual al base) ===== */
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
        for (const it of lines) out.push(mapLine(it, rId, rName, cId, cName));
      }
    }
    return out;
  }
  if (json?.detail)  return extractItems(json.detail);
  if (json?.summary) return extractItems(json.summary);
  return [];
}
function safeMapFlat(x: any): ReportItem | null {
  if (!x || typeof x !== "object") return null;
  const date = String(x.created_at ?? x.date ?? x.day ?? "");
  const restaurant_id   = x.restaurant_id ?? x.rid ?? null;
  const restaurant_name = String(x.restaurant_name ?? x.restaurant ?? x.rname ?? "—");
  const category_id     = x.category_id ?? x.cid ?? null;
  const category_name   = String(x.category_name ?? x.category ?? x.cname ?? "—");
  const product_id      = x.product_id ?? x.pid ?? null;
  const product_name    = String(x.product_name ?? x.product ?? x.pname ?? "—");
  const unit_symbol     = x.unit_symbol ?? x.unit ?? x.usym ?? null;
  const qty             = Number(x.qty ?? x.quantity ?? 0);
  const price_soles     = x.price_soles == null ? (x.price ?? null) : Number(x.price_soles);
  const subtotal_raw    = x.subtotal_soles ?? x.subtotal ?? (qty * (price_soles ?? 0));
  const subtotal_soles  = Number(subtotal_raw ?? 0);
  return {
    date, restaurant_id, restaurant_name, category_id, category_name,
    product_id, product_name, unit_symbol: unit_symbol == null ? null : String(unit_symbol),
    qty, price_soles: price_soles == null ? null : Number(price_soles), subtotal_soles,
  };
}
function mapLine(it: any, rId: ID|null, rName: string, cId: ID|null, cName: string): ReportItem {
  const date        = String(it?.created_at ?? it?.date ?? it?.day ?? "");
  const product_id  = it?.product_id ?? it?.pid ?? null;
  const product_name= String(it?.product ?? it?.product_name ?? it?.pname ?? "—");
  const unit_symbol = it?.unit ?? it?.unit_symbol ?? it?.usym ?? null;
  const qty         = Number(it?.qty ?? it?.quantity ?? 0);
  const price_soles = it?.price == null ? (it?.price_soles ?? null) : Number(it?.price);
  const subtotal_raw= it?.subtotal ?? it?.subtotal_soles ?? (qty * (price_soles ?? 0));
  const subtotal_soles = Number(subtotal_raw ?? 0);
  return {
    date, restaurant_id: rId, restaurant_name: rName, category_id: cId, category_name: cName,
    product_id, product_name, unit_symbol: unit_symbol == null ? null : String(unit_symbol),
    qty, price_soles: price_soles == null ? null : Number(price_soles), subtotal_soles,
  };
}

const items = computed<ReportItem[]>(() => extractItems(rawData.value));

/* ===== fechas ===== */
function toISO(d: Date) { return d.toISOString().slice(0,10); }
function setWeek() { const n=new Date(); const day=n.getDay()||7; const mon=new Date(n); mon.setDate(n.getDate()-(day-1)); const sun=new Date(mon); sun.setDate(mon.getDate()+6); start.value=toISO(mon); end.value=toISO(sun); }
function setMonth(){ const n=new Date(); start.value=toISO(new Date(n.getFullYear(),n.getMonth(),1)); end.value=toISO(new Date(n.getFullYear(),n.getMonth()+1,0)); }

/* ===== fetch ===== */
async function fetchData() {
  loading.value = true; error.value = null;
  try {
    const url = `/api/purchase-lists/export/range/?start=${start.value}&end=${end.value}&only_final=${onlyFinal.value ? "true" : "false"}`;
    rawData.value = await apiFetch(url);
  } catch (e: any) {
    error.value = e?.message ?? "Error al cargar reportes"; rawData.value = [];
  } finally { loading.value = false; }
}

/* ===== opciones categorías (con respaldo por nombre si falta id) ===== */
const categoryOptions = computed<CatOpt[]>(() => {
  const m = new Map<string, string>(); // clave estable: preferir id; si no hay, usar nombre
  for (const it of items.value) {
    const key = (it.category_id ?? it.category_name ?? "—").toString();
    const name = it.category_name || "—";
    if (!m.has(key)) m.set(key, name);
  }
  return Array.from(m, ([id, name]) => ({ id, name })).sort((a,b)=>a.name.localeCompare(b.name));
});

/* ===== filtrado múltiple ===== */
const filteredItems = computed(() => {
  if (selectedCategoryIds.value.length === 0) return items.value; // “todas”
  const set = new Set(selectedCategoryIds.value.map(String));
  return items.value.filter(r => set.has(String(r.category_id ?? r.category_name)));
});

/* ===== agrupadores/totales ===== */
type Grouped = Record<string, ReportItem[]>;
function groupBy<T extends keyof ReportItem>(key: T, rows: ReportItem[]): Grouped {
  return rows.reduce((acc, r) => { const k = String(r[key] ?? ""); (acc[k] ||= []).push(r); return acc; }, {} as Grouped);
}
const generalTotal = computed(() => filteredItems.value.reduce((s, it) => s + Number(it.subtotal_soles ?? 0), 0));

// ===== PDF (GET con filtros) =====
const pdfBase = `/api/purchase-lists/export/range/pdf/`;

function buildPdfUrlWithFilters() {
  const qs = new URLSearchParams({
    start: start.value,
    end: end.value,
    only_final: onlyFinal.value ? "true" : "false",
    mode: "detail",
  });

  const selected = selectedCategoryIds.value.map(v => String(v));
  if (selected.length) {
    // Mapa id->name desde las opciones ya cargadas
    const idToName = new Map(categoryOptions.value.map(o => [String(o.id), o.name]));
    const ids   = selected.filter(s => /^\d+$/.test(s));
    const names = selected.map(s => idToName.get(s) ?? s);

    // IDs (varios alias)
    appendMulti(qs, "category_ids", "category_id", ids);
    appendMulti(qs, "categories",   "category_ids[]", ids); // compat extra

    // Nombres (varios alias)
    appendMulti(qs, "category_names",  "category", names);
    appendMulti(qs, "categories_names","category[]", names); // compat extra
  }

  return absoluteApiUrl(`${pdfBase}?${qs.toString()}`);
}

async function openPDF() {
  try {
    const url  = buildPdfUrlWithFilters();
    const blob = await apiFetchBlob(url); // SOLO GET
    const filename =
      `reporte_categorias_${start.value}_a_${end.value}` +
      (selectedCategoryIds.value.length ? `_filtrado` : ``) + `.pdf`;
    downloadBlob(blob, filename);
  } catch (e:any) {
    error.value = e?.message || "No se pudo generar el PDF";
  }
}

/* ===== init ===== */
onMounted(()=>{ setMonth(); fetchData(); });
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-semibold mb-4">Reportes por categoría</h1>

    <!-- Filtros -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <!-- Columna izquierda: fechas + quick actions debajo -->
        <div class="flex flex-col gap-3">
            <div class="flex gap-3">
            <div>
                <label class="block text-sm mb-1">Inicio</label>
                <input type="date" v-model="start" class="border rounded px-3 py-2" />
            </div>
            <div>
                <label class="block text-sm mb-1">Fin</label>
                <input type="date" v-model="end" class="border rounded px-3 py-2" />
            </div>
            </div>

            <div class="flex gap-2">
            <button
                class="px-3 py-2 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                @click="setWeek"
            >
                Semana actual
            </button>
            <button
                class="px-3 py-2 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                @click="setMonth"
            >
                Mes actual
            </button>
            </div>
        </div>

        <!-- Columna derecha: checkbox + dropdown + ver reporte -->
        <div class="flex flex-wrap items-end gap-3">
            <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="onlyFinal" />
            <span>Solo listas finalizadas</span>
            </label>

            <div class="grow min-w-[280px]">
            <MultiCheckDropdown
                label="Categorías (puedes elegir varias)"
                :options="categoryOptions"
                v-model="selectedCategoryIds"
                widthClass="w-full"
            />
            </div>

            <button
            class="ml-auto px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
            @click="fetchData"
            :disabled="loading"
            >
            {{ loading ? "Cargando..." : "Ver reporte" }}
            </button>
        </div>
    </div>

    <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>

    <!-- Solo DETALLE -->
    <div>
      <div v-if="loading">Cargando detalle…</div>
      <div v-else class="flex flex-col gap-6">
        <div v-for="(rowsByRestaurant, rKey) in groupBy('restaurant_name', filteredItems)" :key="String(rKey)" class="rounded border bg-white">
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
                      <td class="border px-3 py-2 text-right">{{ row.qty }}</td>
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
              S/ {{ rowsByRestaurant.reduce((s, r) => s + Number(r.subtotal_soles ?? 0), 0).toFixed(2) }}
            </div>
          </div>
        </div>

        <div v-if="filteredItems.length===0" class="text-sm text-gray-500">
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

    <div class="mt-2">
      <button class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" @click="openPDF">
        Descargar reporte (PDF)
      </button>
    </div>
  </div>
</template>

<style scoped>
/* coherente con reportes generales */
</style>
