import test from 'node:test'
import assert from 'node:assert/strict'
import { construirMensaje as m, fechaLarga, horaCorta, dinero, primerNombre } from '../src/mensajes.js'

const cfg = { negocio: 'Zona Impacto', ubicacion: 'Km 4 vía El Roble', telefonoNegocio: '+57 300 000 0000', panelUrl: 'http://x/#/panel', recomendaciones: 'Ropa cómoda.' }
const r = { id: 12, cliente: 'maría PÉREZ', telefono: '3001234567', campo: 'Selva Cerrada', fecha: '2026-10-31', hora: '15:30:00', jugadores: 8, modalidad: 'Eliminación', paquete: 'Escuadrón', total: 544000, mensaje: 'Cumpleaños' }

test('formatos', () => {
  assert.equal(fechaLarga('2026-10-31'), 'sábado, 31 de octubre de 2026')
  assert.equal(horaCorta('15:30:00'), '3:30 p. m.')
  assert.equal(horaCorta('00:05'), '12:05 a. m.')
  assert.equal(horaCorta('12:00'), '12:00 p. m.')
  assert.match(dinero(544000), /^\$ 544\.000$/)
  assert.equal(dinero(null), null)
  assert.equal(primerNombre('  maría PÉREZ '), 'María')
  assert.equal(primerNombre(''), 'jugador')
})

test('cada tipo para el cliente genera un texto completo y sin "undefined"', () => {
  for (const tipo of ['nueva', 'confirmada', 'actualizada', 'aplazada', 'cancelada', 'completada', 'recordatorio']) {
    const t = m(tipo, 'cliente', r, cfg)
    assert.ok(t && t.length > 30, `${tipo} vacío`)
    assert.ok(!/undefined|null|NaN/.test(t), `${tipo} contiene valores vacíos: ${t}`)
    assert.ok(t.includes('María'), `${tipo} sin el nombre`)
  }
})
test('la confirmación incluye lo importante', () => {
  const t = m('confirmada', 'cliente', r, cfg)
  for (const x of ['confirmada', 'sábado, 31 de octubre', '3:30 p. m.', 'Selva Cerrada', '8 jugadores', '$ 544.000', 'Km 4 vía El Roble', 'Ropa cómoda.', 'Equipo completo, 250 bolas']) {
    assert.ok(t.includes(x), `falta "${x}" en:\n${t}`)
  }
})
test('aviso a caja: nueva reserva con contacto, notas y enlace al panel', () => {
  const t = m('nueva', 'caja', r, cfg)
  for (const x of ['Nueva reserva', '#12', 'maría PÉREZ', '3001234567', 'Cumpleaños', 'http://x/#/panel']) assert.ok(t.includes(x), `falta "${x}"`)
})
test('aviso a caja: cancelación', () => {
  assert.match(m('cancelada', 'caja', r, cfg), /canceló su reserva\* #12/)
})
test('tipos inexistentes devuelven null (no se envía nada)', () => {
  assert.equal(m('inventado', 'cliente', r, cfg), null)
  assert.equal(m('confirmada', 'caja', r, cfg), null)
})
test('datos opcionales ausentes no rompen el texto', () => {
  const t = m('nueva', 'cliente', { id: 1, cliente: 'Ana', fecha: '2026-11-02', hora: '09:00' }, { negocio: 'ZI' })
  assert.ok(!/undefined|null|NaN/.test(t), t)
})
