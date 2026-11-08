// Pruebas de las fotos de destinos de Beneficios > Viajes (fotos-destinos.js e img/destinos/),
// con el runner de Node: npm test (también lo corre el pipeline).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import { URL } from "node:url";
import vm from "node:vm";

const raiz = new URL("../", import.meta.url);
const leer = ruta => readFileSync(new URL(ruta, raiz), "utf8");

// Scripts de navegador (sin módulos): se evalúan aparte y se devuelve su constante.
const FOTOS = vm.runInNewContext(`${leer("fotos-destinos.js")}\nFOTOS_DESTINOS;`, {});
const BENEFITS = vm.runInNewContext(`${leer("beneficios.js")}\nBENEFITS;`, {
    document: { addEventListener() {} },
});
// Array.from: el arreglo viene de otro contexto (vm) y deepEqual compara también el prototipo.
const destinos = Array.from(BENEFITS.viajes.items);
const creditosMd = leer("img/destinos/CREDITOS.md");
const LICENCIAS = /^(CC0|CC BY [0-9.]+|CC BY-SA [0-9.]+|Dominio público)$/;

test("cada destino de Viajes tiene foto, y no sobran fotos", () => {
    assert.deepEqual(Object.keys(FOTOS).sort(), Array.from(destinos, d => d.id).sort());
    assert.deepEqual(
        readdirSync(new URL("img/destinos/", raiz))
            .filter(f => f.endsWith(".webp"))
            .sort(),
        Array.from(destinos, d => `${d.id}.webp`).sort()
    );
});

test("cada foto es un WebP propio del sitio, de 800x450 y liviano", () => {
    for (const [id, foto] of Object.entries(FOTOS)) {
        assert.equal(foto.src, `img/destinos/${id}.webp`, `${id}: ruta local, nada enlazado desde afuera`);
        const archivo = new URL(foto.src, raiz);
        const datos = readFileSync(archivo);
        assert.equal(datos.toString("latin1", 0, 4), "RIFF", `${id}: no es RIFF`);
        assert.equal(datos.toString("latin1", 8, 12), "WEBP", `${id}: no es WebP`);
        // Encabezado VP8 (con pérdida): ancho y alto en los bytes 26-29 (14 bits cada uno)
        assert.equal(datos.toString("latin1", 12, 16), "VP8 ", `${id}: se esperaba WebP con pérdida`);
        assert.equal(datos.readUInt16LE(26) & 0x3fff, 800, `${id}: ancho`);
        assert.equal(datos.readUInt16LE(28) & 0x3fff, 450, `${id}: alto`);
        assert.ok(statSync(archivo).size <= 100 * 1024, `${id}: pesa más de 100 KB`);
    }
});

test("cada foto tiene texto alternativo propio", () => {
    const alts = Object.values(FOTOS).map(f => f.alt);
    for (const alt of alts) assert.ok(alt.length >= 20, `alt muy corto: ${alt}`);
    assert.equal(new Set(alts).size, alts.length, "hay textos alternativos repetidos");
});

test("cada foto tiene sus créditos completos (autor, licencia permitida y enlaces)", () => {
    for (const [id, foto] of Object.entries(FOTOS)) {
        assert.ok(foto.autor.trim(), `${id}: sin autor`);
        assert.match(foto.licencia, LICENCIAS, `${id}: licencia no permitida (${foto.licencia})`);
        assert.match(foto.fuente, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${id}: fuente`);
        assert.match(foto.licenciaUrl, /^https:\/\/creativecommons\.org\//, `${id}: enlace de la licencia`);
    }
});

test("CREDITOS.md lista las mismas fotos, autores, licencias y enlaces", () => {
    for (const [id, foto] of Object.entries(FOTOS)) {
        const fila = creditosMd.split("\n").find(linea => linea.includes(`\`${id}.webp\``));
        assert.ok(fila, `${id}: falta en CREDITOS.md`);
        for (const dato of [foto.autor, foto.licencia, foto.licenciaUrl, foto.fuente]) {
            assert.ok(fila.includes(dato), `${id}: CREDITOS.md no tiene ${dato}`);
        }
    }
});
