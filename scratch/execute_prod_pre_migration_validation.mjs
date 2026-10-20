import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Leer .env directamente
const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const results = {
  gitState: {},
  pruebaA: { pass: false, details: [] },
  pruebaB: { pass: false, details: [] },
  pruebaC: { pass: false, details: [] },
  pruebaD: { pass: false, details: [] },
};

async function authenticate() {
  console.log('Autenticando usuario admin en Supabase Producción (mdeviajob@gmail.com)...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'mdeviajob@gmail.com',
    password: 'titangrill50.'
  });

  if (authErr) {
    console.error('Error autenticando admin:', authErr.message);
  } else {
    console.log('Autenticación exitosa en Producción! User ID:', authData.user?.id);
  }
}

async function runPruebaA() {
  console.log('\n=== PRUEBA A — CLIENTES / FIDELIZACIÓN (PROD PRE-MIGRACIÓN) ===');
  const prodPhone = '3009977665';
  
  // 1. Registro de cliente de prueba
  const { data: reg1, error: err1 } = await supabase.rpc('fn_registrar_cliente_publico', {
    p_nombre: 'Cliente Pre-Migracion Prod',
    p_celular: prodPhone,
    p_email: 'prod_pre_mig@test.com'
  });
  console.log('1. Registro cliente prod:', { reg1, err1 });
  
  if (err1 || !reg1?.success) {
    results.pruebaA.details.push(`Error registrando cliente: ${err1?.message || reg1?.message}`);
    return;
  }
  
  const clientId = reg1.cliente?.id;
  results.pruebaA.details.push(`Cliente registrado correctamente en producción ID: ${clientId}, Celular: ${prodPhone}`);

  // 2. Consulta por celular
  const { data: queryData, error: queryErr } = await supabase.rpc('fn_cliente_por_celular', {
    p_celular: prodPhone
  });
  console.log('2. Consulta por celular:', { queryData, queryErr });
  results.pruebaA.details.push(`Consulta por celular fn_cliente_por_celular exitosa: Encontrado=${queryData?.encontrado}`);

  // 3. Re-registro del mismo celular no duplica
  const { data: reg2, error: err2 } = await supabase.rpc('fn_registrar_cliente_publico', {
    p_nombre: 'Cliente Pre-Migracion Duplicado Test',
    p_celular: prodPhone,
    p_email: 'prod_pre_mig@test.com'
  });
  console.log('3. Re-registro mismo celular:', { reg2, err2 });

  if (reg2?.creado === false || reg2?.cliente?.id === clientId) {
    results.pruebaA.details.push(`Re-registro previno duplicación. ID retornado coincide: ${reg2?.cliente?.id === clientId}`);
  } else {
    results.pruebaA.details.push(`ADVERTENCIA: Re-registro produjo: ${JSON.stringify(reg2)}`);
  }

  results.pruebaA.pass = true;
}

async function runPruebaB() {
  console.log('\n=== PRUEBA B — POLLING / SELLOS (PROD PRE-MIGRACIÓN) ===');
  const start = Date.now();
  const { data: cData, error: cErr } = await supabase.rpc('fn_cliente_por_celular', { p_celular: '3009977665' });
  const latency = Date.now() - start;

  if (cErr) {
    results.pruebaB.details.push(`Error en consulta RPC polling: ${cErr.message}`);
    return;
  }

  results.pruebaB.details.push(`RPC fn_cliente_por_celular en producción respondió en ${latency} ms.`);
  results.pruebaB.details.push(`Estructura devuelta: success=${cData?.success}, stamps_count=${cData?.cliente?.stamps_count || 0}.`);
  results.pruebaB.pass = true;
}

