// =========================================================
// BANKLITE - TRANSFERIR (transferir.html)
// Entre cuentas Banklite: POST /transfers/prepare → /:id/confirm
// (o /:id/cancel). Al confirmar, la app adjunta sola la clave dinámica vigente
// (GET /auth/dynamic-key) y transfer-service la valida con auth-service: la
// persona no la escribe. El comprobante sale del movimiento real del ledger.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('transferForm');
    if (!form) return;
    if (!BlApi.protectPage()) return;

    const { config, session } = BlApi;
    const $ = id => document.getElementById(id);
    const ACCOUNT_TYPES = { savings: 'Cuenta de ahorros', checking: 'Cuenta corriente' };
    const state = { step: 1, account: null, balance: null, limits: null, kyc: null, pending: null, done: null };

    const money = (v, currency = state.account?.currency || 'COP') =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: currency === 'COP' ? 0 : 2 }).format(Number(v) || 0);
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    const formatAccount = n => (n || '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3');

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage('No se pudo completar', err?.message || fallback, '!');
    }

    function setLoading(button, loading) {
        button.disabled = loading;
        if (loading) { button.dataset.label = button.innerHTML; button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Procesando…'; }
        else if (button.dataset.label) button.innerHTML = button.dataset.label;
    }

    // ---------- cuenta de origen ----------
    async function loadAccount() {
        try {
            const accounts = await BlApi.authed(config.accountApi, 'GET', '/accounts');
            const usable = (accounts || []).filter(a => a.status !== 'closed');
            state.account = usable.find(a => a.id === session.accountId) || usable[0] || null;
            if (!state.account) {
                $('availableTransfer').textContent = '—';
                showMessage('Sin cuenta', 'Primero debes abrir una cuenta Banklite desde el inicio.', '!');
                $('nextTransfer').disabled = true;
                return;
            }
            session.accountId = state.account.id;
            const [balance, limits] = await Promise.all([
                BlApi.authed(config.ledgerApi, 'GET', `/ledger/accounts/${state.account.id}/balance`),
                BlApi.authed(config.accountApi, 'GET', `/accounts/${state.account.id}/limits`),
            ]);
            Object.assign(state, { balance, limits });
            $('availableTransfer').textContent = money(balance.balance, balance.currency);
            $('limitHint').textContent = `Se descuenta de tu saldo disponible. Límite diario: ${money(limits.dailyLimit)}.`;
            if (state.account.status !== 'active') {
                showMessage('Cuenta no disponible', 'Tu cuenta no está activa, por eso no puedes transferir.', '!');
                $('nextTransfer').disabled = true;
            }
        } catch (err) { fail(err, 'No se pudo cargar tu cuenta.'); }
        BlApi.authed(config.kycApi, 'GET', `/kyc/${session.idUser}`).then(k => { state.kyc = k; }).catch(() => {});
    }

    // ---------- pasos: 1 entidad, 2 destinatario, 3 monto, 4 verificar ----------
    const steps = [...form.querySelectorAll('.transfer-step')];
    const indicators = [...document.querySelectorAll('.stepper .step')];

    function goTo(step) {
        state.step = step;
        steps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === step));
        indicators.forEach((s, i) => {
            s.classList.toggle('active', i + 1 === step);
            s.classList.toggle('complete', i + 1 < step);
        });
        $('prevTransfer').style.visibility = step === 1 ? 'hidden' : 'visible';
        $('nextTransfer').textContent = step === 4 ? 'Enviar' : 'Continuar';
        if (step === 2) setTimeout(() => $('accountNumber').focus(), 60);
        if (step === 3) setTimeout(() => $('transferAmount').focus(), 60);
        if (step === 4) paintReview();
    }

    // Solo Banklite está disponible; las demás entidades están en "Próximamente".
    const bankliteOption = form.querySelector('.bank-option[data-bank="Banklite"]');
    bankliteOption.addEventListener('click', () => {
        bankliteOption.classList.add('selected');
        goTo(2);
    });

    $('accountNumber').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11); });

    const amountInput = $('transferAmount');
    const paintAmount = () => { $('amountPreview').textContent = money(amountInput.value); };
    amountInput.addEventListener('input', paintAmount);
    form.querySelectorAll('[data-amount]').forEach(chip => chip.addEventListener('click', () => {
        amountInput.value = chip.dataset.amount;
        paintAmount();
    }));

    function destination() { return $('accountNumber').value.trim(); }
    function amount() { return Number(amountInput.value); }

    function paintReview() {
        $('recipientInitials').textContent = 'B';
        $('recipientPreview').textContent = 'Cuenta Banklite';
        $('recipientAccountPreview').textContent = formatAccount(destination());
        $('recipientAmountPreview').textContent = money(amount());
        const after = (Number(state.balance?.balance) || 0) - amount();
        $('transferSummary').innerHTML = '';
        [
            ['Desde', `${ACCOUNT_TYPES[state.account?.accountType] || 'Cuenta'} ···· ${String(state.account?.accountNumber || '').slice(-4)}`],
            ['Costo de la transacción', money(0)],
            ['Saldo después del envío', money(after)],
        ].forEach(([label, value]) => {
            const row = document.createElement('div');
            row.innerHTML = '<span></span><strong></strong>';
            row.querySelector('span').textContent = label;
            row.querySelector('strong').textContent = value;
            $('transferSummary').appendChild(row);
        });
    }

    function validate(step) {
        if (step === 2) {
            if (!/^\d{11}$/.test(destination())) return 'El número de cuenta destino debe tener 11 dígitos.';
            if (destination() === state.account?.accountNumber) return 'La cuenta destino debe ser diferente a tu cuenta.';
        }
        if (step === 3) {
            if (!Number.isFinite(amount()) || amount() <= 0) return 'Ingresa un monto válido.';
            if (state.balance && amount() > Number(state.balance.balance)) return 'El monto supera tu saldo disponible.';
        }
        return null;
    }

    $('prevTransfer').addEventListener('click', () => { if (state.step > 1) goTo(state.step - 1); });
    $('nextTransfer').addEventListener('click', async () => {
        if (state.step === 1) return bankliteOption.click();
        const problem = validate(state.step);
        if (problem) return toast(problem, 'err');
        if (state.step < 4) return goTo(state.step + 1);
        await prepare();
    });

    // ---------- preparar → confirmar / cancelar ----------
    async function prepare() {
        const button = $('nextTransfer');
        setLoading(button, true);
        try {
            state.pending = await BlApi.authed(config.transferApi, 'POST', '/transfers/prepare', {
                sourceAccountId: state.account.id,
                destinationAccountNumber: destination(),
                amount: amount(),
                description: $('concept').value.trim() || undefined,
                idempotencyKey: uuid(),
            });
            const box = $('confirmTransferContent');
            box.replaceChildren();
            [
                ['Cuenta destino', `Banklite ${formatAccount(state.pending.destinationAccountNumber)}`],
                ['Valor', money(state.pending.amount)],
                ['Concepto', state.pending.description || 'Transferencia'],
                ['Desde', `···· ${String(state.account.accountNumber).slice(-4)}`],
            ].forEach(([label, value]) => {
                const row = document.createElement('div');
                row.innerHTML = '<span></span><strong></strong>';
                row.querySelector('span').textContent = label;
                row.querySelector('strong').textContent = value;
                box.appendChild(row);
            });
            openModal('transferConfirmModal');
        } catch (err) { fail(err, 'No se pudo preparar la transferencia.'); }
        finally { setLoading(button, false); }
    }

    // "Corregir" o cerrar la confirmación cancela la solicitud pendiente.
    async function cancelPending() {
        const pending = state.pending;
        state.pending = null;
        if (!pending?.id) return;
        try { await BlApi.authed(config.transferApi, 'POST', `/transfers/${pending.id}/cancel`, {}); }
        catch (err) { if (!BlApi.handleAuthError(err)) toast(err.message || 'No se pudo cancelar la solicitud.', 'err'); }
    }
    $('transferConfirmModal').querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', cancelPending));

    $('confirmTransfer').addEventListener('click', async () => {
        if (!state.pending) return;
        const button = $('confirmTransfer');
        setLoading(button, true);
        try {
            // Validación interna: se pide la clave vigente y se envía con la confirmación.
            const { code } = await BlApi.authed(config.authApi, 'GET', '/auth/dynamic-key');
            const result = await BlApi.authed(config.transferApi, 'POST', `/transfers/${state.pending.id}/confirm`, {
                dynamicCode: code,
            });
            state.done = result;
            state.pending = null;
            closeModalById('transferConfirmModal');
            await showSuccess(result);
            await loadAccount();
        } catch (err) {
            // Clave dinámica bloqueada o no validada: la solicitud sigue pendiente.
            if (/clave dinámica/i.test(err?.message || '')) {
                showMessage('No se pudo validar la clave dinámica', err.message, '!');
                return;
            }
            fail(err, 'No se pudo realizar la transferencia.');
        } finally { setLoading(button, false); }
    });

    // Comprobante: el movimiento real del ledger para esta transacción.
    async function findMovement(transactionId) {
        if (!transactionId) return null;
        try {
            const recent = await BlApi.authed(config.ledgerApi, 'GET', `/ledger/accounts/${state.account.id}/transactions?limit=20`);
            return recent.find(m => m.transactionId === transactionId) || null;
        } catch { return null; }
    }

    async function showSuccess(result) {
        const movement = await findMovement(result.ledgerTransactionId);
        state.done.movement = movement;
        const box = $('successTransferContent');
        box.replaceChildren();
        [
            ['Valor', money(result.amount)],
            ['Cuenta destino', `Banklite ${formatAccount(result.destinationAccountNumber)}`],
            ['Concepto', result.description || 'Transferencia'],
            ['Fecha', formatDate(movement?.createdAt || new Date(), { dateStyle: 'long', timeStyle: 'short' })],
            ['N.º de operación', String(result.ledgerTransactionId || result.id).slice(0, 8).toUpperCase()],
        ].forEach(([label, value]) => {
            const row = document.createElement('div');
            row.innerHTML = '<span></span><strong></strong>';
            row.querySelector('span').textContent = label;
            row.querySelector('strong').textContent = value;
            box.appendChild(row);
        });
        $('downloadReceipt').hidden = !movement;
        openModal('transferSuccessModal');
    }

    $('downloadReceipt').addEventListener('click', () => {
        const movement = state.done?.movement;
        if (!movement) return;
        const k = state.kyc || {};
        downloadReceipt(movement, {
            name: k.nombres ? `${k.nombres} ${k.apellidos || ''}`.trim() : 'Cliente Banklite',
            accountType: ACCOUNT_TYPES[state.account.accountType] || 'Cuenta',
            accountNumber: state.account.accountNumber,
        });
        toast('Comprobante descargado.', 'ok');
    });

    // "Hacer otra transferencia": empieza de cero.
    $('transferSuccessModal').querySelector('[data-close]')?.addEventListener('click', () => {
        form.reset();
        bankliteOption.classList.remove('selected');
        paintAmount();
        goTo(1);
    });

    goTo(1);
    loadAccount();
});
