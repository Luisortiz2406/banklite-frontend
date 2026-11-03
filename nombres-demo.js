// =========================================================
// BANKLITE - NOMBRES FICTICIOS
// Banklite es un proyecto académico y no usa marcas reales: bancos, comercios,
// convenios y operadores tienen nombres ficticios que no corresponden a ninguna
// empresa real de Colombia. Los movimientos viejos del ledger guardaron el
// nombre de entonces (una marca real o, después, un nombre "Demo"): al
// mostrarlos se traduce al nombre vigente. La historia contable no se
// reescribe. Mismos nombres que transfer-service, payment-service,
// card-service y notification-service.
// =========================================================

const BlNombres = (function () {
    const LEGACY = {
        // transfer-service: bancos y billeteras
        Bancolombia: "Banco Cordillera",
        "Banco Demo Cóndor": "Banco Cordillera",
        "Banco de Bogotá": "Banco Guayacán",
        "Banco Demo Ceiba": "Banco Guayacán",
        Davivienda: "Banco Altamar",
        "Banco Demo Guadua": "Banco Altamar",
        "BBVA Colombia": "Banco Meridiano",
        "Banco Demo Frailejón": "Banco Meridiano",
        "Banco de Occidente": "Banco Sabanal",
        "Banco Demo Orquídea": "Banco Sabanal",
        Nequi: "Billetera Pulso",
        "Billetera Demo Colibrí": "Billetera Pulso",
        DaviPlata: "Billetera Brío",
        "Billetera Demo Tucán": "Billetera Brío",
        // card-service: suscripciones y tiendas
        Netflix: "Cineluz",
        "Cine Demo Estelar": "Cineluz",
        Spotify: "Ritmia",
        "Música Demo Sonar": "Ritmia",
        "YouTube Premium": "Pantalla Viva",
        "Video Demo Arcoíris": "Pantalla Viva",
        "Prime Video": "Estreno Plus",
        "Cine Demo Prisma": "Estreno Plus",
        Max: "Serial+",
        "Series Demo Aurora": "Serial+",
        "Paramount+": "Cumbre Play",
        "Cine Demo Cumbre": "Cumbre Play",
        Crunchyroll: "AnimeCielo",
        "Anime Demo Sakura": "AnimeCielo",
        "Apple Music": "Melodía Plus",
        "Música Demo Ritmo": "Melodía Plus",
        Deezer: "Eco Música",
        "Música Demo Eco": "Eco Música",
        "iCloud+": "Nubia Drive",
        "Nube Demo Cirro": "Nubia Drive",
        "ChatGPT Plus": "Asistente Sabio",
        "Asistente Demo IA": "Asistente Sabio",
        "Duolingo Super": "LinguaLoro",
        "Idiomas Demo Loro": "LinguaLoro",
        "Xbox Game Pass": "Arcadia Pass",
        "Juegos Demo Arcade": "Arcadia Pass",
        "PlayStation Plus": "Consola Total",
        "Juegos Demo Consola": "Consola Total",
        Éxito: "Supermercado Doña Canasta",
        "Supermercado Demo La Canasta": "Supermercado Doña Canasta",
        Falabella: "Almacenes Mirador",
        "Almacén Demo Plaza": "Almacenes Mirador",
        "Juan Valdez Café": "Café Cerro Alto",
        "Café Demo Montaña": "Café Cerro Alto",
        "Mercado Libre": "Tienda Vitrina",
        "Tienda en línea Demo Mercadito": "Tienda Vitrina",
        Rappi: "Mandaditos Ya",
        "Domicilios Demo Rápido": "Mandaditos Ya",
        // payment-service: convenios y operadores
        "Acueducto de Bogotá": "Acueducto Montecielo",
        "Aguas Demo Sabana": "Acueducto Montecielo",
        "EPM Aguas": "Aguas de Piedralinda",
        "Aguas Demo Montaña": "Aguas de Piedralinda",
        "Aguas de Cartagena": "Aguas de Bahía Serena",
        "Aguas Demo Bahía": "Aguas de Bahía Serena",
        Emcali: "Hidrocauce",
        "Aguas Demo Valle": "Hidrocauce",
        Aqualia: "Acueducto Valleluna",
        "Aguas Demo Río": "Acueducto Valleluna",
        Veolia: "Aguas Brisaclara",
        "Aguas Demo Manantial": "Aguas Brisaclara",
        "Enel Colombia": "Energía Cumbre",
        "Energía Demo Sabana": "Energía Cumbre",
        "EPM Energía": "Voltaria",
        "Energía Demo Montaña": "Voltaria",
        "Air-e": "Luz del Llano",
        "Energía Demo Brisa": "Luz del Llano",
        Celsia: "Fulgor Energía",
        "Energía Demo Valle": "Fulgor Energía",
        Afinia: "Energía Brisamar",
        "Energía Demo Costa": "Energía Brisamar",
        Vanti: "Gas Sabanero",
        "Gas Demo Sabana": "Gas Sabanero",
        "EPM Gas": "Gas del Río",
        "Gas Demo Montaña": "Gas del Río",
        "Gases de Occidente": "Calorandes",
        "Gas Demo Valle": "Calorandes",
        Surtigas: "Gasbahía",
        "Gas Demo Bahía": "Gasbahía",
        "Gases del Caribe": "Gas Llamarada",
        "Gas Demo Costa": "Gas Llamarada",
        "Claro Hogar": "Ondanet Hogar",
        "Internet Demo Colibrí": "Ondanet Hogar",
        "Movistar Fibra": "Telvia Fibra",
        "Internet Demo Tucán": "Telvia Fibra",
        "Tigo Hogar": "Celmar Hogar",
        "Internet Demo Guacamaya": "Celmar Hogar",
        ETB: "Teleandes",
        "Internet Demo Cóndor": "Teleandes",
        Claro: "Ondanet",
        "Móvil Demo Colibrí": "Ondanet",
        Movistar: "Telvia",
        "Móvil Demo Tucán": "Telvia",
        Tigo: "Celmar",
        "Móvil Demo Guacamaya": "Celmar",
        WOM: "Fonik",
        "Móvil Demo Toche": "Fonik",
        "Virgin Mobile": "Lumo Móvil",
        "Móvil Demo Turpial": "Lumo Móvil",
        DirecTV: "Satelvisión",
        "TV Demo Satélite": "Satelvisión",
        "Claro TV": "Ondanet TV",
        "TV Demo Colibrí": "Ondanet TV",
        "Tigo TV": "Celmar TV",
        "TV Demo Guacamaya": "Celmar TV",
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
