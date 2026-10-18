// =========================================================
// BANKLITE - INICIO PÚBLICO (index.html)
// Pestañas Personas / Empresas / Emprendedores, carrusel y calculadora.
// =========================================================

const HOME_ARTICLES = {
    ahorro: {
        title: "La regla 50/30/20",
        text: "Divide tu sueldo en tres partes:\n\n• 50% para necesidades: arriendo, servicios, mercado y transporte.\n• 30% para gustos: salidas, ropa y suscripciones.\n• 20% para ahorrar o pagar deudas.\n\nTip: apenas recibas tu sueldo, apártalo primero para no gastarlo sin darte cuenta.",
    },
    cdt: {
        title: "¿CDT o bolsillo?",
        // Las tasas vienen del backend (catalogText, comun.js)
        text: () =>
            "Bolsillo: apartas plata para algo concreto y la puedes sacar cuando quieras. Sirve para emergencias o metas cercanas.\n\nCDT: la plata queda quieta hasta el final del plazo a cambio de una tasa fija. Sirve para dinero que no vas a necesitar pronto.\n\n" +
            `Muchas personas combinan los dos. En Banklite tienes bolsillos que ganan ${catalogText("pocketRate", "intereses")} y CDT ${catalogText("cdtMaxRate") ? `de hasta ${catalogText("cdtMaxRate")}` : "a plazo fijo"}, en Bolsillos y CDT.`,
    },
    fraude: {
        title: "5 señales de fraude",
        text: '1. Te piden tu clave o un código que te llegó por correo o WhatsApp.\n2. Te presionan para transferir "ya mismo".\n3. Te ofrecen premios o préstamos fáciles a cambio de un pago.\n4. El mensaje tiene enlaces raros o errores de ortografía.\n5. Alguien dice ser de Banklite y te llama desde un número desconocido.\n\nBanklite nunca te pedirá tu clave. Si dudas, cuelga y llama a la Línea Banklite.',
    },
};

/**
 * Calculadora de bolsillos de la pestaña Emprendedores (index.html#emprendedores).
 * Solo una guía: todo se calcula en el navegador, no se guarda ni se envía nada.
 */
function initBusinessCalculator() {
    const form = document.getElementById("entCalc");
    if (!form) return;

    const DEFAULTS = { Tax: 15, Costs: 50, Save: 10 };
    const LABELS = { Tax: "impuestos", Costs: "gastos del negocio", Save: "ahorro" };
    const sales = document.getElementById("entSales");
    const ranges = Array.from(form.querySelectorAll("[data-calc-pct]"));
    const warn = document.getElementById("entCalcWarn");
    const live = document.getElementById("entCalcLive");
    let liveTimer = null;

    const salesValue = () => Number(sales.value.replace(/\D/g, "")) || 0;

    function paint() {
        const total = salesValue();
        let used = 0;
        let pct = 0;
        const parts = [];

        ranges.forEach(range => {
            const key = range.dataset.calcPct;
            const value = Number(range.value);
            const amount = Math.round((total * value) / 100);
            pct += value;
            used += amount;
            document.getElementById(`entPct${key}Out`).textContent = `${value} %`;
            document.getElementById(`entAmt${key}`).textContent = formatMoney(amount);
            range.style.setProperty("--fill", `${value}%`);
            parts.push(`${LABELS[key]} ${formatMoney(amount)}`);
        });

        const over = pct > 100;
        warn.hidden = !over;
        document.getElementById("entFree").textContent = over ? "—" : formatMoney(Math.max(total - used, 0));
        form.classList.toggle("is-over", over);

        // Lector de pantalla: un resumen cuando el usuario deja de mover los controles
        clearTimeout(liveTimer);
        liveTimer = setTimeout(() => {
            live.textContent = total
                ? `Con ventas de ${formatMoney(total)}: ${parts.join(", ")}. ${over ? "Los porcentajes suman más de 100 %." : `Te queda libre ${formatMoney(Math.max(total - used, 0))}.`}`
                : "";
        }, 500);
    }

    sales.addEventListener("input", () => {
        const digits = sales.value.replace(/\D/g, "").slice(0, 12);
        sales.value = digits ? Number(digits).toLocaleString("es-CO") : "";
        paint();
    });

    ranges.forEach(range => range.addEventListener("input", paint));

    document.getElementById("entCalcReset")?.addEventListener("click", () => {
        sales.value = "";
        ranges.forEach(range => {
            range.value = DEFAULTS[range.dataset.calcPct];
        });
        paint();
        sales.focus();
    });

    form.addEventListener("submit", event => event.preventDefault());
    paint();
}

/**
 * Carrusel principal de una pestaña del inicio. Devuelve start/stop para que
 * solo avance el de la pestaña visible.
 */
