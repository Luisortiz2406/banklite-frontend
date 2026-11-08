// =========================================================
// BANKLITE - BENEFICIOS (dashboard, "Promociones con tu tarjeta")
// Copia de la versión simulada. Simulación académica: los comercios son
// ficticios (sin nombres ni logos de marcas reales) y los códigos no sirven
// en ningún lado, por eso no hay servicio detrás.
// =========================================================

const BENEFIT_NOTICE =
    "Banklite es un proyecto académico. Los comercios son ficticios: los descuentos y códigos son de mentira y no sirven en ningún lado.";

const BENEFITS = {
    restaurantes: {
        badge: "Hasta 25% OFF",
        title: "Restaurantes aliados",
        intro: "Paga con tu tarjeta débito Banklite en restaurantes de ejemplo y recibe descuento en tu cuenta.",
        rules: ["Lunes a jueves", "Tope de $40.000 por compra", "Una vez al día por restaurante"],
        theme: "food",
        filters: ["Todos", "Comida colombiana", "Comida rápida", "Café y postres", "Internacional"],
        items: [
            {
                id: "creperia",
                name: "Crepería La Esquina",
                tag: "Internacional",
                where: "Bogotá, Medellín, Cali y más",
                off: "25%",
                logo: { bg: "#F5EAD7", fg: "#7A4B2A", text: "La Esquina", sub: "CREPERÍA", font: "serif" },
            },
            {
                id: "fogon",
                name: "El Fogón de la Abuela",
                tag: "Comida colombiana",
                where: "Chía, Bogotá, Medellín y Cartagena",
                off: "15%",
                logo: { bg: "#7A2E1F", fg: "#FFFFFF", text: "El Fogón", sub: "de la Abuela", font: "script" },
            },
            {
                id: "parrilla",
                name: "Parrilla Express",
                tag: "Comida rápida",
                where: "Todo el país",
                off: "20%",
                logo: { bg: "#C2410C", fg: "#FFFFFF", text: "PARRILLA", font: "block" },
            },
            {
                id: "pollito",
                name: "Pollo Dorado",
                tag: "Comida rápida",
                where: "Todo el país",
                off: "20%",
                logo: { bg: "#F59E0B", fg: "#3B1D00", text: "Pollo Dorado", font: "round" },
            },
            {
                id: "cafemontana",
                name: "Café Montaña",
                tag: "Café y postres",
                where: "Todo el país",
                off: "10%",
                logo: { bg: "#3B2A20", fg: "#FFFFFF", text: "Montaña", sub: "CAFÉ", font: "serif" },
            },
            {
                id: "dragon",
                name: "Dragón Wok",
                tag: "Internacional",
                where: "Bogotá, Medellín y Cali",
                off: "15%",
                logo: { bg: "#1F2937", fg: "#FFFFFF", text: "DRAGÓN", font: "block", dot: "#2CCED2" },
            },
            {
                id: "trattoria",
                name: "Trattoria Nonna",
                tag: "Internacional",
                where: "Bogotá, Medellín, Cali y Barranquilla",
                off: "20%",
                logo: { bg: "#14532D", fg: "#FFFFFF", text: "Nonna", font: "script" },
            },
            {
                id: "sazon",
                name: "Sazón Paisa",
                tag: "Comida colombiana",
                where: "Medellín y Bogotá",
                off: "15%",
                logo: { bg: "#FCD34D", fg: "#4A2511", text: "Sazón Paisa", font: "round" },
            },
            {
                id: "burgerbox",
                name: "Burger Box",
                tag: "Comida rápida",
                where: "Todo el país",
                off: "25%",
                logo: { bg: "#B91C1C", fg: "#FFFFFF", text: "burger box", font: "round" },
            },
        ],
    },

    viajes: {
        badge: "15% OFF",
        title: "Viajes y experiencias",
        intro: "Planes con tiquete y hotel por Colombia y el mundo. El 15% de descuento ya está aplicado en el precio.",
        rules: ["Precio por persona", "Tiquete ida y vuelta desde Bogotá", "Hasta 6 cuotas con tu tarjeta"],
        theme: "travel",
        filters: ["Todos", "Colombia", "Internacional"],
        items: [
            {
                id: "cartagena",
                name: "Cartagena",
                tag: "Colombia",
                where: "Bolívar · Ciudad amurallada",
                nights: 3,
                price: 1250000,
                scene: "colonial",
                sky: ["#FF9A62", "#FFD38A"],
            },
            {
                id: "sanandres",
                name: "San Andrés",
                tag: "Colombia",
                where: "Mar de los siete colores",
                nights: 4,
                price: 1890000,
                scene: "beach",
                sky: ["#5ED9F2", "#C9F4FF"],
                sea: "#16C2C8",
            },
            {
                id: "tayrona",
                name: "Santa Marta y Tayrona",
                tag: "Colombia",
                where: "Magdalena · Playa y selva",
                nights: 3,
                price: 980000,
                scene: "beach",
                sky: ["#7FD0E8", "#E2F7FF"],
                sea: "#1690B8",
                hills: true,
            },
            {
                id: "salento",
                name: "Eje Cafetero",
                tag: "Colombia",
                where: "Salento y Valle del Cocora",
                nights: 2,
                price: 650000,
                scene: "mountain",
                sky: ["#9ED8E6", "#EAF8F4"],
                land: ["#4E9A5A", "#2E7A45"],
                palms: true,
            },
            {
                id: "medellin",
                name: "Medellín",
                tag: "Colombia",
                where: "Antioquia · Ciudad de la eterna primavera",
                nights: 3,
                price: 890000,
                scene: "city",
                sky: ["#8FB8E8", "#E8F1FF"],
                land: ["#5BA36A", "#3D8452"],
            },
            {
                id: "villaleyva",
                name: "Villa de Leyva",
                tag: "Colombia",
                where: "Boyacá · Pueblo colonial",
                nights: 2,
                price: 540000,
                scene: "colonial",
                sky: ["#8AC6EA", "#E8F6FF"],
            },
            {
                id: "cancun",
                name: "Cancún",
                tag: "Internacional",
                where: "México · Caribe mexicano",
                nights: 5,
                price: 3900000,
                scene: "beach",
                sky: ["#4FC3F7", "#D6F3FF"],
                sea: "#1BB3C9",
            },
            {
                id: "puntacana",
                name: "Punta Cana",
                tag: "Internacional",
                where: "República Dominicana · Todo incluido",
                nights: 5,
                price: 4200000,
                scene: "beach",
                sky: ["#FFB37A", "#FFE6B8"],
                sea: "#1E9FB8",
            },
            {
                id: "miami",
                name: "Miami",
                tag: "Internacional",
                where: "Estados Unidos · Playa y compras",
                nights: 4,
                price: 3600000,
                scene: "city",
                sky: ["#FF8FA3", "#FFD9B0"],
                sea: "#2AA9C9",
            },
            {
                id: "cusco",
                name: "Cusco y Machu Picchu",
                tag: "Internacional",
                where: "Perú · Maravilla del mundo",
                nights: 4,
                price: 3200000,
                scene: "mountain",
                sky: ["#A9C9EE", "#EEF5FF"],
                land: ["#6E9B57", "#4D7A3E"],
            },
            {
                id: "buenosaires",
                name: "Buenos Aires",
                tag: "Internacional",
                where: "Argentina · Tango y gastronomía",
                nights: 5,
                price: 4100000,
                scene: "city",
                sky: ["#7EB6E8", "#E3F0FF"],
            },
            {
                id: "madrid",
                name: "Madrid",
                tag: "Internacional",
                where: "España · Museos y tapas",
                nights: 7,
                price: 6900000,
                scene: "city",
                sky: ["#F7B267", "#FDE4C3"],
            },
            {
                id: "rio",
                name: "Río de Janeiro",
                tag: "Internacional",
                where: "Brasil · Playas y Cristo Redentor",
                nights: 5,
                price: 4600000,
                scene: "beach",
                sky: ["#6EC6F0", "#E0F5FF"],
                sea: "#1B9CC4",
                hills: true,
            },
            {
                id: "nuevayork",
                name: "Nueva York",
                tag: "Internacional",
                where: "Estados Unidos · La Gran Manzana",
                nights: 5,
                price: 6200000,
                scene: "city",
                sky: ["#7D8FD8", "#DCE3FF"],
            },
            {
                id: "paris",
                name: "París",
                tag: "Internacional",
                where: "Francia · La ciudad luz",
                nights: 6,
                price: 7400000,
                scene: "tower",
                sky: ["#B49BE8", "#F2E6FF"],
            },
        ],
    },

    online: {
        badge: "20% OFF",
        title: "Compras online",
        intro: "Activa tu código y úsalo al pagar con tu tarjeta Banklite en tiendas online de ejemplo.",
        rules: ["Solo compras en línea", "Tope de $150.000 por compra", "Código válido por 30 días"],
        theme: "shop",
        filters: ["Todos", "Deporte", "Moda", "Tecnología", "Tiendas por departamento"],
        items: [
            {
                id: "pasofirme",
                name: "Paso Firme",
                tag: "Deporte",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#111827", fg: "#FFFFFF", text: "PASO FIRME", font: "block" },
            },
            {
                id: "zancada",
                name: "Zancada",
                tag: "Deporte",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#F3F4F6", fg: "#111827", text: "zancada", font: "round" },
            },
            {
                id: "felino",
                name: "Felino Sport",
                tag: "Deporte",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#374151", fg: "#FFFFFF", text: "FELINO", font: "block", dot: "#2CCED2" },
            },
            {
                id: "equilibrio",
                name: "Equilibrio Running",
                tag: "Deporte",
                where: "Tienda online",
                off: "15%",
                logo: { bg: "#7F1D1D", fg: "#FFFFFF", text: "Equilibrio", font: "round" },
            },
            {
                id: "coraza",
                name: "Coraza Fit",
                tag: "Deporte",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#1D1D1D", fg: "#FFFFFF", text: "CORAZA", font: "block" },
            },
            {
                id: "vitrina",
                name: "Vitrina Moda",
                tag: "Moda",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#000000", fg: "#FFFFFF", text: "vitrina", font: "round" },
            },
            {
                id: "atelier",
                name: "Atelier Norte",
                tag: "Moda",
                where: "Tienda online",
                off: "15%",
                logo: { bg: "#FFFFFF", fg: "#111111", text: "ATELIER", font: "serif" },
            },
            {
                id: "basicos",
                name: "Básicos & Co.",
                tag: "Moda",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#FDE2E4", fg: "#9F1239", text: "Básicos & Co.", font: "round" },
            },
            {
                id: "tecnoplaza",
                name: "TecnoPlaza",
                tag: "Tecnología",
                where: "Tienda online",
                off: "10%",
                logo: { bg: "#E5E7EB", fg: "#111827", text: "TecnoPlaza", font: "round" },
            },
            {
                id: "pixel",
                name: "Pixel Hogar",
                tag: "Tecnología",
                where: "Tienda online",
                off: "15%",
                logo: { bg: "#1E3A8A", fg: "#FFFFFF", text: "PIXEL HOGAR", font: "block" },
            },
            {
                id: "mercadito",
                name: "Mercadito Online",
                tag: "Tiendas por departamento",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#FEF08A", fg: "#1E3A8A", text: "mercadito", font: "round" },
            },
            {
                id: "aurora",
                name: "Almacenes Aurora",
                tag: "Tiendas por departamento",
                where: "Tienda online",
                off: "20%",
                logo: { bg: "#84CC16", fg: "#FFFFFF", text: "aurora", font: "round" },
            },
        ],
    },

    cine: {
        badge: "2x1",
        title: "Cine y entretenimiento",
        intro: "Compra dos entradas y paga una en cines y parques de ejemplo.",
        rules: ["Martes y miércoles", "Salas 2D y 3D", "Máximo 2 entradas por transacción"],
        theme: "cinema",
        filters: [],
        items: [
            {
                id: "cineplaza",
                name: "CinePlaza",
                tag: "2x1 en entradas",
                where: "Más de 40 ciudades del país",
                off: "2x1",
                extra: "30% en combos de crispetas",
                logo: { bg: "#B91C1C", fg: "#FFFFFF", text: "CinePlaza", font: "block" },
            },
            {
                id: "estrella",
                name: "Cines Estrella",
                tag: "2x1 en entradas",
                where: "Bogotá, Medellín, Cali, Barranquilla y más",
                off: "2x1",
                extra: "Salas XD con 20% de descuento",
                logo: { bg: "#0B2A5B", fg: "#FFFFFF", text: "ESTRELLA", font: "block", dot: "#FACC15" },
            },
            {
                id: "pantalla",
                name: "Pantalla Grande",
                tag: "2x1 en entradas",
                where: "Bogotá, Medellín, Cali, Cartagena y más",
                off: "2x1",
                extra: "Salas VIP con 25% de descuento",
                logo: { bg: "#1E40AF", fg: "#FFFFFF", text: "Pantalla", font: "round" },
            },
            {
                id: "butaca",
                name: "Cine Butaca",
                tag: "2x1 en entradas",
                where: "Bogotá, Medellín, Cali, Cúcuta y más",
                off: "2x1",
                extra: "Combo pareja a $25.000",
                logo: { bg: "#1A3D8F", fg: "#FFFFFF", text: "BUTACA", font: "block", dot: "#F7941D" },
            },
            {
                id: "telon",
                name: "Telón Dorado",
                tag: "2x1 en entradas",
                where: "Costa Caribe, Santanderes, Eje Cafetero y más",
                off: "2x1",
                extra: "Martes de crispetas gratis",
                logo: { bg: "#151515", fg: "#E2B44B", text: "Telón Dorado", font: "serif" },
            },
            {
                id: "parquecafetal",
                name: "Parque Cafetal",
                tag: "2x1 en pasaportes",
                where: "Eje Cafetero",
                off: "2x1",
                extra: "Válido de martes a jueves",
                logo: { bg: "#6B3E26", fg: "#F7D9A8", text: "Parque Cafetal", font: "serif" },
            },
        ],
    },
};

