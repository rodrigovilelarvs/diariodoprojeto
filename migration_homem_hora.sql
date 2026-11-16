-- Modalidade "homem-hora" (H/H): projetos medidos por horas trabalhadas, com hora normal/extra,
-- valor da hora por função e saldo de horas do contrato.
-- Todos os projetos existentes continuam por avanço (AVANCO); nada muda até um projeto ser trocado de modalidade.

CREATE TYPE "ModalidadeMedicao" AS ENUM ('AVANCO', 'HOMEM_HORA');
CREATE TYPE "TipoHora" AS ENUM ('NORMAL', 'EXTRA');

ALTER TABLE "projetos" ADD COLUMN "modalidade" "ModalidadeMedicao" NOT NULL DEFAULT 'AVANCO';
ALTER TABLE "projetos" ADD COLUMN "hhContratado" DECIMAL(10,2);

ALTER TABLE "funcoes_cadastro" ADD COLUMN "valorHora" DECIMAL(10,2);

ALTER TABLE "mao_de_obra" ADD COLUMN "tipoHora" "TipoHora" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "mao_de_obra" ADD COLUMN "percentualExtra" INTEGER;
