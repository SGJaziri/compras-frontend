<template>
  <div class="min-h-screen grid md:grid-cols-[240px_1fr]">
    <!-- Header móvil -->
    <header class="md:hidden sticky top-0 z-40 bg-gray-900 text-gray-100">
      <div class="flex items-center justify-between px-4 py-3">
        <button
          class="p-2 rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          @click="isOpen = true"
          aria-label="Abrir menú"
        >
          <!-- ícono hamburguesa simple -->
          <span class="block w-6 h-0.5 bg-gray-100 mb-1"></span>
          <span class="block w-6 h-0.5 bg-gray-100 mb-1"></span>
          <span class="block w-6 h-0.5 bg-gray-100"></span>
        </button>
        <h1 class="font-semibold">SG - Inventario</h1>
        <div class="w-8"></div>
      </div>
    </header>

    <!-- Overlay móvil -->
    <transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40 bg-black/40 md:hidden"
        @click="isOpen = false"
      />
    </transition>

    <!-- Sidebar -->
    <transition name="slide">
      <aside
        :class="[
          // base
          'bg-gray-900 text-gray-100 p-4 flex flex-col z-50 md:z-auto',
          // visible como bloque en móvil, flex en desktop
          'block md:flex',
          // drawer en móvil, fijo en desktop
          'fixed left-0 top-0 h-full w-72 md:static md:h-auto md:w-auto',
          // movimiento off-canvas
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
          // animación suave
          'transition-transform duration-200 ease-out'
        ]"
        @keydown.esc="isOpen = false"
      >
        <!-- Contenido del sidebar -->
        <div>
          <h2 class="font-semibold tracking-wide text-sm uppercase">Usuario</h2>
          <nav class="space-y-2 mt-2">
            <RouterLink
              to="/usuario/cambiar-password"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >
              🔒 Cambiar contraseña
            </RouterLink>
          </nav>

          <h2 class="font-semibold tracking-wide text-sm uppercase mt-6">Menú</h2>
          <nav class="space-y-2 mt-2">
            <RouterLink
              to="/builder"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >🧾 Generar lista</RouterLink>
            <RouterLink
              to="/history"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >🕘 Historial</RouterLink>
            <RouterLink
              to="/reports"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >📊 Reportes generales</RouterLink>
            <RouterLink
              to="/reports/by-category"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >📊 Reportes por categoría</RouterLink>
            <RouterLink
              to="/reports/by-product"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >📊 Reportes por producto</RouterLink>
          </nav>

          <h2 class="font-semibold tracking-wide text-sm uppercase mt-6">Catálogo</h2>
          <nav class="space-y-2 mt-2">
            <RouterLink
              to="/catalog/categories"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >🏷 Categorías</RouterLink>
            <RouterLink
              to="/catalog/products"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >📦 Productos</RouterLink>
            <RouterLink
              to="/catalog/units"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >📏 Unidades</RouterLink>
            <RouterLink
              to="/catalog/restaurants"
              class="block px-2 py-1 rounded hover:bg-gray-800"
            >🍽 Restaurantes</RouterLink>
          </nav>
        </div>

        <!-- Botón Cerrar Sesión al fondo -->
        <div class="mt-auto pt-6">
          <button
            @click="logout"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md 
                   bg-red-600 text-white font-medium text-sm transition-colors 
                   hover:bg-red-700 active:bg-red-800 shadow-sm"
          >
            <span>🔒 Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </transition>

    <!-- Contenido principal -->
    <main class="p-4 md:p-6 bg-gray-50">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { ref, watch } from 'vue'

const router = useRouter()
const route = useRoute()
const isOpen = ref(false)

// Bloquea scroll del body cuando el menú está abierto
watch(isOpen, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})

// Cierra el drawer al navegar en móvil
watch(() => route.fullPath, () => {
  isOpen.value = false
})

function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  router.push('/login')
}
</script>

<style scoped>
/* transiciones */
.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform .2s ease-out; }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
</style>
