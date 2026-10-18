// =========================================================
// BANKLITE - BENEFICIOS (dashboard, "Promociones con tu tarjeta")
// Copia de la versión simulada. Simulación académica: las marcas no
// tienen alianza real con Banklite y los códigos no sirven en ningún
// comercio, por eso no hay servicio detrás.
// =========================================================

// Logos de Simple Icons (CC0). Las marcas pertenecen a sus dueños.
const BENEFIT_LOGOS = {
    adidas: "m24 19.535-8.697-15.07-4.659 2.687 7.145 12.383Zm-8.287 0L9.969 9.59 5.31 12.277l4.192 7.258ZM4.658 14.723l2.776 4.812H1.223L0 17.41Z",
    apple: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701",
    handm: "M16.866 4.565c.871-.429 1.303-.372 1.313.061.012.565-.071 1.313-.131 1.857-.323 2.947-.864 5.356-.906 8.383 1.424-3.686 2.619-6.248 4.156-9.403.488-1.004.799-.818 1.2-.996 1.563-.695 1.622-.268 1.417.581-.758 3.15-2.695 13.068-2.992 14.595-.086.442-.566.255-.691.082-.556-.769-1.183-.781-1.112-1.293.348-2.546 1.603-8.934 1.93-10.439-1.669 3.42-3.398 7.694-4.286 10.118-.189.515-.531.477-.745.1-.3-.529-.883-.799-.979-1.424-.306-1.987.348-5.776.439-8.172-.908 2.618-2.433 7.701-3.101 9.997-.276.95-1.193.795-.949-.131 1.015-3.854 3.201-10.67 4.148-13.121.222-.576.805-.556 1.289-.795Zm-5.535-.474c.276.067.254.393.085.838-.499 1.314-1.19 3.04-1.981 5.076.497-.057.767-.076.767-.076.713-.088.846.269.645.648-.16.303-.353.101-1.02 1.096-.376.561-.99.709-1.332.784-.821 2.175-1.702 4.602-2.557 7.188-.125.377-.489.295-.598.142-.402-.562-.698-.58-1.01-1.034-.037-.074-.11-.173-.066-.354.229-.936.837-2.859 1.762-5.392-1.165.253-2.426.524-2.947.645-.624 1.651-1.234 3.308-1.811 4.944-.358 1.015-1.29.819-.963-.141.521-1.528 1.096-3.115 1.673-4.654-.646-.069-.864-.525-1.225-.906-.139-.147-.443-.126-.592-.332-.267-.371-.241-.536.377-.714.806-.233 1.617-.449 2.432-.649 1.044-2.694 1.987-5.006 2.49-6.239.388-.951 1.387-.862 1.008.075-.772 1.906-1.563 3.885-2.344 5.893.963-.217 1.931-.409 2.904-.576.713-1.831 1.462-3.648 2.247-5.449.055-.126.215-.304.381-.332.525-.09 1.379-.552 1.675-.481ZM9.543 16.426c.082-.05.163-.111.244-.178-.062-.183-.123-.366-.183-.55-.061.078-.12.157-.179.237-.349.479-.142.65.118.491Zm.465-2.275c.433-.489-.423-.693-.226.054.011.042.025.092.04.146.063-.065.125-.132.186-.2Zm.45 1.473c.429-.372.838-.003.414.624a6.955 6.955 0 0 1-.307.424c.045.128.091.255.14.381.219.562-.357.703-.542.237a7.29 7.29 0 0 1-.05-.129c-.35.31-.754.505-1.186.37-.711-.221-.892-1.222-.228-1.993.266-.309.466-.524.634-.695-.041-.133-.081-.267-.118-.401-.087-.312-.164-.675.148-1.046.586-.695 1.945-.078 1.257.992-.165.258-.359.501-.561.748.07.221.14.441.212.661.061-.06.123-.117.187-.173Z",
    newbalance:
        "M12.169 10.306l1.111-1.937 3.774-.242.132-.236-3.488-.242.82-1.414h6.47c1.99 0 3.46.715 2.887 2.8-.17.638-.979 2.233-3.356 2.899.507.06 1.76.616 1.54 2.057-.384 2.558-3.69 3.774-5.533 3.774l-7.641.006-.38-1.48 4.005-.28.137-.237-4.346-.264-.467-1.755 6.178-.363.137-.231-11.096-.693.534-.925 11.948-.775.138-.231-3.504-.231m5 .385l1.1-.006c.738-.005 1.502-.34 1.783-1.018.259-.632-.088-1.171-.55-1.166h-1.067l-1.266 2.19zm-1.27 2.195l-1.326 2.305h1.265c.589 0 1.64-.292 1.964-1.128.302-.781-.253-1.177-.638-1.177h-1.266zM6.26 16.445l-.77 1.315L0 17.77l.534-.923 5.726-.402zm.385-10.216l4.417.006.336 1.248-5.276-.33.523-.924zm5 2.245l.484 1.832-7.542-.495.528-.92 6.53-.417zm-3.84 5.281l-.957 1.661-5.32-.302.534-.924 5.743-.435z",
    nike: "M24 7.8L6.442 15.276c-1.456.616-2.679.925-3.668.925-1.12 0-1.933-.392-2.437-1.177-.317-.504-.41-1.143-.28-1.918.13-.775.476-1.6 1.036-2.478.467-.71 1.232-1.643 2.297-2.8a6.122 6.122 0 00-.784 1.848c-.28 1.195-.028 2.072.756 2.632.373.261.886.392 1.54.392.522 0 1.11-.084 1.764-.252L24 7.8z",
    puma: "M23.845 3.008c-.417-.533-1.146-.106-1.467.08-2.284 1.346-2.621 3.716-3.417 5.077-.626 1.09-1.652 1.89-2.58 1.952-.686.049-1.43-.084-2.168-.405-1.807-.781-2.78-1.792-3.017-1.97-.487-.37-4.23-4.015-7.28-4.164 0 0-.372-.75-.465-.763-.222-.025-.45.451-.616.501-.15.053-.413-.512-.565-.487-.153.02-.302.586-.6.877-.22.213-.486.2-.637.463-.052.096-.034.265-.093.42-.127.32-.551.354-.555.697 0 .381.357.454.669.72.248.212.265.362.554.461.258.088.632-.187.964-.088.277.081.543.14.602.423.054.256 0 .658-.34.613-.112-.015-.598-.174-1.198-.11-.725.077-1.553.309-1.634 1.11-.041.447.514.97 1.055.866.371-.071.196-.506.399-.716.267-.27 1.772.944 3.172.944.593 0 1.031-.15 1.467-.605.04-.029.093-.102.155-.11a.632.632 0 01.195.088c1.131.897 1.984 2.7 6.13 2.721.582.007 1.25.279 1.796.777.48.433.764 1.125 1.037 1.825.418 1.053 1.161 2.069 2.292 3.203.06.068.99.78 1.06.833.012.01.084.167.053.255-.02.69-.123 2.67 1.365 2.753.366.02.275-.231.275-.41-.005-.341-.065-.685.113-1.04.253-.478-.526-.709-.509-1.756.019-.784-.645-.651-.984-1.25-.19-.343-.368-.532-.35-.946.073-2.38-.517-3.948-.805-4.327-.227-.294-.423-.403-.207-.54 1.24-.815 1.525-1.574 1.525-1.574.66-1.541 1.256-2.945 2.075-3.57.166-.12.589-.44.852-.56.763-.362 1.173-.578 1.388-.788.356-.337.635-1.053.294-1.48z",
    underarmour:
        "M15.954 12c-.089.066-.195.142-.324.233-.826.585-2.023.985-3.58.985h-.104c-1.556 0-2.755-.4-3.58-.985A36.43 36.43 0 018.042 12c.09-.067.196-.143.324-.234.825-.584 2.024-.985 3.58-.985h.104c1.557 0 2.756.401 3.58.985.129.09.235.167.325.234M24 7.181s-.709-.541-2.95-1.365c-1.968-.721-3.452-.883-3.452-.883l.006 4.243c0 .598-.162 1.143-.618 1.765-1.672-.61-3.254-.985-4.981-.985-1.728 0-3.308.375-4.98.985-.457-.619-.62-1.168-.62-1.765l.007-4.243s-1.494.16-3.463.883C.709 6.642 0 7.181 0 7.181c.093 1.926 1.78 3.638 4.435 4.82C1.777 13.18.09 14.887 0 16.818c0 0 .709.54 2.949 1.365 1.968.721 3.453.883 3.453.883l-.007-4.244c0-.597.164-1.143.619-1.764 1.672.61 3.252.983 4.98.983 1.727 0 3.309-.374 4.98-.983.457.62.62 1.167.62 1.764l-.006 4.244s1.484-.16 3.452-.883c2.241-.826 2.95-1.365 2.95-1.365-.093-1.927-1.78-3.64-4.435-4.819 2.657-1.182 4.343-2.888 4.435-4.82",
    zara: "M8.562 7l.002.006 2.794 7.621v-7.23h-1.15v-.07h3.96c1.903 0 3.231.976 3.231 2.375 0 1.02-.91 1.868-2.263 2.109l-.249.031.25.026c.821.094 1.473.346 1.935.75l.003.003L19.141 7h.07l.002.006 3.556 9.698H24v.07h-3.918v-.07h1.154l-1.17-3.189h-2.373v.002l.013.037c.094.281.142.576.139.873v1.196c0 .615.271 1.238.79 1.238.304 0 .547-.107.837-.372l.041.038c-.314.332-.695.473-1.266.473-.43 0-.8-.104-1.096-.308l-.056-.04c-.39-.296-.644-.778-.753-1.435l-.018-.106-.018-.16-.002-.028-.654 1.78h.928v.07h-1.942v-.07h.938l.718-1.954v-.005a6.35 6.35 0 01-.013-.346v-.854c0-1.049-.78-1.65-2.14-1.65h-1.337v4.81h1.158v.07H9.433v-.07h1.154l-1.17-3.189H6.172l-1.158 3.154.048-.008c1.521-.262 2.22-1.423 2.23-2.645h.07v2.758H0l5.465-9.377H3.268c-1.822 0-2.646 1.407-2.659 2.81H.54v-2.88h6.634l-.04.07-5.425 9.307h2.854c.071 0 .141-.003.212-.009l.072-.006.09-.01L8.491 7h.07zm9.883 2.095l-1.313 3.576.007.007.067.066c.193.197.347.43.452.684l.007.017h2.375l-1.595-4.35zm-10.648 0l-1.599 4.35h3.194l-1.595-4.35zm6.026-1.698h-1.02v4.427h1.336c1.353 0 1.767-.493 1.767-2.107 0-1.517-.72-2.32-2.083-2.32z",
};

