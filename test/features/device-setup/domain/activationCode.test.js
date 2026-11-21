import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatActivationCode, readActivationQr } from '../../../../src/features/device-setup/domain/activationCode.js'

const code = 'ABCD-EFGH-JKLM'

test('formats pasted or typed activation codes and rejects invalid characters and lengths', () => {
  assert.equal(formatActivationCode(' abcd efgh jklm '), code)
  assert.equal(formatActivationCode('ABCDEFGHJKLM'), code)
  assert.equal(formatActivationCode(code), code)
  for (const invalid of ['', 'ABCD-EFGH-IJKL', 'ABCD-EFGH-JKLO', 'ABCD-EFGH-JKL0', code + '2']) {
    assert.equal(formatActivationCode(invalid), null)
  }
})

test('reads only the activation QR payload issued by the store API', () => {
  const payload = { type: 'teraid_pay_device_activation', version: 1, activation_code: code }
  assert.equal(readActivationQr(JSON.stringify(payload)), code)
  assert.equal(readActivationQr(JSON.stringify({ ...payload, version: 2 })), null)
  assert.equal(readActivationQr(JSON.stringify({ ...payload, activation_code: 1234 })), null)
  assert.equal(readActivationQr('https://example.com/?code=' + code), null)
})
