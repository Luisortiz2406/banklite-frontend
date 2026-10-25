// =========================================================
// BANKLITE - RECARGAR SALDO CON WOMPI (dashboard)
// deposit-service (/deposits) crea la recarga con su referencia y la firma de
// integridad; aquí solo se abre el widget de Wompi con esos datos. El saldo lo
// abona el backend cuando Wompi confirma el pago (webhook o consulta): el
// resultado del widget nunca se toma como verdad, solo dispara una consulta.
// Al terminar se avisa al dashboard (banklite:account-changed).
// =========================================================

const WOMPI_WIDGET_URL = "https://checkout.wompi.co/widget.js";
const TOPUP_QUICK_AMOUNTS = [50000, 100000, 200000, 500000];
// Tras cerrar el widget: cuántas veces y cada cuánto se consulta la recarga.
const TOPUP_POLL_TRIES = 8;
const TOPUP_POLL_MS = 2500;

const TOPUP_METHODS = { CARD: "tarjeta", PSE: "PSE", NEQUI: "Nequi" };

let wompiWidgetPromise = null;

/** Carga el widget de Wompi una sola vez (no va en el HTML para no cargarlo en cada visita). */
function loadWompiWidget() {
    if (window.WidgetCheckout) return Promise.resolve();
    if (!wompiWidgetPromise) {
        wompiWidgetPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = WOMPI_WIDGET_URL;
            script.async = true;
            script.onload = () => (window.WidgetCheckout ? resolve() : reject(new Error("widget")));
            script.onerror = () => {
                wompiWidgetPromise = null;
                script.remove();
                reject(new Error("widget"));
            };
            document.head.appendChild(script);
        });
    }
    return wompiWidgetPromise;
}

document.addEventListener("DOMContentLoaded", () => {
    const openButton = byId("topupOpen");
    if (!openButton || !BlApi.hasSession()) return;

    const { config, session } = BlApi;
    const api = config.depositApi;
    const state = { config: null, busy: false };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo recargar", err?.message || fallback, "!");
    }

    async function loadConfig() {
        try {
            state.config = await BlApi.authed(api, "GET", "/deposits/config");
        } catch {
            return; // sin deposit-service no se ofrece la recarga
        }
        const { minAmount, maxAmount, environment } = state.config;
        setText("topupRange", `Mínimo ${formatMoney(minAmount)} · máximo ${formatMoney(maxAmount)}.`);
        byId("topupSandbox").hidden = environment !== "sandbox";
        byId("topupAmount").min = String(minAmount);
        byId("topupAmount").max = String(maxAmount);
        byId("topupQuick").innerHTML = TOPUP_QUICK_AMOUNTS.filter(v => v >= minAmount && v <= maxAmount)
            .map(
                value =>
                    `<button type="button" class="goal-quick-btn" data-amount="${value}">${escapeHTML(formatMoney(value))}</button>`
            )
            .join("");
        openButton.hidden = false;
    }

    openButton.addEventListener("click", () => {
        if (!session.accountId) return showMessage("Sin cuenta", "Aún no tienes una cuenta activa para recargar.", "!");
        byId("topupForm").reset();
        document.querySelectorAll("#topupQuick .goal-quick-btn").forEach(b => b.classList.remove("is-selected"));
        openModal("topupModal");
        byId("topupAmount").focus();
    });

    byId("topupQuick").addEventListener("click", event => {
        const chip = event.target.closest("[data-amount]");
        if (!chip) return;
        byId("topupAmount").value = chip.dataset.amount;
        document
            .querySelectorAll("#topupQuick .goal-quick-btn")
            .forEach(btn => btn.classList.toggle("is-selected", btn === chip));
    });

    byId("topupForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (state.busy || !state.config) return;
        const amount = Number(byId("topupAmount").value) || 0;
        const { minAmount, maxAmount } = state.config;
        if (!Number.isInteger(amount) || amount < minAmount || amount > maxAmount) {
            return showMessage(
                "Monto inválido",
                `La recarga debe estar entre ${formatMoney(minAmount)} y ${formatMoney(maxAmount)}.`,
                "!"
            );
        }

        state.busy = true;
        byId("topupSubmit").disabled = true;
        try {
            // Primero el widget: si no carga (red o bloqueador) no se crea una recarga que nadie pagará.
            await loadWompiWidget();
            const deposit = await BlApi.authed(api, "POST", "/deposits", { accountId: session.accountId, amount });
            closeModalById("topupModal");
            openCheckout(deposit);
        } catch (err) {
            if (err?.message === "widget") {
                showMessage(
                    "Wompi no está disponible",
                    "No se pudo abrir la pasarela de pagos. Inténtalo de nuevo.",
                    "!"
                );
            } else {
                fail(err, "No se pudo iniciar la recarga.");
            }
        } finally {
            state.busy = false;
            byId("topupSubmit").disabled = false;
        }
    });

    function openCheckout(deposit) {
        const { checkout } = deposit;
        const widget = new window.WidgetCheckout({
            currency: checkout.currency,
            amountInCents: checkout.amountInCents,
            reference: checkout.reference,
            publicKey: checkout.publicKey,
            expirationTime: checkout.expirationTime,
            signature: { integrity: checkout.signature.integrity },
        });
        widget.open(result => {
            // El id de la transacción solo le dice al backend dónde buscar; el estado lo confirma Wompi.
            const transactionId = result?.transaction?.id;
            follow(deposit, typeof transactionId === "string" ? transactionId : undefined);
        });
    }

    /** Consulta la recarga hasta que tenga un estado final (o se agoten los intentos). */
    async function follow(deposit, transactionId) {
        toast("Estamos confirmando tu recarga con Wompi…", "info");
        let current = deposit;
        for (let attempt = 0; attempt < TOPUP_POLL_TRIES; attempt++) {
            try {
                current =
                    attempt === 0
                        ? await BlApi.authed(api, "POST", `/deposits/${deposit.id}/sync`, { transactionId })
                        : await BlApi.authed(api, "GET", `/deposits/${deposit.id}`);
            } catch (err) {
                if (BlApi.handleAuthError(err)) return;
            }
            if (current.status !== "PENDING") break;
            await wait(TOPUP_POLL_MS);
        }
        report(current);
    }

    function report(deposit) {
        const amount = formatMoney(deposit.amount);
        const method = TOPUP_METHODS[deposit.paymentMethodType];
        switch (deposit.status) {
            case "APPROVED":
                document.dispatchEvent(new CustomEvent("banklite:account-changed"));
                showMessage(
                    "¡Recarga exitosa!",
                    `Abonamos ${amount} a tu cuenta${method ? ` (pago con ${method})` : ""}. Ya lo ves en tus movimientos.`,
                    "✓"
                );
                break;
            case "DECLINED":
                showMessage("Pago rechazado", `Wompi rechazó el pago de ${amount}. No se abonó nada.`, "!");
                break;
            case "VOIDED":
            case "ERROR":
            case "EXPIRED":
                showMessage("Recarga no completada", `La recarga de ${amount} no se completó. No se abonó nada.`, "!");
                break;
            case "PENDING":
                showMessage(
                    "Recarga en proceso",
                    `Tu pago de ${amount} aún está en proceso (con PSE puede tardar unos minutos). Te la abonamos apenas Wompi lo confirme.`,
                    "…"
                );
                break;
            default:
                showMessage(
                    "Recarga en revisión",
                    `Tu recarga de ${amount} quedó en revisión. Si Wompi te cobró, nuestro equipo la revisará.`,
                    "!"
                );
        }
    }

    loadConfig();
});
