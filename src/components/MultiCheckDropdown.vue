<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";

type ID = number | string;
type Option = { id: ID; name: string };

const props = defineProps<{
  modelValue: ID[];          // valores seleccionados
  options: Option[];         // [{id, name}]
  label?: string;            // "Categorías", "Productos", etc.
  placeholder?: string;      // "— Seleccionar —"
  widthClass?: string;       // Tailwind width (por defecto min-w-[280px])
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: ID[]): void }>();

const open = ref(false);
const internal = ref<ID[]>([...props.modelValue]);
watch(() => props.modelValue, v => { internal.value = [...v]; });

function toggle() { open.value = !open.value; }
function close() { open.value = false; }
function onCheck(id: ID, checked: boolean) {
  const set = new Set(internal.value.map(String));
  if (checked) set.add(String(id)); else set.delete(String(id));
  internal.value = Array.from(set) as ID[];
  emit("update:modelValue", internal.value);
}

function selectAll() {
  internal.value = props.options.map(o => o.id);
  emit("update:modelValue", internal.value);
}
function clearAll() {
  internal.value = [];
  emit("update:modelValue", internal.value);
}

const summaryText = computed(() => {
  if (!internal.value.length) return props.placeholder ?? "— Seleccionar —";
  if (internal.value.length === props.options.length) return "Todos";
  const names = props.options
    .filter(o => internal.value.map(String).includes(String(o.id)))
    .map(o => o.name);
  return names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "");
});

// cerrar al click fuera
function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest?.("[data-mcd-root]")) close();
}
onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));
</script>

<template>
  <div class="flex flex-col gap-1" data-mcd-root>
    <label v-if="label" class="block text-sm">{{ label }}</label>

    <button
      type="button"
      @click="toggle"
      class="border rounded px-3 py-2 bg-white text-left flex items-center justify-between"
      :class="widthClass ?? 'min-w-[280px]'"
    >
      <span class="truncate">{{ summaryText }}</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.24 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute z-20 mt-1 border rounded bg-white shadow-lg p-2 max-h-64 overflow-auto"
      :class="widthClass ?? 'min-w-[280px]'"
    >
      <ul class="flex flex-col gap-1">
        <li v-for="opt in options" :key="String(opt.id)" class="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            class="h-4 w-4"
            :checked="internal.map(String).includes(String(opt.id))"
            @change="onCheck(opt.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="text-sm">{{ opt.name }}</span>
        </li>
      </ul>
      <div class="flex gap-2 mt-2">
        <button class="px-2 py-1 text-sm border rounded bg-gray-50 hover:bg-gray-100" @click="clearAll">Vaciar</button>
        <button class="px-2 py-1 text-sm border rounded bg-gray-50 hover:bg-gray-100" @click="selectAll">Seleccionar todo</button>
      </div>
    </div>
  </div>
</template>
