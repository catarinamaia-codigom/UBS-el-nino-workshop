# El Niño é pauta de saúde · Escuta da UBS + Painel do workshop

**UBS conhece. A UPE apoia.**

Formulário anônimo para a equipe da UBS e painel que transforma as respostas na base do workshop de cocriação sobre calor, El Niño e saúde. Segue a mesma arquitetura da pesquisa territorial do Córrego da Bica: um único `index.html` que roda **ao mesmo tempo** no GitHub Pages e no Google Apps Script e grava tudo na **mesma planilha**.

```
GitHub Pages (index.html) ──fetch──┐
                                   ├──► Apps Script (apps-script/*.gs) ──► Planilha Google (respostas)
Apps Script /exec (mesmo HTML) ────┘        validação, login do painel, auditoria
```

- **Formulário:** https://catarinamaia-codigom.github.io/UBS-el-nino-workshop/
- **Painel:** o mesmo endereço com `#painel` no final (ou o botão *Área da equipe UPE*).
- Enquanto o servidor não estiver conectado, tudo funciona em **modo demonstração**: o formulário guarda as respostas no próprio aparelho e o painel abre com dados fictícios. Serve para apresentar a proposta à gestão.

## Como o formulário está organizado

As etapas seguem a lógica da proposta (*o formulário não é burocracia, é estratégia*): perguntas que comparam **conhecimento declarado × realidade da UBS**.

| Etapa | Para quê | Perguntas |
|---|---|---|
| **Quem responde** | agrupar sem identificar | função na UBS · tempo nesta UBS |
| **1. Escutar** | o que a equipe diz que conhece | familiaridade com El Niño · efeitos do calor em geral · impactos na população da UBS · segurança para reconhecer agravos · para orientar · para indicar UBS × UPA/SAMU (escala 1–5) |
| **2. Diagnosticar** | o que já existe de material e fluxo | já recebeu material/treinamento · de onde veio · se ajuda no território · fluxo para casos de calor · material para usuários · aviso de onda de calor |
| **3. Verificar** | o que muda no contexto da UBS | agravos percebidos · grupos que mais preocupam (até 3) · barreiras do território (até 3) · 3 situações concretas em escala 1–5 · orientações que não funcionam · situação real (textos opcionais) |
| **4. Direcionar** | o que vira workshop e material | temas prioritários (até 3) · materiais mais úteis (até 3) · linguagem (até 2) · canais (até 3) · formato do encontro · um pedido ao workshop |

Cerca de 25 perguntas, ~7 minutos. Sem nome, e-mail ou telefone. O rascunho fica salvo no aparelho até o envio; sem internet, a resposta fica guardada e é enviada sozinha quando a conexão volta.

**Pares declarado × realidade** (o coração da etapa *Verificar*):

| Par | Pergunta geral (etapa 1) | Pergunta no contexto (etapa 3) |
|---|---|---|
| Conhecer os efeitos do calor | efeitos do calor na saúde, em geral | impactos na população da SUA UBS |
| Reconhecer agravos | segurança para reconhecer agravos | perceber piora de crônicos pelo calor nas visitas |
| Orientar o usuário | orientar sobre proteção ao calor | orientar família com casa quente e falta d'água |
| Decidir entre UBS e UPA/SAMU | dizer quando ir a cada serviço | idoso com tontura e confusão num dia quente |

## O painel do workshop

Organizado na mesma sequência: **Escutar → Diagnosticar → Verificar → Direcionar → Roteiro do workshop**.

- **Indicadores:** respostas, equipe sem orientação adaptada ao território, segurança para reconhecer agravos (declarada × no caso concreto) e falta de fluxo combinado.
- **Gráficos:** barras de 100% para as escalas, barras ordenadas para escolhas, gráfico de halteres para as lacunas declarado × realidade e os relatos livres. Todo gráfico tem *Ver tabela*.
- **Filtros** por função e tempo de atuação (e por unidade, se houver mais de uma). Grupos com menos de 3 respostas ficam indisponíveis para preservar o anonimato.
- **Roteiro do workshop gerado pelas respostas**, pronto para copiar ou imprimir:
  1. **Devolutiva (10 min):** maior lacuna, agravos, grupos e barreiras mais citados.
  2. **Atualização científica direcionada (15 min):** temas em ordem de prioridade = % que pediu o tema + metade da lacuna (em pontos percentuais) do par ligado a ele.
  3. **Cocriação do semifolder (25 min):** as 4 seções do semifolder já preenchidas com os focos que a equipe apontou, com perguntas para a discussão.
  4. **Encaminhamentos (10 min):** as 4 entregas (workshop replicável, folder, banner/cartaz, outro material), materiais e canais mais pedidos e formato preferido.
