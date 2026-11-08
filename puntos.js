// =========================================================
// BANKLITE - PUNTOS BANKLITE (puntos.html)
// Mismo diseño y comportamiento que la versión simulada, contra rewards-service:
// GET /rewards (saldo, nivel, catálogo, retos, bonos e historial) y
// POST /rewards/redeem. Los puntos se ganan solos con cada compra o pago real
// (rewards-service escucha los movimientos del ledger). Cada canje lleva una
// clave de idempotencia: un doble clic nunca canjea dos veces.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("pointsPage")) return;
    if (!BlApi.protectPage()) return;

    const { config } = BlApi;
    const api = config.rewardsApi || config.transferApi;
    const levelNames = ["is-bronze", "is-silver", "is-gold"];
    // Metal de la medalla por nivel (índice de rewards-service: 0 Bronce, 1 Plata, 2 Oro).
    const medalNames = ["medal-bronze", "medal-silver", "medal-gold"];
    const state = { data: null, busy: false };

    const formatPoints = v => Number(v || 0).toLocaleString("es-CO");
    const uuid = () =>
        crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo completar", err?.message || fallback, "!");
    }

    async function load() {
        try {
            state.data = await BlApi.authed(api, "GET", "/rewards");
            render();
        } catch (err) {
            fail(err, "No se pudieron cargar tus puntos.");
        }
    }

    function render() {
        const data = state.data;
        if (!data) return;
        const level = data.level;
        const next = data.next;
        const progress = next ? Math.min(100, ((data.earned - level.min) / (next.min - level.min)) * 100) : 100;

        setText("pointsTotal", formatPoints(data.balance));
        setText("pointsValue", formatMoney(data.value));
        setText("pointsLevel", `Nivel ${level.name}`);
        setText("pointsMedalLabel", String(level.name).toUpperCase());
        setText("pointsMultiplier", `x${String(level.multiplier).replace(".", ",")} puntos`);
        setText(
            "pointsNextText",
            next
                ? `Te faltan ${formatPoints(next.min - data.earned)} puntos ganados para ${next.name}`
                : "¡Llegaste al nivel más alto!"
        );

        const bar = byId("pointsBar");
        bar.querySelector("span").style.width = `${progress}%`;
        bar.setAttribute("aria-valuenow", Math.round(progress));

        const hero = document.querySelector(".points-hero");
        hero.classList.remove(...levelNames);
        hero.classList.add(levelNames[level.index]);

        // La medalla lleva su propio nivel (no depende solo de la etiqueta ni del hero).
        const medal = byId("pointsMedal");
        if (medal) {
            const metal = medalNames[Math.min(Math.max(Number(level.index) || 0, 0), medalNames.length - 1)];
            medal.classList.remove(...medalNames);
            medal.classList.add(metal);
            medal.dataset.level = String(level.index);
        }
        document.querySelectorAll(".points-levels [data-level]").forEach(el => {
            el.classList.toggle("reached", Number(el.dataset.level) <= level.index);
        });

        // Catálogo
        byId("rewardGrid").innerHTML = data.rewards
            .map(reward => {
                const missing = reward.points - data.balance;
                return `
            <article class="reward-card is-${reward.kind}">
                <span class="reward-tag">${reward.kind === "cash" ? "Plata" : reward.kind === "recharge" ? "Recarga" : "Bono"}</span>
                <b>${escapeHTML(reward.title)}</b>
                <small>${escapeHTML(reward.text)}</small>
                <div class="reward-foot">
                    <strong>${formatPoints(reward.points)} pts</strong>
                    <button type="button" class="btn ${missing > 0 ? "soft" : "primary"}" data-reward="${escapeHTML(reward.id)}" ${missing > 0 || state.busy ? "disabled" : ""}>
                        ${missing > 0 ? `Faltan ${formatPoints(missing)}` : "Canjear"}
                    </button>
                </div>
            </article>`;
            })
            .join("");

        // Retos
        byId("badgeGrid").innerHTML = data.badges
            .map(badge => {
                const inner = `
                <span class="badge-icon" aria-hidden="true">${badge.done ? "✓" : escapeHTML(badge.icon)}</span>
                <div><b>${escapeHTML(badge.title)}</b><small>${escapeHTML(badge.soon ? `${badge.text} · Próximamente` : badge.text)}</small></div>
                <em>+${formatPoints(badge.points)}</em>`;
                return badge.done || badge.soon || !badge.link
                    ? `<div class="badge-item ${badge.done ? "done" : ""}">${inner}</div>`
                    : `<a class="badge-item" href="${escapeHTML(badge.link)}">${inner}</a>`;
            })
            .join("");
        const achievable = data.badges.filter(b => !b.soon);
        setText("badgeCount", `${achievable.filter(b => b.done).length} de ${achievable.length}`);

        // Bonos
        byId("couponList").innerHTML = data.coupons.length
            ? data.coupons
                  .map(
                      coupon => `
                <div class="coupon">
                    <div>
                        <b>${escapeHTML(coupon.title)}</b>
                        <small>${escapeHTML(coupon.text)} · vence el ${formatDate(coupon.expiresAt, { dateStyle: "medium" })}</small>
                        <code>${escapeHTML(coupon.code)}</code>
                    </div>
                    <button type="button" class="text-btn" data-copy-coupon="${escapeHTML(coupon.code)}">Copiar</button>
                </div>`
                  )
                  .join("")
            : '<p class="pay-empty">Cuando canjees un bono, su código aparece aquí.</p>';

        // Historial
        byId("pointsHistory").innerHTML = data.history.length
            ? data.history
                  .slice(0, 12)
                  .map(
                      item => `
                <div class="pay-history">
                    <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <small>${escapeHTML(item.detail || "")}${item.detail ? " · " : ""}${formatDate(item.createdAt, { dateStyle: "medium" })}</small>
                    </div>
                    <b class="${item.points > 0 ? "is-in" : ""}">${item.points > 0 ? "+" : "−"}${formatPoints(Math.abs(item.points))}</b>
                    <span></span>
                </div>`
                  )
                  .join("")
            : '<p class="pay-empty">Aún no tienes movimientos de puntos.</p>';

        // Operadores del canje de recarga
        byId("rechargeOperator").innerHTML = (data.operators || [])
            .map(op => `<option value="${escapeHTML(op.code)}">${escapeHTML(op.name)}</option>`)
            .join("");
    }

    // ---------- canjear ----------
    async function redeem(reward, operatorCode) {
        if (state.busy) return;
        state.busy = true;
        render();
        // Una clave por canje confirmado: si la red falla y se reintenta, es el mismo canje.
        const idempotencyKey = uuid();
        const body = { rewardId: reward.id, idempotencyKey, ...(operatorCode ? { operatorCode } : {}) };
        try {
            const result = await BlApi.authed(api, "POST", "/rewards/redeem", body);
            if (reward.kind === "cash") {
                showMessage(
                    "¡Canje exitoso!",
                    `Sumamos ${formatMoney(reward.value)} a tu cuenta. Ya lo ves en tus movimientos.`
                );
            } else if (reward.kind === "recharge") {
                showMessage(
                    "¡Recarga enviada!",
                    `Recargamos ${formatMoney(reward.value)} a tu celular ${String(result.phone || "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3")} (${result.operator}).`
                );
            } else {
                showMessage(
                    "¡Bono listo!",
                    `Tu código es ${result.couponCode}. También quedó guardado en "Mis bonos".`
                );
            }
        } catch (err) {
            fail(err, "No se pudo completar el canje.");
        } finally {
            state.busy = false;
            await load();
        }
    }

    byId("rewardGrid").addEventListener("click", async event => {
        const button = event.target.closest("[data-reward]");
        if (!button || !state.data) return;
        const reward = state.data.rewards.find(item => item.id === button.dataset.reward);
        if (!reward || state.data.balance < reward.points) return;

        if (reward.kind === "recharge") {
            state.pendingReward = reward;
            openModal("rechargeModal");
            return;
        }

        const detail =
            reward.kind === "cash"
                ? `Se suman ${formatMoney(reward.value)} a tu cuenta.`
                : "Te damos un código para usar en los próximos 30 días.";
        const ok = await confirmAction(
            "Canjear puntos",
            `Vas a usar ${formatPoints(reward.points)} puntos en "${reward.title}". ${detail}`,
            "Canjear"
        );
        if (ok) redeem(reward);
    });

    byId("rechargeForm").addEventListener("submit", event => {
        event.preventDefault();
        const reward = state.pendingReward;
        if (!reward) return;
        closeModalById("rechargeModal");
        redeem(reward, byId("rechargeOperator").value);
    });

    byId("couponList").addEventListener("click", async event => {
        const button = event.target.closest("[data-copy-coupon]");
        if (!button) return;
        try {
            await navigator.clipboard.writeText(button.dataset.copyCoupon);
            toast("Código copiado.", "ok");
        } catch {
            toast(`Tu código es ${button.dataset.copyCoupon}`, "info");
        }
    });

    tiltOnPointer(document.querySelector(".medal"), 16);
    load();
});
