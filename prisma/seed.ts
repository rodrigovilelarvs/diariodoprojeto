// prisma/seed.ts
// Popula banco com super-admin inicial + configuração dos 3 planos

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── Super-admin ──────────────────────────────────────────
  const adminEmail = process.env.SUPERADMIN_EMAIL
  const adminNome  = process.env.SUPERADMIN_NOME  ?? 'Super Admin'
  const adminSenha = process.env.SUPERADMIN_SENHA ?? 'Admin@123!'

  if (!adminEmail) {
    throw new Error('SUPERADMIN_EMAIL não definido no .env')
  }

  const senhaHash = await bcrypt.hash(adminSenha, 14)

  const admin = await prisma.superAdmin.upsert({
    where:  { email: adminEmail },
    update: { nome: adminNome, senha: senhaHash },
    create: { nome: adminNome, email: adminEmail, senha: senhaHash },
  })
  console.log(`✅ Super-admin: ${admin.email}`)

  // ── Planos ───────────────────────────────────────────────
  const planos = [
    {
      tipo: 'STARTER' as const,
      precoMensal:     0,
      limiteUsuarios:  3,
      limiteRdosMes:   30,
      limiteProjetos:  2,
      temRelatorios:   false,
      temExportPdf:    true,
      temApi:          false,
      temSuporteDedicado: false,
      descricao: 'Plano gratuito para experimentar a plataforma',
    },
    {
      tipo: 'PRO' as const,
      precoMensal:     297,
      limiteUsuarios:  10,
      limiteRdosMes:   0,   // 0 = ilimitado
      limiteProjetos:  10,
      temRelatorios:   true,
      temExportPdf:    true,
      temApi:          false,
      temSuporteDedicado: false,
      descricao: 'Para equipes que precisam de mais recursos',
    },
    {
      tipo: 'ENTERPRISE' as const,
      precoMensal:     1485,
      limiteUsuarios:  0,   // 0 = ilimitado
      limiteRdosMes:   0,
      limiteProjetos:  0,
      temRelatorios:   true,
      temExportPdf:    true,
      temApi:          true,
      temSuporteDedicado: true,
      descricao: 'Para grandes empresas com necessidades específicas',
    },
  ]

  for (const plano of planos) {
    await prisma.planoConfig.upsert({
      where:  { tipo: plano.tipo },
      update: plano,
      create: plano,
    })
    console.log(`✅ Plano ${plano.tipo}: R$ ${plano.precoMensal}/mês`)
  }

  console.log('\n✨ Seed concluído!')
  console.log(`\nAcesse: ${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/admin/login`)
  console.log(`E-mail: ${adminEmail}`)
  console.log(`Senha:  ${adminSenha}\n`)
}

main()
  .catch(e => { console.error('❌ Seed falhou:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