function homeCarousel(hero) {
    const slides = Array.from(hero.querySelectorAll(".hm-slide"));
    const dots = Array.from(hero.querySelectorAll(".hm-dots button"));
    const pauseButton = hero.querySelector("[data-hm-pause]");
    const slider = hero.querySelector(".hm-slides");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = 0;
    let paused = reduceMotion;
    let running = false;
    let timer = null;

    function goTo(index) {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
            slide.classList.toggle("is-active", i === current);
            slide.setAttribute("aria-hidden", String(i !== current));
            slide.querySelectorAll("a, button").forEach(el => (el.tabIndex = i === current ? 0 : -1));
        });
        hero.classList.toggle("is-dark", slides[current].classList.contains("hm-slide-2"));
        dots.forEach((dot, i) => {
            dot.classList.toggle("is-active", i === current);
            dot.setAttribute("aria-selected", String(i === current));
        });
        restart();
    }

    function restart() {
        clearInterval(timer);
        hero.classList.toggle("is-paused", paused);
        if (running && !paused) timer = setInterval(() => goTo(current + 1), 6500);
    }

    dots.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));
    hero.querySelector("[data-hm-prev]")?.addEventListener("click", () => goTo(current - 1));
    hero.querySelector("[data-hm-next]")?.addEventListener("click", () => goTo(current + 1));

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
    slider?.addEventListener(
        "touchstart",
        event => {
            touchX = event.touches[0].clientX;
        },
        { passive: true }
    );
    slider?.addEventListener("touchend", event => {
        if (touchX === null) return;
        const diff = event.changedTouches[0].clientX - touchX;
        if (Math.abs(diff) > 50) goTo(current + (diff < 0 ? 1 : -1));
        touchX = null;
    });

    goTo(0);

    return {
        start() {
            running = true;
            goTo(0);
        },
        stop() {
            running = false;
            clearInterval(timer);
        },
    };
}

function initHome() {
    // -----------------------------------------------------
    // MENÚ MÓVIL Y MEGAMENÚ
    // -----------------------------------------------------

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.getElementById("hmHeader");
    const burger = document.getElementById("hmBurger");
    const mobile = document.getElementById("hmMobile");

    burger?.addEventListener("click", () => {
        const open = mobile.classList.toggle("open");
        burger.classList.toggle("open", open);
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });

    mobile?.querySelectorAll("a").forEach(link =>
        link.addEventListener("click", () => {
            mobile.classList.remove("open");
            burger.classList.remove("open");
            burger.setAttribute("aria-expanded", "false");
        })
    );

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
    // CARRUSELES (uno por pestaña; solo avanza el que se ve)
    // -----------------------------------------------------

    const carousels = new Map(
        Array.from(document.querySelectorAll(".hm-hero")).map(hero => [hero, homeCarousel(hero)])
    );

    // -----------------------------------------------------
    // PERSONAS, EMPRESAS Y EMPRENDEDORES
    // Cada pestaña de la barra superior es un bloque [data-segment]. Se cambia
    // sin recargar y la URL queda en #personas, #empresas o #emprendedores
    // (se puede compartir y el botón Atrás funciona). Las anclas internas
    // (#beneficios, #empresas-productos...) abren la pestaña que las contiene.
    // -----------------------------------------------------

    const segments = Array.from(document.querySelectorAll("[data-segment]"));
    const segmentLinks = Array.from(document.querySelectorAll("[data-segment-link]"));
    const SEGMENT_TITLES = { personas: "Personas", empresas: "Empresas", emprendedores: "Emprendedores" };
    let currentSegment = null;

    function segmentFromHash() {
        const hash = decodeURIComponent(location.hash.slice(1));
        if (!hash) return { name: "personas", target: null };
        if (SEGMENT_TITLES[hash]) return { name: hash, target: null };
        const target = document.getElementById(hash);
        const owner = target?.closest("[data-segment]");
        return owner ? { name: owner.dataset.segment, target } : null;
    }

    function showSegment(name) {
        if (name === currentSegment) return;
        currentSegment = name;
        segments.forEach(segment => {
            const visible = segment.dataset.segment === name;
            segment.hidden = !visible;
            segment.querySelectorAll(".hm-hero").forEach(hero => carousels.get(hero)?.[visible ? "start" : "stop"]());
        });
        segmentLinks.forEach(link => {
            const active = link.dataset.segmentLink === name;
            link.classList.toggle("active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        document.title = `Banklite | ${SEGMENT_TITLES[name]}`;
    }

    function syncSegment(scroll) {
        const found = segmentFromHash();
        if (!found) return;
        showSegment(found.name);
        if (!scroll) return;
        // La sección estaba oculta cuando el navegador intentó llegar a ella: se baja ahora.
        if (found.target) found.target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
        else window.scrollTo({ top: 0, behavior: "auto" });
    }

    window.addEventListener("hashchange", () => syncSegment(true));
    // Al cargar con un enlace compartido (#empresas o #empresas-productos) se va directo ahí.
    syncSegment(Boolean(location.hash));

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
    document
        .querySelectorAll("[data-tab-link]")
        .forEach(link => link.addEventListener("click", () => showTab(link.dataset.tabLink)));

    // -----------------------------------------------------
    // ARTÍCULOS Y "PRÓXIMAMENTE"
    // -----------------------------------------------------

    document.querySelectorAll("[data-article]").forEach(button =>
        button.addEventListener("click", () => {
            const article = HOME_ARTICLES[button.dataset.article];
            if (article)
                showMessage(article.title, typeof article.text === "function" ? article.text() : article.text, "i");
        })
    );

    document.querySelectorAll("[data-soon]").forEach(button =>
        button.addEventListener("click", event => {
            event.preventDefault();
            showMessage(
                "Muy pronto",
                button.dataset.soonText || `${button.dataset.soon} estará disponible próximamente.`,
                "i"
            );
        })
    );

    initBusinessCalculator();

    // Si ya hay sesión abierta, "Ingresar" lleva directo al dashboard
    if (hasSession()) {
        document
            .querySelectorAll('.hm-actions a[href="login.html"], .hm-mobile-actions a[href="login.html"]')
            .forEach(link => {
                link.href = "dashboard.html";
                link.lastChild.textContent = " Mi Banklite";
            });
    }
}

document.addEventListener("DOMContentLoaded", initHome);
