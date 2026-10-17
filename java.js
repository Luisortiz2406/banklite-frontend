// =========================================================
// BANKLITE - JAVASCRIPT COMÚN
// Utilidades compartidas por todas las páginas: modales, avisos,
// casillas de clave, tema, menú lateral, inicio público y el
// asistente Banki. Los datos reales los traen api.js y el script
// de cada página (login.js, registro.js, dashboard.js, ...).
// En localStorage solo se guarda el tema (bankliteTheme) y los códigos
// simulados de beneficios (bankliteBenefits, en beneficios.js).
// =========================================================

// Monto corto para gráficos: $1,2M · $350K · $900
function compactMoney(value) {
    const number = Math.abs(Number(value) || 0);

    if (number >= 1000000) {
        return "$" + (number / 1000000).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + "M";
    }

    if (number >= 1000) {
        return "$" + Math.round(number / 1000).toLocaleString("es-CO") + "K";
    }

    return "$" + number.toLocaleString("es-CO");
}


// Hay sesión abierta en esta pestaña (la guarda api.js en sessionStorage)
function hasSession() {
    try { return Boolean(sessionStorage.getItem("bl.accessToken")); } catch { return false; }
}


// =========================================================
// UTILIDADES
// =========================================================

function initials(name) {

    if (!name) return "";

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");
}


function showMessage(title, message, icon = "✓") {

    const modal = document.getElementById("genericModal");

    if (!modal) return;

    const titleElement = document.getElementById("genericTitle");
    const textElement = document.getElementById("genericText");
    const iconElement = modal.querySelector(".modal-icon");

    if (titleElement) titleElement.textContent = title;
    if (textElement) textElement.textContent = message;

    if (iconElement) {
        iconElement.textContent = icon;
        iconElement.classList.toggle("is-alert", icon === "!");
    }

    modal.classList.add("active");
}


// Confirmación con el modal de Banklite (en lugar de confirm()).
// Devuelve una promesa: true si la persona acepta.

function confirmAction(title, message, acceptLabel = "Confirmar") {

    const modal = document.getElementById("confirmModal");

    if (!modal) {
        return Promise.resolve(window.confirm(message));
    }

    const accept = document.getElementById("confirmAccept");
    const cancelButtons = modal.querySelectorAll("[data-close]");

    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmText").textContent = message;
    accept.textContent = acceptLabel;

    modal.classList.add("active");

    return new Promise(resolve => {

        const finish = result => {
            modal.classList.remove("active");
            accept.removeEventListener("click", onAccept);
            cancelButtons.forEach(button => button.removeEventListener("click", onCancel));
            modal.removeEventListener("click", onBackdrop);
            resolve(result);
        };

        const onAccept = () => finish(true);
        const onCancel = () => finish(false);
        const onBackdrop = event => {
            if (event.target === modal) finish(false);
        };

        accept.addEventListener("click", onAccept);
        cancelButtons.forEach(button => button.addEventListener("click", onCancel));
        modal.addEventListener("click", onBackdrop);
    });
}


function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.add("active");

    // Enfoca el primer campo para escribir de inmediato
    const firstField = modal.querySelector("input:not([type=hidden]), select");
    if (firstField) setTimeout(() => firstField.focus(), 120);
}


function closeModalById(id) {
    document.getElementById(id)?.classList.remove("active");
}


function formatDate(value, options = { day: "numeric", month: "short" }) {
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("es-CO", options).format(date);
}


// =========================================================
// AVISOS FLOTANTES (TOASTS)
// Mensajes cortos que aparecen en una esquina y se van solos.
// kind: "ok", "err" o "info"
// =========================================================

function toast(message, kind = "info", duration = 3600) {

    let stack = document.getElementById("toastStack");

    if (!stack) {
        stack = document.createElement("div");
        stack.id = "toastStack";
        stack.className = "toast-stack";
        stack.setAttribute("role", "status");
        stack.setAttribute("aria-live", "polite");
        document.body.appendChild(stack);
    }

    const symbols = { ok: "✓", err: "!", info: "i" };
    const item = document.createElement("div");

    item.className = `toast toast-${symbols[kind] ? kind : "info"}`;
    item.innerHTML = `<span class="toast-dot" aria-hidden="true">${symbols[kind] || "i"}</span><span></span>`;
    item.lastElementChild.textContent = message;

    stack.appendChild(item);

    setTimeout(() => {
        item.classList.add("is-leaving");
        setTimeout(() => item.remove(), 260);
    }, duration);
}


// =========================================================
// CASILLAS DE CLAVE Y DE CÓDIGO
// <div class="pin-boxes" data-length="4" data-pin-for="idDelInputOculto">
// Si tiene data-visible, los dígitos se ven (para códigos).
// =========================================================

function initPinBoxes(container) {

    if (container._pin) return container._pin;

    const length = Number(container.dataset.length) || 4;
    const hidden = container.dataset.pinFor ? document.getElementById(container.dataset.pinFor) : null;
    const visible = container.hasAttribute("data-visible");

    container.innerHTML = "";

    const boxes = Array.from({ length }, (_, index) => {
        const input = document.createElement("input");
        input.type = visible ? "text" : "password";
        input.inputMode = "numeric";
        input.autocomplete = index === 0 && visible ? "one-time-code" : "off";
        input.setAttribute("aria-label", `Dígito ${index + 1} de ${length}`);
        container.appendChild(input);
        return input;
    });

    const value = () => boxes.map(box => box.value).join("");

    const sync = () => {
        boxes.forEach(box => box.classList.toggle("is-filled", box.value !== ""));
        container.classList.remove("is-error");
        if (hidden) hidden.value = value();
    };

    const fill = (digits, from = 0) => {
        digits.split("").forEach((digit, offset) => {
            if (boxes[from + offset]) boxes[from + offset].value = digit;
        });
        sync();
        const next = boxes.find(box => !box.value) || boxes[length - 1];
        next.focus();
    };

    boxes.forEach((box, index) => {

        box.addEventListener("input", () => {
            const digits = box.value.replace(/\D/g, "");
            box.value = "";
            if (digits) fill(digits, index);
            else sync();
        });

        box.addEventListener("keydown", event => {
            if (event.key === "Backspace" && !box.value && index > 0) {
                boxes[index - 1].value = "";
                boxes[index - 1].focus();
                sync();
                event.preventDefault();
            }
            if (event.key === "ArrowLeft" && index > 0) boxes[index - 1].focus();
            if (event.key === "ArrowRight" && index < length - 1) boxes[index + 1].focus();
        });

        box.addEventListener("paste", event => {
            const digits = (event.clipboardData?.getData("text") || "").replace(/\D/g, "");
            if (!digits) return;
            event.preventDefault();
            fill(digits.slice(0, length - index), index);
        });

        box.addEventListener("focus", () => box.select());
    });

    container._pin = {
        value,
        isComplete: () => value().length === length,
        focus: () => (boxes.find(box => !box.value) || boxes[0]).focus(),
        clear() {
            boxes.forEach(box => { box.value = ""; });
            sync();
        },
        error() {
            container.classList.remove("is-error");
            void container.offsetWidth;
            container.classList.add("is-error");
        },
        setVisible(show) {
            boxes.forEach(box => { box.type = show ? "text" : "password"; });
        }
    };

    return container._pin;
}