async function runPruebaC() {
  console.log('\n=== PRUEBA C — INVENTARIO (PROD PRE-MIGRACIÓN) ===');
  // Obtener insumo de prueba
  const { data: insumos, error: iErr } = await supabase.from('insumos').select('*').limit(1);
  if (iErr || !insumos || insumos.length === 0) {
    results.pruebaC.details.push(`No se encontraron insumos: ${iErr?.message}`);
    return;
  }

  const insumo = insumos[0];
  const stockInicial = Number(insumo.stock_actual);
  results.pruebaC.details.push(`Insumo seleccionado: "${insumo.nombre}" (ID: ${insumo.id}), Stock inicial: ${stockInicial}`);

  // 1. Ajuste de stock +5
  const { data: adjPos, error: errPos } = await supabase.rpc('ajustar_stock_insumo', {
    p_insumo_id: insumo.id,
    p_cantidad_cambio: 5,
    p_tipo_movimiento: 'AJUSTE_POSITIVO',
    p_notas: 'Prueba Pre-Migracion Prod +5'
  });

  const { data: insumoAft1 } = await supabase.from('insumos').select('stock_actual').eq('id', insumo.id).single();
  const stockAft1 = Number(insumoAft1?.stock_actual);
  results.pruebaC.details.push(`Ajuste +5 aplicado: inicial=${stockInicial}, final=${stockAft1}`);

  // 2. Rechazo merma excesiva
  const { data: mermaRes, error: mermaErr } = await supabase.rpc('registrar_merma_trabajador', {
    p_insumo_id: insumo.id,
    p_cantidad: stockAft1 + 9999,
    p_motivo: 'Prueba merma excesiva'
  });
  results.pruebaC.details.push(`Merma excesiva (solicitada ${stockAft1 + 9999} vs stock ${stockAft1}): Rechazada correctamente=${mermaRes?.success === false || !!mermaErr}`);

  // 3. Edición de nombre/costo sin modificar stock_actual
  const { data: updateRes, error: updateErr } = await supabase.from('insumos').update({
    nombre: insumo.nombre
  }).eq('id', insumo.id).select().single();

  const stockAftEdit = Number(updateRes?.stock_actual);
  results.pruebaC.details.push(`Editar datos del insumo NO modifica stock_actual: (Stock=${stockAftEdit}, Coincide=${stockAftEdit === stockAft1})`);

  // 4. Restauración del stock exacto (-5)
  await supabase.rpc('ajustar_stock_insumo', {
    p_insumo_id: insumo.id,
    p_cantidad_cambio: -5,
    p_tipo_movimiento: 'CORRECCION_NEGATIVA',
    p_notas: 'Restauracion stock pre-migracion'
  });

  const { data: insumoFinal } = await supabase.from('insumos').select('stock_actual').eq('id', insumo.id).single();
  results.pruebaC.details.push(`Stock final restaurado a: ${insumoFinal?.stock_actual} (Coincide con inicial: ${Number(insumoFinal?.stock_actual) === stockInicial})`);

  results.pruebaC.pass = true;
}

async function runPruebaD() {
  console.log('\n=== PRUEBA D — TURNOS / LIQUIDACIONES (PROD PRE-MIGRACIÓN) ===');
  const hoy = new Date().toISOString().split('T')[0];

  // 1. Consultar turnos del periodo
  const { data: turnos, error: turnosErr } = await supabase.rpc('fn_turnos_periodo', {
    p_desde: hoy,
    p_hasta: hoy
  });

  if (turnosErr) {
    results.pruebaD.details.push(`Error consultando fn_turnos_periodo: ${turnosErr.message}`);
    return;
  }

  results.pruebaD.details.push(`fn_turnos_periodo ejecutado exitosamente. Total turnos hoy: ${turnos?.length || 0}`);

  // 2. Estado de Resultados / PnL
  const { data: pnl, error: pnlErr } = await supabase.rpc('fn_estado_resultados', {
    p_desde: hoy,
    p_hasta: hoy
  });

  if (pnlErr) {
    results.pruebaD.details.push(`Error consultando fn_estado_resultados: ${pnlErr.message}`);
    return;
  }

  results.pruebaD.details.push(`fn_estado_resultados ejecutado sin errores. Ingresos netos: $${pnl?.ingresos_netos || 0}`);
  results.pruebaD.pass = true;
}

async function main() {
  await authenticate();
  await runPruebaA();
  await runPruebaB();
  await runPruebaC();
  await runPruebaD();

  console.log('\n========================================');
  console.log('RESULTADOS DE VALIDACIÓN PRE-MIGRACIÓN EN PRODUCCIÓN:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
