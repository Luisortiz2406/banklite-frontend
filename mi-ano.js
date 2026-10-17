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

// Fondo animado de cada historia, con motivos financieros (solo decorativo; los
// estilos están en styles.css, "wr-fx"): velas de bolsa, una gráfica de tendencia
// que se dibuja al alza y monedas y símbolos que suben girando.
const WRAPPED_TOKENS = ["coin", "$", "coin", "%", "coin", "↗", "coin", "$", "coin", "%", "coin", "↗"];

const wrappedFx = art => `
    <div class="wr-fx" aria-hidden="true">
        <span class="wr-aurora wr-aurora-1"></span>
        <span class="wr-aurora wr-aurora-2"></span>
        <span class="wr-aurora wr-aurora-3"></span>
        ${wrappedArt(art)}
        <div class="wr-candles">${"<span></span>".repeat(9)}</div>
        <svg class="wr-chart" viewBox="0 0 300 120" preserveAspectRatio="none">
            <path class="wr-chart-area" d="M0 100L30 92 55 96 80 78 105 84 130 64 155 70 180 50 205 56 230 36 255 40 280 18 300 22V120H0Z"/>
            <path class="wr-chart-line" pathLength="100" d="M0 100L30 92 55 96 80 78 105 84 130 64 155 70 180 50 205 56 230 36 255 40 280 18 300 22"/>
        </svg>
        <span class="wr-chart-dot"></span>
        ${WRAPPED_TOKENS.map(t => t === "coin" ? '<i class="wr-coin">$</i>' : `<i class="wr-sym">${t}</i>`).join("")}
    </div>`;

// Ilustración de cada historia: dibujo de línea muy transparente, como marca de
// agua (solo decorativo). Usa currentColor: el color y la opacidad salen del tema.
const WRAPPED_ART = {
    hello: '<rect x="32" y="56" width="56" height="42" rx="4"/><rect x="27" y="44" width="66" height="13" rx="3"/><path d="M60 44v54"/><path d="M60 44c-6-12-20-14-20-5s14 5 20 5zM60 44c6-12 20-14 20-5s-14 5-20 5z"/><path d="M18 30l5 4M98 22l-3 6M104 52l6-2M14 64l6 1M86 10l1 6M30 14l4 5"/>',
    seed: '<path d="M40 82h40l-6 26H46z"/><path d="M60 82V52"/><path d="M60 62c-14 0-22-10-22-22 12 0 22 8 22 22zM60 54c0-16 10-26 26-26 0 16-10 26-26 26z"/>',
    coins: '<ellipse cx="46" cy="88" rx="22" ry="7"/><path d="M24 88v10c0 4 10 7 22 7s22-3 22-7V88"/><path d="M24 76v12M68 76v12"/><ellipse cx="46" cy="76" rx="22" ry="7"/><ellipse cx="74" cy="56" rx="22" ry="7"/><path d="M52 56v10c0 4 10 7 22 7s22-3 22-7V56"/><path d="M86 18v22M80 24l6-6 6 6M30 58V36M24 52l6 6 6-6"/>',
    calendar: '<rect x="20" y="28" width="80" height="72" rx="8"/><path d="M20 48h80M42 20v16M78 20v16"/><path d="M36 62h.01M52 62h.01M68 62h.01M84 62h.01M36 76h.01M52 76h.01M84 76h.01M36 90h.01M52 90h.01M68 90h.01"/><circle cx="68" cy="76" r="7"/>',
    people: '<circle cx="42" cy="44" r="13"/><path d="M18 96c0-14 11-25 24-25s24 11 24 25"/><circle cx="80" cy="50" r="11"/><path d="M62 96c2-12 9-20 18-20 11 0 20 9 20 20"/><path d="M60 22c-3-5-11-4-11 2 0 5 11 11 11 11s11-6 11-11c0-6-8-7-11-2z"/>',
    send: '<path d="M104 18L16 54l32 12 12 34z"/><path d="M104 18L48 66"/><path d="M14 92c10-2 18 2 22 8M8 76c6 0 10 2 13 5"/>',
    receipt: '<path d="M32 14h56v92l-7-5-7 5-7-5-7 5-7-5-7 5-7-5-7 5z"/><path d="M44 34h32M44 48h32M44 62h20M44 78h14M72 78h4"/>',
    phone: '<rect x="38" y="16" width="44" height="88" rx="8"/><path d="M54 24h12M56 94h8"/><path d="M90 40c6 6 6 18 0 24M98 32c11 11 11 29 0 40"/>',
    card: '<rect x="14" y="32" width="92" height="58" rx="8"/><rect x="26" y="48" width="16" height="12" rx="2"/><path d="M26 76h22M56 76h12"/><path d="M80 50c4 4 4 10 0 14M88 44c7 7 7 19 0 26"/>',
    play: '<rect x="14" y="24" width="92" height="62" rx="8"/><path d="M52 42v26l22-13z"/><path d="M40 100h40M60 86v14"/>',
    qr: '<rect x="18" y="18" width="32" height="32" rx="4"/><rect x="70" y="18" width="32" height="32" rx="4"/><rect x="18" y="70" width="32" height="32" rx="4"/><rect x="28" y="28" width="12" height="12"/><rect x="80" y="28" width="12" height="12"/><rect x="28" y="80" width="12" height="12"/><path d="M70 70h10v10M92 70h10M70 92h10v10M90 84v18h12M102 80v.01"/>',
    piggy: '<path d="M26 64c0-18 17-30 38-30 20 0 34 10 38 22h8v18h-9c-3 7-9 12-15 15v11H74v-8c-4 1-8 1-12 0v8H50V91c-14-5-24-15-24-27z"/><path d="M26 64c-7 0-11-4-10-10"/><circle cx="88" cy="58" r="2"/><path d="M52 40c4-1 10-1 14 0"/><circle cx="60" cy="18" r="9"/><path d="M60 14v8"/>',
    trophy: '<path d="M40 18h40v28c0 12-9 22-20 22S40 58 40 46z"/><path d="M40 28H24c0 14 7 22 18 22M80 28h16c0 14-7 22-18 22"/><path d="M60 68v14M44 102h32l-4-20H48z"/><path d="M60 30l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L50 37.5l7-.5z"/>',
    hearts: '<path d="M46 98S16 78 16 56c0-10 8-18 17-18 6 0 10 3 13 8 3-5 7-8 13-8 9 0 17 8 17 18 0 22-30 42-30 42z"/><path d="M84 52s-14-10-14-21c0-5 4-9 8-9 3 0 5 1 6 4 1-3 3-4 6-4 4 0 8 4 8 9 0 11-14 21-14 21z"/>',
    checklist: '<rect x="26" y="20" width="68" height="88" rx="8"/><rect x="46" y="12" width="28" height="14" rx="4"/><path d="M38 48l5 5 9-10M60 48h22M38 70l5 5 9-10M60 70h22M38 92l5 5 9-10M60 92h22"/>',
    compass: '<circle cx="60" cy="60" r="44"/><circle cx="60" cy="60" r="36"/><path d="M60 16v8M60 96v8M16 60h8M96 60h8"/><path d="M74 46L66 66 46 74l8-20z"/><circle cx="60" cy="60" r="2"/>',
    rocket: '<path d="M60 12c16 12 22 32 18 56H42c-4-24 2-44 18-56z"/><circle cx="60" cy="42" r="8"/><path d="M42 68l-12 14 14-2M78 68l12 14-14-2"/><path d="M52 76c0 12 8 22 8 22s8-10 8-22"/>',
    stars: '<path d="M60 14c3 22 10 29 32 32-22 3-29 10-32 32-3-22-10-29-32-32 22-3 29-10 32-32z"/><path d="M96 74c1.5 9 4.5 12 14 13.5-9.5 1.5-12.5 4.5-14 14-1.5-9.5-4.5-12.5-14-14 9.5-1.5 12.5-4.5 14-13.5z"/><path d="M26 82c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z"/>'
};

