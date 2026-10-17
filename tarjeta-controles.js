// =========================================================
// BANKLITE - CONTROLES DE LA TARJETA (dashboard, "Control de la tarjeta")
// Mismo diseño y comportamiento que la versión simulada, contra card-service:
//   GET   /cards/:id/controls               compras por internet, límite y uso de hoy
//   PATCH /cards/:id/controls/online        interruptor de compras por internet
//   PATCH /cards/:id/controls/daily-limit   límite diario (clave dinámica escrita por el cliente)
//   POST  /cards/:id/purchases              compra con la tarjeta (cobro real en el ledger)
// Todas las reglas (congelada, internet, límite, saldo) las valida el servidor;
// aquí solo se pintan. La tarjeta llega de dashboard.js con 'banklite:card'.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('cardOnlineSwitch') || !BlApi.hasSession()) return;

    const { config } = BlApi;
    const $ = id => document.getElementById(id);
    const api = (method, path, body) => BlApi.authed(config.cardApi, method, path, body);
    const money = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v) || 0);
    const short = v => v >= 1_000_000 ? `$ ${String(v / 1_000_000).replace('.', ',')} M` : `$ ${Math.round(v / 1000)} mil`;

    let card = null;
    let controls = null;
    let stores = null;
    let purchaseKey = null;   // una por intento: un doble clic reusa la misma

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        if (/clave dinámica/i.test(err?.message || '')) {
            showMessage('No se pudo validar la clave dinámica', err.message, '!');
            return;
        }
        toast(err?.message || fallback, 'err');
    }

    async function dynamicCode() {
        const { code } = await BlApi.authed(config.authApi, 'GET', '/auth/dynamic-key');
        return code;
    }


    // -----------------------------------------------------
    // PINTAR
    // -----------------------------------------------------

    function paint() {
        const ready = !!(card && controls);
        $('cardOnlineSwitch').disabled = !ready;
        $('editCardLimit').disabled = !ready;
        if (!ready) return;

        $('cardOnlineSwitch').checked = controls.onlineEnabled;
        setText('cardLimitValue', money(controls.dailyLimit));
        // dailyLimit ya es el que se aplica: el menor entre el de la tarjeta y el de la cuenta.
        setText('cardLimitUsed', `Usado hoy: ${money(controls.usedToday)} · Disponible: ${money(controls.availableToday)}`
            + (controls.cappedByAccount ? ' · Tope del límite diario de tu cuenta' : ''));
        const percent = controls.dailyLimit ? Math.min((controls.usedToday / controls.dailyLimit) * 100, 100) : 0;
        const bar = $('cardLimitBar');
        bar.style.width = `${percent}%`;
        bar.classList.toggle('is-high', percent >= 80);

        // Nota bajo la tarjeta, como en la versión simulada.
        if (!$('cardStatusNote').dataset.cvvNote) {
            const frozen = card.status !== 'active';
            $('cardStatusNote').textContent = frozen
                ? 'Tu tarjeta está congelada. No se aprobará ninguna compra hasta que la descongeles.'
                : controls.onlineEnabled
                    ? 'Tarjeta débito Banklite para compras físicas y online.'
                    : 'Tarjeta activa solo para compras en tiendas físicas.';
        }
    }

    async function loadControls() {
        if (!card) return;
        try {
            controls = await api('GET', `/cards/${card.id}/controls`);
        } catch (err) {
            controls = null;
            setText('cardLimitValue', '—');
            setText('cardLimitUsed', 'No se pudieron cargar los controles de la tarjeta.');
            fail(err, 'No se pudieron cargar los controles de la tarjeta.');
        }
        paint();
    }

    document.addEventListener('banklite:card', event => {
        const next = event.detail || null;
        const changed = !card || !next || card.id !== next.id || card.status !== next.status;
        card = next;
        // El CVV recién emitido tiene su propio aviso: no se tapa.
        $('cardStatusNote').dataset.cvvNote = next?.justIssued ? '1' : '';
        if (!card) { controls = null; return paint(); }
        if (changed) loadControls(); else paint();
    });


    // -----------------------------------------------------
    // COMPRAS POR INTERNET
    // -----------------------------------------------------

    $('cardOnlineSwitch').addEventListener('change', async event => {
        if (!card) return;
        const enabled = event.target.checked;
        event.target.disabled = true;
        try {
            controls = await api('PATCH', `/cards/${card.id}/controls/online`, { enabled });
            toast(enabled ? 'Compras por internet activadas.' : 'Compras por internet desactivadas.', 'ok');
        } catch (err) {
            event.target.checked = !enabled;
            fail(err, 'No se pudo cambiar el ajuste.');
        } finally {
            paint();
        }
    });


    // -----------------------------------------------------
    // LÍMITE DIARIO (deslizador, montos rápidos y clave dinámica)
    // -----------------------------------------------------

    const range = $('limitRange');
    const limitKey = initPinBoxes($('limitKeyBoxes'));

    function paintRange() {
        setText('limitPreview', money(Number(range.value)));
        const span = Number(range.max) - Number(range.min);
        const percent = span > 0 ? ((range.value - range.min) / span) * 100 : 100;
        range.style.setProperty('background', `linear-gradient(90deg, var(--primary) ${percent}%, var(--primary-soft) ${percent}%)`, 'important');
    }

    $('editCardLimit').addEventListener('click', async () => {
        if (!card) return;
        // Se recarga para tener el máximo vigente (el límite diario de la cuenta).
        await loadControls();
        if (!controls) return;
        if (!controls.maxLimit) {
            return toast('No pudimos consultar el límite de tu cuenta. Inténtalo en un momento.', 'err');
        }
        const min = controls.minLimit;
        const max = controls.maxLimit;
        range.min = String(min);
        range.max = String(max);
        range.step = String(Math.min(100000, Math.max(max - min, 1)));
        range.value = String(Math.min(Math.max(controls.dailyLimit, min), max));
        setText('limitMinLabel', short(min));
        setText('limitMaxLabel', short(max));
        $('limitHint').innerHTML = `Es lo máximo que puedes gastar con tu tarjeta en un día. Puedes elegir entre <b>${escapeHTML(money(min))}</b> y <b>${escapeHTML(money(max))}</b>, el límite diario de tu cuenta.`;

        const chips = [500000, 1000000, 2000000, 5000000].filter(v => v >= min && v <= max);
        if (!chips.includes(max)) chips.push(max);
        $('limitChips').innerHTML = chips
            .map(v => `<button type="button" data-limit="${v}">${escapeHTML(short(v).replace(' mil', 'K'))}</button>`)
            .join('');
        paintRange();
        limitKey.clear();
        openModal('limitModal');
    });

    range.addEventListener('input', paintRange);

    $('limitChips').addEventListener('click', event => {
        const chip = event.target.closest('[data-limit]');
        if (!chip) return;
        range.value = chip.dataset.limit;
        paintRange();
    });

    $('limitForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!card) return;
        if (!limitKey.isComplete()) {
            limitKey.error();
            limitKey.focus();
            return toast('Escribe los 6 dígitos de tu clave dinámica.', 'err');
        }
        const dailyLimit = Number(range.value);
        const button = $('limitSubmit');
        button.disabled = true;
        try {
            controls = await api('PATCH', `/cards/${card.id}/controls/daily-limit`, { dailyLimit, dynamicCode: limitKey.value() });
            closeModalById('limitModal');
            toast(`Límite diario: ${money(controls.dailyLimit)}.`, 'ok');
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            // Clave incorrecta, vencida o bloqueada: se queda en el modal para intentarlo de nuevo.
            if (/clave dinámica/i.test(err?.message || '')) {
                limitKey.clear();
                limitKey.error();
                limitKey.focus();
                toast(err.message, 'err');
            } else {
                fail(err, 'No se pudo cambiar el límite.');
            }
        } finally {
            button.disabled = false;
            paint();
        }
    });


    // -----------------------------------------------------
    // SIMULAR COMPRA (se cobra de verdad: saldo, límites y controles)
    // -----------------------------------------------------

    const CHANNEL_LABEL = { in_store: 'tienda física', online: 'por internet' };

    $('simulatePurchase').addEventListener('click', async () => {
        if (!card) return toast('Primero emite tu tarjeta virtual.', 'err');
        if (!stores) {
            try {
                stores = await api('GET', '/cards/purchase-stores');
            } catch (err) {
                return fail(err, 'No se pudieron cargar los comercios.');
            }
            $('purchaseStore').innerHTML = stores
                .flatMap(store => store.channels.map(channel =>
                    `<option value="${escapeHTML(store.code)}" data-channel="${escapeHTML(channel)}">${escapeHTML(store.name)} · ${CHANNEL_LABEL[channel] || channel}</option>`))
                .join('');
        }
        $('purchaseForm').reset();
        purchaseKey = null;
        openModal('purchaseModal');
    });

    $('purchaseAmount').addEventListener('input', event => {
        const digits = event.target.value.replace(/\D/g, '').slice(0, 9);
        event.target.value = digits ? Number(digits).toLocaleString('es-CO') : '';
        purchaseKey = null;   // otro valor es otro intento
    });

    $('purchaseStore').addEventListener('change', () => { purchaseKey = null; });

    $('purchaseForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!card) return;
        const select = $('purchaseStore');
        const option = select.selectedOptions[0];
        const amount = Number($('purchaseAmount').value.replace(/\D/g, '')) || 0;
        if (!option) return toast('Elige un comercio.', 'err');
        if (amount < 1000) return toast('Escribe un valor de al menos $1.000.', 'err');

        const storeName = option.textContent.split(' · ')[0];
        const button = $('purchaseSubmit');
        button.disabled = true;
        purchaseKey = purchaseKey || crypto.randomUUID();
        try {
            const result = await api('POST', `/cards/${card.id}/purchases`, {
                storeCode: option.value,
                channel: option.dataset.channel,
                amount,
                idempotencyKey: purchaseKey,
                dynamicCode: await dynamicCode(),
            });
            purchaseKey = null;
            closeModalById('purchaseModal');
            if (result.status === 'approved') {
                toast(`Compra aprobada en ${storeName}: ${money(amount)}.`, 'ok');
                document.dispatchEvent(new CustomEvent('banklite:account-changed'));
            } else {
                showMessage('Compra rechazada', `${storeName} · ${money(amount)}\n\n${result.reason || 'La compra no fue aprobada.'}`, '!');
            }
            await loadControls();
        } catch (err) {
            fail(err, 'No se pudo hacer la compra.');
        } finally {
            button.disabled = false;
        }
    });
});
