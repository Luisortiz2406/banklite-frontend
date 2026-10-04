// =========================================================
// BANKLITE - REGISTRO (registro.html)
// Flujo: datos → identidad (KYC) → correo → WhatsApp → usuario → clave.
// Endpoints: POST /kyc/submit, /auth/email/check|send|verify,
// /auth/phone/check, /auth/whatsapp/send|verify, /auth/username/check,
// /auth/register. Usa BlApi (api.js) y las utilidades visuales de java.js.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    const flow = document.getElementById('registerForm');
    if (!flow) return;

    const { config, api } = BlApi;
    const field = id => document.getElementById(id);
    const value = id => field(id)?.value.trim() || '';
    const screens = [...flow.querySelectorAll('.reg-screen')];
    const screenOf = name => flow.querySelector(`[data-screen="${name}"]`);

    // Textos del panel izquierdo y paso (1 datos, 2 verificación, 3 acceso)
    const SCREENS = {
        'info': { step: 1, label: 'Tus datos', title: 'Tu banco digital, sin filas ni papeleo', sub: 'Abre tu cuenta 100% en línea, en minutos y desde donde estés.' },
        'identity': { step: 2, label: 'Verificación', title: 'Confirma tu identidad', sub: 'Validamos tu documento antes de permitirte continuar.' },
        'identity-result': { step: 2, label: 'Verificación', title: 'Identidad confirmada', sub: 'Este es el resultado de la validación de tus datos.' },
        'email': { step: 2, label: 'Verificación', title: 'Verifica tu correo', sub: 'Protegemos tu cuenta desde el primer paso.' },
        'email-code': { step: 2, label: 'Verificación', title: 'Verifica tu correo', sub: 'Protegemos tu cuenta desde el primer paso.' },
        'phone': { step: 2, label: 'Verificación', title: 'Verifica tu teléfono', sub: 'Recibirás un código de verificación por WhatsApp.' },
        'phone-code': { step: 2, label: 'Verificación', title: 'Verifica tu teléfono', sub: 'Recibirás un código de verificación por WhatsApp.' },
        'username': { step: 3, label: 'Acceso', title: 'Crea tu usuario', sub: 'Así vas a identificarte cada vez que inicies sesión.' },
        'pin': { step: 3, label: 'Acceso', title: 'Crea tu clave', sub: 'Tu clave de 4 dígitos protege tu acceso.' },
    };
    const ORDER = Object.keys(SCREENS);

    // Lo que ya se verificó durante este registro. El idUser se conserva durante
    // todo el flujo: si la persona vuelve atrás a corregir algo sigue siendo la
    // misma solicitud y el KYC, el correo y el teléfono ya asociados no se pierden.
    const state = {
        idUser: null,
        kyc: null,
        kycSubmissionToken: null,
        identityVerified: false, identityResult: null,
        email: '', emailVerified: false, emailCodeFor: null, emailCodeExpiresAt: 0,
        phone: '', phoneVerified: false, phoneCodeFor: null, phoneCodeExpiresAt: 0,
        username: '',
    };

    let current = 'info';
    let ready = false;
    let timer = null;

    function uuidv4() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function show(name) {
        const back = ORDER.indexOf(name) < ORDER.indexOf(current);
        current = name;
        screens.forEach(screen => {
            const active = screen.dataset.screen === name;
            screen.hidden = !active;
            screen.classList.toggle('is-active', active);
            screen.classList.toggle('from-left', active && back);
            if (active) hideAlert(screen);
        });

        const info = SCREENS[name];
        flow.closest('.register-content').querySelectorAll('[data-progress]').forEach((bar, i) => bar.classList.toggle('on', i < info.step));
        document.querySelectorAll('[data-hero-step]').forEach((bar, i) => bar.classList.toggle('on', i < info.step));
        setText('regProgressLabel', `Paso ${info.step} de 3 · ${info.label}`);
        setText('regHeroTitle', info.title);
        setText('regHeroSub', info.sub);
        ['regHeroTitle', 'regHeroSub'].forEach(id => {
            const el = field(id);
            if (!el) return;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
        });

        if (name !== 'email-code' && name !== 'phone-code') timer?.stop();

        const target = screenOf(name);
        const first = target.querySelector('.pin-boxes')?._pin;
        if (first) setTimeout(() => first.focus(), 60);
        else target.querySelector('input:not([type=hidden]):not([type=checkbox]), select, button[type=submit]')?.focus({ preventScroll: true });

        if (ready && window.innerWidth <= 760) flow.closest('.register-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function alertIn(screen, text, kind = 'err') {
        const box = screen.querySelector('[data-alert]');
        if (!box) return;
        box.textContent = text;
        box.className = `reg-alert is-${kind}`;
        box.hidden = false;
    }
    function hideAlert(screen) {
        const box = screen.querySelector('[data-alert]');
        if (box) box.hidden = true;
    }
    function onSubmit(name, handler) {
        screenOf(name).addEventListener('submit', event => {
            event.preventDefault();
            hideAlert(screenOf(name));
            handler(screenOf(name));
        });
    }
    function setLoading(button, loading, label) {
        button.disabled = loading;
        button.innerHTML = loading ? `<span class="btn-spinner" aria-hidden="true"></span> ${label}…` : label;
    }

    flow.querySelectorAll('[data-go]').forEach(button => {
        button.addEventListener('click', () => {
            const go = button.dataset.go;
            if (go === 'identity-result' && !state.identityVerified) return show('identity');
            show(go);
        });
    });

    // Solo letras en nombres y apellidos; solo dígitos en documento y teléfono.
    const soloLetras = /[^A-Za-zÁÉÍÓÚÑÜáéíóúñü\s'-]/g;
    ['regName', 'regLastName'].forEach(id => field(id)?.addEventListener('input', e => { e.target.value = e.target.value.replace(soloLetras, ''); }));
    field('regDoc')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
    field('regPhone')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });

    const hoyISO = new Date().toISOString().slice(0, 10);
    field('regBirth')?.setAttribute('max', hoyISO);
    field('regIssue')?.setAttribute('max', hoyISO);
    // El calendario de expedición no deja elegir antes de los 18 años.
    field('regBirth')?.addEventListener('change', () => {
        const birth = field('regBirth').value;
        if (!birth) return field('regIssue').removeAttribute('min');
        const adult = new Date(birth + 'T00:00:00');
        adult.setFullYear(adult.getFullYear() + 18);
        const min = adult.toISOString().slice(0, 10);
        field('regIssue').setAttribute('min', min);
        if (field('regIssue').value && field('regIssue').value < min) field('regIssue').value = '';
    });


    // ---------- 1. Datos personales ----------

    function infoProblem() {
        const firstName = value('regName');
        const lastName = value('regLastName');
        const documentNumber = value('regDoc');
        const birthDate = field('regBirth').value;
        const issueDate = field('regIssue').value;

        if (firstName.length < 2) return ['Escribe tus nombres.', 'regName'];
        if (lastName.length < 2) return ['Escribe tus apellidos.', 'regLastName'];
        if (!/^\d{6,10}$/.test(documentNumber)) return ['El número de documento debe tener entre 6 y 10 dígitos.', 'regDoc'];

        if (!birthDate) return ['Ingresa tu fecha de nacimiento.', 'regBirth'];
        const adult = new Date(birthDate + 'T00:00:00');
        if (isNaN(adult.getTime())) return ['La fecha de nacimiento no es válida.', 'regBirth'];
        adult.setFullYear(adult.getFullYear() + 18);
        if (adult > new Date()) return ['Debes ser mayor de 18 años para abrir una cuenta.', 'regBirth'];

        if (!issueDate) return ['Ingresa la fecha de expedición de tu documento.', 'regIssue'];
        const issue = new Date(issueDate + 'T00:00:00');
        if (isNaN(issue.getTime())) return ['La fecha de expedición no es válida.', 'regIssue'];
        if (issue < adult) return ['La fecha de expedición debe ser posterior a cuando cumpliste 18 años.', 'regIssue'];
        if (issue > new Date()) return ['La fecha de expedición no puede ser futura.', 'regIssue'];
        return null;
    }

    onSubmit('info', screen => {
        const problem = infoProblem();
        if (problem) {
            alertIn(screen, problem[0]);
            field(problem[1])?.focus();
            return;
        }
        if (!state.idUser) state.idUser = uuidv4();

        const kyc = {
            nombres: value('regName'),
            apellidos: value('regLastName'),
            tipoDocumento: value('regDocType') || 'CC',
            numeroDocumento: value('regDoc'),
            fechaNacimiento: field('regBirth').value,
            fechaExpedicion: field('regIssue').value,
        };
        // Solo se vuelve a exigir la verificación de identidad si cambió algún dato del documento.
        const changed = !state.kyc || Object.keys(kyc).some(key => kyc[key] !== state.kyc[key]);
        state.kyc = { ...state.kyc, ...kyc };
        if (changed) { state.identityVerified = false; state.identityResult = null; }

        setText('identityDocSummary', `${kyc.tipoDocumento} · ${kyc.numeroDocumento}`);
        setText('identityNameSummary', `${kyc.nombres} ${kyc.apellidos}`);

        if (state.identityVerified && state.identityResult) return renderIdentityResult(state.identityResult);
        field('identityVerifyBtn').textContent = 'Verificar identidad';
        field('identityLoading').hidden = true;
        show('identity');
    });


    // ---------- 2. Verificación de identidad (KYC: Registraduría + Policía) ----------

    const DOC_NAMES = { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', PA: 'Pasaporte' };

    function resultRow(tone, icon, title, detail) {
        const row = document.createElement('div');
        row.className = 'reg-row' + (tone === 'ok' ? ' is-ok' : '');
        const chip = document.createElement('span');
        chip.className = 'reg-chip';
        chip.setAttribute('aria-hidden', 'true');
        chip.textContent = icon;
        const body = document.createElement('div');
        const strong = document.createElement('strong'); strong.textContent = title;
        const small = document.createElement('small'); small.textContent = detail;
        body.append(strong, small);
        row.append(chip, body);
        return row;
    }

    // Muestra qué se evaluó y con qué resultado. Si la Policía informa asuntos
    // pendientes no se puede abrir la cuenta: solo queda "Volver al inicio".
    function renderIdentityResult(result) {
        const screen = screenOf('identity-result');
        const doc = (result && result.provider && result.provider.document) || {};
        const bg = (result && result.provider && result.provider.background) || {};
        const docDemo = String(doc.provider || '').endsWith('-demo');
        const bgDemo = String(bg.provider || '').endsWith('-demo');
        const rechazado = !!result && result.status !== 'verified' && bg.nivelRiesgo === 'alto';
        const kyc = state.kyc || {};

        const list = field('identityResultList');
        list.innerHTML = '';
        list.appendChild(resultRow(docDemo ? 'demo' : 'ok', docDemo ? 'i' : '✓', 'Documento',
            `${DOC_NAMES[kyc.tipoDocumento] || kyc.tipoDocumento} ${kyc.numeroDocumento} · ` +
            (docDemo ? 'Modo demostración: no se consultó la Registraduría' : 'Encontrado en la Registraduría')));
        list.appendChild(resultRow(docDemo ? 'demo' : 'ok', docDemo ? 'i' : '✓', 'Nombre registrado', `${kyc.nombres || ''} ${kyc.apellidos || ''}`.trim()));
        if (rechazado) {
            list.appendChild(resultRow('error', '✕', 'Antecedentes judiciales (Policía Nacional)',
                (bg.alertas && bg.alertas[0]) || 'Registra asuntos pendientes con las autoridades judiciales'));
        } else {
            list.appendChild(resultRow(bgDemo ? 'demo' : 'ok', bgDemo ? 'i' : '✓', 'Antecedentes judiciales (Policía Nacional)',
                bgDemo ? 'Modo demostración: no se consultaron antecedentes' : 'Sin reportes: no registra asuntos pendientes con las autoridades judiciales'));
        }
        list.appendChild(resultRow('ok', '🕒', 'Consulta realizada', new Date().toLocaleString('es-CO')));

        const hayDemo = docDemo || bgDemo;
        screen.querySelector('h1').textContent = rechazado ? 'Resultado de la verificación' : 'Identidad verificada';
        screen.querySelector('.reg-hint').textContent = hayDemo
            ? 'Modo demostración: parte de estos resultados es simulada.'
            : 'Esto fue lo que revisamos con los datos que ingresaste.';
        const summary = field('identityResultSummary');
        summary.className = 'reg-alert ' + (rechazado ? 'is-err' : 'is-ok');
        summary.textContent = rechazado
            ? 'No puedes abrir una cuenta bancaria con Banklite.'
            : (hayDemo ? 'Modo demostración: parte de estos resultados es simulada.' : 'No encontramos ningún reporte. Puedes continuar con tu registro.');

        // Rechazado: sin "Atrás" ni "Continuar"; solo "Volver al inicio".
        screen.querySelector('.reg-back').hidden = rechazado;
        field('identityResultContinue').hidden = rechazado;
        field('identityResultHome').hidden = !rechazado;

        show('identity-result');
        if (rechazado) {
            setText('regHeroTitle', 'No pudimos abrir tu cuenta');
            setText('regHeroSub', 'Revisamos tus datos y no es posible continuar.');
        }
    }

    onSubmit('identity', async screen => {
        if (!state.idUser || !state.kyc) return alertIn(screen, 'Primero debes completar tus datos personales.');
        // Ya verificada con estos mismos datos (volvió atrás sin cambiar nada): seguir.
        if (state.identityVerified) return showEmailInput();
        const button = field('identityVerifyBtn');
        if (button.disabled) return;
        setLoading(button, true, 'Verificando identidad');
        field('identityLoading').hidden = false;
        try {
            const result = await api(config.kycApi, 'POST', '/kyc/submit', {
                idUser: state.idUser, ...state.kyc,
                // Token que entrega el primer envío; sin él nadie más puede reescribir estos datos.
                ...(state.kycSubmissionToken ? { submissionToken: state.kycSubmissionToken } : {}),
            });
            if (result.submissionToken) state.kycSubmissionToken = result.submissionToken;
            if (result.status !== 'verified') {
                const p = result.provider || {};
                if (p.background && p.background.nivelRiesgo === 'alto') {
                    state.identityVerified = false; state.identityResult = null;
                    renderIdentityResult(result);
                    return;
                }
                const bgFallo = p.background && p.background.nivelRiesgo !== 'no-evaluado';
                const razon = (bgFallo ? ((p.background.alertas || [])[0] || p.background.message) : null)
                    || (p.document && p.document.message)
                    || (p.background && p.background.message);
                throw new Error(razon || 'La identidad no pudo ser verificada. Revisa los datos del documento.');
            }
            state.identityVerified = true;
            state.identityResult = result;
            renderIdentityResult(result);
        } catch (err) {
            alertIn(screen, err.message || 'No se pudo verificar la identidad.');
        } finally {
            setLoading(button, false, state.identityVerified ? 'Continuar' : 'Verificar identidad');
            field('identityLoading').hidden = true;
        }
    });

    onSubmit('identity-result', () => showEmailInput());

    // Rechazo por antecedentes: se descarta el registro y se vuelve a la portada.
    field('identityResultHome').addEventListener('click', () => { window.location.href = 'index.html'; });


    // ---------- Códigos (correo y WhatsApp) ----------

    const boxesFor = channel => initPinBoxes(field(channel === 'email' ? 'regEmailCode' : 'regPhoneCode'));

    // Muestra la pantalla del código con el tiempo que le queda al código vigente.
    function openCode(channel) {
        const email = channel === 'email';
        const expires = email ? state.emailCodeExpiresAt : state.phoneCodeExpiresAt;
        const left = Math.max(Math.round((expires - Date.now()) / 1000), 0);
        setText(email ? 'regEmailTarget' : 'regPhoneTarget', email ? state.email : state.phone);
        field(email ? 'regEmailDemo' : 'regPhoneDemo').textContent = email
            ? 'Revisa tu bandeja de entrada (y la carpeta de spam).'
            : 'Código enviado por WhatsApp. No se muestra en pantalla.';
        show(email ? 'email-code' : 'phone-code');
        timer?.stop();
        timer = startCodeTimer(field(email ? 'regEmailTimer' : 'regPhoneTimer'), field(email ? 'regEmailResend' : 'regPhoneResend'), left);
    }

    // No se pide un código nuevo mientras el anterior siga vigente (igual que el index).
    const canResend = channel => Date.now() >= (channel === 'email' ? state.emailCodeExpiresAt : state.phoneCodeExpiresAt);


    // ---------- 3. Correo ----------

    function showEmailInput() {
        field('regEmail').value = state.email || field('regEmail').value;
        show('email');
    }

    async function sendEmailCode() {
        const sent = await api(config.authApi, 'POST', '/auth/email/send', { idUser: state.idUser, email: state.email });
        state.emailCodeFor = state.email.toLowerCase();
        state.emailCodeExpiresAt = new Date(sent.expiresAt).getTime();
        boxesFor('email').clear();
        openCode('email');
    }

    onSubmit('email', async screen => {
        if (!state.identityVerified) return alertIn(screen, 'Primero debes verificar tu identidad.');
        const email = value('regEmail');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alertIn(screen, 'Ingresa un correo válido.');
        const emailKey = email.toLowerCase();
        const same = state.email.toLowerCase() === emailKey;
        // Ya verificado y sin cambios: seguir al teléfono.
        if (state.emailVerified && same) return show('phone');
        if (!same) state.emailVerified = false;
        // Código todavía vigente para este mismo correo: se retoma en vez de pedir otro.
        if (state.emailCodeFor === emailKey && Date.now() < state.emailCodeExpiresAt) return openCode('email');

        const button = screen.querySelector('button[type="submit"]');
        setLoading(button, true, 'Continuar');
        try {
            const availability = await api(config.authApi, 'POST', '/auth/email/check', { email });
            if (!availability.available) return alertIn(screen, 'Correo electrónico registrado en otra cuenta.');
            state.email = email;
            state.kyc.email = email;
            await sendEmailCode();
            toast('Código enviado a tu correo.', 'ok');
        } catch (err) {
            alertIn(screen, err.message || 'No se pudo enviar el código por correo.');
        } finally { setLoading(button, false, 'Continuar'); }
    });

    onSubmit('email-code', async screen => {
        const boxes = boxesFor('email');
        if (!boxes.isComplete()) { boxes.error(); return alertIn(screen, 'Escribe los 6 dígitos del código.'); }
        const button = screen.querySelector('button[type="submit"]');
        setLoading(button, true, 'Verificar correo');
        try {
            await api(config.authApi, 'POST', '/auth/email/verify', { idUser: state.idUser, email: state.email, code: boxes.value() });
            state.emailVerified = true;
            timer?.stop();
            toast('Correo verificado.', 'ok');
            show('phone');
        } catch (err) {
            boxes.error();
            alertIn(screen, err.message || 'No se pudo verificar el correo.');
        } finally { setLoading(button, false, 'Verificar correo'); }
    });

    field('regEmailResend')?.addEventListener('click', async () => {
        const screen = screenOf('email-code');
        hideAlert(screen);
        if (!canResend('email')) return alertIn(screen, 'Tu código aún no ha vencido.');
        try {
            await sendEmailCode();
            toast('Código de correo reenviado.', 'ok');
        } catch (err) { alertIn(screen, err.message || 'No se pudo reenviar el código.'); }
    });


    // ---------- 4. Teléfono (WhatsApp) ----------

    async function sendPhoneCode() {
        const result = await api(config.authApi, 'POST', '/auth/whatsapp/send', { idUser: state.idUser, phone: state.phone });
        state.phoneCodeFor = state.phone;
        state.phoneCodeExpiresAt = new Date(result.expiresAt).getTime();
        boxesFor('phone').clear();
        openCode('phone');
    }

    onSubmit('phone', async screen => {
        if (!state.identityVerified || !state.emailVerified) return alertIn(screen, 'Primero debes verificar tu identidad y tu correo.');
        const country = value('regCountry') || '+57';
        const phone = value('regPhone');
        if (!/^\d{10}$/.test(phone)) return alertIn(screen, 'Ingresa un número de teléfono válido de 10 dígitos.');
        const fullPhone = country + phone;
        // Ya verificado y sin cambios: seguir al usuario.
        if (state.phoneVerified && state.phone === fullPhone) return show('username');
        if (state.phone !== fullPhone) state.phoneVerified = false;
        // Código de WhatsApp todavía vigente para este mismo número: se retoma.
        if (state.phoneCodeFor === fullPhone && Date.now() < state.phoneCodeExpiresAt) return openCode('phone');

        const button = screen.querySelector('button[type="submit"]');
        setLoading(button, true, 'Enviando WhatsApp');
        try {
            const availability = await api(config.authApi, 'POST', '/auth/phone/check', { phone: fullPhone });
            if (!availability.available) return alertIn(screen, 'Número de teléfono registrado en otra cuenta.');
            state.phone = fullPhone;
            state.kyc.telefono = fullPhone;
            await sendPhoneCode();
            toast('Código enviado por WhatsApp.', 'ok');
        } catch (err) {
            alertIn(screen, err.message || 'WhatsApp no pudo enviar el código.');
        } finally { setLoading(button, false, 'Enviar código por WhatsApp'); }
    });

    onSubmit('phone-code', async screen => {
        const boxes = boxesFor('phone');
        if (!boxes.isComplete()) { boxes.error(); return alertIn(screen, 'Escribe los 6 dígitos del código.'); }
        if (!state.phoneCodeFor) return alertIn(screen, 'Primero solicita el código por WhatsApp.');
        // Ventana estricta de 5 minutos para el código de WhatsApp.
        if (Date.now() >= state.phoneCodeExpiresAt) return alertIn(screen, 'El código ha expirado. Solicita un nuevo código.');
        const button = screen.querySelector('button[type="submit"]');
        setLoading(button, true, 'Verificando teléfono');
        try {
            await api(config.authApi, 'POST', '/auth/whatsapp/verify', { idUser: state.idUser, phone: state.phone, code: boxes.value() });
            state.phoneVerified = true;
            timer?.stop();
            toast('Teléfono verificado.', 'ok');
            field('regUsername').value = state.username || '';
            show('username');
        } catch (err) {
            boxes.error();
            alertIn(screen, err.message || 'No se pudo verificar el teléfono.');
        } finally { setLoading(button, false, 'Verificar teléfono'); }
    });

    field('regPhoneResend')?.addEventListener('click', async () => {
        const screen = screenOf('phone-code');
        hideAlert(screen);
        if (!canResend('phone')) return alertIn(screen, 'Tu código aún no ha vencido.');
        try {
            await sendPhoneCode();
            toast('Código reenviado por WhatsApp.', 'ok');
        } catch (err) { alertIn(screen, err.message || 'No se pudo reenviar el código por WhatsApp.'); }
    });


    // ---------- 5. Usuario (único en todo el banco, validado en el servidor) ----------

    onSubmit('username', async screen => {
        if (!state.identityVerified || !state.emailVerified || !state.phoneVerified) {
            return alertIn(screen, 'Debes completar identidad, correo y teléfono antes de crear tu usuario.');
        }
        const username = value('regUsername');
        if (username.length < 3) return alertIn(screen, 'Tu usuario debe tener al menos 3 caracteres.');
        if (/\s/.test(username)) return alertIn(screen, 'Tu usuario no puede tener espacios.');
        if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return alertIn(screen, 'Usa de 3 a 30 letras, números, punto, guion o guion bajo.');
        const button = screen.querySelector('button[type="submit"]');
        setLoading(button, true, 'Continuar');
        try {
            const { available } = await api(config.authApi, 'POST', '/auth/username/check', { username });
            if (!available) return alertIn(screen, 'Ese usuario ya está en uso. Elige otro.');
            state.username = username;
            screenOf('pin').querySelectorAll('.pin-boxes').forEach(box => initPinBoxes(box).clear());
            show('pin');
        } catch (err) {
            alertIn(screen, err.message || 'No se pudo validar el usuario.');
        } finally { setLoading(button, false, 'Continuar'); }
    });


    // ---------- 6. Clave y creación de credenciales ----------

    const pinScreen = screenOf('pin');
    const [pinBoxes, confirmBoxes] = [...pinScreen.querySelectorAll('.pin-boxes')].map(initPinBoxes);

    // Aviso mientras escribe: clave insegura o fecha de nacimiento (no bloquea, igual que el index).
    function checkPinWarning() {
        const pin = pinBoxes.value();
        const confirm = confirmBoxes.value();
        const birth = state.kyc?.fechaNacimiento;
        if ((pin.length === 4 && !BlApi.isSecurePin(pin)) || (confirm.length === 4 && !BlApi.isSecurePin(confirm))) {
            alertIn(pinScreen, 'Esta clave es insegura.');
        } else if (BlApi.pinMatchesBirthdate(pin, birth) || BlApi.pinMatchesBirthdate(confirm, birth)) {
            alertIn(pinScreen, 'Por seguridad, evita usar tu fecha de nacimiento como clave de acceso.');
        } else {
            hideAlert(pinScreen);
        }
    }
    pinScreen.querySelectorAll('.pin-boxes input').forEach(input => input.addEventListener('input', checkPinWarning));

    onSubmit('pin', async screen => {
        const pin = pinBoxes.value();
        const confirmPin = confirmBoxes.value();
        if (pin.length !== 4 || confirmPin.length !== 4) return alertIn(screen, 'Completa los 4 dígitos en ambos campos.');
        if (!BlApi.isSecurePin(pin)) { pinBoxes.error(); return alertIn(screen, 'Esta clave es insegura.'); }
        if (pin !== confirmPin) { confirmBoxes.error(); confirmBoxes.clear(); return alertIn(screen, 'Las dos claves no coinciden.'); }
        if (!field('regTerms').checked) return alertIn(screen, 'Debes aceptar los términos de uso y la política de privacidad.');
        if (!state.identityVerified || !state.emailVerified || !state.phoneVerified) {
            return alertIn(screen, 'Debes completar identidad, correo y teléfono antes de crear tu cuenta.');
        }
        const button = screen.querySelector('button[type="submit"]');
        setLoading(button, true, 'Crear cuenta');
        try {
            await api(config.authApi, 'POST', '/auth/register', {
                idUser: state.idUser,
                email: state.email,
                username: state.username,
                password: BlApi.passwordFromPin(pin),
            });
            // La cuenta ya está protegida por identidad, correo y teléfono: al login con el usuario escrito.
            try { sessionStorage.setItem('bl.prefillUsername', state.username); } catch { /* sin almacenamiento */ }
            showMessage('Registro exitoso', 'Tu cuenta Banklite fue creada. Ya puedes iniciar sesión.', '✓');
            setTimeout(() => { window.location.href = 'login.html'; }, 1400);
        } catch (err) {
            alertIn(screen, err.message || 'No se pudo crear la cuenta.');
            setLoading(button, false, 'Crear cuenta');
        }
    });

    show('info');
    ready = true;
});