- **Modo apresentação** para projetar no encontro (esconde botões, filtros e relatos livres), **CSV**, link da **planilha** e **Copiar link do formulário**.

## Instalação do servidor (uma vez, com a conta dona da planilha)

1. Crie uma planilha Google nova (ex.: *El Niño · Escuta da UBS — respostas*) e deixe o compartilhamento como **Restrito**. O app continua funcionando, porque o Apps Script roda com a sua conta.
2. Na planilha, abra **Extensões → Apps Script**. Crie dois arquivos de script e cole o conteúdo da pasta [`apps-script/`](apps-script): `Config.gs` e `Codigo.gs`. Apague o `Código.gs` vazio que vem por padrão.
3. Selecione a função **`configurarElNino`**, clique em **Executar** e autorize.
   - Ela cria as abas `Respostas`, `Acessos`, `Parametros`, `Dicionario`, `Auditoria` e `Instrucoes` e **não apaga nada**.
   - O login `coordenacao` e uma senha aleatória aparecem no registro de execução e na aba **Acessos**.
4. **Implantar → Nova implantação → App da Web**
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa** (o formulário é público e anônimo; o painel exige login)
   - Copie a URL que termina em **`/exec`**.
5. No GitHub, edite `index.html`, procure `const API_URL = '';` e cole a URL entre as aspas. Faça o commit.
   Também dá para informar a URL em *Configuração do servidor*, na tela de login do painel. Nesse caso ela vale só para aquele navegador.
6. Teste: responda o formulário pelo GitHub Pages e abra o painel com o login da coordenação.

> **Contas institucionais (@upe.br):** o administrador do Google Workspace pode bloquear a opção "Qualquer pessoa". Se ela não aparecer, use uma conta Gmail pessoal como dona da planilha e do script.

### Atualizar depois

- **Interface (`index.html`):** basta fazer o commit. Para o link `/exec` mostrar a mudança na hora, execute `atualizarInterfaceElNino()` no editor.
- **Servidor (`.gs`):** cole o código novo e vá em *Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão*. Assim a URL `/exec` não muda.
- `verificarElNino()` mostra o estado da conexão sem alterar dados.

## Uso

- **Link para a equipe:** `https://catarinamaia-codigom.github.io/UBS-el-nino-workshop/?ubs=Nome%20da%20UBS`. O nome aparece no formulário e é gravado com cada resposta. Sem `?ubs=`, vale `UBS_PADRAO` da aba *Parametros*.
- **Replicar em outra UBS:** use o mesmo link com outro `?ubs=`. O painel ganha o filtro *Unidade*.
- **Encerrar o formulário:** na aba *Parametros*, escreva `não` em `FORM_ABERTO`.
- **Acessos:** troque a senha ou escreva `não` em `ativo` na aba *Acessos*; a sessão aberta cai na hora.
- **Mudar perguntas:** edite `ETAPAS` no `index.html` e aumente `FORM_VERSAO`. Cada resposta grava a versão, e o painel atualiza a aba *Dicionario* (código → texto da pergunta e das opções) no próximo login.

## Planilha

`Respostas` tem uma linha por pessoa: `id_resposta`, `recebido_em`, `unidade`, `versao_form`, `origem`, `duracao_seg`, `request_id` e uma coluna por pergunta (criada sozinha no primeiro envio). Múltipla escolha fica como códigos separados por ` | `; o significado está em `Dicionario`. Textos que começam com `=`, `+`, `-` ou `@` são gravados como texto, nunca como fórmula. Reenvios do mesmo aparelho não duplicam linhas (`request_id`).

Abas em laranja guardam credenciais ou registros de acesso. Não apague linhas para corrigir dados.

## Ética e anonimato

O formulário não coleta identificação, não avalia profissionais individualmente e avisa para não citar nomes nos textos livres. Mesmo assim, em equipes pequenas, função + tempo de atuação podem identificar alguém: por isso o painel esconde recortes com menos de 3 respostas e o modo apresentação oculta os relatos livres. Revise os relatos antes de projetar. Se a proposta for virar pesquisa com publicação de resultados, verifique a necessidade de submissão ao Comitê de Ética.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | formulário, painel e roteiro (arquivo único, imagens embutidas) |
| `apps-script/Config.gs` | endereços, nome padrão da UBS e limites |
| `apps-script/Codigo.gs` | API (enviar, login, resultados, dicionário), configuração da planilha |
| `sw.js` | guarda a página para reabrir sem internet no GitHub Pages |
