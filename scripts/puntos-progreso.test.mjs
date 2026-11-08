// Pruebas de la barra de nivel de Puntos (puntos-progreso.js), con el runner de Node:
// npm test (también lo corre el pipeline). Niveles como en rewards-service:
// Bronce desde 0, Plata desde 1.500 y Oro desde 5.000; marcas en 0 %, 50 % y 100 %.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { URL } from "node:url";
import vm from "node:vm";

// puntos-progreso.js es un script de navegador (sin módulos): se evalúa aparte.
const src = readFileSync(new URL("../puntos-progreso.js", import.meta.url), "utf8");
const pointsProgress = vm.runInNewContext(`${src}\npointsProgress;`, {});

const BRONCE = { index: 0, min: 0 };
const PLATA = { index: 1, min: 1500 };
const ORO = { index: 2, min: 5000 };
const MARCA_PLATA = 50;

test("Bronce con 1.005 ganados (faltan 495 para Plata) queda antes de la marca de Plata", () => {
    const p = pointsProgress(1005, BRONCE, PLATA, 3);
    assert.ok(p < MARCA_PLATA, `${p} % debería ser menor que ${MARCA_PLATA} %`);
    assert.equal(p, 33.5);
});

test("Bronce nunca pasa la marca de Plata, aunque le falte 1 punto", () => {
    assert.ok(pointsProgress(1499, BRONCE, PLATA, 3) < MARCA_PLATA);
    assert.equal(pointsProgress(0, BRONCE, PLATA, 3), 0);
});

test("Plata justo en su umbral queda en la marca de Plata (50 %)", () => {
    assert.equal(pointsProgress(1500, PLATA, ORO, 3), MARCA_PLATA);
});

test("Plata avanza entre su marca y la de Oro sin llegar a 100 %", () => {
    const p = pointsProgress(4999, PLATA, ORO, 3);
    assert.ok(p > MARCA_PLATA && p < 100, `${p} %`);
});

test("Oro (nivel más alto) llena la barra (100 %)", () => {
    assert.equal(pointsProgress(5000, ORO, null, 3), 100);
    assert.equal(pointsProgress(12000, ORO, null, 3), 100);
});

test("Datos raros no sacan la barra de 0-100 %", () => {
    assert.equal(pointsProgress(-50, BRONCE, PLATA, 3), 0);
    assert.equal(pointsProgress(1005, BRONCE, { min: 0 }, 3), 0);
    assert.ok(pointsProgress(9e9, PLATA, ORO, 3) <= 100);
});
