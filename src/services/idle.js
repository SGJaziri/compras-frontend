export function startIdleLogout(router, minutes = 5) {
    const ms = minutes * 60 * 1000;
    const clearAuth = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };
    let timer;
    const reset = () => {
        if (timer)
            window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            clearAuth();
            router.push('/login');
        }, ms);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'];
    const onEvent = () => {
        // si la pestaña no está visible, no reseteamos
        if (document.hidden)
            return;
        reset();
    };
    events.forEach(ev => window.addEventListener(ev, onEvent, { passive: true }));
    reset(); // inicia
    return () => {
        if (timer)
            window.clearTimeout(timer);
        events.forEach(ev => window.removeEventListener(ev, onEvent));
    };
}
