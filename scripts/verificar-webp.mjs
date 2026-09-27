#!/usr/bin/env node
/**
 * Verifica que toda ruta de imagen fija usada con <AppImage> tenga su gemelo
 * .webp en public/.
 *
 * POR QUE: si el <source> de un <picture> da 404, el navegador muestra imagen
 * ROTA — por especificacion NO reintenta con el <img>. Sin esta verificacion,
 * agregar una imagen nueva y olvidar generar su .webp rompe la pagina en
 * silencio, y solo en los navegadores que soportan WebP (o sea, casi todos).
 *
 * Uso:  node scripts/verificar-webp.mjs
 * Generar los faltantes:
 *   cwebp -q 82 -m 6 public/ruta/imagen.png -o public/ruta/imagen.png.webp
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'src';
const PUBLIC = 'public';

function archivosJsx(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);
        return e.isDirectory() ? archivosJsx(p) : (extname(p) === '.jsx' ? [p] : []);
    });
}

const rutas = new Set();
for (const f of archivosJsx(SRC)) {
    const codigo = readFileSync(f, 'utf8');
    if (!codigo.includes('AppImage')) continue;
    // solo rutas literales: las dinamicas no usan AppImage a proposito
    for (const m of codigo.matchAll(/src=["'](\/[^"']+\.(?:png|jpe?g))["']/gi)) rutas.add(m[1]);
}

// MenuGrid y SelectionModal reciben las rutas por props desde estructuras de
// datos literales en el propio archivo, asi que tambien se barren esas.
for (const f of archivosJsx(SRC)) {
    const codigo = readFileSync(f, 'utf8');
    if (!/AppImage|modalData|image:/.test(codigo)) continue;
    for (const m of codigo.matchAll(/image:\s*["'](\/[^"']+\.(?:png|jpe?g))["']/gi)) rutas.add(m[1]);
}

let faltan = 0;
const todas = [...rutas].sort();
for (const r of todas) {
    const orig = join(PUBLIC, r);
    const webp = orig + '.webp';
    if (!existsSync(orig)) {
        console.error(`  FALTA EL ORIGINAL  ${r}`);
        faltan++;
    } else if (!existsSync(webp)) {
        console.error(`  FALTA EL .webp     ${r}`);
        faltan++;
    } else {
        const o = statSync(orig).size, w = statSync(webp).size;
        const pct = ((1 - w / o) * 100).toFixed(0);
        console.log(`  ok  ${r}  ${(o / 1024).toFixed(0)}K -> ${(w / 1024).toFixed(0)}K (${pct}% menos)`);
    }
}

console.log(`\n  ${todas.length} rutas fijas revisadas, ${faltan} problema(s).`);
if (faltan > 0) {
    console.error('\n  Genere los .webp faltantes antes de desplegar:');
    console.error('    cwebp -q 82 -m 6 public/<ruta> -o public/<ruta>.webp\n');
    process.exit(1);
}
