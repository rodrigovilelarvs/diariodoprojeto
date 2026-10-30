import { test, expect } from '@playwright/test'

// O ícone do WhatsApp da página inicial abre a conversa com o número de atendimento,
// já com a mensagem escrita. Ver WHATSAPP_NUMERO em app/page.tsx.
test('o ícone do WhatsApp da página inicial aponta para o número de atendimento', async ({ page }) => {
  await page.goto('/')
  const icone = page.getByRole('link', { name: 'Fale conosco no WhatsApp' })
  await expect(icone).toBeVisible()
  const href = (await icone.getAttribute('href'))!
  const url = new URL(href)
  expect(url.origin + url.pathname).toBe('https://wa.me/5527998490713')
  expect(url.searchParams.get('text')).toContain('Diário do Projeto')
  await expect(icone).toHaveAttribute('target', '_blank')
  await expect(icone).toHaveAttribute('rel', /noopener/)
})
