import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarTelefono as n } from '../src/telefono.js'

test('celular colombiano de 10 dígitos recibe el 57', () => {
  assert.equal(n('3001234567'), '573001234567')
  assert.equal(n('300 123 4567'), '573001234567')
  assert.equal(n('(300) 123-4567'), '573001234567')
})
test('números que ya traen el código de país', () => {
  assert.equal(n('+57 300 123 4567'), '573001234567')
  assert.equal(n('573001234567'), '573001234567')
  assert.equal(n('0057 3001234567'), '573001234567')
})
test('números de otros países se respetan', () => {
  assert.equal(n('+1 305 555 0100'), '13055550100')
  assert.equal(n('+34 612 345 678'), '34612345678')
})
test('inválidos devuelven null', () => {
  assert.equal(n(''), null)
  assert.equal(n(null), null)
  assert.equal(n('abc'), null)
  assert.equal(n('1234567'), null)      // fijo de 7 dígitos: no tiene WhatsApp
  assert.equal(n('6012345678'), null)   // fijo de Bogotá (10 dígitos que no empiezan por 3)
})
test('otro código de país por defecto', () => {
  assert.equal(n('5512345678', '52'), '525512345678')
})
