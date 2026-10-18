// Reglas de ESLint del frontend de BankLite.
// Va en .mjs (no .js) para que el Dockerfile, que publica frontend/*.js, no lo sirva.
//
// Los scripts no son módulos: se cargan con <script> y comparten funciones
// globales (escapeHTML de java.js, BlApi de api.js, ...). Para que no-undef
// detecte nombres mal escritos sin falsas alarmas, cada archivo recibe como
// globales lo que declaran en el nivel superior los demás archivos de su grupo.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import fs from "node:fs";
import path from "node:path";
import globals from "globals";

const VENDOR = ["qr-lib.js"];

// Nombres declarados en el nivel superior (sin sangría) o colgados de window
function topLevelNames(file) {
    const src = fs.readFileSync(file, "utf8");
    const names = new Set();
    for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
    return names;
}

// Las librerías QR exponen estos globales
const VENDOR_GLOBALS = { qrcode: "readonly", jsQR: "readonly" };

function groupConfigs(dir) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".js") && !VENDOR.includes(f));
    const declared = Object.fromEntries(files.map(f => [f, topLevelNames(path.join(dir, f))]));
    return files.map(f => {
        const shared = { ...VENDOR_GLOBALS };
        for (const [other, names] of Object.entries(declared)) {
            if (other === f) continue;
            for (const n of names) if (!declared[f].has(n)) shared[n] = "readonly";
        }
        return { files: [path.posix.join(dir === "." ? "" : dir, f)], languageOptions: { globals: shared } };
    });
}

export default defineConfig(
    { ignores: ["node_modules/", ...VENDOR] },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: globals.browser,
        },
        rules: {
            eqeqeq: ["error", "smart"],
            "prefer-const": "error",
            "no-var": "error",
            // Las funciones globales que usan otros archivos no cuentan como "sin uso"
            "no-unused-vars": [
                "error",
                { vars: "local", args: "after-used", argsIgnorePattern: "^_", caughtErrors: "none" },
            ],
            "no-console": "error",
            // Un catch vacío solo se permite si lleva comentario explicando por qué
            "no-empty": ["error", { allowEmptyCatch: false }],
        },
    },
    ...groupConfigs("."),
    ...groupConfigs("admin"),
    {
        // theme-init.js corre antes que todo, en ES5 para cualquier navegador
        files: ["theme-init.js", "admin/theme-init.js"],
        rules: { "no-var": "off" },
    },
    prettier
);
