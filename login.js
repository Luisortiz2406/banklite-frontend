// =========================================================
// BANKLITE - LOGIN Y RECUPERACIÓN DE CLAVE (login.html)
// Endpoints: POST /auth/login, /auth/password-recovery/send y /reset.
// Usa BlApi (api.js) y las utilidades visuales de comun.js.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;

    const { config } = BlApi;
    const usernameInput = document.getElementById("loginUsername");
    const pinBoxes = initPinBoxes(document.querySelector('[data-pin-for="loginPin"]'));
    const submitBtn = form.querySelector('button[type="submit"]');

    showSessionNotice();

    // Recién registrado: el usuario llega escrito (se lee una sola vez).
    try {
        const prefill = sessionStorage.getItem("bl.prefillUsername");
        if (prefill) {
            usernameInput.value = prefill;
            sessionStorage.removeItem("bl.prefillUsername");
        }
    } catch {
        /* sin almacenamiento */
    }

    function setLoading(button, loading, label) {
        button.disabled = loading;
        if (loading) button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Procesando…';
        else button.innerHTML = label;
    }

    // ---------- ingresar ----------
    const submitLabel = submitBtn.innerHTML;
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const username = usernameInput.value.trim();
        const pin = pinBoxes.value();

        if (!username) {
            showMessage("Usuario requerido", "Escribe tu nombre de usuario.", "!");
            usernameInput.focus();
            return;
        }
        if (username.includes("@")) {
            showMessage("Usa tu usuario", "Para ingresar escribe tu nombre de usuario, no tu correo.", "!");
            usernameInput.focus();
            return;
        }
        if (!/^\d{4}$/.test(pin)) {
            pinBoxes.error();
            toast("Escribe los 4 dígitos de tu clave.", "err");
            pinBoxes.focus();
            return;
        }

        setLoading(submitBtn, true);
        try {
            const password = BlApi.passwordFromPin(pin);
            const data = await BlApi.api(config.authApi, "POST", "/auth/login", { username, password });
            BlApi.startSession(data);
            window.location.href = "dashboard.html";
        } catch (err) {
            pinBoxes.error();
            pinBoxes.clear();
            // auth responde 403 "Tu cuenta fue cancelada el …" si el cliente ya canceló.
            const cancelled = err.status === 403 && /cancelada/i.test(err.message || "");
            showMessage(
                cancelled ? "Cuenta cancelada" : "No pudimos ingresar",
                cancelled
                    ? `${err.message} (ayuda@banklite.co o Línea Banklite 601 000 0000)`
                    : err.message || "Credenciales inválidas.",
                "!"
            );
            setLoading(submitBtn, false, submitLabel);
        }
    });

    // ---------- recuperar clave (correo o WhatsApp) ----------
    const modal = document.getElementById("recoverModal");
    const forgot = document.getElementById("forgotPin");
    if (!modal || !forgot) return;

    const steps = {
        identify: modal.querySelector('[data-step="identify"]'),
        code: modal.querySelector('[data-step="code"]'),
        newpin: modal.querySelector('[data-step="newpin"]'),
    };
    const codeBoxes = initPinBoxes(document.getElementById("recoverCode"));
    const newBoxes = initPinBoxes(document.querySelector('[data-pin-for="recoverPin"]'));
    const confirmBoxes = initPinBoxes(document.querySelector('[data-pin-for="recoverPinConfirm"]'));
    const resend = document.getElementById("recoverResend");
    const demo = document.getElementById("recoverDemo");
    const recovery = { email: null, phone: null, channel: null, code: null };
    let timer = null;

    // Primero se elige el canal; luego aparece el campo de ese canal.
    const emailField = document.getElementById("recoverEmailField");
    const phoneField = document.getElementById("recoverPhoneField");
    const usernameField = document.getElementById("recoverUsername");
    const emailInput = document.getElementById("recoverEmail");
    const phoneInput = document.getElementById("recoverPhone");
    const selectedChannel = () => steps.identify.querySelector('input[name="recoverChannel"]:checked')?.value || null;

    function paintChannel() {
        const channel = selectedChannel();
        emailField.hidden = channel !== "email";
        phoneField.hidden = channel !== "whatsapp";
        if (channel === "email") setTimeout(() => emailInput.focus(), 60);
        if (channel === "whatsapp") setTimeout(() => phoneInput.focus(), 60);
    }
    steps.identify
        .querySelectorAll('input[name="recoverChannel"]')
        .forEach(radio => radio.addEventListener("change", paintChannel));
    phoneInput.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
    });

    forgot.addEventListener("click", event => {
        event.preventDefault();
        steps.identify.reset();
        const typed = usernameInput.value.trim();
        if (typed && !typed.includes("@")) usernameField.value = typed;
        paintChannel();
        codeBoxes.clear();
        newBoxes.clear();
        confirmBoxes.clear();
        Object.assign(recovery, { username: null, email: null, phone: null, channel: null, code: null });
        if (demo) demo.hidden = true;
        showFlowStep(modal, "identify", 1);
        openModal("recoverModal");
    });

    async function requestCode(isResend = false) {
        await BlApi.api(config.authApi, "POST", "/auth/password-recovery/send", recoveryTarget());
        codeBoxes.clear();
        // El servidor no revela si la cuenta existe: el texto tampoco.
        document.getElementById("recoverDestination").textContent =
            recovery.channel === "email" ? "tu correo registrado" : "tu WhatsApp registrado";
        timer?.stop();
        timer = startCodeTimer(document.getElementById("recoverTimer"), resend);
        toast(
            isResend ? "Te enviamos un código nuevo." : "Si los datos coinciden con una cuenta, enviamos el código.",
            "ok"
        );
        setTimeout(() => codeBoxes.focus(), 80);
    }

    // Correo, o celular colombiano en formato internacional (+57).
    // 3 intentos fallidos (dato ajeno o código malo): el servidor bloquea el
    // cambio de clave hasta el próximo inicio de sesión.
    function handleBlocked(err) {
        if (!/fue bloqueado/i.test(err?.message || "")) return false;
        timer?.stop();
        modal.classList.remove("active");
        showMessage("Cambio de clave bloqueado", err.message, "!");
        return true;
    }

    // El servidor exige que coincidan con los registrados en la cuenta del usuario.
    const recoveryTarget = () =>
        recovery.channel === "whatsapp"
            ? { username: recovery.username, phone: recovery.phone, channel: "whatsapp" }
            : { username: recovery.username, email: recovery.email, channel: "email" };

    steps.identify.addEventListener("submit", async event => {
        event.preventDefault();
        const username = usernameField.value.trim().toLowerCase();
        if (!username || username.includes("@")) {
            toast("Escribe tu nombre de usuario.", "err");
            usernameField.focus();
            return;
        }
        recovery.username = username;
        const channel = selectedChannel();
        if (!channel) {
            toast("Elige por dónde quieres recibir el código.", "err");
            return;
        }
        if (channel === "email") {
            const email = emailInput.value.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                toast("Escribe tu correo registrado.", "err");
                emailInput.focus();
                return;
            }
            Object.assign(recovery, { channel, email, phone: null });
        } else {
            const digits = phoneInput.value.replace(/\D/g, "");
            if (!/^3\d{9}$/.test(digits)) {
                toast("Escribe tu celular de 10 dígitos (empieza por 3).", "err");
                phoneInput.focus();
                return;
            }
            Object.assign(recovery, { channel, email: null, phone: `+57${digits}` });
        }
        const button = steps.identify.querySelector('button[type="submit"]');
        const label = button.innerHTML;
        setLoading(button, true);
        try {
            await requestCode();
            showFlowStep(modal, "code", 2);
        } catch (err) {
            if (handleBlocked(err)) return;
            // Correo o número distinto al registrado en la cuenta: alerta.
            if (/no pertenece a tu cuenta/i.test(err.message || "")) {
                showMessage("Datos no coinciden", err.message, "!");
                (channel === "whatsapp" ? phoneInput : emailInput).focus();
                return;
            }
            toast(err.message || "No se pudo solicitar el código. Inténtalo de nuevo.", "err");
        } finally {
            setLoading(button, false, label);
        }
    });

    resend.addEventListener("click", async () => {
        try {
            await requestCode(true);
        } catch (err) {
            if (!handleBlocked(err)) toast(err.message || "No se pudo reenviar el código.", "err");
        }
    });

    // El servidor valida el código junto con la clave nueva (POST /reset), así que
    // aquí solo se comprueba que esté completo y vigente antes de pedir la clave.
    steps.code.addEventListener("submit", event => {
        event.preventDefault();
        if (!codeBoxes.isComplete()) {
            codeBoxes.error();
            toast("Escribe los 6 dígitos del código.", "err");
            return;
        }
        if (timer?.expired()) {
            codeBoxes.error();
            toast("El código venció. Pide uno nuevo.", "err");
            resend.disabled = false;
            return;
        }
        recovery.code = codeBoxes.value();
        showFlowStep(modal, "newpin", 3);
        setTimeout(() => newBoxes.focus(), 80);
    });

    steps.newpin.addEventListener("submit", async event => {
        event.preventDefault();
        const pin = newBoxes.value();
        if (!newBoxes.isComplete() || !confirmBoxes.isComplete()) {
            newBoxes.error();
            toast("Completa los 4 dígitos en ambos campos.", "err");
            return;
        }
        if (!BlApi.isSecurePin(pin)) {
            newBoxes.error();
            toast("Esta clave es insegura. Elige un PIN diferente.", "err");
            return;
        }
        if (pin !== confirmBoxes.value()) {
            confirmBoxes.error();
            confirmBoxes.clear();
            toast("Las dos claves no coinciden.", "err");
            return;
        }
        const button = steps.newpin.querySelector('button[type="submit"]');
        const label = button.innerHTML;
        setLoading(button, true);
        try {
            await BlApi.api(config.authApi, "POST", "/auth/password-recovery/reset", {
                ...recoveryTarget(),
                code: recovery.code,
                password: BlApi.passwordFromPin(pin),
            });
            timer?.stop();
            modal.classList.remove("active");
            pinBoxes.clear();
            toast("Clave cambiada. Ingresa con tu nueva clave.", "ok", 4500);
            pinBoxes.focus();
        } catch (err) {
            if (handleBlocked(err)) return;
            // Código incorrecto o vencido: se vuelve a pedir el código.
            if (err.status === 400) {
                codeBoxes.clear();
                showFlowStep(modal, "code", 2);
                setTimeout(() => codeBoxes.focus(), 80);
            }
            toast(err.message || "No se pudo cambiar la clave.", "err");
        } finally {
            setLoading(button, false, label);
        }
    });

    modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => timer?.stop()));
});

