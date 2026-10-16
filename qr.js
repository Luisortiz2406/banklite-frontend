// =========================================================
// BANKLITE - COBRAR Y PAGAR CON QR (qr.html)
// Mismo diseño y comportamiento que la versión simulada, pero con dinero real.
// El QR lleva una llave Bre-B o el número de cuenta Banklite de quien cobra:
//   banklite:pagar?llave=@laura&valor=10000&nota=...
//   banklite:pagar?cuenta=12345678901&valor=10000&nombre=Laura%20G.&nota=...
// Con llave, el titular se busca en el directorio (nombre enmascarado) y se paga
// con envío por llave. Pagar a una persona es una transferencia (transfer-service); pagar a un
// comercio de prueba va por payment-service (el ledger no acepta transferencias
// a cuentas de comercio). En ambos casos se confirma con la clave dinámica.
// =========================================================

// Prefijo de la descripción en el ledger: así se reconocen los pagos con QR
// (enviados y recibidos) en el historial y en los movimientos.
const QR_PREFIX = 'Pago QR';

function qrPayload({ account, key, amount, name, note }) {
    const params = new URLSearchParams(key ? { llave: key } : { cuenta: account });
    if (amount) params.set('valor', String(amount));
    if (name) params.set('nombre', name);
    if (note) params.set('nota', note);
    return 'banklite:pagar?' + params.toString();
}

// Lee un QR de Banklite, o un texto que solo tenga una llave Bre-B o un número de cuenta.
function qrParse(text) {
    const raw = String(text || '').trim();
    let params = null;
    if (/^banklite:pagar\?/i.test(raw) || /[?&](cuenta|llave)=/.test(raw)) params = new URLSearchParams(raw.split('?')[1]);
    const rawKey = params ? params.get('llave') : (/^\d{11}$/.test(raw.replace(/\s/g, '')) ? null : raw);
    const key = rawKey ? brebDetect(rawKey)?.key || null : null;
    const account = key ? null : ((params ? params.get('cuenta') : raw.replace(/\s/g, '')) || '');
    if (!key && !/^\d{11}$/.test(account)) return null;
    return {
        key,
        account,
        amount: Math.max(0, Math.round(Number(params?.get('valor')) || 0)),
        name: (params?.get('nombre') || '').slice(0, 60),
        note: (params?.get('nota') || '').slice(0, 60),
    };
}

