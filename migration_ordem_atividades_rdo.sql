-- Posicao (ordem) das atividades dentro do RDO: permite reordenar na tela.
-- Os registros existentes ficam com 0 e continuam na ordem de criacao.
ALTER TABLE "registros_rdo_atividade" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;
