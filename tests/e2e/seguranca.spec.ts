import { test, expect } from '@playwright/test'

// Cabeçalhos de segurança enviados em toda resposta (ver next.config.ts).
// O teste existe pra ninguém removê-los sem perceber numa mudança de config.
test('as páginas saem com os cabeçalhos de segurança', async ({ request }) => {
  const res = await request.get('/login')
  expect(res.ok()).toBeTruthy()
  const h = res.headers()
  expect(h['x-frame-options']).toBe('DENY')
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['permissions-policy']).toContain('camera=()')
  expect(h['permissions-policy']).toContain('microphone=()')
})

test('as rotas da API também saem com os cabeçalhos de segurança', async ({ request }) => {
  // sem token → 401, mas os cabeçalhos valem mesmo assim
  const res = await request.get('/api/app/relatorios')
  expect(res.status()).toBe(401)
  expect(res.headers()['x-content-type-options']).toBe('nosniff')
  expect(res.headers()['x-frame-options']).toBe('DENY')
})