// Íconos grandes del encabezado de cada panel
const BENEFIT_HERO_ICONS = {
    food: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 0-4 2.5-4 7h4",
    travel: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
    shop: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
    cinema: "M2 8h20v12H2zM2 8l3-5M9 8l3-5M16 8l3-5M2 3h20M10 11.5v5l4-2.5z",
};

// Códigos activados: solo en este navegador (son de mentira, no hay backend).
const BENEFITS_KEY = "bankliteBenefits";

function benefitSaved() {
    try {
        return JSON.parse(localStorage.getItem(BENEFITS_KEY)) || {};
    } catch {
        return {};
    }
}

function benefitStore(saved) {
    try {
        localStorage.setItem(BENEFITS_KEY, JSON.stringify(saved));
    } catch {
        /* sin almacenamiento */
    }
}

function benefitCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `BL-${part()}-${part()}`;
}

function benefitLogo(logo) {
    return `
        <div class="bf-logo is-word font-${logo.font || "block"}" style="background:${logo.bg};color:${logo.fg}">
            <span>${escapeHTML(logo.text)}${logo.dot ? `<i style="background:${logo.dot}"></i>` : ""}</span>
            ${logo.sub ? `<small>${escapeHTML(logo.sub)}</small>` : ""}
        </div>`;
}

