// =========================================================
// BANKI - ASISTENTE VIRTUAL (burbuja de las vistas internas y ayuda.html)
// Los temas viven en banki-temas.js, que se carga antes.
// Responde con información general; no lee datos de la cuenta.
// =========================================================

// Quita tildes, signos y mayúsculas para comparar palabras
function botNormalize(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9ñ@\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function botLogged() {
    return hasSession();
}

function botMatch(text) {
    const clean = ` ${botNormalize(text)} `;
    if (!clean.trim()) return null;

    let best = null;
    let bestScore = 0;
    const wordCount = clean.trim().split(" ").length;

    BOT_TOPICS.forEach(topic => {
        let score = 0;
        topic.keys.forEach(key => {
            const k = botNormalize(key);
            if (clean.includes(` ${k} `) || (k.length > 4 && clean.includes(k))) {
                score += k.split(" ").length * 2; // las frases pesan más que una palabra
            }
        });
        // Saludos y charla solo cuentan en mensajes cortos, y nunca le ganan a un tema del banco
        if (topic.small && score) score = wordCount <= 4 ? score - 1 : 0;
        if (score > bestScore) {
            bestScore = score;
            best = topic;
        }
    });

    return best;
}

let botOffTopicCount = 0;

function botReply(text) {
    const topic = botMatch(text);
    if (topic) return topic.answer();

    const reply = BOT_OFF_TOPIC[botOffTopicCount % BOT_OFF_TOPIC.length];
    botOffTopicCount++;
    return {
        text: reply,
        chips: ["¿Cómo hago una transferencia?", "¿Dónde descargo mi extracto?", "¿Cómo me protejo del fraude?"],
    };
}

function botFormat(text) {
    return escapeHTML(text)
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/\*(.+?)\*/g, "<i>$1</i>")
        .replace(/\n/g, "<br>");
}

// Chat reutilizable: el mismo en la burbuja y en el Centro de ayuda
function createBotChat(root) {
    const log = root.querySelector(".bot-log");
    const form = root.querySelector(".bot-form");
    const input = root.querySelector(".bot-input");
    let started = false;

    function scroll() {
        log.scrollTop = log.scrollHeight;
    }

    function addUser(text) {
        log.insertAdjacentHTML("beforeend", `<div class="bot-msg is-user"><p>${escapeHTML(text)}</p></div>`);
        scroll();
    }

    function addBot(reply) {
        const links = (reply.links || [])
            .map(
                link =>
                    `<a class="bot-link" href="${link.href}">${escapeHTML(link.label)} <span aria-hidden="true">→</span></a>`
            )
            .join("");
        const chips = (reply.chips || [])
            .map(
                chip =>
                    `<button type="button" class="bot-chip" data-bot-ask="${escapeHTML(chip)}">${escapeHTML(chip)}</button>`
            )
            .join("");
        log.insertAdjacentHTML(
            "beforeend",
            `
            <div class="bot-msg is-bot">
                <span class="bot-avatar" aria-hidden="true">${botAvatarSVG()}</span>
                <div>
                    <p>${botFormat(reply.text)}</p>
                    ${links ? `<div class="bot-links">${links}</div>` : ""}
                    ${chips ? `<div class="bot-chips">${chips}</div>` : ""}
                </div>
            </div>`
        );
        scroll();
    }

    function ask(text) {
        const question = String(text || "").trim();
        if (!question) return;
        addUser(question);

        log.insertAdjacentHTML(
            "beforeend",
            `<div class="bot-msg is-bot bot-typing"><span class="bot-avatar" aria-hidden="true">${botAvatarSVG()}</span><div><p><i></i><i></i><i></i></p></div></div>`
        );
        scroll();

        setTimeout(
            () => {
                log.querySelector(".bot-typing")?.remove();
                addBot(botReply(question));
            },
            450 + Math.min(600, question.length * 12)
        );
    }

    function start() {
        if (started) return;
        started = true;
        addBot({
            text: `¡Hola! Soy **${BOT_NAME}**, tu asistente de Banklite. Pregúntame sobre tu cuenta, transferencias, tu tarjeta o seguridad.`,
            chips: [
                "¿Cómo hago una transferencia?",
                "¿Cómo congelo mi tarjeta?",
                "¿Dónde descargo mi extracto?",
                "Olvidé mi clave",
            ],
        });
    }

    form.addEventListener("submit", event => {
        event.preventDefault();
        ask(input.value);
        input.value = "";
        input.focus();
    });

    log.addEventListener("click", event => {
        const chip = event.target.closest("[data-bot-ask]");
        if (chip) ask(chip.dataset.botAsk);
    });

    return { ask, start, focus: () => input.focus() };
}

