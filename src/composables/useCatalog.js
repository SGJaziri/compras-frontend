import { ref, computed } from "vue";
import api from "@/lib/api";
const loading = ref(false);
const restaurants = ref([]);
const categories = ref([]);
const products = ref([]);
const units = ref([]);
export function useCatalog() {
    const load = async () => {
        loading.value = true;
        try {
            const { data } = await api.get("/public/config/");
            restaurants.value = data.restaurants;
            categories.value = data.categories;
            products.value = data.products;
            units.value = data.units;
        }
        catch (err) {
            console.error("Error cargando catálogo:", err);
        }
        finally {
            loading.value = false;
        }
    };
    const unitsById = computed(() => {
        const m = new Map();
        units.value.forEach(u => m.set(u.id, u));
        return m;
    });
    const productsByCategory = (catId) => products.value.filter(p => p.category === catId);
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