// Foto real del destino (fotos-destinos.js, servida desde img/destinos/ del propio sitio).
// Si un destino no tiene foto, queda la ilustración en SVG.
function benefitArt(item) {
    const foto = typeof FOTOS_DESTINOS !== "undefined" ? FOTOS_DESTINOS[item.id] : null;
    if (!foto) return benefitScene(item);
    return `<img class="bf-photo" src="${escapeHTML(foto.src)}" alt="${escapeHTML(foto.alt)}" width="800" height="450" loading="lazy" decoding="async">`;
}

// Pie "Créditos de las fotos": autor, licencia y enlace al original de cada foto, como
// exigen sus licencias (CC BY / CC BY-SA). Los datos salen de fotos-destinos.js.
function benefitPhotoCredits(items) {
    if (typeof FOTOS_DESTINOS === "undefined") return "";
    const link = (url, text) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    const creditos = items
        .filter(item => FOTOS_DESTINOS[item.id])
        .map(item => {
            const foto = FOTOS_DESTINOS[item.id];
            const licencia = foto.licenciaUrl
                ? link(foto.licenciaUrl, escapeHTML(foto.licencia))
                : escapeHTML(foto.licencia);
            return `<li>${escapeHTML(item.name)}: ${link(foto.fuente, "foto")} de ${escapeHTML(foto.autor)}, ${licencia}</li>`;
        });
    if (!creditos.length) return "";
    return `
        <footer class="bf-credits">
            <h3>Créditos de las fotos</h3>
            <p>Fotos de Wikimedia Commons, recortadas y convertidas a WebP.</p>
            <ul>${creditos.join("")}</ul>
        </footer>`;
}

