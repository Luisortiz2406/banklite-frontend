// =========================================================
// BANKLITE - TRANSFERIR (transferir.html)
// Entre cuentas Banklite (número de cuenta o llave Banklite) o a otros bancos y
// billeteras (el dinero sale por la cuenta de compensación; la llegada al otro
// banco es de demostración):
// POST /transfers/prepare → /:id/confirm (o /:id/cancel). Con llave, la
// cuenta destino la resuelve transfer-service y nunca se le muestra a quien envía. Al confirmar, la app adjunta sola la clave dinámica vigente
// (GET /auth/dynamic-key) y transfer-service la valida con auth-service: la
// persona no la escribe. El comprobante sale del movimiento real del ledger.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("transferForm");
    if (!form) return;
    if (!BlApi.protectPage()) return;

    const { config, session } = BlApi;
    const ACCOUNT_TYPES = { savings: "Cuenta de ahorros", checking: "Cuenta corriente" };
    const state = {
        step: 1,
        mode: "banklite",
        bank: null,
        breb: null,
        account: null,
        balance: null,
        limits: null,
        kyc: null,
        pending: null,
        done: null,
    };

    // Moneda de la cuenta por defecto
    const money = (v, currency = state.account?.currency) => formatMoney(v, currency);
    const uuid = () =>
        crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    const formatAccount = n => (n || "").replace(/^(\d{3})(\d{4})(\d{4})$/, "$1 $2 $3");

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo completar", err?.message || fallback, "!");
    }

    function setLoading(button, loading) {
        button.disabled = loading;
        if (loading) {
            button.dataset.label = button.innerHTML;
            button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Procesando…';
        } else if (button.dataset.label) button.innerHTML = button.dataset.label;
    }

    // ---------- cuenta de origen ----------
    async function loadAccount() {
        try {
            const accounts = await BlApi.authed(config.accountApi, "GET", "/accounts");
            const usable = (accounts || []).filter(a => a.status !== "closed");
            state.account = usable.find(a => a.id === session.accountId) || usable[0] || null;
            if (!state.account) {
                byId("availableTransfer").textContent = "—";
                showMessage("Sin cuenta", "Primero debes abrir una cuenta Banklite desde el inicio.", "!");
                byId("nextTransfer").disabled = true;
                return;
            }
            session.accountId = state.account.id;
            const [balance, limits] = await Promise.all([
                BlApi.authed(config.ledgerApi, "GET", `/ledger/accounts/${state.account.id}/balance`),
                BlApi.authed(config.accountApi, "GET", `/accounts/${state.account.id}/limits`),
            ]);
            Object.assign(state, { balance, limits });
            byId("availableTransfer").textContent = money(balance.balance, balance.currency);
            byId("limitHint").textContent =
                `Se descuenta de tu saldo disponible. Límite diario: ${money(limits.dailyLimit)}.`;
            if (state.account.status !== "active") {
                showMessage("Cuenta no disponible", "Tu cuenta no está activa, por eso no puedes transferir.", "!");
                byId("nextTransfer").disabled = true;
            }
        } catch (err) {
            fail(err, "No se pudo cargar tu cuenta.");
        }
        BlApi.authed(config.kycApi, "GET", `/kyc/${session.idUser}`)
            .then(k => {
                state.kyc = k;
            })
            .catch(() => {});
    }

    // ---------- pasos: 1 entidad, 2 destinatario, 3 monto, 4 verificar ----------
    const steps = [...form.querySelectorAll(".transfer-step")];
    const indicators = [...document.querySelectorAll(".stepper .step")];

    function goTo(step) {
        state.step = step;
        steps.forEach(s => s.classList.toggle("active", Number(s.dataset.step) === step));
        indicators.forEach((s, i) => {
            s.classList.toggle("active", i + 1 === step);
            s.classList.toggle("complete", i + 1 < step);
        });
        byId("prevTransfer").style.visibility = step === 1 ? "hidden" : "visible";
        byId("nextTransfer").textContent = step === 4 ? "Enviar" : "Continuar";
        if (step === 2) setTimeout(() => byId(isBreb() ? "brebKey" : "accountNumber").focus(), 60);
        if (step === 3) setTimeout(() => byId("transferAmount").focus(), 60);
        if (step === 4) paintReview();
    }

    // Banklite (número de cuenta), llave Banklite u otro banco / billetera.
    const isBreb = () => state.mode === "breb";
    const isExternal = () => state.mode === "external";
    const isWallet = () => isExternal() && /^(Nequi|DaviPlata)$/.test(state.bank);
    const bankliteOption = form.querySelector('.bank-option[data-bank="Banklite"]');
    const brebOption = form.querySelector('.breb-option[data-bank="llave"]');
    const bankOptions = [...form.querySelectorAll(".bank-option")];

    function setMode(mode, bank = null) {
        state.mode = mode;
        state.bank = mode === "external" ? bank : null;
        bankOptions.forEach(option =>
            option.classList.toggle(
                "selected",
                (mode === "banklite" && option === bankliteOption) ||
                    (mode === "external" && option.dataset.bank === bank)
            )
        );
        brebOption.classList.toggle("selected", mode === "breb");
        byId("brebBox").hidden = mode !== "breb";
        byId("accountFields").hidden = mode === "breb";
        byId("accountTypeField").hidden = !(mode === "external" && !isWallet());
        byId("recipientNameField").hidden = mode !== "external";
        byId("externalNote").hidden = mode !== "external";
        byId("accountNumberField").classList.toggle("two-span", !(mode === "external" && !isWallet()));
        const number = byId("accountNumber");
        number.maxLength = mode === "external" ? (isWallet() ? 10 : 16) : 11;
        number.value = number.value.slice(0, number.maxLength);
        byId("accountNumberLabel").textContent =
            mode !== "external"
                ? "Número de cuenta Banklite (11 dígitos)"
                : isWallet()
                  ? `Celular registrado en ${bank}`
                  : "Número de cuenta";
        number.placeholder =
            mode !== "external" ? "Ej. 86091953267" : isWallet() ? "Ej. 3001234567" : "Número del destinatario";
        byId("recipientHelp").textContent =
            mode === "breb"
                ? "Escribe la llave de quien recibe y te mostramos a nombre de quién está antes de enviar."
                : mode === "external"
                  ? "Escribe los datos tal como aparecen en la cuenta de destino."
                  : "Pídele a la persona el número de su cuenta Banklite. Lo encuentra en su inicio, en «Recibir».";
    }

    bankOptions.forEach(option =>
        option.addEventListener("click", () => {
            if (option === bankliteOption) setMode("banklite");
            else setMode("external", option.dataset.bank);
            goTo(2);
        })
    );
    brebOption.addEventListener("click", () => {
        setMode("breb");
        goTo(2);
    });

    // ---------- llave Banklite: a nombre de quién está ----------
    const brebInput = byId("brebKey");
    const brebResult = byId("brebResult");
    let brebTimer = null;
    let brebSeq = 0;

    function paintBreb(message, kind) {
        const chip = byId("brebType");
        const target = state.breb;
        chip.hidden = !target;
        if (target) chip.innerHTML = `${brebSvg(target.type, 13)} ${escapeHTML(BREB_TYPES[target.type].label)}`;
        if (!message && !target) {
            brebResult.hidden = true;
            return;
        }
        brebResult.hidden = false;
        if (!target || target.own) {
            brebResult.className = `breb-result ${target?.own ? "is-error" : kind || "is-waiting"}`;
            brebResult.textContent = target?.own
                ? "Esta llave es tuya. Escribe la llave de la persona que va a recibir."
                : message;
            return;
        }
        brebResult.className = "breb-result is-found";
        brebResult.innerHTML = `
            <span class="recipient-avatar">${escapeHTML(initials(target.holderName.replace(/•/g, "")) || "?")}</span>
            <div>
                <small>La llave pertenece a</small>
                <strong>${escapeHTML(target.holderName)}</strong>
                <span>${escapeHTML(target.entity)} · Llega al instante</span>
            </div>
            <span class="breb-check" aria-hidden="true">✓</span>`;
    }

    async function lookupBreb() {
        const value = brebInput.value.trim();
        state.breb = null;
        const found = brebDetect(value);
        if (!found) {
            paintBreb(value.length > 3 ? "Seguimos esperando una llave válida: celular, correo, cédula o @llave." : "");
            return;
        }
        const seq = ++brebSeq;
        paintBreb("Buscando la llave…");
        try {
            const result = await BlApi.authed(
                config.accountApi,
                "GET",
                `/accounts/keys/lookup?key=${encodeURIComponent(found.key)}`
            );
            if (seq !== brebSeq) return;
            state.breb = result;
            paintBreb();
        } catch (err) {
            if (seq !== brebSeq || BlApi.handleAuthError(err)) return;
            paintBreb(err.message || "No encontramos esa llave en Banklite.", "is-error");
        }
    }

    brebInput.addEventListener("input", () => {
        clearTimeout(brebTimer);
        state.breb = null;
        brebTimer = setTimeout(lookupBreb, 300);
    });

    byId("accountNumber").addEventListener("input", e => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, e.target.maxLength);
    });

    const amountInput = byId("transferAmount");
    const paintAmount = () => {
        byId("amountPreview").textContent = money(amountInput.value);
    };
    amountInput.addEventListener("input", paintAmount);
    form.querySelectorAll("[data-amount]").forEach(chip =>
        chip.addEventListener("click", () => {
            amountInput.value = chip.dataset.amount;
            paintAmount();
        })
    );

    function destination() {
        return byId("accountNumber").value.trim();
    }
    function amount() {
        return Number(amountInput.value);
    }

    function paintReview() {
        if (isExternal()) {
            const name = byId("recipientName").value.trim();
            byId("recipientInitials").textContent = initials(name) || "?";
            byId("recipientPreview").textContent = name;
            byId("recipientAccountPreview").textContent = [
                state.bank,
                isWallet() ? null : byId("accountType").value,
                destination(),
            ]
                .filter(Boolean)
                .join(" · ");
        } else if (isBreb()) {
            byId("recipientInitials").textContent = initials(state.breb.holderName.replace(/•/g, "")) || "?";
            byId("recipientPreview").textContent = state.breb.holderName;
            byId("recipientAccountPreview").textContent = `Llave Banklite ${state.breb.maskedKey}`;
        } else {
            byId("recipientInitials").textContent = "B";
            byId("recipientPreview").textContent = "Cuenta Banklite";
            byId("recipientAccountPreview").textContent = formatAccount(destination());
        }
        byId("recipientAmountPreview").textContent = money(amount());
        const after = (Number(state.balance?.balance) || 0) - amount();
        byId("transferSummary").innerHTML = "";
        [
            [
                "Desde",
                `${ACCOUNT_TYPES[state.account?.accountType] || "Cuenta"} ···· ${String(state.account?.accountNumber || "").slice(-4)}`,
            ],
            ["Costo de la transacción", money(0)],
            ["Saldo después del envío", money(after)],
        ].forEach(([label, value]) => {
            const row = document.createElement("div");
            row.innerHTML = "<span></span><strong></strong>";
            row.querySelector("span").textContent = label;
            row.querySelector("strong").textContent = value;
            byId("transferSummary").appendChild(row);
        });
    }

    function validate(step) {
        if (step === 2 && isExternal()) {
            if (isWallet() && !/^3\d{9}$/.test(destination()))
                return `El número de ${state.bank} es un celular de 10 dígitos que empieza por 3.`;
            if (!isWallet() && !byId("accountType").value) return "Elige el tipo de cuenta.";
            if (!isWallet() && !/^\d{6,16}$/.test(destination()))
                return "El número de cuenta debe tener entre 6 y 16 dígitos.";
            if (byId("recipientName").value.trim().length < 3) return "Escribe el nombre de quien recibe.";
        } else if (step === 2 && isBreb()) {
            if (!state.breb) return "Escribe una llave Banklite registrada en Banklite.";
            if (state.breb.own) return "Esta llave es tuya. Escribe la llave de la persona que va a recibir.";
        } else if (step === 2) {
            if (!/^\d{11}$/.test(destination())) return "El número de cuenta destino debe tener 11 dígitos.";
            if (destination() === state.account?.accountNumber)
                return "La cuenta destino debe ser diferente a tu cuenta.";
        }
        if (step === 3) {
            if (!Number.isFinite(amount()) || amount() <= 0) return "Ingresa un monto válido.";
            const min = BL_CATALOG?.transfers?.min;
            if (min && amount() < min) return `El valor mínimo por envío es de ${formatMoney(min)}.`;
            if (state.balance && amount() > Number(state.balance.balance))
                return "El monto supera tu saldo disponible.";
        }
        return null;
    }

    byId("prevTransfer").addEventListener("click", () => {
        if (state.step > 1) goTo(state.step - 1);
    });
    byId("nextTransfer").addEventListener("click", async () => {
        if (state.step === 1)
            return (
                isBreb()
                    ? brebOption
                    : isExternal()
                      ? bankOptions.find(o => o.dataset.bank === state.bank)
                      : bankliteOption
            ).click();
        const problem = validate(state.step);
        if (problem) return toast(problem, "err");
        if (state.step < 4) return goTo(state.step + 1);
        await prepare();
    });

    // ---------- preparar → confirmar / cancelar ----------
    async function prepare() {
        const button = byId("nextTransfer");
        setLoading(button, true);
        try {
            state.pending = await BlApi.authed(config.transferApi, "POST", "/transfers/prepare", {
                sourceAccountId: state.account.id,
                ...(isBreb()
                    ? { destinationKey: state.breb.key }
                    : isExternal()
                      ? {
                            destinationBank: state.bank,
                            destinationAccountType: isWallet() ? undefined : byId("accountType").value,
                            destinationAccountNumber: destination(),
                            recipientName: byId("recipientName").value.trim(),
                        }
                      : { destinationAccountNumber: destination() }),
                amount: amount(),
                description: byId("concept").value.trim() || undefined,
                idempotencyKey: uuid(),
            });
            const box = byId("confirmTransferContent");
            box.replaceChildren();
            [
                ...destinationRows(state.pending),
                ["Valor", money(state.pending.amount)],
                ["Concepto", state.pending.description || "Transferencia"],
                ["Desde", `···· ${String(state.account.accountNumber).slice(-4)}`],
            ].forEach(([label, value]) => {
                const row = document.createElement("div");
                row.innerHTML = "<span></span><strong></strong>";
                row.querySelector("span").textContent = label;
                row.querySelector("strong").textContent = value;
                box.appendChild(row);
            });
            openModal("transferConfirmModal");
        } catch (err) {
            fail(err, "No se pudo preparar la transferencia.");
        } finally {
            setLoading(button, false);
        }
    }

    // Con llave se muestran la llave y el titular; nunca el número de cuenta destino.
    function destinationRows(request) {
        if (request.destinationBank) {
            return [
                ["Entidad", request.destinationBank],
                [
                    request.destinationAccountType
                        ? `Cuenta de ${request.destinationAccountType.toLowerCase()}`
                        : "Celular",
                    `···· ${request.destinationAccountLast4}`,
                ],
                ["Titular", request.recipientName || "—"],
            ];
        }
        if (request.destinationKey) {
            return [
                ["Llave Banklite", state.breb?.maskedKey || request.destinationKey],
                ["Titular", request.recipientName || "—"],
            ];
        }
        return [["Cuenta destino", `Banklite ${formatAccount(request.destinationAccountNumber)}`]];
    }

    // "Corregir" o cerrar la confirmación cancela la solicitud pendiente.
    async function cancelPending() {
        const pending = state.pending;
        state.pending = null;
        if (!pending?.id) return;
        try {
            await BlApi.authed(config.transferApi, "POST", `/transfers/${pending.id}/cancel`, {});
        } catch (err) {
            if (!BlApi.handleAuthError(err)) toast(err.message || "No se pudo cancelar la solicitud.", "err");
        }
    }
    byId("transferConfirmModal")
        .querySelectorAll("[data-close]")
        .forEach(b => b.addEventListener("click", cancelPending));

    byId("confirmTransfer").addEventListener("click", async () => {
        if (!state.pending) return;
        const button = byId("confirmTransfer");
        setLoading(button, true);
        try {
            // Validación interna: se pide la clave vigente y se envía con la confirmación.
            const { code } = await BlApi.authed(config.authApi, "GET", "/auth/dynamic-key");
            const result = await BlApi.authed(config.transferApi, "POST", `/transfers/${state.pending.id}/confirm`, {
                dynamicCode: code,
            });
            state.done = result;
            state.pending = null;
            closeModalById("transferConfirmModal");
            await showSuccess(result);
            await loadAccount();
        } catch (err) {
            // Clave dinámica bloqueada o no validada: la solicitud sigue pendiente.
            if (/clave dinámica/i.test(err?.message || "")) {
                showMessage("No se pudo validar la clave dinámica", err.message, "!");
                return;
            }
            fail(err, "No se pudo realizar la transferencia.");
        } finally {
            setLoading(button, false);
        }
    });

    // Comprobante: el movimiento real del ledger para esta transacción.
    async function findMovement(transactionId) {
        if (!transactionId) return null;
        try {
            const recent = await BlApi.authed(
                config.ledgerApi,
                "GET",
                `/ledger/accounts/${state.account.id}/transactions?limit=20`
            );
            return recent.find(m => m.transactionId === transactionId) || null;
        } catch {
            return null;
        }
    }

    async function showSuccess(result) {
        const movement = await findMovement(result.ledgerTransactionId);
        state.done.movement = movement;
        const box = byId("successTransferContent");
        box.replaceChildren();
        [
            ["Valor", money(result.amount)],
            ...destinationRows(result),
            ["Concepto", result.description || "Transferencia"],
            ["Fecha", formatDate(movement?.createdAt || new Date(), { dateStyle: "long", timeStyle: "short" })],
            [
                "N.º de operación",
                String(result.ledgerTransactionId || result.id)
                    .slice(0, 8)
                    .toUpperCase(),
            ],
        ].forEach(([label, value]) => {
            const row = document.createElement("div");
            row.innerHTML = "<span></span><strong></strong>";
            row.querySelector("span").textContent = label;
            row.querySelector("strong").textContent = value;
            box.appendChild(row);
        });
        byId("downloadReceipt").hidden = !movement;
        openModal("transferSuccessModal");
    }

    byId("downloadReceipt").addEventListener("click", () => {
        const movement = state.done?.movement;
        if (!movement) return;
        const k = state.kyc || {};
        downloadReceipt(movement, {
            name: k.nombres ? `${k.nombres} ${k.apellidos || ""}`.trim() : "Cliente Banklite",
            accountType: ACCOUNT_TYPES[state.account.accountType] || "Cuenta",
            accountNumber: state.account.accountNumber,
        });
        toast("Comprobante descargado.", "ok");
    });

    // "Hacer otra transferencia": empieza de cero.
    byId("transferSuccessModal")
        .querySelector("[data-close]")
        ?.addEventListener("click", () => {
            form.reset();
            bankOptions.forEach(option => option.classList.remove("selected"));
            brebOption.classList.remove("selected");
            state.breb = null;
            setMode("banklite");
            paintBreb("");
            paintAmount();
            goTo(1);
        });

    goTo(1);
    loadAccount();

    // transferir.html?breb=1 abre el envío con llave; ?llave=... además escribe la llave (desde Mis llaves).
    // ?monto=... deja escrito el valor (desde Cancelar mi cuenta: enviar el saldo).
    const params = new URLSearchParams(window.location.search);
    const presetAmount = Number(params.get("monto"));
    if (Number.isFinite(presetAmount) && presetAmount > 0)
        byId("transferAmount").value = String(Math.floor(presetAmount));
    if (params.get("breb") === "1" || params.get("llave")) {
        setMode("breb");
        goTo(2);
        if (params.get("llave")) {
            brebInput.value = params.get("llave");
            lookupBreb();
        }
    }
});