// Avatar de Banki: robot con los colores de Banklite (SVG dibujado aquí, sin imágenes)
let botSvgCount = 0;
function botAvatarSVG(full = false) {
    const id = `bkg${++botSvgCount}`;
    const head = `
        <line x1="60" y1="8" x2="60" y2="20" stroke="#1E9EA4" stroke-width="3" stroke-linecap="round"/>
        <circle cx="60" cy="8" r="5" fill="#2CCED2"/>
        <circle cx="58.5" cy="6.5" r="1.6" fill="#ffffff" opacity="0.8"/>
        <rect x="50" y="18" width="20" height="8" rx="3" fill="#1E9EA4"/>
        <rect x="18" y="24" width="84" height="70" rx="32" fill="url(#${id}h)"/>
        <ellipse cx="86" cy="38" rx="6" ry="3.6" fill="#ffffff" opacity="0.55" transform="rotate(-25 86 38)"/>
        <rect x="28" y="44" width="64" height="26" rx="13" fill="#26474E"/>
        <rect x="30" y="46" width="60" height="9" rx="4.5" fill="#ffffff" opacity="0.06"/>
        <circle cx="45" cy="57" r="7" fill="none" stroke="#B9EDED" stroke-width="2.4"/>
        <circle cx="75" cy="57" r="7" fill="none" stroke="#B9EDED" stroke-width="2.4"/>
        <circle cx="45" cy="57" r="3.6" fill="#ffffff"/>
        <circle cx="75" cy="57" r="3.6" fill="#ffffff"/>
        <circle cx="46.6" cy="55.4" r="1.2" fill="#26474E"/>
        <circle cx="76.6" cy="55.4" r="1.2" fill="#26474E"/>
        <path d="M51 77 h18 a9 7 0 0 1 -18 0z" fill="#ffffff"/>
        <path d="M54 81.5 q6 3 12 0" fill="none" stroke="#2CCED2" stroke-width="2" stroke-linecap="round"/>`;
    const defs = `
        <defs>
            <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#B9EDED"/>
                <stop offset="0.45" stop-color="#2CCED2"/>
                <stop offset="1" stop-color="#1A8E94"/>
            </linearGradient>
            <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#5ED9DC"/>
                <stop offset="1" stop-color="#1A8E94"/>
            </linearGradient>
        </defs>`;
    if (!full) {
        return `<svg class="bot-face" viewBox="10 2 100 96" aria-hidden="true">${defs}${head}</svg>`;
    }
    return `<svg class="bot-figure" viewBox="0 0 120 170" aria-hidden="true">${defs}
        <ellipse cx="60" cy="162" rx="28" ry="5" fill="#26474E" opacity="0.15"/>
        <g class="bot-arm"><rect x="8" y="98" width="34" height="14" rx="7" fill="url(#${id}b)" transform="rotate(-28 40 106)"/></g>
        <rect x="34" y="96" width="52" height="52" rx="24" fill="url(#${id}b)"/>
        <rect x="80" y="104" width="14" height="30" rx="7" fill="#1A8E94"/>
        <circle cx="60" cy="118" r="7" fill="#26474E" opacity="0.18"/>
        ${head}
    </svg>`;
}

function botChatMarkup(id) {
    return `
        <div class="bot-head">
            <span class="bot-avatar is-big" aria-hidden="true">${botAvatarSVG()}</span>
            <div>
                <b>${BOT_NAME}</b>
                <small><i class="bot-online"></i> Asistente virtual de Banklite</small>
            </div>
            <button type="button" class="bot-close" data-bot-close aria-label="Cerrar chat">×</button>
        </div>
        <div class="bot-log" id="${id}Log" role="log" aria-live="polite"></div>
        <form class="bot-form" autocomplete="off">
            <label class="visually-hidden" for="${id}Input">Escribe tu pregunta</label>
            <input class="bot-input" id="${id}Input" maxlength="160" placeholder="Escribe tu pregunta…">
            <button type="submit" class="bot-send" aria-label="Enviar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
        </form>
        <p class="bot-disclaimer">${BOT_NAME} solo responde temas de Banklite. Nunca te pedirá tu clave.</p>`;
}

// Burbuja flotante: solo en el dashboard
function initBotBubble() {
    if (document.getElementById("helpPage") || document.getElementById("botBubble")) return;

    // La burbuja va en las vistas internas con el layout compartido (data-page).
    // En las páginas públicas no se carga banki.js: comun.js lleva sus botones a ayuda.html.
    if (!document.body.dataset.page) return;

    document.body.insertAdjacentHTML(
        "beforeend",
        `
        <button type="button" class="bot-bubble" id="botBubble" aria-label="Abrir chat con ${BOT_NAME}" aria-expanded="false" aria-controls="botWidget">
            <span class="bot-bubble-face">${botAvatarSVG()}</span>
            <span class="bot-bubble-label">¿Ayuda? Habla con ${BOT_NAME}</span>
        </button>
        <section class="bot-widget" id="botWidget" role="dialog" aria-label="Chat con ${BOT_NAME}" hidden>
            ${botChatMarkup("botWidget")}
            <a class="bot-more" href="ayuda.html">Ver el Centro de ayuda <span aria-hidden="true">→</span></a>
        </section>`
    );

    const bubble = document.getElementById("botBubble");
    const widget = document.getElementById("botWidget");
    const chat = createBotChat(widget);

    function toggle(open) {
        widget.hidden = !open;
        bubble.setAttribute("aria-expanded", String(open));
        bubble.classList.toggle("is-open", open);
        if (open) {
            chat.start();
            setTimeout(() => chat.focus(), 50);
        }
    }

    bubble.addEventListener("click", () => toggle(widget.hidden));
    widget.querySelector("[data-bot-close]").addEventListener("click", () => toggle(false));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !widget.hidden && !document.querySelector(".modal.active")) toggle(false);
    });

    // Otros botones pueden abrir el chat con [data-open-bot]
    document.querySelectorAll("[data-open-bot]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            toggle(true);
        });
    });
}

document.addEventListener("DOMContentLoaded", initBotBubble);
