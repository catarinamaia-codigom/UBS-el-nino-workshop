# El Niño é pauta de saúde · Escuta da USF, painel, tópicos e Roteiro do Workshop

**Não tem resposta errada. Nós é que queremos consertar a forma de criar conhecimento. Vocês conhecem, a UPE facilita.**

Formulário de escuta das equipes de Saúde da Família do Recife, com painel para a coordenação, banco de tópicos sobre El Niño e saúde e geração automática do Roteiro do Workshop com Material Diagnóstico. Segue a arquitetura da pesquisa do Córrego da Bica: um único `index.html` que roda no GitHub Pages e no Google Apps Script e grava tudo numa planilha Google, que é o banco de dados.

```
GitHub Pages (index.html) ──fetch──┐
                                   ├──► Apps Script (apps-script/Codigo.gs) ──► Planilha-banco (Google Sheets)
Apps Script /exec (mesmo HTML) ────┘                                         └─► Pasta do Drive (arquivos enviados)
```

- **Formulário:** https://catarinamaia-codigom.github.io/UBS-el-nino-workshop/ (para uma unidade: `?ubs=USF%20Nome`)
- **Coordenação:** ícone de usuário no topo → login → Painel, Tópicos, Roteiro e (para administradores) Montagem.
- **Material geral público dos tópicos:** `?topicos=1`
- **Material Diagnóstico publicado para uma equipe:** `?diagnostico=<código>` (gerado na aba Roteiro)
- Sem o servidor conectado, tudo funciona em **modo demonstração** (dados fictícios, nada gravado na planilha).

## O formulário (edição 1)

| Etapa | Conteúdo |
|---|---|
| **Começo** | nome da USF (já preenchido quando o link traz `?ubs=`), função, tempo na unidade e, em **estrelas**, o quanto a pessoa se sente preocupada com seus pacientes e usuários |
| **1. Escutar** | familiaridade e segurança declaradas (escala 1–5) |
| **2. Diagnosticar** | material e treinamento recebidos, fluxo da unidade, alertas |
| **3. Verificar** | agravos percebidos, grupos e barreiras do território, situações concretas (pares *declarado × realidade*), relatos |
| **4. Direcionar** | temas, materiais, linguagem, canais e formato do encontro |
| **5. Cocriar** | link de site ou matéria, **envio de arquivo** (até 3, 10 MB), **pergunta para a equipe UPE pesquisar** e um pedido ao workshop |

**Versão DEMO para validação:** com `MODO_VALIDACAO = sim` (aba Parametros ou botão na Montagem), cada pergunta e cada etapa ganha um **balão de comentário**. A coordenadora responde, comenta e as respostas dessa fase ficam marcadas como `validacao` (o painel não as conta, a menos que se peça). Os comentários aparecem na Montagem para serem resolvidos.

## Montagem do questionário (administração)

Editar texto, ajuda, rótulo do painel, obrigatoriedade, alternativas (incluir, renomear, reordenar, arquivar), máximo de escolhas, condição de exibição, pares *declarado × realidade*, ordem das perguntas e das etapas, novas perguntas e novas etapas. Há pré-visualização antes de publicar.

**Nada que já foi publicado se perde** (mesma premissa da pesquisa do Córrego da Bica):
- códigos de perguntas e alternativas são permanentes;
- o que sai do formulário é **arquivado**: some para quem responde, mas continua no painel e na planilha; o servidor recoloca, arquivado, qualquer pergunta ou alternativa que falte;
- o tipo de uma pergunta publicada não muda (arquive e crie outra);
- cada publicação é uma nova edição (aba `Versoes`) com o histórico do que mudou (aba `Historico_Questionario`); cada resposta grava a edição em que foi dada; colunas da aba `Respostas` nunca são apagadas.

## Painel

Indicadores, uma seção por etapa, **gráficos de pizza** nas perguntas de escolha única (com opção de ver em barras), barras de 100% nas escalas, estrelas, halteres *declarado × realidade*, relatos, links e materiais enviados. Filtros por USF, função e tempo (grupos com menos de 3 respostas ficam ocultos), CSV, link da planilha e modo apresentação.

## Tópicos do workshop

26 tópicos em 5 blocos (entender o fenômeno, agravos do calor, quem precisa de atenção especial, realidade do território e a unidade na onda de calor), destrinchados com foco no Recife: calor, tempo mais seco, falta de água e comida mais cara. Cada tópico tem resumo, pontos-chave, *como dizer para a população*, foco no Recife, materiais-fonte e **gatilhos** que ligam o tópico às respostas.