// Ilustración del destino dibujada en SVG (no necesita internet)
function benefitScene(item) {
    const [top, bottom] = item.sky;
    const id = "sky-" + item.id;
    const sea = item.sea || "#1AA6B7";
    const [land1, land2] = item.land || ["#6DBB7A", "#3F9256"];
    const sun = `<circle cx="248" cy="44" r="20" fill="#FFF3C4" opacity="0.95"/>`;
    const clouds = `<g fill="#FFFFFF" opacity="0.85"><ellipse cx="70" cy="40" rx="26" ry="9"/><ellipse cx="88" cy="34" rx="16" ry="9"/><ellipse cx="180" cy="58" rx="20" ry="6"/></g>`;
    const palm = (x, s = 1) =>
        `<g transform="translate(${x} ${118 - 40 * s}) scale(${s})" fill="none" stroke="#2F5D3A" stroke-width="3.2" stroke-linecap="round"><path d="M0 40c2-14 1-26-2-36"/><path d="M-2 4c-10-6-20-4-26 2M-2 4c8-8 18-9 26-5M-2 4c-4-9-12-13-20-13M-2 4c4-9 12-12 20-10M-2 4c-12 2-18 10-20 16"/></g>`;
    let art;

    if (item.scene === "beach") {
        art = `${sun}${clouds}
            ${item.hills ? `<path d="M0 92 60 60l50 26 50-34 70 40 70-22v60H0z" fill="${land2}" opacity="0.8"/>` : ""}
            <path d="M0 96c40-6 80 6 120 0s80-8 120-2 60 6 60 6v60H0z" fill="${sea}"/>
            <path d="M0 108c30-4 60 4 90 0s60-4 90 0 60 4 120-2" stroke="#FFFFFF" stroke-width="2" fill="none" opacity="0.55"/>
            <path d="M0 124c60-14 140-16 300-6v40H0z" fill="#F6E1B2"/>
            ${palm(46, 1.05)}${palm(250, 0.85)}`;
    } else if (item.scene === "mountain") {
        art = `${sun}${clouds}
            <path d="M0 110 70 46l40 34 50-54 70 66 70-40v108H0z" fill="${land2}"/>
            <path d="M160 26l14 14-14 2-12-4z" fill="#FFFFFF" opacity="0.9"/>
            <path d="M0 122c50-22 110-26 160-14s100 4 140-10v62H0z" fill="${land1}"/>
            ${item.palms ? `<g stroke="#2F5D3A" stroke-width="2.4" stroke-linecap="round"><path d="M84 124V70M84 72c-8-4-14-2-18 2M84 72c6-5 13-5 18-2M84 72c-2-6-7-8-12-8M84 72c3-6 8-7 13-6"/><path d="M226 124V80M226 82c-7-3-12-2-15 2M226 82c5-4 11-4 15-1"/></g>` : `<path d="M110 100h30l10-12h-50z" fill="#8C7A5B"/><path d="M104 88h52l-6-8h-40z" fill="#A99572"/>`}`;
    } else if (item.scene === "colonial") {
        art = `${sun}${clouds}
            <path d="M0 98h300v62H0z" fill="#E9C99A"/>
            <g fill="#F6D3A2"><path d="M20 70h46v42H20z"/><path d="M168 64h56v48h-56z"/></g>
            <g fill="#F3A0A0"><path d="M66 60h52v52H66z"/></g>
            <g fill="#FFE08A"><path d="M224 74h52v38h-52z"/></g>
            <path d="M118 46h50v66h-50z" fill="#FFFFFF"/>
            <path d="M126 46V30l17-14 17 14v16z" fill="#F7F1E6"/>
            <circle cx="143" cy="34" r="5" fill="#C9A15F"/>
            <g fill="#5B3B2E" opacity="0.75"><path d="M135 88a8 8 0 0 1 16 0v24h-16z"/><path d="M30 82h10v10H30zM46 82h10v10H46zM76 72h10v10H76zM98 72h10v10H98zM178 76h10v10h-10zM204 76h10v10h-10zM236 86h10v10h-10zM256 86h10v10h-10z"/></g>
            <path d="M0 112h300v4H0z" fill="#C79E6E"/>
            <g fill="#3F8F4E"><circle cx="12" cy="106" r="10"/><circle cx="290" cy="104" r="12"/></g>`;
    } else if (item.scene === "tower") {
        art = `${sun}${clouds}
            <g fill="#6B5E8E" opacity="0.45"><path d="M0 100h40V80h30v20h20V70h30v40H0zM190 110V76h26v14h24V66h30v44h30v10z"/></g>
            <path d="M150 14 160 60h-20zM140 60h20l10 34h-40zM130 94h40l14 30h-68z" fill="none" stroke="#3E3460" stroke-width="3.2" stroke-linejoin="round"/>
            <path d="M136 76h28M126 108h48" stroke="#3E3460" stroke-width="3"/>
            <path d="M0 124h300v36H0z" fill="#7FB37F"/>`;
    } else {
        art = `${sun}${clouds}
            ${item.sea ? `<path d="M0 120h300v40H0z" fill="${item.sea}"/>` : `<path d="M0 104c60-20 120-24 300-12v68H0z" fill="${land1}" opacity="0.7"/>`}
            <g fill="#2E5A66"><path d="M18 120V70h26v50z"/><path d="M50 120V48h22v72z"/><path d="M78 120V80h30v40z"/><path d="M114 120V36h24v84z"/><path d="M144 120V62h28v58z"/><path d="M178 120V52h20v68z"/><path d="M204 120V76h30v44z"/><path d="M240 120V58h24v62z"/><path d="M268 120V84h22v36z"/></g>
            <g fill="#FFE9A8" opacity="0.8"><path d="M56 56h4v4h-4zM64 66h4v4h-4zM120 46h4v4h-4zM128 60h4v4h-4zM120 74h4v4h-4zM184 62h4v4h-4zM246 68h4v4h-4zM254 82h4v4h-4zM150 72h4v4h-4zM24 80h4v4h-4z"/></g>
            ${item.sea ? palm(30, 0.8) + palm(272, 0.9) : ""}`;
    }

    return `
        <svg class="bf-scene" viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
            <rect width="300" height="150" fill="url(#${id})"/>
            ${art}
        </svg>`;
}

