// =========================================================
// BANKLITE - METAS DE AHORRO (dashboard, sección "Mis metas")
// Mismo diseño y comportamiento que la versión simulada, contra savings-service
// (/savings, kind 'goal'). Abonar saca la plata del saldo disponible hacia la
// custodia del ledger; "Pasar a mi saldo" o eliminar la devuelve. Cada operación
// lleva clave de idempotencia. Al mover plata se avisa al dashboard
// (banklite:account-changed) para que actualice el saldo.
// =========================================================

const GOAL_ICONS = {
    viaje: {
        label: "Viaje",
        color: "#2CCED2",
        path: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
    },
    casa: { label: "Casa", color: "#137C81", path: "M3 10.5 12 3l9 7.5M5 9v12h14V9M10 21v-6h4v6" },
    carro: {
        label: "Vehículo",
        color: "#4A90C2",
        path: "M3 13l2-6h14l2 6v5H3zM3 13h18M7 16h.01M17 16h.01M6 18v2M18 18v2",
    },
    estudio: {
        label: "Estudio",
        color: "#7C6FD8",
        path: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6",
    },
    tecnologia: { label: "Tecnología", color: "#5E7D83", path: "M4 5h16v10H4zM2 19h20M10 15v4M14 15v4" },
    emergencia: {
        label: "Emergencias",
        color: "#1E9E6A",
        path: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
    },
    regalo: {
        label: "Regalo",
        color: "#E07A6B",
        path: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1.5S9 8 12 8zm0 0c2-4 6-4 6-1.5S15 8 12 8z",
    },
    otro: {
        label: "Otra",
        color: "#F2A93B",
        path: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    },
};

const GOAL_PRESETS = [
    { icon: "viaje", name: "Viaje soñado" },
    { icon: "emergencia", name: "Fondo de emergencias" },
    { icon: "carro", name: "Mi vehículo" },
    { icon: "estudio", name: "Estudios" },
];

const GOAL_TIPS = [
    "Abonar un poco cada semana rinde más que esperar a fin de mes.",
    "Ponle fecha a tu meta y te diremos cuánto ahorrar al mes.",
    "Un fondo de emergencias ideal cubre de 3 a 6 meses de gastos.",
    "Cada abono a tus metas queda guardado en tus movimientos.",
    "Celebra cada 25 %: las metas grandes se cumplen por partes.",
];

