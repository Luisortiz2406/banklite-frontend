// =========================================================
// BANKLITE - BOLSILLOS Y CDT (inversiones.html)
// Mismo diseño y comportamiento que la versión simulada, contra savings-service
// (/savings). La plata de bolsillos y CDT se mueve de verdad en el ledger
// (custodia), con una clave de idempotencia por operación: un doble clic nunca
// mueve la plata dos veces. Los intereses de los bolsillos se causan solos.
// =========================================================

const POCKET_ICONS = {
    general:
        '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    viaje: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    casa: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    carro: '<path d="M5 17h14M6 17v2M18 17v2"/><path d="M3 13l2-6a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 6v4H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
    estudio:
        '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    regalo: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    emergencia: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4M12 16h.01"/>',
};
const pocketSvg = key =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${POCKET_ICONS[key] || POCKET_ICONS.general}</svg>`;

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("savingsPage")) return;
    if (!BlApi.protectPage()) return;

    const { config, session } = BlApi;
    const api = config.savingsApi || config.transferApi;
    const DAY_MS = 86400000;
    const state = { data: null, balance: 0, term: null, busy: false };

    const parseMoney = v => Number(String(v || "").replace(/\D/g, "")) || 0;
    const uuid = () =>
        crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    const rate = value => `${(value * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}% E.A.`;
    const interestFor = (amount, r, days) => amount * (Math.pow(1 + r, days / 365) - 1);

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo completar", err?.message || fallback, "!");
    }

    const thousands = input =>
        input.addEventListener("input", () => {
            const value = parseMoney(input.value);
            input.value = value ? value.toLocaleString("es-CO") : "";
        });

    // -----------------------------------------------------
    // CARGA Y RESUMEN
    // -----------------------------------------------------

    async function loadBalance() {
        try {
            const accounts = await BlApi.authed(config.accountApi, "GET", "/accounts");
            const account =
                (accounts || []).find(a => a.id === session.accountId) ||
                (accounts || []).find(a => a.status === "active");
            if (!account) return;
            const balance = await BlApi.authed(config.ledgerApi, "GET", `/ledger/accounts/${account.id}/balance`);
            state.balance = Number(balance.balance) || 0;
        } catch (err) {
            BlApi.handleAuthError(err);
        }
    }

    async function refresh() {
        try {
            const [data] = await Promise.all([BlApi.authed(api, "GET", "/savings"), loadBalance()]);
            state.data = data;
            if (!state.term) state.term = data.config.cdtTerms[2] || data.config.cdtTerms[0];
            renderSummary();
            renderPockets();
            renderTerms();
            renderCdts();
            paintSimulation();
        } catch (err) {
            fail(err, "No se pudieron cargar tus ahorros.");
        }
    }

    function renderSummary() {
        const t = state.data.totals;
        setText("pocketRateText", rate(state.data.config.pocketRate));
        setText("savAvailable", formatMoney(state.balance));
        setText("savPockets", formatMoney(t.inPockets));
        setText("savCdts", formatMoney(t.inCdts));
        setText("savInterest", "+" + formatMoney(t.interestEarned));
    }

    // -----------------------------------------------------
    // BOLSILLOS
    // -----------------------------------------------------

    const pocketList = byId("pocketList");

    function renderPockets() {
        const list = state.data.pockets;
        const r = state.data.config.pocketRate;

        if (!list.length) {
            pocketList.innerHTML = `
                <div class="pocket-empty">
                    <span class="pocket-icon">${pocketSvg("general")}</span>
                    <strong>Todavía no tienes bolsillos</strong>
                    <p>Crea uno para apartar plata del viaje, la moto o las emergencias, y que vaya ganando intereses.</p>
                </div>`;
            return;
        }

        pocketList.innerHTML = list
            .map(pocket => {
                const daily = interestFor(pocket.balance, r, 1);
                const yearly = interestFor(pocket.balance, r, 365);
                return `
                <article class="pocket-card">
                    <div class="pocket-top">
                        <span class="pocket-icon">${pocketSvg(pocket.icon)}</span>
                        <div>
                            <strong>${escapeHTML(pocket.name)}</strong>
                            <small>${rate(r)}</small>
                        </div>
                        <button type="button" class="pocket-delete" data-pocket-delete="${pocket.id}" aria-label="Eliminar bolsillo ${escapeHTML(pocket.name)}">×</button>
                    </div>
                    <b class="pocket-balance">${formatMoney(pocket.balance)}</b>
                    <div class="pocket-stats">
                        <span>Ganado: <b>+${formatMoney(pocket.earned)}</b></span>
                        <span>${pocket.balance > 0 ? `≈ ${formatMoney(daily)} al día · ${formatMoney(yearly)} en un año` : "Agrega plata para empezar a ganar"}</span>
                    </div>
                    <div class="pocket-actions">
                        <button type="button" class="btn primary" data-pocket-add="${pocket.id}">Agregar</button>
                        <button type="button" class="btn soft" data-pocket-take="${pocket.id}" ${pocket.balance < 1 ? "disabled" : ""}>Sacar</button>
                    </div>
                </article>`;
            })
            .join("");
    }

    // Nuevo bolsillo
    const iconBox = byId("pocketIcons");
    let chosenIcon = "general";
    iconBox.innerHTML = Object.keys(POCKET_ICONS)
        .map(
            key => `
        <button type="button" class="pocket-icon-option${key === "general" ? " selected" : ""}" data-icon="${key}" role="radio" aria-checked="${key === "general"}" aria-label="${key}">${pocketSvg(key)}</button>
    `
        )
        .join("");
    iconBox.addEventListener("click", event => {
        const option = event.target.closest("[data-icon]");
        if (!option) return;
        chosenIcon = option.dataset.icon;
        iconBox.querySelectorAll("[data-icon]").forEach(item => {
            item.classList.toggle("selected", item === option);
            item.setAttribute("aria-checked", String(item === option));
        });
    });
    thousands(byId("pocketInitial"));

    byId("newPocket").addEventListener("click", () => {
        byId("pocketForm").reset();
        openModal("pocketModal");
    });

    byId("pocketForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (state.busy) return;
        const name = byId("pocketName").value.trim();
        const initial = parseMoney(byId("pocketInitial").value);
        if (name.length < 2) return toast("Ponle un nombre a tu bolsillo.", "err");
        if (initial && initial < 1000) return toast("El valor mínimo es $1.000.", "err");
        if (initial > state.balance)
            return toast(`No tienes saldo suficiente. Disponible: ${formatMoney(state.balance)}.`, "err");

        state.busy = true;
        try {
            const pocket = await BlApi.authed(api, "POST", "/savings/pockets", {
                kind: "pocket",
                name,
                icon: chosenIcon,
            });
            if (initial > 0) {
                await BlApi.authed(api, "POST", `/savings/pockets/${pocket.id}/deposit`, {
                    amount: initial,
                    idempotencyKey: uuid(),
                });
            }
            closeModalById("pocketModal");
            toast(`Bolsillo "${name}" creado.`, "ok");
        } catch (err) {
            fail(err, "No se pudo crear el bolsillo.");
        } finally {
            state.busy = false;
            refresh();
        }
    });

    // Agregar / sacar
    thousands(byId("pocketMoveAmount"));
    let moveKey = null;

    pocketList.addEventListener("click", async event => {
        const add = event.target.closest("[data-pocket-add]");
        const take = event.target.closest("[data-pocket-take]");
        const remove = event.target.closest("[data-pocket-delete]");

        if (add || take) {
            const id = (add || take).dataset.pocketAdd || (add || take).dataset.pocketTake;
            const pocket = state.data.pockets.find(item => item.id === id);
            byId("pocketMoveId").value = id;
            byId("pocketMoveMode").value = add ? "add" : "take";
            byId("pocketMoveAmount").value = "";
            moveKey = uuid(); // una clave por intento: el doble clic usa la misma
            setText("pocketMoveEyebrow", `Bolsillo ${pocket.name}`);
            setText("pocketMoveTitle", add ? "Agregar dinero" : "Sacar dinero");
            setText(
                "pocketMoveHint",
                add
                    ? `Sale de tu saldo disponible (${formatMoney(state.balance)}).`
                    : `Vuelve a tu saldo disponible. En el bolsillo tienes ${formatMoney(pocket.balance)}.`
            );
            setText("pocketMoveSubmit", add ? "Agregar al bolsillo" : "Pasar a mi saldo");
            openModal("pocketMoveModal");
        }

        if (remove) {
            const pocket = state.data.pockets.find(item => item.id === remove.dataset.pocketDelete);
            if (!pocket) return;
            const confirmed = await confirmAction(
                "Eliminar bolsillo",
                pocket.balance >= 1
                    ? `Los ${formatMoney(pocket.balance)} de "${pocket.name}" volverán a tu saldo disponible.`
                    : `¿Quieres eliminar el bolsillo "${pocket.name}"?`,
                "Eliminar"
            );
            if (!confirmed) return;
            try {
                await BlApi.authed(api, "POST", `/savings/pockets/${pocket.id}/close`, { idempotencyKey: uuid() });
                toast("Bolsillo eliminado.", "ok");
            } catch (err) {
                fail(err, "No se pudo eliminar el bolsillo.");
            }
            refresh();
        }
    });

    byId("pocketMoveForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (state.busy) return;
        const amount = parseMoney(byId("pocketMoveAmount").value);
        const id = byId("pocketMoveId").value;
        const mode = byId("pocketMoveMode").value;
        const pocket = state.data.pockets.find(item => item.id === id);
        if (amount < 1000) return toast("El valor mínimo es $1.000.", "err");
        if (mode === "add" && amount > state.balance)
            return toast(`No tienes saldo suficiente. Disponible: ${formatMoney(state.balance)}.`, "err");
        if (mode === "take" && amount > Math.floor(pocket.balance))
            return toast(`En este bolsillo tienes ${formatMoney(pocket.balance)}.`, "err");

        state.busy = true;
        byId("pocketMoveSubmit").disabled = true;
        try {
            await BlApi.authed(api, "POST", `/savings/pockets/${id}/${mode === "add" ? "deposit" : "withdraw"}`, {
                amount,
                idempotencyKey: moveKey,
            });
            closeModalById("pocketMoveModal");
            toast(
                mode === "add"
                    ? `Agregaste ${formatMoney(amount)} a ${pocket.name}.`
                    : `Pasaste ${formatMoney(amount)} a tu saldo.`,
                "ok"
            );
        } catch (err) {
            fail(err, "No se pudo mover la plata.");
        } finally {
            state.busy = false;
            byId("pocketMoveSubmit").disabled = false;
            refresh();
        }
    });

    // -----------------------------------------------------
    // CDT: SIMULADOR
    // -----------------------------------------------------

    const amountInput = byId("cdtAmount");
    const termsBox = byId("cdtTerms");

    function renderTerms() {
        const terms = state.data.config.cdtTerms;
        termsBox.innerHTML = terms
            .map(
                item => `
            <button type="button" class="term-option${item.days === state.term.days ? " selected" : ""}" data-days="${item.days}" role="radio" aria-checked="${item.days === state.term.days}">
                <b>${item.days} días</b>
                <small>${rate(item.rate)}</small>
            </button>`
            )
            .join("");
        setText("cdtMinText", `Mínimo ${formatMoney(state.data.config.cdtMin)}`);
    }

    termsBox.addEventListener("click", event => {
        const option = event.target.closest("[data-days]");
        if (!option) return;
        state.term = state.data.config.cdtTerms.find(item => item.days === Number(option.dataset.days));
        renderTerms();
        paintSimulation();
    });

    function cdtResult(amount, term) {
        const gross = interestFor(amount, term.rate, term.days);
        const tax = gross * state.data.config.cdtTax;
        return { gross, tax, net: gross - tax, total: amount + gross - tax };
    }

    function paintSimulation() {
        if (!state.data) return;
        const amount = parseMoney(amountInput.value);
        const result = cdtResult(amount, state.term);
        setText("cdtRate", rate(state.term.rate));
        setText("cdtGross", "+" + formatMoney(result.gross));
        setText("cdtTax", "-" + formatMoney(result.tax));
        setText("cdtDate", formatDate(new Date(Date.now() + state.term.days * DAY_MS), { dateStyle: "long" }));
        setText("cdtTotal", formatMoney(amount ? result.total : 0));
    }

    amountInput.addEventListener("input", () => {
        const value = parseMoney(amountInput.value);
        amountInput.value = value ? value.toLocaleString("es-CO") : "";
        paintSimulation();
    });

    byId("cdtForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (state.busy) return;
        const amount = parseMoney(amountInput.value);
        const term = state.term;
        const result = cdtResult(amount, term);
        const min = state.data.config.cdtMin;

        if (amount < min) {
            toast(`El monto mínimo para un CDT es ${formatMoney(min)}.`, "err");
            amountInput.focus();
            return;
        }
        if (amount > state.balance)
            return toast(`No tienes saldo suficiente. Disponible: ${formatMoney(state.balance)}.`, "err");

        const maturity = new Date(Date.now() + term.days * DAY_MS);
        const confirmed = await confirmAction(
            "Abrir CDT",
            `Vas a invertir ${formatMoney(amount)} a ${term.days} días con una tasa de ${rate(term.rate)}.\nEl ${formatDate(maturity, { dateStyle: "long" })} recibirás ${formatMoney(result.total)}.\nNo podrás retirar el dinero antes de esa fecha.`,
            "Invertir"
        );
        if (!confirmed) return;

        state.busy = true;
        try {
            await BlApi.authed(api, "POST", "/savings/cdts", { amount, days: term.days, idempotencyKey: uuid() });
            amountInput.value = "";
            toast(`CDT por ${formatMoney(amount)} abierto.`, "ok");
        } catch (err) {
            fail(err, "No se pudo abrir el CDT.");
        } finally {
            state.busy = false;
            refresh();
        }
    });

    // -----------------------------------------------------
    // CDT: MIS INVERSIONES
    // -----------------------------------------------------

    const cdtList = byId("cdtList");

    function renderCdts() {
        const list = state.data.cdts;
        const active = list.filter(cdt => cdt.status !== "paid").length;
        setText("cdtCount", `${active} ${active === 1 ? "activo" : "activos"}`);

        if (!list.length) {
            cdtList.innerHTML = `
                <div class="pocket-empty">
                    <strong>Aún no tienes CDT</strong>
                    <p>Usa el simulador para ver cuánto ganarías y abre tu primera inversión.</p>
                </div>`;
            return;
        }

        const now = Date.now();
        cdtList.innerHTML = list
            .map(cdt => {
                if (cdt.status === "paid") {
                    return `
                    <article class="cdt-item is-paid">
                        <div class="cdt-item-top">
                            <div><strong>${formatMoney(cdt.amount)}</strong><small>${escapeHTML(cdt.number)} · ${cdt.days} días · ${rate(cdt.rate)}</small></div>
                            <span class="panel-chip">Pagado</span>
                        </div>
                        <p class="cdt-paid">Recibiste ${formatMoney(cdt.total)} (ganaste +${formatMoney(cdt.net)}) el ${formatDate(cdt.paidAt, { dateStyle: "medium" })}.</p>
                    </article>`;
                }
                const opened = new Date(cdt.openedAt).getTime();
                const matures = new Date(cdt.maturesAt).getTime();
                const matured = now >= matures;
                const progress = Math.min(((now - opened) / (matures - opened)) * 100, 100);
                const daysLeft = Math.max(Math.ceil((matures - now) / DAY_MS), 0);
                return `
                <article class="cdt-item${matured ? " is-ready" : ""}">
                    <div class="cdt-item-top">
                        <div><strong>${formatMoney(cdt.amount)}</strong><small>${escapeHTML(cdt.number)} · ${cdt.days} días · ${rate(cdt.rate)}</small></div>
                        <span class="panel-chip ${matured ? "is-on" : ""}">${matured ? "Listo para cobrar" : `Faltan ${daysLeft} días`}</span>
                    </div>
                    <div class="limit-bar" aria-hidden="true"><span style="width:${progress}%"></span></div>
                    <div class="cdt-item-info">
                        <span>Vence: <b>${formatDate(cdt.maturesAt, { dateStyle: "medium" })}</b></span>
                        <span>Recibirás: <b>${formatMoney(cdt.total)}</b></span>
                    </div>
                    ${
                        matured
                            ? `<button type="button" class="btn primary full" data-cdt-redeem="${cdt.id}">Cobrar ${formatMoney(cdt.total)}</button>`
                            : state.data.config.demoMaturity
                              ? `<button type="button" class="cdt-demo" data-cdt-demo="${cdt.id}">Simular vencimiento (modo demostración)</button>`
                              : ""
                    }
                </article>`;
            })
            .join("");
    }

    cdtList.addEventListener("click", async event => {
        const redeem = event.target.closest("[data-cdt-redeem]");
        const demo = event.target.closest("[data-cdt-demo]");

        if (demo) {
            const cdt = state.data.cdts.find(item => item.id === demo.dataset.cdtDemo);
            const confirmed = await confirmAction(
                "Simular vencimiento",
                `Esto adelanta el tiempo solo para la demostración: el CDT ${cdt.number} quedará vencido como si hubieran pasado ${cdt.days} días.`,
                "Adelantar"
            );
            if (!confirmed) return;
            try {
                await BlApi.authed(api, "POST", `/savings/cdts/${cdt.id}/demo-mature`, {});
            } catch (err) {
                fail(err, "No se pudo simular el vencimiento.");
            }
            refresh();
            return;
        }

        if (redeem && !state.busy) {
            const cdt = state.data.cdts.find(item => item.id === redeem.dataset.cdtRedeem);
            state.busy = true;
            redeem.disabled = true;
            try {
                await BlApi.authed(api, "POST", `/savings/cdts/${cdt.id}/collect`, { idempotencyKey: uuid() });
                showMessage(
                    "¡Tu CDT se pagó!",
                    `Recibiste ${formatMoney(cdt.total)} en tu saldo disponible.\nCapital: ${formatMoney(cdt.amount)}\nIntereses: +${formatMoney(cdt.gross)}\nRetención: -${formatMoney(cdt.tax)}`,
                    "✓"
                );
            } catch (err) {
                fail(err, "No se pudo cobrar el CDT.");
            } finally {
                state.busy = false;
                refresh();
            }
        }
    });

    refresh();
    // Los intereses de los bolsillos se ven crecer solos.
    setInterval(() => {
        if (!state.busy && !document.querySelector(".modal.active")) refresh();
    }, 60000);
});
