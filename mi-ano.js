// =========================================================
// BANKLITE - MI AÑO EN BANKLITE (resumen tipo "Wrapped")
// Misma historia que la versión simulada, calculada con datos reales:
//   GET /accounts + /ledger/accounts/:id/transactions (movimientos del año, hora de Colombia)
//   GET /transfers   (nombre de a quién le transferiste)
//   GET /savings     (lo que tienes ahorrado e intereses)
//   GET /rewards     (puntos y nivel)
//   GET /kyc/:idUser (tu nombre)
// Se abre con "Mi año" del menú lateral (#mi-ano). Solo lee datos: no mueve plata.
// =========================================================

const WRAPPED_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WRAPPED_SLIDE_MS = 6500;

// Fondo de cada historia (solo decorativo; estilos en styles.css, "wr-fx"):
// punticos brillantes que suben y una escena animada de banca en la esquina.
const wrappedFx = scene => `
    <div class="wr-fx" aria-hidden="true">
        ${wrappedScene(scene)}
        ${"<i></i>".repeat(12)}
    </div>`;

// Escenas de línea, muy transparentes: banco, cuenta y ahorro. Usan currentColor:
// el color y la opacidad salen del tema de la historia.
const WRAPPED_SCENES = {
    // La fachada se levanta columna por columna y una moneda cae en la ranura del frontón.
    bank: `
        <circle class="bk-coin" cx="60" cy="6" r="5"/>
        <circle class="bk-pulse" cx="60" cy="33" r="5"/>
        <path class="bk-roof" d="M14 46L60 20l46 26z"/>
        <path d="M53 33h14"/>
        <path d="M18 52h84"/>
        <rect class="bk-col" x="22" y="56" width="8" height="38" rx="1.5"/>
        <rect class="bk-col" x="39" y="56" width="8" height="38" rx="1.5"/>
        <rect class="bk-col" x="56" y="56" width="8" height="38" rx="1.5"/>
        <rect class="bk-col" x="73" y="56" width="8" height="38" rx="1.5"/>
        <rect class="bk-col" x="90" y="56" width="8" height="38" rx="1.5"/>
        <path d="M14 98h92M8 106h104"/>`,

    // Extracto de la cuenta: se escriben los movimientos, se llena el saldo y aparece el check.
    account: `
        <rect x="16" y="18" width="88" height="86" rx="9"/>
        <circle cx="31" cy="33" r="6"/>
        <path d="M43 30h32M43 37h18"/>
        <path class="ac-row" pathLength="1" d="M28 54h64"/>
        <path class="ac-row" pathLength="1" d="M28 64h48"/>
        <path class="ac-row" pathLength="1" d="M28 74h56"/>
        <rect x="28" y="86" width="64" height="8" rx="4"/>
        <rect class="ac-fill" x="28" y="86" width="64" height="8" rx="4"/>
        <g class="ac-check">
            <circle cx="100" cy="20" r="11"/>
            <path d="M94.5 20.5l3.5 3.5 7-7.5"/>
        </g>`,

    // Alcancía que respira mientras caen monedas; el anillo de la meta se va completando.
    savings: `
        <circle cx="22" cy="22" r="12"/>
        <circle class="sv-goal" pathLength="100" cx="22" cy="22" r="12"/>
        <circle class="sv-coin" cx="60" cy="8" r="5"/>
        <circle class="sv-coin" cx="60" cy="8" r="5"/>
        <circle class="sv-coin" cx="60" cy="8" r="5"/>
        <g class="sv-pig">
            <path d="M26 64c0-18 17-30 38-30 20 0 34 10 38 22h8v18h-9c-3 7-9 12-15 15v11H74v-8c-4 1-8 1-12 0v8H50V91c-14-5-24-15-24-27z"/>
            <path d="M26 64c-7 0-11-4-10-10"/>
            <circle cx="88" cy="58" r="2"/>
            <path d="M53 40c4-1 10-1 14 0"/>
        </g>`
};