const BENEFIT_NOTICE =
    "Banklite es un proyecto académico. Estas marcas no tienen ninguna alianza con Banklite: los descuentos y códigos son de mentira y no sirven en ningún comercio. Los nombres y logos pertenecen a sus dueños y se muestran solo con fines educativos.";

const BENEFITS = {
    restaurantes: {
        badge: "Hasta 25% OFF",
        title: "Restaurantes aliados",
        intro: "Paga con tu tarjeta débito Banklite en los restaurantes más queridos de Colombia y recibe descuento en tu cuenta.",
        rules: ["Lunes a jueves", "Tope de $40.000 por compra", "Una vez al día por restaurante"],
        theme: "food",
        filters: ["Todos", "Comida colombiana", "Comida rápida", "Café y postres", "Internacional"],
        items: [
            {
                id: "crepes",
                name: "Crepes & Waffles",
                tag: "Internacional",
                where: "Bogotá, Medellín, Cali y más",
                off: "25%",
                logo: { bg: "#F5EAD7", fg: "#8E1F2F", text: "Crepes & Waffles", font: "serif" },
            },
            {
                id: "andres",
                name: "Andrés Carne de Res",
                tag: "Comida colombiana",
                where: "Chía, Bogotá, Medellín y Cartagena",
                off: "15%",
                logo: { bg: "#B3181E", fg: "#FFFFFF", text: "Andrés", sub: "Carne de Res", font: "script" },
            },
            {
                id: "corral",
                name: "El Corral",
                tag: "Comida rápida",
                where: "Todo el país",
                off: "20%",
                logo: { bg: "#D52B1E", fg: "#FFFFFF", text: "EL CORRAL", font: "block" },
            },
            {
                id: "frisby",
                name: "Frisby",
                tag: "Comida rápida",
                where: "Todo el país",
                off: "20%",
                logo: { bg: "#E30613", fg: "#FFD400", text: "Frisby", font: "round" },
            },
            {
                id: "juanvaldez",
                name: "Juan Valdez Café",
                tag: "Café y postres",
                where: "Todo el país",
                off: "10%",
                logo: { bg: "#2B2420", fg: "#FFFFFF", text: "Juan Valdez", sub: "CAFÉ", font: "serif" },
            },
            {
                id: "wok",
                name: "Wok",
                tag: "Internacional",
                where: "Bogotá, Medellín y Cali",
                off: "15%",
                logo: { bg: "#151515", fg: "#FFFFFF", text: "WOK", font: "block", dot: "#E1251B" },
            },
            {
                id: "archies",
                name: "Archie's",
                tag: "Internacional",
                where: "Bogotá, Medellín, Cali y Barranquilla",
                off: "20%",
                logo: { bg: "#0F6B3A", fg: "#FFFFFF", text: "Archie's", font: "script" },
            },
            {
                id: "mondongos",
                name: "Mondongo's",
                tag: "Comida colombiana",
                where: "Medellín y Bogotá",
                off: "15%",
                logo: { bg: "#F3B23A", fg: "#4A2511", text: "Mondongo's", font: "round" },
            },
            {
                id: "presto",
                name: "Presto",
                tag: "Comida rápida",
                where: "Todo el país",
                off: "25%",
                logo: { bg: "#E2231A", fg: "#FFFFFF", text: "presto", font: "round" },
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
        intro: "Activa tu código y úsalo al pagar con tu tarjeta Banklite en las tiendas online de tus marcas favoritas.",
        rules: ["Solo compras en línea", "Tope de $150.000 por compra", "Código válido por 30 días"],
        theme: "shop",
        filters: ["Todos", "Deporte", "Moda", "Tecnología", "Tiendas por departamento"],
        items: [
            {
                id: "adidas",
                name: "Adidas",
                tag: "Deporte",
                where: "adidas.co",
                off: "20%",
                logo: { icon: "adidas", fg: "#000000" },
            },
            {
                id: "nike",
                name: "Nike",
                tag: "Deporte",
                where: "nike.com",
                off: "20%",
                logo: { icon: "nike", fg: "#111111" },
            },
            {
                id: "puma",
                name: "Puma",
                tag: "Deporte",
                where: "co.puma.com",
                off: "20%",
                logo: { icon: "puma", fg: "#242B2F" },
            },
            {
                id: "newbalance",
                name: "New Balance",
                tag: "Deporte",
                where: "newbalance.com.co",
                off: "15%",
                logo: { icon: "newbalance", fg: "#CF0A2C" },
            },
            {
                id: "underarmour",
                name: "Under Armour",
                tag: "Deporte",
                where: "underarmour.com.co",
                off: "20%",
                logo: { icon: "underarmour", fg: "#1D1D1D" },
            },
            {
                id: "dafiti",
                name: "Dafiti",
                tag: "Moda",
                where: "dafiti.com.co",
                off: "20%",
                logo: { bg: "#000000", fg: "#FFFFFF", text: "dafiti", font: "round" },
            },
            {
                id: "zara",
                name: "Zara",
                tag: "Moda",
                where: "zara.com/co",
                off: "15%",
                logo: { icon: "zara", fg: "#000000" },
            },
            {
                id: "handm",
                name: "H&M",
                tag: "Moda",
                where: "hm.com",
                off: "20%",
                logo: { icon: "handm", fg: "#E50010" },
            },
            {
                id: "apple",
                name: "Apple",
                tag: "Tecnología",
                where: "apple.com/co",
                off: "10%",
                logo: { icon: "apple", fg: "#000000" },
            },
            {
                id: "samsung",
                name: "Samsung",
                tag: "Tecnología",
                where: "samsung.com/co",
                off: "15%",
                logo: { bg: "#1428A0", fg: "#FFFFFF", text: "SAMSUNG", font: "block" },
            },
            {
                id: "mercadolibre",
                name: "Mercado Libre",
                tag: "Tiendas por departamento",
                where: "mercadolibre.com.co",
                off: "20%",
                logo: { bg: "#FFE600", fg: "#2D3277", text: "mercado libre", font: "round" },
            },
            {
                id: "falabella",
                name: "Falabella",
                tag: "Tiendas por departamento",
                where: "falabella.com.co",
                off: "20%",
                logo: { bg: "#AAD000", fg: "#FFFFFF", text: "falabella", font: "round" },
            },
        ],
    },

    cine: {
        badge: "2x1",
        title: "Cine y entretenimiento",
        intro: "Compra dos entradas y paga una en las principales cadenas de cine de Colombia y en parques aliados.",
        rules: ["Martes y miércoles", "Salas 2D y 3D", "Máximo 2 entradas por transacción"],
        theme: "cinema",
        filters: [],
        items: [
            {
                id: "cinecolombia",
                name: "Cine Colombia",
                tag: "2x1 en entradas",
                where: "Más de 40 ciudades del país",
                off: "2x1",
                extra: "30% en combos de crispetas",
                logo: { bg: "#D71920", fg: "#FFFFFF", text: "Cine Colombia", font: "block" },
            },
            {
                id: "cinemark",
                name: "Cinemark",
                tag: "2x1 en entradas",
                where: "Bogotá, Medellín, Cali, Barranquilla y más",
                off: "2x1",
                extra: "Salas XD con 20% de descuento",
                logo: { bg: "#0B2A5B", fg: "#FFFFFF", text: "CINEMARK", font: "block", dot: "#E31B23" },
            },
            {
                id: "cinepolis",
                name: "Cinépolis",
                tag: "2x1 en entradas",
                where: "Bogotá, Medellín, Cali, Cartagena y más",
                off: "2x1",
                extra: "Salas VIP con 25% de descuento",
                logo: { bg: "#0D2C7D", fg: "#FFFFFF", text: "Cinépolis", font: "round" },
            },
            {
                id: "procinal",
                name: "Procinal",
                tag: "2x1 en entradas",
                where: "Bogotá, Medellín, Cali, Cúcuta y más",
                off: "2x1",
                extra: "Combo pareja a $25.000",
                logo: { bg: "#1A3D8F", fg: "#FFFFFF", text: "PROCINAL", font: "block", dot: "#F7941D" },
            },
            {
                id: "royalfilms",
                name: "Royal Films",
                tag: "2x1 en entradas",
                where: "Costa Caribe, Santanderes, Eje Cafetero y más",
                off: "2x1",
                extra: "Martes de crispetas gratis",
                logo: { bg: "#151515", fg: "#E2B44B", text: "Royal Films", font: "serif" },
            },
            {
                id: "parquecafe",
                name: "Parque del Café",
                tag: "2x1 en pasaportes",
                where: "Montenegro, Quindío",
                off: "2x1",
                extra: "Válido de martes a jueves",
                logo: { bg: "#6B3E26", fg: "#F7D9A8", text: "Parque del Café", font: "serif" },
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

const benefitMoney = value =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
        Number(value) || 0
    );

function benefitCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `BL-${part()}-${part()}`;
}

function benefitLogo(logo) {
    if (logo.icon && BENEFIT_LOGOS[logo.icon]) {
        return `<div class="bf-logo is-icon${logo.wide ? " is-wide" : ""}"><svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path fill="${logo.fg}" d="${BENEFIT_LOGOS[logo.icon]}"/></svg></div>`;
    }

    return `
        <div class="bf-logo is-word font-${logo.font || "block"}" style="background:${logo.bg};color:${logo.fg}">
            <span>${escapeHTML(logo.text)}${logo.dot ? `<i style="background:${logo.dot}"></i>` : ""}</span>
            ${logo.sub ? `<small>${escapeHTML(logo.sub)}</small>` : ""}
        </div>`;
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
                <div class="bf-trip-art">${benefitScene(item)}<span class="bf-pill">${item.tag}</span></div>
                <div class="bf-trip-body">
                    <strong>${item.name}</strong>
                    <small>${item.where}</small>
                    <div class="bf-price">
                        <span>${item.nights} noches desde</span>
                        <s>${benefitMoney(before)}</s>
                        <b>${benefitMoney(item.price)}</b>
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