function maskEmail(email) {
    const [name, domain] = String(email).split("@");
    if (!domain) return email;
    return `${name.slice(0, 2)}${"•".repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

function maskPhone(phone, country = "+57") {
    const digits = String(phone).replace(/\D/g, "");
    return `${country} ${"•".repeat(Math.max(digits.length - 4, 3))} ${digits.slice(-4)}`;
}


// Contador de vencimiento (05:00). El botón de reenviar se
// habilita a los 30 segundos.

function startCodeTimer(meta, resend, seconds = 300) {

    const started = Date.now();
    const label = meta.querySelector("b");

    clearInterval(meta._timer);
    meta.classList.remove("is-expired");
    if (resend) resend.disabled = true;

    const tick = () => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        const left = Math.max(seconds - elapsed, 0);

        label.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

        if (resend && elapsed >= 30) resend.disabled = false;

        if (!left) {
            clearInterval(meta._timer);
            meta.classList.add("is-expired");
            label.textContent = "vencido";
        }
    };

    tick();
    meta._timer = setInterval(tick, 1000);

    return {
        expired: () => meta.classList.contains("is-expired"),
        stop: () => clearInterval(meta._timer)
    };
}


// Muestra un paso de un flujo dentro de un modal y avanza la barra.

function showFlowStep(modal, name, progress) {
    modal.querySelectorAll(".flow-step").forEach(step => {
        step.hidden = step.dataset.step !== name;
    });

    if (progress) {
        modal.querySelectorAll(".flow-progress span").forEach((bar, index) => {
            bar.classList.toggle("on", index < progress);
        });
    }
}


// =========================================================
// MODO OSCURO
// Preferencia del dispositivo (no de cada usuario): light, dark o auto.
// El <head> de cada página ya la aplica antes de pintar.
// =========================================================

const THEME_KEY = "bankliteTheme";
const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function themePreference() {
    try {
        const value = localStorage.getItem(THEME_KEY);
        return value === "dark" || value === "auto" ? value : "light";
    } catch {
        return "light";
    }
}

function applyTheme(preference = themePreference()) {
    const dark = preference === "dark" || (preference === "auto" && darkQuery?.matches);
    if (dark) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    // El fondo puesto en el <head> solo sirve mientras carga el CSS
    document.documentElement.style.background = "";

    document.querySelectorAll("[data-theme-choice]").forEach(button => {
        const active = button.dataset.themeChoice === preference;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
    });
}

function setTheme(preference) {
    try { localStorage.setItem(THEME_KEY, preference); } catch {}
    applyTheme(preference);
}

function initTheme() {
    applyTheme();

    document.querySelectorAll("[data-theme-choice]").forEach(button => {
        button.addEventListener("click", () => {
            setTheme(button.dataset.themeChoice);
            const names = { light: "claro", dark: "oscuro", auto: "automático (según tu dispositivo)" };
            toast(`Modo ${names[button.dataset.themeChoice]} activado.`, "ok");
        });
    });

    // En automático sigue al sistema; y si se cambia en otra pestaña, se sincroniza
    darkQuery?.addEventListener?.("change", () => {
        if (themePreference() === "auto") applyTheme("auto");
    });
    window.addEventListener("storage", event => {
        if (event.key === THEME_KEY) applyTheme();
    });
}


// =========================================================
// INICIALIZACIÓN GENERAL
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    initTheme();

    // Botones "Imprimir" (términos, privacidad). Sin onclick inline por la CSP.
    document.querySelectorAll("[data-print]").forEach(button => {
        button.addEventListener("click", () => window.print());
    });

    // -----------------------------------------------------
    // CASILLAS DE CLAVE / CÓDIGO
    // -----------------------------------------------------

    document.querySelectorAll(".pin-boxes").forEach(initPinBoxes);

    document.querySelectorAll("[data-pin-toggle]").forEach(button => {
        button.addEventListener("click", () => {
            const boxes = document.querySelector(`[data-pin-for="${button.dataset.pinToggle}"]`);
            const show = button.textContent.trim() === "Mostrar";
            boxes?._pin?.setVisible(show);
            button.textContent = show ? "Ocultar" : "Mostrar";
        });
    });


    // -----------------------------------------------------
    // MOSTRAR / OCULTAR CONTRASEÑA
    // -----------------------------------------------------

    document.querySelectorAll("[data-toggle-password]").forEach(button => {

        button.addEventListener("click", () => {

            const targetId = button.dataset.togglePassword;
            const input = document.getElementById(targetId);

            if (!input) return;

            if (input.type === "password") {
                input.type = "text";
                button.textContent = "Ocultar";
            } else {
                input.type = "password";
                button.textContent = "Mostrar";
            }
        });
    });


    // -----------------------------------------------------
    // PIN: SOLO 4 DÍGITOS
    // -----------------------------------------------------

    document.querySelectorAll(
        'input[name="pin"], input[id*="Pin"], input[id*="PIN"]'
    ).forEach(input => {

        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "").slice(0, 4);
        });
    });


    // -----------------------------------------------------
    // CAMPOS NUMÉRICOS
    // -----------------------------------------------------

    document.querySelectorAll(
        'input[type="tel"], input[inputmode="numeric"]'
    ).forEach(input => {

        input.addEventListener("input", () => {
            if (input.type !== "tel" && input.inputMode !== "numeric") return;
            input.value = input.value.replace(/\D/g, "");
        });
    });


    // -----------------------------------------------------
    // CERRAR MODAL
    // -----------------------------------------------------

    document.querySelectorAll("[data-close]").forEach(button => {

        button.addEventListener("click", () => {
            const parentModal = button.closest(".modal");

            if (parentModal) parentModal.classList.remove("active");
        });
    });


    document.querySelectorAll(".modal").forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                modal.classList.remove("active");
            }
        });
    });


    // Tecla Escape cierra el modal abierto

    document.addEventListener("keydown", event => {

        if (event.key !== "Escape") return;

        document.querySelectorAll(".modal.active").forEach(modal => {
            if (modal.id === "confirmModal") {
                modal.querySelector("[data-close]")?.click();
            } else {
                modal.classList.remove("active");
            }
        });
    });


    // -----------------------------------------------------
    // MENÚ MÓVIL
    // -----------------------------------------------------

    const mobileButton = document.querySelector(".mobile-menu-button");
    const mobileMenu = document.querySelector(".mobile-menu");

    if (mobileButton && mobileMenu) {

        mobileButton.addEventListener("click", () => {

            mobileMenu.classList.toggle("active");

            const expanded =
                mobileMenu.classList.contains("active");

            mobileButton.setAttribute(
                "aria-expanded",
                expanded
            );
        });

        // Al tocar un enlace, el menú se cierra
        mobileMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                mobileMenu.classList.remove("active");
                mobileButton.setAttribute("aria-expanded", "false");
            });
        });
    }


    // login.js, registro.js, dashboard.js, transferir.js y movimientos.js
    // inician sus páginas (conectadas al backend con api.js).

    if (document.body.classList.contains("home")) initHome();
    if (document.getElementById("helpPage")) initHelp();
    if (document.getElementById("aboutPage")) initAbout();
    initBotBubble();
});


function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Cerrar sesión desde cualquier página: api.js limpia sessionStorage
// y lleva al ingreso.
function endSession(reason = "cerrada") {
    if (typeof BlApi !== "undefined") BlApi.logout(reason);
    else {
        try { sessionStorage.clear(); } catch {}
        window.location.href = `login.html?sesion=${reason}`;
    }
}


// =========================================================
// INICIO PÚBLICO (index.html)
// =========================================================

const HOME_ARTICLES = {
    ahorro: {
        title: "La regla 50/30/20",
        text: "Divide tu sueldo en tres partes:\n\n• 50% para necesidades: arriendo, servicios, mercado y transporte.\n• 30% para gustos: salidas, ropa y suscripciones.\n• 20% para ahorrar o pagar deudas.\n\nTip: apenas recibas tu sueldo, apártalo primero para no gastarlo sin darte cuenta."
    },
    cdt: {
        title: "¿CDT o bolsillo?",
        text: "Bolsillo: apartas plata para algo concreto y la puedes sacar cuando quieras. Sirve para emergencias o metas cercanas.\n\nCDT: la plata queda quieta hasta el final del plazo a cambio de una tasa fija. Sirve para dinero que no vas a necesitar pronto.\n\nMuchas personas combinan los dos. En Banklite tienes bolsillos que ganan 9% E.A. y CDT de hasta 11% E.A., en Bolsillos y CDT."
    },
    fraude: {
        title: "5 señales de fraude",
        text: "1. Te piden tu clave o un código que te llegó por correo o WhatsApp.\n2. Te presionan para transferir \"ya mismo\".\n3. Te ofrecen premios o préstamos fáciles a cambio de un pago.\n4. El mensaje tiene enlaces raros o errores de ortografía.\n5. Alguien dice ser de Banklite y te llama desde un número desconocido.\n\nBanklite nunca te pedirá tu clave. Si dudas, cuelga y llama a la Línea Banklite."
    }
};

function initHome() {

    // -----------------------------------------------------
    // MENÚ MÓVIL Y MEGAMENÚ
    // -----------------------------------------------------

    const header = document.getElementById("hmHeader");
    const burger = document.getElementById("hmBurger");
    const mobile = document.getElementById("hmMobile");

    burger?.addEventListener("click", () => {
        const open = mobile.classList.toggle("open");
        burger.classList.toggle("open", open);
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });

    mobile?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
        mobile.classList.remove("open");
        burger.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
    }));

    const megaButton = document.getElementById("megaButton");
    const megaItem = megaButton?.closest(".hm-nav-item");

    function setMega(open) {
        megaItem?.classList.toggle("open", open);
        megaButton?.setAttribute("aria-expanded", String(open));
    }

    megaButton?.addEventListener("click", event => {
        event.stopPropagation();
        setMega(!megaItem.classList.contains("open"));
    });

    document.addEventListener("click", event => {
        if (!megaItem?.contains(event.target)) setMega(false);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setMega(false);
    });

    document.querySelectorAll(".hm-mega a").forEach(link => link.addEventListener("click", () => setMega(false)));

    // Sombra del header al bajar
    const paintHeader = () => header?.classList.toggle("scrolled", window.scrollY > 10);
    window.addEventListener("scroll", paintHeader, { passive: true });
    paintHeader();


    // -----------------------------------------------------
    // CARRUSEL
    // -----------------------------------------------------

    const slides = Array.from(document.querySelectorAll(".hm-slide"));
    const dots = Array.from(document.querySelectorAll("#hmDots button"));
    const pauseButton = document.getElementById("hmPause");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = 0;
    let paused = reduceMotion;
    let timer = null;

    function goTo(index) {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
            slide.classList.toggle("is-active", i === current);
            slide.setAttribute("aria-hidden", String(i !== current));
            slide.querySelectorAll("a, button").forEach(el => el.tabIndex = i === current ? 0 : -1);
        });
        document.querySelector(".hm-hero")?.classList.toggle("is-dark", slides[current].classList.contains("hm-slide-2"));
        dots.forEach((dot, i) => {
            dot.classList.toggle("is-active", i === current);
            dot.setAttribute("aria-selected", String(i === current));
        });
        restart();
    }

    function restart() {
        clearInterval(timer);
        document.querySelector(".hm-hero")?.classList.toggle("is-paused", paused);
        if (!paused) timer = setInterval(() => goTo(current + 1), 6500);
    }

    dots.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));
    document.getElementById("hmPrev")?.addEventListener("click", () => goTo(current - 1));
    document.getElementById("hmNext")?.addEventListener("click", () => goTo(current + 1));

    pauseButton?.addEventListener("click", () => {
        paused = !paused;
        pauseButton.setAttribute("aria-pressed", String(paused));
        pauseButton.setAttribute("aria-label", paused ? "Reanudar carrusel" : "Pausar carrusel");
        pauseButton.innerHTML = paused
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
        restart();
    });

    // Deslizar con el dedo en el celular
    let touchX = null;
    const slider = document.getElementById("hmSlides");
    slider?.addEventListener("touchstart", event => { touchX = event.touches[0].clientX; }, { passive: true });
    slider?.addEventListener("touchend", event => {
        if (touchX === null) return;
        const diff = event.changedTouches[0].clientX - touchX;
        if (Math.abs(diff) > 50) goTo(current + (diff < 0 ? 1 : -1));
        touchX = null;
    });

    goTo(0);


    // -----------------------------------------------------
    // PESTAÑAS DE PRODUCTOS
    // -----------------------------------------------------

    const tabs = document.querySelectorAll(".hm-tab");

    function showTab(name) {
        tabs.forEach(tab => {
            const active = tab.dataset.tab === name;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", String(active));
            document.getElementById("tab-" + tab.dataset.tab).hidden = !active;
        });
    }

    tabs.forEach(tab => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
    document.querySelectorAll("[data-tab-link]").forEach(link =>
        link.addEventListener("click", () => showTab(link.dataset.tabLink)));


    // -----------------------------------------------------
    // ARTÍCULOS Y "PRÓXIMAMENTE"
    // -----------------------------------------------------

    document.querySelectorAll("[data-article]").forEach(button => button.addEventListener("click", () => {
        const article = HOME_ARTICLES[button.dataset.article];
        if (article) showMessage(article.title, article.text, "i");
    }));

    document.querySelectorAll("[data-soon]").forEach(button => button.addEventListener("click", event => {
        event.preventDefault();
        showMessage("Muy pronto", `${button.dataset.soon} estará disponible próximamente.`, "i");
    }));

    // Si ya hay sesión abierta, "Ingresar" lleva directo al dashboard
    if (hasSession()) {
        document.querySelectorAll('.hm-actions a[href="login.html"], .hm-mobile-actions a[href="login.html"]').forEach(link => {
            link.href = "dashboard.html";
            link.lastChild.textContent = " Mi Banklite";
        });
    }
}


// =========================================================
// ASISTENTE BANKI (burbuja del dashboard y ayuda.html)
// Responde con información general; no lee datos de la cuenta.
// =========================================================

const BOT_NAME = "Banki";

// Quita tildes, signos y mayúsculas para comparar palabras
function botNormalize(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9ñ@\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function botLogged() {
    return hasSession();
}

// Cada tema: palabras clave (con peso), pregunta frecuente y respuesta.
// Solo describe funciones que existen; lo demás se marca "Próximamente".
const BOT_SOON = "Esta función estará disponible **próximamente** en Banklite.";

const BOT_TOPICS = [
    // --- Conversación ---
    { id: "hola", keys: ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hey", "saludos", "que tal"], small: true,
      answer: () => ({ text: `¡Hola! Soy ${BOT_NAME}, tu asistente de Banklite. ¿En qué te ayudo?`, chips: ["¿Cómo hago una transferencia?", "¿Cómo congelo mi tarjeta?", "¿Dónde descargo mi extracto?"] }) },
    { id: "gracias", keys: ["gracias", "muchas gracias", "te agradezco", "genial", "perfecto", "listo"], small: true,
      answer: () => ({ text: "¡Con gusto! Si necesitas algo más de tu cuenta, aquí estoy." }) },
    { id: "chao", keys: ["chao", "adios", "hasta luego", "nos vemos", "bye"], small: true,
      answer: () => ({ text: "¡Hasta pronto! Cuida tu clave y no la compartas con nadie." }) },
    { id: "quien", keys: ["quien eres", "como te llamas", "tu nombre", "que eres", "eres un robot", "eres humano", "que haces", "que puedes hacer", "ayudame", "ayuda"], small: true,
      answer: () => ({ text: `Soy ${BOT_NAME}, el asistente virtual de Banklite. Te oriento sobre tu cuenta, transferencias, pagos, extractos, tu tarjeta débito y seguridad.\nNo veo los datos de tu cuenta: tu saldo y tus movimientos están en el inicio.`, chips: ["¿Cómo abro una cuenta?", "¿Cómo hago una transferencia?"] }) },
    { id: "humano", keys: ["asesor", "humano", "persona real", "hablar con alguien", "llamar", "telefono", "linea", "contacto", "correo", "horario", "atencion"],
      faq: "¿Cómo hablo con un asesor?", cat: "cuenta",
      answer: () => ({ text: "Puedes comunicarte con un asesor por la **Línea Banklite 601 000 0000** (24 horas) o escribir a **ayuda@banklite.co**." }) },

    // --- Cuenta ---
    { id: "saldo", keys: ["saldo", "cuanto tengo", "cuanta plata", "cuanto dinero", "dinero tengo", "plata tengo", "disponible"],
      faq: "¿Dónde veo mi saldo?", cat: "cuenta",
      answer: () => ({ text: "Tu saldo aparece en el inicio de tu cuenta, oculto por defecto: tócalo con el ícono del ojo para verlo. Junto a él ves tus límites diario y mensual.", links: botLogged() ? [{ label: "Ir al inicio", href: "dashboard.html" }] : [{ label: "Ingresar", href: "login.html" }] }) },
    { id: "cuenta", keys: ["numero de cuenta", "mi cuenta", "numero cuenta", "datos de cuenta", "cuenta de ahorros", "cuenta corriente", "tipo de cuenta"],
      faq: "¿Cuál es mi número de cuenta?", cat: "cuenta",
      answer: () => ({ text: "Tu número de cuenta tiene 11 dígitos. En el inicio, toca el ícono del ojo junto a tu saldo para verlo completo; con ese número otra persona de Banklite te puede transferir.", links: [{ label: "Ir al inicio", href: "dashboard.html" }] }) },
    { id: "abrir", keys: ["abrir cuenta", "abro una cuenta", "abrir una cuenta", "crear cuenta", "registrarme", "registro", "nueva cuenta", "requisitos", "como me registro"],
      faq: "¿Cómo abro una cuenta?", cat: "cuenta",
      answer: () => ({ text: "Es 100% digital: llenas tus datos, verificamos tu identidad, tu correo y tu celular con un código, eliges tu usuario y una clave de 4 dígitos. Luego, en el inicio, abres tu cuenta de ahorros o corriente.", links: [{ label: "Abrir mi cuenta", href: "registro.html" }] }) },
    { id: "costos", keys: ["cuota de manejo", "cuanto cuesta la cuenta", "cuesta la cuenta", "cuanto cuesta tener", "costo de la cuenta", "cobran", "cobro de manejo", "comision", "es gratis", "tarifas"],
      faq: "¿Cuánto cuesta tener una cuenta Banklite?", cat: "cuenta",
      answer: () => ({ text: "Nada. La cuenta Banklite **no tiene cuota de manejo** y las transferencias entre cuentas Banklite no tienen costo." }) },
    { id: "movimientos", keys: ["movimientos", "historial", "extracto", "estado de cuenta", "csv", "excel", "mis gastos", "en que gaste"],
      faq: "¿Dónde descargo mi extracto?", cat: "cuenta",
      answer: () => ({ text: "En **Movimientos** ves tu historial con filtros (entradas, salidas, transferencias) y búsqueda. Desde ahí descargas el extracto de cualquier mes en PDF o lo que estás viendo en Excel (CSV).", links: [{ label: "Ir a movimientos", href: "movimientos.html" }] }) },
    { id: "comprobante", keys: ["comprobante", "recibo", "soporte", "constancia", "pdf de la transferencia"],
      faq: "¿Cómo descargo un comprobante?", cat: "cuenta",
      answer: () => ({ text: "Al terminar una transferencia puedes descargar el comprobante en PDF. Si lo necesitas después, entra a **Movimientos**, toca la operación y elige \"Descargar comprobante\".", links: [{ label: "Ir a movimientos", href: "movimientos.html" }] }) },
    { id: "certificado", keys: ["certificado", "saco un certificado", "sacar un certificado", "certificacion bancaria", "certificado de cuenta", "referencia bancaria"],
      faq: "¿Cómo saco un certificado de mi cuenta?", cat: "cuenta",
      answer: () => ({ text: "En el inicio, abre **Mi perfil → Certificado de cuenta**. Puedes elegir si incluye el saldo y lo descargas en PDF.", links: [{ label: "Ir al inicio", href: "dashboard.html" }] }) },
    { id: "datos", keys: ["mis datos", "cambiar correo", "cambiar celular", "actualizar datos", "datos personales", "mi perfil"],
      faq: "¿Dónde veo mis datos?", cat: "cuenta",
      answer: () => ({ text: "En el inicio, abre **Mi perfil → Mis datos**. Ahí ves la información con la que te registraste. Para cambiar tu correo o celular, escríbenos a ayuda@banklite.co.", links: [{ label: "Ir al inicio", href: "dashboard.html" }] }) },
    { id: "eliminar", keys: ["eliminar cuenta", "cerrar cuenta", "cancelar cuenta", "cancelo mi cuenta", "cierro mi cuenta", "borrar cuenta", "darme de baja"],
      faq: "¿Cómo cancelo mi cuenta?", cat: "cuenta",
      answer: () => ({ text: "Por ahora la cancelación no se hace desde la app. Escríbenos a **ayuda@banklite.co** y te ayudamos; antes, transfiere tu saldo a otra cuenta." }) },
    { id: "tema", keys: ["modo oscuro", "tema oscuro", "modo claro", "apariencia", "dark"],
      faq: "¿Cómo activo el modo oscuro?", cat: "cuenta",
      answer: () => ({ text: "En el inicio, abre **Configuración** y en **Apariencia** elige Claro, Oscuro o Automático (según tu celular o computador)." }) },
    { id: "recibir", keys: ["recibir plata", "recibir dinero", "meter plata", "ingresar plata", "consignar", "consignacion", "depositar", "deposito", "cargar saldo", "como me pagan", "recibo plata", "me transfieran", "plata a mi cuenta", "plata en mi cuenta", "meto plata", "recibo plata en mi cuenta"],
      faq: "¿Cómo recibo plata en mi cuenta?", cat: "cuenta",
      answer: () => ({ text: "Te pueden enviar plata de tres formas: a tu **número de cuenta** (11 dígitos), a una de tus **llaves Bre-B** (celular, correo, cédula o @llave) o pagándote con tu **código QR de cobro**. Entre cuentas Banklite llega al instante y te avisamos en la campana. También puedes cambiar tus **Puntos Banklite** por plata a tu cuenta.", links: [{ label: "Mis llaves", href: "llaves.html" }, { label: "Mi QR de cobro", href: "qr.html" }] }) },
    { id: "pendiente", keys: ["cuenta pendiente", "pendiente", "no esta activa", "no se activa", "activar cuenta", "activar mi cuenta", "cuenta inactiva", "verificacion de identidad", "verificar identidad", "mi cuenta aparece pendiente", "mi cuenta sale pendiente", "mi cuenta esta pendiente", "aparece pendiente", "sale pendiente"],
      faq: "Mi cuenta aparece pendiente, ¿qué hago?", cat: "cuenta",
      answer: () => ({ text: "Tu cuenta queda **pendiente** mientras confirmamos tu identidad y se activa sola en cuanto se confirma. Mientras tanto no puedes transferir ni emitir tu tarjeta. Si lleva mucho tiempo pendiente, escríbenos a **ayuda@banklite.co**." }) },
    { id: "requisitos", keys: ["menor de edad", "edad minima", "cuantos anos", "para menores", "mi hijo", "quien puede abrir", "que necesito para abrir", "requisitos para abrir", "quien puede abrir una cuenta"],
      faq: "¿Quién puede abrir una cuenta Banklite?", cat: "cuenta",
      answer: () => ({ text: "Cualquier persona **mayor de 18 años** con su documento de identidad, un correo y un celular propios: verificamos tu identidad y te enviamos códigos al correo y por WhatsApp. No se abren cuentas para menores de edad.", links: [{ label: "Abrir mi cuenta", href: "registro.html" }] }) },
    { id: "real", keys: ["es real", "banco real", "es confiable", "es legal", "superfinanciera", "superintendencia", "vigilado", "proyecto academico", "plata real", "dinero real", "es una estafa"],
      faq: "¿Banklite es un banco real?", cat: "cuenta",
      answer: () => ({ text: "Banklite es un **proyecto académico** de Modelamiento de Software: funciona como un banco digital, pero **no es una entidad financiera vigilada** por la Superintendencia Financiera y la plata que ves no es dinero real. Las facturas, los envíos a otros bancos y las promociones son de demostración.", links: [{ label: "Términos de uso", href: "terminos.html" }] }) },
    { id: "app", keys: ["aplicacion", "app", "play store", "app store", "descargar la app", "instalar", "android", "iphone", "desde el celular", "instalo"],
      faq: "¿Banklite tiene app para el celular?", cat: "cuenta",
      answer: () => ({ text: "Banklite funciona desde el **navegador** de tu celular o computador, sin instalar nada: entra, ingresa con tu usuario y clave, y se adapta a la pantalla. Por ahora no hay app en Play Store ni App Store." }) },
    { id: "horario", keys: ["fin de semana", "fines de semana", "festivo", "festivos", "domingo", "a cualquier hora", "horario de transferencias", "de noche", "24 horas", "24/7"],
      faq: "¿Puedo usar Banklite a cualquier hora?", cat: "cuenta",
      answer: () => ({ text: "Sí. Banklite funciona **24 horas, todos los días**, incluidos fines de semana y festivos: las transferencias entre cuentas Banklite, los pagos y los QR se procesan al instante a cualquier hora." }) },

    // --- Transferencias ---
    { id: "transferir", keys: ["transferir", "transferencia", "enviar plata", "enviar dinero", "mandar plata", "pasar plata", "girar"],
      faq: "¿Cómo hago una transferencia?", cat: "transferencias",
      answer: () => ({ text: "Ve a **Transferir**, elige Banklite, escribe el número de cuenta de 11 dígitos, el valor y el concepto. Revisa los datos y confirma: entre cuentas Banklite llega al instante. Si algo está mal, toca *Corregir* y la solicitud se cancela.", links: [{ label: "Transferir", href: "transferir.html" }] }) },
    { id: "otrosbancos", keys: ["otro banco", "otros bancos", "bancolombia", "nequi", "daviplata", "davivienda", "billetera"],
      faq: "¿Puedo transferir a otros bancos?", cat: "transferencias",
      answer: () => ({ text: "Sí. En **Transferir** eliges el banco (Bancolombia, Banco de Bogotá, Davivienda, BBVA, Banco de Occidente u otra entidad) o la billetera (Nequi o DaviPlata), escribes el tipo y número de cuenta (en billeteras, el celular) y el nombre de quien recibe, y confirmas con tu clave dinámica. El dinero sale de tu cuenta de inmediato. Banklite no está conectado a la red interbancaria, así que la llegada al otro banco es de demostración.", links: [{ label: "Transferir", href: "transferir.html" }] }) },
    { id: "limites", keys: ["minimo", "maximo", "tope", "cuanto puedo enviar", "cuanto puedo transferir", "limite de transferencia", "limite diario", "limite mensual", "limites"],
      faq: "¿Cuánto puedo transferir?", cat: "transferencias",
      answer: () => ({ text: "Puedes enviar hasta tu saldo disponible, dentro de los **límites diario y mensual** de tu cuenta. Los ves en el inicio, junto a tu saldo." }) },
    { id: "tarda", keys: ["cuanto tarda", "cuanto se demora", "demora", "se demora", "tarda en llegar", "no ha llegado", "no le llego", "no me ha llegado", "no le ha llegado", "cuando llega"],
      faq: "¿Cuánto tarda en llegar una transferencia?", cat: "transferencias",
      answer: () => ({ text: "Entre cuentas Banklite (por número de cuenta, llave Bre-B o QR) llega **al instante**, a cualquier hora. A otros bancos y billeteras la plata sale de tu cuenta de inmediato, pero la llegada es de demostración: Banklite no está conectado a la red interbancaria. Si no ves un movimiento, revisa **Movimientos**.", links: [{ label: "Ver movimientos", href: "movimientos.html" }] }) },
    { id: "cancelartransf", keys: ["cancelar transferencia", "cancelar una transferencia", "reversar", "anular", "anular transferencia", "devolver transferencia", "deshacer", "echar para atras", "reversar una transferencia", "reversar la transferencia", "reversar mi transferencia"],
      faq: "¿Puedo cancelar una transferencia?", cat: "transferencias",
      answer: () => ({ text: "Solo **antes de confirmarla**: en la pantalla de revisión toca *Corregir* y la solicitud se cancela sin mover plata. Una vez confirmada, la transferencia **no se puede reversar desde la app**; si te equivocaste de cuenta, escríbenos a ayuda@banklite.co con el comprobante." }) },
    { id: "costotransf", keys: ["cuanto cuesta transferir", "cobran por transferir", "costo de transferencia", "costo por transferir", "comision por transferir", "cuesta enviar", "cobran por enviar"],
      faq: "¿Cuánto cuesta transferir?", cat: "transferencias",
      answer: () => ({ text: "Nada. Banklite **no cobra comisión** por transferir: ni entre cuentas Banklite, ni con llave Bre-B, ni a otros bancos o billeteras. Tampoco por pagar con QR, pagar facturas o recargar." }) },
    { id: "nopuedo", keys: ["no puedo transferir", "no me deja transferir", "transferencia rechazada", "error al transferir", "fondos insuficientes", "saldo insuficiente", "supera el limite", "no me deja pagar", "no puedo pagar"],
      faq: "¿Por qué no puedo transferir?", cat: "transferencias",
      answer: () => ({ text: "Revisa estos puntos:\n• Que tengas **saldo** suficiente.\n• Que no superes tus **límites diario o mensual** (los ves en el inicio).\n• Que tu cuenta esté **activa** (no pendiente ni bloqueada).\n• Que la **clave dinámica** sea la vigente: si fallas 5 veces se bloquea 15 minutos.\nEl mensaje de error te dice cuál de estos fue." }) },
    { id: "dinamica", keys: ["clave dinamica", "que es la clave dinamica", "donde veo la clave dinamica", "token", "codigo de 6 digitos para transferir", "clave de 6 digitos"],
      faq: "¿Qué es la clave dinámica?", cat: "seguridad",
      answer: () => ({ text: "Es un código de **6 dígitos que cambia cada 60 segundos** y confirma que eres tú al mover plata. La ves arriba en el inicio (tócala para copiarla). Se usa al transferir, pagar, pagar con QR, registrar o eliminar llaves Bre-B y cambiar el límite de tu tarjeta. Si la escribes mal 5 veces, se bloquea 15 minutos. **Nunca la compartas.**", links: [{ label: "Ir al inicio", href: "dashboard.html" }] }) },

    // --- Tarjeta ---
    { id: "promociones", keys: ["promociones", "promocion", "beneficios", "descuentos", "descuento", "2x1", "codigo de descuento", "cupon"],
      faq: "¿Qué promociones tengo con mi tarjeta?", cat: "tarjeta",
      answer: () => ({ text: "En el inicio, **Promociones con tu tarjeta** muestra descuentos en restaurantes, viajes, compras online y cine. Es una **simulación académica**: las marcas no tienen alianza con Banklite y los códigos no sirven en ningún comercio.", links: [{ label: "Ver promociones", href: "dashboard.html" }] }) },
    { id: "bloquear", keys: ["bloquear tarjeta", "bloquear", "congelar", "congelo", "congelo mi tarjeta", "bloqueo mi tarjeta", "perdi mi tarjeta", "perdi la tarjeta", "me robaron", "robo", "tarjeta perdida", "desbloquear", "reactivar"],
      faq: "¿Cómo congelo mi tarjeta?", cat: "tarjeta",
      answer: () => ({ text: "En el inicio, sección **Tarjetas**, usa el interruptor para **congelarla**. Queda congelada al instante y la reactivas con el mismo interruptor.", links: [{ label: "Ir a mi tarjeta", href: "dashboard.html#tarjetas" }] }) },
    { id: "limitetarjeta", keys: ["limite de compras", "limite tarjeta", "limite de la tarjeta", "limite diario de mi tarjeta", "cambio el limite", "cupo", "subir limite", "bajar limite", "cuanto puedo comprar"],
      faq: "¿Cómo cambio el límite diario de mi tarjeta?", cat: "tarjeta",
      answer: () => ({ text: "En el inicio, **Tarjeta débito → Límite diario de compras**, toca *Cambiar*. Eliges entre $100.000 y el límite diario de tu cuenta, y lo confirmas escribiendo tu clave dinámica de 6 dígitos. Ahí mismo ves cuánto llevas usado hoy; cuentan las compras y los cobros de suscripciones del día (hora de Colombia).", links: [{ label: "Ir a mi tarjeta", href: "dashboard.html#tarjetas" }] }) },
    { id: "internet", keys: ["compras por internet", "compras online", "comprar en internet", "comprar por internet", "tienda online", "pagos en linea", "simular compra"],
      faq: "¿Puedo comprar por internet con la tarjeta?", cat: "tarjeta",
      answer: () => ({ text: "Sí, mientras tengas activo el interruptor **Compras por internet** en el control de tu tarjeta. Si lo apagas, rechazamos las compras online y también los cobros de tus suscripciones. Con *Simular compra con la tarjeta* puedes probar tus controles: si la compra se aprueba, se descuenta de verdad de tu saldo.", links: [{ label: "Ir a mi tarjeta", href: "dashboard.html#tarjetas" }] }) },
    { id: "tarjeta", keys: ["tarjeta", "tarjeta debito", "visa", "cvv", "vencimiento", "datos de la tarjeta", "emitir tarjeta", "pedir tarjeta"],
      faq: "¿Cómo obtengo y veo mi tarjeta?", cat: "tarjeta",
      answer: () => ({ text: "En **Tarjetas** toca *Emitir tarjeta*. El número completo y el **CVV se muestran una sola vez**, al emitirla: guárdalos. Después, *Mostrar datos* te deja ver el número completo por unos segundos.", links: [{ label: "Ir a mi tarjeta", href: "dashboard.html#tarjetas" }] }) },
    { id: "rechazada", keys: ["compra rechazada", "rechazaron mi compra", "rechazaron la compra", "no pasa la tarjeta", "tarjeta rechazada", "no me deja comprar", "declinada", "no paso la compra"],
      faq: "¿Por qué rechazaron mi compra con la tarjeta?", cat: "tarjeta",
      answer: () => ({ text: "Revisamos, en este orden:\n• Que la tarjeta **no esté congelada**.\n• Que tengas activas las **compras por internet** (si es una compra online o una suscripción).\n• Que no superes tu **límite diario de compras**.\n• Que tengas **saldo** suficiente.\nTe avisamos el motivo en la campana y por correo.", links: [{ label: "Ir a mi tarjeta", href: "dashboard.html#tarjetas" }] }) },
    { id: "fisica", keys: ["tarjeta fisica", "plastico", "cajero", "cajeros", "retirar efectivo", "retiro en efectivo", "sacar efectivo", "datafono"],
      faq: "¿Tienen tarjeta física o retiros en cajero?", cat: "tarjeta",
      answer: () => ({ text: "No. La tarjeta Banklite es **débito virtual**: sirve para compras por internet y suscripciones, y no tiene plástico ni retiros en cajero. Con *Simular compra con la tarjeta* puedes probar una compra en tienda física.", links: [{ label: "Ir a mi tarjeta", href: "dashboard.html#tarjetas" }] }) },
    { id: "cvvperdido", keys: ["perdi el cvv", "no guarde el cvv", "olvide el cvv", "ver el cvv", "ver mi cvv", "donde esta el cvv"],
      faq: "No guardé el CVV de mi tarjeta, ¿qué hago?", cat: "tarjeta",
      answer: () => ({ text: "Por seguridad el **CVV se muestra una sola vez**, al emitir la tarjeta, y no se guarda en ningún lado, así que no se puede volver a ver. Escríbenos a **ayuda@banklite.co** para ayudarte." }) },

    // --- Seguridad ---
    { id: "cambiarclave", keys: ["cambiar clave", "cambiar mi clave", "cambio mi clave", "cambio la clave", "nueva clave", "cambiar contrasena", "cambiar pin"],
      faq: "¿Cómo cambio mi clave?", cat: "seguridad",
      answer: () => ({ text: "En el inicio, abre **Mi perfil → Cambiar clave**. Te enviamos un código a tu correo y eliges una clave nueva de 4 dígitos. No puede ser tu fecha de nacimiento ni números seguidos como 1234." }) },
    { id: "olvide", keys: ["olvide", "olvide mi clave", "no recuerdo", "recuperar clave", "recuperar contrasena", "clave bloqueada"],
      faq: "Olvidé mi clave, ¿qué hago?", cat: "seguridad",
      answer: () => ({ text: "En la pantalla de ingreso toca **¿Olvidaste tu clave?**. Te enviamos un código de 6 dígitos a tu correo y luego creas una clave nueva.", links: [{ label: "Ir al ingreso", href: "login.html" }] }) },
    { id: "codigos", keys: ["codigo", "codigos", "codigo de verificacion", "no me llega el codigo", "whatsapp", "6 digitos", "seis digitos"],
      faq: "¿Para qué son los códigos que me llegan?", cat: "seguridad",
      answer: () => ({ text: "Te enviamos códigos de 6 dígitos por correo o WhatsApp para verificar que eres tú al registrarte o cambiar tu clave. Vencen en 5 minutos y puedes pedir otro a los 30 segundos. **Nadie de Banklite te los va a pedir.**" }) },
    { id: "fraude", keys: ["fraude", "estafa", "phishing", "me llamaron", "mensaje sospechoso", "me pidieron la clave", "seguridad", "seguro", "hackearon"],
      faq: "¿Cómo me protejo del fraude?", cat: "seguridad",
      answer: () => ({ text: "**Banklite nunca te pedirá tu clave ni tus códigos** por llamada, correo, WhatsApp o redes. Si alguien te los pide, es fraude: cuelga, no compartas nada y congela tu tarjeta si crees que la vieron. Luego llama a la Línea Banklite 601 000 0000." }) },
    { id: "sesion", keys: ["cerro la sesion", "se cerro", "inactividad", "me saco", "sesion cerrada", "cerrar sesion", "salir"],
      faq: "¿Por qué se cerró mi sesión?", cat: "seguridad",
      answer: () => ({ text: "Por tu seguridad, la sesión se cierra sola después de **5 minutos sin actividad**, y también al cerrar la pestaña. Antes te avisamos para que puedas seguir. Para salir tú mismo, usa el botón **Salir** arriba a la derecha." }) },
    { id: "notificaciones", keys: ["notificaciones", "avisos", "alertas", "campana"],
      faq: "¿Dónde veo mis notificaciones?", cat: "seguridad",
      answer: () => ({ text: "Toca la **campana** arriba en el inicio. Ahí te avisamos, por ejemplo, de las transferencias y consignaciones que recibes." }) },
    { id: "reclamo", keys: ["reclamo", "queja", "compra no reconocida", "no reconozco", "cobro no reconocido", "me cobraron", "cobro doble", "devolucion", "transferencia equivocada", "me equivoque"],
      faq: "No reconozco un movimiento, ¿qué hago?", cat: "seguridad",
      answer: () => ({ text: "Primero **congela tu tarjeta** desde el inicio si crees que alguien la usó. Luego revisa el movimiento en **Movimientos** y descarga el comprobante. Con eso llama a la Línea Banklite 601 000 0000 o escribe a ayuda@banklite.co. Una transferencia confirmada no se puede reversar desde la app.", links: [{ label: "Ver movimientos", href: "movimientos.html" }] }) },
    { id: "legal", keys: ["terminos", "condiciones", "privacidad", "datos personales tratamiento", "politica"],
      faq: "¿Dónde leo los términos y la política de privacidad?", cat: "cuenta",
      answer: () => ({ text: "Los puedes leer en cualquier momento:", links: [{ label: "Términos de uso", href: "terminos.html" }, { label: "Privacidad", href: "privacidad.html" }] }) },
    { id: "bloqueado", keys: ["usuario bloqueado", "bloqueado por intentos", "intentos fallidos", "me bloquearon", "no puedo entrar", "no puedo ingresar", "no me deja entrar", "no me deja ingresar", "quedo bloqueado", "usuario quedo bloqueado", "se bloqueo mi usuario", "me bloqueo"],
      faq: "No puedo ingresar o mi usuario se bloqueó", cat: "seguridad",
      answer: () => ({ text: "Si escribes mal tu clave **5 veces seguidas**, el ingreso se bloquea **30 minutos** por seguridad. Espera y vuelve a intentarlo, o toca **¿Olvidaste tu clave?** para crear una nueva con un código que te enviamos al correo. Si el bloqueo sigue, llama a la Línea Banklite 601 000 0000.", links: [{ label: "Ir al ingreso", href: "login.html" }] }) },
    { id: "privacidad", keys: ["mis datos estan seguros", "proteccion de datos", "cifrado", "encriptado", "comparten mis datos", "venden mis datos", "quien ve mis datos", "mis datos estan protegidos", "datos estan protegidos"],
      faq: "¿Mis datos están protegidos?", cat: "seguridad",
      answer: () => ({ text: "Sí. Tus datos personales se guardan **cifrados** y solo se usan para verificar tu identidad, enviarte códigos y avisos de tu cuenta. Tu clave nunca se guarda tal cual y el número de tu tarjeta va cifrado. Puedes leer cómo los tratamos en la política de privacidad.", links: [{ label: "Privacidad", href: "privacidad.html" }] }) },
    { id: "celular", keys: ["perdi mi celular", "perdi el celular", "me robaron el celular", "celular robado", "cambie de celular", "nuevo celular", "cambie de numero"],
      faq: "Perdí mi celular, ¿qué hago?", cat: "seguridad",
      answer: () => ({ text: "Desde otro dispositivo, ingresa a Banklite y **congela tu tarjeta**; luego **cambia tu clave** desde Mi perfil. Llama a la Línea Banklite 601 000 0000 o escribe a ayuda@banklite.co para actualizar tu número de celular.", links: [{ label: "Ir al ingreso", href: "login.html" }] }) },

    // --- Llaves, QR, pagos, ahorro y puntos ---
    { id: "breb", keys: ["bre b", "breb", "que es bre", "pagos inmediatos", "llave", "llaves"],
      faq: "¿Banklite tiene llaves Bre-B?", cat: "transferencias",
      answer: () => ({ text: "Sí. **Bre-B** es el sistema de pagos inmediatos de Colombia: con una llave te envían plata sin tu número de cuenta. En **Llaves Bre-B** registras tu celular, correo y cédula (los que verificaste en Banklite) y una @llave personalizada; registrar o eliminar una llave se confirma con tu clave dinámica. Para enviar, en **Transferir** eliges Bre-B, escribes la llave y te mostramos a nombre de quién está. Por ahora funciona entre cuentas Banklite.", links: [{ label: "Mis llaves", href: "llaves.html" }, { label: "Enviar con llave", href: "transferir.html?breb=1" }] }) },
    { id: "qr", keys: ["pagar con qr", "escanear", "leer qr", "codigo qr", "qr", "cobrar con qr", "mi qr"],
      faq: "¿Puedo pagar con QR?", cat: "transferencias",
      answer: () => ({ text: "Sí. En **Pagar con QR** creas tu código de cobro (con o sin valor) con una de tus llaves Bre-B o tu número de cuenta, o escaneas con la cámara (o subiendo una foto) el QR de otra persona o de un comercio para pagarle. Se descuenta de tu saldo, se confirma con tu clave dinámica y te queda el comprobante en PDF. Por ahora funciona entre cuentas Banklite.", links: [{ label: "Ir a QR", href: "qr.html" }] }) },
    { id: "pagos", keys: ["factura", "facturas", "servicios publicos", "pagar la luz", "pagar el agua", "pagar el gas", "internet", "administracion", "recarga", "recargar", "recargar celular", "paquete de datos"],
      faq: "¿Puedo pagar facturas o recargar el celular?", cat: "transferencias",
      answer: () => ({ text: "Sí. En **Pagos y recargas** pagas facturas de servicios públicos, internet y administración con la referencia del recibo, o recargas tu celular Claro, Movistar, Tigo, WOM o Virgin Mobile (de $1.000 a $500.000). Se descuenta de tu saldo, se confirma con tu clave dinámica y te queda el comprobante en PDF. Las facturas son de demostración: Banklite no está conectado a los convenios reales.", links: [{ label: "Ir a pagos", href: "pagos.html" }] }) },
    { id: "ahorro", keys: ["bolsillo", "bolsillos", "apartar plata", "separar plata", "ahorrar", "cdt", "invertir", "inversion", "plazo fijo", "rentabilidad", "intereses", "meta", "metas", "meta de ahorro"],
      faq: "¿Tienen bolsillos, CDT o metas de ahorro?", cat: "ahorro",
      answer: () => ({ text: "Sí. En **Bolsillos y CDT** apartas plata en bolsillos que ganan 9% E.A. y puedes sacar cuando quieras, o abres un CDT desde $500.000 a 30, 60, 90, 180 o 360 días (de 8,5% a 11% E.A., con retención del 4% sobre los intereses); el CDT no se puede retirar antes de vencer. En el inicio, sección **Mis metas**, creas metas de ahorro con monto y fecha y les abonas cuando quieras. Lo que apartas sale de tu saldo disponible y vuelve cuando lo sacas.", links: [{ label: "Bolsillos y CDT", href: "inversiones.html" }, { label: "Mis metas", href: "dashboard.html#ahorro" }] }) },
    { id: "miano", keys: ["mi ano", "resumen del ano", "resumen anual", "wrapped", "personalidad financiera", "como me fue este ano"],
      faq: "¿Qué es Mi año en Banklite?", cat: "cuenta",
      answer: () => ({ text: "En el menú, **Mis finanzas → Mi año**, ves un resumen de tu año con tus movimientos reales: cuánto moviste, tu mes más activo, a quién más le transferiste, en qué usaste más tu plata, cuánto ahorraste, tus puntos y tu personalidad financiera. Al final puedes descargarlo como imagen.", links: [{ label: "Ver mi año", href: "dashboard.html#mi-ano" }] }) },
    { id: "puntos", keys: ["puntos", "mis puntos", "cuantos puntos", "nivel", "programa de puntos", "lealtad", "canjear", "canje", "redimir"],
      faq: "¿Hay programa de puntos?", cat: "ahorro",
      answer: () => ({ text: "Sí. Con **Puntos Banklite** ganas 1 punto por cada $1.000 en compras con tarjeta, facturas, recargas y pagos con QR (las transferencias no suman). Tu nivel multiplica: Plata x1,25 y Oro x1,5. Cada punto vale $10: cámbialos por plata a tu cuenta, una recarga a tu celular verificado o bonos. También hay retos de bienvenida que suman puntos extra.", links: [{ label: "Mis puntos", href: "puntos.html" }] }) },
    { id: "nivel", keys: ["subir de nivel", "subo de nivel", "nivel plata", "nivel oro", "nivel bronce", "como subo", "siguiente nivel"],
      faq: "¿Cómo subo de nivel en Puntos Banklite?", cat: "ahorro",
      answer: () => ({ text: "Tu nivel depende de los puntos que **has ganado** en total: **Bronce** desde 0, **Plata** desde 1.500 (x1,25 puntos) y **Oro** desde 5.000 (x1,5 puntos). Canjear puntos no te baja de nivel.", links: [{ label: "Mis puntos", href: "puntos.html" }] }) },
    { id: "vencenpuntos", keys: ["vencen los puntos", "se vencen los puntos", "puntos vencen", "caducan", "expiran los puntos", "vence el bono", "vence el cupon", "mis puntos se vencen", "puntos se vencen"],
      faq: "¿Mis puntos se vencen?", cat: "ahorro",
      answer: () => ({ text: "No, tus **puntos no se vencen**. Lo que sí vence son los **bonos** que canjeas: los tienes que usar en los **30 días** siguientes.", links: [{ label: "Mis puntos", href: "puntos.html" }] }) },
    { id: "interesbolsillo", keys: ["intereses del bolsillo", "interes del bolsillo", "cuando pagan intereses", "cuando me pagan los intereses", "cuanto gano", "rendimiento del bolsillo", "interes diario", "metas dan intereses", "metas generan intereses", "intereses de mi bolsillo", "intereses de los bolsillos"],
      faq: "¿Cuándo recibo los intereses de mi bolsillo?", cat: "ahorro",
      answer: () => ({ text: "Los bolsillos ganan **9% E.A.** y los intereses se causan **cada día**: los ves crecer en Bolsillos y CDT y se suman al bolsillo cuando le agregas o le sacas plata. Las **metas de ahorro no generan intereses**; son para organizar tu plata.", links: [{ label: "Bolsillos y CDT", href: "inversiones.html" }] }) },
    { id: "vencecdt", keys: ["vence el cdt", "vence mi cdt", "vencimiento del cdt", "cdt vencido", "cobrar el cdt", "cobrar cdt", "retirar el cdt", "sacar el cdt", "cdt antes"],
      faq: "¿Qué pasa cuando vence mi CDT?", cat: "ahorro",
      answer: () => ({ text: "Cuando llega la fecha de vencimiento, entra a **Bolsillos y CDT** y toca **Cobrar**: te devolvemos el capital y los intereses (ya con la retención del 4%) a tu saldo. Antes de vencer **no se puede retirar**.", links: [{ label: "Bolsillos y CDT", href: "inversiones.html" }] }) },
    { id: "cuantosbolsillos", keys: ["cuantos bolsillos", "varios bolsillos", "cuantas metas", "varias metas", "maximo de bolsillos", "maximo de metas", "cuanto minimo para ahorrar", "cuantos bolsillos puedo tener", "bolsillos y metas puedo tener", "cuantos bolsillos puedo"],
      faq: "¿Cuántos bolsillos y metas puedo tener?", cat: "ahorro",
      answer: () => ({ text: "Puedes tener hasta **8 bolsillos** y **10 metas de ahorro** activas. El valor mínimo para agregar o sacar plata es **$1.000**, y un CDT se abre desde **$500.000**.", links: [{ label: "Bolsillos y CDT", href: "inversiones.html" }, { label: "Mis metas", href: "dashboard.html#ahorro" }] }) },
    { id: "suscripciones", keys: ["suscripcion", "suscripciones", "netflix", "spotify", "cobro recurrente", "cobros automaticos", "pausar", "cancelar suscripcion"],
      faq: "¿Cómo funcionan las suscripciones?", cat: "tarjeta",
      answer: () => ({ text: "En el inicio, sección **Suscripciones**, inscribes servicios como Netflix o Spotify a tu tarjeta. Pagas el primer mes al inscribir y luego se cobra solo cada mes el mismo día; te avisamos 3 días antes. Si un cobro falla (tarjeta congelada, compras por internet desactivadas, límite diario o sin saldo) lo reintentamos 3 días y después se suspende. Puedes **pausar**, **reanudar** o **cancelar** cuando quieras.", links: [{ label: "Mis suscripciones", href: "dashboard.html#suscripciones" }] }) },
    { id: "credito", keys: ["credito", "prestamo", "prestan", "tarjeta de credito", "hipoteca", "libranza", "bitcoin", "cripto", "criptomonedas", "acciones", "seguro de vida", "dolares", "divisas"],
      faq: "¿Banklite ofrece créditos?", cat: "cuenta",
      answer: () => ({ text: "Banklite no ofrece créditos, tarjetas de crédito, criptomonedas ni cambio de divisas. Hoy tienes cuenta de ahorros o corriente, tarjeta débito, transferencias (a Banklite, con llave Bre-B y a otros bancos), pagos con QR, pago de facturas y recargas." }) }
];

const BOT_CATEGORIES = [
    { id: "cuenta", title: "Mi cuenta", text: "Saldo, extractos y datos", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
    { id: "transferencias", title: "Transferencias y pagos", text: "Enviar plata, pagar facturas y recargar", icon: "m22 2-7 20-4-9-9-4ZM22 2 11 13" },
    { id: "tarjeta", title: "Tarjeta débito", text: "Emitir, ver datos y congelar", icon: "M2 5h20v14H2zM2 10h20" },
    { id: "seguridad", title: "Seguridad", text: "Claves, códigos y fraude", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" },
    { id: "ahorro", title: "Ahorro y puntos", text: "Bolsillos, CDT, metas y puntos", icon: "M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v4h-4a2 2 0 0 0 0 4h4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" }
];

const BOT_OFF_TOPIC = [
    `Solo puedo ayudarte con temas de Banklite, como tu cuenta, transferencias, tarjeta o seguridad. 🙂`,
    `Esa pregunta se sale de lo que sé. Soy ${BOT_NAME} y solo respondo temas del banco.`,
    `Mmm, de eso no sé. Lo mío es Banklite: tu cuenta, tus transferencias y tu seguridad.`
];

// Busca el tema con más coincidencias
function botMatch(text) {
    const clean = ` ${botNormalize(text)} `;
    if (!clean.trim()) return null;

    let best = null;
    let bestScore = 0;
    const wordCount = clean.trim().split(" ").length;

    BOT_TOPICS.forEach(topic => {
        let score = 0;
        topic.keys.forEach(key => {
            const k = botNormalize(key);
            if (clean.includes(` ${k} `) || (k.length > 4 && clean.includes(k))) {
                score += k.split(" ").length * 2;   // las frases pesan más que una palabra
            }
        });
        // Saludos y charla solo cuentan en mensajes cortos, y nunca le ganan a un tema del banco
        if (topic.small && score) score = wordCount <= 4 ? score - 1 : 0;
        if (score > bestScore) {
            bestScore = score;
            best = topic;
        }
    });

    return best;
}

let botOffTopicCount = 0;

function botReply(text) {
    const topic = botMatch(text);
    if (topic) return topic.answer();

    const reply = BOT_OFF_TOPIC[botOffTopicCount % BOT_OFF_TOPIC.length];
    botOffTopicCount++;
    return { text: reply, chips: ["¿Cómo hago una transferencia?", "¿Dónde descargo mi extracto?", "¿Cómo me protejo del fraude?"] };
}

function botFormat(text) {
    return escapeHTML(text)
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/\*(.+?)\*/g, "<i>$1</i>")
        .replace(/\n/g, "<br>");
}


// Chat reutilizable: el mismo en la burbuja y en el Centro de ayuda
function createBotChat(root) {
    const log = root.querySelector(".bot-log");
    const form = root.querySelector(".bot-form");
    const input = root.querySelector(".bot-input");
    let started = false;

    function scroll() {
        log.scrollTop = log.scrollHeight;
    }

    function addUser(text) {
        log.insertAdjacentHTML("beforeend", `<div class="bot-msg is-user"><p>${escapeHTML(text)}</p></div>`);
        scroll();
    }

    function addBot(reply) {
        const links = (reply.links || []).map(link => `<a class="bot-link" href="${link.href}">${escapeHTML(link.label)} <span aria-hidden="true">→</span></a>`).join("");
        const chips = (reply.chips || []).map(chip => `<button type="button" class="bot-chip" data-bot-ask="${escapeHTML(chip)}">${escapeHTML(chip)}</button>`).join("");
        log.insertAdjacentHTML("beforeend", `
            <div class="bot-msg is-bot">
                <span class="bot-avatar" aria-hidden="true">${botAvatarSVG()}</span>
                <div>
                    <p>${botFormat(reply.text)}</p>
                    ${links ? `<div class="bot-links">${links}</div>` : ""}
                    ${chips ? `<div class="bot-chips">${chips}</div>` : ""}
                </div>
            </div>`);
        scroll();
    }

    function ask(text) {
        const question = String(text || "").trim();
        if (!question) return;
        addUser(question);

        log.insertAdjacentHTML("beforeend", `<div class="bot-msg is-bot bot-typing"><span class="bot-avatar" aria-hidden="true">${botAvatarSVG()}</span><div><p><i></i><i></i><i></i></p></div></div>`);
        scroll();

        setTimeout(() => {
            log.querySelector(".bot-typing")?.remove();
            addBot(botReply(question));
        }, 450 + Math.min(600, question.length * 12));
    }

    function start() {
        if (started) return;
        started = true;
        addBot({
            text: `¡Hola! Soy **${BOT_NAME}**, tu asistente de Banklite. Pregúntame sobre tu cuenta, transferencias, tu tarjeta o seguridad.`,
            chips: ["¿Cómo hago una transferencia?", "¿Cómo congelo mi tarjeta?", "¿Dónde descargo mi extracto?", "Olvidé mi clave"]
        });
    }

    form.addEventListener("submit", event => {
        event.preventDefault();
        ask(input.value);
        input.value = "";
        input.focus();
    });

    log.addEventListener("click", event => {
        const chip = event.target.closest("[data-bot-ask]");
        if (chip) ask(chip.dataset.botAsk);
    });

    return { ask, start, focus: () => input.focus() };
}

// Avatar de Banki: robot con los colores de Banklite (SVG dibujado aquí, sin imágenes)
let botSvgCount = 0;
function botAvatarSVG(full = false) {
    const id = `bkg${++botSvgCount}`;
    const head = `
        <line x1="60" y1="8" x2="60" y2="20" stroke="#1E9EA4" stroke-width="3" stroke-linecap="round"/>
        <circle cx="60" cy="8" r="5" fill="#2CCED2"/>
        <circle cx="58.5" cy="6.5" r="1.6" fill="#ffffff" opacity="0.8"/>
        <rect x="50" y="18" width="20" height="8" rx="3" fill="#1E9EA4"/>
        <rect x="18" y="24" width="84" height="70" rx="32" fill="url(#${id}h)"/>
        <ellipse cx="86" cy="38" rx="6" ry="3.6" fill="#ffffff" opacity="0.55" transform="rotate(-25 86 38)"/>
        <rect x="28" y="44" width="64" height="26" rx="13" fill="#26474E"/>
        <rect x="30" y="46" width="60" height="9" rx="4.5" fill="#ffffff" opacity="0.06"/>
        <circle cx="45" cy="57" r="7" fill="none" stroke="#B9EDED" stroke-width="2.4"/>
        <circle cx="75" cy="57" r="7" fill="none" stroke="#B9EDED" stroke-width="2.4"/>
        <circle cx="45" cy="57" r="3.6" fill="#ffffff"/>
        <circle cx="75" cy="57" r="3.6" fill="#ffffff"/>
        <circle cx="46.6" cy="55.4" r="1.2" fill="#26474E"/>
        <circle cx="76.6" cy="55.4" r="1.2" fill="#26474E"/>
        <path d="M51 77 h18 a9 7 0 0 1 -18 0z" fill="#ffffff"/>
        <path d="M54 81.5 q6 3 12 0" fill="none" stroke="#2CCED2" stroke-width="2" stroke-linecap="round"/>`;
    const defs = `
        <defs>
            <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#B9EDED"/>
                <stop offset="0.45" stop-color="#2CCED2"/>
                <stop offset="1" stop-color="#1A8E94"/>
            </linearGradient>
            <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#5ED9DC"/>
                <stop offset="1" stop-color="#1A8E94"/>
            </linearGradient>
        </defs>`;
    if (!full) {
        return `<svg class="bot-face" viewBox="10 2 100 96" aria-hidden="true">${defs}${head}</svg>`;
    }
    return `<svg class="bot-figure" viewBox="0 0 120 170" aria-hidden="true">${defs}
        <ellipse cx="60" cy="162" rx="28" ry="5" fill="#26474E" opacity="0.15"/>
        <g class="bot-arm"><rect x="8" y="98" width="34" height="14" rx="7" fill="url(#${id}b)" transform="rotate(-28 40 106)"/></g>
        <rect x="34" y="96" width="52" height="52" rx="24" fill="url(#${id}b)"/>
        <rect x="80" y="104" width="14" height="30" rx="7" fill="#1A8E94"/>
        <circle cx="60" cy="118" r="7" fill="#26474E" opacity="0.18"/>
        ${head}
    </svg>`;
}

function botChatMarkup(id) {
    return `
        <div class="bot-head">
            <span class="bot-avatar is-big" aria-hidden="true">${botAvatarSVG()}</span>
            <div>
                <b>${BOT_NAME}</b>
                <small><i class="bot-online"></i> Asistente virtual de Banklite</small>
            </div>
            <button type="button" class="bot-close" data-bot-close aria-label="Cerrar chat">×</button>
        </div>
        <div class="bot-log" id="${id}Log" role="log" aria-live="polite"></div>
        <form class="bot-form" autocomplete="off">
            <label class="visually-hidden" for="${id}Input">Escribe tu pregunta</label>
            <input class="bot-input" id="${id}Input" maxlength="160" placeholder="Escribe tu pregunta…">
            <button type="submit" class="bot-send" aria-label="Enviar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
        </form>
        <p class="bot-disclaimer">${BOT_NAME} solo responde temas de Banklite. Nunca te pedirá tu clave.</p>`;
}

// Burbuja flotante: solo en el dashboard
function initBotBubble() {
    if (document.getElementById("helpPage") || document.getElementById("botBubble")) return;

    // El chat va en el dashboard y en las vistas internas con el layout compartido (layout.js)
    if (!document.querySelector("main.dashboard") && !document.body.dataset.page) {
        // En las demás páginas, los botones de chat llevan al Centro de ayuda
        document.querySelectorAll("[data-open-bot]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                location.href = "ayuda.html";
            });
        });
        return;
    }

    document.body.insertAdjacentHTML("beforeend", `
        <button type="button" class="bot-bubble" id="botBubble" aria-label="Abrir chat con ${BOT_NAME}" aria-expanded="false" aria-controls="botWidget">
            <span class="bot-bubble-face">${botAvatarSVG()}</span>
            <span class="bot-bubble-label">¿Ayuda? Habla con ${BOT_NAME}</span>
        </button>
        <section class="bot-widget" id="botWidget" role="dialog" aria-label="Chat con ${BOT_NAME}" hidden>
            ${botChatMarkup("botWidget")}
            <a class="bot-more" href="ayuda.html">Ver el Centro de ayuda <span aria-hidden="true">→</span></a>
        </section>`);

    const bubble = document.getElementById("botBubble");
    const widget = document.getElementById("botWidget");
    const chat = createBotChat(widget);

    function toggle(open) {
        widget.hidden = !open;
        bubble.setAttribute("aria-expanded", String(open));
        bubble.classList.toggle("is-open", open);
        if (open) {
            chat.start();
            setTimeout(() => chat.focus(), 50);
        }
    }

    bubble.addEventListener("click", () => toggle(widget.hidden));
    widget.querySelector("[data-bot-close]").addEventListener("click", () => toggle(false));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !widget.hidden && !document.querySelector(".modal.active")) toggle(false);
    });

    // Otros botones pueden abrir el chat con [data-open-bot]
    document.querySelectorAll("[data-open-bot]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            toggle(true);
        });
    });
}

// Página ayuda.html
function initHelp() {
    document.querySelectorAll("[data-bot-figure]").forEach(el => { el.innerHTML = botAvatarSVG(true); });
    document.querySelectorAll("[data-bot-name]").forEach(el => { el.textContent = BOT_NAME; });

    const back = document.getElementById("helpBack");
    if (back && botLogged()) {
        back.href = "dashboard.html";
        back.lastChild.textContent = " Volver al inicio";
    }

    const chatBox = document.getElementById("helpChat");
    chatBox.innerHTML = botChatMarkup("helpChat");
    chatBox.querySelector("[data-bot-close]").remove();
    const chat = createBotChat(chatBox);
    chat.start();

    // Categorías
    const catBox = document.getElementById("helpCategories");
    catBox.innerHTML = BOT_CATEGORIES.map(cat => `
        <button type="button" class="help-cat" data-cat="${cat.id}">
            <span aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${cat.icon}"/></svg></span>
            <b>${cat.title}</b>
            <small>${cat.text}</small>
        </button>`).join("");

    // Preguntas frecuentes
    const faqBox = document.getElementById("helpFaq");
    const empty = document.getElementById("helpEmpty");
    const title = document.getElementById("helpFaqTitle");
    const faqTopics = BOT_TOPICS.filter(topic => topic.faq);
    let activeCat = "";

    function renderFaq(query = "") {
        const q = botNormalize(query);
        const words = q.split(" ").filter(word => word.length > 2);
        const list = faqTopics.filter(topic => {
            if (activeCat && topic.cat !== activeCat) return false;
            if (!words.length) return true;
            const hay = botNormalize(topic.faq + " " + topic.keys.join(" ") + " " + topic.answer().text);
            return words.every(word => hay.includes(word));
        });

        faqBox.innerHTML = list.map(topic => {
            const reply = topic.answer();
            const links = (reply.links || []).map(link => `<a class="bot-link" href="${link.href}">${escapeHTML(link.label)} <span aria-hidden="true">→</span></a>`).join("");
            return `
            <details class="help-faq-item">
                <summary>${escapeHTML(topic.faq)}</summary>
                <div>
                    <p>${botFormat(reply.text)}</p>
                    ${links ? `<div class="bot-links">${links}</div>` : ""}
                </div>
            </details>`;
        }).join("");

        empty.hidden = list.length > 0;
        const cat = BOT_CATEGORIES.find(item => item.id === activeCat);
        title.textContent = cat ? cat.title : query ? `Resultados para "${query}"` : "Preguntas frecuentes";
        catBox.querySelectorAll(".help-cat").forEach(button => button.classList.toggle("active", button.dataset.cat === activeCat));
        document.getElementById("helpClearCat").hidden = !activeCat;
    }

    const search = document.getElementById("helpSearch");
    search.addEventListener("input", () => {
        activeCat = "";
        renderFaq(search.value);
    });

    document.getElementById("helpSearchForm").addEventListener("submit", event => {
        event.preventDefault();
        if (!search.value.trim()) return;
        chat.ask(search.value);
        document.getElementById("helpChat").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    catBox.addEventListener("click", event => {
        const button = event.target.closest("[data-cat]");
        if (!button) return;
        activeCat = activeCat === button.dataset.cat ? "" : button.dataset.cat;
        search.value = "";
        renderFaq();
        document.getElementById("helpFaqSection").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("helpClearCat").addEventListener("click", () => {
        activeCat = "";
        renderFaq();
    });

    empty.querySelector("button").addEventListener("click", () => {
        chat.ask(search.value || "ayuda");
        document.getElementById("helpChat").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    renderFaq();

    // ayuda.html?pregunta=... abre con esa pregunta
    const preset = new URLSearchParams(location.search).get("pregunta");
    if (preset) setTimeout(() => chat.ask(preset), 300);
}


// -----------------------------------------------------
// PÁGINA SOBRE NOSOTROS (sobre-nosotros.html)
// -----------------------------------------------------

function initAbout() {
    // Iniciales del equipo a partir de data-name
    document.querySelectorAll(".about-member").forEach(member => {
        const words = (member.dataset.name || "").trim().split(/\s+/).filter(Boolean);
        const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || "B").slice(0, 2);
        const avatar = member.querySelector(".about-avatar");
        if (avatar) avatar.textContent = initials.toUpperCase();
    });

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function countUp(el) {
        const target = Number(el.dataset.count) || 0;
        const suffix = el.dataset.suffix || "";
        if (reduce) { el.textContent = target + suffix; return; }
        const start = performance.now();
        const duration = 1200;
        function step(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    const counters = document.querySelectorAll("[data-count]");
    const reveals = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
        counters.forEach(countUp);
        reveals.forEach(el => el.classList.add("is-visible"));
        return;
    }

    document.body.classList.add("about-animate");

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            if (el.dataset.count !== undefined) countUp(el);
            else el.classList.add("is-visible");
            observer.unobserve(el);
        });
    }, { threshold: 0.2 });

    counters.forEach(el => observer.observe(el));
    reveals.forEach(el => observer.observe(el));
}


// -----------------------------------------------------
// MENÚ LATERAL DEL DASHBOARD
// Grupos desplegables (uno abierto a la vez) y la sección
// en la que está la persona queda marcada mientras baja.
// -----------------------------------------------------

function initSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar || sidebar.dataset.ready) return;
    sidebar.dataset.ready = "1";

    const groups = [...sidebar.querySelectorAll(".side-group")];

    function setOpen(group, open) {
        group.classList.toggle("is-open", open);
        group.querySelector(".side-toggle").setAttribute("aria-expanded", String(open));
    }

    groups.forEach(group => {
        group.querySelector(".side-toggle").addEventListener("click", () => {
            const open = !group.classList.contains("is-open");
            groups.forEach(other => {
                setOpen(other, other === group && open);
                other.dataset.auto = "";
            });
        });
    });

    // Marcar el elemento activo (y abrir su grupo)
    const spyLinks = [...sidebar.querySelectorAll("[data-spy]")];

    function activate(key) {
        spyLinks.forEach(link => {
            const on = link.dataset.spy === key;
            link.classList.toggle("active", on);
            if (on) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        const owner = groups.find(group => group.querySelector(`[data-spy="${key}"]`));
        groups.forEach(group => {
            group.classList.toggle("has-active", group === owner);
            // Abre el grupo de la sección actual; cierra los que se abrieron solos
            if (owner) setOpen(group, group === owner);
            else if (group.dataset.auto) setOpen(group, false);
            group.dataset.auto = owner === group ? "1" : "";
        });
    }

    spyLinks.forEach(link => link.addEventListener("click", () => activate(link.dataset.spy)));

    // Fuera del dashboard (layout.js): se marca la vista actual y no hay secciones que vigilar
    const page = sidebar.dataset.page;
    if (page && page !== "dashboard") {
        activate(page);
        return;
    }

    // Cada sección del dashboard es una vista propia, así que no hay secciones que vigilar
    const sections = []
        .map(([id, key]) => ({ el: document.getElementById(id), key }))
        .filter(item => item.el);

    let ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const line = window.innerHeight * 0.35;
            const view = document.querySelector("main.dashboard")?.dataset.currentView || "inicio";
            let current = "inicio";

            if (view !== "inicio") {
                if (sidebar.dataset.current !== view) {
                    sidebar.dataset.current = view;
                    activate(view);
                }
                return;
            }

            // La última sección que ya pasó la línea es la actual
            sections.forEach(({ el, key }) => {
                if (el.getBoundingClientRect().top <= line) current = key;
            });
            // Las metas solo cuentan mientras se ven en pantalla
            const goals = document.getElementById("ahorro");
            if (current === "ahorro" && goals && goals.getBoundingClientRect().bottom < 80) current = "inicio";
            if (sidebar.dataset.current !== current) {
                sidebar.dataset.current = current;
                activate(current);
            }
        });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("banklite:view", onScroll);
    onScroll();
}


// =========================================================
// VISTAS DEL DASHBOARD
// Inicio, Metas, Tarjetas y Suscripciones se muestran por separado
// según el enlace del panel izquierdo (#ahorro, #tarjetas, #suscripciones).
// =========================================================

const DASH_VIEWS = { tarjetas: "tarjetas", suscripciones: "suscripciones", ahorro: "ahorro" };

function initDashboardViews() {
    const main = document.querySelector("main.dashboard");
    if (!main || !main.querySelector("[data-view]")) return;

    function show(scroll) {
        const hash = location.hash.replace("#", "");
        const view = DASH_VIEWS[hash] || "inicio";
        const changed = main.dataset.currentView !== view;

        main.dataset.currentView = view;

        if (scroll || changed) {
            window.scrollTo({ top: 0, behavior: changed ? "auto" : "smooth" });
        }

        document.dispatchEvent(new CustomEvent("banklite:view", { detail: view }));
    }

    window.addEventListener("hashchange", () => show(true));

    // Volver a hacer clic en la vista actual también sube al inicio
    document.querySelectorAll('.sidebar a[href^="#"]').forEach(link => {
        link.addEventListener("click", () => {
            if (link.getAttribute("href") === location.hash) setTimeout(() => show(true), 0);
        });
    });

    show(false);
}

// =========================================================
// CARRUSEL DE FUNCIONES DEL BANCO
// =========================================================

// Solo funciones reales; lo que no tiene backend va como "Próximamente".
const FEATURE_SLIDES = [
    {
        eyebrow: "Al instante",
        title: "Transfiere entre cuentas Banklite",
        text: "Envía plata con el número de cuenta, revisa antes de confirmar y descarga el comprobante.",
        cta: "Transferir", href: "transferir.html", tone: "t1",
        icon: "m22 2-7 20-4-9-9-4ZM22 2 11 13"
    },
    {
        eyebrow: "Tus soportes",
        title: "Extractos y comprobantes",
        text: "Descarga el extracto de cualquier mes en PDF o tus movimientos en Excel.",
        cta: "Ver movimientos", href: "movimientos.html", tone: "t2",
        icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3"
    },
    {
        eyebrow: "Nuevo",
        title: "Cobra y paga con QR",
        text: "Muestra tu código para que te paguen o escanea uno para pagar en segundos.",
        cta: "Ir a QR", href: "qr.html", tone: "t3",
        icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3"
    },
    {
        eyebrow: "Nuevo",
        title: "Llaves Bre-B",
        text: "Recibir plata con tu celular o correo, sin dar tu número de cuenta.",
        cta: "Mis llaves", href: "llaves.html", tone: "t3",
        icon: "m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3M12.4 12.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8z"
    },
    {
        eyebrow: "Nuevo",
        title: "Bolsillos y CDT",
        text: "Aparta plata que gana 9% E.A. o invierte a plazo fijo hasta 11% E.A.",
        cta: "Ahorrar ahora", href: "inversiones.html", tone: "t4",
        icon: "M3 17l6-6 4 4 8-8M15 7h6v6"
    },
    {
        eyebrow: "Nuevo",
        title: "Pagos y recargas",
        text: "Facturas de servicios y recargas de celular sin salir de Banklite.",
        cta: "Pagar ahora", href: "pagos.html", tone: "t5",
        icon: "M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2ZM8 9h8M8 13h6"
    },
    {
        eyebrow: "Ayuda 24/7",
        title: "Habla con Banki",
        text: "Nuestro asistente responde tus dudas sobre la cuenta, la tarjeta y las transferencias.",
        cta: "Abrir chat", href: "#", bot: true, tone: "t6",
        icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5"
    }
];

function initFeatureCarousel() {
    const track = document.getElementById("fcTrack");
    const dots = document.getElementById("fcDots");
    if (!track || !dots) return;

    track.innerHTML = FEATURE_SLIDES.map((slide, index) => `
        <article class="fc-slide ${slide.tone}" role="group" aria-roledescription="diapositiva" aria-label="${index + 1} de ${FEATURE_SLIDES.length}: ${slide.title}">
            <div class="fc-text">
                <span class="fc-eyebrow">${slide.eyebrow}</span>
                <h3>${slide.title}</h3>
                <p>${slide.text}</p>
                <a class="fc-cta" href="${slide.href}"${slide.bot ? " data-open-bot" : ""}>${slide.cta}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </a>
            </div>
            <span class="fc-bubble b1" aria-hidden="true"></span>
            <span class="fc-bubble b2" aria-hidden="true"></span>
            <span class="fc-bubble b3" aria-hidden="true"></span>
            <div class="fc-art" aria-hidden="true">
                <span class="fc-ring"></span>
                <span class="fc-ring r2"></span>
                <span class="fc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${slide.icon}"/></svg></span>
            </div>
        </article>`).join("");

    dots.innerHTML = FEATURE_SLIDES.map((slide, index) =>
        `<button type="button" class="fc-dot" role="tab" aria-label="${slide.title}" data-fc="${index}"></button>`).join("");

    const slides = [...track.children];
    const dotButtons = [...dots.children];
    let current = 0;
    let timer = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function go(index, smooth = true) {
        current = (index + slides.length) % slides.length;
        track.scrollTo({ left: slides[current].offsetLeft - track.offsetLeft, behavior: smooth && !reduced ? "smooth" : "auto" });
        mark();
    }

    function mark() {
        dotButtons.forEach((dot, i) => {
            dot.classList.toggle("active", i === current);
            dot.setAttribute("aria-selected", String(i === current));
        });
        // Reinicia la animación de entrada de la diapositiva visible
        slides.forEach((slide, i) => {
            slide.classList.remove("is-active");
            if (i === current) {
                void slide.offsetWidth;
                slide.classList.add("is-active");
            }
        });
        restartDot();
    }

    // La barrita del punto activo se llena mientras corre el tiempo
    function restartDot() {
        const dot = dotButtons[current];
        if (!dot) return;
        dot.classList.remove("is-running");
        void dot.offsetWidth;
        if (timer) dot.classList.add("is-running");
    }

    function play() {
        stop();
        if (!reduced) timer = setInterval(() => go(current + 1), 5500);
        restartDot();
    }

    function stop() {
        clearInterval(timer);
        timer = null;
        dotButtons.forEach(dot => dot.classList.remove("is-running"));
    }

    document.getElementById("fcPrev")?.addEventListener("click", () => { go(current - 1); play(); });
    document.getElementById("fcNext")?.addEventListener("click", () => { go(current + 1); play(); });
    dots.addEventListener("click", event => {
        const dot = event.target.closest("[data-fc]");
        if (dot) { go(Number(dot.dataset.fc)); play(); }
    });

    // Al deslizar con el dedo se actualiza el punto activo
    let scrollTimer;
    track.addEventListener("scroll", () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const index = Math.round(track.scrollLeft / track.clientWidth);
            if (index !== current && slides[index]) { current = index; mark(); }
        }, 120);
    }, { passive: true });

    const box = track.closest(".feature-carousel");
    box.addEventListener("mouseenter", stop);
    box.addEventListener("mouseleave", play);
    box.addEventListener("focusin", stop);
    box.addEventListener("focusout", play);
    box.addEventListener("touchstart", stop, { passive: true });

    // Solo avanza cuando se ve la vista de inicio
    document.addEventListener("banklite:view", event => (event.detail === "inicio" ? play() : stop()));

    mark();
    play();
}
