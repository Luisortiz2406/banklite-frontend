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

// El frontend solo habla con el API Gateway (gatewayUrl() en comun.js).

const BlApi = (function () {
    "use strict";

    // ---------- configuración (igual que el index) ----------
    const API_GATEWAY = gatewayUrl();
    const DEFAULT_CONFIG = {
        authApi: API_GATEWAY,
        kycApi: API_GATEWAY,
        accountApi: API_GATEWAY,
        notificationApi: API_GATEWAY,
        ledgerApi: API_GATEWAY,
        cardApi: API_GATEWAY,
        transferApi: API_GATEWAY,
        paymentApi: API_GATEWAY,
        rewardsApi: API_GATEWAY,
        savingsApi: API_GATEWAY,
        depositApi: API_GATEWAY,
    };
    const config = Object.assign({}, DEFAULT_CONFIG, window.BANKLITE_CONFIG || {});

    // ---------- sesión en sessionStorage ----------
    const KEYS = {
        accessToken: "bl.accessToken",
        refreshToken: "bl.refreshToken",
        idUser: "bl.idUser",
        accountId: "bl.accountId",
    };
    const ACTIVITY_KEY = "bl.lastActivity";

    function read(key) {
        try {
            return sessionStorage.getItem(key);
        } catch {
            return null;
        }
    }
    function write(key, value) {
        try {
            if (value === null || value === undefined || value === "") sessionStorage.removeItem(key);
            else sessionStorage.setItem(key, String(value));
        } catch {
            /* modo privado o almacenamiento bloqueado */
        }
    }

    const session = {
        get accessToken() {
            return read(KEYS.accessToken);
        },
        set accessToken(v) {
            write(KEYS.accessToken, v);
        },
        get refreshToken() {
            return read(KEYS.refreshToken);
        },
        set refreshToken(v) {
            write(KEYS.refreshToken, v);
        },
        get idUser() {
            return read(KEYS.idUser);
        },
        set idUser(v) {
            write(KEYS.idUser, v);
        },
        get accountId() {
            return read(KEYS.accountId);
        },
        set accountId(v) {
            write(KEYS.accountId, v);
        },
    };

    function hasSession() {
        return !!(session.accessToken && session.idUser);
    }

    // ---------- JWT decode (solo lectura, para leer "sub" = idUser) ----------
    function decodeAccessToken(token) {
        try {
            const payload = token.split(".")[1];
            const norm = payload.replace(/-/g, "+").replace(/_/g, "/");
            const padded = norm.padEnd(norm.length + ((4 - (norm.length % 4)) % 4), "=");
            const json = decodeURIComponent(
                atob(padded)
                    .split("")
                    .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
                    .join("")
            );
            return JSON.parse(json);
        } catch {
            return null;
        }
    }

    // ---------- renovar el access token (igual que el index) ----------
    let refreshInFlight = null;
    function refreshAccessToken() {
        if (!refreshInFlight) {
            refreshInFlight = fetch(config.authApi + "/auth/refresh-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: session.refreshToken }),
            })
                .then(res => (res.ok ? res.json() : null))
                .then(data => {
                    if (data && data.accessToken) {
                        session.accessToken = data.accessToken;
                        return data.accessToken;
                    }
                    return null;
                })
                .catch(() => null)
                .finally(() => {
                    refreshInFlight = null;
                });
        }
        return refreshInFlight;
    }

    // ---------- api() (igual que el index) ----------
    async function api(baseUrl, method, path, body, token, isRetry) {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        let res, data;
        try {
            res = await fetch(baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
            data = await res.json().catch(() => ({}));
        } catch (err) {
            throw new Error(
                `No se pudo contactar el servicio (${baseUrl}). Verifica que esté encendido e inténtalo de nuevo.`,
                { cause: err }
            );
        }
        // Token de la sesión vencido: se renueva una vez y se repite la petición.
        if (res.status === 401 && token && !isRetry && session.refreshToken) {
            const fresh = await refreshAccessToken();
            if (fresh) return api(baseUrl, method, path, body, fresh, true);
        }
        // El gateway no deja operar sin la autorización vigente: se pide en el modal.
        if (res.status === 403 && data.code === "CONSENTIMIENTO_REQUERIDO" && token) showConsentModal();
        if (!res.ok) {
            const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message || "Error";
            const e = new Error(msg);
            e.status = res.status;
            // Cuerpo completo: algunos errores traen datos (p. ej. los pendientes de un 409).
            e.data = data;
            throw e;
        }
        // Movimientos viejos con marcas reales: se muestran con el nombre vigente (nombres-demo.js).
        if (path.startsWith("/ledger/") && window.BlNombres) return window.BlNombres.apply(data);
        return data;
    }

    /** Atajo para endpoints protegidos: usa el access token de la sesión. */
    function authed(baseUrl, method, path, body) {
        return api(baseUrl, method, path, body, session.accessToken);
    }

    // El backend exige claves de 8+ caracteres y el cliente maneja un PIN de 4:
    // se duplica de forma determinística (mismo comportamiento que el index).
    function passwordFromPin(pin) {
        return pin + pin;
    }

    // Reglas de PIN inseguro (mismas del index): 4 dígitos, sin repetir, sin
    // secuencias y sin los más comunes.
    function isSecurePin(pin) {
        if (!/^\d{4}$/.test(pin)) return false;
        if (/^(\d)\1{3}$/.test(pin)) return false;
        const digits = pin.split("").map(Number);
        const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
        const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
        if (ascending || descending) return false;
        const comunes = new Set([
            "1234",
            "4321",
            "0123",
            "3210",
            "2580",
            "0852",
            "1111",
            "2222",
            "3333",
            "4444",
            "5555",
            "6666",
            "7777",
            "8888",
            "9999",
            "0000",
        ]);
        return !comunes.has(pin);
    }

    // La clave coincide con la fecha de nacimiento (yyyy-mm-dd) en algún formato común.
    function pinMatchesBirthdate(pin, fechaNacimiento) {
        if (!pin || pin.length !== 4 || !fechaNacimiento) return false;
        const parts = String(fechaNacimiento).split("-");
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
    function logout(reason = "cerrada") {
        try {
            sessionStorage.clear();
        } catch {
            /* sin almacenamiento */
        }
        window.location.href = `login.html?sesion=${encodeURIComponent(reason)}`;
    }

    /** Si la sesión ya no es válida (401 tras renovar), se cierra. Devuelve true si cerró. */
    function handleAuthError(err) {
        if (err && err.status === 401) {
            logout("expirada");
            return true;
        }
        return false;
    }

    /** Páginas protegidas: sin sesión, al login. Si hay sesión, vigila la inactividad. */
    function protectPage() {
        if (!hasSession()) {
            try {
                sessionStorage.clear();
            } catch {
                /* sin almacenamiento */
            }
            window.location.replace("login.html");
            return false;
        }
        const last = Number(read(ACTIVITY_KEY)) || 0;
        if (last && Date.now() - last > IDLE.LIMIT) {
            logout("inactividad");
            return false;
        }
        write(ACTIVITY_KEY, Date.now());
        const onReady = () => {
            startIdleWatch();
            ensureConsent();
        };
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
        else onReady();
        return true;
    }

    // ---------- autorización de datos (clientes que ya existían) ----------
    // Versión de la política de privacidad vigente: la fecha de "Última actualización"
    // de privacidad.html. auth-service la valida; al cambiar la política se actualiza
    // aquí, en privacidad.html y en auth-service (src/auth/consentimientos.ts).
    const POLITICA_PRIVACIDAD_VERSION = "2026-10-25";
    let consentModal = null;

    /**
     * Revisa la marca "cons" del token: si falta, pregunta a auth-service. Si el
     * cliente ya había aceptado (p. ej. en el registro), solo se renueva el token;
     * si no, se muestra el modal. El gateway no deja operar sin la marca.
     */
    async function ensureConsent() {
        const payload = decodeAccessToken(session.accessToken);
        if (!payload || payload.cons === true) return;
        try {
            const estado = await api(config.authApi, "GET", "/auth/consentimientos/estado", null, session.accessToken);
            if (estado.vigente) {
                // Ya aceptó (p. ej. en el registro): basta un token con la marca. Si no se
                // puede renovar, POST es idempotente: no crea filas ni reporta a fraud.
                if (!(await refreshAccessToken())) {
                    const data = await api(
                        config.authApi,
                        "POST",
                        "/auth/consentimientos",
                        { politicaVersion: POLITICA_PRIVACIDAD_VERSION },
                        session.accessToken
                    );
                    if (data.accessToken) session.accessToken = data.accessToken;
                }
                return;
            }
        } catch (err) {
            if (err && err.status === 401) return logout("expirada");
        }
        showConsentModal();
    }

    /** Modal que no se puede cerrar: solo "Aceptar y continuar" o "No acepto" (cierra la sesión). */
    function showConsentModal() {
        if (!consentModal) {
            consentModal = document.createElement("div");
            consentModal.className = "modal consent-modal";
            consentModal.id = "consentModal";
            consentModal.dataset.locked = "true";
            consentModal.setAttribute("role", "dialog");
            consentModal.setAttribute("aria-modal", "true");
            consentModal.setAttribute("aria-labelledby", "consentTitle");
            consentModal.innerHTML = `
                <div class="modal-card">
                    <span class="modal-icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
                    </span>
                    <span class="eyebrow">Tus datos</span>
                    <h2 id="consentTitle">Actualizamos nuestra política de privacidad</h2>
                    <p class="modal-hint">Para seguir usando Banklite necesitamos tu autorización. Esto es lo nuevo:</p>
                    <ul class="consent-list">
                        <li>Usamos la <b>dirección IP</b> de tus inicios de sesión para <b>prevenir fraudes</b>: detectar ingresos desde un país nuevo, «viajes imposibles» o la red Tor.</li>
                        <li>Solo guardamos el <b>país</b> y la <b>red</b> (por ejemplo, 190.60.37.0/24), <b>nunca tu IP completa</b>. No usamos GPS ni pedimos permiso de ubicación a tu navegador.</li>
                        <li>Estos datos se borran a los <b>90 días</b> y solo los consulta nuestro equipo de cumplimiento; cada consulta queda registrada.</li>
                    </ul>
                    <p class="modal-hint">Lee la <a href="privacidad.html#fraude" target="_blank" rel="noopener">política de privacidad (sección 7)</a> y los <a href="terminos.html" target="_blank" rel="noopener">términos de uso</a>.</p>
                    <label class="register-terms consent-check">
                        <input type="checkbox" id="consentCheck">
                        <span>Autorizo a Banklite a tratar mis datos según la política de privacidad, incluido el uso de la IP de mis inicios de sesión para prevenir fraudes, y acepto los términos de uso.</span>
                    </label>
                    <p class="consent-error" id="consentError" role="alert" hidden></p>
                    <div class="modal-actions">
                        <button class="btn soft" type="button" id="consentDecline">No acepto</button>
                        <button class="btn primary" type="button" id="consentAccept" disabled>Aceptar y continuar</button>
                    </div>
                </div>`;
            document.body.appendChild(consentModal);

            const check = consentModal.querySelector("#consentCheck");
            const accept = consentModal.querySelector("#consentAccept");
            const error = consentModal.querySelector("#consentError");
            check.addEventListener("change", () => {
                accept.disabled = !check.checked;
            });
            consentModal.querySelector("#consentDecline").addEventListener("click", () => logout("sin-autorizacion"));
            accept.addEventListener("click", async () => {
                if (!check.checked || accept.disabled) return;
                accept.disabled = true;
                error.hidden = true;
                try {
                    const data = await api(
                        config.authApi,
                        "POST",
                        "/auth/consentimientos",
                        { politicaVersion: POLITICA_PRIVACIDAD_VERSION },
                        session.accessToken
                    );
                    if (data.accessToken) session.accessToken = data.accessToken;
                    // Se recarga para que la página vuelva a pedir sus datos con el token nuevo.
                    window.location.reload();
                } catch (err) {
                    if (err && err.status === 401) return logout("expirada");
                    error.textContent = err.message || "No pudimos guardar tu autorización. Inténtalo de nuevo.";
                    error.hidden = false;
                    accept.disabled = !check.checked;
                }
            });
        }
        // Se cierran los demás modales: este es el único que se puede usar.
        document.querySelectorAll(".modal.active").forEach(open => {
            if (open !== consentModal) open.classList.remove("active");
        });
        consentModal.classList.add("active");
        consentModal.querySelector("#consentCheck").focus();
    }

    // ---------- cierre por inactividad: 5 min, aviso en el minuto 4 ----------
    const IDLE = { LIMIT: 5 * 60 * 1000, WARNING: 60 * 1000 };
    let idleStarted = false;

    function startIdleWatch() {
        if (idleStarted) return;
        idleStarted = true;

        const modal = document.createElement("div");
        modal.className = "modal idle-modal";
        modal.id = "idleModal";
        modal.setAttribute("role", "alertdialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "idleTitle");
        modal.setAttribute("aria-describedby", "idleText");
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

        const countdown = modal.querySelector("#idleCountdown");
        const bar = modal.querySelector("#idleBar");
        const lastActivity = () => Number(read(ACTIVITY_KEY)) || 0;
        let warning = false;
        let lastWrite = 0;

        function hideWarning() {
            warning = false;
            modal.classList.remove("active");
            document.title = document.title.replace(/^\(\d+\) /, "");
        }

        modal.querySelector("#idleStay").addEventListener("click", () => {
            write(ACTIVITY_KEY, Date.now());
            hideWarning();
            if (typeof toast === "function") toast("Tu sesión sigue activa.", "ok");
        });
        modal.querySelector("#idleLogout").addEventListener("click", () => logout("cerrada"));

        // Mientras el aviso está abierto, mover el mouse no cuenta: hay que confirmar.
        const onActivity = () => {
            if (warning) return;
            const now = Date.now();
            if (now - lastWrite > 5000) {
                lastWrite = now;
                write(ACTIVITY_KEY, now);
            }
        };
        ["pointerdown", "mousemove", "keydown", "scroll", "touchstart", "wheel"].forEach(type => {
            window.addEventListener(type, onActivity, { passive: true });
        });

        // Se compara con la hora real cada segundo: funciona con la pestaña en segundo plano.
        setInterval(() => {
            if (!hasSession()) {
                window.location.replace("login.html");
                return;
            }
            const left = IDLE.LIMIT - (Date.now() - lastActivity());
            if (left <= 0) {
                logout("inactividad");
                return;
            }
            if (left <= IDLE.WARNING) {
                const seconds = Math.ceil(left / 1000);
                if (!warning) {
                    warning = true;
                    document
                        .querySelectorAll(".modal.active:not([data-locked])")
                        .forEach(open => open.classList.remove("active"));
                    modal.classList.add("active");
                    modal.querySelector("#idleStay").focus();
                }
                countdown.textContent = seconds;
                bar.style.width = `${(left / IDLE.WARNING) * 100}%`;
                document.title = `(${seconds}) ` + document.title.replace(/^\(\d+\) /, "");
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
        politicaPrivacidadVersion: POLITICA_PRIVACIDAD_VERSION,
        startSession,
        logout,
        handleAuthError,
        protectPage,
    };
})();