function goalIconSVG(key) {
    const icon = GOAL_ICONS[key] || GOAL_ICONS.otro;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon.path}"/></svg>`;
}

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("goalsList");
    if (!container || !BlApi.hasSession()) return;

    const { config } = BlApi;
    const api = config.savingsApi || config.transferApi;
    const state = { goals: [], balance: null, busy: false, depositKey: null };
    const goalDrawn = {};

    const uuid = () =>
        crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    const accountChanged = () => document.dispatchEvent(new CustomEvent("banklite:account-changed"));

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo completar", err?.message || fallback, "!");
    }

    async function loadBalance() {
        try {
            const accounts = await BlApi.authed(config.accountApi, "GET", "/accounts");
            const account = (accounts || []).find(a => a.status === "active");
            if (!account) return;
            const balance = await BlApi.authed(config.ledgerApi, "GET", `/ledger/accounts/${account.id}/balance`);
            state.balance = Number(balance.balance) || 0;
        } catch {
            /* el saldo lo valida el ledger igual */
        }
    }

    async function load() {
        try {
            const data = await BlApi.authed(api, "GET", "/savings");
            state.goals = data.goals || [];
            render();
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            container.innerHTML = '<p class="pay-empty">No se pudieron cargar tus metas.</p>';
        }
        loadBalance();
    }

    function mood(percentage, completed) {
        if (completed) return "¡Meta cumplida! Lo lograste.";
        if (percentage <= 0) return "Da el primer paso con tu primer abono.";
        if (percentage < 25) return "Buen comienzo, sigue así.";
        if (percentage < 50) return "Vas por buen camino.";
        if (percentage < 75) return "¡Ya pasaste la mitad!";
        return "¡Ya casi lo logras!";
    }

    function plan(goal, missing) {
        if (!goal.targetDate) return "";
        const end = new Date(goal.targetDate + "T23:59:59");
        const days = Math.ceil((end - new Date()) / 86400000);
        if (days < 0) return '<span class="goal-plan is-late">La fecha límite ya pasó</span>';
        const months = Math.max(1, Math.ceil(days / 30));
        const perMonth = Math.ceil(missing / months / 1000) * 1000;
        const when = days === 0 ? "Vence hoy" : `Faltan ${days} ${days === 1 ? "día" : "días"}`;
        return `<span class="goal-plan">${when} · ahorra <b>${formatMoney(perMonth)}</b> al mes</span>`;
    }

    function render() {
        const summary = byId("goalsSummary");
        const tip = byId("goalTip");
        const goals = state.goals;

        if (tip) {
            tip.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg><span><b>Consejo:</b> ${GOAL_TIPS[new Date().getDate() % GOAL_TIPS.length]}</span>`;
        }

        if (!goals.length) {
            if (summary) summary.innerHTML = "";
            container.innerHTML = `
                <div class="goal-empty">
                    <div class="goal-empty-art" aria-hidden="true">
                        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="6" fill="currentColor"/><path d="M32 32 52 12M46 12h6v6"/></svg>
                    </div>
                    <strong>Crea tu primera meta</strong>
                    <p>Ponle nombre a ese sueño y míralo crecer con cada abono.</p>
                    <div class="goal-presets">
                        ${GOAL_PRESETS.map(
                            preset => `
                            <button type="button" class="goal-preset" data-goal-preset="${preset.icon}" data-goal-name="${preset.name}" style="--goal:${GOAL_ICONS[preset.icon].color}">
                                ${goalIconSVG(preset.icon)}<span>${preset.name}</span>
                            </button>`
                        ).join("")}
                    </div>
                </div>`;
            return;
        }

        const totalSaved = goals.reduce((sum, goal) => sum + goal.balance, 0);
        const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);
        const doneCount = goals.filter(goal => goal.completed).length;
        const totalPct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
        const activeCount = goals.length - doneCount;

        if (summary) {
            summary.innerHTML = `
                <div class="goal-hero">
                    <div class="goal-hero-text">
                        <span>Total ahorrado en metas</span>
                        <strong>${formatMoney(totalSaved)}</strong>
                        <small>${activeCount} ${activeCount === 1 ? "meta activa" : "metas activas"} · ${doneCount} ${doneCount === 1 ? "cumplida" : "cumplidas"}</small>
                    </div>
                    <div class="goal-hero-ring" style="--p:${totalPct.toFixed(1)}" role="img" aria-label="Llevas el ${Math.round(totalPct)} % del total">
                        <b>${Math.round(totalPct)}%</b>
                    </div>
                </div>`;
        }

        const ringLength = 2 * Math.PI * 22;
        container.innerHTML = goals
            .map(goal => {
                const percentage = goal.target > 0 ? Math.min(100, (goal.balance / goal.target) * 100) : 0;
                const completed = goal.completed;
                const missing = Math.max(0, goal.target - goal.balance);
                const key = GOAL_ICONS[goal.icon] ? goal.icon : "otro";
                const from = goalDrawn[goal.id] ?? 0;
                return `
                <article class="goal-card${completed ? " completed" : ""}" data-goal-card="${goal.id}" data-pct="${percentage}" style="--goal:${GOAL_ICONS[key].color}">
                    <div class="goal-ring">
                        <svg viewBox="0 0 52 52" aria-hidden="true">
                            <circle class="goal-ring-bg" cx="26" cy="26" r="22"/>
                            <circle class="goal-ring-fill" cx="26" cy="26" r="22" stroke-dasharray="${ringLength.toFixed(2)}" stroke-dashoffset="${(ringLength * (1 - from / 100)).toFixed(2)}"/>
                        </svg>
                        <span class="goal-ring-icon">${completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : goalIconSVG(key)}</span>
                    </div>
                    <div class="goal-main">
                        <div class="goal-head">
                            <strong title="${escapeHTML(goal.name)}">${escapeHTML(goal.name)}</strong>
                            <span class="goal-pct">${completed ? "Cumplida" : Math.round(percentage) + "%"}</span>
                        </div>
                        <div class="goal-amounts"><b>${formatMoney(goal.balance)}</b> de ${formatMoney(goal.target)}</div>
                        <div class="goal-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percentage)}" aria-label="Progreso de ${escapeHTML(goal.name)}">
                            <div class="goal-track-bar" style="width:${from}%"></div>
                            ${[25, 50, 75].map(mark => `<i class="goal-mark${percentage >= mark ? " is-reached" : ""}" style="left:${mark}%"></i>`).join("")}
                        </div>
                        <div class="goal-meta">
                            <span class="goal-mood">${mood(percentage, completed)}</span>
                            ${completed ? "" : `<span class="goal-missing">Faltan <b>${formatMoney(missing)}</b></span>`}
                        </div>
                        ${completed ? "" : plan(goal, missing)}
                    </div>
                    <div class="goal-buttons">
                        ${
                            completed
                                ? ""
                                : `<button type="button" class="goal-add" data-goal-deposit="${goal.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Abonar</button>`
                        }
                        ${
                            completed
                                ? `<button type="button" class="goal-withdraw" data-goal-delete="${goal.id}">Pasar a mi saldo</button>`
                                : `<button type="button" class="goal-remove" data-goal-delete="${goal.id}" aria-label="Eliminar meta ${escapeHTML(goal.name)}" title="Eliminar meta">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                        </button>`
                        }
                    </div>
                </article>`;
            })
            .join("");

        // Anima anillos y barras desde el último valor hasta el nuevo.
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                container.querySelectorAll("[data-goal-card]").forEach(card => {
                    const pct = Number(card.dataset.pct) || 0;
                    const ring = card.querySelector(".goal-ring-fill");
                    const bar = card.querySelector(".goal-track-bar");
                    if (ring) ring.style.strokeDashoffset = (ringLength * (1 - pct / 100)).toFixed(2);
                    if (bar) bar.style.width = pct + "%";
                    goalDrawn[card.dataset.goalCard] = pct;
                });
            })
        );
    }

    function celebrate(id) {
        const card = document.querySelector(`[data-goal-card="${id}"]`);
        card?.classList.add("just-done");
        setTimeout(() => card?.classList.remove("just-done"), 1900);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const colors = ["#2CCED2", "#B9EDED", "#26474E", "#F2A93B", "#1E9E6A"];
        const burst = document.createElement("div");
        burst.className = "goal-confetti";
        burst.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 60; i++) {
            const piece = document.createElement("i");
            piece.style.setProperty("--x", `${Math.round(Math.random() * 100)}%`);
            piece.style.setProperty("--dx", `${Math.round(Math.random() * 160 - 80)}px`);
            piece.style.setProperty("--r", `${Math.round(Math.random() * 900 - 450)}deg`);
            piece.style.setProperty("--d", `${(Math.random() * 0.6).toFixed(2)}s`);
            piece.style.setProperty("--t", `${(1.8 + Math.random() * 1.2).toFixed(2)}s`);
            piece.style.background = colors[i % colors.length];
            burst.appendChild(piece);
        }
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 3800);
    }

    // -----------------------------------------------------
    // CREAR META
    // -----------------------------------------------------

    const goalForm = byId("goalForm");
    const goalIconPicker = byId("goalIconPicker");
    goalIconPicker.innerHTML = Object.entries(GOAL_ICONS)
        .map(
            ([key, icon], index) => `
        <label class="goal-icon-option" style="--goal:${icon.color}" title="${icon.label}">
            <input type="radio" name="goalIcon" value="${key}"${index === 0 ? " checked" : ""}>
            <span>${goalIconSVG(key)}</span>
            <small>${icon.label}</small>
        </label>`
        )
        .join("");

    const goalDateInput = byId("goalDate");
    const tomorrow = new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    goalDateInput.min = tomorrow;

    byId("newGoal").addEventListener("click", () => {
        goalForm.reset();
        openModal("goalModal");
    });

    goalForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (state.busy) return;
        const name = byId("goalName").value.trim();
        const target = Number(byId("goalTarget").value) || 0;
        const initial = Number(byId("goalSaved").value) || 0;
        const icon = goalForm.querySelector('input[name="goalIcon"]:checked')?.value || "otro";
        const date = goalDateInput.value || "";

        if (!name) return showMessage("Meta inválida", "Ingresa un nombre para tu meta.", "!");
        if (target < 10000) return showMessage("Monto inválido", "El objetivo mínimo es de $10.000.", "!");
        if (initial < 0 || initial > target)
            return showMessage("Monto inicial inválido", "El monto inicial no puede ser mayor que el objetivo.", "!");
        if (initial > 0 && initial < 1000)
            return showMessage("Monto inicial inválido", "El abono mínimo es de $1.000.", "!");
        if (state.balance !== null && initial > state.balance)
            return showMessage("Saldo insuficiente", "No tienes saldo suficiente para el monto inicial.", "!");
        if (date && date < tomorrow)
            return showMessage("Fecha inválida", "La fecha límite debe ser una fecha futura.", "!");

        state.busy = true;
        try {
            const goal = await BlApi.authed(api, "POST", "/savings/pockets", {
                kind: "goal",
                name,
                icon,
                target,
                ...(date ? { targetDate: date } : {}),
            });
            if (initial > 0) {
                await BlApi.authed(api, "POST", `/savings/pockets/${goal.id}/deposit`, {
                    amount: initial,
                    idempotencyKey: uuid(),
                });
                accountChanged();
            }
            goalForm.reset();
            closeModalById("goalModal");
            if (location.hash !== "#ahorro") location.hash = "ahorro";
            showMessage("Meta creada", `Tu meta "${name}" ya está lista.`, "✓");
        } catch (err) {
            fail(err, "No se pudo crear la meta.");
        } finally {
            state.busy = false;
            load();
        }
    });

    // -----------------------------------------------------
    // ABONAR / ELIMINAR / PASAR A MI SALDO
    // -----------------------------------------------------

    container.addEventListener("click", async event => {
        const depositButton = event.target.closest("[data-goal-deposit]");
        const deleteButton = event.target.closest("[data-goal-delete]");
        const presetButton = event.target.closest("[data-goal-preset]");

        if (presetButton) {
            goalForm.reset();
            byId("goalName").value = presetButton.dataset.goalName;
            const radio = goalForm.querySelector(`input[name="goalIcon"][value="${presetButton.dataset.goalPreset}"]`);
            if (radio) radio.checked = true;
            openModal("goalModal");
            byId("goalTarget").focus();
            return;
        }

        if (depositButton) {
            const goal = state.goals.find(item => item.id === depositButton.dataset.goalDeposit);
            if (!goal) return;
            byId("goalDepositId").value = goal.id;
            setText("goalDepositName", goal.name);
            const missing = Math.max(0, Math.ceil(goal.target - goal.balance));
            setText("goalDepositMissing", formatMoney(missing));
            state.depositKey = uuid(); // una clave por intento: un doble clic abona una vez
            const amounts = [50000, 100000, 200000, 500000].filter(value => value < missing);
            byId("goalQuick").innerHTML =
                amounts
                    .map(
                        value =>
                            `<button type="button" class="goal-quick-btn" data-amount="${value}">${formatMoney(value)}</button>`
                    )
                    .join("") +
                `<button type="button" class="goal-quick-btn is-all" data-amount="${missing}">Lo que falta</button>`;
            openModal("goalDepositModal");
            return;
        }

        if (deleteButton) {
            const goal = state.goals.find(item => item.id === deleteButton.dataset.goalDelete);
            if (!goal) return;
            const saved = goal.balance;
            const confirmed = goal.completed
                ? await confirmAction(
                      "Pasar a mi saldo",
                      `Los ${formatMoney(saved)} de "${goal.name}" volverán a tu saldo y la meta se cerrará.`,
                      "Pasar a mi saldo"
                  )
                : await confirmAction(
                      "Eliminar meta",
                      saved > 0
                          ? `Se eliminará "${goal.name}" y los ${formatMoney(saved)} ahorrados volverán a tu saldo.`
                          : `Se eliminará la meta "${goal.name}".`,
                      "Eliminar"
                  );
            if (!confirmed) return;
            try {
                await BlApi.authed(api, "POST", `/savings/pockets/${goal.id}/close`, { idempotencyKey: uuid() });
                if (saved > 0) accountChanged();
                toast(goal.completed ? `Pasamos ${formatMoney(saved)} a tu saldo.` : "Meta eliminada.", "ok");
            } catch (err) {
                fail(err, "No se pudo cerrar la meta.");
            }
            load();
        }
    });

    byId("goalQuick").addEventListener("click", event => {
        const chip = event.target.closest("[data-amount]");
        if (!chip) return;
        byId("goalDepositAmount").value = chip.dataset.amount;
        byId("goalDepositAmount").focus();
        document
            .querySelectorAll("#goalQuick .goal-quick-btn")
            .forEach(btn => btn.classList.toggle("is-selected", btn === chip));
    });

    byId("goalDepositForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (state.busy) return;
        const id = byId("goalDepositId").value;
        const amount = Number(byId("goalDepositAmount").value) || 0;
        const goal = state.goals.find(item => item.id === id);
        if (!goal) return;
        const missing = Math.max(0, Math.ceil(goal.target - goal.balance));

        if (amount < 1000) return showMessage("Monto inválido", "El abono mínimo es de $1.000.", "!");
        if (state.balance !== null && amount > state.balance)
            return showMessage("Saldo insuficiente", "No tienes saldo suficiente para este abono.", "!");
        if (amount > missing)
            return showMessage("Monto muy alto", `A esta meta solo le faltan ${formatMoney(missing)}.`, "!");

        state.busy = true;
        try {
            const result = await BlApi.authed(api, "POST", `/savings/pockets/${id}/deposit`, {
                amount,
                idempotencyKey: state.depositKey,
            });
            byId("goalDepositForm").reset();
            closeModalById("goalDepositModal");
            accountChanged();
            await load();
            if (result.pocket?.completed) {
                celebrate(id);
                showMessage(
                    "¡Meta cumplida!",
                    `Completaste "${goal.name}". Puedes pasar la plata a tu saldo cuando quieras.`,
                    "✓"
                );
            } else {
                toast(`Abonaste ${formatMoney(amount)} a ${goal.name}.`, "ok");
            }
        } catch (err) {
            fail(err, "No se pudo abonar.");
        } finally {
            state.busy = false;
        }
    });

    load();
});
