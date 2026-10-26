// =========================================================
// BANKLITE - CANCELAR MI CUENTA (dashboard › Mi perfil)
// 1. Requisitos: account-service revisa saldo, ahorro, recargas y revisiones
//    de seguridad (GET /accounts/cierre/requisitos) y dice qué falta.
// 2. Clave → código por WhatsApp (auth-service: POST /auth/cierre/iniciar).
// 3. Código → ticket de cierre de un solo uso (POST /auth/cierre/confirmar).
// 4. Escribir CANCELAR → POST /accounts/cierre { ticket, confirmacion }.
//    El servidor vuelve a revisar los requisitos en ese momento.
// Al terminar se cierra la sesión local y el login muestra la confirmación.
// =========================================================

// Transferencias: valor mínimo por envío (transfer-service, TRANSFER_MIN).
const CLOSE_TRANSFER_MIN = 1000;
// Mensaje de auth-service (POST /auth/cierre/iniciar) cuando la clave no es correcta.
const WRONG_PASSWORD = "La clave no es correcta.";

document.addEventListener("DOMContentLoaded", () => {
    const openButton = byId("openCloseAccount");
    const modal = byId("closeAccountModal");
    if (!openButton || !modal || !BlApi.hasSession()) return;

    const { config } = BlApi;
    const steps = {
        clave: modal.querySelector('[data-step="clave"]'),
        codigo: modal.querySelector('[data-step="codigo"]'),
        confirmar: modal.querySelector('[data-step="confirmar"]'),
    };
    const reqBody = byId("closeReqBody");
    const pin = initPinBoxes(byId("closePin"));
    const code = initPinBoxes(byId("closeCode"));
    const word = byId("closeWord");
    const submit = byId("closeSubmit");

    // password solo vive mientras el modal está abierto (para reenviar el código).
    // ticket: se reusa si hay que reintentar el cierre (el servidor responde el mismo cierre).
    const flow = { password: null, ticket: null, timer: null, busy: false };

    const masked = number => (number ? `····${String(number).slice(-4)}` : "sin número");

    function reset() {
        flow.password = null;
        flow.ticket = null;
        flow.busy = false;
        flow.timer?.stop();
        pin.clear();
        code.clear();
        word.value = "";
        submit.disabled = true;
    }

    function setLoading(button, loading) {
        button.disabled = loading;
        if (loading) {
            button.dataset.label = button.innerHTML;
            button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Procesando…';
        } else if (button.dataset.label) {
            button.innerHTML = button.dataset.label;
        }
    }

    // 401 de la sesión (no de la clave): se cierra la sesión como en el resto de la app.
    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo continuar", err?.message || fallback, "!");
    }

    openButton.addEventListener("click", () => {
        closeModalById("myProfileModal");
        reset();
        showFlowStep(modal, "requisitos", 1);
        openModal("closeAccountModal");
        loadRequirements();
    });
    modal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", reset));

    // =====================================================
    // 1. REQUISITOS
    // =====================================================

    async function loadRequirements(notice) {
        reqBody.innerHTML =
            '<p class="flow-text"><span class="btn-spinner close-spinner" aria-hidden="true"></span> Revisando tu cuenta…</p>';
        let req;
        try {
            req = await BlApi.authed(config.accountApi, "GET", "/accounts/cierre/requisitos");
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            reqBody.innerHTML = `
                <p class="flow-text">${escapeHTML(err.message || "No pudimos revisar tu cuenta.")}</p>
                <button class="btn soft full" type="button" data-close-retry>Intentar de nuevo</button>`;
            reqBody.querySelector("[data-close-retry]").addEventListener("click", () => loadRequirements());
            return;
        }
        renderRequirements(req, notice);
    }

    function renderRequirements(req, notice) {
        const accounts = req.cuentas
            .map(
                c =>
                    `<li><span>Cuenta ${escapeHTML(masked(c.numeroCuenta))}</span><b>${escapeHTML(formatMoney(c.saldo, c.moneda))}</b></li>`
            )
            .join("");
        const noticeHtml = notice ? `<p class="close-notice" role="alert">${escapeHTML(notice)}</p>` : "";

        if (!req.puedeCancelar) {
            const items = req.pendientes
                .map(p => {
                    let action = "";
                    if (p.codigo === "saldo" && p.saldo > 0) {
                        action =
                            p.saldo >= CLOSE_TRANSFER_MIN
                                ? `<a class="btn soft" href="transferir.html?monto=${encodeURIComponent(Math.floor(p.saldo))}">Enviar mi saldo</a>`
                                : `<small>Es menor al mínimo por envío (${escapeHTML(formatMoney(CLOSE_TRANSFER_MIN))}): escríbenos a ayuda@banklite.co y lo resolvemos.</small>`;
                    }
                    return `<li><span class="close-req-icon" aria-hidden="true">!</span><div><p>${escapeHTML(p.mensaje)}</p>${action}</div></li>`;
                })
                .join("");
            reqBody.innerHTML = `
                ${noticeHtml}
                <p class="flow-text">Antes de cancelar necesitas resolver esto:</p>
                <ul class="close-req-list">${items}</ul>
                ${accounts ? `<ul class="close-accounts">${accounts}</ul>` : ""}
                <button class="btn soft full" type="button" id="closeRecheck">Ya lo resolví, revisar de nuevo</button>`;
            byId("closeRecheck").addEventListener("click", () => loadRequirements());
            return;
        }

        reqBody.innerHTML = `
            ${noticeHtml}
            <p class="flow-text">Tu cuenta cumple los requisitos. Antes de seguir, ten en cuenta lo que pasa al cancelar:</p>
            ${accounts ? `<ul class="close-accounts">${accounts}</ul>` : ""}
            <ul class="close-effects">
                <li>Se cierran <b>todas tus cuentas</b> y ya no podrás ingresar a Banklite ni abrir otra cuenta con este usuario.</li>
                <li>Tu <b>tarjeta virtual se cancela</b> de forma definitiva, junto con sus suscripciones.</li>
                <li>Tus <b>Puntos Banklite</b> dejan de estar disponibles.</li>
                <li>Tus <b>llaves Bre-B</b> se liberan: nadie podrá enviarte dinero con ellas.</li>
                <li>Por obligación legal conservamos la información de tus cuentas y movimientos durante <b>10 años</b> (plazo referencial del Código de Comercio); no la usamos para nada más.</li>
                <li>Te enviaremos la confirmación a tu correo.</li>
            </ul>
            <button class="btn primary full" type="button" id="closeContinue">Entiendo, continuar</button>
            <button class="flow-link" type="button" data-close>Mejor no, quiero quedarme</button>`;
        byId("closeContinue").addEventListener("click", () => {
            showFlowStep(modal, "clave", 2);
            setTimeout(() => pin.focus(), 80);
        });
        reqBody.querySelector("[data-close]").addEventListener("click", () => {
            reset();
            closeModalById("closeAccountModal");
        });
    }

    // =====================================================
    // 2. CLAVE → CÓDIGO POR WHATSAPP
    // =====================================================

    // auth responde 401 tanto si la clave es incorrecta como si venció el token. El
    // reintento automático de api.js (renovar y repetir) contaría una clave incorrecta
    // como dos intentos fallidos: aquí solo se renueva y repite si NO es la clave.
    async function sendCode() {
        const send = token =>
            BlApi.api(config.authApi, "POST", "/auth/cierre/iniciar", { password: flow.password }, token, true);
        let result;
        try {
            result = await send(BlApi.session.accessToken);
        } catch (err) {
            if (err.status !== 401 || err.message === WRONG_PASSWORD) throw err;
            const fresh = await BlApi.refreshAccessToken();
            if (!fresh) throw err;
            result = await send(fresh);
        }
        setText("closePhone", result.celular || "registrado");
        flow.timer?.stop();
        flow.timer = startCodeTimer(byId("closeTimer"), byId("closeResend"), result.expiraEnSegundos || 300);
    }

    steps.clave.addEventListener("submit", async event => {
        event.preventDefault();
        if (flow.busy) return;
        if (!pin.isComplete()) {
            pin.error();
            return toast("Escribe los 4 dígitos de tu clave.", "err");
        }
        const button = steps.clave.querySelector('button[type="submit"]');
        flow.busy = true;
        setLoading(button, true);
        flow.password = BlApi.passwordFromPin(pin.value());
        try {
            await sendCode();
            code.clear();
            showFlowStep(modal, "codigo", 3);
            toast("Te enviamos un código por WhatsApp.", "ok");
            setTimeout(() => code.focus(), 80);
        } catch (err) {
            flow.password = null;
            // auth responde 401 si la clave no es correcta: no es la sesión, no se cierra.
            if (err.status === 401 && err.message === WRONG_PASSWORD) {
                pin.error();
                pin.clear();
                toast(err.message, "err");
            } else {
                fail(err, "No pudimos enviarte el código.");
            }
        } finally {
            flow.busy = false;
            setLoading(button, false);
        }
    });

    byId("closeResend").addEventListener("click", async () => {
        if (!flow.password) return showFlowStep(modal, "clave", 2);
        try {
            await sendCode();
            toast("Te enviamos un código nuevo.", "ok");
        } catch (err) {
            fail(err, "No pudimos reenviar el código.");
        }
    });

    // =====================================================
    // 3. CÓDIGO → TICKET DE CIERRE
    // =====================================================

    steps.codigo.addEventListener("submit", async event => {
        event.preventDefault();
        if (flow.busy) return;
        if (!code.isComplete()) {
            code.error();
            return toast("Escribe los 6 dígitos del código.", "err");
        }
        const button = steps.codigo.querySelector('button[type="submit"]');
        flow.busy = true;
        setLoading(button, true);
        try {
            const result = await BlApi.authed(config.authApi, "POST", "/auth/cierre/confirmar", {
                codigo: code.value(),
            });
            flow.ticket = result.ticket;
            flow.password = null;
            flow.timer?.stop();
            word.value = "";
            submit.disabled = true;
            showFlowStep(modal, "confirmar", 4);
            setTimeout(() => word.focus(), 80);
        } catch (err) {
            if (err.status === 400 && /clave/i.test(err.message)) {
                // La clave dada ya venció (10 min): se vuelve a pedir.
                pin.clear();
                showFlowStep(modal, "clave", 2);
                toast(err.message, "err");
            } else if (err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 429) {
                code.error();
                code.clear();
                toast(err.message || "El código no es correcto.", "err");
            } else {
                fail(err, "No pudimos verificar el código.");
            }
        } finally {
            flow.busy = false;
            setLoading(button, false);
        }
    });

    // =====================================================
    // 4. ESCRIBIR CANCELAR → CERRAR
    // =====================================================

    const typedWord = () => word.value.trim().toUpperCase();
    word.addEventListener("input", () => {
        submit.disabled = typedWord() !== "CANCELAR";
    });

    steps.confirmar.addEventListener("submit", async event => {
        event.preventDefault();
        if (flow.busy) return;
        if (typedWord() !== "CANCELAR") return toast("Escribe CANCELAR para confirmar.", "err");
        if (!flow.ticket) return showFlowStep(modal, "clave", 2);

        flow.busy = true;
        setLoading(submit, true);
        try {
            // El mismo ticket en un reintento devuelve el mismo cierre (nunca cierra dos veces).
            await BlApi.authed(config.accountApi, "POST", "/accounts/cierre", {
                ticket: flow.ticket,
                confirmacion: "CANCELAR",
            });
            reset();
            // Sesión local fuera; el login muestra que la cuenta quedó cancelada.
            BlApi.logout("cancelada");
            return;
        } catch (err) {
            if (!err.status) {
                // Sin respuesta: puede que sí se haya cerrado. Reintentar con el mismo ticket es seguro.
                toast("No tuvimos respuesta. Toca de nuevo el botón para reintentar.", "err");
            } else if (err.status === 409 && Array.isArray(err.data?.pendientes)) {
                // Algo cambió desde la revisión (p. ej. llegó dinero): el ticket ya se gastó.
                flow.ticket = null;
                showFlowStep(modal, "requisitos", 1);
                renderRequirements(
                    { puedeCancelar: false, cuentas: [], pendientes: err.data.pendientes },
                    "No pudimos cancelar tu cuenta: algo cambió desde que la revisamos."
                );
            } else if (err.status === 403 || err.status === 409) {
                // Ticket vencido (5 min) o ya usado: se vuelve a confirmar con clave y código.
                flow.ticket = null;
                pin.clear();
                showFlowStep(modal, "clave", 2);
                toast(err.message || "Vuelve a confirmar con tu clave y el código.", "err");
            } else {
                fail(err, "No pudimos cancelar tu cuenta.");
            }
        } finally {
            flow.busy = false;
            setLoading(submit, false);
            submit.disabled = typedWord() !== "CANCELAR";
        }
    });
});
