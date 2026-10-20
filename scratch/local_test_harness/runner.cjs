// =============================================================================
// ARNÉS DE PRUEBAS LOCAL: scratch/local_test_harness/runner.cjs
// Ejecutor automatizado de pruebas de integración para recibir_compra (I1.4)
// Usa runner.cjs (.cjs) porque el proyecto tiene "type":"module" en package.json
// =============================================================================

const { execFileSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PSQL_PATH = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const DB_NAME = 'titan_grill_test';
const DB_USER = 'styleos';
const DB_HOST = 'localhost';
const DB_PORT = '5432';
const ROOT = path.join(__dirname, '..', '..');

function psql(args) {
  return execFileSync(PSQL_PATH, ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', DB_NAME, '-w', ...args], { encoding: 'utf8' });
}

// Ejecutar SQL plano, retorna raw string
function execSQL(sql) {
  return psql(['-t', '-A', '-c', sql]).trim();
}

// Llamar recibir_compra con usuario simulado. Retorna objeto JSON parseado.
function callRPC(userId, compraId, metodoPago, idempKey) {
  const mStr = metodoPago === null ? 'NULL' : `'${metodoPago}'`;
  const kStr = idempKey === null ? 'NULL' : `'${idempKey}'`;
  const out = psql(['-t', '-A', '-c', `SET app.current_user_id = '${userId}'; SELECT public.recibir_compra('${compraId}', ${mStr}, ${kStr});`]).trim();
  const jsonLine = out.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
  if (jsonLine.length === 0) throw new Error('No JSON in output: ' + out);
  return JSON.parse(jsonLine[jsonLine.length - 1]);
}

// Ejecutar SQL que devuelve una fila JSON. Retorna objeto JSON parseado.
function queryJSON(sql) {
  const out = psql(['-t', '-A', '-c', sql]).trim();
  const jsonLine = out.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
  if (jsonLine.length === 0) throw new Error('No JSON in query: ' + out);
  return JSON.parse(jsonLine[jsonLine.length - 1]);
}

// Ejecutar psql con archivo SQL
function execFile(filePath) {
  psql(['-f', filePath]);
}

function resetSeed() {
  execFile(path.join(__dirname, '03_seed_data.sql'));
}

// IDs sintéticos fijos
const SOCIO_1 = '11111111-1111-1111-1111-111111111111'; // Con sesión ABIERTA
const SOCIO_2 = '22222222-2222-2222-2222-222222222222'; // Sin sesión
const NO_SOCIO = '33333333-3333-3333-3333-333333333333'; // Mesero
const SESION_S1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const INSUMO_1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // Carne 10kg @$15.000
const INSUMO_2 = 'dddddddd-dddd-dddd-dddd-dddddddddddd'; // Papas 20kg @$3.000
const INSUMO_3 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'; // Queso 5kg @$8.000

const testResults = [];

function recordTest(id, name, status, assertion, evidence, error = null) {
  testResults.push({ id, name, status, assertion, evidence, error });
  const icon = status === 'PASÓ' ? '✓' : '✗';
  console.log(`[${icon} ${status}] Caso ${id}: ${name}`);
  if (status === 'FALLÓ') console.log(`         Detalle: ${assertion}`);
}

async function runAllTests() {
  console.log('=== INICIANDO SUITE EN TITAN_GRILL_TEST (I1.4) ===\n');

  // Verificar conexión al entorno correcto
  const dbCheck = execSQL("SELECT current_database();");
  if (dbCheck !== 'titan_grill_test') {
    console.error('ABORTANDO: No conectado a titan_grill_test. DB actual: ' + dbCheck);
    process.exit(1);
  }
  console.log('Conexión verificada: DB = titan_grill_test, Host = localhost:5432\n');

  // Cargar primero I1.4 en la base de datos
  execFile(path.join(ROOT, 'supabase', 'migrations', '20261010_i1_4_recibir_compra_definitiva_v2.sql'));

  // ─── CASO 1: EFECTIVO con sesión propia abierta ─────────────────────────────
  try {
    resetSeed();
    const c1 = '10000000-0000-0000-0000-000000000001';
    const k1 = '00000000-0000-0000-0000-000000000001';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c1}','BORRADOR',30000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c1}','${INSUMO_1}',2,15000,30000);`);
    const res = callRPC(SOCIO_1, c1, 'EFECTIVO', k1);
    const db = queryJSON(`SELECT json_build_object(
      'estado',(SELECT estado FROM compras WHERE id='${c1}'),
      'caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c1}'),
      'caja_ses',(SELECT sesion_id::text FROM movimientos_caja WHERE compra_id='${c1}'),
      'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_1}'),
      'inv_cnt',(SELECT count(*) FROM movimientos_inventario WHERE compra_id='${c1}')
    )::text;`);
    if (res.success && !res.recovered && db.estado === 'RECIBIDA' && Number(db.caja_cnt) === 1 && db.caja_ses === SESION_S1 && Number(db.stock) === 12 && Number(db.inv_cnt) === 1)
      recordTest(1, 'EFECTIVO con sesión propia abierta', 'PASÓ', 'Estado=RECIBIDA, egreso vinculado a sesión S1, stock=12, inv=1.', JSON.stringify({res,db}));
    else
      recordTest(1, 'EFECTIVO con sesión propia abierta', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(1, 'EFECTIVO con sesión propia abierta', 'FALLÓ', e.message, null); }

  // ─── CASO 2: EFECTIVO sin sesión abierta ────────────────────────────────────
  try {
    resetSeed();
    const c2 = '10000000-0000-0000-0000-000000000002';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c2}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c2}','${INSUMO_1}',1,15000,15000);`);
    const res = callRPC(SOCIO_2, c2, 'EFECTIVO', null);
    const db = queryJSON(`SELECT json_build_object('estado',(SELECT estado FROM compras WHERE id='${c2}'),'caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c2}'),'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_1}'))::text;`);
    if (!res.success && res.message.includes('sesión de caja abierta') && db.estado === 'BORRADOR' && Number(db.caja_cnt) === 0 && Number(db.stock) === 10)
      recordTest(2, 'EFECTIVO sin sesión abierta', 'PASÓ', 'Rechazo controlado; BORRADOR, 0 caja, stock=10.', JSON.stringify({res,db}));
    else
      recordTest(2, 'EFECTIVO sin sesión abierta', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(2, 'EFECTIVO sin sesión abierta', 'FALLÓ', e.message, null); }

  // ─── CASO 3: NEQUI sin sesión (Tesorería) ────────────────────────────────────
  try {
    resetSeed();
    const c3 = '10000000-0000-0000-0000-000000000003';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c3}','BORRADOR',9000,'NEQUI');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c3}','${INSUMO_2}',3,3000,9000);`);
    const res = callRPC(SOCIO_2, c3, 'NEQUI', null);
    const db = queryJSON(`SELECT json_build_object('estado',(SELECT estado FROM compras WHERE id='${c3}'),'sesion',(SELECT sesion_id FROM movimientos_caja WHERE compra_id='${c3}'),'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_2}'))::text;`);
    if (res.success && res.sesion_id === null && db.estado === 'RECIBIDA' && db.sesion === null && Number(db.stock) === 23)
      recordTest(3, 'NEQUI sin sesión (Tesorería)', 'PASÓ', 'sesion_id=NULL, estado=RECIBIDA, stock Papas=23.', JSON.stringify({res,db}));
    else
      recordTest(3, 'NEQUI sin sesión (Tesorería)', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(3, 'NEQUI sin sesión (Tesorería)', 'FALLÓ', e.message, null); }

  // ─── CASO 4: BANCOLOMBIA sin sesión (Tesorería) ──────────────────────────────
  try {
    resetSeed();
    const c4 = '10000000-0000-0000-0000-000000000004';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c4}','BORRADOR',16000,'BANCOLOMBIA');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c4}','${INSUMO_3}',2,8000,16000);`);
    const res = callRPC(SOCIO_2, c4, 'BANCOLOMBIA', null);
    const db = queryJSON(`SELECT json_build_object('estado',(SELECT estado FROM compras WHERE id='${c4}'),'sesion',(SELECT sesion_id FROM movimientos_caja WHERE compra_id='${c4}'),'metodo',(SELECT metodo_pago FROM movimientos_caja WHERE compra_id='${c4}'),'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_3}'))::text;`);
    if (res.success && res.sesion_id === null && db.estado === 'RECIBIDA' && db.sesion === null && db.metodo === 'BANCOLOMBIA' && Number(db.stock) === 7)
      recordTest(4, 'BANCOLOMBIA sin sesión (Tesorería)', 'PASÓ', 'sesion_id=NULL, metodo=BANCOLOMBIA, stock Queso=7.', JSON.stringify({res,db}));
    else
      recordTest(4, 'BANCOLOMBIA sin sesión (Tesorería)', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(4, 'BANCOLOMBIA sin sesión (Tesorería)', 'FALLÓ', e.message, null); }

  // ─── CASO 5: BANCOLOMBIA con sesión propia abierta ───────────────────────────
  try {
    resetSeed();
    const c5 = '10000000-0000-0000-0000-000000000005';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c5}','BORRADOR',15000,'BANCOLOMBIA');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c5}','${INSUMO_1}',1,15000,15000);`);
    const res = callRPC(SOCIO_1, c5, 'BANCOLOMBIA', null);
    const db = queryJSON(`SELECT json_build_object('sesion',(SELECT sesion_id::text FROM movimientos_caja WHERE compra_id='${c5}'))::text;`);
    if (res.success && res.sesion_id === SESION_S1 && db.sesion === SESION_S1)
      recordTest(5, 'BANCOLOMBIA con sesión abierta', 'PASÓ', 'sesion_id vinculado a S1. Efecto contable de caja de turno documentado.', JSON.stringify({res,db}));
    else
      recordTest(5, 'BANCOLOMBIA con sesión abierta', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(5, 'BANCOLOMBIA con sesión abierta', 'FALLÓ', e.message, null); }

  // ─── CASO 6: Método NULL (F11 corrección 3VL) ────────────────────────────────
  try {
    resetSeed();
    const c6 = '10000000-0000-0000-0000-000000000006';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c6}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c6}','${INSUMO_1}',1,15000,15000);`);
    const res = callRPC(SOCIO_1, c6, null, null);
    const db = queryJSON(`SELECT json_build_object('estado',(SELECT estado FROM compras WHERE id='${c6}'),'caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c6}'))::text;`);
    if (!res.success && res.message.includes('Método de pago inválido') && db.estado === 'BORRADOR' && Number(db.caja_cnt) === 0)
      recordTest(6, 'Método de pago NULL (corrección 3VL)', 'PASÓ', 'NULL interceptado por guarda IS NULL; success:false sin mutaciones.', JSON.stringify({res,db}));
    else
      recordTest(6, 'Método de pago NULL (corrección 3VL)', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(6, 'Método de pago NULL (corrección 3VL)', 'FALLÓ', e.message, null); }

  // ─── CASO 7: Método inválido ('TARJETA') ─────────────────────────────────────
  try {
    resetSeed();
    const c7 = '10000000-0000-0000-0000-000000000007';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c7}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c7}','${INSUMO_1}',1,15000,15000);`);
    const res = callRPC(SOCIO_1, c7, 'TARJETA', null);
    const db = queryJSON(`SELECT json_build_object('estado',(SELECT estado FROM compras WHERE id='${c7}'),'caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c7}'))::text;`);
    if (!res.success && res.message.includes('Método de pago inválido') && db.estado === 'BORRADOR' && Number(db.caja_cnt) === 0)
      recordTest(7, 'Método inválido (TARJETA)', 'PASÓ', 'Rechazo controlado de método fuera del dominio.', JSON.stringify({res,db}));
    else
      recordTest(7, 'Método inválido (TARJETA)', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(7, 'Método inválido (TARJETA)', 'FALLÓ', e.message, null); }

  // ─── CASO 8: Compra inexistente ───────────────────────────────────────────────
  try {
    resetSeed();
    const res = callRPC(SOCIO_1, '99999999-9999-9999-9999-999999999999', 'EFECTIVO', null);
    if (!res.success && res.message === 'Compra no encontrada')
      recordTest(8, 'Compra inexistente', 'PASÓ', 'success:false, message="Compra no encontrada".', JSON.stringify({res}));
    else
      recordTest(8, 'Compra inexistente', 'FALLÓ', `Respuesta inesperada: ${JSON.stringify(res)}`, null);
  } catch(e) { recordTest(8, 'Compra inexistente', 'FALLÓ', e.message, null); }

  // ─── CASO 9: Idempotencia — misma clave repetida ─────────────────────────────
  try {
    resetSeed();
    const c9 = '10000000-0000-0000-0000-000000000009';
    const k9 = '00000000-0000-0000-0000-000000000009';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c9}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c9}','${INSUMO_1}',1,15000,15000);`);
    callRPC(SOCIO_1, c9, 'EFECTIVO', k9); // Primera vez
    const res = callRPC(SOCIO_1, c9, 'EFECTIVO', k9); // Segunda vez
    const db = queryJSON(`SELECT json_build_object('caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c9}'),'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_1}'))::text;`);
    if (res.success && res.recovered && Number(db.caja_cnt) === 1 && Number(db.stock) === 11)
      recordTest(9, 'Idempotencia: misma clave repetida', 'PASÓ', 'recovered:true, 0 duplicados en caja/inventario, stock=11.', JSON.stringify({res,db}));
    else
      recordTest(9, 'Idempotencia: misma clave repetida', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(9, 'Idempotencia: misma clave repetida', 'FALLÓ', e.message, null); }

  // ─── CASO 10: Idempotencia — clave diferente en compra ya recibida ────────────
  try {
    resetSeed();
    const c10 = '10000000-0000-0000-0000-000000000010';
    const k10A = '00000000-0000-0000-0000-000000000010';
    const k10B = '00000000-0000-0000-0000-000000000099';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c10}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c10}','${INSUMO_1}',1,15000,15000);`);
    callRPC(SOCIO_1, c10, 'EFECTIVO', k10A);
    const res = callRPC(SOCIO_1, c10, 'EFECTIVO', k10B);
    if (!res.success && res.message.includes('procesada o recibida'))
      recordTest(10, 'Idempotencia: clave diferente en compra recibida', 'PASÓ', 'Rechazo controlado con clave distinta.', JSON.stringify({res}));
    else
      recordTest(10, 'Idempotencia: clave diferente en compra recibida', 'FALLÓ', `Aserción fallida: ${JSON.stringify(res)}`, null);
  } catch(e) { recordTest(10, 'Idempotencia: clave diferente en compra recibida', 'FALLÓ', e.message, null); }

  // ─── CASO 11: Clave nula en compra ya recibida ────────────────────────────────
  try {
    resetSeed();
    const c11 = '10000000-0000-0000-0000-000000000011';
    const k11 = '00000000-0000-0000-0000-000000000011';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c11}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c11}','${INSUMO_1}',1,15000,15000);`);
    callRPC(SOCIO_1, c11, 'EFECTIVO', k11);
    const res = callRPC(SOCIO_1, c11, 'EFECTIVO', null);
    if (!res.success && res.message.includes('procesada o recibida'))
      recordTest(11, 'Idempotencia: clave nula en compra recibida', 'PASÓ', 'Rechazo controlado con key=NULL en segunda llamada.', JSON.stringify({res}));
    else
      recordTest(11, 'Idempotencia: clave nula en compra recibida', 'FALLÓ', `Aserción fallida: ${JSON.stringify(res)}`, null);
  } catch(e) { recordTest(11, 'Idempotencia: clave nula en compra recibida', 'FALLÓ', e.message, null); }

  // ─── CASO 12: Colisión UNIQUE (misma clave en otra compra) ───────────────────
  try {
    resetSeed();
    const c12A = '10000000-0000-0000-0000-000000000012';
    const c12B = '10000000-0000-0000-0000-000000000013';
    const kDup = '00000000-0000-0000-0000-000000000012';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c12A}','BORRADOR',15000,'EFECTIVO'),('${c12B}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c12A}','${INSUMO_1}',1,15000,15000),('${c12B}','${INSUMO_1}',1,15000,15000);`);
    callRPC(SOCIO_1, c12A, 'EFECTIVO', kDup);
    let threw = false;
    try { callRPC(SOCIO_1, c12B, 'EFECTIVO', kDup); } catch(e2) { threw = e2.message.toLowerCase().includes('unique') || e2.message.toLowerCase().includes('duplicate') || e2.message.includes('duplicada'); }
    const db = queryJSON(`SELECT json_build_object('estado_b',(SELECT estado FROM compras WHERE id='${c12B}'),'caja_b',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c12B}'))::text;`);
    if (threw && db.estado_b === 'BORRADOR' && Number(db.caja_b) === 0)
      recordTest(12, 'Colisión UNIQUE en clave de idempotencia', 'PASÓ', 'PostgreSQL aborta la TX con duplicate key; C12B permanece BORRADOR.', JSON.stringify({threw,db}));
    else
      recordTest(12, 'Colisión UNIQUE en clave de idempotencia', 'FALLÓ', `No se activó constraint UNIQUE: threw=${threw}, ${JSON.stringify(db)}`, null);
  } catch(e) { recordTest(12, 'Colisión UNIQUE en clave de idempotencia', 'FALLÓ', e.message, null); }

  // ─── CASO 13: Concurrencia real (FOR UPDATE bloqueo) ─────────────────────────
  try {
    resetSeed();
    const c13 = '10000000-0000-0000-0000-000000000013';
    const k13 = '00000000-0000-0000-0000-000000000013';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c13}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c13}','${INSUMO_1}',1,15000,15000);`);
    const rpc_sql = `SET app.current_user_id = '${SOCIO_1}'; SELECT public.recibir_compra('${c13}', 'EFECTIVO', '${k13}');`;
    const runProc = () => new Promise(resolve => {
      const p = spawn(PSQL_PATH, ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', DB_NAME, '-w', '-t', '-A', '-c', rpc_sql]);
      let out = '';
      p.stdout.on('data', d => out += d);
      p.stderr.on('data', () => {});
      p.on('close', () => resolve(out.trim()));
    });
    const [raw1, raw2] = await Promise.all([runProc(), runProc()]);
    const parse = raw => { const l = raw.split('\n').filter(x=>x.trim().startsWith('{')); return l.length ? JSON.parse(l[l.length-1]) : null; };
    const r1 = parse(raw1), r2 = parse(raw2);
    const db = queryJSON(`SELECT json_build_object('caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c13}'),'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_1}'))::text;`);
    const oneNew = (r1 && r1.success && !r1.recovered) || (r2 && r2.success && !r2.recovered);
    const oneRec = (r1 && r1.recovered) || (r2 && r2.recovered);
    if (oneNew && oneRec && Number(db.caja_cnt) === 1 && Number(db.stock) === 11)
      recordTest(13, 'Concurrencia real simultánea (FOR UPDATE)', 'PASÓ', '1 procesó + 1 recuperó; cero duplicados en caja e inventario.', JSON.stringify({r1,r2,db}));
    else
      recordTest(13, 'Concurrencia real simultánea (FOR UPDATE)', 'FALLÓ', `Inconsistencia: oneNew=${oneNew}, oneRec=${oneRec}, ${JSON.stringify(db)}`, null);
  } catch(e) { recordTest(13, 'Concurrencia real simultánea (FOR UPDATE)', 'FALLÓ', e.message, null); }

  // ─── CASO 14: Atomicidad / Rollback ante excepción ───────────────────────────
  try {
    resetSeed();
    const c14 = '10000000-0000-0000-0000-000000000014';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c14}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c14}','${INSUMO_1}',1,15000,15000);`);
    // Alter insumos temporarily to trigger check constraint error inside the loop
    execSQL("ALTER TABLE public.insumos ADD CONSTRAINT test_stock_max CHECK(id <> 'cccccccc-cccc-cccc-cccc-cccccccccccc' OR stock_actual <= 10);");
    let threw = false;
    try { callRPC(SOCIO_1, c14, 'EFECTIVO', null); } catch(e2) { threw = true; }
    execSQL('ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS test_stock_max;');
    const db = queryJSON(`SELECT json_build_object('estado',(SELECT estado FROM compras WHERE id='${c14}'),'caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c14}'),'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_1}'))::text;`);
    if (threw && db.estado === 'BORRADOR' && Number(db.caja_cnt) === 0 && Number(db.stock) === 10)
      recordTest(14, 'Atomicidad y Rollback completo', 'PASÓ', 'Excepción en inventario generó rollback total; compra=BORRADOR, caja=0, stock=10.', JSON.stringify({threw,db}));
    else
      recordTest(14, 'Atomicidad y Rollback completo', 'FALLÓ', `Rollback incompleto: threw=${threw}, ${JSON.stringify(db)}`, null);
  } catch(e) { recordTest(14, 'Atomicidad y Rollback completo', 'FALLÓ', e.message, null); }

  // ─── CASO 15: Compra Multilínea (3 insumos) ──────────────────────────────────
  try {
    resetSeed();
    const c15 = '10000000-0000-0000-0000-000000000015';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c15}','BORRADOR',0,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES
               ('${c15}','${INSUMO_1}',2,15000,30000),
               ('${c15}','${INSUMO_2}',5,3000,15000),
               ('${c15}','${INSUMO_3}',1,8000,8000);`);
    const res = callRPC(SOCIO_1, c15, 'EFECTIVO', null);
    const db = queryJSON(`SELECT json_build_object('total',(SELECT total FROM compras WHERE id='${c15}'),'caja_monto',(SELECT monto FROM movimientos_caja WHERE compra_id='${c15}'),'s1',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_1}'),'s2',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_2}'),'s3',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_3}'),'inv_cnt',(SELECT count(*) FROM movimientos_inventario WHERE compra_id='${c15}'))::text;`);
    if (res.success && res.total === 53000 && Number(db.total) === 53000 && Number(db.caja_monto) === 53000 && Number(db.s1) === 12 && Number(db.s2) === 25 && Number(db.s3) === 6 && Number(db.inv_cnt) === 3)
      recordTest(15, 'Compra Multilínea (3 insumos)', 'PASÓ', 'Total=$53.000, 3 entradas inventario, stocks: Carne=12, Papas=25, Queso=6.', JSON.stringify({res,db}));
    else
      recordTest(15, 'Compra Multilínea (3 insumos)', 'FALLÓ', `Aserción fallida: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(15, 'Compra Multilínea (3 insumos)', 'FALLÓ', e.message, null); }

  // ─── CASO 16: Prevención de duplicación en inventario ────────────────────────
  try {
    resetSeed();
    const c16 = '10000000-0000-0000-0000-000000000016';
    const k16 = '00000000-0000-0000-0000-000000000016';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c16}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c16}','${INSUMO_1}',1,15000,15000);`);
    callRPC(SOCIO_1, c16, 'EFECTIVO', k16);
    callRPC(SOCIO_1, c16, 'EFECTIVO', k16); // reintentos
    callRPC(SOCIO_1, c16, 'EFECTIVO', k16);
    const db = queryJSON(`SELECT json_build_object('caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c16}'),'inv_cnt',(SELECT count(*) FROM movimientos_inventario WHERE compra_id='${c16}'),'stock',(SELECT stock_actual FROM insumos WHERE id='${INSUMO_1}'))::text;`);
    if (Number(db.caja_cnt) === 1 && Number(db.inv_cnt) === 1 && Number(db.stock) === 11)
      recordTest(16, 'Prevención de duplicación en inventario', 'PASÓ', 'Múltiples reintentos: exactamente 1 caja + 1 inventario, stock=11.', JSON.stringify({db}));
    else
      recordTest(16, 'Prevención de duplicación en inventario', 'FALLÓ', `Duplicados detectados: ${JSON.stringify(db)}`, null);
  } catch(e) { recordTest(16, 'Prevención de duplicación en inventario', 'FALLÓ', e.message, null); }

  // ─── CASO 17: Resolución de firmas RPC (1, 2 y 3 parámetros) ─────────────────
  try {
    resetSeed();
    const c17A = '10000000-0000-0000-0000-000000000017';
    const c17B = '10000000-0000-0000-0000-000000000018';
    const c17C = '10000000-0000-0000-0000-000000000019';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c17A}','BORRADOR',15000,'EFECTIVO'),('${c17B}','BORRADOR',9000,'NEQUI'),('${c17C}','BORRADOR',8000,'BANCOLOMBIA');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES
               ('${c17A}','${INSUMO_1}',1,15000,15000),
               ('${c17B}','${INSUMO_2}',3,3000,9000),
               ('${c17C}','${INSUMO_3}',1,8000,8000);`);
    const r1raw = psql(['-t','-A','-c',`SET app.current_user_id='${SOCIO_1}'; SELECT public.recibir_compra('${c17A}');`]).trim();
    const r1 = JSON.parse(r1raw.split('\n').filter(l=>l.startsWith('{'))[0]);
    const r2raw = psql(['-t','-A','-c',`SET app.current_user_id='${SOCIO_2}'; SELECT public.recibir_compra('${c17B}','NEQUI');`]).trim();
    const r2 = JSON.parse(r2raw.split('\n').filter(l=>l.startsWith('{'))[0]);
    const r3 = callRPC(SOCIO_2, c17C, 'BANCOLOMBIA', '00000000-0000-0000-0000-000000000019');
    if (r1.success && r1.metodo_pago === 'EFECTIVO' && r2.success && r2.metodo_pago === 'NEQUI' && r3.success && r3.metodo_pago === 'BANCOLOMBIA')
      recordTest(17, 'Resolución de firmas RPC (1, 2 y 3 parámetros)', 'PASÓ', 'Las 3 firmas resuelven a la única función con DEFAULTs correctos.', JSON.stringify({r1,r2,r3}));
    else
      recordTest(17, 'Resolución de firmas RPC (1, 2 y 3 parámetros)', 'FALLÓ', `Fallo en alguna firma: ${JSON.stringify({r1,r2,r3})}`, null);
  } catch(e) { recordTest(17, 'Resolución de firmas RPC (1, 2 y 3 parámetros)', 'FALLÓ', e.message, null); }

  // ─── CASO 18: Aislamiento de sesión (no toma caja de otro trabajador) ─────────
  try {
    resetSeed();
    const c18 = '10000000-0000-0000-0000-000000000020';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c18}','BORRADOR',9000,'NEQUI');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c18}','${INSUMO_2}',3,3000,9000);`);
    const res = callRPC(SOCIO_2, c18, 'NEQUI', null);
    const db = queryJSON(`SELECT json_build_object('sesion',(SELECT sesion_id FROM movimientos_caja WHERE compra_id='${c18}'),'trabajador',(SELECT trabajador_id::text FROM movimientos_caja WHERE compra_id='${c18}'))::text;`);
    if (res.success && res.sesion_id === null && db.sesion === null && db.trabajador === SOCIO_2)
      recordTest(18, 'Aislamiento de sesión (no toma caja ajena)', 'PASÓ', 'SOCIO_2 sin sesión no usurpó caja del cajero; sesion_id=NULL, trabajador=SOCIO_2.', JSON.stringify({res,db}));
    else
      recordTest(18, 'Aislamiento de sesión (no toma caja ajena)', 'FALLÓ', `Usurpación de sesión: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(18, 'Aislamiento de sesión (no toma caja ajena)', 'FALLÓ', e.message, null); }

  // ─── CASO 19: Usuario no socio bloqueado (control de autorización) ────────────
  try {
    resetSeed();
    const c19 = '10000000-0000-0000-0000-000000000021';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c19}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c19}','${INSUMO_1}',1,15000,15000);`);
    const res = callRPC(NO_SOCIO, c19, 'EFECTIVO', null);
    const db = queryJSON(`SELECT json_build_object('estado',(SELECT estado FROM compras WHERE id='${c19}'),'caja_cnt',(SELECT count(*) FROM movimientos_caja WHERE compra_id='${c19}'))::text;`);
    if (!res.success && res.message.includes('se requiere rol Socio Administrador') && db.estado === 'BORRADOR' && Number(db.caja_cnt) === 0)
      recordTest(19, 'Seguridad: No-socio bloqueado', 'PASÓ', 'fn_is_socio() interceptó al mesero; BORRADOR, cero caja.', JSON.stringify({res,db}));
    else
      recordTest(19, 'Seguridad: No-socio bloqueado', 'FALLÓ', `No bloqueó: ${JSON.stringify({res,db})}`, null);
  } catch(e) { recordTest(19, 'Seguridad: No-socio bloqueado', 'FALLÓ', e.message, null); }

  // ─── CASO 20: Método con espacios en blanco ────────────────────────────────────
  try {
    resetSeed();
    const c20 = '10000000-0000-0000-0000-000000000022';
    execSQL(`INSERT INTO compras(id,estado,total,metodo_pago) VALUES('${c20}','BORRADOR',15000,'EFECTIVO');
             INSERT INTO compra_detalles(compra_id,insumo_id,cantidad,costo_unitario,subtotal) VALUES('${c20}','${INSUMO_1}',1,15000,15000);`);
    const res = callRPC(SOCIO_1, c20, '   ', null);
    if (!res.success && res.message.includes('Método de pago inválido'))
      recordTest(20, 'Defensivo: Método con solo espacios en blanco', 'PASÓ', 'trim() rechaza "   " controladamente.', JSON.stringify({res}));
    else
      recordTest(20, 'Defensivo: Método con solo espacios en blanco', 'FALLÓ', `No rechazó espacios: ${JSON.stringify(res)}`, null);
  } catch(e) { recordTest(20, 'Defensivo: Método con solo espacios en blanco', 'FALLÓ', e.message, null); }

  // ─── RESUMEN ──────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('         RESUMEN FINAL DE EJECUCIÓN');
  console.log('════════════════════════════════════════');
  const passed = testResults.filter(t => t.status === 'PASÓ').length;
  const failed = testResults.filter(t => t.status === 'FALLÓ').length;
  console.log(`Total: ${testResults.length}  |  ✓ Pasaron: ${passed}  |  ✗ Fallaron: ${failed}`);
  console.log('════════════════════════════════════════\n');

  fs.writeFileSync(path.join(__dirname, 'test_results.json'), JSON.stringify(testResults, null, 2));
  console.log('Resultados guardados en: scratch/local_test_harness/test_results.json');
}

runAllTests().catch(e => { console.error('FATAL ERROR:', e); process.exit(1); });
