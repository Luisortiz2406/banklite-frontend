// =========================================================
// LAYOUT COMPARTIDO DE LAS VISTAS INTERNAS
// Encabezado (notificaciones, nombre, Salir), menú lateral y menú ☰ en celular.
// Cada página solo declara <body class="app" data-page="..."> y su <main>;
// este script arma el resto. Se carga después de java.js y api.js y corre de
// inmediato (antes de DOMContentLoaded) para que java.js conecte los modales
// que inyecta aquí (data-close, clic en el fondo, Escape).
// =========================================================

const BlLayout = (() => {
    const page = document.body.dataset.page;
    const main = document.querySelector('main');
    if (!page || !main) return null;

    const onDashboard = page === 'dashboard';
    // En el dashboard las secciones son anclas; desde las demás vistas se va al dashboard.
    const dash = hash => (onDashboard ? `#${hash}` : `dashboard.html#${hash}`);

    const svg = (paths, size = 18) =>
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

    const ICONS = {
        inicio: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
        dinero: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
        transferir: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
        pagos: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2Z"/><path d="M8 9h8M8 13h6"/>',
        qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h7v-4M17 21v-.01"/>',
        llaves: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M16 7l3 3M14 9l2 2"/>',
        ahorro: '<path d="M19 9a7 7 0 0 0-7-4H9a6 6 0 0 0-6 6c0 2 1 3.7 2.5 4.8L6 20h3l1-2h3l1 2h3l.6-3.2A6 6 0 0 0 20 14h1v-4h-1.2a7 7 0 0 0-.8-1Z"/><path d="M16 11h.01"/>',
        metas: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        inversiones: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/><path d="M15 8h5v5"/>',
        cuenta: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v4h-4a2 2 0 0 0 0 4h4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/>',
        movimientos: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
        tarjetas: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
        suscripciones: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3"/>',
        puntos: '<path d="m12 2 3 7h7l-5.5 4.5 2 7.5-6.5-4.5L5.5 21l2-7.5L2 9h7z"/>',
        perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        configuracion: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        chevron: '<path d="m6 9 6 6 6-6"/>',
    };

    // Menú: un solo lugar para todas las vistas. "spy" es la clave que se marca como activa.
    const MENU = [
        { spy: 'inicio', label: 'Inicio', href: dash('inicio') },
        { group: 'dinero', label: 'Mover dinero', items: [
            { spy: 'transferir', label: 'Transferir', href: 'transferir.html' },
            { spy: 'pagos', label: 'Pagos', href: 'pagos.html' },
            { spy: 'qr', label: 'Pagar con QR', href: 'qr.html' },
            { spy: 'llaves', label: 'Llaves Bre-B', href: 'llaves.html' },
        ] },
        { group: 'ahorro', label: 'Ahorrar', items: [
            { spy: 'ahorro', icon: 'metas', label: 'Metas de ahorro', href: dash('ahorro') },
            { spy: 'inversiones', label: 'Bolsillos y CDT', href: 'inversiones.html' },
        ] },
        { group: 'cuenta', label: 'Mis finanzas', items: [
            { spy: 'movimientos', label: 'Movimientos', href: 'movimientos.html' },
            { spy: 'tarjetas', label: 'Tarjetas', href: dash('tarjetas') },
            { spy: 'suscripciones', label: 'Suscripciones', href: dash('suscripciones') },
            { spy: 'puntos', label: 'Mis puntos', href: 'puntos.html' },
        ] },
    ];

    const link = item =>
        `<a class="side" href="${item.href}" data-spy="${item.spy}">${svg(ICONS[item.icon || item.spy])}<span>${item.label}</span></a>`;

    const menuHtml = MENU.map(entry => {
        if (!entry.group) return link(entry);
        return `
            <div class="side-group" data-group="${entry.group}">
                <button type="button" class="side side-toggle" aria-expanded="false" aria-controls="side-${entry.group}">
                    ${svg(ICONS[entry.group])}<span>${entry.label}</span>${svg(ICONS.chevron, 14).replace('<svg', '<svg class="side-chevron"')}
                </button>
                <div class="side-sub" id="side-${entry.group}">
                    <div class="side-sub-inner">${entry.items.map(link).join('')}</div>
                </div>
            </div>`;
    }).join('');


    // ---------- encabezado ----------
    document.querySelectorAll('body > header.app-header').forEach(old => old.remove());

    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
        <div class="header-start">
            <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="appSidebar">
                ${svg(ICONS.menu, 20)}
            </button>
            <a class="brand" href="${onDashboard ? '#inicio' : 'dashboard.html'}" aria-label="Banklite, inicio">
                <span class="logo">B</span>
                <span>banklite</span>
            </a>
        </div>
        <div class="header-user">
            <button class="notification" id="notifications" type="button" aria-label="Notificaciones">
                ${svg(ICONS.campana)}
                <i hidden></i>
            </button>
            <span class="avatar" id="avatar">·</span>
            <b id="headerName">…</b>
            <button id="logout" class="logout" type="button">Salir</button>
        </div>`;


    // ---------- menú lateral + contenido ----------
    const layout = document.createElement('div');
    layout.className = 'layout';
    layout.innerHTML = `
        <aside class="sidebar" id="appSidebar" aria-label="Menú" data-page="${page}" tabindex="-1">
            <div class="sidebar-head">
                <span class="brand"><span class="logo">B</span><span>banklite</span></span>
                <button class="sidebar-close" type="button" aria-label="Cerrar menú">×</button>
            </div>
            ${menuHtml}
            <div class="side-space"></div>
            <a class="side" href="${dash('perfil')}" id="openMyProfile">${svg(ICONS.perfil)}<span>Mi perfil</span></a>
            <a class="side" href="${dash('configuracion')}" id="openSettings">${svg(ICONS.configuracion)}<span>Configuración</span></a>
        </aside>
        <div class="sidebar-backdrop" hidden></div>`;

    main.before(header);
    header.after(layout);
    layout.querySelector('.sidebar').after(main);


    // ---------- modales que usa el encabezado (si la página no los trae) ----------
    function ensureModal(id, html) {
        if (document.getElementById(id)) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        document.body.appendChild(wrap.firstElementChild);
    }

    ensureModal('notifModal', `
        <div class="modal" id="notifModal" role="dialog" aria-modal="true" aria-labelledby="notifTitle">
            <div class="modal-card">
                <button class="modal-close" data-close type="button" aria-label="Cerrar">×</button>
                <span class="eyebrow">Centro de avisos</span>
                <h2 id="notifTitle">Notificaciones</h2>
                <ul class="notif-list" id="notifList"></ul>
                <button class="btn primary full" data-close type="button">Listo</button>
            </div>
        </div>`);

    ensureModal('confirmModal', `
        <div class="modal" id="confirmModal" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmText">
            <div class="modal-card">
                <span class="modal-icon is-alert" aria-hidden="true">!</span>
                <h2 id="confirmTitle">¿Estás seguro?</h2>
                <p id="confirmText"></p>
                <div class="modal-actions">
                    <button class="btn soft" data-close type="button">Cancelar</button>
                    <button class="btn primary" id="confirmAccept" type="button">Confirmar</button>
                </div>
            </div>
        </div>`);


    // ---------- menú ☰ en celular ----------
    const sidebar = layout.querySelector('.sidebar');
    const backdrop = layout.querySelector('.sidebar-backdrop');
    const toggle = header.querySelector('#menuToggle');
    const mobile = window.matchMedia('(max-width: 760px)');

    function setMenu(open, { focus = true } = {}) {
        document.body.classList.toggle('menu-open', open);
        backdrop.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        if (open) sidebar.focus({ preventScroll: true }); // Tab sigue por las opciones del menú
        else if (focus && mobile.matches) toggle.focus({ preventScroll: true });
    }

    toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
    backdrop.addEventListener('click', () => setMenu(false));
    sidebar.querySelector('.sidebar-close').addEventListener('click', () => setMenu(false));
    sidebar.addEventListener('click', event => {
        if (event.target.closest('a.side')) setMenu(false, { focus: false });
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false);
    });
    mobile.addEventListener('change', () => setMenu(false, { focus: false }));


    // ---------- datos del encabezado (después de cargar api.js y la página) ----------
    const state = { notifications: [] };
    const $ = id => document.getElementById(id);
    const htmlToText = value => new DOMParser().parseFromString(String(value ?? ''), 'text/html').body.textContent || '';

    function setUser(name) {
        $('headerName').textContent = name || 'Mi cuenta';
        $('avatar').textContent = initials(name || 'B');
    }

    async function loadUser() {
        try {
            const kyc = await BlApi.authed(BlApi.config.kycApi, 'GET', `/kyc/${BlApi.session.idUser}`);
            setUser(`${kyc?.nombres || ''} ${kyc?.apellidos || ''}`.trim());
        } catch (err) {
            if (!BlApi.handleAuthError(err)) setUser('');
        }
    }

    const NOTIF_ICON = {
        income: svg('<path d="M17 7 7 17"/><path d="M17 17H7V7"/>', 16),
        expense: svg('<path d="M7 17 17 7"/><path d="M7 7h10v10"/>', 16),
        notice: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>', 16),
    };

    function notifKind(n) {
        const text = `${n.event} ${n.title}`.toLowerCase();
        if (/recib|entrada|abono|consign|deposit/.test(text)) return 'income';
        if (/envia|enviaste|salida|transferencia|cargo/.test(text)) return 'expense';
        return 'notice';
    }

    function updateDot() {
        const dot = header.querySelector('#notifications i');
        dot.hidden = !state.notifications.some(n => !n.read);
    }

    async function refreshNotifications() {
        try {
            state.notifications = await BlApi.authed(BlApi.config.notificationApi, 'GET', `/notifications/${BlApi.session.idUser}?channel=in_app`);
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            state.notifications = []; // notification-service apagado: no se rompe el resto
        }
        updateDot();
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
                        await BlApi.authed(BlApi.config.notificationApi, 'PUT', `/notifications/${n.id}/read`);
                        n.read = true;
                        li.classList.remove('is-new');
                        updateDot();
                    } catch (err) { if (!BlApi.handleAuthError(err)) toast('No se pudo marcar como leída.', 'err'); }
                }, { once: true });
            }
            list.appendChild(li);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSidebar();
        if (!BlApi.hasSession()) return; // la página misma redirige al login

        header.querySelector('#notifications').addEventListener('click', async () => {
            await refreshNotifications();
            renderNotifications();
            openModal('notifModal');
        });

        header.querySelector('#logout').addEventListener('click', async event => {
            event.preventDefault();
            const confirmed = await confirmAction('Cerrar sesión', '¿Quieres salir de tu cuenta Banklite?', 'Salir');
            if (confirmed) BlApi.logout('cerrada');
        });

        // Fuera del dashboard el avatar lleva a "Mis datos"; en el dashboard lo conecta dashboard.js.
        if (!onDashboard) {
            const avatar = $('avatar');
            avatar.setAttribute('role', 'link');
            avatar.setAttribute('tabindex', '0');
            avatar.setAttribute('aria-label', 'Ver mis datos');
            avatar.style.cursor = 'pointer';
            const go = () => { window.location.href = 'dashboard.html#datos'; };
            avatar.addEventListener('click', go);
            avatar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
            loadUser(); // en el dashboard el nombre lo pone dashboard.js con setUser (ya carga el KYC)
        }

        refreshNotifications();
    });

    return { page, setUser, refreshNotifications };
})();
