// src/router.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

// ===== Lazy imports =====
const UserChangePassword = () => import('@/components/UserChangePassword.vue');

const ListBuilder      = () => import("@/components/ListBuilder.vue");
const ListsHistory     = () => import('@/pages/Lists/ListsHistory.vue');
const ReportsDownload  = () => import('@/pages/Lists/ReportsDownload.vue');

const ReportsByCat     = () => import('@/pages/Lists/ReportsByCategoryPage.vue');
const ReportsByProd    = () => import('@/pages/Lists/ReportsByProductPage.vue');

const CategoriesPage   = () => import('@/pages/Catalog/CategoriesPage.vue');
const ProductsPage     = () => import('@/pages/Catalog/ProductsPage.vue');
const UnitsPage        = () => import('@/pages/Catalog/UnitsPage.vue');
const RestaurantsPage  = () => import('@/pages/Catalog/RestaurantsPage.vue');

const Login            = () => import('@/components/Login.vue');

// === Compat con distintos nombres de token (evita falsos no-logueado)
function getToken(): string | null {
  try {
    return (
      localStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      null
    );
  } catch {
    return null;
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/builder' },

  // Público
  { path: '/login', component: Login, meta: { public: true } },

  // Listas
  { path: '/builder',  component: ListBuilder },
  { path: '/history',  component: ListsHistory },

  // Reportes
  { path: '/reports',             name: 'reports-general',  component: ReportsDownload },
  { path: '/reports/by-category', name: 'reports-category', component: ReportsByCat },
  { path: '/reports/by-product',  name: 'reports-product',  component: ReportsByProd },

  // Catálogo
  { path: '/catalog/categories',  component: CategoriesPage },
  { path: '/catalog/products',    component: ProductsPage },
  { path: '/catalog/units',       component: UnitsPage },
  { path: '/catalog/restaurants', component: RestaurantsPage },

  // Usuario
  {
    path: '/change-password',
    name: 'change-password',
    component: UserChangePassword,
    // Alias para URL en español (corrige la pantalla en blanco)
    alias: ['/usuario/cambiar-password', '/usuario/cambiar-password/'],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Guard de auth (se mantiene igual, pero ahora detecta access_token también)
router.beforeEach((to, _from, next) => {
  if (to.meta?.public) return next();
  if (!getToken()) return next('/login');
  next();
});

export default router;
