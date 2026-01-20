import { ref, computed } from "vue";
import api from "@/lib/api"; 
import type { PublicConfig, Category, Product, Unit, Restaurant, ID } from "@/types";

const loading = ref(false);
const restaurants = ref<Restaurant[]>([]);
const categories  = ref<Category[]>([]);
const products    = ref<Product[]>([]);
const units       = ref<Unit[]>([]);

export function useCatalog() {
  const load = async () => {
    loading.value = true;
    try {
      const { data } = await api.get<PublicConfig>("/public/config/");
      restaurants.value = data.restaurants;
      categories.value  = data.categories;
      products.value    = data.products;
      units.value       = data.units;
    } catch (err) {
      console.error("Error cargando catálogo:", err);
    } finally {
      loading.value = false;
    }
  };

  const unitsById = computed(() => {
    const m = new Map<ID, Unit>();
    units.value.forEach(u => m.set(u.id, u));
    return m;
  });

  const productsByCategory = (catId: ID) =>
    products.value.filter(p => p.category === catId);

  return { 
    loading, 
    load, 
    restaurants, 
    categories, 
    products, 
    units, 
    unitsById, 
    productsByCategory 
  };
}