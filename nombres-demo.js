// =========================================================
// BANKLITE - NOMBRES DE DEMOSTRACIÓN
// Banklite es un proyecto académico y no usa marcas reales: bancos, comercios,
// convenios y operadores tienen nombres inventados ("Demo"). Los movimientos
// viejos del ledger guardaron el nombre de entonces ("Transferencia a
// Bancolombia", "Suscripción Netflix · …"): al mostrarlos se traduce al nombre
// vigente. La historia contable no se reescribe. Mismos nombres que
// transfer-service, payment-service, card-service y notification-service.
// =========================================================

const BlNombres = (function () {
    const LEGACY = {
        // transfer-service: bancos y billeteras
        Bancolombia: "Banco Demo Cóndor",
        "Banco de Bogotá": "Banco Demo Ceiba",
        Davivienda: "Banco Demo Guadua",
        "BBVA Colombia": "Banco Demo Frailejón",
        "Banco de Occidente": "Banco Demo Orquídea",
        Nequi: "Billetera Demo Colibrí",
        DaviPlata: "Billetera Demo Tucán",
        // card-service: suscripciones y tiendas
        Netflix: "Cine Demo Estelar",
        Spotify: "Música Demo Sonar",
        "YouTube Premium": "Video Demo Arcoíris",
        "Prime Video": "Cine Demo Prisma",
        Max: "Series Demo Aurora",
        "Paramount+": "Cine Demo Cumbre",
        Crunchyroll: "Anime Demo Sakura",
        "Apple Music": "Música Demo Ritmo",
        Deezer: "Música Demo Eco",
        "iCloud+": "Nube Demo Cirro",
        "ChatGPT Plus": "Asistente Demo IA",
        "Duolingo Super": "Idiomas Demo Loro",
        "Xbox Game Pass": "Juegos Demo Arcade",
        "PlayStation Plus": "Juegos Demo Consola",
        Éxito: "Supermercado Demo La Canasta",
        Falabella: "Almacén Demo Plaza",
        "Juan Valdez Café": "Café Demo Montaña",
        "Mercado Libre": "Tienda en línea Demo Mercadito",
        Rappi: "Domicilios Demo Rápido",
        // payment-service: convenios y operadores
        "Acueducto de Bogotá": "Aguas Demo Sabana",
        "EPM Aguas": "Aguas Demo Montaña",
        "Aguas de Cartagena": "Aguas Demo Bahía",
        Emcali: "Aguas Demo Valle",
        Aqualia: "Aguas Demo Río",
        Veolia: "Aguas Demo Manantial",
        "Enel Colombia": "Energía Demo Sabana",
        "EPM Energía": "Energía Demo Montaña",
        "Air-e": "Energía Demo Brisa",
        Celsia: "Energía Demo Valle",
        Afinia: "Energía Demo Costa",
        Vanti: "Gas Demo Sabana",
        "EPM Gas": "Gas Demo Montaña",
        "Gases de Occidente": "Gas Demo Valle",
        Surtigas: "Gas Demo Bahía",
        "Gases del Caribe": "Gas Demo Costa",
        "Claro Hogar": "Internet Demo Colibrí",
        "Movistar Fibra": "Internet Demo Tucán",
        "Tigo Hogar": "Internet Demo Guacamaya",
        ETB: "Internet Demo Cóndor",
        "Claro TV": "TV Demo Colibrí",
        "Tigo TV": "TV Demo Guacamaya",
        DirecTV: "TV Demo Satélite",
        Claro: "Móvil Demo Colibrí",
        Movistar: "Móvil Demo Tucán",
        Tigo: "Móvil Demo Guacamaya",
        WOM: "Móvil Demo Toche",
        "Virgin Mobile": "Móvil Demo Turpial",
        "llave Bre-B": "llave Banklite",
        "llaves Bre-B": "llaves Banklite",
    };

    const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Nombres largos primero ("Claro Hogar" antes que "Claro"); solo palabras
    // completas y con la misma mayúscula ("claro" o "máximo" no cambian).
    const PATTERN = new RegExp(
        `(?<![\\p{L}\\p{N}])(${Object.keys(LEGACY)
            .sort((a, b) => b.length - a.length)
            .map(escapeRe)
            .join("|")})(?![\\p{L}\\p{N}])`,
        "gu"
    );

    // Campos de texto que pueden traer el nombre de un banco o comercio.
    const FIELDS = new Set(["description", "destinationBank", "merchantName", "billerName", "storeName"]);

    /** Texto con los nombres vigentes. */
    function current(text) {
        return typeof text === "string" ? text.replace(PATTERN, name => LEGACY[name] || name) : text;
    }

    /** Recorre una respuesta (lista, objeto o extracto) y traduce los campos de texto conocidos. */
    function apply(data, depth = 0) {
        if (depth > 4 || data == null || typeof data !== "object") return data;
        if (Array.isArray(data)) {
            data.forEach(item => apply(item, depth + 1));
            return data;
        }
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === "string" && FIELDS.has(key)) data[key] = current(value);
            else if (value && typeof value === "object") apply(value, depth + 1);
        }
        return data;
    }

    return { current, apply };
})();

window.BlNombres = BlNombres;
