// =========================================================
// BANKLITE - JAVASCRIPT COMÚN (todas las páginas)
// Utilidades compartidas: formato de montos, modales, avisos, casillas de
// clave, tema y la inicialización general de cada página. Cada vista suma
// su propio script: inicio.js, banki.js, ayuda.js, login.js, dashboard.js...
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
    try {
        return Boolean(sessionStorage.getItem("bl.accessToken"));
    } catch {
        return false;
    }
}

// =========================================================
// UTILIDADES
// =========================================================

// Atajo de document.getElementById
function byId(id) {
    return document.getElementById(id);
}

// Monto en pesos (o en la moneda de la cuenta): $ 1.250.000 · US$ 12,50
function formatMoney(value, currency) {
    const code = currency || "COP";
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: code,
        maximumFractionDigits: code === "COP" ? 0 : 2,
    }).format(Number(value) || 0);
}

// Tasa efectiva anual: 0.09 -> "9% E.A."
function formatRate(rate) {
    return `${(rate * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}% E.A.`;
}

// =========================================================
// API GATEWAY Y CATÁLOGO (TASAS Y TOPES DESDE EL BACKEND)
// =========================================================

// El frontend solo habla con el API Gateway. Si la página se sirve desde
// localhost se usa el gateway de docker-compose. api.js usa esta misma dirección.
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.BANKLITE_CONFIG = window.BANKLITE_CONFIG || {
        apiGateway: "https://api-gateway-production-dd7f.up.railway.app",
    };
}

function gatewayUrl() {
    return ((window.BANKLITE_CONFIG || {}).apiGateway || "http://localhost:8080").replace(/\/+$/, "");
}

// Tasas y topes públicos de cada servicio: ahorro (savings), recargas (payment),
// transferencias (transfer), tarjeta (card) y Puntos Banklite (rewards).
// Son públicos: los usan el inicio, el Centro de ayuda y Banki. Se guardan 10
// minutos en la pestaña para no pedirlos en cada página.
const CATALOG_KEY = "bl.catalog";
const CATALOG_TTL_MS = 10 * 60 * 1000;
let BL_CATALOG = null;
let catalogRequest = null;

function loadCatalog() {
    if (catalogRequest) return catalogRequest;
    catalogRequest = (async () => {
        try {
            const cached = JSON.parse(sessionStorage.getItem(CATALOG_KEY));
            if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return (BL_CATALOG = cached.data);
        } catch {
            /* sin almacenamiento */
        }
        const get = path =>
            fetch(gatewayUrl() + path)
                .then(res => (res.ok ? res.json() : null))
                .catch(() => null);
        const [savings, payments, transfers, cards, rewards] = await Promise.all(
            ["/savings/catalog", "/payments/catalog", "/transfers/catalog", "/cards/catalog", "/rewards/catalog"].map(
                get
            )
        );
        BL_CATALOG = { savings, payments, transfers, cards, rewards };
        if (Object.values(BL_CATALOG).every(Boolean)) {
            try {
                sessionStorage.setItem(CATALOG_KEY, JSON.stringify({ at: Date.now(), data: BL_CATALOG }));
            } catch {
                /* sin almacenamiento */
            }
        }
        return BL_CATALOG;
    })();
    return catalogRequest;
}