// Dibuja el QR en un canvas con los colores de Banklite y el logo al centro.
function drawQR(text, size = 280) {
    const qr = qrcode(0, 'H');
    qr.addData(unescape(encodeURIComponent(text)));
    qr.make();

    const count = qr.getModuleCount();
    const quiet = 4;
    const cell = Math.floor(size / (count + quiet * 2));
    const real = cell * (count + quiet * 2);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = real;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, real, real);
    ctx.fillStyle = '#26474E';
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) ctx.fillRect((col + quiet) * cell, (row + quiet) * cell, cell, cell);
        }
    }

    // Logo: cuadro turquesa con la B (el nivel H del QR tolera taparlo).
    const logo = Math.round(real * 0.2);
    const x = (real - logo) / 2;
    const radius = logo * 0.24;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x - 6, x - 6, logo + 12, logo + 12, radius + 4);
    ctx.fill();
    ctx.fillStyle = '#2CCED2';
    ctx.beginPath();
    ctx.roundRect(x, x, logo, logo, radius);
    ctx.fill();
    ctx.fillStyle = '#26474E';
    ctx.font = `800 ${Math.round(logo * 0.6)}px Manrope, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', real / 2, real / 2 + logo * 0.04);
    return canvas;
}

// Busca un QR dentro de una imagen (cámara o foto). jsQR a veces falla según el
// tamaño, así que prueba varias escalas y un recorte central.
function readQR(source, width, height, quick = false) {
    const side = Math.min(width, height);
    const attempts = [
        [0, 0, width, height, 800],
        [(width - side) / 2, (height - side) / 2, side, side, 520],
        [0, 0, width, height, 480],
        [(width - side) / 2, (height - side) / 2, side, side, 360],
        [0, 0, width, height, 1100]
    ];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    for (const [sx, sy, sw, sh, max] of quick ? attempts.slice(0, 2) : attempts) {
        const scale = Math.min(1, max / Math.max(sw, sh));
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(data.data, canvas.width, canvas.height, { inversionAttempts: quick ? 'dontInvert' : 'attemptBoth' });
        if (found?.data) return found;
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('qrPage')) return;
    if (!BlApi.protectPage()) return;

    if (typeof qrcode !== 'function' || typeof jsQR !== 'function') {
        showMessage('Falta un archivo', 'No se encontró qr-lib.js. Ponlo en la misma carpeta que las demás páginas.', '!');
        return;
    }

    const { config, session } = BlApi;
    const paymentApi = config.paymentApi || config.transferApi;
    const $ = id => document.getElementById(id);
    const ACCOUNT_TYPES = { savings: 'Cuenta de ahorros', checking: 'Cuenta corriente' };

    const state = { accounts: [], account: null, keys: [], balance: 0, kyc: null, stores: [] };

    const money = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v) || 0);
    const parseMoney = v => Number(String(v || '').replace(/\D/g, '')) || 0;
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    const last4 = n => String(n || '').slice(-4);
    const fullName = () => {
        const k = state.kyc || {};
        return k.nombres ? `${k.nombres} ${k.apellidos || ''}`.trim() : 'Cliente Banklite';
    };
    // En el QR va el nombre corto (primer nombre + inicial del apellido), como hacen los bancos.
    const shortName = () => {
        const k = state.kyc || {};
        if (!k.nombres) return '';
        const first = String(k.nombres).trim().split(/\s+/)[0];
        const initial = String(k.apellidos || '').trim().charAt(0);
        return initial ? `${first} ${initial.toUpperCase()}.` : first;
    };

    function fail(err, fallback) {
        if (BlApi.handleAuthError(err)) return;
        showMessage('No se pudo completar', err?.message || fallback, '!');
    }


    // -----------------------------------------------------
    // CUENTA, SALDO Y DATOS
    // -----------------------------------------------------

    async function loadBalance() {
        if (!state.account) return;
        try {
            const balance = await BlApi.authed(config.ledgerApi, 'GET', `/ledger/accounts/${state.account.id}/balance`);
            state.balance = Number(balance.balance) || 0;
            setText('qrAvailable', money(state.balance));
        } catch (err) { BlApi.handleAuthError(err); }
    }

    async function loadAccounts() {
        try {
            const accounts = await BlApi.authed(config.accountApi, 'GET', '/accounts');
            state.accounts = (accounts || []).filter(a => a.status !== 'closed' && a.accountNumber);
            state.account = state.accounts.find(a => a.id === session.accountId) || state.accounts[0] || null;
            if (state.account) session.accountId = state.account.id;
        } catch (err) { fail(err, 'No se pudo cargar tu cuenta.'); }
        try { state.kyc = await BlApi.authed(config.kycApi, 'GET', `/kyc/${session.idUser}`); } catch { /* sin nombre */ }
        try { state.keys = (await BlApi.authed(config.accountApi, 'GET', '/accounts/keys')).keys || []; } catch { /* sin llaves */ }
    }


    // -----------------------------------------------------
    // PESTAÑAS
    // -----------------------------------------------------

    const tabs = document.querySelectorAll('[data-qr-tab]');

    function showTab(id) {
        if (presenting) setPresenting(false);
        tabs.forEach(tab => {
            const active = tab.dataset.qrTab === id;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', String(active));
            $(tab.dataset.qrTab).hidden = !active;
        });
        if (id !== 'tabPay') stopCamera();
    }

    tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.qrTab)));


    // -----------------------------------------------------
    // COBRAR: MI QR
    // -----------------------------------------------------

    const accountSelect = $('qrKey');
    const amountInput = $('qrAmount');
    const noteInput = $('qrNote');
    const box = $('qrBox');
    const card = $('qrCard');
    let chargeCanvas = null;
    let presenting = false;

    // Opciones de cobro: tus llaves Bre-B (primero, como en Bre-B) y tus cuentas.
    // value = "llave:<llave>" o "cuenta:<número>".
    const accountLabel = a => `${ACCOUNT_TYPES[a.accountType] || 'Cuenta'} ···· ${last4(a.accountNumber)}`;
    function selectedTarget() {
        const [kind, ...rest] = accountSelect.value.split(':');
        const value = rest.join(':');
        if (kind === 'llave') {
            const item = state.keys.find(k => k.key === value);
            return item ? { key: item.key, label: `Llave ${item.type === 'alfanumerica' ? item.key : item.maskedKey}`, copy: item.key } : null;
        }
        const account = state.accounts.find(a => a.accountNumber === value);
        return account ? { account: account.accountNumber, label: `Cuenta Banklite ···· ${last4(account.accountNumber)}`, copy: account.accountNumber } : null;
    }

    function setupCharge() {
        const has = state.accounts.length > 0;
        $('qrNoKeys').hidden = has;
        $('qrChargeFields').hidden = !has;
        $('qrCard').classList.toggle('is-empty', !has);
        const keyOptions = state.keys.map(k =>
            `<option value="llave:${escapeHTML(k.key)}">${escapeHTML(BREB_TYPES[k.type]?.label || 'Llave')} · ${escapeHTML(k.type === 'alfanumerica' ? k.key : k.maskedKey)}</option>`);
        const accountOptions = state.accounts.map(a =>
            `<option value="cuenta:${escapeHTML(a.accountNumber)}">${escapeHTML(accountLabel(a))}</option>`);
        accountSelect.innerHTML = [...keyOptions, ...accountOptions].join('');
        paintCharge();
    }

    function paintCharge() {
        const target = selectedTarget();
        const amount = parseMoney(amountInput.value);
        const note = noteInput.value.trim();

        setText('qrCardName', fullName());
        $('qrCopy').textContent = target?.key ? 'Copiar llave' : 'Copiar número de cuenta';

        if (!target) {
            box.innerHTML = '<div class="qr-placeholder">Abre tu cuenta para crear tu QR</div>';
            setText('qrCardKey', 'Sin cuenta');
            setText('qrCardAmount', '');
            setText('qrCardNote', '');
            chargeCanvas = null;
            return;
        }

        // Con llave no hace falta el nombre: quien paga lo ve en el directorio Bre-B.
        // En pantalla completa se dibuja más grande para que se vea nítido.
        chargeCanvas = drawQR(qrPayload({ account: target.account, key: target.key, amount, name: target.key ? '' : shortName(), note }), presenting ? 640 : 300);
        box.innerHTML = '';
        box.appendChild(chargeCanvas);

        setText('qrCardKey', target.label);
        setText('qrCardAmount', amount ? money(amount) : 'Valor libre');
        setText('qrCardNote', note);
    }

    amountInput.addEventListener('input', () => {
        const value = parseMoney(amountInput.value);
        amountInput.value = value ? value.toLocaleString('es-CO') : '';
        paintCharge();
    });

    $('qrChips').addEventListener('click', event => {
        const chip = event.target.closest('[data-qr-amount]');
        if (!chip) return;
        const value = Number(chip.dataset.qrAmount);
        amountInput.value = value ? value.toLocaleString('es-CO') : '';
        paintCharge();
    });

    accountSelect.addEventListener('change', paintCharge);
    noteInput.addEventListener('input', paintCharge);

    // Aceptar: muestra solo la tarjeta del QR en toda la pantalla, para enseñársela
    // a quien va a pagar sin dejar a la vista el formulario de cobro.
    function setPresenting(on) {
        presenting = on;
        card.classList.toggle('is-presenting', on);
        card.setAttribute('role', on ? 'dialog' : 'region');
        card.setAttribute('aria-modal', String(on));
        document.body.classList.toggle('qr-presenting', on);
        $('qrPresentHint').hidden = !on;
        $('qrPresentClose').hidden = !on;
        paintCharge();
        if (on) $('qrPresentClose').focus({ preventScroll: true });
        else $('qrAccept').focus({ preventScroll: true });
    }

    $('qrChargeForm').addEventListener('submit', event => {
        event.preventDefault();
        if (!selectedTarget()) {
            toast('Primero abre tu cuenta Banklite.', 'err');
            return;
        }
        setPresenting(true);
    });

    $('qrPresentClose').addEventListener('click', () => setPresenting(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && presenting && !document.querySelector('.modal.active')) setPresenting(false);
    });

    // Descarga una tarjeta con el QR, el nombre y el valor.
    $('qrDownload').addEventListener('click', () => {
        const target = selectedTarget();
        if (!chargeCanvas || !target) {
            toast('Primero abre tu cuenta Banklite.', 'err');
            return;
        }

        const amount = parseMoney(amountInput.value);
        const card = document.createElement('canvas');
        card.width = 640;
        card.height = 860;
        const ctx = card.getContext('2d');

        ctx.fillStyle = '#26474E';
        ctx.fillRect(0, 0, 640, 860);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(40, 120, 560, 700, 32);
        ctx.fill();

        ctx.fillStyle = '#2CCED2';
        ctx.beginPath();
        ctx.roundRect(40, 38, 52, 52, 14);
        ctx.fill();
        ctx.fillStyle = '#26474E';
        ctx.font = '800 32px Manrope, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', 66, 66);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.font = '800 30px Manrope, Arial, sans-serif';
        ctx.fillText('banklite', 106, 66);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#2CCED2';
        ctx.font = '800 24px Manrope, Arial, sans-serif';
        ctx.fillText('Paga con Banklite', 600, 66);

        ctx.drawImage(chargeCanvas, 120, 160, 400, 400);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#26474E';
        ctx.font = '800 30px Manrope, Arial, sans-serif';
        ctx.fillText(fullName(), 320, 610);
        ctx.fillStyle = '#5E7377';
        ctx.font = '500 22px Inter, Arial, sans-serif';
        ctx.fillText(target.label, 320, 650);
        ctx.fillStyle = '#137C81';
        ctx.font = '800 44px Manrope, Arial, sans-serif';
        ctx.fillText(amount ? money(amount) : 'Valor libre', 320, 715);
        ctx.fillStyle = '#8A9B9E';
        ctx.font = '500 18px Inter, Arial, sans-serif';
        ctx.fillText(noteInput.value.trim() || 'Escanea con tu app Banklite', 320, 770);

        const link = document.createElement('a');
        link.download = `qr-banklite-${target.key ? 'llave' : last4(target.account)}.png`;
        link.href = card.toDataURL('image/png');
        link.click();
        toast('QR descargado.', 'ok');
    });

    $('qrCopy').addEventListener('click', async () => {
        const target = selectedTarget();
        if (!target) return;
        try {
            await navigator.clipboard.writeText(target.copy);
            toast(target.key ? 'Llave copiada.' : 'Número de cuenta copiado.', 'ok');
        } catch {
            toast(target.copy, 'info');
        }
    });


    // -----------------------------------------------------
    // PAGAR: CÁMARA Y FOTO
    // -----------------------------------------------------

    const video = $('qrVideo');
    const scanner = $('qrScanner');
    const cameraButton = $('qrCameraBtn');
    const status = $('qrStatus');
    let stream = null;
    let scanning = false;

    function setStatus(text, kind = '') {
        status.textContent = text;
        status.className = 'qr-status' + (kind ? ' is-' + kind : '');
    }

    function stopCamera() {
        scanning = false;
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        scanner.classList.remove('is-live');
        cameraButton.querySelector('span').textContent = 'Abrir cámara';
    }

    function scanFrame() {
        if (!scanning) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const found = readQR(video, video.videoWidth, video.videoHeight, true);
            if (found?.data) {
                stopCamera();
                handleScan(found.data);
                return;
            }
        }
        requestAnimationFrame(scanFrame);
    }

    cameraButton.addEventListener('click', async () => {
        if (stream) {
            stopCamera();
            setStatus('');
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus('Tu navegador no permite usar la cámara aquí. Sube una foto del QR.', 'err');
            return;
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            video.srcObject = stream;
            await video.play();
            scanner.classList.add('is-live');
            cameraButton.querySelector('span').textContent = 'Cerrar cámara';
            setStatus('Apunta la cámara al código QR…');
            scanning = true;
            requestAnimationFrame(scanFrame);
        } catch {
            stopCamera();
            setStatus('No pudimos abrir la cámara. Revisa el permiso del navegador o sube una foto del QR.', 'err');
        }
    });

    $('qrFile').addEventListener('change', event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            const found = readQR(image, image.naturalWidth, image.naturalHeight);
            URL.revokeObjectURL(url);
            if (found?.data) handleScan(found.data);
            else setStatus('No encontramos un código QR en esa imagen. Intenta con una foto más cercana y nítida.', 'err');
        };
        image.onerror = () => setStatus('No pudimos abrir esa imagen.', 'err');
        image.src = url;
    });

    window.addEventListener('pagehide', stopCamera);


    // -----------------------------------------------------
    // PAGAR: DATOS DEL QR Y CONFIRMACIÓN
    // -----------------------------------------------------

    const payAmount = $('qrPayAmount');
    const payNote = $('qrPayNote');
    let target = null;
    let lastMovement = null;

    async function handleScan(text) {
        const data = qrParse(text);

        if (!data) {
            setStatus('Ese código no es un QR de pago Banklite.', 'err');
            return;
        }

        // QR con llave Bre-B: el titular sale del directorio (nombre enmascarado).
        let holder = null;
        if (data.key) {
            setStatus('Buscando la llave…');
            try {
                holder = await BlApi.authed(config.accountApi, 'GET', `/accounts/keys/lookup?key=${encodeURIComponent(data.key)}`);
            } catch (err) {
                if (BlApi.handleAuthError(err)) return;
                setStatus(err.message || 'No encontramos esa llave en Banklite.', 'err');
                return;
            }
        }

        if (holder?.own || (!data.key && state.accounts.some(a => a.accountNumber === data.account))) {
            setStatus('Ese es tu propio QR. Para pagar, escanea el código de otra persona.', 'err');
            return;
        }

        // Si la cuenta es de un comercio de prueba, se paga como comercio (con su valor fijo, si tiene).
        const store = data.key ? null : state.stores.find(s => s.accountNumber === data.account);
        target = {
            ...data,
            store,
            holder,
            amount: store ? (store.amount || data.amount) : data.amount,
            note: data.note || store?.note || '',
            display: store ? store.name : holder ? holder.holderName : (data.name || 'Cliente Banklite'),
            where: holder ? `llave ${holder.type === 'alfanumerica' ? holder.key : holder.maskedKey}` : `cuenta ···· ${last4(data.account)}`,
        };

        setStatus('Código leído.', 'ok');

        setText('qrPayInitials', initials(target.display.replace(/•/g, '')) || '?');
        setText('qrPayKind', store ? 'Comercio' : holder ? 'La llave pertenece a' : 'La cuenta pertenece a');
        setText('qrPayName', target.display);
        setText('qrPayEntity', `Banklite · ${target.where.charAt(0).toUpperCase()}${target.where.slice(1)}`);
        setText('qrPayBalance', money(state.balance));

        payAmount.value = target.amount ? target.amount.toLocaleString('es-CO') : '';
        payAmount.readOnly = target.amount > 0;
        $('qrPayFixed').hidden = !target.amount;
        payNote.value = target.note;

        openModal('qrPayModal');
        if (!target.amount) setTimeout(() => payAmount.focus(), 150);
    }

    payAmount.addEventListener('input', () => {
        if (payAmount.readOnly) return;
        const value = parseMoney(payAmount.value);
        payAmount.value = value ? value.toLocaleString('es-CO') : '';
    });

    // Prepara, adjunta la clave dinámica vigente y confirma. Si algo falla, cancela la solicitud.
    async function confirmWithDynamicKey(api, base, body) {
        const pending = await BlApi.authed(api, 'POST', `${base}/prepare`, body);
        try {
            const { code } = await BlApi.authed(config.authApi, 'GET', '/auth/dynamic-key');
            return await BlApi.authed(api, 'POST', `${base}/${pending.id}/confirm`, { dynamicCode: code });
        } catch (err) {
            BlApi.authed(api, 'POST', `${base}/${pending.id}/cancel`, {}).catch(() => {});
            throw err;
        }
    }

    async function findMovement(transactionId) {
        if (!transactionId) return null;
        try {
            const recent = await BlApi.authed(config.ledgerApi, 'GET', `/ledger/accounts/${state.account.id}/transactions?limit=20`);
            return recent.find(m => m.transactionId === transactionId) || null;
        } catch { return null; }
    }

    $('qrPayForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!target) return;
        if (!state.account) {
            toast('Primero abre tu cuenta Banklite.', 'err');
            return;
        }

        const amount = parseMoney(payAmount.value);
        const note = payNote.value.trim() || (target.store ? `Compra en ${target.display}` : 'Pago con QR');

        if (amount < 1000) {
            toast('El valor mínimo es $1.000.', 'err');
            payAmount.focus();
            return;
        }

        if (amount > state.balance) {
            toast(`No tienes saldo suficiente. Disponible: ${money(state.balance)}.`, 'err');
            return;
        }

        closeModalById('qrPayModal');

        const ok = await confirmAction(
            'Confirmar pago',
            `Vas a pagar ${money(amount)} a ${target.display} (${target.where}). Tu clave dinámica se valida automáticamente.`,
            'Pagar'
        );
        if (!ok) return;

        const current = target;
        let transactionId;
        try {
            if (current.store) {
                const result = await confirmWithDynamicKey(paymentApi, '/payments', {
                    kind: 'qr',
                    sourceAccountId: state.account.id,
                    billerCode: current.store.code,
                    reference: current.account,
                    amount,
                    note,
                    idempotencyKey: uuid(),
                });
                transactionId = result.ledgerTransactionId;
            } else {
                const result = await confirmWithDynamicKey(config.transferApi, '/transfers', {
                    sourceAccountId: state.account.id,
                    ...(current.key ? { destinationKey: current.key } : { destinationAccountNumber: current.account }),
                    amount,
                    description: `${QR_PREFIX} · ${note}`.slice(0, 140),
                    idempotencyKey: uuid(),
                });
                transactionId = result.ledgerTransactionId;
            }
        } catch (err) {
            if (/clave dinámica/i.test(err?.message || '')) showMessage('No se pudo validar la clave dinámica', err.message, '!');
            else fail(err, 'No se pudo realizar el pago.');
            return;
        }

        lastMovement = await findMovement(transactionId);
        $('qrReceipt').hidden = !lastMovement;

        $('qrSuccessContent').innerHTML = [
            ['Comprobante', String(transactionId || '').slice(0, 8).toUpperCase()],
            [current.store ? 'Comercio' : 'Destinatario', current.display],
            current.key ? ['Llave Bre-B', current.where.replace(/^llave /, '')] : ['Cuenta', `Banklite ···· ${last4(current.account)}`],
            ['Valor pagado', money(amount)],
            ['Concepto', note],
            ['Fecha', formatDate(lastMovement?.createdAt || new Date(), { dateStyle: 'medium', timeStyle: 'short' })]
        ].map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('');

        openModal('qrSuccessModal');
        target = null;
        setStatus('');
        loadBalance();
        renderHistory();
    });

    $('qrReceipt').addEventListener('click', () => {
        if (!lastMovement || typeof downloadReceipt !== 'function') return;
        downloadReceipt(lastMovement, {
            name: fullName(),
            accountType: ACCOUNT_TYPES[state.account?.accountType] || 'Cuenta',
            accountNumber: state.account?.accountNumber,
        });
        toast('Comprobante descargado.', 'ok');
    });


    // -----------------------------------------------------
    // COMERCIOS DE PRUEBA E HISTORIAL
    // -----------------------------------------------------

    const storesBox = $('qrStores');

    async function loadStores() {
        try {
            state.stores = (await BlApi.authed(paymentApi, 'GET', '/payments/qr/stores')).filter(s => s.available && s.accountNumber);
        } catch (err) {
            if (BlApi.handleAuthError(err)) return;
            storesBox.innerHTML = '<p class="pay-empty">No se pudieron cargar los comercios de prueba.</p>';
            return;
        }

        storesBox.innerHTML = state.stores.map((store, index) => `
            <div class="qr-store">
                <div class="qr-store-code" data-store-code="${index}"></div>
                <div class="qr-store-info">
                    <strong>${escapeHTML(store.name)}</strong>
                    <small>${store.amount ? money(store.amount) : 'Valor libre'}${store.note ? ' · ' + escapeHTML(store.note) : ''}</small>
                </div>
                <button type="button" class="btn soft" data-store-pay="${index}">Pagar</button>
            </div>`).join('') || '<p class="pay-empty">No hay comercios de prueba disponibles.</p>';

        storesBox.querySelectorAll('[data-store-code]').forEach(el => {
            const store = state.stores[Number(el.dataset.storeCode)];
            el.appendChild(drawQR(qrPayload(storeQR(store)), 150));
        });
    }

    const storeQR = store => ({ account: store.accountNumber, amount: store.amount, name: store.name, note: store.note });

    storesBox.addEventListener('click', event => {
        const button = event.target.closest('[data-store-pay]');
        if (button) handleScan(qrPayload(storeQR(state.stores[Number(button.dataset.storePay)])));
    });

    async function renderHistory() {
        const box = $('qrHistory');
        if (!state.account) {
            box.innerHTML = '<p class="pay-empty">Aún no has pagado ni recibido con QR.</p>';
            return;
        }
        let list = [];
        try {
            const recent = await BlApi.authed(config.ledgerApi, 'GET', `/ledger/accounts/${state.account.id}/transactions?limit=50`);
            list = recent.filter(m => String(m.description || '').startsWith(QR_PREFIX)).slice(0, 4);
        } catch (err) { if (BlApi.handleAuthError(err)) return; }

        box.innerHTML = list.length
            ? list.map(movement => {
                const incoming = movement.direction === 'in';
                const detail = String(movement.description).replace(new RegExp(`^${QR_PREFIX} · `), '');
                return `
                <div class="pay-history">
                    <div>
                        <strong>${escapeHTML(detail)}</strong>
                        <small>${incoming ? 'Pago recibido por QR' : 'Pago con QR'} · ${formatDate(movement.createdAt, { dateStyle: 'medium' })}</small>
                    </div>
                    <b class="${incoming ? 'is-in' : ''}">${incoming ? '+' : '−'}${money(movement.amount)}</b>
                    <span></span>
                </div>`;
            }).join('')
            : '<p class="pay-empty">Aún no has pagado ni recibido con QR.</p>';
    }


    // -----------------------------------------------------
    // INICIO
    // -----------------------------------------------------

    if (new URLSearchParams(window.location.search).get('tab') === 'pagar') showTab('tabPay');

    (async () => {
        await loadAccounts();
        setupCharge();
        await Promise.all([loadBalance(), loadStores()]);
        renderHistory();
    })();
});
