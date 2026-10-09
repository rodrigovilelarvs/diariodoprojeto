-- Para quem a empresa cria projetos: empresas contratadas (quem executa a obra) ou contratantes (clientes).
-- Define se o campo da empresa nos projetos, RDOs e PDFs aparece como "Empresa contratada" ou "Empresa contratante".
-- As empresas existentes ficam como CONTRATADA, igual ao rotulo que ja era mostrado.
CREATE TYPE "EmpresaTipo" AS ENUM ('CONTRATADA', 'CONTRATANTE');
ALTER TABLE "tenants" ADD COLUMN "tipoEmpresaProjeto" "EmpresaTipo" NOT NULL DEFAULT 'CONTRATADA';
