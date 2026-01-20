// src/main.ts
import { createApp } from 'vue';
import router from './router'; // import default, OK
import App from './App.vue';
import './index.css';
// ⬇️ Idle logout (5 min). Requiere `@/services/idle`.
import { startIdleLogout } from '@/services/idle';
function hasToken() {
    try {
        return !!(localStorage.getItem('access_token') || localStorage.getItem('token'));
    }
    catch {
        return false;
    }
}
const app = createApp(App);
app.use(router);
let stopIdle = null;
// Arranca/para el idle según estado de sesión
router.isReady().then(() => {
    if (hasToken()) {
        stopIdle = startIdleLogout(router, 5); // 5 minutos
    }
});
// Si el usuario inicia/cierra sesión y navega, sincronizamos el idle
router.afterEach((_to, _from) => {
    const authed = hasToken();
    // Inicia si hay sesión y no está corriendo
    if (authed && !stopIdle) {
        stopIdle = startIdleLogout(router, 5);
    }
    // Detén si no hay sesión pero el idle sigue activo
    if (!authed && stopIdle) {
        stopIdle();
        stopIdle = null;
    }
});
app.mount('#app');
