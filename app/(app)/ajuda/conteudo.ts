// Conteúdo do manual do usuário (página /ajuda).
// Texto simples, em segunda pessoa. **negrito** é renderizado pela página.
// As capturas de tela ficam em public/ajuda/*.webp e usam dados fictícios.

export type Bloco =
  | { t: 'p'; x: string }
  | { t: 'h'; x: string }
  | { t: 'passos'; x: string[] }
  | { t: 'lista'; x: string[] }
  | { t: 'img'; src: string; alt: string; legenda?: string }
  | { t: 'celulares'; itens: { src: string; alt: string; legenda: string }[] }
  | { t: 'dica'; x: string }
  | { t: 'aviso'; x: string }
  | { t: 'tabela'; cab: string[]; linhas: string[][] }
  | { t: 'faq'; itens: { q: string; a: string }[] }

export interface Secao {
  id: string
  icone: string
  titulo: string
  resumo: string
  quem?: string
  blocos: Bloco[]
}

export const SECOES: Secao[] = [
  {
    id: 'primeiros-passos',
    icone: 'ti-rocket',
    titulo: 'Primeiros passos',
    resumo: 'Como entrar, conhecer o menu e usar o sistema no computador e no celular.',
    blocos: [
      { t: 'h', x: 'Entrar no sistema' },
      {
        t: 'passos',
        x: [
          'Acesse **diariodoprojeto.com.br** e clique em **Entrar**.',
          'Digite o **e-mail** e a **senha** que você recebeu e clique em **Entrar**.',
          'Se o seu e-mail estiver cadastrado em mais de uma empresa, o sistema pede para você **escolher a empresa** antes de continuar.',
        ],
      },
      { t: 'img', src: '/ajuda/login.webp', alt: 'Tela de login do Diário do Projeto', legenda: 'Tela de entrada: e-mail e senha.' },
      { t: 'dica', x: 'Esqueceu a senha? Na tela de login, clique em **Esqueci minha senha** e siga as instruções que chegam por e-mail.' },
      { t: 'h', x: 'Se você recebeu um convite' },
      {
        t: 'passos',
        x: [
          'Abra o e-mail de convite e clique no link.',
          'Informe seu **nome completo** e crie uma **senha** (mínimo de 8 caracteres). Se você já usa o Diário do Projeto em outra empresa, o sistema pede a senha que você já tem.',
          'Pronto: você já entra direto na empresa que te convidou.',
        ],
      },
      { t: 'h', x: 'Conhecer o menu' },
      {
        t: 'tabela',
        cab: ['Grupo', 'Item', 'Para que serve'],
        linhas: [
          ['Geral', 'Painel de Projetos', 'Visão geral de todos os projetos e acesso à pasta de cada um.'],
          ['Geral', 'Lista de RDOs', 'Todos os relatórios diários, com busca e filtros.'],
          ['Geral', 'Novo RDO', 'Cria um relatório diário de obra.'],
          ['Projeto', 'Aprovação', 'Fila de RDOs esperando assinatura. O número vermelho mostra quantos estão pendentes.'],
          ['Projeto', 'Lista de tarefas', 'Etapas e atividades de cada projeto (EAP).'],
          ['Projeto', 'Relatórios', 'Indicadores e gráficos de desempenho, com exportação em PDF.'],
          ['Config.', 'Notificações', 'Escolha quais avisos por e-mail você quer receber.'],
          ['Config.', 'Usuários', 'Equipe, permissões e convites.'],
          ['Config.', 'Dados da empresa', 'Cadastro da empresa, plano e uso.'],
          ['Conta', 'Meu perfil', 'Seus dados, senha e assinatura digital.'],
        ],
      },
      { t: 'aviso', x: 'O que você consegue fazer em cada tela depende das **permissões** que o administrador da empresa liberou para você. Se faltar um botão ou aparecer um aviso de acesso, fale com o administrador.' },
      { t: 'h', x: 'Tema claro ou escuro' },
      { t: 'p', x: 'No canto inferior do menu lateral, ao lado do seu nome, há um botão com **lua** ou **sol**. Ele alterna entre o tema escuro e o claro, e o sistema lembra a sua escolha.' },
      { t: 'h', x: 'No celular' },
      { t: 'p', x: 'O sistema funciona no navegador do celular. O menu vira uma gaveta: toque no botão **☰** no canto superior esquerdo para abrir e escolher uma tela.' },
      {
        t: 'celulares',
        itens: [{ src: '/ajuda/mobile-painel.webp', alt: 'Painel de projetos no celular', legenda: 'Painel de projetos no celular.' }],
      },
    ],
  },

  {
    id: 'painel',
    icone: 'ti-layout-dashboard',
    titulo: 'Painel de projetos',
    resumo: 'Acompanhe todos os projetos, crie novos e use o menu de ações de cada um.',
    blocos: [
      { t: 'p', x: 'O **Painel de Projetos** é a tela inicial depois do login. No topo ficam os indicadores gerais; abaixo, a lista dos seus projetos.' },
      { t: 'img', src: '/ajuda/painel-lista.webp', alt: 'Painel de projetos em lista', legenda: 'Painel em modo lista.' },
      { t: 'h', x: 'Os indicadores do topo' },
      {
        t: 'tabela',
        cab: ['Indicador', 'O que mostra'],
        linhas: [
          ['Projetos ativos', 'Quantos projetos estão em andamento.'],
          ['RDOs emitidos', 'Total de relatórios diários registrados.'],
          ['Progresso médio', 'Média do avanço real dos projetos.'],
          ['Desvio médio', 'Diferença média entre o avanço real e o planejado. Verde = adiantado; vermelho = atrasado.'],
          ['Ocorrências abertas', 'Ocorrências registradas que ainda não foram resolvidas.'],
        ],
      },
      { t: 'h', x: 'Planejado × Real e desvio' },
      { t: 'p', x: '**Planejado** é o quanto da obra deveria estar pronto hoje, de acordo com as datas das atividades. **Real** é o quanto já foi executado, somando o avanço informado nos RDOs. O **desvio** é a diferença entre os dois: positivo (seta verde) significa adiantado; negativo (seta vermelha), atrasado.' },
      { t: 'h', x: 'Lista ou cartões' },
      { t: 'p', x: 'Use os botões **Lista** e **Cartões** (canto direito) para escolher como ver os projetos. O sistema lembra a sua escolha. Para encontrar um projeto, use a busca e os filtros de **grupo** e **status**.' },
      { t: 'img', src: '/ajuda/painel-cartoes.webp', alt: 'Painel de projetos em cartões', legenda: 'Painel em modo cartões.' },
      { t: 'h', x: 'Menu de ações do projeto (⋮)' },
      { t: 'p', x: 'Cada projeto tem um botão de **três pontos** com as opções abaixo.' },
      {
        t: 'lista',
        x: [
          '**Editar**: altera nome, descrição, contrato, empresa contratada, grupo, status, gestor, foto e datas.',
          '**Novo RDO**: já abre o novo RDO com este projeto selecionado.',
          '**Relatório**: abre os relatórios filtrados neste projeto.',
          '**Duplicar**: cria uma cópia do projeto. Você escolhe copiar só as configurações, ou também a estrutura de etapas e atividades (com o progresso zerado). RDOs, fotos e comentários nunca são copiados.',
          '**Excluir**: remove o projeto.',
        ],
      },
      { t: 'img', src: '/ajuda/menu-acoes.webp', alt: 'Menu de ações de um projeto', legenda: 'Menu de ações aberto em um cartão.' },
      { t: 'h', x: 'Criar um novo projeto' },
      {
        t: 'passos',
        x: [
          'Clique em **Novo projeto** (canto superior direito).',
          'Preencha o **nome** (obrigatório). Os demais campos ajudam a organizar: pedido de compra ou contrato, empresa contratada, **grupo** (para agrupar projetos, como "Manutenção" ou "Unidade SP"), **gestor** e as datas de início e fim do contrato.',
          'Se quiser, adicione uma **foto** do projeto.',
          'Clique em **Criar projeto**.',
        ],
      },
      { t: 'img', src: '/ajuda/novo-projeto.webp', alt: 'Janela de criação de projeto', legenda: 'Janela "Novo projeto".' },
      { t: 'dica', x: 'Status do projeto: **Não iniciado**, **Em andamento**, **Paralisado**, **Concluído** e **Cancelado**. Quando um projeto é marcado como **Concluído**, aparecem botões para baixar todos os RDOs em PDF e todas as fotos, vídeos e arquivos.' },
    ],
    quem: 'Criar, editar, duplicar e excluir projetos exige a permissão "Gerenciar projetos".',
  },

  {
    id: 'projeto',
    icone: 'ti-folder',
    titulo: 'Dentro de um projeto',
    resumo: 'Visão geral, quem tem acesso e quem precisa assinar os RDOs.',
    blocos: [
      { t: 'p', x: 'Ao clicar em um projeto no painel você entra na **pasta do projeto**, que tem três abas: **Visão geral**, **Acesso** e **Assinaturas**.' },
      { t: 'h', x: 'Visão geral' },
      { t: 'p', x: 'Mostra os números do projeto (RDOs, atividades, ocorrências, comentários, fotos e vídeos), os **RDOs recentes**, as **fotos recentes** e as informações do contrato: prazo, progresso planejado e real, desvio, H/H total e duração. Clique em qualquer indicador para ver o conteúdo por trás do número. Para alterar os dados, use o botão **Editar**.' },
      { t: 'img', src: '/ajuda/projeto-visao-geral.webp', alt: 'Visão geral de um projeto', legenda: 'Visão geral do projeto.' },
      { t: 'h', x: 'Acesso: quem pode ver este projeto' },
      { t: 'p', x: 'Por padrão, todo o time enxerga o projeto. Se você adicionar a primeira pessoa na aba **Acesso**, o projeto passa a ser **restrito**: só quem estiver na lista consegue vê-lo. Cada pessoa tem um nível:' },
      {
        t: 'tabela',
        cab: ['Nível', 'O que a pessoa pode fazer'],
        linhas: [
          ['Visualizar', 'Só vê os dados e os RDOs do projeto. Não cria nem edita nada nele.'],
          ['Editar', 'Pode criar e editar RDOs deste projeto.'],
          ['Gerenciamento total', 'Além de editar, gerencia o acesso e as assinaturas do projeto.'],
        ],
      },
      { t: 'img', src: '/ajuda/projeto-acesso.webp', alt: 'Aba Acesso do projeto', legenda: 'Aba Acesso com três pessoas e níveis diferentes.' },
      {
        t: 'passos',
        x: [
          'Na aba **Acesso**, escolha a pessoa em **Adicionar pessoa**.',
          'Escolha o **nível** (Visualizar, Editar ou Gerenciamento total).',
          'Clique em **Adicionar**. Para mudar o nível, use a lista ao lado do nome; para tirar a pessoa, clique no **X** vermelho.',
        ],
      },
      { t: 'aviso', x: 'Administradores e quem tem a permissão **Gerenciar projetos** enxergam todos os projetos, mesmo os restritos.' },
      { t: 'h', x: 'Assinaturas: quem precisa assinar os RDOs' },
      { t: 'p', x: 'Defina quem aprova os RDOs deste projeto:' },
      {
        t: 'lista',
        x: [
          '**Aberta** (padrão): qualquer pessoa do time com permissão de aprovar RDOs pode assinar.',
          '**Pré-definida**: você escolhe **até 3 pessoas** (Assinante 1, 2 e 3). Só elas assinam os RDOs deste projeto, e o RDO só fica totalmente aprovado quando todas assinarem.',
        ],
      },
      { t: 'img', src: '/ajuda/projeto-assinaturas.webp', alt: 'Aba Assinaturas do projeto', legenda: 'Modo "Pré-definida", com os três assinantes.' },
      { t: 'p', x: 'Depois de escolher, clique em **Salvar**.' },
    ],
    quem: 'Acesso e assinaturas são gerenciados por administradores, por quem tem "Gerenciar projetos" e por quem tem Gerenciamento total no projeto.',
  },

  {
    id: 'tarefas',
    icone: 'ti-list-check',
    titulo: 'Lista de tarefas (EAP)',
    resumo: 'Organize o projeto em etapas e atividades. É dela que vem o progresso da obra.',
    blocos: [
      { t: 'p', x: 'A **Lista de tarefas** é a Estrutura Analítica do Projeto (EAP): o projeto é dividido em **etapas** (por exemplo, "1.0 Fundação"), e cada etapa tem **atividades** ("1.1 Escavação"). Quando você preenche um RDO, informa o avanço dessas atividades, e o sistema calcula o progresso real do projeto.' },
      { t: 'img', src: '/ajuda/tarefas.webp', alt: 'Lista de tarefas com etapas e atividades', legenda: 'Etapas e atividades de um projeto.' },
      { t: 'p', x: 'No topo você escolhe o **projeto**, pode **buscar** uma atividade e **filtrar por status**. Os cartões mostram o total de atividades, quantas não foram iniciadas, em andamento, concluídas e em atraso, além dos percentuais **realizado** e **planejado**.' },
      { t: 'h', x: 'Criar etapas e atividades' },
      {
        t: 'passos',
        x: [
          'Clique em **Nova etapa**, informe o **número** (como 1.0) e o **nome** (como Fundação).',
          'Clique em **Nova atividade**, escolha a **etapa**, escreva a descrição e, se quiser, informe as datas de **início** e **término**, o **status** e o **% inicial**.',
          'Para corrigir ou apagar, use **Editar** e **Remover** na linha da etapa ou da atividade.',
        ],
      },
      { t: 'dica', x: 'As datas são opcionais, mas são elas que permitem calcular o **planejado** e o **desvio**. Atividades sem data entram no projeto com desvio zero.' },
      { t: 'p', x: 'O status da atividade é **Não iniciada**, **Em andamento**, **Concluída** ou **Em atraso**.' },
    ],
    quem: 'Criar, editar e excluir exige a permissão "Gerenciar tarefas". Quem não tem a permissão apenas consulta.',
  },

  {
    id: 'novo-rdo',
    icone: 'ti-file-plus',
    titulo: 'Criar um RDO',
    resumo: 'Como abrir um novo relatório diário de obra.',
    blocos: [
      { t: 'p', x: 'O **RDO (Registro Diário de Obra)** é o relatório do que aconteceu na obra em um dia: clima, equipes, equipamentos, atividades executadas, ocorrências e fotos.' },
      {
        t: 'passos',
        x: [
          'Clique em **Novo RDO** no menu (ou no botão do topo do painel). Se você estiver dentro da pasta de um projeto, o projeto já vem selecionado.',
          'Escolha o **projeto** e a **data**.',
          'Deixe marcada a opção **Copiar dados do RDO anterior** se quiser aproveitar horários, mão de obra e equipamentos do último RDO do projeto. Isso economiza bastante tempo.',
          'Clique em **Criar RDO**. O formulário abre para você preencher.',
        ],
      },
      { t: 'img', src: '/ajuda/novo-rdo.webp', alt: 'Tela Novo RDO', legenda: 'Escolha de projeto e data.' },
      { t: 'dica', x: 'Se já existir um RDO do mesmo projeto naquela data, o sistema mostra um aviso com a lista dos RDOs existentes, para você conferir se não é uma duplicidade. Você ainda pode criar um novo.' },
      { t: 'aviso', x: 'O RDO é criado como **Rascunho**. Nada vai para aprovação até você clicar em **Enviar para aprovação**.' },
    ],
    quem: 'Exige a permissão "Emitir RDOs".',
  },

  {
    id: 'preencher-rdo',
    icone: 'ti-edit',
    titulo: 'Preencher o RDO',
    resumo: 'Cada parte do formulário, do clima às fotos, e os botões da barra inferior.',
    blocos: [
      { t: 'p', x: 'O formulário é dividido em seções numeradas. Você pode preenchê-lo aos poucos e salvar como rascunho a qualquer momento.' },
      { t: 'h', x: '1. Identificação' },
      { t: 'p', x: 'Mostra o **número do RDO**, a **data** (com o dia da semana), o projeto, o pedido de compra ou contrato, a empresa contratada e o gestor. O quadro verde resume o **prazo contratual**: datas, dias decorridos e dias restantes.' },
      { t: 'img', src: '/ajuda/rdo-identificacao.webp', alt: 'Seção Identificação do RDO' },
      { t: 'h', x: '2. Condições climáticas' },
      { t: 'p', x: 'Toque na condição da **manhã** e da **tarde**: tempo limpo, nublado, chuva ou tempestade. Para obras com turno da noite, use **Adicionar turno da noite**. Informe a **precipitação (mm)** e o **impacto no serviço**: **Nenhum**, **Parcial** ou **Total (paralisado)**.' },
      { t: 'img', src: '/ajuda/rdo-clima.webp', alt: 'Seção Condições climáticas' },
      { t: 'h', x: '3. Atividade, horários e progresso' },
      {
        t: 'passos',
        x: [
          'Informe o **início**, o **término** e o **intervalo (h)**. O sistema calcula o **total trabalhado**.',
          'Clique em **Adicionar atividade** e escolha uma atividade da **lista de tarefas** (ou registre uma atividade avulsa, informando a etapa e o nome).',
          'Para cada atividade, arraste a barra ou use os botões **−** e **+** do **ajuste fino** para informar o **percentual acumulado**. O campo **Avanço hoje** mostra quanto andou neste dia, e **Anterior** mostra o acumulado que já existia.',
          'Escreva em **Observações** o que foi executado no dia.',
        ],
      },
      { t: 'img', src: '/ajuda/rdo-atividades.webp', alt: 'Seção Atividade, horários e progresso' },
      { t: 'aviso', x: 'O percentual acumulado não pode ficar abaixo do que já tinha sido informado antes, nem passar de 100%.' },
      { t: 'h', x: '4. Mão de obra' },
      { t: 'p', x: 'Clique em **Adicionar mão de obra** e escolha as funções (pedreiro, servente, eletricista...). Para cada função informe a **quantidade** de pessoas e os horários de **entrada** e **saída**; o sistema calcula as **H/H** (horas-homem). Cada função tem uma categoria: **Direta**, **Indireta** ou **Terceirizada**. No cabeçalho aparece o total de H/H e a divisão por categoria.' },
      { t: 'img', src: '/ajuda/rdo-mao-de-obra.webp', alt: 'Seção Mão de obra' },
      { t: 'dica', x: 'Não achou a função? No seletor, use a opção para **cadastrar uma nova função**. Ela fica disponível para os próximos RDOs.' },
      { t: 'h', x: '5. Equipamentos' },
      { t: 'p', x: 'Clique em **Adicionar equipamento**, escolha na lista e informe a **quantidade** e uma observação, se precisar. Também dá para cadastrar um equipamento novo.' },
      { t: 'img', src: '/ajuda/rdo-equipamentos.webp', alt: 'Seção Equipamentos' },
      { t: 'h', x: '6. Ocorrências' },
      { t: 'p', x: 'Use **Registrar ocorrência** para anotar imprevistos: escolha o **tipo** (como atraso de material ou condição climática), informe o **início** e o **término** (o sistema calcula as horas impactadas) e **descreva** o ocorrido. Esses dados alimentam os gráficos de ocorrências nos Relatórios.' },
      { t: 'img', src: '/ajuda/rdo-ocorrencias.webp', alt: 'Seção Ocorrências' },
      { t: 'h', x: '7. Fotos, vídeos e arquivos' },
      { t: 'p', x: 'Toque em **Fotos** (JPG, PNG, HEIC), **Vídeos** (MP4, até 50 MB) ou **Arquivos** (PDF, DWG, DOCX e outros) para enviar. No celular, você pode tirar a foto na hora. Cada item aceita uma **legenda**.' },
      { t: 'img', src: '/ajuda/rdo-midias.webp', alt: 'Seção Fotos, vídeos e arquivos' },
      { t: 'h', x: '8. Comentários' },
      { t: 'p', x: 'Converse com a equipe dentro do próprio RDO. Escreva e envie (atalho **Ctrl+Enter**). É possível responder a um comentário e excluir os seus.' },
      { t: 'img', src: '/ajuda/rdo-comentarios.webp', alt: 'Seção Comentários' },
      { t: 'h', x: 'Barra de botões na parte de baixo' },
      { t: 'p', x: 'A barra fica sempre visível, no fim da tela, enquanto você preenche.' },
      { t: 'img', src: '/ajuda/rdo-barra-acoes.webp', alt: 'Barra inferior do RDO' },
      {
        t: 'tabela',
        cab: ['Botão', 'O que faz'],
        linhas: [
          ['Cancelar', 'Sai do RDO e volta para a Lista de RDOs. Salve como rascunho antes se não quiser perder o que preencheu.'],
          ['Excluir RDO', 'Apaga o RDO (aparece nos rascunhos e para quem pode aprovar).'],
          ['Setas ‹ ›', 'Navegam para o RDO anterior ou o próximo do mesmo projeto, sem voltar à lista.'],
          ['Rascunho', 'Salva o que você preencheu e mantém o RDO como rascunho.'],
          ['Gerar PDF', 'Gera o PDF do RDO para guardar ou enviar.'],
          ['Enviar para aprovação', 'Envia o RDO para os assinantes assinarem.'],
        ],
      },
      { t: 'dica', x: 'Salve o **Rascunho** com frequência. Só envie para aprovação quando o dia estiver completo: depois do envio, o RDO passa a abrir na tela de **Aprovação**, em modo leitura. Para corrigir, quem aprova precisa pedir **revisão** ou **reabri-lo**. RDOs totalmente aprovados ficam bloqueados para edição.' },
    ],
    quem: 'Exige a permissão "Emitir RDOs".',
  },

  {
    id: 'celular',
    icone: 'ti-device-mobile',
    titulo: 'Preencher o RDO pelo celular',
    resumo: 'Dicas para registrar a obra direto do canteiro.',
    blocos: [
      { t: 'p', x: 'O formulário se adapta à tela do celular: as seções ficam uma embaixo da outra, e a barra de botões continua no rodapé.' },
      {
        t: 'celulares',
        itens: [
          { src: '/ajuda/mobile-rdo-topo.webp', alt: 'Início do RDO no celular', legenda: 'Identificação e barra de botões.' },
          { src: '/ajuda/mobile-rdo-meio.webp', alt: 'Meio do RDO no celular', legenda: 'Rolando o formulário.' },
        ],
      },
      {
        t: 'lista',
        x: [
          'Abra o sistema pelo navegador do celular e entre com o seu e-mail e senha.',
          'Para tirar fotos na hora, toque em **Fotos** na seção 7 e escolha a câmera.',
          'Preencha ao longo do dia e use **Rascunho** sempre que fizer uma pausa: assim nada se perde.',
          'Use **Copiar dados do RDO anterior** ao criar o RDO para começar já com horários, equipes e equipamentos preenchidos.',
        ],
      },
    ],
  },

  {
    id: 'aprovacao',
    icone: 'ti-writing',
    titulo: 'Aprovação e assinatura',
    resumo: 'Como revisar, assinar ou devolver um RDO para correção.',
    blocos: [
      { t: 'p', x: 'Depois que o RDO é enviado, quem deve assinar recebe um aviso por e-mail. No menu, o item **Aprovação** mostra um número vermelho com a quantidade de RDOs aguardando.' },
      { t: 'img', src: '/ajuda/aprovacao-lista.webp', alt: 'Fila de RDOs pendentes de aprovação', legenda: 'Fila de RDOs pendentes de aprovação.' },
      { t: 'h', x: 'Estados de um RDO' },
      {
        t: 'tabela',
        cab: ['Status', 'Significado'],
        linhas: [
          ['Rascunho', 'Ainda está sendo preenchido. Pode ser editado.'],
          ['Pendente aprovação', 'Foi enviado e espera as assinaturas. Quando há vários assinantes, aparece qual está pendente (por exemplo, "2ª de 3").'],
          ['Totalmente aprovado', 'Todos os assinantes assinaram.'],
          ['Revisar', 'Um assinante pediu correções. O emissor é avisado e pode editar de novo.'],
        ],
      },
      { t: 'h', x: 'Revisar e assinar um RDO' },
      {
        t: 'passos',
        x: [
          'Em **Aprovação**, clique em **Abrir** no RDO. Você vê o relatório completo, em modo leitura.',
          'Confira as informações, as fotos e os comentários. Se quiser, use **Exportar PDF**.',
          'Role até a seção **Assinaturas**. Para aprovar, clique em **Assinar**: sua assinatura digital é aplicada ao RDO.',
          'Para devolver, escreva o **motivo** no campo de texto e clique em **Revisar**. O emissor recebe o aviso para ajustar.',
        ],
      },
      { t: 'img', src: '/ajuda/aprovacao-topo.webp', alt: 'RDO aberto para aprovação' },
      { t: 'img', src: '/ajuda/aprovacao-assinaturas.webp', alt: 'Seção Assinaturas do RDO', legenda: 'Seção Assinaturas: quem já assinou, quem falta, campo de motivo e botões Revisar e Assinar.' },
      { t: 'aviso', x: 'Para assinar, você precisa ter **cadastrado a sua assinatura digital** em **Meu perfil**. Se ainda não cadastrou, o botão vira **Cadastrar assinatura pra assinar** e leva você até lá.' },
      { t: 'h', x: 'Reabrir e excluir' },
      { t: 'lista', x: [
        '**Reabrir para rascunho**: quem tem permissão de aprovar pode devolver um RDO já enviado ou aprovado para o estado de rascunho, para corrigir. As assinaturas dadas antes deixam de valer.',
        '**Excluir RDO**: apaga o relatório.',
        'No rodapé do RDO, **Log de edições** e **Visualizações** mostram quem alterou e quem abriu o relatório, com data e hora.',
      ] },
      { t: 'p', x: 'As assinaturas seguem a **Lei nº 14.063/2020** (assinatura eletrônica), por isso têm validade jurídica.' },
    ],
    quem: 'Assinar, revisar e reabrir exige a permissão "Aprovar RDOs" (e, se o projeto tiver assinantes pré-definidos, estar entre eles).',
  },

  {
    id: 'lista-rdos',
    icone: 'ti-list',
    titulo: 'Lista de RDOs',
    resumo: 'Encontre qualquer relatório por projeto, grupo, data ou status.',
    blocos: [
      { t: 'p', x: 'A **Lista de RDOs** reúne todos os relatórios da empresa. No topo, cartões mostram o total e quantos estão aprovados, pendentes e em rascunho.' },
      { t: 'img', src: '/ajuda/lista-rdos.webp', alt: 'Lista de RDOs', legenda: 'Lista de RDOs com status coloridos.' },
      {
        t: 'lista',
        x: [
          '**Buscar**: digite parte do nome do projeto, da data ou do responsável.',
          '**Filtros**: escolha um **grupo** de projetos e/ou um **status**.',
          '**Ordenar**: clique no título de uma coluna (#, Projeto, Grupo, Data, Gestor do Projeto, Status). Clique de novo para inverter.',
          '**Abrir** (ou clicar na linha): rascunhos e RDOs a revisar abrem no formulário, para edição; pendentes e aprovados abrem na tela de Aprovação, em modo leitura.',
          '**PDF**: gera o PDF do RDO direto da lista.',
        ],
      },
      { t: 'dica', x: 'A coluna **Gestor do Projeto** mostra o gestor definido no cadastro do projeto, e não quem preencheu o RDO.' },
    ],
  },

  {
    id: 'relatorios',
    icone: 'ti-chart-bar',
    titulo: 'Relatórios',
    resumo: 'Indicadores e gráficos de desempenho, com exportação em PDF.',
    blocos: [
      { t: 'p', x: 'A tela **Relatórios** resume o que está acontecendo nas obras. Use os filtros no topo para escolher o **grupo**, o **projeto** e o **período** (por exemplo, últimos 30 dias).' },
      { t: 'img', src: '/ajuda/relatorios.webp', alt: 'Tela de relatórios', legenda: 'Relatórios com indicadores e gráficos.' },
      {
        t: 'tabela',
        cab: ['Bloco', 'O que mostra'],
        linhas: [
          ['Indicadores do topo', 'Avanço médio, desvio médio, RDOs no período, H/H registradas, taxa de aprovação, ocorrências abertas, projetos, usuários, fotos, vídeos, anexos e armazenamento.'],
          ['H/H por categoria de mão de obra', 'Horas-homem de mão de obra direta, indireta e terceirizada.'],
          ['Top 5 — piores desvios', 'Os projetos mais atrasados em relação ao planejado.'],
          ['Status dos RDOs', 'Proporção de rascunhos, pendentes, aprovados e a revisar.'],
          ['Ocorrências por tipo', 'Quais tipos de ocorrência mais aparecem.'],
          ['Horas impactadas por ocorrências', 'Quanto tempo de trabalho cada tipo de ocorrência tomou.'],
          ['H/H por função', 'Quais funções mais consumiram horas.'],
          ['Tempo médio de aprovação', 'Quanto tempo os RDOs levam entre o envio e a decisão.'],
          ['RDOs ao longo do tempo', 'Quantos RDOs foram registrados por dia, semana ou mês.'],
        ],
      },
      { t: 'h', x: 'Exportar em PDF' },
      { t: 'p', x: 'Clique em **Exportar PDF** (canto superior direito) para gerar um documento com os mesmos gráficos que você vê na tela, respeitando os filtros escolhidos. Ótimo para reuniões e para enviar ao cliente.' },
    ],
    quem: 'Exige a permissão "Ver relatórios".',
  },

  {
    id: 'usuarios',
    icone: 'ti-users',
    titulo: 'Usuários e permissões',
    resumo: 'Convide a equipe e defina o que cada pessoa pode ver e fazer.',
    blocos: [
      { t: 'p', x: 'Em **Usuários** você vê toda a equipe, o perfil de cada pessoa, a quantidade de projetos com acesso, o último acesso e o status. O subtítulo mostra quantos usuários você já usa do limite do plano.' },
      { t: 'img', src: '/ajuda/usuarios.webp', alt: 'Lista de usuários', legenda: 'Lista de usuários e perfis.' },
      { t: 'h', x: 'Os dois perfis' },
      {
        t: 'lista',
        x: [
          '**Administrador**: acesso a tudo, sem restrições.',
          '**Personalizado**: você marca, pessoa por pessoa, o que ela pode fazer (veja a tabela abaixo).',
        ],
      },
      {
        t: 'tabela',
        cab: ['Permissão', 'O que libera'],
        linhas: [
          ['Ver relatórios', 'Acessar a tela de Relatórios.'],
          ['Emitir RDOs', 'Criar e editar Registros Diários de Obra.'],
          ['Gerenciar tarefas', 'Criar, editar e excluir itens da lista de tarefas (EAP).'],
          ['Aprovar RDOs', 'Aprovar ou rejeitar os RDOs enviados.'],
          ['Gerenciar projetos', 'Criar e editar projetos e ver todos eles (sem isso, a pessoa só vê os projetos liberados para ela).'],
          ['Gerenciar equipe', 'Convidar, remover e editar usuários.'],
        ],
      },
      { t: 'h', x: 'Adicionar um usuário' },
      {
        t: 'passos',
        x: [
          'Clique em **Convidar usuário** (ou abra a aba **Cadastro de usuário**).',
          'Escolha como adicionar: **Enviar convite por e-mail** (a pessoa define a própria senha) ou **Cadastrar agora com senha** (você define uma senha inicial e a pessoa já entra direto).',
          'Informe o **e-mail** e, se quiser, a **função** (por exemplo, "Engenheiro Civil"). No cadastro com senha, informe também o **nome** e a **senha inicial** (mínimo de 8 caracteres).',
          'Escolha o **perfil**. Se for **Personalizado**, marque as permissões.',
          'Clique em **Enviar convite** ou **Cadastrar usuário**.',
        ],
      },
      { t: 'img', src: '/ajuda/cadastro-usuario.webp', alt: 'Cadastro de usuário', legenda: 'Cadastro com perfil Personalizado e as seis permissões.' },
      { t: 'p', x: 'Convites ainda não aceitos aparecem logo abaixo, com a data de validade e os botões **Reenviar** e **Cancelar**.' },
      { t: 'h', x: 'Botões em cada usuário' },
      {
        t: 'lista',
        x: [
          '**Editar**: muda nome, função, perfil e permissões.',
          '**Projetos**: define em quais projetos a pessoa tem acesso e com qual nível.',
          '**Notificações**: ajusta os avisos por e-mail dessa pessoa.',
          '**Desativar** / **Reativar**: bloqueia ou libera o acesso sem apagar o histórico.',
        ],
      },
    ],
    quem: 'Exige a permissão "Gerenciar equipe".',
  },

  {
    id: 'conta',
    icone: 'ti-settings',
    titulo: 'Empresa, notificações e perfil',
    resumo: 'Dados da empresa, plano contratado, avisos por e-mail, senha e assinatura digital.',
    blocos: [
      { t: 'h', x: 'Dados da empresa' },
      { t: 'p', x: 'Mostra o cadastro da empresa (nome, CNPJ, setor, cidade e contato), o **plano contratado** com o próximo vencimento e o **uso do plano**: usuários ativos, projetos e RDOs no mês, comparados com os limites. Para mudar de plano ou os dados de cobrança, fale com o suporte.' },
      { t: 'img', src: '/ajuda/empresa.webp', alt: 'Dados da empresa e plano', legenda: 'Dados da empresa, plano e uso.' },
      { t: 'h', x: 'Notificações' },
      { t: 'p', x: 'Escolha como e quando quer ser avisado por e-mail. Em **Como você quer receber**, prefira **Um e-mail por notificação** ou **Resumo no fim do dia**. Depois, ligue ou desligue cada aviso:' },
      {
        t: 'lista',
        x: [
          '**RDO enviado para aprovação**: quando um RDO aguarda a sua aprovação.',
          '**RDO aprovado**: quando o seu RDO é aprovado por todos.',
          '**RDO em revisão / comentário**: quando pedem revisão ou comentam no seu RDO.',
          '**Lembrete diário (18h)**: quando o RDO do dia ainda não foi emitido.',
          '**Contrato vencendo**: aviso 30 dias antes do fim do contrato do projeto.',
          '**Convite pendente**: quando um convite enviado não foi aceito depois de alguns dias.',
        ],
      },
      { t: 'img', src: '/ajuda/notificacoes.webp', alt: 'Preferências de notificação', legenda: 'Preferências de notificação.' },
      { t: 'h', x: 'Meu perfil' },
      {
        t: 'lista',
        x: [
          '**Dados pessoais**: altere seu nome e sua foto (clique na foto; JPG ou PNG de até 5 MB).',
          '**Empresas vinculadas**: se o seu e-mail existe em mais de uma empresa, você troca de empresa por aqui.',
          '**Segurança**: troque a senha (informe a atual e a nova, com no mínimo 8 caracteres).',
          '**Assinatura digital**: cadastre a sua assinatura. Ela é usada automaticamente sempre que você aprova um RDO. Você pode desenhá-la com o mouse ou o dedo, enviar uma imagem ou colar uma imagem da área de transferência. Use **Limpar** para recomeçar e **Atualizar assinatura** para trocar.',
        ],
      },
      { t: 'img', src: '/ajuda/perfil.webp', alt: 'Tela Meu perfil', legenda: 'Meu perfil, com a assinatura digital cadastrada.' },
      { t: 'aviso', x: 'Os dados da empresa e do plano só podem ser alterados por **administradores**.' },
    ],
  },

  {
    id: 'duvidas',
    icone: 'ti-help-circle',
    titulo: 'Dúvidas frequentes',
    resumo: 'Respostas rápidas para os problemas mais comuns.',
    blocos: [
      {
        t: 'faq',
        itens: [
          { q: 'Esqueci minha senha. O que faço?', a: 'Na tela de login, clique em **Esqueci minha senha**, informe o seu e-mail e siga o link que chegar por e-mail para criar uma nova senha.' },
          { q: 'Não consigo ver um projeto que os colegas veem.', a: 'O projeto pode estar **restrito**. Peça a quem administra o projeto para incluir você na aba **Acesso** (ou peça ao administrador da empresa).' },
          { q: 'O botão de criar RDO, aprovar ou ver relatórios não aparece, ou dá aviso de acesso.', a: 'Isso depende das suas **permissões**. Peça ao administrador da empresa para liberar a permissão em **Usuários > Editar**.' },
          { q: 'Preciso corrigir um RDO que já foi enviado.', a: 'Quem tem permissão de aprovar pode usar **Reabrir para rascunho**. Depois de corrigido, o RDO é enviado de novo para aprovação e as assinaturas são refeitas.' },
          { q: 'Como aprovo um RDO?', a: 'Abra o RDO em **Aprovação** e clique em **Assinar** na seção Assinaturas. Antes, cadastre a sua assinatura digital em **Meu perfil**.' },
          { q: 'A mensagem diz que atingi o limite do plano.', a: 'Cada plano tem limites de usuários, projetos e RDOs por mês. Veja o uso em **Dados da empresa** e fale com o suporte para ampliar o plano.' },
          { q: 'As assinaturas têm validade jurídica?', a: 'Sim. O sistema usa assinatura eletrônica conforme a **Lei nº 14.063/2020**, com registro de quem assinou, quando e quais alterações foram feitas.' },
          { q: 'Como baixo tudo de um projeto encerrado?', a: 'Marque o projeto como **Concluído**. Na pasta dele aparecem os botões **Baixar RDOs (PDF)** e **Baixar fotos, vídeos e arquivos**.' },
          { q: 'Com quem falo se precisar de ajuda?', a: 'Escreva para **suportediariodoprojeto@gmail.com**. Se puder, mande um print da tela e o horário em que o problema aconteceu.' },
        ],
      },
    ],
  },

  {
    id: 'glossario',
    icone: 'ti-book-2',
    titulo: 'Glossário',
    resumo: 'Os termos usados no sistema.',
    blocos: [
      {
        t: 'tabela',
        cab: ['Termo', 'Significado'],
        linhas: [
          ['RDO', 'Registro Diário de Obra: o relatório do que aconteceu na obra em um dia.'],
          ['EAP', 'Estrutura Analítica do Projeto: a divisão do projeto em etapas e atividades (a Lista de tarefas).'],
          ['H/H', 'Horas-homem: número de pessoas multiplicado pelas horas trabalhadas.'],
          ['Planejado × Real', 'Quanto da obra deveria estar pronto pelas datas × quanto já foi realmente executado.'],
          ['Desvio', 'Real menos planejado. Positivo = adiantado; negativo = atrasado.'],
          ['Grupo', 'Rótulo para agrupar projetos (por exemplo, "Manutenção" ou "Unidade SP") e filtrar listas e relatórios.'],
          ['Gestor do projeto', 'Pessoa responsável pelo projeto, definida no cadastro dele.'],
          ['Mão de obra direta / indireta / terceirizada', 'Direta: equipe que executa a obra. Indireta: apoio e supervisão. Terceirizada: contratada de fora.'],
          ['Assinante', 'Quem assina (aprova) os RDOs de um projeto.'],
          ['Rascunho', 'RDO ainda em preenchimento, que não foi enviado para aprovação.'],
        ],
      },
    ],
  },
]
