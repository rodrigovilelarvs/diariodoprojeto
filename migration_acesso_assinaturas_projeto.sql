-- 1) Novos tipos enum
CREATE TYPE "ProjetoAcessoNivel" AS ENUM ('VISUALIZAR', 'EDITAR', 'GERENCIAMENTO');
CREATE TYPE "ProjetoAssinaturaModo" AS ENUM ('ABERTA', 'DEFINIDA');

-- 2) Novas colunas em "projetos" (assinaturas pré-definidas)
ALTER TABLE "projetos" ADD COLUMN "assinaturaModo" "ProjetoAssinaturaModo" NOT NULL DEFAULT 'ABERTA';
ALTER TABLE "projetos" ADD COLUMN "assinante1Id" TEXT;
ALTER TABLE "projetos" ADD COLUMN "assinante2Id" TEXT;
ALTER TABLE "projetos" ADD COLUMN "assinante3Id" TEXT;

ALTER TABLE "projetos" ADD CONSTRAINT "projetos_assinante1Id_fkey" FOREIGN KEY ("assinante1Id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_assinante2Id_fkey" FOREIGN KEY ("assinante2Id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_assinante3Id_fkey" FOREIGN KEY ("assinante3Id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Nova tabela "projeto_acessos" (controle de acesso à pasta do projeto)
CREATE TABLE "projeto_acessos" (
    "id" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nivel" "ProjetoAcessoNivel" NOT NULL DEFAULT 'VISUALIZAR',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projeto_acessos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projeto_acessos_projetoId_usuarioId_key" ON "projeto_acessos"("projetoId", "usuarioId");

ALTER TABLE "projeto_acessos" ADD CONSTRAINT "projeto_acessos_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projeto_acessos" ADD CONSTRAINT "projeto_acessos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
