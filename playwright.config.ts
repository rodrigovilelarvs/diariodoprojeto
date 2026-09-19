import { defineConfig, devices } from '@playwright/test'

// Testes de ponta a ponta — rodam contra um servidor Next.js dedicado
// (porta própria, pra nunca colidir com um `npm run dev` que você já
// tenha aberto) usando o banco falso (FAKE_DB=1, ver lib/fake-db-test.ts)
// em vez do Supabase real. Sem risco de sujar dados de produção.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120_000,
    // Limite de ~20 bytes por parte de ZIP de mídias: força a divisão em partes
    // com poucos arquivos (ver lib/download-projeto.ts).
    env: { FAKE_DB: '1', NEXT_PUBLIC_DOWNLOAD_PARTE_MB: '0.00002' },
  },
})