function benefitAction(key, item) {
    const saved = benefitSaved()[`${key}:${item.id}`];

    if (saved) {
        return `
            <div class="bf-code">
                <span>Tu código <small>(simulado)</small></span>
                <b>${escapeHTML(saved.code)}</b>
                <button type="button" class="bf-copy" data-bf-copy="${escapeHTML(saved.code)}">Copiar</button>
            </div>`;
    }

    const label = key === "viajes" ? "Reservar plan" : key === "online" ? "Obtener código" : "Activar beneficio";
    return `<button type="button" class="bf-activate" data-bf-activate="${item.id}">${label}</button>`;
}

function benefitItemHTML(key, item) {
    if (key === "viajes") {
        const before = Math.round(item.price / 0.85 / 1000) * 1000;
        return `
            <article class="bf-item bf-trip" data-bf-tag="${item.tag}">
                <div class="bf-trip-art">${benefitArt(item)}<span class="bf-pill">${item.tag}</span></div>
                <div class="bf-trip-body">
                    <strong>${item.name}</strong>
                    <small>${item.where}</small>
                    <div class="bf-price">
                        <span>${item.nights} noches desde</span>
                        <s>${formatMoney(before)}</s>
                        <b>${formatMoney(item.price)}</b>
                    </div>
                    ${benefitAction(key, item)}
                </div>
            </article>`;
    }

    return `
        <article class="bf-item" data-bf-tag="${item.tag}">
            <div class="bf-item-top">
                ${benefitLogo(item.logo)}
                <span class="bf-off">${item.off === "2x1" ? "2x1" : "-" + item.off}</span>
            </div>
            <strong>${item.name}</strong>
            <small>${item.tag} · ${item.where}</small>
            ${item.extra ? `<p class="bf-extra">+ ${item.extra}</p>` : ""}
            ${benefitAction(key, item)}
        </article>`;
}

