/**
 * EL NIÑO É PAUTA DE SAÚDE — Escuta da UBS · Configuração
 *
 * O mesmo index.html do GitHub roda em dois lugares e grava na MESMA planilha:
 *   1) GitHub Pages  → envia as respostas para a URL /exec desta implantação (doPost);
 *   2) Apps Script   → doGet() carrega o index.html publicado no GitHub e usa google.script.run.
 *
 * Nenhum ID de planilha precisa ficar no código público: crie este projeto pela própria
 * planilha (Extensões > Apps Script) e execute configurarElNino() uma vez.
 */

/** Versão do servidor. */
const ELN_VERSAO = '1.0';

/** Nome exibido no título da planilha e nas mensagens. */
const ELN_TITULO = 'EL NIÑO É PAUTA DE SAÚDE — ESCUTA DA UBS';

/**
 * Nome da unidade usado quando o link do formulário não traz ?ubs=Nome.
 * Também pode ser alterado depois na aba Parametros (UBS_PADRAO), sem mexer no código.
 */
const ELN_UBS_PADRAO = 'UBS parceira';

/** Endereço do index.html no GitHub. O Apps Script exibe sempre a versão mais recente deste arquivo. */
const ELN_FRONTEND_URL = 'https://raw.githubusercontent.com/catarinamaia-codigom/UBS-el-nino-workshop/main/index.html';

/** Endereço público do formulário no GitHub Pages (usado em mensagens e no link de fallback). */
const ELN_GITHUB_PAGES_URL = 'https://catarinamaia-codigom.github.io/UBS-el-nino-workshop/';

/**
 * OPCIONAL. Deixe vazio quando o script foi criado pela própria planilha (recomendado).
 * Preencha somente se usar um projeto Apps Script independente.
 */
const ELN_PLANILHA_ID = '';

/** Duração da sessão do painel após o login (horas). */
const ELN_SESSAO_HORAS = 12;

/** Limite de envios por minuto (proteção simples contra abuso do link público). */
const ELN_LIMITE_POR_MINUTO = 60;