- **Essenciais** (7) sempre entram no workshop.
- **Prioridade:** para a USF escolhida, cada gatilho vira um sinal (`% de respostas × peso/3`) e os sinais se somam num índice de necessidade de 0 a 100. Os mais altos abrem o roteiro; os essenciais que não aparecem entre eles entram em revisão breve; os demais ficam como material de apoio.
- Tópicos e materiais ficam nas abas `Topicos` e `Materiais` e podem ser editados lá ou no app. Os destrinchamentos citam as fontes cadastradas em `Materiais`; ao incluir materiais novos, ligue-os aos tópicos pelo código.
- Formato dos gatilhos: `r1_temas=hidratacao*3; v3_barreiras=agua; v4_orientar_real<=2` (códigos na aba `Perguntas`).

## Roteiro do Workshop + Material Diagnóstico

Na aba **Roteiro**, escolha a USF: o app monta o documento dizendo que o workshop foi construído a partir das necessidades da equipe, com o diagnóstico, a ordem dos tópicos, o material pré-workshop (material geral, 2 vídeos e 1 e-book, opcionais), as perguntas que a equipe pediu para pesquisarmos e os materiais que ela enviou. Dá para copiar, imprimir em PDF ou **publicar um link** para a equipe. Os links dos 2 vídeos e do e-book são cadastrados em `Materiais` (`V01`, `V02`, `E01`, uso `pre_workshop`).

## Instalação do servidor (uma vez, com a conta dona da planilha)

A planilha-banco já existe no Drive (Estudio-IA › 20-Medicina › Em-foco › *ElNino-Escuta-USF - banco de dados*).

1. Abra a planilha → **Extensões → Apps Script**.
2. Apague o conteúdo de `Código.gs` e cole o arquivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs) inteiro. Salve.
3. Escolha a função **`configurarElNino`** → **Executar** → autorize. Ela cria as abas e grava o questionário (edição 1), os 26 tópicos e os materiais. Os acessos `admin` e `coordenacao` aparecem na aba **Acessos** (troque as senhas ali quando quiser).
4. **Implantar → Nova implantação → App da Web** · Executar como: **Eu** · Quem pode acessar: **Qualquer pessoa** → copie a URL `/exec`.
5. No GitHub, em `index.html`, cole a URL em `const API_URL = '';`.

Depois: para atualizar o servidor, cole o código novo e use *Implantar → Gerenciar implantações → editar → Nova versão* (a URL não muda). `verificarElNino()` mostra o estado sem alterar nada.

## Planilha-banco

| Aba | Conteúdo |
|---|---|
| Respostas | uma linha por pessoa: `id_resposta, recebido_em, usf, edicao, modo (oficial/validacao), origem, duracao_seg, request_id` + uma coluna por pergunta |
| Versoes · Historico_Questionario · Perguntas | edições publicadas, o que mudou em cada uma e o dicionário da edição atual |
| Comentarios | comentários de validação por pergunta ou etapa |
| Topicos · Materiais | banco de tópicos e de fontes (inclui links e arquivos enviados pelas equipes, com situação *a revisar*) |
| Diagnosticos | Materiais Diagnósticos publicados |
| Parametros | `MODO_VALIDACAO`, `FORM_ABERTO`, `UBS_PADRAO`, `USFS`, `PASTA_UPLOADS_ID` |
| Acessos · Auditoria (laranja) | logins (perfil `admin` ou `coordenacao`) e registro de acessos. Mantenha a planilha com compartilhamento Restrito |

Os arquivos enviados pelo formulário vão para a pasta *El Niño · materiais enviados pelas equipes*, ao lado da planilha, e ficam privados.

## Ética e anonimato

Sem nome, e-mail ou telefone; recortes com menos de 3 respostas ficam ocultos; o modo apresentação esconde relatos; o material público só mostra dados agregados e não mostra os arquivos enviados pelas equipes. Revise relatos antes de projetar. Se os resultados forem publicados como pesquisa, verifique a necessidade de submissão ao Comitê de Ética.

## Fontes dos tópicos

Ministério da Saúde (página Calor; Notas Técnicas 18/2023-SVSA e 38/2023-SAPS; Guia de bolso Mudanças Climáticas para Profissionais da Saúde; Painel de Excesso de Calor), SES-RJ (guia para ACS, 2025), SES-MG (hipoclorito 2,5%), Prefeitura de Porto Alegre (NT 1/2026, ACS e ACE), Prefeitura de São Paulo (idosos em calor e tempo seco) e boletins de 2026 sobre o El Niño (Inpe, APAC, Defesa Civil de PE, plano do Ministério da Saúde para o Nordeste). Links completos na aba `Materiais`.
