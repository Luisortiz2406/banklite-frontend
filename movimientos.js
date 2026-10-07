// =========================================================
// BANKLITE - MOVIMIENTOS (movimientos.html)
// Datos reales: GET /ledger/accounts/:id/transactions (paginado),
// /ledger/accounts/:id/balance y /statement (extracto PDF).
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('fullMovements')) return;
    if (!BlApi.protectPage()) return;

    const { config, session } = BlApi;
    const get = path => BlApi.authed(config.ledgerApi, 'GET', path);
    const $ = id => document.getElementById(id);
    const PAGE_SIZE = 50;

    const TYPE_LABELS = { transfer: 'Transferencia', deposit: 'Consignación', credit: 'Abono', debit: 'Cargo', reversal: 'Reverso', payment: 'Pago a comercio' };
    const ACCOUNT_TYPES = { savings: 'Cuenta de ahorros', checking: 'Cuenta corriente' };
    const ICON_IN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7 7 17"/><path d="M17 17H7V7"/></svg>';
    const ICON_OUT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>';

    const state = { account: null, kyc: null, items: [], page: 0, done: false, filter: 'all', selected: null };
    const container = $('fullMovements');
    const search = $('movementSearch');
    const modal = $('movementModal');

    const money = (v, currency = state.account?.currency || 'COP') =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: currency === 'COP' ? 0 : 2 }).format(Number(v) || 0);
    const monthStart = (year, month) => new Date(Date.UTC(year, month, 1, 5)); // 00:00 en Bogotá

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        toast(err?.message || fallback, 'err');
    }

    function holder() {
        const k = state.kyc || {};
        return {
            name: k.nombres ? `${k.nombres} ${k.apellidos || ''}`.trim() : 'Cliente Banklite',
            document: k.numeroDocumento ? `${k.tipoDocumento || 'CC'} ${k.numeroDocumento}` : 'No disponible',
            accountType: ACCOUNT_TYPES[state.account?.accountType] || 'Cuenta',
            accountNumber: state.account?.accountNumber || '',
        };
    }

    // ---------- carga ----------
    async function init() {
        try {
            const accounts = await BlApi.authed(config.accountApi, 'GET', '/accounts');
            const usable = (accounts || []).filter(a => a.status !== 'closed');
            state.account = usable.find(a => a.id === session.accountId) || usable[0] || null;
            if (!state.account) {
                container.innerHTML = '<div class="movement-empty"><span aria-hidden="true">↔</span><strong>Aún no tienes una cuenta</strong><p>Ábrela desde el inicio para empezar a moverte con Banklite.</p><a class="btn primary" href="dashboard.html">Ir al inicio</a></div>';
                ['sumBalance', 'sumIncome', 'sumExpense'].forEach(id => { $(id).textContent = '—'; });
                return;
            }
            session.accountId = state.account.id;
            BlApi.authed(config.kycApi, 'GET', `/kyc/${session.idUser}`).then(k => { state.kyc = k; }).catch(() => {});
            await Promise.all([loadSummary(), loadMore()]);
        } catch (err) { fail(err, 'No se pudieron cargar tus movimientos.'); }
    }

    async function loadSummary() {
        const now = new Date();
        const from = monthStart(now.getUTCFullYear(), now.getUTCMonth()).toISOString();
        const [balance, month] = await Promise.all([
            get(`/ledger/accounts/${state.account.id}/balance`),
            (async () => {
                const all = [];
                for (let page = 1; page <= 10; page++) {
                    const batch = await get(`/ledger/accounts/${state.account.id}/transactions?from=${encodeURIComponent(from)}&limit=100&page=${page}`);
                    all.push(...batch);
                    if (batch.length < 100) break;
                }
                return all;
            })(),
        ]);
        let income = 0, expense = 0;
        month.forEach(m => { if (m.direction === 'in') income += Number(m.amount) || 0; else expense += Number(m.amount) || 0; });
        $('sumBalance').textContent = money(balance.balance, balance.currency);
        $('sumIncome').textContent = '+' + money(income);
        $('sumExpense').textContent = '−' + money(expense);
    }

    async function loadMore() {
        if (state.done) return;
        const button = $('loadMoreMovements');
        button.disabled = true;
        try {
            const batch = await get(`/ledger/accounts/${state.account.id}/transactions?limit=${PAGE_SIZE}&page=${state.page + 1}`);
            state.page += 1;
            state.items.push(...batch);
            state.done = batch.length < PAGE_SIZE;
            render();
        } catch (err) { fail(err, 'No se pudieron cargar más movimientos.'); }
        finally {
            button.disabled = false;
            button.hidden = state.done;
        }
    }
    $('loadMoreMovements').addEventListener('click', loadMore);

    // ---------- filtros, búsqueda y lista agrupada por día ----------
    function visible() {
        const term = (search.value || '').trim().toLowerCase();
        return state.items
            .map((m, index) => ({ m, index }))
            .filter(({ m }) => state.filter === 'all'
                || (state.filter === 'transfer' ? m.type === 'transfer' : m.direction === state.filter))
            .filter(({ m }) => !term || `${m.description || ''} ${TYPE_LABELS[m.type] || ''} ${m.counterpartyAccountLast4 || ''}`.toLowerCase().includes(term));
    }

    function dayLabel(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Sin fecha';
        const today = new Date();
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Hoy';
        if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
        return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function render() {
        const items = visible();
        container.replaceChildren();
        if (!items.length) {
            const searching = (search.value || '').trim();
            container.innerHTML = `<div class="movement-empty"><span aria-hidden="true">↔</span><strong></strong><p></p></div>`;
            container.querySelector('strong').textContent = searching ? 'No encontramos resultados' : state.filter === 'all' ? 'Aún no tienes movimientos' : 'No hay operaciones en este filtro';
            container.querySelector('p').textContent = searching ? 'Prueba con otra palabra.' : 'Las operaciones de tu cuenta aparecerán aquí.';
            return;
        }
        let lastDay = '';
        items.forEach(({ m, index }) => {
            const day = dayLabel(m.createdAt);
            if (day !== lastDay) {
                const header = document.createElement('div');
                header.className = 'movement-day';
                header.textContent = day;
                container.appendChild(header);
                lastDay = day;
            }
            const incoming = m.direction === 'in';
            const entry = document.createElement('article');
            entry.className = 'movement-entry';
            entry.innerHTML = `
                <button class="movement-row" type="button" data-movement-index="${index}">
                    <span class="movement-icon ${incoming ? 'income' : 'expense'}" aria-hidden="true">${incoming ? ICON_IN : ICON_OUT}</span>
                    <span class="movement-info"><strong></strong><span></span></span>
                    <span class="movement-meta"><strong class="movement-amount ${incoming ? 'positive' : 'negative'}"></strong><time></time></span>
                    <span class="movement-chevron" aria-hidden="true">›</span>
                </button>`;
            entry.querySelector('.movement-info strong').textContent = m.description || TYPE_LABELS[m.type] || 'Movimiento';
            entry.querySelector('.movement-info span').textContent = [TYPE_LABELS[m.type], m.counterpartyAccountLast4 ? `${m.type === 'payment' ? 'Comercio' : 'Cuenta'} ····${m.counterpartyAccountLast4}` : ''].filter(Boolean).join(' · ');
            entry.querySelector('.movement-amount').textContent = `${incoming ? '+' : '−'}${money(m.amount, m.currency)}`;
            entry.querySelector('time').textContent = formatDate(m.createdAt, { hour: '2-digit', minute: '2-digit' });
            container.appendChild(entry);
        });
    }

    const filters = [...document.querySelectorAll('[data-filter]')];
    filters.forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
        button.addEventListener('click', () => {
            state.filter = button.dataset.filter || 'all';
            filters.forEach(f => { f.classList.toggle('active', f === button); f.setAttribute('aria-pressed', String(f === button)); });
            render();
        });
    });
    search.addEventListener('input', render);

    // ---------- detalle y comprobante ----------
    container.addEventListener('click', event => {
        const button = event.target.closest('[data-movement-index]');
        if (!button) return;
        const m = state.items[Number(button.dataset.movementIndex)];
        if (!m) return;
        state.selected = m;
        const incoming = m.direction === 'in';
        $('detailTitle').textContent = m.description || TYPE_LABELS[m.type] || 'Movimiento';
        $('detailIcon').innerHTML = incoming ? ICON_IN : ICON_OUT;
        $('detailIcon').className = `modal-icon movement-icon ${incoming ? 'income' : 'expense'}`;
        const rows = [
            ['Valor', `${incoming ? '+' : '−'}${money(m.amount, m.currency)}`, incoming ? 'movement-amount positive' : 'movement-amount negative'],
            ['Tipo', TYPE_LABELS[m.type] || 'Movimiento'],
            ['Descripción', m.description || 'Sin descripción'],
            [incoming ? 'Desde' : 'Hacia', m.counterpartyAccountLast4 ? `${m.type === 'payment' ? 'Comercio' : 'Cuenta Banklite'} ····${m.counterpartyAccountLast4}` : '—'],
            ['Fecha', formatDate(m.createdAt, { dateStyle: 'long', timeStyle: 'short' })],
            ['N.º de operación', String(m.transactionId || '').slice(0, 8).toUpperCase()],
            ['Estado', 'Aprobada', 'status-ok'],
        ];
        const body = $('detailBody');
        body.replaceChildren();
        rows.forEach(([title, value, cls]) => {
            const row = document.createElement('div');
            row.innerHTML = '<span></span><strong></strong>';
            row.querySelector('span').textContent = title;
            row.querySelector('strong').textContent = value;
            if (cls) row.querySelector('strong').className = cls;
            body.appendChild(row);
        });
        modal.classList.add('active');
    });
    modal.querySelectorAll('.modal-close, #detailOk').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));
    $('detailReceipt').addEventListener('click', () => {
        if (!state.selected) return;
        downloadReceipt(state.selected, holder());
        toast('Comprobante descargado.', 'ok');
    });

    // ---------- CSV (lo cargado y filtrado) ----------
    $('exportMovements').addEventListener('click', () => {
        const items = visible();
        if (!items.length) return showMessage('Sin movimientos', 'No hay movimientos para descargar con este filtro.', 'i');
        // Una descripción como =HYPERLINK(...) se ejecutaría como fórmula al abrir
        // el CSV: se antepone ' a lo que empiece por =, +, -, @, tab o CR.
        const cell = v => (typeof v === 'number' ? String(v) : String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&"));
        const quote = v => `"${cell(v).replace(/"/g, '""')}"`;
        const rows = [
            ['Fecha', 'Descripción', 'Tipo', 'Cuenta contraparte', 'Valor', 'Moneda', 'N.º de operación'],
            ...items.map(({ m }) => [
                formatDate(m.createdAt, { dateStyle: 'short', timeStyle: 'short' }),
                m.description || '',
                TYPE_LABELS[m.type] || '',
                m.counterpartyAccountLast4 ? `····${m.counterpartyAccountLast4}` : '',
                (m.direction === 'in' ? 1 : -1) * (Number(m.amount) || 0),
                m.currency,
                m.transactionId,
            ]),
        ];
        const csv = '﻿' + rows.map(r => r.map(quote).join(';')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `movimientos-banklite-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    // ---------- extracto mensual (GET /statement) ----------
    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const statementSelect = $('statementMonth');

    $('openStatement').addEventListener('click', () => {
        if (!state.account) return showMessage('Sin cuenta', 'Abre tu cuenta para descargar extractos.', 'i');
        // Meses desde la apertura de la cuenta hasta hoy (más reciente primero).
        const opened = new Date(state.account.createdAt || Date.now());
        const now = new Date();
        const options = [];
        let y = now.getFullYear();
        let mo = now.getMonth();
        while ((y > opened.getFullYear() || (y === opened.getFullYear() && mo >= opened.getMonth())) && options.length < 24) {
            options.push(`<option value="${y}-${mo}">${MONTHS[mo]} ${y}</option>`);
            mo -= 1;
            if (mo < 0) { mo = 11; y -= 1; }
        }
        statementSelect.innerHTML = options.join('');
        openModal('statementModal');
    });

    $('statementForm').addEventListener('submit', async event => {
        event.preventDefault();
        const [year, month] = statementSelect.value.split('-').map(Number);
        const from = monthStart(year, month).toISOString();
        const to = monthStart(month === 11 ? year + 1 : year, (month + 1) % 12).toISOString();
        const button = event.target.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const statement = await get(`/ledger/accounts/${state.account.id}/statement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
            const label = `${MONTHS[month]} ${year}`;
            downloadStatement(statement, holder(), label, `${year}-${String(month + 1).padStart(2, '0')}`);
            closeModalById('statementModal');
            toast(`Extracto de ${label.toLowerCase()} descargado.`, 'ok');
        } catch (err) { fail(err, 'No se pudo generar el extracto.'); }
        finally { button.disabled = false; }
    });

    init();
});
