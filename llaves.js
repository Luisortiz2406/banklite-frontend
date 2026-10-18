// =========================================================
// BANKLITE - MIS LLAVES BRE-B (llaves.html)
// Mismo diseño y comportamiento que la versión simulada, contra el directorio
// de llaves de account-service (/accounts/keys). Registrar y eliminar exige la
// clave dinámica (la app la adjunta sola). Solo se pueden registrar el celular,
// el correo y la cédula propios, tal como quedaron verificados en Banklite.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("keysPage")) return;
    if (!BlApi.protectPage()) return;

    const { config, session } = BlApi;
    const grid = byId("keysGrid");
    const keyInput = byId("keyValue");
    const state = { keys: [], accountNumber: null, kyc: null };
    let editing = null;

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        const message = err?.message || fallback;
        if (/clave dinámica/i.test(message)) showMessage("No se pudo validar la clave dinámica", message, "!");
        else showMessage("No se pudo completar", message, "!");
    }

    const dynamicCode = async () => (await BlApi.authed(config.authApi, "GET", "/auth/dynamic-key")).code;

    // -----------------------------------------------------
    // CLAVE DINÁMICA
    // -----------------------------------------------------

    document.querySelectorAll("[data-dynamic-open]").forEach(button =>
        button.addEventListener("click", () => {
            openModal("dynamicModal");
            BankliteDynamicKey.mount();
        })
    );

    // -----------------------------------------------------
    // LISTA DE LLAVES
    // -----------------------------------------------------

    // Valor sugerido para cada tipo, tomado de los datos verificados del cliente.
    function suggestion(type) {
        const k = state.kyc || {};
        if (type === "celular")
            return String(k.telefono || "")
                .replace(/\D/g, "")
                .slice(-10);
        if (type === "correo") return k.email || "";
        if (type === "documento") return k.numeroDocumento || "";
        const base = String(k.nombres || "").split(/\s+/)[0] + String(k.apellidos || "").split(/\s+/)[0];
        return (
            "@" +
            base
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9._]/g, "")
                .slice(0, 20)
        );
    }

    function render() {
        setText("keysCount", `${state.keys.length} de 4`);
        setText(
            "keysAccount",
            state.accountNumber ? state.accountNumber.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1 $2 $3") : "-"
        );

        grid.innerHTML = Object.entries(BREB_TYPES)
            .map(([type, info]) => {
                const item = state.keys.find(entry => entry.type === type);
                return `
                <article class="key-card${item ? " is-active" : ""}">
                    <div class="key-card-top">
                        <span class="key-icon">${brebSvg(type)}</span>
                        <span class="panel-chip${item ? " is-on" : ""}">${item ? "Activa" : "Sin registrar"}</span>
                    </div>
                    <small>${escapeHTML(info.label)}</small>
                    <strong>${item ? escapeHTML(item.maskedKey) : escapeHTML(info.hint)}</strong>
                    ${
                        item
                            ? `<span class="key-date">Registrada el ${formatDate(item.createdAt, { dateStyle: "medium" })}</span>
                           <div class="key-actions">
                               <button type="button" class="btn soft" data-key-copy="${escapeHTML(item.key)}">Copiar</button>
                               <button type="button" class="btn soft key-delete" data-key-delete="${type}">Eliminar</button>
                           </div>`
                            : `<button type="button" class="btn primary full" data-key-new="${type}"${state.accountNumber ? "" : " disabled"}>Registrar llave</button>`
                    }
                </article>`;
            })
            .join("");
    }

    function applyList(data) {
        state.keys = data?.keys || [];
        state.accountNumber = data?.accountNumber || null;
        render();
    }

    async function load() {
        try {
            applyList(await BlApi.authed(config.accountApi, "GET", "/accounts/keys"));
            if (!state.accountNumber)
                showMessage("Sin cuenta activa", "Necesitas una cuenta Banklite activa para registrar llaves.", "!");
        } catch (err) {
            fail(err, "No se pudieron cargar tus llaves.");
        }
    }

    // -----------------------------------------------------
    // REGISTRAR
    // -----------------------------------------------------

    function openNew(type) {
        editing = type;
        const info = BREB_TYPES[type];
        setText("keyModalTitle", `Registrar llave: ${info.label}`);
        byId("keyModalIcon").innerHTML = brebSvg(type, 22);
        setText(
            "keyModalHint",
            type === "alfanumerica"
                ? "Empieza con @ y usa de 3 a 20 letras, números, punto o guion bajo."
                : type === "celular"
                  ? "El celular de 10 dígitos que verificaste en Banklite."
                  : type === "correo"
                    ? "El correo que verificaste en Banklite."
                    : "Tu número de documento, sin puntos."
        );
        keyInput.value = suggestion(type);
        keyInput.inputMode =
            type === "celular" || type === "documento" ? "numeric" : type === "correo" ? "email" : "text";
        // Celular, correo y cédula deben ser los verificados: se muestran sin editar si ya los tenemos.
        keyInput.readOnly = type !== "alfanumerica" && Boolean(keyInput.value);
        openModal("keyModal");
    }

    byId("keyForm").addEventListener("submit", async event => {
        event.preventDefault();

        const found = brebDetect(keyInput.value);
        const expected = editing;

        if (!found || found.type !== expected) {
            toast(`Esa no es una llave válida de tipo ${BREB_TYPES[expected].label.toLowerCase()}.`, "err");
            keyInput.focus();
            return;
        }

        closeModalById("keyModal");

        const shown = found.type === "alfanumerica" ? found.key : keyInput.value.trim();
        const ok = await confirmAction(
            "Registrar llave",
            `Vas a registrar ${shown} para recibir dinero en tu cuenta Banklite. Tu clave dinámica se valida automáticamente.`,
            "Registrar"
        );
        if (!ok) return;

        try {
            applyList(
                await BlApi.authed(config.accountApi, "POST", "/accounts/keys", {
                    type: expected,
                    key: found.key,
                    dynamicCode: await dynamicCode(),
                })
            );
            toast("Llave registrada. Ya pueden enviarte plata con ella.", "ok");
        } catch (err) {
            fail(err, "No se pudo registrar la llave.");
        }
    });

    // -----------------------------------------------------
    // COPIAR Y ELIMINAR
    // -----------------------------------------------------

    grid.addEventListener("click", async event => {
        const create = event.target.closest("[data-key-new]");
        if (create) return openNew(create.dataset.keyNew);

        const copy = event.target.closest("[data-key-copy]");
        if (copy) {
            try {
                await navigator.clipboard.writeText(copy.dataset.keyCopy);
                toast("Llave copiada. Compártela para que te envíen dinero.", "ok");
            } catch {
                toast(copy.dataset.keyCopy, "info");
            }
            return;
        }

        const remove = event.target.closest("[data-key-delete]");
        if (!remove) return;

        const item = state.keys.find(entry => entry.type === remove.dataset.keyDelete);
        if (!item) return;

        const confirmed = await confirmAction(
            "Eliminar llave",
            `Si eliminas ${item.maskedKey}, nadie podrá enviarte dinero con ella. Tu clave dinámica se valida automáticamente.`,
            "Eliminar"
        );
        if (!confirmed) return;

        try {
            applyList(
                await BlApi.authed(config.accountApi, "POST", `/accounts/keys/${item.type}/remove`, {
                    dynamicCode: await dynamicCode(),
                })
            );
            toast("Llave eliminada.", "ok");
        } catch (err) {
            fail(err, "No se pudo eliminar la llave.");
        }
    });

    // -----------------------------------------------------
    // ENVIAR CON LLAVE: A NOMBRE DE QUIÉN ESTÁ
    // -----------------------------------------------------

    const lookupInput = byId("keyLookup");
    const lookupResult = byId("keyLookupResult");
    let lookupTimer = null;
    let lookupSeq = 0;

    function showLookup(html, ok) {
        lookupResult.hidden = false;
        lookupResult.innerHTML = html;
        lookupResult.classList.toggle("is-ok", ok);
    }

    lookupInput?.addEventListener("input", () => {
        clearTimeout(lookupTimer);
        const value = lookupInput.value.trim();
        if (!value) {
            lookupResult.hidden = true;
            return;
        }
        const found = brebDetect(value);
        if (!found) {
            showLookup("Escribe un celular, correo, cédula o una llave que empiece por @.", false);
            return;
        }
        lookupTimer = setTimeout(async () => {
            const seq = ++lookupSeq;
            try {
                const result = await BlApi.authed(
                    config.accountApi,
                    "GET",
                    `/accounts/keys/lookup?key=${encodeURIComponent(found.key)}`
                );
                if (seq !== lookupSeq) return;
                const chip = `<span class="breb-chip">${brebSvg(result.type, 14)} ${escapeHTML(BREB_TYPES[result.type].label)}</span>`;
                if (result.own) showLookup(`${chip} Esta llave es tuya.`, false);
                else
                    showLookup(
                        `${chip} A nombre de <b>${escapeHTML(result.holderName)}</b> · ${escapeHTML(result.entity)}. <a href="transferir.html?llave=${encodeURIComponent(found.key)}">Enviar a esta llave →</a>`,
                        true
                    );
            } catch (err) {
                if (seq !== lookupSeq || BlApi.handleAuthError(err)) return;
                showLookup(escapeHTML(err.message || "No encontramos esa llave en Banklite."), false);
            }
        }, 350);
    });

    // -----------------------------------------------------
    // INICIO
    // -----------------------------------------------------

    render();
    load();
    BlApi.authed(config.kycApi, "GET", `/kyc/${session.idUser}`)
        .then(k => {
            state.kyc = k;
        })
        .catch(() => {});
});
