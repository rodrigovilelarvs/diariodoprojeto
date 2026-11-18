-- Cadastro de mão de obra dos projetos por homem-hora (H/H): Nome e Função em campos separados.
-- As colunas são opcionais: o cadastro continua tendo "nome" (texto exibido, "NOME - FUNÇÃO").
-- Funções dos demais projetos não usam estes campos.
ALTER TABLE "funcoes_cadastro" ADD COLUMN IF NOT EXISTS "pessoa" TEXT;
ALTER TABLE "funcoes_cadastro" ADD COLUMN IF NOT EXISTS "funcao" TEXT;
