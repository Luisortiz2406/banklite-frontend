// Página de acceso de evaluación (acceso.html, pública).
// Manda el código que escribe la persona a POST /acceso/entrar en el encabezado
// X-Codigo-Evaluacion. nginx lo compara con EVAL_CODE (variable de Railway): si coincide
// responde 204 y deja la cookie banklite_eval (HttpOnly), y si no, 401.
// El código correcto nunca está en este archivo ni en el repositorio.
(function () {
    var form = document.getElementById("acceso-form");
    var campo = document.getElementById("acceso-codigo");
    var boton = document.getElementById("acceso-boton");
    var mensaje = document.getElementById("acceso-mensaje");

    // Mismo formato que exige el contenedor para EVAL_CODE.
    var FORMATO = /^[A-Za-z0-9_-]{1,128}$/;

    function mostrar(texto) {
        mensaje.textContent = texto;
        mensaje.hidden = false;
        campo.setAttribute("aria-invalid", "true");
        campo.focus();
        campo.select();
    }

    function limpiar() {
        mensaje.hidden = true;
        mensaje.textContent = "";
        campo.removeAttribute("aria-invalid");
    }

    function incorrecto() {
        mostrar(
            "Ese código no coincide. Revisa que esté bien escrito (sin espacios) e inténtalo de nuevo. " +
                "Si no lo tienes, pídeselo al equipo del proyecto."
        );
    }

    campo.addEventListener("input", limpiar);

    form.addEventListener("submit", function (evento) {
        evento.preventDefault();
        var codigo = campo.value.trim();

        if (!codigo) {
            mostrar("Escribe el código de evaluación para continuar.");
            return;
        }
        if (!FORMATO.test(codigo)) {
            incorrecto();
            return;
        }

        boton.disabled = true;
        boton.textContent = "Comprobando…";

        fetch("/acceso/entrar", {
            method: "POST",
            headers: { "X-Codigo-Evaluacion": codigo },
            credentials: "same-origin",
            cache: "no-store",
        })
            .then(function (respuesta) {
                if (respuesta.status === 204) {
                    window.location.replace("/");
                    return;
                }
                incorrecto();
            })
            .catch(function () {
                mostrar("No pudimos comprobar el código. Revisa tu conexión e inténtalo de nuevo.");
            })
            .then(function () {
                boton.disabled = false;
                boton.textContent = "Entrar";
            });
    });
})();
