// =========================================================
// BANKLITE - CENTRO DE AYUDA (ayuda.html)
// Buscador de preguntas frecuentes y chat con Banki (banki.js).
// =========================================================

// Página ayuda.html
function initHelp() {
    document.querySelectorAll("[data-bot-figure]").forEach(el => {
        el.innerHTML = botAvatarSVG(true);
    });
    document.querySelectorAll("[data-bot-name]").forEach(el => {
        el.textContent = BOT_NAME;
    });

    const back = document.getElementById("helpBack");
    if (back && botLogged()) {
        back.href = "dashboard.html";
        back.lastChild.textContent = " Volver al inicio";
    }

    const chatBox = document.getElementById("helpChat");
    chatBox.innerHTML = botChatMarkup("helpChat");
    chatBox.querySelector("[data-bot-close]").remove();
    const chat = createBotChat(chatBox);
    chat.start();

    // Categorías
    const catBox = document.getElementById("helpCategories");
    catBox.innerHTML = BOT_CATEGORIES.map(
        cat => `
        <button type="button" class="help-cat" data-cat="${cat.id}">
            <span aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${cat.icon}"/></svg></span>
            <b>${cat.title}</b>
            <small>${cat.text}</small>
        </button>`
    ).join("");

    // Preguntas frecuentes
    const faqBox = document.getElementById("helpFaq");
    const empty = document.getElementById("helpEmpty");
    const title = document.getElementById("helpFaqTitle");
    const faqTopics = BOT_TOPICS.filter(topic => topic.faq);
    let activeCat = "";

    function renderFaq(query = "") {
        const q = botNormalize(query);
        const words = q.split(" ").filter(word => word.length > 2);
        const list = faqTopics.filter(topic => {
            if (activeCat && topic.cat !== activeCat) return false;
            if (!words.length) return true;
            const hay = botNormalize(topic.faq + " " + topic.keys.join(" ") + " " + topic.answer().text);
            return words.every(word => hay.includes(word));
        });

        faqBox.innerHTML = list
            .map(topic => {
                const reply = topic.answer();
                const links = (reply.links || [])
                    .map(
                        link =>
                            `<a class="bot-link" href="${link.href}">${escapeHTML(link.label)} <span aria-hidden="true">→</span></a>`
                    )
                    .join("");
                return `
            <details class="help-faq-item">
                <summary>${escapeHTML(topic.faq)}</summary>
                <div>
                    <p>${botFormat(reply.text)}</p>
                    ${links ? `<div class="bot-links">${links}</div>` : ""}
                </div>
            </details>`;
            })
            .join("");

        empty.hidden = list.length > 0;
        const cat = BOT_CATEGORIES.find(item => item.id === activeCat);
        title.textContent = cat ? cat.title : query ? `Resultados para "${query}"` : "Preguntas frecuentes";
        catBox
            .querySelectorAll(".help-cat")
            .forEach(button => button.classList.toggle("active", button.dataset.cat === activeCat));
        document.getElementById("helpClearCat").hidden = !activeCat;
    }

    const search = document.getElementById("helpSearch");
    search.addEventListener("input", () => {
        activeCat = "";
        renderFaq(search.value);
    });

    document.getElementById("helpSearchForm").addEventListener("submit", event => {
        event.preventDefault();
        if (!search.value.trim()) return;
        chat.ask(search.value);
        document.getElementById("helpChat").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    catBox.addEventListener("click", event => {
        const button = event.target.closest("[data-cat]");
        if (!button) return;
        activeCat = activeCat === button.dataset.cat ? "" : button.dataset.cat;
        search.value = "";
        renderFaq();
        document.getElementById("helpFaqSection").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("helpClearCat").addEventListener("click", () => {
        activeCat = "";
        renderFaq();
    });

    empty.querySelector("button").addEventListener("click", () => {
        chat.ask(search.value || "ayuda");
        document.getElementById("helpChat").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    renderFaq();

    // ayuda.html?pregunta=... abre con esa pregunta
    const preset = new URLSearchParams(location.search).get("pregunta");
    if (preset) setTimeout(() => chat.ask(preset), 300);
}

document.addEventListener("DOMContentLoaded", initHelp);
