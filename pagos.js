// =========================================================
// BANKLITE - PAGOS Y RECARGAS (pagos.html)
// Mismo diseño y comportamiento que la versión simulada, pero contra
// payment-service: facturas (GET /payments/bills), facturas inscritas
// (/payments/saved-bills) y pago/recarga con POST /payments/prepare →
// /:id/confirm. Al confirmar, la app adjunta sola la clave dinámica vigente,
// como en las transferencias. El dinero se mueve en el ledger.
// =========================================================

// Íconos por servicio (los nombres y empresas vienen del backend).
const PAY_ICONS = {
    agua: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5 12 2c-.5 3-2 5.4-4 7S5 13 5 15a7 7 0 0 0 7 7"/>',
    energia: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    gas: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.5 1.3 2.7 2.5 2.7"/>',
    internet:
        '<path d="M5 12.6a10 10 0 0 1 14 0"/><path d="M8.5 16.1a5 5 0 0 1 7 0"/><path d="M2 9a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>',
    telefonia:
        '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/>',
    admin: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v8h4M18 9h2a2 2 0 0 1 2 2v11h-4"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>',
};
const PHONE_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>';
const PDF_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';

const paySvg = key =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PAY_ICONS[key] || PAY_ICONS.agua}</svg>`;

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("paymentsPage")) return;
    if (!BlApi.protectPage()) return;

    const { config, session } = BlApi;
    const api = config.paymentApi || config.transferApi;
    const ACCOUNT_TYPES = { savings: "Cuenta de ahorros", checking: "Cuenta corriente" };

    const state = {
        account: null,
        balance: 0,
        kyc: null,
        services: [],
        billers: [],
        topup: { min: 1000, max: 500000 },
        payments: [],
        saved: [],
        lastMovement: null,
    };

    const parseMoney = v => Number(String(v || "").replace(/\D/g, "")) || 0;
    const uuid = () =>
        crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    const formatPhone = n => String(n || "").replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
    const monthLabel = period => {
        const text = formatDate(`${period}-15T12:00:00`, { month: "long", year: "numeric" });
        return text.charAt(0).toUpperCase() + text.slice(1);
    };
    const receiptNumber = p =>
        String(p.ledgerTransactionId || p.id)
            .slice(0, 8)
            .toUpperCase();

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage("No se pudo completar", err?.message || fallback, "!");
    }

    function setBusy(button, busy, label) {
        button.disabled = busy;
        if (busy) {
            button.dataset.label = button.innerHTML;
            button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span> ${label}`;
        } else if (button.dataset.label) {
            button.innerHTML = button.dataset.label;
            delete button.dataset.label;
        }
    }

    // -----------------------------------------------------
    // CUENTA Y SALDO
    // -----------------------------------------------------

    async function loadAccount() {
        try {
            const accounts = await BlApi.authed(config.accountApi, "GET", "/accounts");
            const usable = (accounts || []).filter(a => a.status !== "closed");
            state.account = usable.find(a => a.id === session.accountId) || usable[0] || null;
            if (!state.account) {
                setText("payAvailable", "—");
                showMessage("Sin cuenta", "Primero debes abrir una cuenta Banklite desde el inicio.", "!");
                return;
            }
            session.accountId = state.account.id;
            const balance = await BlApi.authed(config.ledgerApi, "GET", `/ledger/accounts/${state.account.id}/balance`);
            state.balance = Number(balance.balance) || 0;
            setText("payAvailable", formatMoney(state.balance));
        } catch (err) {
            fail(err, "No se pudo cargar tu cuenta.");
        }
        if (!state.kyc)
            BlApi.authed(config.kycApi, "GET", `/kyc/${session.idUser}`)
                .then(k => {
                    state.kyc = k;
                })
                .catch(() => {});
    }

    // -----------------------------------------------------
    // PESTAÑAS
    // -----------------------------------------------------

    const tabs = document.querySelectorAll(".pay-tab");

    function showTab(id) {
        tabs.forEach(tab => {
            const active = tab.dataset.tab === id;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", String(active));
            byId(tab.dataset.tab).hidden = !active;
        });
    }

    tabs.forEach(tab => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
    if (new URLSearchParams(window.location.search).get("tab") === "recarga") showTab("tabRecharge");

    // -----------------------------------------------------
    // FACTURAS: ELEGIR SERVICIO Y EMPRESA
    // -----------------------------------------------------

    const picker = byId("servicePicker");
    const company = byId("billCompany");
    const reference = byId("billReference");
    const invoiceCard = byId("invoiceCard");
    let service = null;
    let invoice = null;

    function renderServices() {
        picker.innerHTML = state.services
            .map(
                (item, index) => `
            <button type="button" class="service-option${index === 0 ? " selected" : ""}" role="radio" aria-checked="${index === 0}" data-service="${escapeHTML(item.key)}">
                ${paySvg(item.key)}
                <span>${escapeHTML(item.name)}</span>
            </button>`
            )
            .join("");
    }

    function selectService(key, billerCode) {
        service = state.services.find(item => item.key === key) || state.services[0];
        if (!service) return;
        picker.querySelectorAll(".service-option").forEach(option => {
            const active = option.dataset.service === service.key;
            option.classList.toggle("selected", active);
            option.setAttribute("aria-checked", String(active));
        });
        company.innerHTML = state.billers
            .filter(b => b.kind === "bill" && b.service === service.key)
            .map(
                b =>
                    `<option value="${escapeHTML(b.code)}"${b.available ? "" : " disabled"}>${escapeHTML(b.name)}${b.available ? "" : " (no disponible)"}</option>`
            )
            .join("");
        if (billerCode) company.value = billerCode;
        hideInvoice();
    }

    function hideInvoice() {
        invoice = null;
        invoiceCard.hidden = true;
    }

    picker.addEventListener("click", event => {
        const option = event.target.closest("[data-service]");
        if (option) selectService(option.dataset.service);
    });

    company.addEventListener("change", hideInvoice);
    reference.addEventListener("input", () => {
        reference.value = reference.value.replace(/\D/g, "");
        hideInvoice();
    });

    // -----------------------------------------------------
    // FACTURAS: CONSULTAR
    // -----------------------------------------------------

    async function lookup() {
        const ref = reference.value.trim();

        if (!/^\d{6,14}$/.test(ref)) {
            toast("La referencia debe tener entre 6 y 14 números.", "err");
            reference.focus();
            return;
        }
        if (!company.value) {
            toast("Elige la empresa.", "err");
            return;
        }

        const button = byId("billLookupForm").querySelector("[type=submit]");
        setBusy(button, true, "Consultando…");
        try {
            const query = new URLSearchParams({ billerCode: company.value, reference: ref });
            invoice = await BlApi.authed(api, "GET", `/payments/bills?${query}`);
        } catch (err) {
            fail(err, "No se pudo consultar la factura.");
            return;
        } finally {
            setBusy(button, false);
        }

        const paid = invoice.status !== "pending";

        byId("invoiceIcon").innerHTML = paySvg(invoice.service);
        setText("invoiceCompany", invoice.billerName);
        setText("invoiceRef", `${invoice.serviceName} · Ref. ${invoice.reference}`);
        setText("invoicePeriod", monthLabel(invoice.billedPeriod));
        setText("invoiceDue", formatDate(`${invoice.dueDate}T12:00:00`, { dateStyle: "medium" }));
        setText("invoiceAmount", formatMoney(invoice.amount));

        const status = byId("invoiceStatus");
        status.textContent =
            invoice.status === "paid"
                ? "Pagada"
                : invoice.status === "processing"
                  ? "En proceso"
                  : invoice.overdue
                    ? "Vencida"
                    : "Pendiente";
        status.className = "panel-chip" + (paid ? " is-on" : invoice.overdue ? " is-off" : "");

        byId("invoiceSaveBox").hidden = invoice.saved;
        byId("invoiceSave").checked = false;

        const payButton = byId("payInvoice");
        payButton.disabled = paid;
        payButton.textContent =
            invoice.status === "paid"
                ? `Pagada el ${formatDate(invoice.paidAt, { dateStyle: "medium" })}`
                : invoice.status === "processing"
                  ? "Pago en proceso"
                  : `Pagar ${formatMoney(invoice.amount)}`;

        invoiceCard.hidden = false;
        invoiceCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    byId("billLookupForm").addEventListener("submit", event => {
        event.preventDefault();
        lookup();
    });

    // -----------------------------------------------------
    // PAGAR (factura o recarga): preparar → clave dinámica → confirmar
    // -----------------------------------------------------

    async function pay(body) {
        if (!state.account) throw new Error("Primero debes abrir una cuenta Banklite desde el inicio.");
        const pending = await BlApi.authed(api, "POST", "/payments/prepare", {
            ...body,
            sourceAccountId: state.account.id,
            idempotencyKey: uuid(),
        });
        try {
            // Validación interna: se pide la clave vigente y se envía con la confirmación.
            const { code } = await BlApi.authed(config.authApi, "GET", "/auth/dynamic-key");
            return await BlApi.authed(api, "POST", `/payments/${pending.id}/confirm`, { dynamicCode: code });
        } catch (err) {
            // Si no se pudo pagar, no se deja la solicitud pendiente.
            BlApi.authed(api, "POST", `/payments/${pending.id}/cancel`, {}).catch(() => {});
            throw err;
        }
    }

    function payFailed(err, fallback) {
        if (/clave dinámica/i.test(err?.message || "")) {
            showMessage("No se pudo validar la clave dinámica", err.message, "!");
            return;
        }
        fail(err, fallback);
    }

    // El comprobante se arma con el pago registrado (número de operación del ledger).
    function movementOf(payment) {
        return {
            transactionId: payment.ledgerTransactionId || payment.id,
            type: "payment",
            direction: "out",
            amount: payment.amount,
            currency: payment.currency,
            description: payment.description,
            counterpartyAccountLast4: payment.billerAccountLast4,
            createdAt: payment.updatedAt || payment.createdAt,
        };
    }

    function downloadPaymentReceipt(payment) {
        if (typeof downloadReceipt !== "function" || !payment) return;
        const k = state.kyc || {};
        downloadReceipt(movementOf(payment), {
            name: k.nombres ? `${k.nombres} ${k.apellidos || ""}`.trim() : "Cliente Banklite",
            accountType: ACCOUNT_TYPES[state.account?.accountType] || "Cuenta",
            accountNumber: state.account?.accountNumber,
        });
        toast("Comprobante descargado.", "ok");
    }

    function showSuccess(title, rows, payment) {
        state.lastMovement = payment;
        setText("paySuccessTitle", title);
        byId("paySuccessContent").innerHTML = rows
            .map(
                ([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`
            )
            .join("");
        openModal("paySuccessModal");
    }

    byId("payInvoice").addEventListener("click", async () => {
        if (!invoice) return;

        if (invoice.status !== "pending") {
            toast("Esta factura ya está pagada este mes.", "info");
            return;
        }

        if (invoice.amount > state.balance) {
            toast(`No tienes saldo suficiente. Disponible: ${formatMoney(state.balance)}.`, "err");
            return;
        }

        const confirmed = await confirmAction(
            "Confirmar pago",
            `Vas a pagar ${formatMoney(invoice.amount)} a ${invoice.billerName} (Ref. ${invoice.reference}). Tu clave dinámica se valida automáticamente.`,
            "Pagar"
        );
        if (!confirmed) return;

        const current = invoice;
        const button = byId("payInvoice");
        setBusy(button, true, "Pagando…");
        let payment;
        try {
            payment = await pay({ kind: "bill", billerCode: current.billerCode, reference: current.reference });
        } catch (err) {
            payFailed(err, "No se pudo pagar la factura.");
            setBusy(button, false);
            return;
        }
        setBusy(button, false);

        if (byId("invoiceSave").checked) {
            try {
                state.saved = await BlApi.authed(api, "POST", "/payments/saved-bills", {
                    billerCode: current.billerCode,
                    reference: current.reference,
                });
            } catch (err) {
                toast(err.message || "No se pudo inscribir la factura.", "err");
            }
        }

        showSuccess(
            "Factura pagada",
            [
                ["Comprobante", receiptNumber(payment)],
                ["Empresa", current.billerName],
                ["Servicio", current.serviceName],
                ["Referencia", current.reference],
                ["Valor pagado", formatMoney(payment.amount)],
                ["Fecha", formatDate(payment.updatedAt || new Date(), { dateStyle: "medium", timeStyle: "short" })],
            ],
            payment
        );

        reference.value = "";
        hideInvoice();
        refresh();
    });

    // -----------------------------------------------------
    // FACTURAS INSCRITAS Y ÚLTIMOS PAGOS
    // -----------------------------------------------------

    const savedBox = byId("savedBills");

    function renderSavedBills() {
        const list = state.saved;
        setText("billsCount", String(list.length));

        if (!list.length) {
            savedBox.innerHTML =
                '<p class="pay-empty">Inscribe una factura al pagarla y la tendrás aquí lista para el próximo mes.</p>';
            return;
        }

        savedBox.innerHTML = list
            .map(
                bill => `
            <div class="pay-item">
                <button type="button" class="pay-item-main" data-bill="${escapeHTML(bill.id)}">
                    <span class="pay-item-icon">${paySvg(bill.service)}</span>
                    <span class="pay-item-info">
                        <strong>${escapeHTML(bill.billerName)}</strong>
                        <small>${escapeHTML(bill.serviceName)} · Ref. ${escapeHTML(bill.reference)}</small>
                    </span>
                    <span class="pay-item-tag${bill.paidThisMonth ? " is-paid" : ""}">${bill.paidThisMonth ? "Pagada" : "Consultar"}</span>
                </button>
                <button type="button" class="contact-delete" data-delete-bill="${escapeHTML(bill.id)}" aria-label="Eliminar factura de ${escapeHTML(bill.billerName)}">×</button>
            </div>`
            )
            .join("");
    }

    savedBox.addEventListener("click", async event => {
        const remove = event.target.closest("[data-delete-bill]");
        if (remove) {
            const bill = state.saved.find(entry => entry.id === remove.dataset.deleteBill);
            if (!bill) return;
            const confirmed = await confirmAction(
                "Eliminar factura",
                `Dejarás de ver la factura de ${bill.billerName} (Ref. ${bill.reference}) en tu lista.`,
                "Eliminar"
            );
            if (!confirmed) return;
            try {
                state.saved = await BlApi.authed(api, "DELETE", `/payments/saved-bills/${bill.id}`);
                renderSavedBills();
                toast("Factura eliminada de tu lista.", "ok");
            } catch (err) {
                fail(err, "No se pudo eliminar la factura.");
            }
            return;
        }

        const open = event.target.closest("[data-bill]");
        if (!open) return;
        const bill = state.saved.find(entry => entry.id === open.dataset.bill);
        if (!bill) return;
        selectService(bill.service, bill.billerCode);
        reference.value = bill.reference;
        lookup();
    });

    function renderHistory(boxId, kind, empty) {
        const box = byId(boxId);
        const list = state.payments.filter(payment => payment.kind === kind).slice(0, 4);

        if (!list.length) {
            box.innerHTML = `<p class="pay-empty">${empty}</p>`;
            return;
        }

        box.innerHTML = list
            .map(
                payment => `
            <div class="pay-history">
                <div>
                    <strong>${escapeHTML(payment.description)}</strong>
                    <small>${formatDate(payment.updatedAt || payment.createdAt, { dateStyle: "medium" })}</small>
                </div>
                <b>−${formatMoney(payment.amount)}</b>
                <button type="button" class="pay-history-pdf" data-receipt="${escapeHTML(payment.id)}" aria-label="Descargar comprobante" title="Descargar comprobante">${PDF_ICON}</button>
            </div>`
            )
            .join("");
    }

    byId("paymentsPage").addEventListener("click", event => {
        const button = event.target.closest("[data-receipt]");
        if (!button) return;
        downloadPaymentReceipt(state.payments.find(entry => entry.id === button.dataset.receipt));
    });

    byId("payReceipt").addEventListener("click", () => downloadPaymentReceipt(state.lastMovement));

    // -----------------------------------------------------
    // RECARGAS
    // -----------------------------------------------------

    const operatorPicker = byId("operatorPicker");
    const rcNumber = byId("rcNumber");
    const rcAmount = byId("rcAmount");
    const rcType = byId("rcType");
    let operator = null;

    function renderOperators() {
        const operators = state.billers.filter(b => b.kind === "topup");
        operatorPicker.innerHTML = operators
            .map(
                (item, index) => `
            <button type="button" class="operator-option${index === 0 ? " selected" : ""}" role="radio" aria-checked="${index === 0}" data-operator="${escapeHTML(item.code)}"${item.available ? "" : " disabled"}>${escapeHTML(item.name)}</button>
        `
            )
            .join("");
        operator = operators[0] || null;
    }

    function selectOperator(code) {
        const operators = state.billers.filter(b => b.kind === "topup");
        operator = operators.find(item => item.code === code) || operators[0] || null;
        operatorPicker.querySelectorAll(".operator-option").forEach(option => {
            const active = option.dataset.operator === operator?.code;
            option.classList.toggle("selected", active);
            option.setAttribute("aria-checked", String(active));
        });
    }

    operatorPicker.addEventListener("click", event => {
        const option = event.target.closest("[data-operator]");
        if (option) selectOperator(option.dataset.operator);
    });

    rcNumber.addEventListener("input", () => {
        rcNumber.value = rcNumber.value.replace(/\D/g, "");
    });

    rcAmount.addEventListener("input", () => {
        const value = parseMoney(rcAmount.value);
        rcAmount.value = value ? value.toLocaleString("es-CO") : "";
    });

    byId("rcChips").addEventListener("click", event => {
        const chip = event.target.closest("[data-rc]");
        if (chip) rcAmount.value = Number(chip.dataset.rc).toLocaleString("es-CO");
    });

    byId("rechargePageForm").addEventListener("submit", async event => {
        event.preventDefault();

        const phone = rcNumber.value.trim();
        const amount = parseMoney(rcAmount.value);

        if (!operator) {
            toast("Elige el operador.", "err");
            return;
        }

        if (!/^3\d{9}$/.test(phone)) {
            toast("Ingresa un celular de 10 dígitos que empiece por 3.", "err");
            rcNumber.focus();
            return;
        }

        if (amount < state.topup.min) {
            toast(`La recarga mínima es de ${formatMoney(state.topup.min)}.`, "err");
            rcAmount.focus();
            return;
        }

        if (amount > state.topup.max) {
            toast(`La recarga máxima es de ${formatMoney(state.topup.max)}.`, "err");
            return;
        }

        if (amount > state.balance) {
            toast(`No tienes saldo suficiente. Disponible: ${formatMoney(state.balance)}.`, "err");
            return;
        }

        const confirmed = await confirmAction(
            "Confirmar recarga",
            `Vas a recargar ${formatMoney(amount)} al ${phone} (${operator.name}, ${rcType.value.toLowerCase()}). Tu clave dinámica se valida automáticamente.`,
            "Recargar"
        );
        if (!confirmed) return;

        const button = event.submitter || byId("rechargePageForm").querySelector("[type=submit]");
        setBusy(button, true, "Recargando…");
        let payment;
        try {
            payment = await pay({
                kind: "topup",
                billerCode: operator.code,
                reference: phone,
                amount,
                topupType: rcType.value,
            });
        } catch (err) {
            payFailed(err, "No se pudo hacer la recarga.");
            setBusy(button, false);
            return;
        }
        setBusy(button, false);

        showSuccess(
            "Recarga exitosa",
            [
                ["Comprobante", receiptNumber(payment)],
                ["Operador", operator.name],
                ["Número", phone],
                ["Tipo", payment.topupType || rcType.value],
                ["Valor", formatMoney(payment.amount)],
                ["Fecha", formatDate(payment.updatedAt || new Date(), { dateStyle: "medium", timeStyle: "short" })],
            ],
            payment
        );

        rcNumber.value = "";
        rcAmount.value = "";
        refresh();
    });

    // -----------------------------------------------------
    // NÚMEROS RECIENTES
    // -----------------------------------------------------

    const recentBox = byId("recentNumbers");

    function renderRecentNumbers() {
        const seen = new Map();
        state.payments
            .filter(payment => payment.kind === "topup")
            .forEach(payment => {
                if (!seen.has(payment.reference)) seen.set(payment.reference, payment);
            });

        const list = [...seen.values()].slice(0, 5);

        if (!list.length) {
            recentBox.innerHTML =
                '<p class="pay-empty">Los números que recargues aparecerán aquí para repetir la recarga con un toque.</p>';
            return;
        }

        recentBox.innerHTML = list
            .map(
                payment => `
            <button type="button" class="pay-item-main pay-number" data-phone="${escapeHTML(payment.reference)}" data-op="${escapeHTML(payment.billerCode)}">
                <span class="pay-item-icon">${PHONE_ICON}</span>
                <span class="pay-item-info">
                    <strong>${escapeHTML(formatPhone(payment.reference))}</strong>
                    <small>${escapeHTML(payment.billerName || "Operador")}</small>
                </span>
                <span class="pay-item-tag">Recargar</span>
            </button>`
            )
            .join("");
    }

    recentBox.addEventListener("click", event => {
        const item = event.target.closest("[data-phone]");
        if (!item) return;
        rcNumber.value = item.dataset.phone;
        selectOperator(item.dataset.op);
        rcAmount.focus();
    });

    // -----------------------------------------------------
    // CARGAR Y PINTAR TODO
    // -----------------------------------------------------

    async function loadCatalog() {
        try {
            const catalog = await BlApi.authed(api, "GET", "/payments/billers");
            state.services = catalog.services || [];
            state.billers = catalog.billers || [];
            if (catalog.topup) state.topup = catalog.topup;
        } catch (err) {
            fail(err, "No se pudo cargar el catálogo de empresas.");
            return;
        }
        renderServices();
        selectService(state.services[0]?.key);
        renderOperators();
    }

    async function refresh() {
        await Promise.all([
            loadAccount(),
            BlApi.authed(api, "GET", "/payments")
                .then(list => {
                    state.payments = list || [];
                })
                .catch(err => {
                    BlApi.handleAuthError(err);
                }),
            BlApi.authed(api, "GET", "/payments/saved-bills")
                .then(list => {
                    state.saved = list || [];
                })
                .catch(err => {
                    BlApi.handleAuthError(err);
                }),
        ]);
        renderSavedBills();
        renderHistory("lastBills", "bill", "Aún no has pagado facturas.");
        renderHistory("lastRecharges", "topup", "Aún no has hecho recargas.");
        renderRecentNumbers();
    }

    loadCatalog();
    refresh();
});