function wrappedScene(key) {
    const paths = WRAPPED_SCENES[key];
    if (!paths) return "";
    return `<svg class="wr-scene wr-scene-${key}" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const WRAPPED_CATEGORIES = {
    transfer: { name: "Transferencias", icon: "↗" },
    bill: { name: "Facturas", icon: "◫" },
    recharge: { name: "Recargas", icon: "▤" },
    purchase: { name: "Compras con tarjeta", icon: "▭" },
    subs: { name: "Suscripciones", icon: "▶" },
    qr: { name: "Pagos con QR", icon: "▦" }
};

const WRAPPED_PERSONAS = {
    saver: { name: "El Ahorrador", text: "Siempre apartas algo para después. Tu yo del futuro te lo agradece.", icon: "$" },
    social: { name: "El Social", text: "Tu plata viaja: compartes cuentas, pagas a amigos y nunca quedas debiendo.", icon: "♥" },
    organized: { name: "El Organizado", text: "Facturas y recargas al día. Contigo no hay recargos ni cortes.", icon: "✓" },
    explorer: { name: "El Explorador", text: "Compras, QR y suscripciones: sacas el máximo provecho de tu tarjeta.", icon: "★" },
    starter: { name: "El Debutante", text: "Tu historia con Banklite apenas empieza. ¡Lo mejor está por venir!", icon: "✦" }
};

const wrMoney = value => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);
const wrPoints = value => Number(value || 0).toLocaleString("es-CO");

// Año y mes en hora de Colombia (el navegador puede estar en otra zona).
const WR_ZONE = "America/Bogota";
function wrYearMonth(date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: WR_ZONE, year: "numeric", month: "numeric" }).formatToParts(new Date(date));
    return {
        year: Number(parts.find(p => p.type === "year").value),
        month: Number(parts.find(p => p.type === "month").value) - 1
    };
}

/**
 * Categoría de un movimiento de salida según su tipo en el ledger y la
 * descripción que le pone cada servicio (card-service, payment-service).
 */
function wrappedCategory(movement) {
    const text = String(movement.description || "");
    if (movement.type === "transfer") return "transfer";
    if (movement.type !== "payment") return null;
    if (/^Suscripción /.test(text)) return "subs";
    if (/^Compra /.test(text)) return "purchase";
    if (/^Pago QR/.test(text)) return "qr";
    if (/Ref\. /.test(text)) return "bill";
    return "recharge";
}

/** Movimientos del año (hora de Colombia), paginando. */
async function wrappedMovements(accountId, year) {
    const start = new Date(Date.UTC(year, 0, 1, 5)).toISOString();   // 1 de enero 00:00 en Bogotá
    const end = new Date(Date.UTC(year + 1, 0, 1, 5)).toISOString();
    const all = [];
    for (let page = 1; page <= 50; page++) {
        const batch = await BlApi.authed(BlApi.config.ledgerApi, "GET",
            `/ledger/accounts/${accountId}/transactions?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&limit=100&page=${page}`);
        all.push(...batch);
        if (batch.length < 100) break;
    }
    return all;
}

/** Arma el resumen del año con los datos de los servicios. */
async function wrappedSummary(year = wrYearMonth(new Date()).year) {
    const { config, session } = BlApi;
    const get = (base, path) => BlApi.authed(base, "GET", path);

    const accounts = await get(config.accountApi, "/accounts");
    const usable = (accounts || []).filter(a => a.status !== "closed");
    const account = usable.find(a => a.id === session.accountId) || usable[0] || null;

    // Lo opcional no frena el resumen: si un servicio falla, esa parte sale en cero.
    const [movements, transfers, savings, rewards, kyc] = await Promise.all([
        account ? wrappedMovements(account.id, year) : Promise.resolve([]),
        get(config.transferApi, "/transfers").catch(() => []),
        get(config.savingsApi, "/savings").catch(() => null),
        get(config.rewardsApi, "/rewards").catch(() => null),
        get(config.kycApi, `/kyc/${session.idUser}`).catch(() => null)
    ]);

    // Los reversos y lo que reversaron no cuentan; tampoco lo que va y viene entre tu saldo y tu ahorro.
    const reversed = new Set(movements.filter(m => m.reversedTransactionId).map(m => m.reversedTransactionId));
    const inYear = movements.filter(m => wrYearMonth(m.createdAt).year === year && !reversed.has(m.transactionId));
    const real = inYear.filter(m => m.type !== "saving" && m.type !== "reversal");

    const income = real.filter(m => m.direction === "in").reduce((sum, m) => sum + Number(m.amount), 0);
    const spent = real.filter(m => m.direction === "out").reduce((sum, m) => sum + Number(m.amount), 0);

    // Mes más activo
    const months = new Array(12).fill(0);
    real.forEach(m => { months[wrYearMonth(m.createdAt).month]++; });
    const topMonthIndex = months.indexOf(Math.max(...months));

    // Persona a la que más le transferiste (transfer-service guarda el nombre de quien recibe)
    const people = {};
    (transfers || [])
        .filter(t => t.status === "completed" && wrYearMonth(t.createdAt).year === year)
        .forEach(t => {
            const key = (t.recipientName || "").trim()
                || (t.destinationKey ? `Llave ${t.destinationKey}` : `Cuenta ····${t.destinationAccountLast4 || ""}`);
            people[key] = people[key] || { name: key, count: 0, total: 0 };
            people[key].count++;
            people[key].total += Number(t.amount) || 0;
        });
    const topPerson = Object.values(people).sort((a, b) => b.count - a.count || b.total - a.total)[0] || null;

    // Categoría donde más usaste tu plata
    const categories = {};
    real.filter(m => m.direction === "out").forEach(m => {
        const key = wrappedCategory(m);
        if (!key) return;
        categories[key] = categories[key] || { key, ...WRAPPED_CATEGORIES[key], count: 0, total: 0 };
        categories[key].count++;
        categories[key].total += Number(m.amount);
    });
    const categoryList = Object.values(categories).sort((a, b) => b.total - a.total);

    // Ahorro: lo que salió de tu saldo hacia bolsillos, metas y CDT este año
    const savingOut = inYear.filter(m => m.type === "saving" && m.direction === "out");
    const savedIn = savingOut.reduce((sum, m) => sum + Number(m.amount), 0);
    const totals = savings?.totals || {};
    const savingsNow = (Number(totals.inPockets) || 0) + (Number(totals.inGoals) || 0) + (Number(totals.inCdts) || 0);
    const interest = Number(totals.interestEarned) || 0;

    // Puntos
    const pointsEarned = Number(rewards?.earned) || 0;
    const level = rewards?.level?.name || "Bronce";
    const badges = (rewards?.badges || []).filter(b => b.done).length;

    // Personalidad financiera
    const count = key => (categories[key] ? categories[key].count : 0);
    const scores = {
        saver: savingOut.length * 1.4,
        social: count("transfer") * 1.2,
        organized: count("bill") + count("recharge"),
        explorer: count("purchase") + count("qr") + count("subs")
    };
    let persona = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
    if (real.length < 3 || scores[persona] === 0) persona = "starter";

    return {
        year,
        name: (kyc?.nombres || "").trim().split(/\s+/)[0] || "cliente",
        total: real.length,
        income,
        spent,
        moved: income + spent,
        months,
        topMonth: months[topMonthIndex] ? { name: WRAPPED_MONTHS[topMonthIndex], count: months[topMonthIndex] } : null,
        topPerson,
        peopleCount: Object.keys(people).length,
        topCategory: categoryList[0] || null,
        categories: categoryList,
        savedIn,
        savingsNow,
        interest,
        pointsEarned,
        level,
        badges,
        persona: { key: persona, ...WRAPPED_PERSONAS[persona] },
        isNew: real.length < 3
    };
}

function wrappedSlides(data) {
    const money = wrMoney;
    const slides = [];

    slides.push({
        theme: "intro",
        scene: "bank",
        html: `
            <span class="wr-kicker">Tu año en Banklite ${data.year}</span>
            <h2>Hola, ${escapeHTML(data.name)} 👋</h2>
            <p>Hicimos un repaso de todo lo que lograste con tu plata este año.</p>
            <span class="wr-hint">Toca para continuar</span>`
    });

    if (data.isNew) {
        slides.push({
            theme: "teal",
            scene: "bank",
            html: `
                <span class="wr-kicker">Recién llegado</span>
                <h2>Tu historia apenas empieza</h2>
                <p>Todavía tienes pocos movimientos este año. Transfiere, paga una factura o abre un bolsillo y aquí verás tu resumen completo.</p>`
        });
    } else {
        slides.push({
            theme: "teal",
            scene: "account",
            html: `
                <span class="wr-kicker">Este año moviste</span>
                <b class="wr-big" data-wr-count="${Math.round(data.moved)}" data-wr-money>${money(0)}</b>
                <div class="wr-split">
                    <div><small>Entró</small><b>${money(data.income)}</b></div>
                    <div><small>Salió</small><b>${money(data.spent)}</b></div>
                </div>
                <p>En ${data.total} movimientos.</p>`
        });

        if (data.topMonth) {
            const max = Math.max(...data.months, 1);
            slides.push({
                theme: "dark",
                scene: "account",
                html: `
                    <span class="wr-kicker">Tu mes más activo fue</span>
                    <h2 class="wr-title-cap">${data.topMonth.name}</h2>
                    <p>Hiciste ${data.topMonth.count} ${data.topMonth.count === 1 ? "movimiento" : "movimientos"} ese mes.</p>
                    <div class="wr-bars" aria-hidden="true">
                        ${data.months.map((value, i) => `<span class="${value === data.topMonth.count && value ? "is-top" : ""}" style="--h:${Math.max(4, (value / max) * 100)}%" title="${WRAPPED_MONTHS[i]}"><i>${WRAPPED_MONTHS[i][0].toUpperCase()}</i></span>`).join("")}
                    </div>`
            });
        }

        if (data.topPerson) {
            slides.push({
                theme: "pale",
                scene: "account",
                html: `
                    <span class="wr-kicker">Tu persona favorita para transferir</span>
                    <span class="wr-avatar">${escapeHTML(data.topPerson.name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase())}</span>
                    <h2>${escapeHTML(data.topPerson.name)}</h2>
                    <p>Le enviaste ${data.topPerson.count} ${data.topPerson.count === 1 ? "vez" : "veces"}, en total ${money(data.topPerson.total)}.</p>
                    ${data.peopleCount > 1 ? `<small class="wr-note">Le transferiste a ${data.peopleCount} personas distintas.</small>` : ""}`
            });
        }

        if (data.topCategory) {
            slides.push({
                theme: "teal",
                scene: "account",
                html: `
                    <span class="wr-kicker">Donde más usaste tu plata</span>
                    <span class="wr-icon">${data.topCategory.icon}</span>
                    <h2>${data.topCategory.name}</h2>
                    <p>${money(data.topCategory.total)} en ${data.topCategory.count} ${data.topCategory.count === 1 ? "operación" : "operaciones"}.</p>
                    <ol class="wr-rank">
                        ${data.categories.slice(0, 4).map((c, i) => `<li><span>${i + 1}</span>${c.name}<b>${compactMoney(c.total)}</b></li>`).join("")}
                    </ol>`
            });
        }
    }

    if (data.savedIn > 0 || data.savingsNow > 0) {
        slides.push({
            theme: "dark",
            scene: "savings",
            html: `
                <span class="wr-kicker">Tu ahorro</span>
                <p>Este año apartaste</p>
                <b class="wr-big" data-wr-count="${Math.round(data.savedIn)}" data-wr-money>${money(0)}</b>
                <p>en bolsillos, metas y CDT. Hoy tienes ${money(data.savingsNow)} ahorrados${data.interest >= 1 ? ` y ganaste ${money(data.interest)} en intereses` : ""}.</p>`
        });
    }

    slides.push({
        theme: "pale",
        scene: "savings",
        html: `
            <span class="wr-kicker">Puntos Banklite</span>
            <b class="wr-big" data-wr-count="${data.pointsEarned}">0</b>
            <p>puntos ganados con Banklite</p>
            <span class="wr-pill">Nivel ${data.level}</span>
            ${data.badges ? `<small class="wr-note">Completaste ${data.badges} ${data.badges === 1 ? "reto" : "retos"}.</small>` : ""}`
    });

    slides.push({
        theme: "intro",
        scene: data.persona.key === "saver" ? "savings" : "bank",
        html: `
            <span class="wr-kicker">Tu personalidad financiera</span>
            <span class="wr-icon wr-icon-lg">${data.persona.icon}</span>
            <h2>${data.persona.name}</h2>
            <p>${data.persona.text}</p>`
    });

    slides.push({
        theme: "final",
        final: true,
        scene: "bank",
        html: `
            <div class="wr-card">
                <div class="wr-card-head"><span class="logo">B</span><b>Mi año en Banklite ${data.year}</b></div>
                <span class="wr-card-persona">${data.persona.icon} ${data.persona.name}</span>
                <dl>
                    <div><dt>Moviste</dt><dd>${compactMoney(data.moved)}</dd></div>
                    <div><dt>Ahorraste</dt><dd>${compactMoney(data.savedIn)}</dd></div>
                    <div><dt>Mes top</dt><dd class="wr-title-cap">${data.topMonth ? data.topMonth.name : "—"}</dd></div>
                    <div><dt>Puntos</dt><dd>${wrPoints(data.pointsEarned)}</dd></div>
                </dl>
                ${data.topCategory ? `<small>Lo que más hiciste: ${data.topCategory.name.toLowerCase()}</small>` : ""}
            </div>
            <div class="wr-final-actions">
                <button type="button" class="btn primary" data-wr-download>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
                    Descargar imagen
                </button>
                <button type="button" class="btn wr-ghost" data-wr-replay>Ver otra vez</button>
            </div>`
    });

    return slides;
}

// Imagen para compartir (1080 x 1350) dibujada en un canvas
function wrappedImage(data) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    const font = (weight, size) => `${weight} ${size}px Manrope, Inter, Arial, sans-serif`;

    function rounded(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, "#26474E");
    bg.addColorStop(1, "#1E8C92");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1350);

    const glow = ctx.createRadialGradient(920, 120, 10, 920, 120, 520);
    glow.addColorStop(0, "rgba(44, 206, 210, 0.45)");
    glow.addColorStop(1, "rgba(44, 206, 210, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1350);

    // Logo
    rounded(90, 90, 96, 96, 26);
    ctx.fillStyle = "#2CCED2";
    ctx.fill();
    ctx.fillStyle = "#26474E";
    ctx.font = font(800, 58);
    ctx.textAlign = "center";
    ctx.fillText("B", 138, 158);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = font(800, 44);
    ctx.fillText("banklite", 210, 152);

    ctx.fillStyle = "#B9EDED";
    ctx.font = font(700, 34);
    ctx.fillText(`MI AÑO EN BANKLITE ${data.year}`, 90, 300);

    ctx.fillStyle = "#ffffff";
    ctx.font = font(800, 84);
    ctx.fillText(data.persona.name, 90, 400);

    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    ctx.font = font(500, 34);
    wrapText(data.persona.text, 90, 470, 900, 46);

    const stats = [
        ["Moviste", compactMoney(data.moved)],
        ["Ahorraste", compactMoney(data.savedIn)],
        ["Mes más activo", data.topMonth ? data.topMonth.name[0].toUpperCase() + data.topMonth.name.slice(1) : "—"],
        ["Puntos ganados", wrPoints(data.pointsEarned)]
    ];

    stats.forEach(([label, value], i) => {
        const x = 90 + (i % 2) * 460;
        const y = 640 + Math.floor(i / 2) * 230;
        rounded(x, y, 440, 200, 32);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fill();
        ctx.fillStyle = "#B9EDED";
        ctx.font = font(600, 30);
        ctx.fillText(label, x + 36, y + 66);
        ctx.fillStyle = "#ffffff";
        ctx.font = font(800, 62);
        ctx.fillText(value, x + 36, y + 150);
    });

    if (data.topCategory) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = font(600, 32);
        ctx.fillText(`Lo que más hice: ${data.topCategory.name.toLowerCase()}`, 90, 1160);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = font(500, 26);
    ctx.fillText("Banklite · Proyecto académico", 90, 1260);

    function wrapText(text, x, y, maxWidth, lineHeight) {
        let line = "";
        text.split(" ").forEach(word => {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, y);
                line = word;
                y += lineHeight;
            } else {
                line = test;
            }
        });
        if (line) ctx.fillText(line, x, y);
    }

    return canvas;
}

function openWrapped(data) {
    if (document.getElementById("wrappedStory")) return;

    const slides = wrappedSlides(data);
    const opener = document.activeElement;
    let index = 0;
    let timer = null;
    let startedAt = 0;
    let remaining = WRAPPED_SLIDE_MS;
    let paused = false;

    document.body.insertAdjacentHTML("beforeend", `
        <div class="wrapped" id="wrappedStory" role="dialog" aria-modal="true" aria-label="Tu año en Banklite ${data.year}">
            <div class="wr-frame">
                <div class="wr-progress">${slides.map(() => `<span><i></i></span>`).join("")}</div>
                <div class="wr-top">
                    <span class="wr-brand"><span class="logo">B</span> Tu año en Banklite</span>
                    <button type="button" class="wr-close" data-wr-close aria-label="Cerrar">×</button>
                </div>
                <div class="wr-slides" aria-live="polite">
                    ${slides.map((s, i) => `<section class="wr-slide wr-${s.theme}" data-index="${i}" ${i ? "hidden" : ""}>${wrappedFx(s.scene)}${s.html}</section>`).join("")}
                </div>
                <button type="button" class="wr-nav wr-prev" data-wr-prev aria-label="Anterior"></button>
                <button type="button" class="wr-nav wr-next" data-wr-next aria-label="Siguiente"></button>
            </div>
        </div>`);

    const root = document.getElementById("wrappedStory");
    const bars = [...root.querySelectorAll(".wr-progress i")];
    const sections = [...root.querySelectorAll(".wr-slide")];
    document.body.classList.add("wrapped-open");
    requestAnimationFrame(() => root.classList.add("is-open"));

    function animateCounts(section) {
        section.querySelectorAll("[data-wr-count]").forEach(el => {
            const target = Number(el.dataset.wrCount) || 0;
            const isMoney = el.hasAttribute("data-wr-money");
            const format = value => isMoney ? wrMoney(value) : wrPoints(value);
            if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = format(target); return; }
            const start = performance.now();
            (function step(now) {
                const t = Math.min(1, (now - start) / 1100);
                el.textContent = format(Math.round(target * (1 - Math.pow(1 - t, 3))));
                if (t < 1 && root.isConnected) requestAnimationFrame(step);
            })(start);
        });
    }

    function schedule(ms) {
        clearTimeout(timer);
        if (slides[index].final) return;
        startedAt = performance.now();
        remaining = ms;
        timer = setTimeout(() => go(index + 1), ms);
    }

    function show(i) {
        index = Math.max(0, Math.min(slides.length - 1, i));
        sections.forEach((section, n) => { section.hidden = n !== index; });
        bars.forEach((bar, n) => {
            bar.style.transition = "none";
            bar.style.width = n < index ? "100%" : "0%";
        });
        const bar = bars[index];
        void bar.offsetWidth;
        if (slides[index].final) {
            bar.style.width = "100%";
        } else {
            bar.style.transition = `width ${WRAPPED_SLIDE_MS}ms linear`;
            bar.style.width = "100%";
        }
        root.classList.toggle("is-final", !!slides[index].final);
        root.dataset.theme = slides[index].theme;
        paused = false;
        root.classList.remove("is-paused");
        animateCounts(sections[index]);
        schedule(WRAPPED_SLIDE_MS);
    }

    function go(i) {
        if (i >= slides.length) return;
        show(i);
    }

    function setPaused(value) {
        if (slides[index].final || paused === value) return;
        paused = value;
        root.classList.toggle("is-paused", value);
        const bar = bars[index];
        if (value) {
            clearTimeout(timer);
            remaining -= performance.now() - startedAt;
            bar.style.width = getComputedStyle(bar).width;
            bar.style.transition = "none";
        } else {
            void bar.offsetWidth;
            bar.style.transition = `width ${Math.max(0, remaining)}ms linear`;
            bar.style.width = "100%";
            schedule(Math.max(0, remaining));
        }
    }

    function close() {
        clearTimeout(timer);
        document.removeEventListener("keydown", onKey);
        root.classList.remove("is-open");
        document.body.classList.remove("wrapped-open");
        setTimeout(() => root.remove(), 250);
        if (opener && opener.focus) opener.focus();
    }

    function onKey(event) {
        root.classList.add("is-keyboard");
        if (event.key === "Escape") close();
        else if (event.key === "ArrowRight") go(index + 1);
        else if (event.key === "ArrowLeft") go(index - 1);
        else if (event.key === " " && event.target === document.body) { event.preventDefault(); setPaused(!paused); }
    }

    root.querySelector("[data-wr-close]").addEventListener("click", close);
    root.querySelector("[data-wr-prev]").addEventListener("click", () => go(index - 1));
    root.querySelector("[data-wr-next]").addEventListener("click", () => go(index + 1));
    root.addEventListener("click", event => { if (event.target === root) close(); });

    // Mantener presionado pausa la historia
    const frame = root.querySelector(".wr-frame");
    let holdTimer = null;
    let held = false;
    frame.addEventListener("pointerdown", event => {
        if (event.target.closest("[data-wr-close], .wr-final-actions")) return;
        held = false;
        holdTimer = setTimeout(() => { held = true; setPaused(true); }, 250);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(type => frame.addEventListener(type, () => {
        clearTimeout(holdTimer);
        if (held) setPaused(false);
    }));
    frame.addEventListener("click", event => {
        if (held) { event.stopPropagation(); event.preventDefault(); held = false; }
    }, true);

    root.querySelector("[data-wr-replay]").addEventListener("click", () => show(0));
    root.querySelector("[data-wr-download]").addEventListener("click", () => {
        const canvas = wrappedImage(data);
        const link = document.createElement("a");
        link.download = `mi-ano-banklite-${data.year}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast("Descargaste tu resumen del año.", "ok");
    });

    document.addEventListener("keydown", onKey);
    show(0);
    root.querySelector("[data-wr-next]").focus({ preventScroll: true });
}


// Opción "Mi año" del menú lateral: en el dashboard es #mi-ano; desde las demás
// vistas llega como dashboard.html#mi-ano y se abre al cargar.
document.addEventListener("DOMContentLoaded", () => {
    if (!BlApi.hasSession()) return;
    const link = document.querySelector('.sidebar [data-action="mi-ano"]');
    let loading = false;

    async function start() {
        if (loading || document.getElementById("wrappedStory")) return;
        loading = true;
        link?.setAttribute("aria-busy", "true");
        try {
            openWrapped(await wrappedSummary());
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            toast(err?.message || "No pudimos armar tu resumen del año. Inténtalo de nuevo.", "err");
        } finally {
            loading = false;
            link?.removeAttribute("aria-busy");
        }
    }

    link?.addEventListener("click", event => {
        event.preventDefault();
        start();
    });

    if (location.hash === "#mi-ano") {
        history.replaceState(null, "", location.pathname + location.search);
        setTimeout(start, 300);
    }
});
