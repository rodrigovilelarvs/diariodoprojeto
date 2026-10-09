-- Tipo da empresa do projeto: contratada (executa a obra) ou contratante (cliente).
-- Os projetos existentes ficam como CONTRATADA, igual ao rótulo que já era mostrado.
CREATE TYPE "EmpresaTipo" AS ENUM ('CONTRATADA', 'CONTRATANTE');
ALTER TABLE "projetos" ADD COLUMN "empresaTipo" "EmpresaTipo" NOT NULL DEFAULT 'CONTRATADA';
