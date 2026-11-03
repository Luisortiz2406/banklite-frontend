// =========================================================
// BANKLITE - MIS SUSCRIPCIONES (dashboard.html#suscripciones)
// Datos reales de card-service: /cards/subscriptions (catálogo,
// inscribir, pausar, reanudar, cancelar e historial de cobros).
// El cobro lo hace el backend: el primer mes al inscribir y luego
// una tarea diaria; cada cobro es un movimiento real del ledger.
// =========================================================

// Sin logos ni colores de marcas reales: cada servicio se muestra con su inicial
// sobre un color de la paleta de Banklite (el mismo siempre para el mismo código).
const SUB_PALETTE = ["#26474E", "#1F7A7D", "#0E7490", "#4B5563", "#7C6A46"];

function subLogo(code, name) {
    const key = String(code || name || "");
    const hash = [...key].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
    const bg = SUB_PALETTE[hash % SUB_PALETTE.length];
    const initial = escapeHTML((name || "?").charAt(0).toUpperCase());
    return `<span class="sub-logo" style="background:${bg};color:#ffffff" aria-hidden="true">${initial}</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("subsList");
    if (!box || typeof BlApi === "undefined" || !BlApi.session.accessToken) return;

    const { config } = BlApi;
    const call = (method, path, body) => BlApi.authed(config.cardApi, method, path, body);
    const day = value => (value ? formatDate(`${value}T12:00:00`, { day: "numeric", month: "short" }) : "");
    const state = { items: [], catalog: [], cards: [], picked: null };

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo completar", err?.message || fallback, "!");
    }

    // Avisa al resto del dashboard que el saldo y los movimientos cambiaron.
    const accountChanged = () => document.dispatchEvent(new CustomEvent("banklite:account-changed"));

    // ---------- lista ----------
    async function load() {
        try {
            const data = await call("GET", "/cards/subscriptions");
            state.items = data.items || [];
            render(data.monthlyTotal || 0);
        } catch (err) {
            box.innerHTML = '<p class="pay-empty">No se pudieron cargar tus suscripciones.</p>';
            fail(err, "No se pudieron cargar tus suscripciones.");
        }
    }

    function statusText(sub) {
        if (sub.status === "paused") return "En pausa, no se cobra";
        if (sub.status === "suspended") return "<b>Suspendida:</b> no se pudo cobrar";
        if (sub.retryCount > 0) return `<b>Cobro rechazado:</b> reintento el ${day(sub.nextChargeDate)}`;
        return `Próximo cobro: ${day(sub.nextChargeDate)}`;
    }

    function render(total) {
        const active = state.items.filter(sub => sub.status === "active");
        const others = state.items.length - active.length;
        setText("subsTotal", `${formatMoney(total)} al mes`);
        setText(
            "subsCount",
            state.items.length
                ? `${active.length} activa${active.length === 1 ? "" : "s"}${others ? ` · ${others} en pausa o suspendida${others === 1 ? "" : "s"}` : ""}`
                : "Sin suscripciones"
        );

        if (!state.items.length) {
            box.innerHTML = '<p class="pay-empty">No tienes suscripciones inscritas en tu tarjeta.</p>';
            return;
        }
        box.innerHTML = state.items
            .map(sub => {
                const action =
                    sub.status === "active"
                        ? ["pause", "Pausar"]
                        : sub.status === "paused"
                          ? ["resume", "Reanudar"]
                          : ["resume", "Reactivar"];
                return `
            <div class="sub-row ${sub.status !== "active" ? "is-paused" : ""}">
                ${subLogo(sub.merchantCode, sub.merchantName)}
                <div class="sub-info">
                    <strong>${escapeHTML(sub.merchantName)}</strong>
                    <small>${escapeHTML(sub.plan)}${sub.cardLast4 ? ` · ····${sub.cardLast4}` : ""} · ${statusText(sub)}</small>
                </div>
                <b class="sub-price">${formatMoney(sub.amount, sub.currency)}</b>
                <div class="sub-actions">
                    <button type="button" class="btn soft" data-sub-action="${action[0]}" data-sub-id="${sub.id}">${action[1]}</button>
                    <button type="button" class="sub-cancel" data-sub-history="${sub.id}" aria-label="Historial de cobros de ${escapeHTML(sub.merchantName)}" title="Historial de cobros">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>
                    </button>
                    <button type="button" class="sub-cancel" data-sub-cancel="${sub.id}" aria-label="Cancelar ${escapeHTML(sub.merchantName)}" title="Cancelar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                    </button>
                </div>
            </div>`;
            })
            .join("");
    }

    box.addEventListener("click", async event => {
        const actionBtn = event.target.closest("[data-sub-action]");
        const cancelBtn = event.target.closest("[data-sub-cancel]");
        const historyBtn = event.target.closest("[data-sub-history]");

        if (actionBtn) {
            const sub = state.items.find(item => item.id === actionBtn.dataset.subId);
            if (!sub) return;
            const action = actionBtn.dataset.subAction;
            if (action === "resume" && sub.status === "suspended") {
                const ok = await confirmAction(
                    "Reactivar suscripción",
                    `Para reactivar ${sub.merchantName} cobraremos ${formatMoney(sub.amount, sub.currency)} a tu tarjeta en este momento.`,
                    "Reactivar y pagar"
                );
                if (!ok) return;
            }
            actionBtn.disabled = true;
            try {
                const updated = await call("POST", `/cards/subscriptions/${sub.id}/${action}`);
                if (action === "pause")
                    toast(`Pausaste ${sub.merchantName}. No se cobrará hasta que la reanudes.`, "ok");
                else toast(`${sub.merchantName} quedó activa. Próximo cobro: ${day(updated.nextChargeDate)}.`, "ok");
                if (action === "resume") accountChanged();
                await load();
            } catch (err) {
                fail(err, "No se pudo actualizar la suscripción.");
                actionBtn.disabled = false;
                load();
            }
        }

        if (cancelBtn) {
            const sub = state.items.find(item => item.id === cancelBtn.dataset.subCancel);
            if (!sub) return;
            const ok = await confirmAction(
                "Cancelar suscripción",
                `¿Quieres cancelar ${sub.merchantName} (${formatMoney(sub.amount, sub.currency)} al mes)? No haremos más cobros a tu tarjeta.`,
                "Sí, cancelar"
            );
            if (!ok) return;
            try {
                await call("DELETE", `/cards/subscriptions/${sub.id}`);
                toast(`Cancelaste ${sub.merchantName}.`, "ok");
                await load();
            } catch (err) {
                fail(err, "No se pudo cancelar la suscripción.");
            }
        }

        if (historyBtn) openHistory(historyBtn.dataset.subHistory);
    });

    // ---------- historial de cobros ----------
    async function openHistory(id) {
        const sub = state.items.find(item => item.id === id);
        if (!sub) return;
        setText("subHistoryTitle", `Cobros de ${sub.merchantName}`);
        const list = byId("subHistoryList");
        list.innerHTML = '<li class="pay-empty">Cargando…</li>';
        openModal("subHistoryModal");
        try {
            const charges = await call("GET", `/cards/subscriptions/${id}/charges`);
            list.innerHTML = charges.length
                ? charges
                      .map(
                          charge => `
                <li class="sub-charge ${charge.status === "succeeded" ? "is-ok" : "is-rejected"}">
                    <div>
                        <strong>${charge.status === "succeeded" ? "Pagado" : "Rechazado"} · ${escapeHTML(charge.period)}</strong>
                        <small>${formatDate(charge.createdAt, { dateStyle: "medium", timeStyle: "short" })}${charge.attempt > 1 ? ` · intento ${charge.attempt}` : ""}${charge.reason ? ` · ${escapeHTML(charge.reason)}` : ""}</small>
                    </div>
                    <b>${formatMoney(charge.amount, charge.currency)}</b>
                </li>`
                      )
                      .join("")
                : '<li class="pay-empty">Aún no hay cobros.</li>';
        } catch (err) {
            list.innerHTML = '<li class="pay-empty">No se pudo cargar el historial.</li>';
            fail(err, "No se pudo cargar el historial.");
        }
    }

    // ---------- inscribir ----------
    const serviceBox = byId("subServices");
    const cardSelect = byId("subCard");

    function paintSummary() {
        const item = state.catalog.find(c => c.code === state.picked);
        const dayOfMonth = new Date().getDate();
        byId("subSummary").textContent = item
            ? `Hoy pagas ${formatMoney(item.price, item.currency)} y luego cada mes el día ${dayOfMonth} (en meses más cortos, el último día).`
            : "Elige un servicio.";
        byId("subSubmit").textContent = item
            ? `Inscribir y pagar ${formatMoney(item.price, item.currency)}`
            : "Inscribir";
    }

    byId("addSub").addEventListener("click", async () => {
        try {
            const [catalog, cards] = await Promise.all([
                call("GET", "/cards/subscriptions/catalog"),
                call("GET", "/cards"),
            ]);
            state.catalog = catalog;
            state.cards = cards.filter(card => card.status === "active");
        } catch (err) {
            return fail(err, "No se pudo cargar el catálogo.");
        }

        if (!state.cards.length) {
            return showMessage(
                "Necesitas una tarjeta activa",
                "Emite tu tarjeta débito (o reactívala si está congelada) para inscribir suscripciones.",
                "i"
            );
        }
        const taken = state.items.map(sub => sub.merchantCode);
        const options = state.catalog.filter(item => item.available && !taken.includes(item.code));
        serviceBox.innerHTML = options.length
            ? options
                  .map(
                      item => `
            <button type="button" class="sub-option" data-service="${item.code}">
                ${subLogo(item.code, item.name)}
                <b>${escapeHTML(item.name)}</b>
                <small>${formatMoney(item.price, item.currency)}/mes</small>
            </button>`
                  )
                  .join("")
            : '<p class="pay-empty">Ya tienes todos los servicios disponibles.</p>';
        cardSelect.innerHTML = state.cards
            .map(card => `<option value="${card.id}">Tarjeta débito ····${escapeHTML(card.lastFour)}</option>`)
            .join("");
        state.picked = null;
        paintSummary();
        openModal("subModal");
    });

    serviceBox.addEventListener("click", event => {
        const option = event.target.closest("[data-service]");
        if (!option) return;
        state.picked = option.dataset.service;
        serviceBox.querySelectorAll(".sub-option").forEach(el => el.classList.toggle("selected", el === option));
        paintSummary();
    });

    byId("subForm").addEventListener("submit", async event => {
        event.preventDefault();
        const item = state.catalog.find(c => c.code === state.picked);
        if (!item) return toast("Elige un servicio.", "err");
        const button = byId("subSubmit");
        button.disabled = true;
        try {
            const sub = await call("POST", "/cards/subscriptions", {
                cardId: cardSelect.value,
                merchantCode: item.code,
            });
            closeModalById("subModal");
            toast(
                `Listo: inscribiste ${item.name} y pagaste el primer mes. Próximo cobro: ${day(sub.nextChargeDate)}.`,
                "ok",
                5000
            );
            accountChanged();
            await load();
        } catch (err) {
            fail(err, "No se pudo inscribir la suscripción.");
        } finally {
            button.disabled = false;
        }
    });

    load();
});
