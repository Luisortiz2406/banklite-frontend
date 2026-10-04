// =========================================================
// BANKLITE - CLAVE DINÁMICA (GET /auth/dynamic-key)
// Óvalo con el código de 6 dígitos y un borde que se consume en
// 60 segundos. El código lo genera auth-service y lo valida
// transfer-service al confirmar una transferencia: aquí solo se
// muestra (nada se guarda en el navegador).
//
// Uso: <div data-dynamic-key></div> + BankliteDynamicKey.mount()
// =========================================================

const BankliteDynamicKey = (() => {
    const RING_LENGTH = 100;   // pathLength del borde del óvalo

    function template() {
        return `
            <button type="button" class="dk-oval" title="Toca para copiar tu clave dinámica">
                <svg class="dk-ring" viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true">
                    <rect class="dk-track" x="2" y="2" width="196" height="52" rx="26" ry="26" pathLength="${RING_LENGTH}"/>
                    <rect class="dk-progress" x="2" y="2" width="196" height="52" rx="26" ry="26" pathLength="${RING_LENGTH}"/>
                </svg>
                <span class="dk-label">Clave dinámica</span>
                <strong class="dk-code" aria-live="polite">••• •••</strong>
                <span class="dk-seconds"><b>--</b> s</span>
            </button>`;
    }

    function mount(root) {
        if (!root || root.dataset.ready) return;
        root.dataset.ready = '1';
        root.innerHTML = template();

        const oval = root.querySelector('.dk-oval');
        const code = root.querySelector('.dk-code');
        const seconds = root.querySelector('.dk-seconds b');
        const progress = root.querySelector('.dk-progress');
        let current = null;      // { code, period, expiresAt (ms locales) }
        let tick = null;
        let loading = false;

        async function load() {
            if (loading) return;
            loading = true;
            try {
                const data = await BlApi.authed(BlApi.config.authApi, 'GET', '/auth/dynamic-key');
                current = {
                    code: data.code,
                    period: data.period || 60,
                    // Se usa el tiempo restante del servidor (no el reloj del equipo).
                    expiresAt: Date.now() + data.secondsLeft * 1000,
                };
                code.textContent = `${data.code.slice(0, 3)} ${data.code.slice(3)}`;
                root.classList.remove('is-error');
                paint();
            } catch (err) {
                if (BlApi.handleAuthError(err)) return;
                root.classList.add('is-error');
                code.textContent = 'Sin conexión';
                current = null;
                setTimeout(load, 5000);
            } finally {
                loading = false;
            }
        }

        function paint() {
            if (!current) return;
            const left = Math.max(0, (current.expiresAt - Date.now()) / 1000);
            seconds.textContent = String(Math.ceil(left));
            progress.style.strokeDashoffset = String(RING_LENGTH * (1 - left / current.period));
            root.classList.toggle('is-ending', left <= 10);
            if (left <= 0) load();
        }

        function start() {
            clearInterval(tick);
            tick = setInterval(paint, 250);
            load();
        }

        // En segundo plano no se consulta; al volver se pide el código vigente.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clearInterval(tick);
            else start();
        });

        oval.addEventListener('click', async () => {
            if (!current) return;
            try {
                await navigator.clipboard.writeText(current.code);
                toast('Clave dinámica copiada.', 'ok');
            } catch {
                toast('No se pudo copiar. Escríbela a mano.', 'info');
            }
        });

        start();
    }

    return {
        mount: (root) => {
            if (root) return mount(root);
            document.querySelectorAll('[data-dynamic-key]').forEach(mount);
        },
    };
})();
