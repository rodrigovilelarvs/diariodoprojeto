-- Acesso a projetos escolhido já no convite.
-- usuarios.restringirProjetos: a pessoa só vê os projetos em que tem acesso concedido (não herda os abertos ao time).
-- convites.restringirProjetos / convites.projetosAcesso: o que foi escolhido no convite, aplicado quando ele é aceito.
-- Todos os usuários e convites existentes ficam como estão hoje (restringirProjetos = false).
ALTER TABLE "usuarios" ADD COLUMN "restringirProjetos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "convites" ADD COLUMN "restringirProjetos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "convites" ADD COLUMN "projetosAcesso" JSONB;
