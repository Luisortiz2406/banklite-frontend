// =========================================================
// BANKLITE - LLAVES BRE-B: utilidades compartidas
// Tipos de llave, su ícono y cómo se reconoce cada una (mismas reglas que
// account-service). Lo usan llaves.js y transferir.js.
// =========================================================

const BREB_TYPES = {
    celular: { label: 'Celular', hint: 'Tu número de celular', icon: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>' },
    correo: { label: 'Correo', hint: 'Tu correo electrónico', icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>' },
    documento: { label: 'Documento', hint: 'Tu número de cédula', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/>' },
    alfanumerica: { label: 'Llave personalizada', hint: 'Un @nombre fácil de recordar', icon: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>' }
};

const brebSvg = (type, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BREB_TYPES[type]?.icon || BREB_TYPES.alfanumerica.icon}</svg>`;

// Reconoce qué tipo de llave escribió la persona (mismas reglas que account-service).
function brebDetect(raw) {
    const value = String(raw || '').trim();
    const digits = value.replace(/[\s.-]/g, '');
    if (/^@[a-z0-9._]{3,20}$/i.test(value)) return { type: 'alfanumerica', key: value.toLowerCase() };
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) return { type: 'correo', key: value.toLowerCase() };
    if (/^3\d{9}$/.test(digits)) return { type: 'celular', key: digits };
    if (/^\d{6,10}$/.test(digits)) return { type: 'documento', key: digits };
    return null;
}