const WRAPPED_CATEGORY_ART = { transfer: "send", bill: "receipt", recharge: "phone", purchase: "card", subs: "play", qr: "qr" };
const WRAPPED_PERSONA_ART = { saver: "piggy", social: "hearts", organized: "checklist", explorer: "compass", starter: "rocket" };

function wrappedArt(key) {
    const paths = WRAPPED_ART[key];
    if (!paths) return "";
    return `<svg class="wr-art wr-art-${key}" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
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
        art: "hello",
        html: `
            <span class="wr-kicker">Tu año en Banklite ${data.year}</span>
            <h2>Hola, ${escapeHTML(data.name)} 👋</h2>
            <p>Hicimos un repaso de todo lo que lograste con tu plata este año.</p>
            <span class="wr-hint">Toca para continuar</span>`
    });

    if (data.isNew) {
        slides.push({
            theme: "teal",
            art: "seed",
            html: `
                <span class="wr-kicker">Recién llegado</span>
                <h2>Tu historia apenas empieza</h2>
                <p>Todavía tienes pocos movimientos este año. Transfiere, paga una factura o abre un bolsillo y aquí verás tu resumen completo.</p>`
        });
    } else {
        slides.push({
            theme: "teal",
            art: "coins",
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
                art: "calendar",
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
                art: "people",
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
                art: WRAPPED_CATEGORY_ART[data.topCategory.key],
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
            art: "piggy",
            html: `
                <span class="wr-kicker">Tu ahorro</span>
                <p>Este año apartaste</p>
                <b class="wr-big" data-wr-count="${Math.round(data.savedIn)}" data-wr-money>${money(0)}</b>
                <p>en bolsillos, metas y CDT. Hoy tienes ${money(data.savingsNow)} ahorrados${data.interest >= 1 ? ` y ganaste ${money(data.interest)} en intereses` : ""}.</p>`
        });
    }

    slides.push({
        theme: "pale",
        art: "trophy",
        html: `
            <span class="wr-kicker">Puntos Banklite</span>
            <b class="wr-big" data-wr-count="${data.pointsEarned}">0</b>
            <p>puntos ganados con Banklite</p>
            <span class="wr-pill">Nivel ${data.level}</span>
            ${data.badges ? `<small class="wr-note">Completaste ${data.badges} ${data.badges === 1 ? "reto" : "retos"}.</small>` : ""}`
    });

    slides.push({
        theme: "intro",
        art: WRAPPED_PERSONA_ART[data.persona.key],
        html: `
            <span class="wr-kicker">Tu personalidad financiera</span>
            <span class="wr-icon wr-icon-lg">${data.persona.icon}</span>
            <h2>${data.persona.name}</h2>
            <p>${data.persona.text}</p>`
    });

    slides.push({
        theme: "final",
        final: true,
        art: "stars",
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
                    ${slides.map((s, i) => `<section class="wr-slide wr-${s.theme}" data-index="${i}" ${i ? "hidden" : ""}>${wrappedFx(s.art)}${s.html}</section>`).join("")}
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
