// =========================================================
// BANKLITE - MOVIMIENTOS (movimientos.html)
// Datos reales: GET /ledger/accounts/:id/transactions (paginado),
// /ledger/accounts/:id/balance y /statement (extracto PDF). Al tocar un
// movimiento se muestra su comprobante (estilo tiquete), enriquecido con lo que
// saben transfer-service (destinatario) y payment-service (factura, recarga, QR).
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("fullMovements")) return;
    if (!BlApi.protectPage()) return;

    const { config, session } = BlApi;
    const get = path => BlApi.authed(config.ledgerApi, "GET", path);
    const PAGE_SIZE = 50;

    const TYPE_LABELS = {
        transfer: "Transferencia",
        deposit: "Consignación",
        credit: "Abono",
        debit: "Cargo",
        reversal: "Reverso",
        payment: "Pago a comercio",
        reward: "Canje de puntos",
        saving: "Ahorro e inversión",
    };
    // Las transferencias a otros bancos son cargos hacia la cuenta de compensación.
    const typeLabel = m =>
        m.type === "debit" && /^Transferencia a /.test(m.description || "")
            ? "Transferencia a otro banco"
            : TYPE_LABELS[m.type];
    const ACCOUNT_TYPES = { savings: "Cuenta de ahorros", checking: "Cuenta corriente" };
    const ICON_IN =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7 7 17"/><path d="M17 17H7V7"/></svg>';
    const ICON_OUT =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>';

    const state = {
        account: null,
        kyc: null,
        items: [],
        page: 0,
        done: false,
        filter: "all",
        selected: null,
        ticket: null,
    };
    const container = byId("fullMovements");
    const search = byId("movementSearch");
    const modal = byId("movementModal");

    // Moneda de la cuenta por defecto
    const money = (v, currency = state.account?.currency) => formatMoney(v, currency);
    const monthStart = (year, month) => new Date(Date.UTC(year, month, 1, 5)); // 00:00 en Bogotá

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        toast(err?.message || fallback, "err");
    }

    function holder() {
        const k = state.kyc || {};
        return {
            name: k.nombres ? `${k.nombres} ${k.apellidos || ""}`.trim() : "Cliente Banklite",
            document: k.numeroDocumento ? `${k.tipoDocumento || "CC"} ${k.numeroDocumento}` : "No disponible",
            accountType: ACCOUNT_TYPES[state.account?.accountType] || "Cuenta",
            accountNumber: state.account?.accountNumber || "",
        };
    }

    // ---------- carga ----------
    async function init() {
        try {
            const accounts = await BlApi.authed(config.accountApi, "GET", "/accounts");
            const usable = (accounts || []).filter(a => a.status !== "closed");
            state.account = usable.find(a => a.id === session.accountId) || usable[0] || null;
            if (!state.account) {
                container.innerHTML =
                    '<div class="movement-empty"><span aria-hidden="true">↔</span><strong>Aún no tienes una cuenta</strong><p>Ábrela desde el inicio para empezar a moverte con Banklite.</p><a class="btn primary" href="dashboard.html">Ir al inicio</a></div>';
                ["sumBalance", "sumIncome", "sumExpense"].forEach(id => {
                    byId(id).textContent = "—";
                });
                return;
            }
            session.accountId = state.account.id;
            BlApi.authed(config.kycApi, "GET", `/kyc/${session.idUser}`)
                .then(k => {
                    state.kyc = k;
                })
                .catch(() => {});
            await Promise.all([loadSummary(), loadMore()]);
        } catch (err) {
            fail(err, "No se pudieron cargar tus movimientos.");
        }
    }

    async function loadSummary() {
        const now = new Date();
        const from = monthStart(now.getUTCFullYear(), now.getUTCMonth()).toISOString();
        const [balance, month] = await Promise.all([
            get(`/ledger/accounts/${state.account.id}/balance`),
            (async () => {
                const all = [];
                for (let page = 1; page <= 10; page++) {
                    const batch = await get(
                        `/ledger/accounts/${state.account.id}/transactions?from=${encodeURIComponent(from)}&limit=100&page=${page}`
                    );
                    all.push(...batch);
                    if (batch.length < 100) break;
                }
                return all;
            })(),
        ]);
        let income = 0,
            expense = 0;
        month.forEach(m => {
            if (m.direction === "in") income += Number(m.amount) || 0;
            else expense += Number(m.amount) || 0;
        });
        byId("sumBalance").textContent = money(balance.balance, balance.currency);
        byId("sumIncome").textContent = "+" + money(income);
        byId("sumExpense").textContent = "−" + money(expense);
    }

    async function loadMore() {
        if (state.done) return;
        const button = byId("loadMoreMovements");
        button.disabled = true;
        try {
            const batch = await get(
                `/ledger/accounts/${state.account.id}/transactions?limit=${PAGE_SIZE}&page=${state.page + 1}`
            );
            state.page += 1;
            state.items.push(...batch);
            state.done = batch.length < PAGE_SIZE;
            render();
        } catch (err) {
            fail(err, "No se pudieron cargar más movimientos.");
        } finally {
            button.disabled = false;
            button.hidden = state.done;
        }
    }
    byId("loadMoreMovements").addEventListener("click", loadMore);

    // ---------- filtros, búsqueda y lista agrupada por día ----------
    function visible() {
        const term = (search.value || "").trim().toLowerCase();
        return state.items
            .map((m, index) => ({ m, index }))
            .filter(({ m }) => state.filter === "all" || m.direction === state.filter)
            .filter(
                ({ m }) =>
                    !term ||
                    `${m.description || ""} ${typeLabel(m) || ""} ${m.counterpartyAccountLast4 || ""}`
                        .toLowerCase()
                        .includes(term)
            );
    }

    function dayLabel(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Sin fecha";
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return "Hoy";
        if (date.toDateString() === yesterday.toDateString()) return "Ayer";
        return formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }

    function render() {
        const items = visible();
        container.replaceChildren();
        if (!items.length) {
            const searching = (search.value || "").trim();
            container.innerHTML = `<div class="movement-empty"><span aria-hidden="true">↔</span><strong></strong><p></p></div>`;
            container.querySelector("strong").textContent = searching
                ? "No encontramos resultados"
                : state.filter === "all"
                  ? "Aún no tienes movimientos"
                  : "No hay operaciones en este filtro";
            container.querySelector("p").textContent = searching
                ? "Prueba con otra palabra."
                : "Las operaciones de tu cuenta aparecerán aquí.";
            return;
        }
        let lastDay = "";
        items.forEach(({ m, index }) => {
            const day = dayLabel(m.createdAt);
            if (day !== lastDay) {
                const header = document.createElement("div");
                header.className = "movement-day";
                header.textContent = day;
                container.appendChild(header);
                lastDay = day;
            }
            const incoming = m.direction === "in";
            const entry = document.createElement("article");
            entry.className = "movement-entry";
            entry.innerHTML = `
                <button class="movement-row" type="button" data-movement-index="${index}">
                    <span class="movement-icon ${incoming ? "income" : "expense"}" aria-hidden="true">${incoming ? ICON_IN : ICON_OUT}</span>
                    <span class="movement-info"><strong></strong><span></span></span>
                    <span class="movement-meta"><strong class="movement-amount ${incoming ? "positive" : "negative"}"></strong><time></time></span>
                    <span class="movement-chevron" aria-hidden="true">›</span>
                </button>`;
            entry.querySelector(".movement-info strong").textContent = m.description || typeLabel(m) || "Movimiento";
            entry.querySelector(".movement-info span").textContent = [
                typeLabel(m),
                m.counterpartyAccountLast4
                    ? `${m.type === "payment" ? "Comercio" : "Cuenta"} ····${m.counterpartyAccountLast4}`
                    : "",
            ]
                .filter(Boolean)
                .join(" · ");
            entry.querySelector(".movement-amount").textContent =
                `${incoming ? "+" : "−"}${money(m.amount, m.currency)}`;
            entry.querySelector("time").textContent = formatDate(m.createdAt, { hour: "2-digit", minute: "2-digit" });
            container.appendChild(entry);
        });
    }

    const filters = [...document.querySelectorAll("[data-filter]")];
    filters.forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter));
        button.addEventListener("click", () => {
            state.filter = button.dataset.filter || "all";
            filters.forEach(f => {
                f.classList.toggle("active", f === button);
                f.setAttribute("aria-pressed", String(f === button));
            });
            render();
        });
    });
    search.addEventListener("input", render);

    // ---------- comprobante del movimiento (estilo tiquete) ----------
    // El ledger no guarda nombres: el destinatario, la factura o la recarga se
    // toman de transfer-service y payment-service (solo lo que hizo el cliente).
    let extrasPromise = null;
    function loadExtras() {
        if (!extrasPromise) {
            const byLedger = list =>
                new Map((list || []).filter(x => x.ledgerTransactionId).map(x => [x.ledgerTransactionId, x]));
            extrasPromise = Promise.all([
                BlApi.authed(config.transferApi, "GET", "/transfers")
                    .then(byLedger)
                    .catch(() => new Map()),
                BlApi.authed(config.paymentApi || config.transferApi, "GET", "/payments")
                    .then(byLedger)
                    .catch(() => new Map()),
            ]).then(([transfers, payments]) => ({ transfers, payments }));
        }
        return extrasPromise;
    }

    const formatPhone = n => String(n || "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
    const ownProduct = () =>
        `${ACCOUNT_TYPES[state.account?.accountType] || "Cuenta"} ···· ${String(state.account?.accountNumber || "").slice(-4)}`;
    const last4 = m => (m.counterpartyAccountLast4 ? `···· ${m.counterpartyAccountLast4}` : null);
    // La llave del destinatario se muestra a medias (la @llave sí completa).
    function maskKey(key) {
        const value = String(key || "");
        if (value.startsWith("@")) return value;
        if (value.includes("@")) {
            const [user, domain] = value.split("@");
            return `${user.slice(0, 2)}•••@${domain}`;
        }
        if (/^3\d{9}$/.test(value)) return `${value.slice(0, 3)} ••• ${value.slice(-4)}`;
        return `••• ${value.slice(-4)}`;
    }

    // Título, subtítulo y filas del comprobante según el tipo de operación.
    function ticketOf(m, extras) {
        const incoming = m.direction === "in";
        const transfer = extras.transfers.get(m.transactionId);
        const payment = extras.payments.get(m.transactionId);
        const isQR = /^Pago QR/.test(m.description || "");
        const concept = String(m.description || "").replace(/^Pago QR · /, "");
        let title;
        let sub;
        let rows;

        if (payment?.kind === "bill") {
            title = "¡Factura pagada!";
            sub = `${payment.serviceName || "Servicio"} · ${payment.billerName}`;
            rows = [
                ["Empresa", payment.billerName],
                ["Servicio", payment.serviceName],
                ["Referencia de pago", payment.reference],
            ];
        } else if (payment?.kind === "topup") {
            title = "¡Recarga exitosa!";
            sub = `${payment.billerName} · ${payment.topupType || "Recarga"}`;
            rows = [
                ["Operador", payment.billerName],
                ["Celular", formatPhone(payment.reference)],
                ["Tipo de recarga", payment.topupType],
            ];
        } else if (payment?.kind === "qr") {
            title = "¡Pago exitoso!";
            sub = "Pago con QR";
            rows = [
                ["Comercio", payment.billerName],
                ["Concepto", concept.replace(`${payment.billerName} · `, "")],
            ];
        } else if (m.type === "debit" && /^Transferencia a /.test(m.description || "")) {
            title = "¡Envío exitoso!";
            sub = "Transferencia a otro banco";
            const bank =
                transfer?.destinationBank || (m.description.match(/^Transferencia a ([^·]+) ·/) || [])[1]?.trim();
            rows = [
                ["Para", transfer?.recipientName],
                ["Entidad", bank],
                [
                    transfer?.destinationAccountType
                        ? `Cuenta de ${transfer.destinationAccountType.toLowerCase()}`
                        : /^Billetera Demo /.test(bank || "")
                          ? "Celular"
                          : "Cuenta",
                    transfer ? `···· ${transfer.destinationAccountLast4}` : null,
                ],
                [
                    "Concepto",
                    transfer?.description && transfer.description !== "Transferencia" ? transfer.description : null,
                ],
            ];
        } else if (m.type === "transfer" && !incoming) {
            title = "¡Envío exitoso!";
            sub = isQR
                ? "Pago con QR"
                : transfer?.destinationKey
                  ? "Envío con llave Banklite"
                  : "Transferencia a Banklite";
            rows = [
                ["Para", transfer?.recipientName || "Cliente Banklite"],
                ["Entidad", "Banklite"],
                transfer?.destinationKey
                    ? ["Llave Banklite", maskKey(transfer.destinationKey)]
                    : ["Cuenta Banklite", last4(m)],
                ["Concepto", concept || "Transferencia"],
            ];
        } else if (m.type === "transfer") {
            title = "¡Te llegó plata!";
            sub = isQR ? "Pago recibido por QR" : "Transferencia recibida";
            rows = [
                ["De", "Cliente Banklite"],
                ["Cuenta de origen", last4(m)],
                ["Concepto", concept || "Transferencia"],
            ];
        } else if (m.type === "payment") {
            title = "¡Pago exitoso!";
            sub = "Pago a comercio";
            rows = [
                ["Comercio", last4(m) ? `Comercio ${last4(m)}` : null],
                ["Concepto", m.description],
            ];
        } else if (m.type === "reward") {
            title = "¡Canje exitoso!";
            sub = "Puntos Banklite";
            rows = [["Premio", String(m.description || "").replace(/^Canje de Puntos Banklite · /, "")]];
        } else if (m.type === "saving") {
            const desc = String(m.description || "");
            title = incoming
                ? desc.startsWith("Intereses")
                    ? "¡Te pagamos intereses!"
                    : "Volvió a tu saldo"
                : "Plata apartada";
            sub = desc.split(" · ")[0];
            rows = [["Detalle", desc.split(" · ").slice(1).join(" · ") || desc]];
        } else if (m.type === "deposit") {
            title = "¡Consignación recibida!";
            sub = "Consignación";
            rows = [["Concepto", m.description]];
        } else if (m.type === "credit") {
            title = "¡Te abonaron plata!";
            sub = "Abono";
            rows = [["Concepto", m.description]];
        } else if (m.type === "reversal") {
            title = "Reverso aplicado";
            sub = incoming ? "Te devolvimos el dinero" : "Reverso";
            rows = [["Concepto", m.description]];
        } else {
            title = "Cargo aplicado";
            sub = typeLabel(m) || "Cargo";
            rows = [["Concepto", m.description]];
        }

        rows.push(
            ["Fecha y hora", formatDate(m.createdAt, { dateStyle: "long", timeStyle: "short" })],
            [incoming ? "Llegó a" : "Salió de", ownProduct()],
            ["Estado", "Exitosa"]
        );
        return { title, sub, incoming, rows: rows.filter(([, value]) => value) };
    }

    function paintTicket(m, ticket) {
        byId("detailTitle").textContent = ticket.title;
        byId("detailSub").textContent = ticket.sub;
        byId("detailIcon").className = `ticket-check ${ticket.incoming ? "is-in" : ""}`;
        byId("detailAmount").textContent = `${ticket.incoming ? "+" : "−"}${money(m.amount, m.currency)}`;
        byId("detailAmount").className = `ticket-amount ${ticket.incoming ? "is-in" : ""}`;
        byId("detailRef").textContent = String(m.transactionId || "")
            .slice(0, 8)
            .toUpperCase();
        byId("detailRef").title = m.transactionId || "";
        const body = byId("detailBody");
        body.replaceChildren();
        ticket.rows.forEach(([label, value]) => {
            const row = document.createElement("div");
            row.innerHTML = "<dt></dt><dd></dd>";
            row.querySelector("dt").textContent = label;
            row.querySelector("dd").textContent = value;
            if (label === "Estado") row.querySelector("dd").className = "is-ok";
            body.appendChild(row);
        });
    }

    container.addEventListener("click", async event => {
        const button = event.target.closest("[data-movement-index]");
        if (!button) return;
        const m = state.items[Number(button.dataset.movementIndex)];
        if (!m) return;
        state.selected = m;
        // Primero lo que dice el ledger; al llegar los datos de transfer/payment se completa.
        const empty = { transfers: new Map(), payments: new Map() };
        state.ticket = ticketOf(m, empty);
        paintTicket(m, state.ticket);
        openModal("movementModal");
        const extras = await loadExtras();
        if (state.selected !== m) return;
        state.ticket = ticketOf(m, extras);
        paintTicket(m, state.ticket);
    });
    const closeTicket = () => modal.classList.remove("active");
    modal.querySelectorAll(".modal-close, #detailOk").forEach(b => b.addEventListener("click", closeTicket));
    modal.addEventListener("click", event => {
        if (event.target === modal) closeTicket();
    });

    byId("detailReceipt").addEventListener("click", () => {
        if (!state.selected) return;
        downloadReceipt(state.selected, holder());
        toast("Comprobante descargado.", "ok");
    });

    // Compartir: menú del sistema en el celular; si no hay, se copia el resumen.
    byId("detailShare").addEventListener("click", async () => {
        const m = state.selected;
        const ticket = state.ticket;
        if (!m || !ticket) return;
        const text = [
            `Banklite · ${ticket.title}`,
            `Valor: ${money(m.amount, m.currency)}`,
            ...ticket.rows
                .filter(([label]) => label !== "Salió de" && label !== "Llegó a")
                .map(([label, value]) => `${label}: ${value}`),
            `Referencia: ${String(m.transactionId || "")
                .slice(0, 8)
                .toUpperCase()}`,
        ].join("\n");
        try {
            if (navigator.share) {
                await navigator.share({ title: `Comprobante Banklite · ${ticket.title}`, text });
                return;
            }
            await navigator.clipboard.writeText(text);
            toast("Comprobante copiado. Pégalo donde quieras compartirlo.", "ok");
        } catch (err) {
            if (err?.name !== "AbortError") toast("No se pudo compartir el comprobante.", "err");
        }
    });

    // ---------- CSV (lo cargado y filtrado) ----------
    byId("exportMovements").addEventListener("click", () => {
        const items = visible();
        if (!items.length)
            return showMessage("Sin movimientos", "No hay movimientos para descargar con este filtro.", "i");
        // Una descripción como =HYPERLINK(...) se ejecutaría como fórmula al abrir
        // el CSV: se antepone ' a lo que empiece por =, +, -, @, tab o CR.
        const cell = v => (typeof v === "number" ? String(v) : String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&"));
        const quote = v => `"${cell(v).replace(/"/g, '""')}"`;
        const rows = [
            ["Fecha", "Descripción", "Tipo", "Cuenta contraparte", "Valor", "Moneda", "N.º de operación"],
            ...items.map(({ m }) => [
                formatDate(m.createdAt, { dateStyle: "short", timeStyle: "short" }),
                m.description || "",
                typeLabel(m) || "",
                m.counterpartyAccountLast4 ? `····${m.counterpartyAccountLast4}` : "",
                (m.direction === "in" ? 1 : -1) * (Number(m.amount) || 0),
                m.currency,
                m.transactionId,
            ]),
        ];
        const csv = "﻿" + rows.map(r => r.map(quote).join(";")).join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `movimientos-banklite-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    // ---------- extracto mensual (GET /statement) ----------
    const MONTHS = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
    ];
    const statementSelect = byId("statementMonth");

    byId("openStatement").addEventListener("click", () => {
        if (!state.account) return showMessage("Sin cuenta", "Abre tu cuenta para descargar extractos.", "i");
        // Meses desde la apertura de la cuenta hasta hoy (más reciente primero).
        const opened = new Date(state.account.createdAt || Date.now());
        const now = new Date();
        const options = [];
        let y = now.getFullYear();
        let mo = now.getMonth();
        while (
            (y > opened.getFullYear() || (y === opened.getFullYear() && mo >= opened.getMonth())) &&
            options.length < 24
        ) {
            options.push(`<option value="${y}-${mo}">${MONTHS[mo]} ${y}</option>`);
            mo -= 1;
            if (mo < 0) {
                mo = 11;
                y -= 1;
            }
        }
        statementSelect.innerHTML = options.join("");
        openModal("statementModal");
    });

    byId("statementForm").addEventListener("submit", async event => {
        event.preventDefault();
        const [year, month] = statementSelect.value.split("-").map(Number);
        const from = monthStart(year, month).toISOString();
        const to = monthStart(month === 11 ? year + 1 : year, (month + 1) % 12).toISOString();
        const button = event.target.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const statement = await get(
                `/ledger/accounts/${state.account.id}/statement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            );
            const label = `${MONTHS[month]} ${year}`;
            downloadStatement(statement, holder(), label, `${year}-${String(month + 1).padStart(2, "0")}`);
            closeModalById("statementModal");
            toast(`Extracto de ${label.toLowerCase()} descargado.`, "ok");
        } catch (err) {
            fail(err, "No se pudo generar el extracto.");
        } finally {
            button.disabled = false;
        }
    });

    init();
});