// Cada cifra del catálogo ya con formato; null si todavía no llegó.
const CATALOG_VALUES = {
    pocketRate: ({ savings }) => savings && formatRate(savings.pocketRate),
    cdtMinRate: ({ savings }) => savings && formatRate(Math.min(...savings.cdtTerms.map(term => term.rate))),
    cdtMaxRate: ({ savings }) => savings && formatRate(Math.max(...savings.cdtTerms.map(term => term.rate))),
    cdtTermDays: ({ savings }) => {
        if (!savings) return null;
        const days = savings.cdtTerms.map(term => term.days);
        return `${days.slice(0, -1).join(", ")} o ${days[days.length - 1]} días`;
    },
    cdtMin: ({ savings }) => savings && formatMoney(savings.cdtMin),
    cdtTax: ({ savings }) => savings && `${(savings.cdtTax * 100).toLocaleString("es-CO")}%`,
    minMove: ({ savings }) => savings && formatMoney(savings.minMove),
    maxPockets: ({ savings }) => savings && String(savings.maxPockets),
    maxGoals: ({ savings }) => savings && String(savings.maxGoals),
    goalMinTarget: ({ savings }) => savings && formatMoney(savings.goalMinTarget),
    topupMin: ({ payments }) => payments && formatMoney(payments.topup.min),
    topupMax: ({ payments }) => payments && formatMoney(payments.topup.max),
    transferMin: ({ transfers }) => transfers && formatMoney(transfers.min),
    cardDailyLimitMin: ({ cards }) => cards && formatMoney(cards.dailyLimit.min),
    pointValue: ({ rewards }) => rewards && formatMoney(rewards.pointValue),
    pointsPer: ({ rewards }) => rewards && formatMoney(rewards.pointsPer),
    // Por nivel: data-catalog="levelMultiplier:Plata" -> "x1,25"; "levelMin:Oro" -> "5.000"
    levelMultiplier: ({ rewards }, name) => {
        const level = rewards?.levels.find(item => item.name === name);
        return level && `x${level.multiplier.toLocaleString("es-CO")}`;
    },
    levelMin: ({ rewards }, name) => {
        const level = rewards?.levels.find(item => item.name === name);
        return level && level.min.toLocaleString("es-CO");
    },
};

// Valor del catálogo con formato, o `fallback` (texto sin cifras) si no está.
function catalogText(key, fallback = "") {
    const [name, arg] = key.split(":");
    return (BL_CATALOG && CATALOG_VALUES[name]?.(BL_CATALOG, arg)) || fallback;
}

// Rellena los <span data-catalog="clave" data-template="Hasta {}">. Su texto inicial
// no lleva cifras: si el catálogo no llega, se lee el texto neutro.
function applyCatalog(root = document) {
    root.querySelectorAll("[data-catalog]").forEach(element => {
        const value = catalogText(element.dataset.catalog);
        if (value) element.textContent = (element.dataset.template || "{}").replace("{}", value);
    });
}

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
            boxes.forEach(box => {
                box.value = "";
            });
            sync();
        },
        error() {
            container.classList.remove("is-error");
            void container.offsetWidth;
            container.classList.add("is-error");
        },
        setVisible(show) {
            boxes.forEach(box => {
                box.type = show ? "text" : "password";
            });
        },
    };

    return container._pin;
}

function maskEmail(email) {
    const [name, domain] = String(email).split("@");
    if (!domain) return email;
    return `${name.slice(0, 2)}${"•".repeat(Math.max(name.length - 2, 2))}@${domain}`;
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
        stop: () => clearInterval(meta._timer),
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
    try {
        localStorage.setItem(THEME_KEY, preference);
    } catch {
        /* sin almacenamiento */
    }
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

    document.querySelectorAll('input[name="pin"], input[id*="Pin"], input[id*="PIN"]').forEach(input => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "").slice(0, 4);
        });
    });

    // -----------------------------------------------------
    // CAMPOS NUMÉRICOS
    // -----------------------------------------------------

    document.querySelectorAll('input[type="tel"], input[inputmode="numeric"]').forEach(input => {
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
            // Los modales bloqueados (autorización de datos) no se cierran con clic afuera.
            if (event.target === modal && !modal.dataset.locked) {
                modal.classList.remove("active");
            }
        });
    });

    // Tecla Escape cierra el modal abierto

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        document.querySelectorAll(".modal.active").forEach(modal => {
            if (modal.dataset.locked) return; // ni con Escape
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

            const expanded = mobileMenu.classList.contains("active");

            mobileButton.setAttribute("aria-expanded", expanded);
        });

        // Al tocar un enlace, el menú se cierra
        mobileMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                mobileMenu.classList.remove("active");
                mobileButton.setAttribute("aria-expanded", "false");
            });
        });
    }

    // Cada página se inicia en su propio script (inicio.js, ayuda.js, login.js,
    // dashboard.js, ...), conectado al backend con api.js.

    // Tasas y topes del backend: en las páginas que los muestran y donde está Banki.
    if (document.querySelector("[data-catalog]") || typeof BOT_TOPICS !== "undefined") {
        loadCatalog().then(() => applyCatalog());
    }

    // Sin banki.js (páginas públicas), los botones de chat llevan al Centro de ayuda.
    if (typeof initBotBubble !== "function") {
        document.querySelectorAll("[data-open-bot]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                location.href = "ayuda.html";
            });
        });
    }
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
