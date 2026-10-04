// =========================================================
// BANKLITE - DASHBOARD (dashboard.html)
// Datos reales: /kyc, /accounts (+limits), /ledger (saldo y resumen del
// mes), /cards (emitir, reveal, congelar),
// /notifications y cambio de clave con /auth/password-recovery.
// Usa BlApi (api.js) y las utilidades visuales de java.js.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('main.dashboard')) return;
    if (!BlApi.protectPage()) return;
    BankliteDynamicKey.mount();

    const { config, session } = BlApi;
    const get = (base, path) => BlApi.authed(base, 'GET', path);
    const send = (base, method, path, body) => BlApi.authed(base, method, path, body);
    const $ = id => document.getElementById(id);

    // Menú lateral, vistas (#tarjetas, #ahorro, #suscripciones) y carrusel del diseño.
    initSidebar();
    initDashboardViews();
    initFeatureCarousel();

    const state = {
        kyc: null,
        account: null,
        limits: null,
        balance: null,
        movements: [],
        monthMovements: [],
        cards: [],
        card: null,
        issued: {},       // CVV y número completo de la tarjeta recién emitida (solo en memoria)
        revealed: null,   // número completo revelado (se oculta solo)
        showAccount: false,
        notifications: [],
    };

    const TYPE_LABELS = { savings: 'Cuenta de ahorros', checking: 'Cuenta corriente' };
    const STATUS_LABELS = { pending: 'Pendiente', active: 'Activa', blocked: 'Bloqueada', closed: 'Cerrada' };
    const DOC_NAMES = { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', PA: 'Pasaporte' };

    const money = (value, currency = state.account?.currency || 'COP') =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: currency === 'COP' ? 0 : 2 }).format(Number(value) || 0);
    const formatAccount = n => (n || '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3');
    const maskAccount = n => (n ? `••• •••• ${n.slice(-4)}` : '—');
    const fullName = () => (state.kyc ? `${state.kyc.nombres || ''} ${state.kyc.apellidos || ''}`.trim() : '');
    const htmlToText = value => new DOMParser().parseFromString(String(value ?? ''), 'text/html').body.textContent || '';
    const longDate = value => {
        if (!value) return '—';
        const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
        if (!y || !m || !d) return String(value);
        return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
    };

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        toast(err?.message || fallback, 'err');
    }

    function setLoading(button, loading, label) {
        button.disabled = loading;
        if (loading) { button.dataset.label = button.innerHTML; button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Procesando…'; }
        else button.innerHTML = label || button.dataset.label || button.innerHTML;
    }

    // ---------- fecha ----------
    $('today').textContent = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date());
    $('spendingMonth').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);


    // =====================================================
    // IDENTIDAD (GET /kyc/:idUser)
    // =====================================================

    async function loadKyc() {
        try { state.kyc = await get(config.kycApi, `/kyc/${session.idUser}`); }
        catch (err) { if (BlApi.handleAuthError(err)) return; state.kyc = null; }
        const name = fullName();
        const first = state.kyc?.nombres?.split(/\s+/)[0] || 'cliente';
        $('helloName').textContent = first;
        $('headerName').textContent = name || 'Mi cuenta';
        $('avatar').textContent = initials(name || 'B');
        $('cardHolder').textContent = (name || 'TITULAR BANKLITE').toUpperCase();
    }


    // =====================================================
    // CUENTA, SALDO, LÍMITES Y MOVIMIENTOS
    // =====================================================

    async function findAccount() {
        const accounts = await get(config.accountApi, '/accounts');
        const usable = (accounts || []).filter(a => a.status !== 'closed');
        const remembered = usable.find(a => a.id === session.accountId);
        return remembered || usable[0] || null;
    }

    // Movimientos del mes en curso (hora de Colombia), paginando si hace falta.
    async function loadMonthMovements(accountId) {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 5)); // 00:00 en Bogotá = 05:00 UTC
        const all = [];
        for (let page = 1; page <= 10; page++) {
            const batch = await get(config.ledgerApi, `/ledger/accounts/${accountId}/transactions?from=${encodeURIComponent(start.toISOString())}&limit=100&page=${page}`);
            all.push(...batch);
            if (batch.length < 100) break;
        }
        return all;
    }

    async function loadAccount() {
        try {
            const account = await findAccount();
            state.account = account;
            session.accountId = account?.id || null;
            if (!account) return renderNoAccount();

            const [detail, limits, balance, recent, month] = await Promise.all([
                get(config.accountApi, `/accounts/${account.id}`),
                get(config.accountApi, `/accounts/${account.id}/limits`),
                get(config.ledgerApi, `/ledger/accounts/${account.id}/balance`),
                get(config.ledgerApi, `/ledger/accounts/${account.id}/transactions?limit=100`),
                loadMonthMovements(account.id),
            ]);
            Object.assign(state, { account: detail, limits, balance, movements: recent, monthMovements: month });
            renderAccount();
            renderSpending();
            renderFrequent();
        } catch (err) {
            fail(err, 'No se pudo cargar tu cuenta.');
        }
    }

    function renderNoAccount() {
        $('noAccountBox').hidden = false;
        $('accountInfo').hidden = true;
        $('accountLimits').hidden = true;
        $('accountStatusNote').hidden = true;
        $('toggleBalance').hidden = true;
        $('balanceValue').textContent = '—';
        $('certGroup').hidden = true;
        renderSpending();
        renderCards();
    }

    function renderAccount() {
        const { account, limits } = state;
        $('noAccountBox').hidden = true;
        $('accountInfo').hidden = false;
        $('toggleBalance').hidden = false;
        $('certGroup').hidden = false;
        $('accountType').textContent = `${TYPE_LABELS[account.accountType] || 'Cuenta'} · ${account.currency}`;

        $('accountLimits').hidden = !limits;
        if (limits) {
            $('dailyLimit').textContent = money(limits.dailyLimit);
            $('monthlyLimit').textContent = money(limits.monthlyLimit);
        }

        const notes = {
            pending: 'Tu cuenta se activa en cuanto se confirme tu identidad.',
            blocked: account.blockedBy === 'bank' ? 'El banco bloqueó tu cuenta. Comunícate con soporte.' : 'Tu cuenta está bloqueada.',
        };
        $('accountStatusNote').hidden = !notes[account.status];
        $('accountStatusNote').textContent = notes[account.status] || '';
        paintBalance();
    }

    // El ojo oculta el saldo y el número de cuenta (por defecto, ocultos).
    function paintBalance() {
        const { account, balance } = state;
        if (!account || !balance) return;
        const visible = state.showAccount;
        $('balanceValue').textContent = visible ? money(balance.balance, balance.currency) : `•••••• ${balance.currency}`;
        $('balanceValue').dataset.visible = String(visible);
        $('accountNumberShown').textContent = visible ? formatAccount(account.accountNumber) : maskAccount(account.accountNumber);
        const toggle = $('toggleBalance');
        toggle.setAttribute('aria-pressed', String(visible));
        toggle.setAttribute('aria-label', visible ? 'Ocultar saldo y número de cuenta' : 'Mostrar saldo y número de cuenta');
        toggle.innerHTML = visible
            ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/></svg>'
            : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>';
    }
    $('toggleBalance').addEventListener('click', () => { state.showAccount = !state.showAccount; paintBalance(); });

    // Resumen mensual: solo datos del ledger (salidas por tipo y entradas del mes).
    function renderSpending() {
        const donut = $('spendingDonut');
        const totals = { transfer: 0, debit: 0, income: 0 };
        for (const m of state.monthMovements) {
            if (m.direction === 'in') totals.income += Number(m.amount) || 0;
            else if (m.type === 'transfer') totals.transfer += Number(m.amount) || 0;
            else totals.debit += Number(m.amount) || 0;
        }
        const out = totals.transfer + totals.debit;
        const compact = v => compactMoney(v);
        $('spentValue').textContent = state.account ? compact(out) : '—';
        $('spentTransfer').textContent = state.account ? compact(totals.transfer) : '—';
        $('spentDebit').textContent = state.account ? compact(totals.debit) : '—';
        $('spentIncome').textContent = state.account ? compact(totals.income) : '—';

        if (!out) {
            donut.style.background = 'var(--border-light)';
            donut.setAttribute('aria-label', 'Aún no tienes salidas este mes');
            return;
        }
        const a = (totals.transfer / out) * 100;
        donut.style.background = `conic-gradient(var(--primary) 0 ${a}%, var(--dark) ${a}% 100%)`;
        donut.setAttribute('aria-label', `Salidas del mes: transferencias ${Math.round(a)}%, cargos ${Math.round(100 - a)}%`);
    }

    // Cuentas a las que más se ha transferido (el ledger solo da los últimos 4 dígitos).
    function renderFrequent() {
        const counts = new Map();
        for (const m of state.movements) {
            if (m.type !== 'transfer' || m.direction !== 'out' || !m.counterpartyAccountLast4) continue;
            const entry = counts.get(m.counterpartyAccountLast4) || { last4: m.counterpartyAccountLast4, uses: 0 };
            entry.uses += 1;
            counts.set(m.counterpartyAccountLast4, entry);
        }
        const top = [...counts.values()].sort((a, b) => b.uses - a.uses).slice(0, 4);
        $('frequentContacts').hidden = !top.length;
        const list = $('frequentList');
        list.replaceChildren();
        top.forEach(c => {
            const a = document.createElement('a');
            a.className = 'frequent-item';
            a.href = 'transferir.html';
            a.innerHTML = '<span class="contact-avatar" aria-hidden="true"></span><span class="contact-info"><strong></strong><small></small></span>';
            a.querySelector('.contact-avatar').textContent = c.last4.slice(-2);
            a.querySelector('strong').textContent = `Cuenta ····${c.last4}`;
            a.querySelector('small').textContent = `${c.uses} ${c.uses === 1 ? 'envío' : 'envíos'}`;
            list.appendChild(a);
        });
    }


    // =====================================================
    // ABRIR CUENTA
    // =====================================================

    $('openAccountBtn').addEventListener('click', () => openModal('accountTypeModal'));

    $('createAccountBtn').addEventListener('click', async () => {
        const button = $('createAccountBtn');
        const accountType = document.querySelector('input[name="dashAccountType"]:checked')?.value || 'savings';
        const currency = $('accountCurrency').value;
        setLoading(button, true);
        try {
            const account = await send(config.accountApi, 'POST', '/accounts/create', { idUser: session.idUser, currency, accountType });
            session.accountId = account.id;
            closeModalById('accountTypeModal');
            toast('Cuenta creada correctamente.', 'ok');
            await loadAccount();
            await loadCards();
        } catch (err) {
            fail(err, 'No se pudo abrir la cuenta.');
        } finally { setLoading(button, false, 'Abrir cuenta'); }
    });


    // =====================================================
    // TARJETA (GET/POST /cards, reveal, PATCH status)
    // =====================================================

    async function loadCards() {
        try {
            state.cards = await get(config.cardApi, '/cards');
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            state.cards = [];
            toast(err.message || 'No se pudieron cargar tus tarjetas.', 'err');
        }
        state.card = state.cards.find(c => c.accountId === state.account?.id) || state.cards[0] || null;
        renderCards();
    }

    function renderCards() {
        const card = state.card;
        $('noCardBox').hidden = !!card;
        $('cardLayout').hidden = !card;
        $('toggleCardNumber').hidden = !card;
        if (!card) {
            const canIssue = !!state.account && state.account.status === 'active';
            $('issueCardBtn').disabled = !canIssue;
            $('noCardText').textContent = canIssue
                ? 'Todavía no tienes tarjeta. Emítela gratis y úsala de inmediato.'
                : 'Para emitir tu tarjeta necesitas una cuenta Banklite activa.';
            return;
        }
        const issued = state.issued[card.id];
        const full = issued?.cardNumber || state.revealed;
        $('cardNumber').textContent = full
            ? full.replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 ')
            : `•••• •••• •••• ${card.lastFour}`;
        $('cardExp').textContent = `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`;
        $('cardCvv').textContent = issued?.cvv || '•••';
        $('cardStatusNote').textContent = issued
            ? 'Guarda el CVV ahora: solo se muestra en esta sesión y no se guarda.'
            : 'El CVV solo se muestra al emitir la tarjeta y no se guarda.';
        const frozen = card.status !== 'active';
        $('realCard').classList.toggle('is-locked', frozen);
        $('cardStateChip').textContent = frozen ? 'Congelada' : 'Activa';
        $('cardLockSwitch').checked = frozen;
        $('cardAccount').textContent = `Cuenta ····${String(card.accountNumber).slice(-4)} · ${card.currency}`;
        $('toggleCardNumber').textContent = full && !issued ? 'Ocultar número' : 'Mostrar número';
        $('toggleCardNumber').hidden = !!issued;
    }

    $('issueCardBtn').addEventListener('click', async () => {
        if (!state.account) return toast('Primero debes abrir una cuenta Banklite activa.', 'err');
        const button = $('issueCardBtn');
        setLoading(button, true);
        try {
            const result = await send(config.cardApi, 'POST', '/cards', { accountId: state.account.id });
            if (result.cardNumber && result.cvv) {
                state.issued[result.id] = { cardNumber: result.cardNumber, cvv: result.cvv };
                toast('Tarjeta emitida. Guarda el CVV: solo se muestra ahora.', 'ok', 6000);
            } else {
                toast('Ya habías emitido tu tarjeta virtual.', 'info');
            }
            await loadCards();
        } catch (err) {
            fail(err, 'No se pudo emitir la tarjeta.');
        } finally { setLoading(button, false, 'Emitir tarjeta virtual'); }
    });

    let hideTimer = null;
    $('toggleCardNumber').addEventListener('click', async () => {
        const card = state.card;
        if (!card) return;
        if (state.revealed) {
            state.revealed = null;
            clearTimeout(hideTimer);
            return renderCards();
        }
        try {
            const details = await get(config.cardApi, `/cards/${card.id}/reveal`);
            state.revealed = details.cardNumber;
            renderCards();
            // Por seguridad, el número se oculta solo a los 20 segundos.
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { state.revealed = null; renderCards(); }, 20000);
        } catch (err) {
            fail(err, 'No se pudo mostrar el número de la tarjeta.');
        }
    });

    $('cardLockSwitch').addEventListener('change', async event => {
        const card = state.card;
        if (!card) return;
        const freeze = event.target.checked;
        try {
            await send(config.cardApi, 'PATCH', `/cards/${card.id}/status`, { status: freeze ? 'frozen' : 'active' });
            toast(freeze ? 'Tarjeta congelada.' : 'Tarjeta activa de nuevo.', 'ok');
            await loadCards();
        } catch (err) {
            event.target.checked = !freeze;
            fail(err, 'No se pudo actualizar la tarjeta.');
        }
    });


    // =====================================================
    // NOTIFICACIONES (GET /notifications/:idUser, PUT /:id/read)
    // =====================================================

    const NOTIF_ICON = {
        income: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 7 7 17"/><path d="M17 17H7V7"/></svg>',
        expense: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>',
        notice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>',
    };

    async function loadNotifications() {
        try {
            state.notifications = await get(config.notificationApi, `/notifications/${session.idUser}?channel=in_app`);
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            state.notifications = []; // notification-service apagado: no se rompe el resto
        }
        updateDot();
    }

    function updateDot() {
        const dot = document.querySelector('#notifications i');
        if (dot) dot.hidden = !state.notifications.some(n => !n.read);
    }

    function notifKind(n) {
        const text = `${n.event} ${n.title}`.toLowerCase();
        if (/recib|entrada|abono|consign|deposit/.test(text)) return 'income';
        if (/envia|enviaste|salida|transferencia|cargo/.test(text)) return 'expense';
        return 'notice';
    }

    function renderNotifications() {
        const list = $('notifList');
        list.replaceChildren();
        if (!state.notifications.length) {
            list.innerHTML = '<li class="notif-empty">No tienes notificaciones todavía.</li>';
            return;
        }
        state.notifications.slice(0, 30).forEach(n => {
            const kind = notifKind(n);
            const li = document.createElement('li');
            li.className = n.read ? '' : 'is-new';
            li.innerHTML = `<span class="notif-icon ${kind}">${NOTIF_ICON[kind]}</span><div><strong></strong><p></p></div><time></time>`;
            // Título y cuerpo vienen del servidor: se insertan como texto, nunca como HTML.
            li.querySelector('strong').textContent = htmlToText(n.title);
            li.querySelector('p').textContent = htmlToText(n.body);
            li.querySelector('time').textContent = formatDate(n.createdAt);
            if (!n.read) {
                li.style.cursor = 'pointer';
                li.title = 'Marcar como leída';
                li.addEventListener('click', async () => {
                    try {
                        await send(config.notificationApi, 'PUT', `/notifications/${n.id}/read`);
                        n.read = true;
                        li.classList.remove('is-new');
                        updateDot();
                    } catch (err) { if (!BlApi.handleAuthError(err)) toast('No se pudo marcar como leída.', 'err'); }
                }, { once: true });
            }
            list.appendChild(li);
        });
    }

    $('notifications').addEventListener('click', async () => {
        await loadNotifications();
        renderNotifications();
        openModal('notifModal');
    });


    // =====================================================
    // PERFIL, MIS DATOS Y CERTIFICADO
    // =====================================================

    function openMyProfile() {
        const name = fullName();
        $('meAvatar').textContent = initials(name || 'B');
        $('meName').textContent = name || 'Cliente Banklite';
        $('meLine').textContent = [state.kyc?.email, state.account ? `Cuenta ${maskAccount(state.account.accountNumber)}` : null].filter(Boolean).join(' · ') || '—';
        openModal('myProfileModal');
    }

    function openProfileData() {
        const k = state.kyc || {};
        const name = fullName();
        $('profileAvatar').textContent = initials(name || 'B');
        $('profileTitle').textContent = name || 'Mis datos';
        const rows = [
            ['Nombres', k.nombres],
            ['Apellidos', k.apellidos],
            ['Tipo de documento', DOC_NAMES[k.tipoDocumento] || k.tipoDocumento],
            ['Número de documento', k.numeroDocumento],
            ['Fecha de nacimiento', k.fechaNacimiento ? longDate(k.fechaNacimiento) : null],
            ['Fecha de expedición', k.fechaExpedicion ? longDate(k.fechaExpedicion) : null],
            ['Correo', k.email],
            ['Celular', k.telefono],
            ['Producto', state.account ? `${TYPE_LABELS[state.account.accountType]} ${maskAccount(state.account.accountNumber)}` : null],
        ];
        const box = $('profileData');
        box.replaceChildren();
        rows.forEach(([label, value]) => {
            const row = document.createElement('div');
            row.innerHTML = '<span></span><strong></strong>';
            row.querySelector('span').textContent = label;
            row.querySelector('strong').textContent = value || 'No disponible';
            box.appendChild(row);
        });
        openModal('profileModal');
    }

    $('openMyProfile').addEventListener('click', event => { event.preventDefault(); openMyProfile(); });
    $('openSettings').addEventListener('click', event => { event.preventDefault(); openModal('settingsModal'); });
    $('openProfile').addEventListener('click', () => { closeModalById('myProfileModal'); openProfileData(); });
    const avatar = $('avatar');
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('tabindex', '0');
    avatar.setAttribute('aria-label', 'Ver mis datos');
    avatar.style.cursor = 'pointer';
    avatar.addEventListener('click', openProfileData);
    avatar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfileData(); } });

    const certCode = () => `CC-${(state.account?.accountNumber || '').slice(-4)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    function certInfo() {
        const k = state.kyc || {};
        const account = state.account;
        return {
            name: fullName() || 'Cliente Banklite',
            document: k.numeroDocumento ? `${k.tipoDocumento || 'CC'} ${k.numeroDocumento}` : 'No disponible',
            accountType: TYPE_LABELS[account.accountType] || 'Cuenta',
            account: account.accountNumber,
            accountFormatted: formatAccount(account.accountNumber),
            status: STATUS_LABELS[account.status] || account.status,
            opened: account.createdAt,
            currency: account.currency === 'COP' ? 'Pesos colombianos (COP)' : account.currency === 'USD' ? 'Dólares (USD)' : account.currency,
            balance: state.balance ? money(state.balance.balance, state.balance.currency) : 'No disponible',
        };
    }
    function paintCert() {
        const info = certInfo();
        $('certName').textContent = info.name;
        $('certDoc').textContent = info.document;
        $('certType').textContent = info.accountType;
        $('certAccount').textContent = info.accountFormatted;
        $('certStatus').textContent = info.status;
        $('certStatusChip').textContent = info.status;
        $('certOpened').textContent = formatDate(info.opened, { dateStyle: 'long' });
        $('certCurrency').textContent = info.currency;
        $('certBalance').textContent = info.balance;
        $('certToday').textContent = formatDate(new Date(), { dateStyle: 'long' });
        $('certCode').textContent = certCode();
        document.querySelector('#accountCertModal .cert-balance').hidden = !$('certIncludeBalance').checked;
    }
    $('openAccountCert').addEventListener('click', () => {
        if (!state.account) return;
        closeModalById('myProfileModal');
        paintCert();
        openModal('accountCertModal');
    });
    $('certIncludeBalance').addEventListener('change', paintCert);
    $('downloadAccountCert').addEventListener('click', () => {
        downloadAccountCertificate(certInfo(), $('certIncludeBalance').checked, certCode());
        toast('Certificado de cuenta descargado.', 'ok');
    });


    // =====================================================
    // CAMBIAR CLAVE (código por correo o WhatsApp)
    // =====================================================

    const pinModal = $('pinModal');
    const pinSteps = { send: pinModal.querySelector('[data-step="send"]'), reset: pinModal.querySelector('[data-step="reset"]') };
    const pinCode = initPinBoxes($('pinCode'));
    const pinNew = initPinBoxes(pinModal.querySelector('[data-pin-for="pinNew"]'));
    const pinConfirm = initPinBoxes(pinModal.querySelector('[data-pin-for="pinNewConfirm"]'));
    const pinFlow = { channel: 'email', timer: null };

    $('changePin').addEventListener('click', () => {
        closeModalById('myProfileModal');
        pinSteps.send.reset();
        [pinCode, pinNew, pinConfirm].forEach(b => b.clear());
        $('pinEmailHint').textContent = state.kyc?.email ? maskEmail(state.kyc.email) : 'Al correo registrado';
        showFlowStep(pinModal, 'send', 1);
        openModal('pinModal');
    });

    async function requestPinCode() {
        if (!state.kyc?.email) throw new Error('No encontramos el correo de tu cuenta.');
        await BlApi.api(config.authApi, 'POST', '/auth/password-recovery/send', { email: state.kyc.email, channel: pinFlow.channel });
        pinFlow.timer?.stop();
        pinFlow.timer = startCodeTimer($('pinTimer'), $('pinResend'));
    }

    pinSteps.send.addEventListener('submit', async event => {
        event.preventDefault();
        pinFlow.channel = pinSteps.send.querySelector('input[name="pinChannel"]:checked')?.value || 'email';
        const button = pinSteps.send.querySelector('button[type="submit"]');
        setLoading(button, true);
        try {
            await requestPinCode();
            showFlowStep(pinModal, 'reset', 2);
            toast(pinFlow.channel === 'email' ? 'Te enviamos un código a tu correo.' : 'Te enviamos un código por WhatsApp.', 'ok');
            setTimeout(() => pinCode.focus(), 80);
        } catch (err) { fail(err, 'No se pudo enviar el código.'); }
        finally { setLoading(button, false); }
    });

    $('pinResend').addEventListener('click', async () => {
        try { await requestPinCode(); toast('Te enviamos un código nuevo.', 'ok'); }
        catch (err) { fail(err, 'No se pudo reenviar el código.'); }
    });

    pinSteps.reset.addEventListener('submit', async event => {
        event.preventDefault();
        const pin = pinNew.value();
        if (!pinCode.isComplete()) { pinCode.error(); return toast('Escribe los 6 dígitos del código.', 'err'); }
        if (!pinNew.isComplete() || !pinConfirm.isComplete()) { pinNew.error(); return toast('Completa los 4 dígitos en ambos campos.', 'err'); }
        if (!BlApi.isSecurePin(pin)) { pinNew.error(); return toast('Esta clave es insegura. Elige un PIN diferente.', 'err'); }
        if (pin !== pinConfirm.value()) { pinConfirm.error(); pinConfirm.clear(); return toast('Las dos claves no coinciden.', 'err'); }
        if (BlApi.pinMatchesBirthdate(pin, state.kyc?.fechaNacimiento)) { pinNew.error(); return toast('Por seguridad, evita usar tu fecha de nacimiento como clave.', 'err'); }
        const button = pinSteps.reset.querySelector('button[type="submit"]');
        setLoading(button, true);
        try {
            await BlApi.api(config.authApi, 'POST', '/auth/password-recovery/reset', {
                email: state.kyc.email, channel: pinFlow.channel, code: pinCode.value(), password: BlApi.passwordFromPin(pin),
            });
            pinFlow.timer?.stop();
            closeModalById('pinModal');
            toast('Clave cambiada correctamente.', 'ok');
        } catch (err) {
            if (err.status === 400) { pinCode.error(); pinCode.clear(); }
            fail(err, 'No se pudo cambiar la clave.');
        } finally { setLoading(button, false); }
    });
    pinModal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => pinFlow.timer?.stop()));


    // =====================================================
    // CERRAR SESIÓN
    // =====================================================

    $('logout').addEventListener('click', async event => {
        event.preventDefault();
        const confirmed = await confirmAction('Cerrar sesión', '¿Quieres salir de tu cuenta Banklite?', 'Salir');
        if (confirmed) BlApi.logout('cerrada');
    });


    // Suscripciones (subscriptions.js): un cobro cambia el saldo y genera avisos.
    document.addEventListener('banklite:account-changed', async () => {
        await loadAccount();
        await loadNotifications();
    });

    // ---------- carga inicial ----------
    (async () => {
        await loadKyc();
        await loadAccount();
        await loadCards();
        await loadNotifications();
    })();
});
