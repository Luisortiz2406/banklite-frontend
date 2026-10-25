// =========================================================
// BANKLITE ADMIN - LÓGICA DEL PANEL ADMINISTRATIVO
// Todo pasa por el API Gateway con el token de EMPLEADO
// (POST /auth/admin/login). Cada microservicio valida el rol
// y registra la acción en su propia auditoría; el panel solo
// muestra y envía.
// =========================================================

"use strict";

// Dominio del API Gateway: Railway fuera de localhost; docker-compose en local.
const GW = (
    /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
        ? "http://localhost:8080"
        : "https://api-gateway-production-dd7f.up.railway.app"
).replace(/\/+$/, "");

// Las páginas se enlazan con .html: así funcionan con nginx (Railway) y con
// cualquier servidor estático en local (python -m http.server), que no resuelve /admin/clientes.
const BASE = "/admin/";
const TOKEN_KEY = "banklite.staff.token";
const LAST_KEY = "banklite.staff.last";
const SESSION_LIMIT = 20 * 60 * 1000; // 20 minutos sin actividad (el token dura más; esto es del navegador)

// =========================================================
// 1. UTILIDADES
// =========================================================

const $ = id => document.getElementById(id);

// REGLA DEL PANEL: todo dato que venga de la API y se interpole en un template
// que termina en innerHTML va dentro de esc(...), sin excepción (también ids,
// estados y textos "que siempre son seguros"). Solo se interpolan sin esc()
// los helpers que ya devuelven HTML escapado (svg, badge, pageHead, money, fdate...).
// La CSP (script-src 'self', sin inline) es la segunda barrera si algo se escapa.
const esc = value =>
    String(value ?? "").replace(
        /[&<>"']/g,
        c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

const money = (value, currency = "COP") =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP", maximumFractionDigits: 2 }).format(
        Number(value) || 0
    );

const compact = value => {
    const n = Math.abs(Number(value) || 0);
    if (n >= 1e9) return "$" + (n / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " mil M";
    if (n >= 1e6) return "$" + (n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + "M";
    if (n >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("es-CO") + "K";
    return "$" + n.toLocaleString("es-CO");
};

const fdate = (value, style = "full") => {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return "—";
    if (style === "day")
        return d.toLocaleDateString("es-CO", {
            timeZone: "America/Bogota",
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    return d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
};

const ago = value => {
    if (!value) return "—";
    const s = Math.round((Date.now() - new Date(value)) / 1000);
    if (s < 60) return "hace un momento";
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    const days = Math.round(s / 86400);
    return days === 1 ? "ayer" : `hace ${days} días`;
};

const initials = name =>
    String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0])
        .join("")
        .toUpperCase();

const short = id => (id ? esc(String(id).slice(0, 8)) + "…" : "—");

const params = () => new URLSearchParams(location.search);

const qs = obj => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== "") p.set(k, v);
    const s = p.toString();
    return s ? "?" + s : "";
};

const store = {
    get(key) {
        try {
            return sessionStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key, value) {
        try {
            value ? sessionStorage.setItem(key, value) : sessionStorage.removeItem(key);
        } catch {
            /* sin almacenamiento */
        }
    },
};

function toast(message, isError = false) {
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " err" : "");
    el.textContent = message;
    $("toasts")?.appendChild(el);
    setTimeout(
        () => {
            el.classList.add("out");
            setTimeout(() => el.remove(), 300);
        },
        isError ? 5200 : 3200
    );
}

// Celdas que Excel/LibreOffice interpretarían como fórmula (=, +, -, @, tab, CR):
// se antepone ' para que se muestren como texto. Los números se dejan tal cual.
function csvCell(value) {
    if (typeof value === "number") return String(value);
    const text = String(value ?? "");
    return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function downloadCSV(name, rows) {
    const csv = rows.map(row => row.map(cell => `"${csvCell(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const ICON = {
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M16 7l3 3M14 9l2 2"/>',
    dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    customers:
        '<circle cx="9" cy="8" r="4"/><path d="M1 21c0-4 4-6 8-6s8 2 8 6"/><path d="M17 3a4 4 0 0 1 0 8M23 21c0-3-2-5-5-5.6"/>',
    accounts: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    movements: '<path d="M7 7h13M17 3l4 4-4 4M17 17H4M7 21l-4-4 4-4"/>',
    monitoring: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    staff: '<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>',
    audit: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 13l2 2 4-4"/>',
    money: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    shield: '<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    fraud: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    compliance: '<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>',
};

const svg = (name, extra = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICON[name] || ""}</svg>`;

// =========================================================
// 2. API Y SESIÓN DEL EMPLEADO
// =========================================================

let TOKEN = store.get(TOKEN_KEY);
let ME = null;

const isAdmin = () => ME?.role === "admin";
// Permisos según el rol. El backend los vuelve a validar y responde 403.
const hasRole = (...roles) => roles.includes(ME?.role);
// Cumplimiento y Administración: identidad completa (KYC), fraude y SAR
const canCompliance = () => hasRole("compliance", "admin");

const SESSION = {
    touch() {
        store.set(LAST_KEY, String(Date.now()));
    },
    expired() {
        const last = Number(store.get(LAST_KEY));
        return !last || Date.now() - last > SESSION_LIMIT;
    },
    start(token) {
        TOKEN = token;
        store.set(TOKEN_KEY, token);
        this.touch();
    },
    end() {
        TOKEN = null;
        ME = null;
        store.set(TOKEN_KEY, null);
        store.set(LAST_KEY, null);
    },
};

function goLogin(reason) {
    SESSION.end();
    location.replace(BASE + "login.html" + (reason ? `?${reason}=1` : ""));
}

async function api(method, path, body) {
    let res;
    try {
        res = await fetch(GW + path, {
            method,
            headers: {
                ...(body ? { "Content-Type": "application/json" } : {}),
                ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new Error("No se pudo conectar con el servidor. Revisa tu conexión.");
    }
    let data = null;
    try {
        data = await res.json();
    } catch {
        /* respuesta sin cuerpo JSON */
    }
    if (res.status === 401 && TOKEN && path !== "/auth/admin/login") {
        goLogin("expirada");
        throw new Error("Tu sesión expiró.");
    }
    if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message.join(" ") : data?.message || `Error ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
    }
    return data;
}

// Igual que api() pero devuelve null si falla (para tarjetas que toleran un servicio caído).
const tryApi = (method, path, body) => api(method, path, body).catch(() => null);

const health = () =>
    fetch(GW + "/health")
        .then(r => r.json())
        .catch(() => null);

// =========================================================
// 3. ETIQUETAS
// =========================================================

const ACCESS = {
    active: ["Activo", "b-good"],
    locked: ["Bloqueo temporal", "b-warn"],
    disabled: ["Suspendido", "b-bad"],
};
const ACC_STATUS = {
    pending: ["Pendiente", "b-gray"],
    active: ["Activa", "b-good"],
    blocked: ["Bloqueada", "b-bad"],
    closed: ["Cerrada", "b-gray"],
};
const ACC_TYPE = { savings: "Ahorros", checking: "Corriente", merchant: "Comercio" };
const KYC = { verified: ["Verificado", "b-teal"], rejected: ["Rechazado", "b-bad"] };
const TX = {
    transfer: "Transferencia",
    credit: "Abono",
    deposit: "Consignación",
    debit: "Cargo",
    reversal: "Reverso",
    payment: "Pago a comercio",
};
const NOTIF = { pending: ["Pendiente", "b-warn"], sent: ["Enviada", "b-good"], failed: ["Fallida", "b-bad"] };
const CHANNEL = { in_app: "App", email: "Correo", whatsapp: "WhatsApp" };
const ROLE = { admin: "Administrador", compliance: "Cumplimiento", support: "Soporte" };
const ROLE_BADGE = { admin: "b-info", compliance: "b-warn", support: "b-gray" };
const roleBadge = role => `<span class="badge ${ROLE_BADGE[role] || "b-gray"}">${esc(ROLE[role] || role)}</span>`;

const ACTIONS = {
    "staff.login": "Ingresó al panel",
    "staff.create": "Creó un empleado",
    "staff.update": "Editó un empleado",
    "staff.password_change": "Cambió su contraseña",
    "customer.disable": "Suspendió el acceso",
    "customer.enable": "Reactivó el acceso",
    "account.blocked": "Bloqueó la cuenta",
    "account.active": "Desbloqueó la cuenta",
    "account.closed": "Cerró la cuenta",
    "account.limits": "Cambió los límites",
    "transaction.reverse": "Reversó un movimiento",
    "account.credit": "Abonó a una cuenta",
    "notification.retry": "Reintentó un correo",
    "dlq.requeue": "Reprocesó una cola",
    "fraud.confirmed": "Confirmó una alerta de fraude",
    "fraud.dismissed": "Descartó una alerta de fraude",
    "sar.filed": "Radicó un SAR",
    "sar.dismissed": "Descartó un SAR",
    "report.generate": "Generó un reporte AML",
    "kyc.view": "Abrió los datos de identidad",
    "kyc.manual_approve": "Aprobó a mano una verificación",
    "staff.document_registered": "Registró el documento de un administrador (consola)",
};

const badge = (map, key, extra) => {
    const [text, cls] = map[key] || [key || "—", "b-gray"];
    return `<span class="badge ${cls}">${esc(text)}${extra ? " · " + esc(extra) : ""}</span>`;
};

const blockedBy = (a, long) =>
    a.status === "blocked"
        ? a.blockedBy === "bank"
            ? long
                ? "por el banco"
                : "banco"
            : long
              ? "por el titular"
              : "titular"
        : "";

const kycName = k => (k ? `${k.nombres} ${k.apellidos}` : "");

// =========================================================
// 4. PIEZAS DE LA INTERFAZ: MODAL, FICHA LATERAL, PAGINACIÓN
// =========================================================

function closeModal() {
    $("modalRoot").innerHTML = "";
}

// Modal de formulario. Si onSubmit lanza un error, se muestra adentro.
function formModal({
    title,
    desc = "",
    fields = [],
    confirm = "Confirmar",
    danger = false,
    icon = "shield",
    onSubmit,
}) {
    const inputs = fields
        .map(f => {
            const id = "mf_" + f.name;
            let control;
            if (f.type === "select") {
                control = `<select id="${id}">${f.options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
            } else if (f.type === "textarea") {
                control = `<textarea id="${id}" rows="3" maxlength="${f.max || 300}" placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea>`;
            } else {
                control = `<input id="${id}" type="${f.type || "text"}" value="${esc(f.value ?? "")}" placeholder="${esc(f.placeholder || "")}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.step ? `step="${f.step}"` : ""} autocomplete="off">`;
            }
            return `<label for="${id}">${esc(f.label)}</label>${control}`;
        })
        .join("");

    $("modalRoot").innerHTML = `
        <div class="modal-overlay">
            <form class="modal" id="mForm" novalidate>
                <div class="modal-icon ${danger ? "is-danger" : ""}">${svg(danger ? "alert" : icon)}</div>
                <h3>${esc(title)}</h3>
                ${desc ? `<p class="desc">${desc}</p>` : ""}
                ${inputs}
                <div id="mErr" class="alert alert-error" hidden></div>
                <div class="foot">
                    <button type="button" class="btn" id="mCancel">Cancelar</button>
                    <button type="submit" class="btn ${danger ? "btn-danger" : "btn-primary"}" id="mOk">${esc(confirm)}</button>
                </div>
            </form>
        </div>`;

    $("mCancel").onclick = closeModal;
    $("modalRoot")
        .querySelector(".modal-overlay")
        .addEventListener("mousedown", e => {
            if (e.target.classList.contains("modal-overlay")) closeModal();
        });

    const first = fields[0] && $("mf_" + fields[0].name);
    (first || $("mOk")).focus();

    $("mForm").onsubmit = async e => {
        e.preventDefault();
        const values = Object.fromEntries(fields.map(f => [f.name, $("mf_" + f.name).value.trim()]));
        const missing = fields.find(f => f.required && !values[f.name]);
        if (missing) return showErr(`Completa: ${missing.label}`);

        $("mOk").disabled = true;
        $("mOk").innerHTML = '<span class="spin"></span>';

        try {
            await onSubmit(values);
            closeModal();
        } catch (err) {
            showErr(err.message);
            $("mOk").disabled = false;
            $("mOk").textContent = confirm;
        }
    };

    function showErr(text) {
        $("mErr").textContent = text;
        $("mErr").hidden = false;
    }
}

const reasonField = {
    name: "reason",
    label: "Motivo (queda en la auditoría)",
    type: "textarea",
    required: true,
    placeholder: "Ej.: Solicitud del cliente por llamada, caso #123",
};

let drawerOpener = null;

function openDrawer(title, render) {
    $("drawerRoot").innerHTML = `
        <div class="overlay" id="ov">
            <aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
                <div class="drawer-head">
                    <h2>${esc(title)}</h2>
                    <button class="icon-btn" id="dClose" aria-label="Cerrar">${svg("x")}</button>
                </div>
                <div class="drawer-body" id="dBody">${loadingBox}</div>
            </aside>
        </div>`;
    $("dClose").onclick = closeDrawer;
    $("ov").addEventListener("mousedown", e => {
        if (e.target.id === "ov") closeDrawer();
    });
    drawerOpener = () => render($("dBody"));
    render($("dBody"));
    $("dClose").focus();
}

function closeDrawer() {
    $("drawerRoot").innerHTML = "";
    drawerOpener = null;
}

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if ($("modalRoot")?.innerHTML) closeModal();
    else closeDrawer();
});

// Vuelve a pintar la página y la ficha abierta después de una acción
function refreshAll() {
    PAGE?.render();
    drawerOpener?.();
}

// Paginación del lado del servidor: { total, page, limit }
function pager(data, onPage) {
    const pages = Math.max(1, Math.ceil(data.total / data.limit));
    const id = "pg" + Math.random().toString(36).slice(2, 8);
    setTimeout(() => {
        $(id + "p")?.addEventListener("click", () => onPage(data.page - 1));
        $(id + "n")?.addEventListener("click", () => onPage(data.page + 1));
    });
    return `<div class="pager"><span>${data.total} resultado(s) · página ${data.page} de ${pages}</span>
        <button class="btn btn-sm" id="${id}p" ${data.page <= 1 ? "disabled" : ""}>Anterior</button>
        <button class="btn btn-sm" id="${id}n" ${data.page >= pages ? "disabled" : ""}>Siguiente</button></div>`;
}

const pageHead = (title, sub, actions = "") => `
    <div class="page-head">
        <div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div>
        <div class="actions">${actions}</div>
    </div>`;

const loadingBox = '<div class="empty"><span class="spin"></span></div>';

const emptyBox = (title, text, icon = "search") =>
    `<div class="card empty">${svg(icon)}<strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;

const errorBox = err =>
    `<div class="card empty">${svg("alert")}<strong>No se pudo cargar</strong><span>${esc(err.message)}</span></div>`;

const who = (name, sub) =>
    `<div class="who"><span class="avatar">${esc(initials(name))}</span><div><strong>${esc(name)}</strong><small>${sub}</small></div></div>`;

// Estado de la base de cada servicio según el /health del gateway.
const DB_STATE = { ok: "Responde", down: "No responde", unknown: "Sin datos" };

const serviceRows = h =>
    h?.services?.length
        ? `<div class="svc-grid">${h.services
              .map(
                  s => `
        <div class="svc ${s.status === "ok" ? "" : "is-down"}">
            <div class="svc-top"><div><strong>${esc(s.name)}</strong></div>${s.status === "ok" ? '<span class="badge b-good">En línea</span>' : '<span class="badge b-bad">Caído</span>'}</div>
            <div class="svc-meta"><span>Latencia <b>${s.status === "ok" ? esc(s.latencyMs) + " ms" : "—"}</b></span><span>Base <b>${DB_STATE[s.database] || "Sin datos"}</b></span></div>
        </div>`
              )
              .join("")}</div>`
        : emptyBox("El API Gateway no responde", "No se pudo consultar el estado de los servicios.", "server");

// =========================================================
// 5. ESTRUCTURA: MENÚ LATERAL Y BARRA SUPERIOR
// =========================================================

const PAGES = [
    { id: "dashboard", title: "Tablero", href: BASE, group: "General" },
    { id: "customers", title: "Clientes", href: BASE + "clientes.html", group: "Operación" },
    { id: "accounts", title: "Cuentas", href: BASE + "cuentas.html", group: "Operación" },
    { id: "movements", title: "Movimientos", href: BASE + "movimientos.html", group: "Operación" },
    { id: "fraud", title: "Fraude", href: BASE + "fraude.html", group: "Operación", roles: ["compliance", "admin"] },
    {
        id: "compliance",
        title: "Cumplimiento",
        href: BASE + "cumplimiento.html",
        group: "Operación",
        roles: ["compliance", "admin"],
    },
    { id: "monitoring", title: "Monitoreo", href: BASE + "monitoreo.html", group: "Sistema" },
    { id: "staff", title: "Empleados", href: BASE + "empleados.html", group: "Sistema", roles: ["admin"] },
    { id: "audit", title: "Auditoría", href: BASE + "auditoria.html", group: "Sistema" },
];

function buildSide(alerts = 0) {
    const current = document.body.dataset.page;
    let lastGroup = "";

    const links = PAGES.filter(p => !p.roles || hasRole(...p.roles))
        .map(p => {
            const label = p.group !== lastGroup ? `<p class="nav-label">${esc(p.group)}</p>` : "";
            lastGroup = p.group;
            const count = p.id === "monitoring" && alerts ? `<span class="nav-count">${alerts}</span>` : "";
            return `${label}<a href="${p.href}" class="${p.id === current ? "active" : ""}" ${p.id === current ? 'aria-current="page"' : ""}>${svg(p.id)}${esc(p.title)}${count}</a>`;
        })
        .join("");

    $("admSide").innerHTML = `
        <a class="brand" href="${BASE}"><span class="logo-chip">B</span><div>Banklite<small>Panel administrativo</small></div></a>
        <nav class="nav" aria-label="Secciones del panel">${links}</nav>
        <div class="me">
            <span class="avatar">${esc(initials(ME.nombre))}</span>
            <div class="me-body"><strong>${esc(ME.nombre)}</strong><span>${esc(ROLE[ME.role] || ME.role)} · @${esc(ME.username)}</span></div>
            <div class="me-actions">
                <button class="icon-btn" id="passwordBtn" title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña">${svg("key")}</button>
                <button class="icon-btn" id="logoutBtn" title="Cerrar sesión" aria-label="Cerrar sesión">${svg("logout")}</button>
            </div>
        </div>`;

    $("passwordBtn").onclick = openChangePassword;
    $("logoutBtn").onclick = () => goLogin("salir");
}

// Cambio de la contraseña propia (cualquier empleado). Para la de otro empleado: Empleados → Editar.
function openChangePassword() {
    formModal({
        title: "Cambiar mi contraseña",
        desc: "Escribe tu contraseña actual y la nueva. Debe tener 12 o más caracteres, con mayúsculas, minúsculas y números, y ser distinta de la actual.",
        icon: "key",
        confirm: "Cambiar contraseña",
        fields: [
            { name: "current", label: "Contraseña actual", type: "password", required: true },
            { name: "next", label: "Contraseña nueva", type: "password", required: true },
            { name: "confirm", label: "Confirma la contraseña nueva", type: "password", required: true },
        ],
        onSubmit: async v => {
            if (!PASSWORD_RULE.test(v.next)) throw new Error(PASSWORD_MESSAGE);
            if (v.next !== v.confirm) throw new Error("La confirmación no coincide con la contraseña nueva.");
            if (v.next === v.current) throw new Error("La contraseña nueva debe ser distinta de la actual.");
            await api("POST", "/auth/admin/me/password", { currentPassword: v.current, newPassword: v.next });
            toast("Tu contraseña se cambió. Úsala la próxima vez que ingreses.");
        },
    });
}

// Alertas técnicas para el contador del menú (servicios caídos, DLQ y correos fallidos)
async function countAlerts() {
    const [h, accDlq, notDlq, failed] = await Promise.all([
        health(),
        tryApi("GET", "/accounts/admin/dlq"),
        tryApi("GET", "/notifications/admin/dlq"),
        tryApi("GET", "/notifications/admin/notifications" + qs({ status: "failed", limit: 1 })),
    ]);
    const down = h?.services?.filter(s => s.status !== "ok").length || 0;
    return down + (accDlq?.deadLetters || 0) + (notDlq?.deadLetters || 0) + (failed?.total || 0);
}

function buildTop() {
    const page = PAGES.find(p => p.id === document.body.dataset.page);
    const dark = document.documentElement.dataset.theme === "dark";

    $("admTop").innerHTML = `
        <button class="icon-btn menu-btn" id="menuBtn" aria-label="Abrir menú">${svg("menu")}</button>
        <p class="crumbs">Banklite Admin / <strong>${esc(page?.title || "")}</strong></p>
        <div class="top-right">
            <span class="top-clock" id="topClock"></span>
            <button class="icon-btn" id="themeBtn" aria-label="Cambiar tema">${svg(dark ? "sun" : "moon")}</button>
        </div>`;

    $("menuBtn").onclick = () => {
        $("admSide").classList.add("open");
        const backdrop = document.createElement("div");
        backdrop.className = "side-backdrop";
        backdrop.onclick = () => {
            $("admSide").classList.remove("open");
            backdrop.remove();
        };
        document.body.appendChild(backdrop);
    };

    $("themeBtn").onclick = () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        if (next === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;
        document.documentElement.style.background = "";
        try {
            localStorage.setItem("bankliteTheme", next);
        } catch {
            /* sin almacenamiento */
        }
        buildTop();
    };

    const clock = () => {
        const el = $("topClock");
        if (el)
            el.textContent = new Date().toLocaleString("es-CO", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
            });
    };
    clock();
    clearInterval(buildTop.timer);
    buildTop.timer = setInterval(clock, 30000);
}

// =========================================================
// 6. LOGIN DEL PANEL
// =========================================================

async function initLoginPage() {
    const form = $("loginForm");
    const error = $("loginError");
    const p = params();

    const show = (text, kind = "error") => {
        error.textContent = text;
        error.className = `alert alert-${kind}`;
        error.hidden = false;
    };

    if (p.get("expirada")) show("Tu sesión se cerró. Ingresa de nuevo.", "warn");
    if (p.get("salir")) show("Cerraste sesión de forma segura.", "ok");
    if (p.has("expirada") || p.has("salir")) history.replaceState(null, "", location.pathname);

    // Si ya hay una sesión válida, directo al tablero.
    if (TOKEN && !SESSION.expired()) {
        try {
            await api("GET", "/auth/admin/me");
            location.replace(BASE);
            return;
        } catch {
            SESSION.end();
        }
    }

    $("passToggle").onclick = () => {
        const input = $("lgPass");
        input.type = input.type === "password" ? "text" : "password";
        $("passToggle").textContent = input.type === "password" ? "Mostrar" : "Ocultar";
    };

    form.addEventListener("submit", async e => {
        e.preventDefault();
        error.hidden = true;

        const username = $("lgUser").value.trim();
        const password = $("lgPass").value;
        const btn = $("loginBtn");

        if (!username || !password) return show("Escribe tu usuario y tu contraseña.");

        btn.disabled = true;
        btn.innerHTML = '<span class="spin"></span> Verificando…';

        try {
            const r = await api("POST", "/auth/admin/login", { username, password });
            $("lgPass").value = "";
            SESSION.start(r.accessToken);
            location.replace(BASE);
        } catch (err) {
            show(err.message);
            btn.disabled = false;
            btn.textContent = "Ingresar al panel";
        }
    });
}

// =========================================================
// 7. TABLERO
// =========================================================

async function renderDashboard(el) {
    el.innerHTML = loadingBox;

    const [h, ledger, notif, recon, authOb, kycOb, accDlq, notDlq, customers, accounts, audits] = await Promise.all([
        health(),
        tryApi("GET", "/ledger/admin/summary"),
        tryApi("GET", "/notifications/admin/summary"),
        tryApi("GET", "/ledger/admin/reconciliation"),
        tryApi("GET", "/auth/admin/outbox"),
        tryApi("GET", "/kyc/admin/outbox"),
        tryApi("GET", "/accounts/admin/dlq"),
        tryApi("GET", "/notifications/admin/dlq"),
        tryApi("GET", "/auth/admin/customers" + qs({ limit: 5 })),
        tryApi("GET", "/accounts/admin/accounts" + qs({ limit: 1 })),
        loadAudit({ limit: 10 }),
    ]);

    const services = h?.services || [];
    const up = services.filter(s => s.status === "ok").length;
    const byType = (ledger?.byType || []).slice().sort((a, b) => b.amount - a.amount);
    const txCount = byType.reduce((a, r) => a + r.count, 0);
    const volume = byType.filter(r => r.type !== "reversal" && r.currency === "COP").reduce((a, r) => a + r.amount, 0);
    const maxType = Math.max(1, ...byType.map(t => t.amount));
    const pendingEvents = (authOb?.pending || 0) + (kycOb?.pending || 0) + (recon?.pendingEvents?.count || 0);
    const dead = (accDlq?.deadLetters || 0) + (notDlq?.deadLetters || 0);
    const failedNotif = (notif?.byChannelAndStatus || [])
        .filter(r => r.status === "failed")
        .reduce((a, r) => a + r.count, 0);

    // Nombres de los clientes nuevos (viven en kyc-service)
    const recent = customers?.items || [];
    const names = await Promise.all(recent.map(c => tryApi("GET", `/kyc/admin/records/${c.idUser}/resumen`)));

    const alerts = [
        ...services
            .filter(s => s.status !== "ok")
            .map(s => ({
                icon: "server",
                cls: "is-bad",
                title: `${s.name} caído`,
                sub: "Revisa el monitoreo",
                href: BASE + "monitoreo.html",
            })),
        ...(h
            ? []
            : [
                  {
                      icon: "server",
                      cls: "is-bad",
                      title: "El API Gateway no responde",
                      sub: "No se pudo consultar /health",
                      href: BASE + "monitoreo.html",
                  },
              ]),
        ...(dead
            ? [
                  {
                      icon: "alert",
                      cls: "is-warn",
                      title: `${dead} mensaje(s) en colas de error (DLQ)`,
                      sub: "Eventos que no se pudieron procesar",
                      href: BASE + "monitoreo.html",
                  },
              ]
            : []),
        ...(failedNotif
            ? [
                  {
                      icon: "mail",
                      cls: "is-warn",
                      title: `${failedNotif} correo(s) fallido(s) en 7 días`,
                      sub: "Se pueden reintentar",
                      href: BASE + "monitoreo.html",
                  },
              ]
            : []),
        ...(recon && !recon.ok
            ? [
                  {
                      icon: "alert",
                      cls: "is-bad",
                      title: "El ledger tiene descuadres",
                      sub: "Revisa el cuadre contable",
                      href: BASE + "monitoreo.html",
                  },
              ]
            : []),
        ...(pendingEvents
            ? [
                  {
                      icon: "movements",
                      cls: "is-warn",
                      title: `${pendingEvents} evento(s) sin publicar`,
                      sub: "Outbox de auth, kyc y ledger",
                      href: BASE + "monitoreo.html",
                  },
              ]
            : []),
    ];

    const hour = new Date().getHours();
    const hello = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    const activity = audits.items.filter(a => a.action !== "staff.login").slice(0, 6);

    el.innerHTML =
        pageHead(
            `${hello}, ${ME.nombre.split(" ")[0]}`,
            "Este es el resumen del banco en este momento.",
            `<button class="btn btn-sm" id="refresh">${svg("refresh")} Actualizar</button>`
        ) +
        `

        <div class="grid g4">
            <div class="card stat stat-hero">
                <div class="stat-top"><span class="label">Volumen movido (24 h)</span><span class="stat-icon">${svg("money")}</span></div>
                <div class="value">${ledger ? compact(volume) : "—"}</div>
                <div class="sub">${ledger ? `${money(volume)} en ${txCount} movimiento(s)` : "Ledger no disponible"}</div>
            </div>
            <div class="card stat">
                <div class="stat-top"><span class="label">Clientes registrados</span><span class="stat-icon">${svg("customers")}</span></div>
                <div class="value">${customers ? customers.total : "—"}</div>
                <div class="sub">${accounts ? `${accounts.total} cuenta(s) abiertas` : "Cuentas no disponibles"}</div>
            </div>
            <div class="card stat">
                <div class="stat-top"><span class="label">Mensajes en DLQ</span><span class="stat-icon">${svg("alert")}</span></div>
                <div class="value" style="color:${dead ? "var(--bad)" : "inherit"}">${dead}</div>
                <div class="sub">${pendingEvents} evento(s) por publicar</div>
            </div>
            <div class="card stat">
                <div class="stat-top"><span class="label">Servicios en línea</span><span class="stat-icon ${h && up === services.length ? "" : "is-dark"}">${svg("server")}</span></div>
                <div class="value" style="color:${h && up === services.length ? "var(--good)" : "var(--bad)"}">${h ? `${up}/${services.length}` : "—"}</div>
                <div class="sub">${h ? (up === services.length ? "Todo operativo" : "Hay servicios caídos") : "Gateway sin respuesta"}</div>
            </div>
        </div>

        <div class="grid g-main" style="margin-top:16px">
            <div class="card">
                <div class="card-head"><div><h3>Volumen 24 h por tipo</h3><p>Movimientos del ledger en las últimas 24 horas</p></div><a href="${BASE}movimientos.html">Ver movimientos</a></div>
                ${
                    byType.length
                        ? `<div class="hbars">${byType
                              .map(
                                  t => `
                    <div class="hbar-row">
                        <div class="hbar-top"><span>${esc(TX[t.type] || t.type)} <small>· ${t.count} · ${esc(t.currency)}</small></span><b>${esc(money(t.amount, t.currency))}</b></div>
                        <div class="hbar"><i style="width:${Math.max(3, (t.amount / maxType) * 100)}%"></i></div>
                    </div>`
                              )
                              .join("")}</div>`
                        : `<p class="muted">${ledger ? "Sin movimientos en las últimas 24 horas." : "Ledger no disponible."}</p>`
                }
            </div>
            <div class="card">
                <div class="card-head"><div><h3>Cuadre contable</h3><p>Saldos contra asientos del ledger</p></div></div>
                ${
                    recon
                        ? `
                    <div class="recon ${recon.ok ? "" : "is-bad"}">${svg(recon.ok ? "check" : "alert")}<div>${recon.ok ? "Saldos y asientos cuadran" : "Hay descuadres"}<div style="font-weight:500;font-size:.78rem;opacity:.85">Revisado ${esc(fdate(recon.checkedAt))}</div></div></div>
                    <dl class="kv" style="margin-top:14px">
                        <dt>Saldos descuadrados</dt><dd>${recon.balanceMismatches.length}</dd>
                        <dt>Asientos huérfanos</dt><dd>${recon.orphanEntries.length}</dd>
                        <dt>Transacciones desbalanceadas</dt><dd>${recon.unbalancedTransactions.length}</dd>
                    </dl>`
                        : '<p class="muted">Ledger no disponible.</p>'
                }
            </div>
        </div>

        <div class="grid g3" style="margin-top:16px">
            <div class="card">
                <div class="card-head"><h3>Alertas</h3>${alerts.length ? `<span class="badge b-bad">${alerts.length}</span>` : '<span class="badge b-good">Sin alertas</span>'}</div>
                ${
                    alerts.length
                        ? `<ul class="feed">${alerts
                              .slice(0, 6)
                              .map(
                                  a => `
                    <li><span class="dot-icon ${a.cls}">${svg(a.icon)}</span><div class="feed-body"><strong>${esc(a.title)}</strong><small>${esc(a.sub)}</small></div><a class="feed-side" href="${a.href}">Ver</a></li>`
                              )
                              .join("")}</ul>`
                        : `<div class="empty">${svg("check")}<span>Todo en orden. No hay nada que atender.</span></div>`
                }
            </div>
            <div class="card">
                <div class="card-head"><h3>Clientes nuevos</h3><a href="${BASE}clientes.html">Ver todos</a></div>
                ${
                    recent.length
                        ? `<ul class="feed">${recent
                              .map((c, i) => {
                                  const name = kycName(names[i]) || c.email;
                                  return `<li class="clickable-li" data-user="${esc(c.idUser)}" style="cursor:pointer"><span class="avatar">${esc(initials(name))}</span><div class="feed-body"><strong>${esc(name)}</strong><small>${esc(c.email)}</small></div><span class="feed-side">${esc(ago(c.createdAt))}</span></li>`;
                              })
                              .join("")}</ul>`
                        : `<p class="muted">${customers ? "Aún no hay registros." : "Auth no disponible."}</p>`
                }
            </div>
            <div class="card">
                <div class="card-head"><h3>Actividad del equipo</h3><a href="${BASE}auditoria.html">Auditoría</a></div>
                ${
                    activity.length
                        ? `<ul class="feed">${activity
                              .map(
                                  a => `
                    <li><span class="avatar">${esc(initials(a.staffUsername))}</span><div class="feed-body"><strong>${esc(ACTIONS[a.action] || a.action)}</strong><small>@${esc(a.staffUsername)} · ${esc(a.targetType)} ${short(a.targetId)}</small></div><span class="feed-side">${esc(ago(a.createdAt))}</span></li>`
                              )
                              .join("")}</ul>`
                        : '<p class="muted">Todavía no hay acciones registradas.</p>'
                }
            </div>
        </div>`;

    $("refresh").onclick = () => {
        renderDashboard(el);
        toast("Datos actualizados.");
    };
    el.querySelectorAll("[data-user]").forEach(li => (li.onclick = () => openCustomer(li.dataset.user)));
}

// =========================================================
// 8. CLIENTES
// =========================================================

const customerFilters = { q: "", access: "", page: 1 };

async function renderCustomers(el) {
    const f = customerFilters;

    el.innerHTML =
        pageHead(
            "Clientes",
            "Busca por nombre, documento, correo, teléfono o ID de usuario.",
            `<button class="btn btn-sm" id="exportC" disabled>${svg("download")} Exportar</button>`
        ) +
        `
        <form class="filters" id="cf">
            <div class="grow"><label for="cq">Buscar</label><div class="search-input">${svg("search")}<input id="cq" value="${esc(f.q)}" placeholder="Ej.: Laura Gómez, 1020304050, laura@correo.com"></div></div>
            <div><label for="ca">Acceso</label><select id="ca"><option value="">Todos</option>${Object.entries(ACCESS)
                .map(([k, [t]]) => `<option value="${k}" ${f.access === k ? "selected" : ""}>${t}</option>`)
                .join("")}</select></div>
            <button class="btn btn-primary" type="submit">Buscar</button>
        </form>
        <div class="chips">
            <span class="chip ${!f.access ? "active" : ""}" data-access="">Todos</span>
            ${Object.entries(ACCESS)
                .map(
                    ([k, [t]]) => `<span class="chip ${f.access === k ? "active" : ""}" data-access="${k}">${t}</span>`
                )
                .join("")}
        </div>
        <div id="cres">${loadingBox}</div>`;

    $("cf").onsubmit = e => {
        e.preventDefault();
        Object.assign(f, { q: $("cq").value.trim(), access: $("ca").value, page: 1 });
        renderCustomers(el);
    };
    el.querySelectorAll("[data-access]").forEach(
        chip =>
            (chip.onclick = () => {
                Object.assign(f, { access: chip.dataset.access, page: 1 });
                renderCustomers(el);
            })
    );

    try {
        // Credenciales (auth) y expedientes (kyc) viven en servicios distintos: se combinan por idUser.
        const [auth, kyc] = await Promise.all([
            api("GET", "/auth/admin/customers" + qs({ q: f.q, status: f.access, page: f.page, limit: 25 })),
            f.q ? tryApi("GET", "/kyc/admin/records" + qs({ q: f.q, limit: 25 })) : Promise.resolve(null),
        ]);
        const rows = new Map(auth.items.map(c => [c.idUser, { auth: c }]));
        if (kyc && !f.access) for (const k of kyc.items) rows.set(k.idUser, { ...(rows.get(k.idUser) || {}), kyc: k });
        // Completa el nombre de los que solo llegaron por auth.
        await Promise.all(
            [...rows.entries()]
                .filter(([, r]) => !r.kyc)
                .map(async ([id, r]) => {
                    r.kyc = await tryApi("GET", `/kyc/admin/records/${id}/resumen`);
                })
        );
        const list = [...rows.entries()];

        $("cres").innerHTML = list.length
            ? `<div class="table-wrap"><table>
            <thead><tr><th>Cliente</th><th>Correo</th><th>Acceso</th><th>Identidad</th><th>Cliente desde</th></tr></thead>
            <tbody>${list
                .map(
                    ([id, r]) => `
                <tr class="clickable" data-user="${esc(id)}">
                    <td>${who(kycName(r.kyc) || "Sin datos de identidad", `<span class="mono">${short(id)}</span>`)}</td>
                    <td>${esc(r.auth?.email || "—")}</td>
                    <td>${r.auth ? badge(ACCESS, r.auth.access) : '<span class="badge b-gray">Sin credenciales</span>'}</td>
                    <td>${r.kyc ? badge(KYC, r.kyc.status) : '<span class="badge b-gray">Sin KYC</span>'}</td>
                    <td>${fdate(r.auth?.createdAt || r.kyc?.createdAt, "day")}</td>
                </tr>`
                )
                .join("")}
            </tbody></table></div>${pager(auth, p => {
                f.page = p;
                renderCustomers(el);
            })}`
            : emptyBox("No se encontraron clientes", "Prueba con otra búsqueda o quita los filtros.", "customers");

        $("cres")
            .querySelectorAll("tr[data-user]")
            .forEach(tr => (tr.onclick = () => openCustomer(tr.dataset.user)));
        $("exportC").disabled = !list.length;
        $("exportC").onclick = () =>
            downloadCSV("clientes-banklite.csv", [
                ["ID", "Nombre", "Tipo de documento", "Correo", "Acceso", "Identidad", "Cliente desde"],
                ...list.map(([id, r]) => [
                    id,
                    kycName(r.kyc),
                    r.kyc?.tipoDocumento || "",
                    r.auth?.email,
                    ACCESS[r.auth?.access]?.[0] || "",
                    KYC[r.kyc?.status]?.[0] || "",
                    fdate(r.auth?.createdAt || r.kyc?.createdAt, "day"),
                ]),
            ]);
    } catch (err) {
        $("cres").innerHTML = errorBox(err);
    }
}

function openCustomer(idUser) {
    openDrawer("Ficha del cliente", async body => {
        const [auth, kyc, accounts, cards, notifs] = await Promise.all([
            tryApi("GET", `/auth/admin/customers/${idUser}`),
            tryApi("GET", `/kyc/admin/records/${idUser}/resumen`),
            tryApi("GET", "/accounts/admin/accounts" + qs({ q: idUser, limit: 50 })),
            tryApi("GET", "/cards/admin/cards" + qs({ userId: idUser, limit: 50 })),
            tryApi("GET", "/notifications/admin/notifications" + qs({ idUser, limit: 5 })),
        ]);
        const name = kycName(kyc) || auth?.email || idUser;

        body.innerHTML = `
            <div class="card">
                <div class="profile-head">
                    <span class="avatar">${esc(initials(name))}</span>
                    <div style="flex:1;min-width:0"><h2>${esc(name)}</h2><p class="muted mono">${esc(idUser)}</p></div>
                </div>
                <div class="actions" style="margin-top:14px">
                    ${auth ? badge(ACCESS, auth.access) : '<span class="badge b-gray">Sin credenciales</span>'} ${kyc ? badge(KYC, kyc.status) : '<span class="badge b-gray">Sin KYC</span>'}
                </div>
                ${auth?.access === "disabled" ? `<div class="alert alert-error" style="margin-top:14px">Acceso suspendido el ${fdate(auth.disabledAt)}. Motivo: ${esc(auth.disabledReason || "—")}</div>` : ""}
                ${auth?.access === "locked" ? `<div class="alert alert-warn" style="margin-top:14px">Bloqueo temporal por intentos fallidos hasta ${fdate(auth.lockedUntil)}.</div>` : ""}
                <div class="actions" style="margin-top:14px">
                    ${
                        isAdmin() && auth
                            ? auth.access === "disabled"
                                ? `<button class="btn btn-sm btn-primary" id="cEnable">${svg("check")} Reactivar acceso</button>`
                                : `<button class="btn btn-sm btn-danger" id="cDisable">${svg("lock")} Suspender acceso</button>${auth.access === "locked" ? ` <button class="btn btn-sm" id="cEnable">${svg("check")} Quitar bloqueo temporal</button>` : ""}`
                            : ""
                    }
                </div>
            </div>

            <div class="section-title"><h3>Identidad (KYC)</h3></div>
            <div class="card" id="kycBox">${kycSummaryHtml(kyc)}</div>

            <div class="section-title"><h3>Acceso a la app</h3></div>
            <div class="card">${
                auth
                    ? `<dl class="kv">
                <dt>Correo de acceso</dt><dd>${esc(auth.email)}</dd>
                <dt>Sesiones activas</dt><dd>${esc(auth.activeSessions ?? 0)}</dd>
                <dt>Último ingreso</dt><dd>${fdate(auth.lastLoginAt)}</dd>
                <dt>Intentos fallidos</dt><dd>${esc(auth.failedLoginAttempts ?? 0)}</dd>
                <dt>Cliente desde</dt><dd>${fdate(auth.createdAt)}</dd>
            </dl>`
                    : '<p class="muted">Todavía no creó usuario y contraseña.</p>'
            }</div>

            <div class="section-title"><h3>Cuentas</h3></div>
            ${
                accounts?.items?.length
                    ? `<div class="table-wrap"><table class="mini-table">
                <thead><tr><th>Número</th><th>Tipo</th><th>Estado</th><th>Apertura</th></tr></thead>
                <tbody>${accounts.items
                    .map(
                        a => `
                    <tr class="clickable" data-acc="${esc(a.id)}"><td class="mono">${esc(a.accountNumber || "—")}</td><td>${esc(ACC_TYPE[a.accountType] || a.accountType)} · ${esc(a.currency)}</td><td>${badge(ACC_STATUS, a.status, blockedBy(a))}</td><td>${fdate(a.createdAt, "day")}</td></tr>`
                    )
                    .join("")}
                </tbody></table></div>`
                    : `<div class="card"><p class="muted">${accounts ? "Sin cuentas." : "Cuentas no disponibles."}</p></div>`
            }

            <div class="section-title"><h3>Tarjetas</h3></div>
            ${cardTable(cards)}

            <div class="section-title"><h3>Notificaciones recientes</h3></div>
            ${
                notifs?.items?.length
                    ? `<div class="card"><ul class="feed">${notifs.items
                          .map(
                              n => `
                <li><span class="dot-icon ${n.status === "sent" ? "is-good" : n.status === "failed" ? "is-bad" : "is-warn"}">${svg("mail")}</span><div class="feed-body"><strong>${esc(n.title)}</strong><small>${esc(CHANNEL[n.channel] || n.channel)} · ${esc(NOTIF[n.status]?.[0] || n.status)}</small></div><span class="feed-side">${esc(ago(n.createdAt))}</span></li>`
                          )
                          .join("")}</ul></div>`
                    : '<div class="card"><p class="muted">Sin notificaciones.</p></div>'
            }`;

        body.querySelectorAll("tr[data-acc]").forEach(tr => (tr.onclick = () => openAccount(tr.dataset.acc)));
        bindDeclines(body);
        bindKycActions(idUser, name, kyc);

        $("cDisable")?.addEventListener("click", () =>
            formModal({
                title: "Suspender acceso del cliente",
                danger: true,
                confirm: "Suspender",
                desc: `${esc(name)} no podrá iniciar sesión y se cerrarán todas sus sesiones abiertas. Sus cuentas y su dinero no cambian.`,
                fields: [reasonField],
                onSubmit: async v => {
                    await api("POST", `/auth/admin/customers/${idUser}/disable`, { reason: v.reason });
                    toast("Acceso suspendido.");
                    refreshAll();
                },
            })
        );

        $("cEnable")?.addEventListener("click", () =>
            formModal({
                title: "Reactivar acceso del cliente",
                confirm: "Reactivar",
                icon: "check",
                desc: `${esc(name)} podrá volver a iniciar sesión. También se levanta el bloqueo temporal por intentos fallidos.`,
                fields: [reasonField],
                onSubmit: async v => {
                    await api("POST", `/auth/admin/customers/${idUser}/enable`, { reason: v.reason });
                    toast("Acceso reactivado.");
                    refreshAll();
                },
            })
        );
    });
}

// Tarjetas (solo lectura: card-service no expone acciones de administración)
// ---------- Identidad (KYC) en la ficha del cliente ----------
// Cualquier empleado ve el resumen. Cumplimiento y Administración abren los datos
// personales (cada apertura queda en la auditoría) y aprueban a mano los rechazos
// por validaciones fallidas o datos que no coincidieron.

function kycSummaryHtml(k) {
    if (!k) return '<p class="muted">El cliente no tiene verificación de identidad.</p>';
    const manual = k.reviewedBy
        ? `<dt>Aprobada a mano</dt><dd>@${esc(k.reviewedBy)} (${esc(ROLE[k.reviewedByRole] || k.reviewedByRole || "—")}) · ${fdate(k.reviewedAt)}</dd>`
        : "";
    const reason =
        k.status === "rejected" || k.reviewedBy
            ? `<dt>Motivo del rechazo</dt><dd>${esc(k.rejectionLabel || "Motivo no registrado")}</dd>`
            : "";
    let actions;
    if (!canCompliance()) {
        actions =
            '<p class="muted" style="margin-top:12px">Los datos personales solo los ve Cumplimiento o un administrador.</p>';
    } else {
        const approve = k.approvable
            ? `<button class="btn btn-sm btn-primary" id="kycApprove">${svg("check")} Aprobar verificación</button>`
            : "";
        const hard =
            k.status === "rejected" && !k.approvable
                ? '<p class="muted" style="margin-top:10px">Este rechazo no se puede aprobar a mano.</p>'
                : "";
        actions = `<div class="actions" style="margin-top:14px"><button class="btn btn-sm" id="kycFull">${svg("user")} Ver datos de identidad</button>${approve}</div>${hard}`;
    }
    return `<dl class="kv">
        <dt>Nombre</dt><dd>${esc(kycName(k))}</dd>
        <dt>Tipo de documento</dt><dd>${esc(k.tipoDocumento)}</dd>
        <dt>Estado</dt><dd>${badge(KYC, k.status)}</dd>
        ${reason}${manual}
        <dt>Actualizado</dt><dd>${fdate(k.updatedAt)}</dd>
    </dl>${actions}`;
}

function kycFullHtml(k) {
    return `<dl class="kv">
        <dt>Nombre</dt><dd>${esc(kycName(k))}</dd>
        <dt>Documento</dt><dd class="mono">${esc(k.tipoDocumento)} ${esc(k.numeroDocumento)}</dd>
        <dt>Nacimiento</dt><dd>${esc(k.fechaNacimiento || "—")}</dd>
        <dt>Expedición</dt><dd>${esc(k.fechaExpedicion || "—")}</dd>
        <dt>Correo</dt><dd>${esc(k.email || "—")}</dd>
        <dt>Celular</dt><dd class="mono">${esc(k.telefono || "—")}</dd>
        <dt>Estado</dt><dd>${badge(KYC, k.status)}</dd>
        ${k.rejectionCode ? `<dt>Motivo del rechazo</dt><dd>${esc(k.rejectionLabel)}${k.rejectionMessage ? `<div class="muted">${esc(k.rejectionMessage)}</div>` : ""}</dd>` : ""}
        <dt>Actualizado</dt><dd>${fdate(k.updatedAt)}</dd>
    </dl>
    <p class="muted" style="margin-top:10px">Esta consulta quedó registrada en la auditoría.</p>
    ${k.approvable ? `<div class="actions" style="margin-top:12px"><button class="btn btn-sm btn-primary" id="kycApprove">${svg("check")} Aprobar verificación</button></div>` : ""}`;
}

function bindKycActions(idUser, name, kyc) {
    const box = $("kycBox");
    if (!box || !kyc) return;

    const bindApprove = current =>
        $("kycApprove")?.addEventListener("click", () =>
            formModal({
                title: "Aprobar verificación de identidad",
                confirm: "Aprobar",
                icon: "check",
                desc:
                    `Se activará la cuenta de ${esc(name)}. Motivo del rechazo: <strong>${esc(current.rejectionLabel || "—")}</strong>.` +
                    (ME?.hasDocumento
                        ? ""
                        : "<br><br>Tu usuario no tiene documento registrado: pídele a un administrador que lo agregue para poder aprobar."),
                fields: [
                    {
                        ...reasonField,
                        label: "Motivo de la aprobación (mínimo 10 caracteres; queda en la auditoría)",
                        placeholder: "Ej.: Revisé el documento con el cliente; el nombre tenía una tilde de más",
                    },
                ],
                onSubmit: async v => {
                    if (v.reason.length < 10)
                        throw new Error("Explica el motivo de la aprobación (mínimo 10 caracteres).");
                    await api("POST", `/kyc/admin/records/${idUser}/approve`, { reason: v.reason });
                    toast("Verificación aprobada. La cuenta se activa en unos segundos.");
                    refreshAll();
                },
            })
        );

    $("kycFull")?.addEventListener("click", async () => {
        box.innerHTML = loadingBox;
        try {
            const full = await api("GET", `/kyc/admin/records/${idUser}`);
            box.innerHTML = kycFullHtml(full);
            bindApprove(full);
        } catch (err) {
            box.innerHTML = errorBox(err);
        }
    });
    bindApprove(kyc);
}

// ---------- Intentos de cargo rechazados de una tarjeta ----------
function bindDeclines(container) {
    container.querySelectorAll("[data-declines]").forEach(button =>
        button.addEventListener("click", async () => {
            const data = await tryApi("GET", `/cards/admin/cards/${button.dataset.declines}/declines`);
            const rows = data?.items || [];
            formModal({
                title: `Cargos rechazados · •••• ${data?.card?.lastFour || ""}`,
                confirm: "Cerrar",
                icon: "card",
                desc: rows.length
                    ? `<div class="table-wrap"><table class="mini-table">
                        <thead><tr><th>Fecha</th><th>Comercio</th><th>Monto</th><th>Canal</th><th>Motivo</th></tr></thead>
                        <tbody>${rows
                            .map(
                                d =>
                                    `<tr><td>${fdate(d.createdAt)}</td><td>${esc(d.merchantName)}</td><td>${money(d.amount, d.currency)}</td><td>${d.channel === "online" ? "Internet" : "Tienda física"}</td><td>${esc(d.reason || "—")}</td></tr>`
                            )
                            .join("")}</tbody></table></div>`
                    : data
                      ? "Esta tarjeta no tiene cargos rechazados."
                      : "No se pudieron consultar los cargos rechazados.",
                onSubmit: async () => {},
            });
        })
    );
}

const cardTable = cards =>
    cards?.items?.length
        ? `<div class="table-wrap"><table class="mini-table">
    <thead><tr><th>Tarjeta</th><th>Cuenta</th><th>Vence</th><th>Estado</th><th>Cargos rechazados</th></tr></thead>
    <tbody>${cards.items
        .map(
            c => `
        <tr><td class="mono">•••• ${esc(c.lastFour)}</td><td class="mono">${esc(c.accountNumber)}</td><td class="mono">${esc(c.expiry)}</td><td>${c.status === "active" ? '<span class="badge b-good">Activa</span>' : '<span class="badge b-info">Congelada</span>'}</td><td>${c.declinedCount ? `<button class="btn btn-sm" data-declines="${esc(c.id)}">${esc(c.declinedCount)}</button>` : '<span class="muted">0</span>'}</td></tr>`
        )
        .join("")}
    </tbody></table></div>`
        : `<div class="card"><p class="muted">${cards ? "Sin tarjetas." : "Tarjetas no disponibles."}</p></div>`;

// =========================================================
// 9. CUENTAS
// =========================================================

const accountFilters = { q: "", status: "", page: 1 };

async function renderAccounts(el) {
    const f = accountFilters;

    el.innerHTML =
        pageHead(
            "Cuentas",
            "Busca por número de cuenta o ID del cliente.",
            `<button class="btn btn-sm" id="exportA" disabled>${svg("download")} Exportar</button>`
        ) +
        `
        <form class="filters" id="af">
            <div class="grow"><label for="aq">Buscar</label><div class="search-input">${svg("search")}<input id="aq" value="${esc(f.q)}" placeholder="Número de cuenta o ID de usuario"></div></div>
            <div><label for="as">Estado</label><select id="as"><option value="">Todos</option>${Object.entries(
                ACC_STATUS
            )
                .map(([k, [t]]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${t}</option>`)
                .join("")}</select></div>
            <button class="btn btn-primary" type="submit">Buscar</button>
        </form>
        <div class="chips">
            <span class="chip ${!f.status ? "active" : ""}" data-status="">Todas</span>
            ${Object.entries(ACC_STATUS)
                .map(
                    ([k, [t]]) => `<span class="chip ${f.status === k ? "active" : ""}" data-status="${k}">${t}s</span>`
                )
                .join("")}
        </div>
        <div id="ares">${loadingBox}</div>`;

    $("af").onsubmit = e => {
        e.preventDefault();
        Object.assign(f, { q: $("aq").value.trim(), status: $("as").value, page: 1 });
        renderAccounts(el);
    };
    el.querySelectorAll("[data-status]").forEach(
        chip =>
            (chip.onclick = () => {
                Object.assign(f, { status: chip.dataset.status, page: 1 });
                renderAccounts(el);
            })
    );

    try {
        const data = await api(
            "GET",
            "/accounts/admin/accounts" + qs({ q: f.q, status: f.status, page: f.page, limit: 25 })
        );
        $("ares").innerHTML = data.items.length
            ? `<div class="table-wrap"><table>
            <thead><tr><th>Número</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th class="amount">Límite diario</th><th class="amount">Límite mensual</th><th>Apertura</th></tr></thead>
            <tbody>${data.items
                .map(
                    a => `
                <tr class="clickable" data-acc="${esc(a.id)}">
                    <td class="mono"><strong>${esc(a.accountNumber || "—")}</strong></td>
                    <td class="mono">${short(a.idUser)}</td>
                    <td>${esc(ACC_TYPE[a.accountType] || a.accountType)} · ${esc(a.currency)}</td>
                    <td>${badge(ACC_STATUS, a.status, blockedBy(a))}</td>
                    <td class="amount">${money(a.dailyLimit, a.currency)}</td>
                    <td class="amount">${money(a.monthlyLimit, a.currency)}</td>
                    <td>${fdate(a.createdAt, "day")}</td>
                </tr>`
                )
                .join("")}
            </tbody></table></div>${pager(data, p => {
                f.page = p;
                renderAccounts(el);
            })}`
            : emptyBox("No se encontraron cuentas", "Prueba con otra búsqueda o quita los filtros.", "accounts");

        $("ares")
            .querySelectorAll("tr[data-acc]")
            .forEach(tr => (tr.onclick = () => openAccount(tr.dataset.acc)));
        $("exportA").disabled = !data.items.length;
        $("exportA").onclick = () =>
            downloadCSV("cuentas-banklite.csv", [
                ["Cuenta", "ID cliente", "Tipo", "Moneda", "Estado", "Límite diario", "Límite mensual", "Apertura"],
                ...data.items.map(a => [
                    a.accountNumber,
                    a.idUser,
                    ACC_TYPE[a.accountType] || a.accountType,
                    a.currency,
                    ACC_STATUS[a.status]?.[0],
                    a.dailyLimit,
                    a.monthlyLimit,
                    fdate(a.createdAt, "day"),
                ]),
            ]);
    } catch (err) {
        $("ares").innerHTML = errorBox(err);
    }
}

function openAccount(id) {
    openDrawer("Detalle de la cuenta", async body => {
        let acc;
        try {
            acc = await api("GET", `/accounts/admin/accounts/${id}`);
        } catch (err) {
            body.innerHTML = errorBox(err);
            return;
        }

        const [bal, txs, kyc, cards] = await Promise.all([
            tryApi("GET", `/ledger/admin/accounts/${id}/balance`),
            tryApi("GET", "/ledger/admin/transactions" + qs({ accountId: id, limit: 8 })),
            tryApi("GET", `/kyc/admin/records/${acc.idUser}/resumen`),
            tryApi("GET", "/cards/admin/cards" + qs({ accountId: id, limit: 20 })),
        ]);
        const canEdit = isAdmin() && acc.status !== "closed";

        body.innerHTML = `
            <div class="money-head">
                <div><small>${esc((ACC_TYPE[acc.accountType] ? "Cuenta " + ACC_TYPE[acc.accountType] : "Cuenta").toUpperCase())} · ${esc(acc.currency)}</small><h2 class="mono">${esc(acc.accountNumber || "Sin número")}</h2></div>
                <div style="text-align:right"><small>SALDO</small><p class="big">${bal ? money(bal.balance, acc.currency) : "—"}</p></div>
            </div>
            <div class="card">
                <div class="actions">${badge(ACC_STATUS, acc.status, blockedBy(acc, true))}</div>
                ${acc.status === "closed" ? '<div class="alert alert-info" style="margin-top:12px">Cuenta cerrada. No se puede reabrir ni modificar.</div>' : ""}
                ${
                    canEdit
                        ? `<div class="actions" style="margin-top:14px">
                    ${acc.status === "active" ? `<button class="btn btn-sm btn-danger" id="aBlock">${svg("lock")} Bloquear</button>` : ""}
                    ${acc.status === "blocked" ? `<button class="btn btn-sm btn-primary" id="aUnblock">${svg("check")} Desbloquear</button>` : ""}
                    ${acc.status === "active" && acc.accountType !== "merchant" ? `<button class="btn btn-sm btn-primary" id="aCredit">${svg("money")} Abonar</button>` : ""}
                    ${acc.status !== "pending" ? '<button class="btn btn-sm" id="aLimits">Cambiar límites</button>' : ""}
                    <button class="btn btn-sm btn-ghost-danger" id="aClose">Cerrar cuenta</button>
                </div>`
                        : ""
                }
            </div>

            <div class="section-title"><h3>Datos</h3></div>
            <div class="card"><dl class="kv">
                <dt>Titular</dt><dd>${kyc ? `<a href="#" id="aOwner">${esc(kycName(kyc))}</a>` : `<a href="#" id="aOwner" class="mono">${esc(acc.idUser)}</a>`}</dd>
                <dt>Límite diario</dt><dd class="mono">${money(acc.dailyLimit, acc.currency)}</dd>
                <dt>Límite mensual</dt><dd class="mono">${money(acc.monthlyLimit, acc.currency)}</dd>
                <dt>Apertura</dt><dd>${fdate(acc.createdAt)}</dd>
                <dt>Última modificación</dt><dd>${fdate(acc.updatedAt)}</dd>
                <dt>ID</dt><dd class="mono">${esc(acc.id)}</dd>
            </dl></div>

            <div class="section-title"><h3>Tarjetas</h3></div>
            ${cardTable(cards)}

            <div class="section-title"><h3>Últimos movimientos</h3><a class="btn btn-sm" href="${BASE}movimientos.html?cuenta=${encodeURIComponent(id)}">Ver todos</a></div>
            ${txs ? moveTable(txs.items, id) : '<div class="card"><p class="muted">Ledger no disponible.</p></div>'}`;

        bindMoveRows(body);
        $("aOwner").onclick = e => {
            e.preventDefault();
            openCustomer(acc.idUser);
        };

        const setStatus = (status, title, desc, danger) =>
            formModal({
                title,
                desc,
                danger,
                confirm: "Confirmar",
                icon: "accounts",
                fields: [reasonField],
                onSubmit: async v => {
                    await api("PATCH", `/accounts/admin/accounts/${id}/status`, { status, reason: v.reason });
                    toast("Estado de la cuenta actualizado.");
                    refreshAll();
                },
            });

        $("aBlock")?.addEventListener("click", () =>
            setStatus(
                "blocked",
                "Bloquear cuenta",
                "La cuenta no podrá enviar ni recibir dinero. El titular no podrá desbloquearla desde la app.",
                true
            )
        );

        $("aUnblock")?.addEventListener("click", () =>
            setStatus("active", "Desbloquear cuenta", "La cuenta vuelve a operar con normalidad.", false)
        );

        $("aClose")?.addEventListener("click", () =>
            setStatus(
                "closed",
                "Cerrar cuenta",
                `<strong>Es definitivo:</strong> una cuenta cerrada no se puede reabrir ni modificar.${bal ? ` Saldo actual: <strong>${esc(money(bal.balance, acc.currency))}</strong>.` : ""}`,
                true
            )
        );

        $("aCredit")?.addEventListener("click", () => {
            // Una clave por formulario: si se reenvía (doble clic, error de red), no se abona dos veces.
            const idempotencyKey = crypto.randomUUID();
            formModal({
                title: "Abonar a la cuenta",
                confirm: "Abonar",
                icon: "money",
                desc: `Abono a la cuenta <strong class="mono">${esc(acc.accountNumber)}</strong> desde la cuenta de sistema <em>Abonos administrativos</em>. Queda en la auditoría con tu usuario y el motivo; el cliente verá "Abono BankLite: motivo".`,
                fields: [
                    {
                        name: "amount",
                        label: `Monto (${acc.currency})`,
                        type: "number",
                        min: 1,
                        step: "0.01",
                        required: true,
                    },
                    {
                        name: "reason",
                        label: "Motivo (obligatorio, lo ve el cliente)",
                        type: "textarea",
                        required: true,
                        max: 120,
                        placeholder: "Ej.: Saldo inicial para la presentación",
                    },
                ],
                onSubmit: async v => {
                    const amount = Number(v.amount);
                    if (!(amount > 0)) throw new Error("Escribe un monto mayor que cero.");
                    if (v.reason.length < 5) throw new Error("El motivo debe tener al menos 5 caracteres.");
                    await api("POST", "/ledger/admin/credits", {
                        accountNumber: acc.accountNumber,
                        amount,
                        reason: v.reason.slice(0, 120),
                        idempotencyKey,
                    });
                    toast(`Abono de ${money(amount, acc.currency)} realizado.`);
                    refreshAll();
                },
            });
        });

        $("aLimits")?.addEventListener("click", () =>
            formModal({
                title: "Cambiar límites de transferencia",
                confirm: "Guardar",
                icon: "money",
                desc: "Aplican a las transferencias que el cliente hace desde la app.",
                fields: [
                    {
                        name: "dailyLimit",
                        label: `Límite diario (${acc.currency})`,
                        type: "number",
                        value: acc.dailyLimit,
                        min: 0,
                        step: "0.01",
                        required: true,
                    },
                    {
                        name: "monthlyLimit",
                        label: `Límite mensual (${acc.currency})`,
                        type: "number",
                        value: acc.monthlyLimit,
                        min: 0,
                        step: "0.01",
                        required: true,
                    },
                    reasonField,
                ],
                onSubmit: async v => {
                    const daily = Number(v.dailyLimit),
                        monthly = Number(v.monthlyLimit);
                    if (!(daily >= 0) || !(monthly >= 0)) throw new Error("Los límites deben ser números válidos.");
                    if (daily > monthly) throw new Error("El límite diario no puede ser mayor que el mensual.");
                    await api("PATCH", `/accounts/admin/accounts/${id}/limits`, {
                        dailyLimit: daily,
                        monthlyLimit: monthly,
                        reason: v.reason,
                    });
                    toast("Límites actualizados.");
                    refreshAll();
                },
            })
        );
    });
}

// =========================================================
// 10. MOVIMIENTOS (y reversos)
// =========================================================

// perspective: ID de cuenta para mostrar el signo (+ entra, − sale)
function moveTable(items, perspective = null) {
    if (!items.length) return emptyBox("Sin movimientos", "No hay movimientos para mostrar.", "movements");
    return `<div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Origen → Destino</th><th>Descripción</th><th class="amount">Monto</th><th></th></tr></thead>
        <tbody>${items
            .map(t => {
                const sign = perspective ? (t.destinationAccountId === perspective ? "+" : "−") : "";
                return `<tr class="clickable" data-tx="${esc(t.id)}">
                <td style="white-space:nowrap">${fdate(t.createdAt)}</td>
                <td>${esc(TX[t.type] || t.type)}</td>
                <td class="mono">${esc(t.sourceAccountNumber || "Sistema")} → ${esc(t.destinationAccountNumber || "—")}</td>
                <td>${esc(t.description || "—")}</td>
                <td class="amount ${sign === "+" ? "in" : ""}">${sign}${money(t.amount, t.currency)}</td>
                <td>${t.reversed ? '<span class="badge b-info">Reversado</span>' : t.type === "reversal" ? '<span class="badge b-gray">Reverso</span>' : ""}</td>
            </tr>`;
            })
            .join("")}
        </tbody></table></div>`;
}

const bindMoveRows = root =>
    root.querySelectorAll("tr[data-tx]").forEach(tr => (tr.onclick = () => openTransaction(tr.dataset.tx)));

const moveFilters = { account: "", accountId: "", type: "", from: "", to: "", page: 1 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El ledger filtra por ID de cuenta: si escriben el número, se busca su ID en account-service.
async function resolveAccountId(value) {
    if (!value || UUID.test(value)) return value;
    const found = await api("GET", "/accounts/admin/accounts" + qs({ q: value, limit: 5 }));
    const acc = found.items.find(a => a.accountNumber === value);
    if (!acc) throw new Error(`No existe la cuenta ${value}.`);
    return acc.id;
}

async function renderMovements(el) {
    const f = moveFilters;

    el.innerHTML =
        pageHead(
            "Movimientos",
            "Todas las transacciones del ledger (doble partida).",
            `<button class="btn btn-sm" id="exportM" disabled>${svg("download")} Exportar</button>`
        ) +
        `
        <form class="filters" id="mf">
            <div class="grow"><label for="mq">Cuenta</label><div class="search-input">${svg("search")}<input id="mq" value="${esc(f.account)}" placeholder="Opcional: número o ID de la cuenta"></div></div>
            <div><label for="mt">Tipo</label><select id="mt"><option value="">Todos</option>${Object.entries(TX)
                .map(([k, t]) => `<option value="${k}" ${f.type === k ? "selected" : ""}>${t}</option>`)
                .join("")}</select></div>
            <div><label for="mfrom">Desde</label><input type="date" id="mfrom" value="${esc(f.from)}"></div>
            <div><label for="mto">Hasta</label><input type="date" id="mto" value="${esc(f.to)}"></div>
            <button class="btn btn-primary" type="submit">Filtrar</button>
            ${f.account || f.type || f.from || f.to ? '<button class="btn" type="button" id="mclear">Limpiar</button>' : ""}
        </form>
        <div id="mres">${loadingBox}</div>`;

    $("mf").onsubmit = e => {
        e.preventDefault();
        Object.assign(f, {
            account: $("mq").value.trim(),
            accountId: null,
            type: $("mt").value,
            from: $("mfrom").value,
            to: $("mto").value,
            page: 1,
        });
        renderMovements(el);
    };
    $("mclear")?.addEventListener("click", () => {
        Object.assign(f, { account: "", accountId: "", type: "", from: "", to: "", page: 1 });
        renderMovements(el);
    });

    try {
        if (f.accountId === null || (f.account && !f.accountId)) f.accountId = await resolveAccountId(f.account);
        // "Hasta" incluye todo ese día (hora de Colombia).
        const from = f.from ? new Date(f.from + "T00:00:00-05:00").toISOString() : "";
        const to = f.to ? new Date(new Date(f.to + "T00:00:00-05:00").getTime() + 86400000).toISOString() : "";
        const data = await api(
            "GET",
            "/ledger/admin/transactions" +
                qs({ accountId: f.accountId, type: f.type, from, to, page: f.page, limit: 25 })
        );

        const ins = f.accountId
            ? data.items.filter(t => t.destinationAccountId === f.accountId).reduce((s, t) => s + t.amount, 0)
            : 0;
        const outs = f.accountId
            ? data.items.filter(t => t.sourceAccountId === f.accountId).reduce((s, t) => s + t.amount, 0)
            : 0;

        $("mres").innerHTML = `
            <div class="chips">
                <span class="chip">Movimientos <b>${data.total}</b></span>
                ${f.accountId ? `<span class="chip">Entradas (esta página) <b style="color:var(--good)">+${money(ins)}</b></span><span class="chip">Salidas (esta página) <b>−${money(outs)}</b></span>` : ""}
            </div>
            ${moveTable(data.items, f.accountId || null)}${
                data.items.length
                    ? pager(data, p => {
                          f.page = p;
                          renderMovements(el);
                      })
                    : ""
            }`;

        bindMoveRows($("mres"));
        $("exportM").disabled = !data.items.length;
        $("exportM").onclick = () =>
            downloadCSV("movimientos-banklite.csv", [
                ["Fecha", "Tipo", "Cuenta origen", "Cuenta destino", "Descripción", "Monto", "Moneda", "ID", "Estado"],
                ...data.items.map(t => [
                    fdate(t.createdAt),
                    TX[t.type] || t.type,
                    t.sourceAccountNumber || "Sistema",
                    t.destinationAccountNumber,
                    t.description,
                    t.amount,
                    t.currency,
                    t.id,
                    t.reversed ? "Reversado" : "",
                ]),
            ]);
    } catch (err) {
        $("mres").innerHTML = errorBox(err);
    }
}

function openTransaction(id) {
    openDrawer("Detalle del movimiento", async body => {
        let t;
        try {
            t = await api("GET", `/ledger/admin/transactions/${id}`);
        } catch (err) {
            body.innerHTML = errorBox(err);
            return;
        }
        const canReverse = isAdmin() && t.type !== "reversal" && !t.reversal && t.sourceAccountId;
        const entries = t.entries || [];

        body.innerHTML = `
            <div class="money-head">
                <div><small>${esc((TX[t.type] || t.type).toUpperCase())}</small><p class="big">${money(t.amount, t.currency)}</p><p style="margin-top:6px;color:rgba(255,255,255,.8);font-size:.86rem">${esc(t.description || "")}</p></div>
                <div style="text-align:right"><small>ID</small><p class="mono" style="margin-top:6px">${short(t.id)}</p></div>
            </div>
            ${t.reversal ? `<div class="alert alert-info">Reversado el ${fdate(t.reversal.createdAt)}: ${esc(t.reversal.description)}</div>` : ""}
            ${t.reversedTransactionId ? `<div class="alert alert-info">Este movimiento es el reverso de <a href="#" id="tOrig" class="mono">${short(t.reversedTransactionId)}</a></div>` : ""}
            ${canReverse ? `<div class="actions"><button class="btn btn-sm btn-danger" id="tRev">${svg("refresh")} Reversar movimiento</button></div>` : ""}

            <div class="section-title"><h3>Datos</h3></div>
            <div class="card"><dl class="kv">
                <dt>Fecha</dt><dd>${fdate(t.createdAt)}</dd>
                <dt>Cuenta origen</dt><dd class="mono">${esc(t.sourceAccountNumber || "Sistema")}</dd>
                <dt>Cuenta destino</dt><dd class="mono">${esc(t.destinationAccountNumber || t.destinationAccountId || "—")}</dd>
                <dt>Iniciada por</dt><dd class="mono">${esc(t.userId || "Sistema")}</dd>
                <dt>ID</dt><dd class="mono">${esc(t.id)}</dd>
                <dt>Idempotencia</dt><dd class="mono">${esc(t.idempotencyKey || "—")}</dd>
            </dl></div>

            <div class="section-title"><h3>Asientos contables</h3></div>
            <div class="table-wrap"><table class="mini-table">
                <thead><tr><th>Cuenta</th><th class="amount">Débito / crédito</th></tr></thead>
                <tbody>${entries.map(e => `<tr><td class="mono">${esc(e.accountId)}</td><td class="amount ${e.amount >= 0 ? "in" : ""}">${e.amount >= 0 ? "+" : ""}${money(e.amount, e.currency)}</td></tr>`).join("")}
                    <tr><td><strong>Total (debe ser 0)</strong></td><td class="amount"><strong>${money(
                        entries.reduce((a, e) => a + Number(e.amount), 0),
                        t.currency
                    )}</strong></td></tr>
                </tbody>
            </table></div>`;

        $("tOrig")?.addEventListener("click", e => {
            e.preventDefault();
            openTransaction(t.reversedTransactionId);
        });

        $("tRev")?.addEventListener("click", () =>
            formModal({
                title: "Reversar movimiento",
                danger: true,
                confirm: "Reversar",
                desc: `Se devolverán <strong>${esc(money(t.amount, t.currency))}</strong> a la cuenta de origen con asientos contrarios. Solo se puede hacer una vez, y falla si el destinatario ya no tiene ese saldo.`,
                fields: [{ ...reasonField, label: "Motivo (máx. 120 caracteres, queda en la auditoría)", max: 120 }],
                onSubmit: async v => {
                    await api("POST", `/ledger/admin/transactions/${id}/reversal`, { reason: v.reason.slice(0, 120) });
                    toast("Movimiento reversado.");
                    refreshAll();
                },
            })
        );
    });
}

// =========================================================
// 11. MONITOREO
// =========================================================

async function renderMonitoring(el) {
    el.innerHTML = loadingBox;

    const [h, authOb, kycOb, recon, accDlq, notDlq, fraudDlq, compDlq, failed, pending] = await Promise.all([
        health(),
        tryApi("GET", "/auth/admin/outbox"),
        tryApi("GET", "/kyc/admin/outbox"),
        tryApi("GET", "/ledger/admin/reconciliation"),
        tryApi("GET", "/accounts/admin/dlq"),
        tryApi("GET", "/notifications/admin/dlq"),
        tryApi("GET", "/fraud/admin/dlq"),
        tryApi("GET", "/compliance/admin/dlq"),
        tryApi("GET", "/notifications/admin/notifications" + qs({ status: "failed", limit: 20 })),
        tryApi("GET", "/notifications/admin/notifications" + qs({ status: "pending", channel: "email", limit: 20 })),
    ]);

    const services = h?.services || [];
    const upList = services.filter(s => s.status === "ok");
    const avgLatency = upList.length
        ? Math.round(upList.reduce((a, s) => a + (Number(s.latencyMs) || 0), 0) / upList.length)
        : null;
    const outboxTotal = (authOb?.pending || 0) + (kycOb?.pending || 0) + (recon?.pendingEvents?.count || 0);

    const outboxRow = (name, ob) =>
        ob
            ? `<tr><td class="mono">${name}</td><td>${esc(ob.pending)}</td><td>${esc(ob.failing ?? "—")}</td><td>${fdate(ob.oldestPending)}</td><td>${ob.brokerConnected === false ? '<span class="badge b-bad">Sin RabbitMQ</span>' : '<span class="badge b-good">Conectado</span>'}</td></tr>`
            : `<tr><td class="mono">${name}</td><td colspan="4" class="muted">No disponible</td></tr>`;

    const dlqCard = (name, path, d) => `
        <div class="card">
            <div class="card-head"><div><h3>${esc(name)}</h3><p class="mono">${esc(d?.queue || path + ".events")}</p></div>${d?.connected ? (d.deadLetters ? `<span class="badge b-bad">${d.deadLetters} en DLQ</span>` : '<span class="badge b-good">Vacía</span>') : '<span class="badge b-gray">Sin conexión</span>'}</div>
            ${
                d?.connected
                    ? `
                <dl class="kv"><dt>Por procesar</dt><dd>${esc(d.ready)}</dd><dt>Consumidores</dt><dd>${esc(d.consumers)}</dd><dt>Esperando reintento</dt><dd>${esc(d.waitingRetry)}</dd><dt>Mensajes muertos</dt><dd style="color:${d.deadLetters ? "var(--bad)" : "inherit"}">${esc(d.deadLetters)}</dd></dl>
                <div class="actions" style="margin-top:12px">${d.deadLetters ? `<button class="btn btn-sm" data-peek="${path}">Ver mensajes</button>${isAdmin() ? `<button class="btn btn-sm btn-primary" data-requeue="${path}">Reprocesar</button>` : ""}` : '<span class="muted" style="font-size:.8rem">Sin mensajes muertos.</span>'}</div>
                <div data-peekout="${path}"></div>`
                    : '<p class="muted">El consumidor no está conectado a RabbitMQ.</p>'
            }
        </div>`;

    const notifTable = list =>
        list?.items?.length
            ? `<div class="table-wrap"><table>
        <thead><tr><th>Notificación</th><th>Cliente</th><th>Intentos</th><th>Último error</th><th>Fecha</th><th></th></tr></thead>
        <tbody>${list.items
            .map(
                n => `
            <tr><td><strong>${esc(n.title)}</strong><div class="muted mono" style="font-size:.72rem">${esc(n.event)}</div></td>
            <td class="mono">${short(n.idUser)}</td>
            <td>${esc(n.deliveryAttempts ?? 0)}</td>
            <td style="color:var(--bad)">${esc(n.lastError || "—")}${n.nextAttemptAt ? `<div class="muted">Próximo: ${fdate(n.nextAttemptAt)}</div>` : ""}</td>
            <td>${fdate(n.createdAt)}</td>
            <td>${hasRole("support", "admin") ? `<button class="btn btn-sm" data-retry="${esc(n.id)}">Reintentar</button>` : ""}</td></tr>`
            )
            .join("")}
        </tbody></table></div>`
            : emptyBox(
                  list ? "Ninguno" : "No disponible",
                  list ? "No hay correos en este estado." : "notification-service no respondió.",
                  "mail"
              );

    el.innerHTML =
        pageHead(
            "Monitoreo",
            "Salud técnica: servicios, eventos, colas y correos. Valores del momento de la consulta.",
            `<button class="btn btn-sm" id="refresh">${svg("refresh")} Actualizar</button>`
        ) +
        `

        <div class="grid g4">
            <div class="card stat"><div class="stat-top"><span class="label">Servicios en línea</span><span class="stat-icon">${svg("server")}</span></div><div class="value" style="color:${h && upList.length === services.length ? "var(--good)" : "var(--bad)"}">${h ? `${upList.length}/${services.length}` : "—"}</div><div class="sub">${h ? (upList.length === services.length ? "Todo operativo" : `${services.length - upList.length} caído(s)`) : "Gateway sin respuesta"}</div></div>
            <div class="card stat"><div class="stat-top"><span class="label">Latencia promedio</span><span class="stat-icon">${svg("monitoring")}</span></div><div class="value">${avgLatency !== null ? avgLatency + " ms" : "—"}</div><div class="sub">Medida por el gateway en /health</div></div>
            <div class="card stat"><div class="stat-top"><span class="label">Eventos por publicar</span><span class="stat-icon">${svg("movements")}</span></div><div class="value" style="color:${outboxTotal ? "var(--warn)" : "inherit"}">${outboxTotal}</div><div class="sub">Outbox de auth, kyc y ledger</div></div>
            <div class="card stat"><div class="stat-top"><span class="label">Correos fallidos</span><span class="stat-icon">${svg("mail")}</span></div><div class="value" style="color:${failed?.total ? "var(--warn)" : "inherit"}">${failed ? failed.total : "—"}</div><div class="sub">${pending ? `${pending.total} en reintento automático` : "notification-service no respondió"}</div></div>
        </div>

        <div class="section-title" style="margin:22px 0 12px"><h3>Microservicios (vía API Gateway)</h3></div>
        ${serviceRows(h)}

        <div class="grid g2" style="margin-top:16px">
            <div class="card">
                <div class="card-head"><div><h3>Cuadre contable y outbox</h3><p>Asientos de doble partida y eventos pendientes de publicar</p></div></div>
                ${recon ? `<div class="recon ${recon.ok ? "" : "is-bad"}">${svg(recon.ok ? "check" : "alert")}<div>${recon.ok ? "Saldos y asientos cuadran" : "Hay descuadres"}<div style="font-weight:500;font-size:.78rem;opacity:.85">Revisado ${esc(fdate(recon.checkedAt))}</div></div></div>` : '<p class="muted">Ledger no disponible.</p>'}
                <div class="table-wrap" style="margin-top:14px;box-shadow:none"><table class="mini-table">
                    <thead><tr><th>Outbox</th><th>Pendientes</th><th>Con fallos</th><th>Más antiguo</th><th>Broker</th></tr></thead>
                    <tbody>
                        ${outboxRow("auth-service", authOb)}
                        ${outboxRow("kyc-service", kycOb)}
                        ${recon ? `<tr><td class="mono">ledger-service</td><td>${esc(recon.pendingEvents.count)}</td><td>—</td><td>${fdate(recon.pendingEvents.oldest)}</td><td>—</td></tr>` : '<tr><td class="mono">ledger-service</td><td colspan="4" class="muted">No disponible</td></tr>'}
                    </tbody>
                </table></div>
                ${
                    recon?.systemAccounts?.length
                        ? `
                    <h3 style="margin-top:18px;font-size:.92rem">Cuentas del sistema (contrapartidas)</h3>
                    <div class="table-wrap" style="margin-top:10px;box-shadow:none"><table class="mini-table">
                        <thead><tr><th>Cuenta</th><th>ID</th><th class="amount">Saldo</th></tr></thead>
                        <tbody>${recon.systemAccounts.map(a => `<tr><td>${esc(a.name)}</td><td class="mono">${short(a.accountId)}</td><td class="amount">${money(a.balance, a.currency)}</td></tr>`).join("")}</tbody>
                    </table></div>
                    <p class="muted" style="margin-top:6px;font-size:.78rem">Un saldo negativo es el dinero que entró a clientes por esa vía.</p>`
                        : ""
                }
            </div>
            <div class="grid" style="gap:16px">
                ${dlqCard("account-service", "accounts", accDlq)}
                ${dlqCard("notification-service", "notifications", notDlq)}
                ${dlqCard("fraud-service", "fraud", fraudDlq)}
                ${dlqCard("compliance-service", "compliance", compDlq)}
            </div>
        </div>

        <div class="section-title" style="margin:22px 0 12px"><h3>Correos fallidos</h3></div>
        ${notifTable(failed)}

        <div class="section-title" style="margin:22px 0 12px"><h3>Correos en reintento automático</h3></div>
        ${notifTable(pending)}`;

    $("refresh").onclick = () => {
        renderMonitoring(el);
        toast("Monitoreo actualizado.");
    };

    el.querySelectorAll("[data-peek]").forEach(
        b =>
            (b.onclick = async () => {
                const out = el.querySelector(`[data-peekout="${b.dataset.peek}"]`);
                out.innerHTML = loadingBox;
                try {
                    const msgs = await api("GET", `/${b.dataset.peek}/admin/dlq/messages`);
                    out.innerHTML =
                        msgs
                            .map(
                                m =>
                                    `<p style="margin-top:12px;font-size:.8rem"><strong>${esc(m.routingKey)}</strong> · ${esc(m.attempts)} intento(s) · <span style="color:var(--bad)">${esc(m.lastError || "")}</span></p><pre class="json">${esc(JSON.stringify(m.message, null, 2))}</pre>`
                            )
                            .join("") || '<p class="muted">Vacía.</p>';
                } catch (err) {
                    out.innerHTML = `<p style="color:var(--bad);margin-top:10px">${esc(err.message)}</p>`;
                }
            })
    );

    el.querySelectorAll("[data-requeue]").forEach(
        b =>
            (b.onclick = () =>
                formModal({
                    title: "Reprocesar mensajes de la DLQ",
                    confirm: "Reprocesar",
                    icon: "refresh",
                    desc: "Se devuelven a la cola principal (hasta 100) con el contador de intentos en cero. Hazlo después de corregir la causa del fallo.",
                    fields: [],
                    onSubmit: async () => {
                        const r = await api("POST", `/${b.dataset.requeue}/admin/dlq/requeue`);
                        toast(`${r.moved} mensaje(s) devueltos a la cola.`);
                        refreshAll();
                    },
                }))
    );

    el.querySelectorAll("[data-retry]").forEach(
        b =>
            (b.onclick = async () => {
                b.disabled = true;
                b.innerHTML = '<span class="spin"></span>';
                try {
                    const r = await api("POST", `/notifications/admin/notifications/${b.dataset.retry}/retry`);
                    toast(
                        r.status === "sent"
                            ? "Correo enviado."
                            : "El envío volvió a fallar; quedó programado para reintento.",
                        r.status !== "sent"
                    );
                    refreshAll();
                } catch (err) {
                    toast(err.message, true);
                    b.disabled = false;
                    b.textContent = "Reintentar";
                }
            })
    );
}

// =========================================================
// 12. EMPLEADOS (solo administradores)
// =========================================================

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;
const PASSWORD_MESSAGE = "La contraseña debe tener 12 o más caracteres, con mayúsculas, minúsculas y números.";

async function renderStaff(el) {
    el.innerHTML = loadingBox;

    let list;
    try {
        list = await api("GET", "/auth/admin/staff");
    } catch (err) {
        el.innerHTML = errorBox(err);
        return;
    }

    el.innerHTML =
        pageHead(
            "Empleados",
            "Quién puede entrar al panel y con qué permisos.",
            `<button class="btn btn-primary btn-sm" id="sNew">${svg("plus")} Nuevo empleado</button>`
        ) +
        `
        <div class="perm-card">
            <div class="perm"><strong><span class="badge b-gray">Soporte</span></strong><ul><li>Consulta clientes (sin datos de identidad), cuentas, movimientos y tarjetas</li><li>Ve el monitoreo y reintenta correos</li><li>No ve fraude ni cumplimiento</li></ul></div>
            <div class="perm"><strong><span class="badge b-warn">Cumplimiento</span></strong><ul><li>Ve la identidad completa de los clientes (queda en la auditoría)</li><li>Aprueba a mano verificaciones rechazadas por validaciones fallidas</li><li>Resuelve alertas de fraude y reportes de actividad sospechosa</li><li>Ve las tarjetas en solo lectura</li></ul></div>
            <div class="perm"><strong><span class="badge b-info">Administrador</span></strong><ul><li>Todo lo de soporte y cumplimiento</li><li>Suspende clientes, bloquea o cierra cuentas, abona y cambia límites</li><li>Reversa movimientos, reprocesa colas y gestiona empleados</li></ul></div>
        </div>
        <div class="table-wrap"><table>
            <thead><tr><th>Empleado</th><th>Rol</th><th>Documento</th><th>Estado</th><th>Último ingreso</th><th>Creado</th><th></th></tr></thead>
            <tbody>${list
                .map(
                    s => `
                <tr>
                    <td>${who(s.nombre, "@" + esc(s.username))}</td>
                    <td>${roleBadge(s.role)}</td>
                    <td>${s.hasDocumento ? '<span class="badge b-good">Registrado</span>' : '<span class="badge b-gray">Falta</span>'}</td>
                    <td>${!s.active ? '<span class="badge b-bad">Desactivado</span>' : s.locked ? '<span class="badge b-warn">Bloqueado 15 min</span>' : '<span class="badge b-good">Activo</span>'}</td>
                    <td>${fdate(s.lastLoginAt)}</td>
                    <td>${fdate(s.createdAt, "day")}</td>
                    <td>${s.id === ME.id ? '<span class="muted">Tú</span>' : `<button class="btn btn-sm" data-edit="${esc(s.id)}">Editar</button>`}</td>
                </tr>`
                )
                .join("")}
            </tbody>
        </table></div>`;

    $("sNew").onclick = () =>
        formModal({
            title: "Nuevo empleado",
            confirm: "Crear",
            icon: "user",
            desc: "Comparte la contraseña inicial por un canal seguro.",
            fields: [
                { name: "nombre", label: "Nombre completo", required: true },
                {
                    name: "username",
                    label: "Usuario (minúsculas, números, . _ -)",
                    required: true,
                    placeholder: "ej.: laura.gomez",
                },
                {
                    name: "password",
                    label: "Contraseña inicial (12+ caracteres, mayúsculas, minúsculas y números)",
                    type: "password",
                    required: true,
                },
                {
                    name: "numeroDocumento",
                    label: "Documento de identidad (necesario para aprobar verificaciones; no se guarda en claro)",
                    placeholder: "Opcional para Soporte",
                },
                {
                    name: "role",
                    label: "Rol",
                    type: "select",
                    value: "support",
                    options: [
                        ["support", "Soporte"],
                        ["compliance", "Cumplimiento"],
                        ["admin", "Administrador"],
                    ],
                },
            ],
            onSubmit: async v => {
                const username = v.username.toLowerCase();
                if (!/^[a-z0-9._-]{3,40}$/.test(username))
                    throw new Error("El usuario solo admite minúsculas, números, punto, guion y guion bajo (3 a 40).");
                if (!PASSWORD_RULE.test(v.password)) throw new Error(PASSWORD_MESSAGE);
                const body = { ...v, username };
                if (!body.numeroDocumento) delete body.numeroDocumento;
                await api("POST", "/auth/admin/staff", body);
                toast("Empleado creado.");
                refreshAll();
            },
        });

    el.querySelectorAll("[data-edit]").forEach(
        b =>
            (b.onclick = () => {
                const s = list.find(x => x.id === b.dataset.edit);
                formModal({
                    title: `Editar a ${s.nombre}`,
                    confirm: "Guardar",
                    icon: "user",
                    fields: [
                        {
                            name: "role",
                            label: "Rol",
                            type: "select",
                            value: s.role,
                            options: [
                                ["support", "Soporte"],
                                ["compliance", "Cumplimiento"],
                                ["admin", "Administrador"],
                            ],
                        },
                        {
                            name: "active",
                            label: "Estado",
                            type: "select",
                            value: String(s.active),
                            options: [
                                ["true", "Activo"],
                                ["false", "Desactivado"],
                            ],
                        },
                        {
                            name: "password",
                            label: "Nueva contraseña (opcional; también lo desbloquea)",
                            type: "password",
                        },
                        {
                            name: "numeroDocumento",
                            label: s.hasDocumento
                                ? "Documento de identidad (ya registrado; escribe uno solo para cambiarlo)"
                                : "Documento de identidad (necesario para aprobar verificaciones)",
                        },
                    ],
                    onSubmit: async v => {
                        const changes = { role: v.role, active: v.active === "true" };
                        if (v.numeroDocumento) changes.numeroDocumento = v.numeroDocumento;
                        if (v.password) {
                            if (!PASSWORD_RULE.test(v.password)) throw new Error(PASSWORD_MESSAGE);
                            changes.password = v.password;
                        }
                        await api("PATCH", `/auth/admin/staff/${s.id}`, changes);
                        toast("Empleado actualizado.");
                        refreshAll();
                    },
                });
            })
    );
}

// =========================================================
// 13. AUDITORÍA
// Cada microservicio guarda la suya; aquí se juntan por fecha.
// =========================================================

const AUDIT_SOURCES = [
    ["auth", "/auth/admin/audit"],
    ["accounts", "/accounts/admin/audit"],
    ["ledger", "/ledger/admin/audit"],
    ["notifications", "/notifications/admin/audit"],
    ["fraud", "/fraud/admin/audit"],
    ["compliance", "/compliance/admin/audit"],
    ["kyc", "/kyc/admin/audit"],
];

async function loadAudit({ q = "", limit = 100 } = {}) {
    const results = await Promise.all(
        AUDIT_SOURCES.map(([svc, path]) =>
            tryApi("GET", path + qs({ q, limit })).then(r => ({
                svc,
                ok: !!r,
                items: (r?.items || []).map(i => ({ ...i, svc })),
            }))
        )
    );
    return {
        items: results.flatMap(r => r.items).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        failed: results.filter(r => !r.ok).map(r => r.svc),
    };
}

const auditFilters = { q: "", staff: "", action: "", hideLogins: true, page: 1 };

async function renderAudit(el) {
    const f = auditFilters;

    el.innerHTML =
        pageHead(
            "Auditoría",
            "Cada acción de un empleado, registrada por el microservicio que la ejecutó.",
            `<button class="btn btn-sm" id="exportAu" disabled>${svg("download")} Exportar</button>`
        ) +
        `
        <form class="filters" id="auf">
            <div class="grow"><label for="auq">ID afectado</label><div class="search-input">${svg("search")}<input id="auq" value="${esc(f.q)}" placeholder="Cliente, cuenta, transacción…"></div></div>
            <div><label for="aus">Empleado</label><select id="aus"><option value="">Todos</option></select></div>
            <div><label for="aua">Acción</label><select id="aua"><option value="">Todas</option>${Object.entries(
                ACTIONS
            )
                .map(([k, t]) => `<option value="${k}" ${f.action === k ? "selected" : ""}>${esc(t)}</option>`)
                .join("")}</select></div>
            <div><label for="aul">Ingresos al panel</label><select id="aul"><option value="1" ${f.hideLogins ? "selected" : ""}>Ocultar</option><option value="0" ${!f.hideLogins ? "selected" : ""}>Mostrar</option></select></div>
            <button class="btn btn-primary" type="submit">Filtrar</button>
        </form>
        <div id="aures">${loadingBox}</div>`;

    $("auf").onsubmit = e => {
        e.preventDefault();
        Object.assign(f, {
            q: $("auq").value.trim(),
            staff: $("aus").value,
            action: $("aua").value,
            hideLogins: $("aul").value === "1",
            page: 1,
        });
        renderAudit(el);
    };

    const { items: all, failed } = await loadAudit({ q: f.q, limit: 200 });
    const staffNames = [...new Set(all.map(a => a.staffUsername))].sort();
    $("aus").innerHTML =
        `<option value="">Todos</option>${staffNames.map(n => `<option value="${esc(n)}" ${f.staff === n ? "selected" : ""}>@${esc(n)}</option>`).join("")}`;

    const list = all.filter(
        a =>
            (!f.hideLogins || a.action !== "staff.login") &&
            (!f.staff || a.staffUsername === f.staff) &&
            (!f.action || a.action === f.action)
    );

    const size = 20;
    const pageList = list.slice((f.page - 1) * size, f.page * size);

    $("aures").innerHTML = `
        ${failed.length ? `<div class="alert alert-warn" style="margin-bottom:12px">No respondió la auditoría de: ${esc(failed.join(", "))}.</div>` : ""}
        ${
            pageList.length
                ? `<div class="table-wrap"><table>
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Acción</th><th>Afectado</th><th>Motivo</th><th>Servicio</th></tr></thead>
            <tbody>${pageList
                .map(
                    a => `
                <tr>
                    <td style="white-space:nowrap">${fdate(a.createdAt)}</td>
                    <td>${who(a.staffUsername, (a.staffRole ? esc(ROLE[a.staffRole] || a.staffRole) + " · " : "") + "@" + esc(a.staffUsername))}</td>
                    <td><strong>${esc(ACTIONS[a.action] || a.action)}</strong>${a.details ? `<div class="muted mono" style="font-size:.7rem">${esc(JSON.stringify(a.details).slice(0, 120))}</div>` : ""}</td>
                    <td class="mono">${esc(a.targetType || "")} ${short(a.targetId)}</td>
                    <td>${esc(a.reason || "—")}</td>
                    <td><span class="badge b-gray">${esc(a.svc)}</span></td>
                </tr>`
                )
                .join("")}
            </tbody></table></div>${pager({ total: list.length, page: f.page, limit: size }, p => {
                f.page = p;
                renderAudit(el);
            })}`
                : emptyBox("Sin registros", "Las acciones de los empleados aparecerán aquí.", "audit")
        }`;

    $("exportAu").disabled = !list.length;
    $("exportAu").onclick = () =>
        downloadCSV("auditoria-banklite.csv", [
            ["Fecha", "Empleado", "Acción", "Tipo", "ID afectado", "Motivo", "Servicio"],
            ...list.map(a => [
                fdate(a.createdAt),
                a.staffUsername,
                ACTIONS[a.action] || a.action,
                a.targetType,
                a.targetId,
                a.reason,
                a.svc,
            ]),
        ]);
}

// =========================================================
// 13b. FRAUDE
// Transacciones marcadas por el motor de reglas de fraud-service. Nunca se
// bloquea una cuenta ni se reversa dinero desde aquí: solo se confirma o
// descarta la alerta (decisión de alcance, ver README sección 4).
// =========================================================

const FLAG_STATUS = {
    pending: ["Pendiente", "b-warn"],
    confirmed: ["Confirmada", "b-bad"],
    dismissed: ["Descartada", "b-gray"],
};

const fraudFilters = { status: "", page: 1 };

async function renderFraud(el) {
    const f = fraudFilters;

    el.innerHTML =
        pageHead("Fraude", "Transacciones marcadas por el motor de reglas para revisión manual.") +
        `
        <form class="filters" id="frf">
            <div><label for="frs">Estado</label><select id="frs"><option value="">Todos</option>${Object.entries(
                FLAG_STATUS
            )
                .map(([k, [t]]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${t}</option>`)
                .join("")}</select></div>
            <button class="btn btn-primary" type="submit">Filtrar</button>
        </form>
        <div id="frres">${loadingBox}</div>`;

    $("frf").onsubmit = e => {
        e.preventDefault();
        Object.assign(f, { status: $("frs").value, page: 1 });
        renderFraud(el);
    };

    try {
        const data = await api("GET", "/fraud/admin/flags" + qs({ status: f.status, page: f.page, limit: 25 }));
        $("frres").innerHTML = data.items.length
            ? `<div class="table-wrap"><table>
            <thead><tr><th>Fecha</th><th>Cuenta</th><th>Score</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
            <tbody>${data.items
                .map(
                    x => `
                <tr>
                    <td>${fdate(x.createdAt)}</td>
                    <td class="mono">${short(x.accountId)}</td>
                    <td><strong style="color:${x.score >= 80 ? "var(--bad)" : x.score >= 60 ? "var(--warn)" : "inherit"}">${esc(x.score)}</strong></td>
                    <td>${esc((x.reason || "").slice(0, 80))}</td>
                    <td>${badge(FLAG_STATUS, x.status)}</td>
                    <td><button class="btn btn-sm" data-open="${esc(x.id)}">Ver</button></td>
                </tr>`
                )
                .join("")}
            </tbody></table></div>${pager(data, p => {
                f.page = p;
                renderFraud(el);
            })}`
            : emptyBox("Sin alertas", "Las transacciones marcadas por el motor de reglas aparecerán aquí.", "fraud");
        el.querySelectorAll("[data-open]").forEach(b => (b.onclick = () => openFlag(b.dataset.open)));
    } catch (err) {
        $("frres").innerHTML = errorBox(err);
    }
}

function openFlag(id) {
    openDrawer("Alerta de fraude", async body => {
        let x;
        try {
            x = await api("GET", `/fraud/admin/flags/${id}`);
        } catch (err) {
            body.innerHTML = errorBox(err);
            return;
        }

        body.innerHTML = `
            <div class="money-head">
                <div><small>SCORE</small><p class="big">${esc(x.score)}</p></div>
                <div style="text-align:right">${badge(FLAG_STATUS, x.status)}</div>
            </div>

            <div class="section-title"><h3>Datos</h3></div>
            <div class="card"><dl class="kv">
                <dt>Cuenta</dt><dd class="mono">${esc(x.accountId)}</dd>
                <dt>Transacción</dt><dd class="mono">${esc(x.transactionId)}</dd>
                <dt>Cliente</dt><dd class="mono">${short(x.idUser)}</dd>
                <dt>Fecha</dt><dd>${fdate(x.createdAt)}</dd>
                ${x.reviewedBy ? `<dt>Revisado por</dt><dd>@${esc(x.reviewedBy)} — ${fdate(x.reviewedAt)}</dd>` : ""}
                ${x.resolutionNote ? `<dt>Nota</dt><dd>${esc(x.resolutionNote)}</dd>` : ""}
            </dl></div>

            <div class="section-title"><h3>Reglas disparadas</h3></div>
            <div class="table-wrap"><table class="mini-table">
                <thead><tr><th>Regla</th><th>Puntos</th><th>Detalle</th></tr></thead>
                <tbody>${(x.rulesTriggered || []).map(r => `<tr><td class="mono">${esc(r.rule)}</td><td>${esc(r.points)}</td><td>${esc(r.detail)}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">Sin detalle</td></tr>'}</tbody>
            </table></div>

            ${
                canCompliance()
                    ? `<div class="section-title"><h3>Inicios de sesión recientes</h3></div>
            <div id="frLogins"><p class="muted">País y red de los últimos inicios de sesión del cliente (la IP completa no se guarda). Cada consulta queda en la auditoría.</p>
                <button class="btn btn-sm" id="frLoginsLoad">Ver inicios de sesión</button></div>`
                    : ""
            }

            ${
                x.status === "pending" && canCompliance()
                    ? `<div class="actions" style="margin-top:16px">
                <button class="btn btn-sm btn-primary" id="frConfirm">Confirmar fraude</button>
                <button class="btn btn-sm" id="frDismiss">Descartar</button>
            </div>`
                    : ""
            }`;

        $("frLoginsLoad")?.addEventListener("click", () => loadLoginContexts(x.idUser, $("frLogins")));
        $("frConfirm")?.addEventListener("click", () =>
            formModal({
                title: "Confirmar como fraude",
                danger: true,
                confirm: "Confirmar",
                desc: "Queda registrado como confirmado. Esto <strong>no</strong> bloquea la cuenta ni reversa el dinero automáticamente: esas acciones, si corresponden, se hacen aparte desde Cuentas o Movimientos.",
                fields: [reasonField],
                onSubmit: async v => {
                    await api("PATCH", `/fraud/admin/flags/${id}`, { status: "confirmed", note: v.reason });
                    toast("Alerta confirmada.");
                    refreshAll();
                },
            })
        );
        $("frDismiss")?.addEventListener("click", () =>
            formModal({
                title: "Descartar alerta",
                confirm: "Descartar",
                desc: "Se marca como revisada y descartada (falso positivo).",
                fields: [reasonField],
                onSubmit: async v => {
                    await api("PATCH", `/fraud/admin/flags/${id}`, { status: "dismissed", note: v.reason });
                    toast("Alerta descartada.");
                    refreshAll();
                },
            })
        );
    });
}

const LOGIN_OUTCOME = { success: ["Exitoso", "b-good"], failed: ["Fallido", "b-warn"] };
const GEO_STATUS = { ok: "", no_disponible: "Sin geolocalización", privada: "Red privada" };

/** Inicios de sesión del cliente (fraud-service): país, red /24 o /48, Tor y reglas. Solo cumplimiento y admin. */
async function loadLoginContexts(idUser, box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    let data;
    try {
        data = await api("GET", `/fraud/admin/users/${encodeURIComponent(idUser)}/logins`);
    } catch (err) {
        box.innerHTML = errorBox(err);
        return;
    }
    const rows = (data.items || [])
        .map(
            l => `<tr>
                <td>${fdate(l.occurredAt)}</td>
                <td>${badge(LOGIN_OUTCOME, l.outcome)}</td>
                <td>${esc(l.country || GEO_STATUS[l.geoStatus] || "—")}</td>
                <td class="mono">${esc(l.ipPrefix)}</td>
                <td>${l.isTor === true ? '<span class="badge b-bad">Tor</span>' : l.isTor === null ? '<span class="muted">?</span>' : "No"}</td>
                <td>${(l.rulesTriggered || []).map(rule => `<span class="mono" title="${esc(rule.detail)}">${esc(rule.rule)} (+${esc(rule.points)})</span>`).join("<br>") || '<span class="muted">—</span>'}</td>
            </tr>`
        )
        .join("");
    box.innerHTML = `<div class="table-wrap"><table class="mini-table">
            <thead><tr><th>Fecha</th><th>Resultado</th><th>País</th><th>Red</th><th>Tor</th><th>Reglas</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" class="muted">Sin inicios de sesión registrados (se guardan 90 días).</td></tr>'}</tbody>
        </table></div>
        <p class="muted" style="margin-top:8px">Geolocalización: GeoLite2 de MaxMind. Nodos de Tor: lista pública del Tor Project.</p>`;
}

// =========================================================
// 13c. CUMPLIMIENTO
// KPIs, SAR (Reportes de Actividad Sospechosa) y reportes AML de
// compliance-service. Igual que Fraude: aquí solo se radica o descarta un
// SAR, nunca se actúa sobre cuentas o dinero.
// =========================================================

const SAR_STATUS = { open: ["Abierto", "b-warn"], filed: ["Radicado", "b-bad"], dismissed: ["Descartado", "b-gray"] };
const SAR_SEVERITY = { low: ["Baja", "b-gray"], medium: ["Media", "b-warn"], high: ["Alta", "b-bad"] };

const complianceFilters = { status: "", severity: "", page: 1 };

function defaultPeriod() {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86400000);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

async function renderCompliance(el) {
    const f = complianceFilters;
    const period = defaultPeriod();

    el.innerHTML =
        pageHead(
            "Cumplimiento",
            "KPIs de negocio, reportes de actividad sospechosa (SAR) y reportes AML.",
            `<button class="btn btn-sm btn-primary" id="newReport">${svg("plus")} Generar reporte</button>`
        ) +
        `
        <div class="grid g4" id="kpis">${loadingBox}</div>

        <div class="section-title" style="margin:22px 0 12px"><h3>Reportes de Actividad Sospechosa (SAR)</h3></div>
        <form class="filters" id="cf">
            <div><label for="cfs">Estado</label><select id="cfs"><option value="">Todos</option>${Object.entries(
                SAR_STATUS
            )
                .map(([k, [t]]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${t}</option>`)
                .join("")}</select></div>
            <div><label for="cfv">Severidad</label><select id="cfv"><option value="">Todas</option>${Object.entries(
                SAR_SEVERITY
            )
                .map(([k, [t]]) => `<option value="${k}" ${f.severity === k ? "selected" : ""}>${t}</option>`)
                .join("")}</select></div>
            <button class="btn btn-primary" type="submit">Filtrar</button>
        </form>
        <div id="cres">${loadingBox}</div>

        <div class="section-title" style="margin:22px 0 12px"><h3>Reportes AML generados</h3></div>
        <div id="crep">${loadingBox}</div>`;

    $("cf").onsubmit = e => {
        e.preventDefault();
        Object.assign(f, { status: $("cfs").value, severity: $("cfv").value, page: 1 });
        renderCompliance(el);
    };

    tryApi("GET", "/compliance/admin/kpis" + qs({ from: period.from, to: period.to })).then(k => {
        $("kpis").innerHTML = k
            ? `
            <div class="card stat"><div class="stat-top"><span class="label">Transacciones (30 días)</span><span class="stat-icon">${svg("movements")}</span></div><div class="value">${esc(k.totalTransactions)}</div><div class="sub">${esc(period.from)} a ${esc(period.to)}</div></div>
            <div class="card stat"><div class="stat-top"><span class="label">Volumen (30 días)</span><span class="stat-icon">${svg("money")}</span></div><div class="value">${compact(k.totalVolume)}</div><div class="sub">Salidas + ingresos externos</div></div>
            <div class="card stat"><div class="stat-top"><span class="label">Cuentas nuevas</span><span class="stat-icon">${svg("customers")}</span></div><div class="value">${esc(k.newAccounts)}</div><div class="sub">Tasa de aprobación KYC: ${k.kycApprovalRate !== null ? esc(k.kycApprovalRate) + "%" : "—"}</div></div>
            <div class="card stat"><div class="stat-top"><span class="label">SAR abiertos</span><span class="stat-icon">${svg("compliance")}</span></div><div class="value" style="color:${k.openSars ? "var(--warn)" : "inherit"}">${esc(k.openSars)}</div><div class="sub">${esc(k.sarCount)} generados en el periodo</div></div>`
            : emptyBox("No disponible", "compliance-service no respondió.", "server");
    });

    try {
        const data = await api(
            "GET",
            "/compliance/admin/sars" + qs({ status: f.status, severity: f.severity, page: f.page, limit: 25 })
        );
        $("cres").innerHTML = data.items.length
            ? `<div class="table-wrap"><table>
            <thead><tr><th>Fecha</th><th>Cliente</th><th>Origen</th><th>Severidad</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
            <tbody>${data.items
                .map(
                    s => `
                <tr>
                    <td>${fdate(s.createdAt)}</td>
                    <td class="mono">${short(s.idUser)}</td>
                    <td>${s.source === "fraud.alert" ? "Fraud Service" : "Regla AML"}</td>
                    <td>${badge(SAR_SEVERITY, s.severity)}</td>
                    <td>${esc((s.reason || "").slice(0, 80))}</td>
                    <td>${badge(SAR_STATUS, s.status)}</td>
                    <td><button class="btn btn-sm" data-open="${esc(s.id)}">Ver</button></td>
                </tr>`
                )
                .join("")}
            </tbody></table></div>${pager(data, p => {
                f.page = p;
                renderCompliance(el);
            })}`
            : emptyBox("Sin SAR", "Los reportes de actividad sospechosa aparecerán aquí.", "compliance");
        el.querySelectorAll("[data-open]").forEach(b => (b.onclick = () => openSar(b.dataset.open)));
    } catch (err) {
        $("cres").innerHTML = errorBox(err);
    }

    try {
        const reports = await api("GET", "/compliance/admin/reports" + qs({ page: 1, limit: 10 }));
        $("crep").innerHTML = reports.items.length
            ? `<div class="table-wrap"><table>
            <thead><tr><th>Periodo</th><th>Transacciones</th><th>Volumen</th><th>SAR</th><th>Generado por</th><th>Fecha</th></tr></thead>
            <tbody>${reports.items
                .map(
                    r => `
                <tr><td>${esc(r.periodFrom)} a ${esc(r.periodTo)}</td><td>${esc(r.totalTransactions)}</td><td>${money(r.totalVolume)}</td><td>${esc(r.sarCount)}</td><td>@${esc(r.generatedBy)}</td><td>${fdate(r.generatedAt)}</td></tr>`
                )
                .join("")}
            </tbody></table></div>`
            : emptyBox("Sin reportes", "Genera el primero con el botón de arriba.", "compliance");
    } catch (err) {
        $("crep").innerHTML = errorBox(err);
    }

    $("newReport").onclick = () =>
        formModal({
            title: "Generar reporte AML",
            confirm: "Generar",
            icon: "compliance",
            desc: "Calcula un snapshot de KPIs para el periodo indicado y lo guarda de forma permanente (no se puede editar después).",
            fields: [
                { name: "periodFrom", label: "Desde", type: "date", required: true, value: period.from },
                { name: "periodTo", label: "Hasta", type: "date", required: true, value: period.to },
            ],
            onSubmit: async v => {
                await api("POST", "/compliance/admin/reports", { periodFrom: v.periodFrom, periodTo: v.periodTo });
                toast("Reporte generado.");
                refreshAll();
            },
        });
}

function openSar(id) {
    openDrawer("Reporte de Actividad Sospechosa", async body => {
        let s;
        try {
            s = await api("GET", `/compliance/admin/sars/${id}`);
        } catch (err) {
            body.innerHTML = errorBox(err);
            return;
        }

        body.innerHTML = `
            <div class="money-head">
                <div><small>SEVERIDAD</small><p class="big">${badge(SAR_SEVERITY, s.severity)}</p></div>
                <div style="text-align:right">${badge(SAR_STATUS, s.status)}</div>
            </div>

            <div class="section-title"><h3>Datos</h3></div>
            <div class="card"><dl class="kv">
                <dt>Cliente</dt><dd class="mono">${esc(s.idUser)}</dd>
                <dt>Cuenta</dt><dd class="mono">${esc(s.accountId || "—")}</dd>
                <dt>Transacción</dt><dd class="mono">${esc(s.transactionId || "—")}</dd>
                <dt>Origen</dt><dd>${s.source === "fraud.alert" ? "Fraud Service" : "Regla AML propia"}</dd>
                <dt>Motivo</dt><dd>${esc(s.reason)}</dd>
                <dt>Fecha</dt><dd>${fdate(s.createdAt)}</dd>
                ${s.filedBy ? `<dt>Resuelto por</dt><dd>@${esc(s.filedBy)} — ${fdate(s.filedAt)}</dd>` : ""}
                ${s.resolutionNote ? `<dt>Nota</dt><dd>${esc(s.resolutionNote)}</dd>` : ""}
            </dl></div>

            ${
                s.status === "open" && canCompliance()
                    ? `<div class="actions" style="margin-top:16px">
                <button class="btn btn-sm btn-primary" id="sarFile">Radicar</button>
                <button class="btn btn-sm" id="sarDismiss">Descartar</button>
            </div>`
                    : ""
            }`;

        $("sarFile")?.addEventListener("click", () =>
            formModal({
                title: "Radicar SAR",
                confirm: "Radicar",
                desc: "Marca que este reporte fue radicado ante la autoridad competente.",
                fields: [reasonField],
                onSubmit: async v => {
                    await api("PATCH", `/compliance/admin/sars/${id}`, { status: "filed", note: v.reason });
                    toast("SAR radicado.");
                    refreshAll();
                },
            })
        );
        $("sarDismiss")?.addEventListener("click", () =>
            formModal({
                title: "Descartar SAR",
                confirm: "Descartar",
                desc: "Se marca como revisado y descartado (falso positivo).",
                fields: [reasonField],
                onSubmit: async v => {
                    await api("PATCH", `/compliance/admin/sars/${id}`, { status: "dismissed", note: v.reason });
                    toast("SAR descartado.");
                    refreshAll();
                },
            })
        );
    });
}

// =========================================================
// 14. ARRANQUE DE CADA PÁGINA
// =========================================================

const RENDER = {
    dashboard: renderDashboard,
    customers: renderCustomers,
    accounts: renderAccounts,
    movements: renderMovements,
    fraud: renderFraud,
    compliance: renderCompliance,
    monitoring: renderMonitoring,
    staff: renderStaff,
    audit: renderAudit,
};

let PAGE = null;

document.addEventListener("DOMContentLoaded", async () => {
    const pageId = document.body.dataset.page;

    if (pageId === "login") {
        initLoginPage();
        return;
    }

    // Sesión del empleado: token en esta pestaña y actividad reciente.
    if (!TOKEN) return goLogin();
    if (SESSION.expired()) return goLogin("expirada");

    try {
        ME = await api("GET", "/auth/admin/me");
    } catch (err) {
        if (err.status) return goLogin("expirada");
        $("admPage").innerHTML = errorBox(err);
        return;
    }
    SESSION.touch();

    const page = PAGES.find(p => p.id === pageId);
    if (page?.roles && !hasRole(...page.roles)) {
        location.replace(BASE);
        return;
    }

    buildSide();
    buildTop();
    countAlerts().then(n => n && buildSide(n));

    // Filtros que llegan por la dirección (desde otras páginas)
    const p = params();
    if (pageId === "movements" && p.get("cuenta"))
        Object.assign(moveFilters, { account: p.get("cuenta"), accountId: null });

    const el = $("admPage");
    PAGE = { render: () => RENDER[pageId](el) };
    PAGE.render();

    // La sesión vence a los 20 min sin uso.
    ["pointerdown", "keydown", "scroll"].forEach(type =>
        window.addEventListener(type, () => SESSION.touch(), { passive: true })
    );
    setInterval(() => {
        if (SESSION.expired()) goLogin("expirada");
    }, 15000);
});