function openBenefit(key) {
    const data = BENEFITS[key];
    const box = document.getElementById("benefitContent");
    if (!data || !box) return;

    box.dataset.benefit = key;
    box.innerHTML = `
        <header class="bf-hero theme-${data.theme}">
            <div class="bf-hero-text">
                <span class="bf-badge">${data.badge}</span>
                <h2 id="benefitTitle">${data.title}</h2>
                <p>${data.intro}</p>
                <ul>${data.rules.map(rule => `<li>${rule}</li>`).join("")}</ul>
            </div>
            <div class="bf-hero-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${BENEFIT_HERO_ICONS[data.theme]}"/></svg>
            </div>
        </header>

        <div class="bf-notice" role="note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20zM12 10v4M12 17h.01"/></svg>
            <p><b>Solo es una simulación.</b> ${BENEFIT_NOTICE}</p>
        </div>

        ${
            data.filters.length
                ? `
            <div class="bf-filters" role="group" aria-label="Filtrar">
                ${data.filters.map((filter, index) => `<button type="button" class="bf-filter${index === 0 ? " active" : ""}" data-bf-filter="${filter}">${filter}</button>`).join("")}
            </div>`
                : ""
        }

        <div class="bf-grid${key === "viajes" ? " is-trips" : ""}">
            ${data.items.map(item => benefitItemHTML(key, item)).join("")}
        </div>
        ${key === "viajes" ? benefitPhotoCredits(data.items) : ""}
    `;

    openModal("benefitModal");
    box.closest(".modal-card").scrollTop = 0;
}

