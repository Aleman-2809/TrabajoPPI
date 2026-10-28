import test from 'node:test'
import assert from 'node:assert/strict'
import { procesarLote } from '../src/cola.js'

const cfg = { negocio: 'ZI', codigoPais: '57' }
const silencio = { log() {}, warn() {}, error() {} }
const reserva = { id: 5, cliente: 'Luis', telefono: '3001112233', fecha: '2026-11-02', hora: '10:00', jugadores: 4, paquete: 'Recluta', total: 180000 }

function entorno(lote) {
  const llamadas = []
  const rpc = async (nombre, args) => {
    llamadas.push([nombre, args])
    return nombre === 'bot_tomar_pendientes' ? lote : null
  }
  const resultados = () => llamadas.filter((l) => l[0] === 'bot_resultado').map((l) => l[1])
  return { rpc, llamadas, resultados }
}

test('envía y reporta éxito', async () => {
  const e = entorno([{ id: 1, tipo: 'nueva', para: 'cliente', destinatario: '300 111 2233', reserva }])
  const enviados = []
  const r = await procesarLote({ ...e, cfg, log: silencio, esperar: async () => {}, enviar: async (tel, txt) => { enviados.push([tel, txt]); return { ok: true } } })
  assert.equal(r.enviados, 1)
  assert.equal(enviados[0][0], '573001112233')
  assert.match(enviados[0][1], /Luis/)
  assert.deepEqual(e.resultados(), [{ p_id: 1, p_ok: true, p_error: null, p_reintentar: true }])
})

test('número sin WhatsApp: error definitivo, sin reintentos', async () => {
  const e = entorno([{ id: 2, tipo: 'nueva', para: 'cliente', destinatario: '3001112233', reserva }])
  await procesarLote({ ...e, cfg, log: silencio, esperar: async () => {}, enviar: async () => ({ sinWhatsApp: true }) })
  const [x] = e.resultados()
  assert.equal(x.p_ok, false); assert.equal(x.p_reintentar, false); assert.match(x.p_error, /no tiene WhatsApp/)
})

test('fallo de red: se reporta para reintentar', async () => {
  const e = entorno([{ id: 3, tipo: 'confirmada', para: 'cliente', destinatario: '3001112233', reserva }])
  await procesarLote({ ...e, cfg, log: silencio, esperar: async () => {}, enviar: async () => { throw new Error('Connection Closed') } })
  const [x] = e.resultados()
  assert.equal(x.p_ok, false); assert.equal(x.p_reintentar, true); assert.equal(x.p_error, 'Connection Closed')
})

test('reserva borrada, teléfono inválido y tipo desconocido: error sin reintento y sin enviar', async () => {
  const e = entorno([
    { id: 4, tipo: 'nueva', para: 'cliente', destinatario: '3001112233', reserva: null },
    { id: 5, tipo: 'nueva', para: 'cliente', destinatario: '12345', reserva },
    { id: 6, tipo: 'raro', para: 'cliente', destinatario: '3001112233', reserva },
  ])
  let envios = 0
  await procesarLote({ ...e, cfg, log: silencio, esperar: async () => {}, enviar: async () => { envios++; return { ok: true } } })
  assert.equal(envios, 0)
  const rs = e.resultados()
  assert.equal(rs.length, 3)
  assert.ok(rs.every((x) => x.p_ok === false && x.p_reintentar === false))
})

test('un mensaje que falla no detiene a los demás, y hay pausa entre mensajes', async () => {
  const e = entorno([
    { id: 7, tipo: 'nueva', para: 'cliente', destinatario: '3001112233', reserva },
    { id: 8, tipo: 'nueva', para: 'caja', destinatario: '3009998877', reserva },
    { id: 9, tipo: 'nueva', para: 'caja', destinatario: '3009998866', reserva },
  ])
  let pausas = 0, n = 0
  const r = await procesarLote({ ...e, cfg, log: silencio, esperar: async () => { pausas++ }, enviar: async () => { if (++n === 1) throw new Error('boom'); return { ok: true } } })
  assert.equal(r.tomados, 3); assert.equal(r.enviados, 2); assert.equal(pausas, 2)
})

test('cola vacía', async () => {
  const e = entorno([])
  const r = await procesarLote({ ...e, cfg, log: silencio, esperar: async () => {}, enviar: async () => ({ ok: true }) })
  assert.deepEqual(r, { tomados: 0, enviados: 0 })
})