// Mensaje en el login cuando la sesión terminó (cerrada, inactividad o vencida).
function showSessionNotice() {
    const form = document.getElementById("loginForm");
    const reason = new URLSearchParams(window.location.search).get("sesion");
    if (!form || !reason) return;

    const texts = {
        inactividad: "Tu sesión se cerró por inactividad. Ingresa de nuevo para continuar.",
        expirada: "Tu sesión venció. Ingresa de nuevo para continuar.",
        cerrada: "Cerraste tu sesión de forma segura.",
        cancelada:
            "Tu cuenta Banklite quedó cancelada. Te enviamos la confirmación a tu correo. Gracias por haber estado con nosotros.",
        "sin-autorizacion":
            "Para usar Banklite necesitas aceptar la política de privacidad. Puedes volver a ingresar cuando quieras.",
    };
    const notice = document.createElement("div");
    notice.className = `session-notice${reason !== "cerrada" && reason !== "cancelada" ? " is-warning" : ""}`;
    notice.setAttribute("role", "status");
    notice.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/></svg><span></span>';
    notice.lastElementChild.textContent = texts[reason] || texts.cerrada;
    form.parentNode.insertBefore(notice, form);

    // Se limpia la dirección para que el aviso no salga al recargar.
    history.replaceState(null, "", window.location.pathname);
}
