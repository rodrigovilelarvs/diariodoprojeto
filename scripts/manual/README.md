# Manual do usuário (/ajuda) — como manter atualizado

O manual é a página `/ajuda`. O texto fica em `app/(app)/ajuda/conteudo.ts` e as
capturas de tela em `public/ajuda/*.webp` (dados fictícios, tema claro).

## Regra

**Toda mudança que o usuário final percebe (tela nova, botão, campo, permissão,
status, regra de negócio, mensagem) precisa atualizar o manual no mesmo commit.**
Ver a regra completa em `CLAUDE.md`.

## Atualizar o texto

Edite `app/(app)/ajuda/conteudo.ts`. Cada seção tem blocos (`p`, `h`, `passos`,
`lista`, `img`, `celulares`, `dica`, `aviso`, `tabela`, `faq`). `**negrito**` funciona
dentro dos textos. Confira o que escreveu no código — não escreva de memória.

## Atualizar as capturas de tela

As capturas são geradas com o sistema rodando sobre o banco falso
(`lib/fake-db-test.ts`), com as respostas da API reescritas para mostrar dados
fictícios bonitos (`dados-ficticios.cjs`). Nada toca o banco real.

1. Suba o servidor com o banco falso, em outra porta (precisa estar parado o
   `next dev` normal, o Next só aceita um por pasta):

   ```bash
   FAKE_DB=1 npx next dev -p 3400
   ```

2. Gere as capturas (todas, ou só algumas pelo nome):

   ```bash
   node scripts/manual/capturas.cjs
   node scripts/manual/capturas.cjs scripts/manual/.capturas usuarios,perfil
   ```

   Nomes disponíveis: `login`, `painel`, `painel-cartoes`, `novo-projeto`,
   `menu-acoes`, `projeto`, `acesso`, `assinaturas`, `lista-rdos`,
   `aprovacao-lista`, `relatorios`, `tarefas`, `usuarios`, `cadastro-usuario`,
   `perfil`, `empresa`, `notificacoes`, `novo-rdo`, `rdo-form`, `aprovacao`, `mobile`.

3. Converta para WebP em `public/ajuda/`:

   ```bash
   node scripts/manual/converter.cjs
   ```

4. Olhe as imagens (principalmente as que mudaram) antes de commitar.

Para uma tela nova: acrescente um bloco `if (quer('nome')) { ... }` em
`capturas.cjs`, use o `shot('nome')`, e referencie `/ajuda/nome.webp` no
`conteudo.ts`. Se a tela precisar de dados que o banco falso não tem, estenda
`dados-ficticios.cjs`.

## Proteção automática

`tests/e2e/ajuda.spec.ts` falha se:

- uma imagem citada no manual não existir em `public/ajuda/`;
- um item do menu lateral, uma permissão de usuário ou um status de RDO não for
  mencionado no manual.

Se esse teste falhar depois de você mexer no sistema, é porque o manual ficou
para trás.

## Depois de publicar

Se a Vercel servir a página `/ajuda` sem estilo (cache de CSS antigo no build),
refaça o deploy sem cache: `vercel deploy --prod --force`.