function initBenefits() {
    document.querySelectorAll("[data-benefit]").forEach(button => {
        button.addEventListener("click", () => openBenefit(button.dataset.benefit));
    });

    const box = document.getElementById("benefitContent");
    if (!box) return;

    box.addEventListener("click", async event => {
        const key = box.dataset.benefit;
        const filter = event.target.closest("[data-bf-filter]");
        const activate = event.target.closest("[data-bf-activate]");
        const copy = event.target.closest("[data-bf-copy]");

        if (filter) {
            box.querySelectorAll(".bf-filter").forEach(btn => btn.classList.toggle("active", btn === filter));
            const value = filter.dataset.bfFilter;
            box.querySelectorAll(".bf-item").forEach(card => {
                card.hidden = value !== "Todos" && card.dataset.bfTag !== value;
            });
            return;
        }

        if (activate) {
            const item = BENEFITS[key].items.find(entry => entry.id === activate.dataset.bfActivate);
            if (!item) return;

            const saved = benefitSaved();
            saved[`${key}:${item.id}`] = { code: benefitCode(), date: new Date().toISOString() };
            benefitStore(saved);

            activate.outerHTML = benefitAction(key, item);
            toast(
                key === "viajes"
                    ? `Plan a ${item.name} apartado (simulación).`
                    : `Beneficio de ${item.name} activado (simulación).`,
                "ok"
            );
            return;
        }

        if (copy) {
            try {
                await navigator.clipboard.writeText(copy.dataset.bfCopy);
            } catch (error) {
                /* sin permiso */
            }
            copy.textContent = "Copiado";
            setTimeout(() => {
                copy.textContent = "Copiar";
            }, 1600);
        }
    });
}

// =========================================================
// CARRUSEL DE PROMOCIONES
// =========================================================

function initPromoCarousel() {
    const carousel = document.querySelector(".promo-carousel");

    if (!carousel) return;

    const cards = carousel.querySelectorAll(".promo-card");
    const [previousButton, nextButton] = document.querySelectorAll(".promo-controls .icon-btn");

    if (!cards.length || !previousButton || !nextButton) return;

    previousButton.setAttribute("aria-label", "Ver promociones anteriores");
    previousButton.title = "Promociones anteriores";
    nextButton.setAttribute("aria-label", "Ver más promociones");
    nextButton.title = "Más promociones";

    const controls = previousButton.closest(".promo-controls");

    const updateControls = () => {
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
        previousButton.disabled = carousel.scrollLeft <= 2;
        nextButton.disabled = carousel.scrollLeft >= maxScroll - 2;

        // Si todas las promociones caben en pantalla, las flechas sobran
        if (controls) controls.hidden = maxScroll <= 2;
    };

    previousButton.addEventListener("click", () => {
        carousel.scrollBy({ left: -carousel.clientWidth * 0.8, behavior: "smooth" });
    });

    nextButton.addEventListener("click", () => {
        carousel.scrollBy({ left: carousel.clientWidth * 0.8, behavior: "smooth" });
    });

    carousel.addEventListener("scroll", updateControls, { passive: true });
    window.addEventListener("resize", updateControls);
    updateControls();
}

document.addEventListener("DOMContentLoaded", () => {
    initBenefits();
    initPromoCarousel();
});
