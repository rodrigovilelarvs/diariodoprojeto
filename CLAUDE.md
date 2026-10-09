@AGENTS.md

## Manual do usuário (/ajuda) — regra obrigatória

O sistema tem um manual dentro dele (`/ajuda`): texto em `app/(app)/ajuda/conteudo.ts`,
capturas em `public/ajuda/*.webp`. **Toda alteração que o usuário final percebe deve
atualizar o manual no mesmo trabalho** — não é uma etapa opcional nem "depois":

- Tela nova, botão novo/renomeado/removido, campo, filtro, coluna, mensagem;
- Mudança de permissão, perfil, status, limite de plano ou regra de negócio;
- Mudança de fluxo (login, convite, senha, aprovação, assinatura, notificações...).

Como fazer:

1. Edite a seção certa de `conteudo.ts` (ou crie uma). Confira o texto **no código**, nunca de memória.
2. Se a aparência mudou, regenere as capturas afetadas (`scripts/manual/README.md`) e olhe as imagens.
3. Rode `npx playwright test ajuda` — o teste `tests/e2e/ajuda.spec.ts` falha se um item de
   menu, permissão, status de RDO/projeto, nível de acesso ou aviso por e-mail não estiver no manual.
4. Faça o commit do manual junto com a mudança (ou no commit seguinte, na mesma entrega) e, ao
   finalizar a resposta ao usuário, diga em uma linha o que mudou no manual.

Se a mudança não afeta o usuário final (refatoração, infra, teste), nada a fazer no manual.
Se publicar na Vercel e a `/ajuda` ficar sem estilo, use `vercel deploy --prod --force`.
