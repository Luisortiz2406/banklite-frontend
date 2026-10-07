// Modo oscuro: se aplica antes de pintar para que no parpadee.
// Archivo aparte (cargado en <head>) porque la CSP no permite scripts inline.
try {
    var blTheme = localStorage.getItem("bankliteTheme");
    if (blTheme === "dark" || (blTheme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.dataset.theme = "dark";
        document.documentElement.style.background = "#0D1B1E";
    }
} catch (e) {}
