// =========================================================
// BANKLITE - CAPA DE API Y SESIÓN (compartida por todas las páginas)
//
// Extraída del index.html original sin cambiar su comportamiento:
// configuración del API Gateway, api(), refreshAccessToken() y tokens.
//
// Sesión: accessToken, refreshToken, idUser y accountId viven en
// sessionStorage (por pestaña; se borra al cerrarla). En localStorage
// solo queda la preferencia de tema.
// =========================================================

// El frontend solo habla con el API Gateway, que enruta a cada microservicio.
// Si la página se sirve desde localhost se usa el gateway de docker-compose.
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.BANKLITE_CONFIG = window.BANKLITE_CONFIG || { apiGateway: 'https://api-gateway-production-dd7f.up.railway.app' };
}

const BlApi = (function () {
    'use strict';

    // ---------- configuración (igual que el index) ----------
    const API_GATEWAY = ((window.BANKLITE_CONFIG || {}).apiGateway || 'http://localhost:8080').replace(/\/+$/, '');
    const DEFAULT_CONFIG = { authApi: API_GATEWAY, kycApi: API_GATEWAY, accountApi: API_GATEWAY, notificationApi: API_GATEWAY, ledgerApi: API_GATEWAY, cardApi: API_GATEWAY, transferApi: API_GATEWAY };
    const config = Object.assign({}, DEFAULT_CONFIG, window.BANKLITE_CONFIG || {});

    // ---------- sesión en sessionStorage ----------
    const KEYS = { accessToken: 'bl.accessToken', refreshToken: 'bl.refreshToken', idUser: 'bl.idUser', accountId: 'bl.accountId' };
    const ACTIVITY_KEY = 'bl.lastActivity';

    function read(key) {
        try { return sessionStorage.getItem(key); } catch { return null; }
    }
    function write(key, value) {
        try {
            if (value === null || value === undefined || value === '') sessionStorage.removeItem(key);
            else sessionStorage.setItem(key, String(value));
        } catch { /* modo privado o almacenamiento bloqueado */ }
    }

    const session = {
        get accessToken() { return read(KEYS.accessToken); },
        set accessToken(v) { write(KEYS.accessToken, v); },
        get refreshToken() { return read(KEYS.refreshToken); },
        set refreshToken(v) { write(KEYS.refreshToken, v); },
        get idUser() { return read(KEYS.idUser); },
        set idUser(v) { write(KEYS.idUser, v); },
        get accountId() { return read(KEYS.accountId); },
        set accountId(v) { write(KEYS.accountId, v); },
    };

    function hasSession() {
        return !!(session.accessToken && session.idUser);
    }

    // ---------- JWT decode (solo lectura, para leer "sub" = idUser) ----------
    function decodeAccessToken(token) {
        try {
            const payload = token.split('.')[1];
            const norm = payload.replace(/-/g, '+').replace(/_/g, '/');
            const padded = norm.padEnd(norm.length + (4 - norm.length % 4) % 4, '=');
            const json = decodeURIComponent(atob(padded).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
            return JSON.parse(json);
        } catch { return null; }
    }

    // ---------- renovar el access token (igual que el index) ----------
    let refreshInFlight = null;
    function refreshAccessToken() {
        if (!refreshInFlight) {
            refreshInFlight = fetch(config.authApi + '/auth/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: session.refreshToken }),
            })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data && data.accessToken) { session.accessToken = data.accessToken; return data.accessToken; }
                    return null;
                })
                .catch(() => null)
                .finally(() => { refreshInFlight = null; });
        }
        return refreshInFlight;
    }

    // ---------- api() (igual que el index) ----------
    async function api(baseUrl, method, path, body, token, isRetry) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        let res, data;
        try {
            res = await fetch(baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
            data = await res.json().catch(() => ({}));
        } catch (err) {
            throw new Error(`No se pudo contactar el servicio (${baseUrl}). Verifica que esté encendido e inténtalo de nuevo.`);
        }
        // Token de la sesión vencido: se renueva una vez y se repite la petición.
        if (res.status === 401 && token && !isRetry && session.refreshToken) {
            const fresh = await refreshAccessToken();
            if (fresh) return api(baseUrl, method, path, body, fresh, true);
        }
        if (!res.ok) {
            const msg = Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'Error');
            const e = new Error(msg); e.status = res.status; throw e;
        }
        return data;
    }

    /** Atajo para endpoints protegidos: usa el access token de la sesión. */
    function authed(baseUrl, method, path, body) {
        return api(baseUrl, method, path, body, session.accessToken);
    }

    // El backend exige claves de 8+ caracteres y el cliente maneja un PIN de 4:
    // se duplica de forma determinística (mismo comportamiento que el index).
    function passwordFromPin(pin) { return pin + pin; }

    // Reglas de PIN inseguro (mismas del index): 4 dígitos, sin repetir, sin
    // secuencias y sin los más comunes.
    function isSecurePin(pin) {
        if (!/^\d{4}$/.test(pin)) return false;
        if (/^(\d){3}$/.test(pin)) return false;
        const digits = pin.split('').map(Number);
        const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
        const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
        if (ascending || descending) return false;
        const comunes = new Set(['1234', '4321', '0123', '3210', '2580', '0852', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '0000']);
        return !comunes.has(pin);
    }

    // La clave coincide con la fecha de nacimiento (yyyy-mm-dd) en algún formato común.
    function pinMatchesBirthdate(pin, fechaNacimiento) {
        if (!pin || pin.length !== 4 || !fechaNacimiento) return false;
        const parts = String(fechaNacimiento).split('-');
        if (parts.length !== 3) return false;
        const [yyyy, mm, dd] = parts;
        const yy = yyyy.slice(-2);
        return [dd + mm, mm + dd, dd + yy, yy + mm, mm + yy, yyyy].includes(pin);
    }

    // ---------- inicio y cierre de sesión ----------
    function startSession(data) {
        session.accessToken = data.accessToken;
        session.refreshToken = data.refreshToken || null;
        const payload = decodeAccessToken(data.accessToken);
        if (payload && payload.sub) session.idUser = payload.sub;
        session.accountId = null;
        write(ACTIVITY_KEY, Date.now());
    }

    /** Cierra la sesión (manual o por inactividad): borra el sessionStorage y va al login. */
    function logout(reason = 'cerrada') {
        try { sessionStorage.clear(); } catch { /* sin almacenamiento */ }
        window.location.href = `login.html?sesion=${encodeURIComponent(reason)}`;
    }

    /** Si la sesión ya no es válida (401 tras renovar), se cierra. Devuelve true si cerró. */
    function handleAuthError(err) {
        if (err && err.status === 401) { logout('expirada'); return true; }
        return false;
    }

    /** Páginas protegidas: sin sesión, al login. Si hay sesión, vigila la inactividad. */
    function protectPage() {
        if (!hasSession()) {
            try { sessionStorage.clear(); } catch { /* sin almacenamiento */ }
            window.location.replace('login.html');
            return false;
        }
        const last = Number(read(ACTIVITY_KEY)) || 0;
        if (last && Date.now() - last > IDLE.LIMIT) { logout('inactividad'); return false; }
        write(ACTIVITY_KEY, Date.now());
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startIdleWatch);
        else startIdleWatch();
        return true;
    }

    // ---------- cierre por inactividad: 5 min, aviso en el minuto 4 ----------
    const IDLE = { LIMIT: 5 * 60 * 1000, WARNING: 60 * 1000 };
    let idleStarted = false;

    function startIdleWatch() {
        if (idleStarted) return;
        idleStarted = true;

        const modal = document.createElement('div');
        modal.className = 'modal idle-modal';
        modal.id = 'idleModal';
        modal.setAttribute('role', 'alertdialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'idleTitle');
        modal.setAttribute('aria-describedby', 'idleText');
        modal.innerHTML = `
            <div class="modal-card">
                <span class="modal-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/></svg>
                </span>
                <span class="eyebrow">Seguridad</span>
                <h2 id="idleTitle">¿Sigues ahí?</h2>
                <p id="idleText">Por tu seguridad cerraremos la sesión en <b id="idleCountdown">60</b> segundos si no hay actividad.</p>
                <div class="idle-bar" aria-hidden="true"><span id="idleBar"></span></div>
                <div class="modal-actions">
                    <button class="btn soft" type="button" id="idleLogout">Cerrar sesión</button>
                    <button class="btn primary" type="button" id="idleStay">Seguir conectado</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const countdown = modal.querySelector('#idleCountdown');
        const bar = modal.querySelector('#idleBar');
        const lastActivity = () => Number(read(ACTIVITY_KEY)) || 0;
        let warning = false;
        let lastWrite = 0;

        function hideWarning() {
            warning = false;
            modal.classList.remove('active');
            document.title = document.title.replace(/^\(\d+\) /, '');
        }

        modal.querySelector('#idleStay').addEventListener('click', () => {
            write(ACTIVITY_KEY, Date.now());
            hideWarning();
            if (typeof toast === 'function') toast('Tu sesión sigue activa.', 'ok');
        });
        modal.querySelector('#idleLogout').addEventListener('click', () => logout('cerrada'));

        // Mientras el aviso está abierto, mover el mouse no cuenta: hay que confirmar.
        const onActivity = () => {
            if (warning) return;
            const now = Date.now();
            if (now - lastWrite > 5000) { lastWrite = now; write(ACTIVITY_KEY, now); }
        };
        ['pointerdown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(type => {
            window.addEventListener(type, onActivity, { passive: true });
        });

        // Se compara con la hora real cada segundo: funciona con la pestaña en segundo plano.
        setInterval(() => {
            if (!hasSession()) { window.location.replace('login.html'); return; }
            const left = IDLE.LIMIT - (Date.now() - lastActivity());
            if (left <= 0) { logout('inactividad'); return; }
            if (left <= IDLE.WARNING) {
                const seconds = Math.ceil(left / 1000);
                if (!warning) {
                    warning = true;
                    document.querySelectorAll('.modal.active').forEach(open => open.classList.remove('active'));
                    modal.classList.add('active');
                    modal.querySelector('#idleStay').focus();
                }
                countdown.textContent = seconds;
                bar.style.width = `${(left / IDLE.WARNING) * 100}%`;
                document.title = `(${seconds}) ` + document.title.replace(/^\(\d+\) /, '');
            } else if (warning) {
                hideWarning();
            }
        }, 1000);
    }

    return {
        config,
        session,
        hasSession,
        api,
        authed,
        refreshAccessToken,
        decodeAccessToken,
        passwordFromPin,
        isSecurePin,
        pinMatchesBirthdate,
        startSession,
        logout,
        handleAuthError,
        protectPage,
    };
})();
