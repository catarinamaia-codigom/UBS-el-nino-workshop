/**
 * EL NIÑO É PAUTA DE SAÚDE — Escuta da USF · Servidor (Google Apps Script + Google Sheets)
 *
 * A planilha é o banco de dados. Abas:
 *   Respostas · Versoes · Historico_Questionario · Perguntas · Comentarios · Acessos
 *   Topicos · Materiais · Diagnosticos · Parametros · Auditoria · Instrucoes
 *
 * Premissa (igual à pesquisa do Córrego da Bica): nenhuma resposta se perde quando o questionário muda.
 *   - códigos de perguntas e alternativas são permanentes;
 *   - o que sai do formulário é ARQUIVADO (o servidor recoloca, arquivado, tudo o que faltar);
 *   - cada publicação é uma nova edição na aba Versoes, com o histórico na aba Historico_Questionario;
 *   - colunas da aba Respostas nunca são apagadas; cada resposta grava a edição em que foi dada.
 *
 * Instalação (uma vez, pela conta dona da planilha):
 *   1. Na planilha: Extensões > Apps Script. Apague o conteúdo do arquivo Código.gs e cole ESTE arquivo inteiro.
 *   2. Salve, escolha a função configurarElNino e clique em Executar (autorize). Ela cria as abas e grava
 *      o questionário (edição 1), os tópicos e os materiais. Não apaga nada que já exista.
 *   3. Implantar > Nova implantação > App da Web · Executar como: Eu · Quem pode acessar: Qualquer pessoa.
 *   4. Cole a URL /exec na constante API_URL do index.html no GitHub.
 */

/* ============================== CONFIGURAÇÃO ============================== */

/** Versão do servidor. */
const ELN_VERSAO = '3.0';

/** Nome exibido no título da planilha e nas mensagens. */
const ELN_TITULO = 'EL NIÑO É PAUTA DE SAÚDE — ESCUTA DA USF';

/** Nome da unidade quando o link não traz ?ubs=Nome. Pode ser alterado na aba Parametros (UBS_PADRAO). */
const ELN_UBS_PADRAO = 'USF parceira';

/** Endereço do index.html no GitHub. O Apps Script exibe sempre a versão mais recente deste arquivo. */
const ELN_FRONTEND_URL = 'https://raw.githubusercontent.com/catarinamaia-codigom/UBS-el-nino-workshop/main/index.html';

/** Endereço público do formulário no GitHub Pages. */
const ELN_GITHUB_PAGES_URL = 'https://catarinamaia-codigom.github.io/UBS-el-nino-workshop/';

/** OPCIONAL. Vazio quando o script foi criado pela própria planilha (recomendado). */
const ELN_PLANILHA_ID = '';

/** Duração da sessão do painel após o login (horas). */
const ELN_SESSAO_HORAS = 12;

/** Limite de envios por minuto (proteção simples contra abuso do link público). */
const ELN_LIMITE_POR_MINUTO = 60;

/** Limite total dos anexos de um envio (MB). */
const ELN_MAX_ANEXOS_MB = 10;

/* ============================== SERVIDOR ============================== */

const ELN_SECRET_PROP = 'ELN_SECRET_V1';
const ELN_SS_PROP = 'ELN_SS_ID';
const ELN_ABAS = {RESP: 'Respostas', VERS: 'Versoes', HIST: 'Historico_Questionario', PERG: 'Perguntas', COM: 'Comentarios', ACESSOS: 'Acessos',
  TOP: 'Topicos', MAT: 'Materiais', DIAG: 'Diagnosticos', PARAM: 'Parametros', AUD: 'Auditoria', INSTR: 'Instrucoes'};
const ELN_CAB = {
  Respostas: ['id_resposta', 'recebido_em', 'usf', 'edicao', 'modo', 'origem', 'duracao_seg', 'request_id'],
  Versoes: ['edicao', 'publicado_em', 'publicado_por', 'nota', 'json'],
  Historico_Questionario: ['quando', 'edicao', 'autor', 'pergunta', 'acao', 'resumo'],
  Perguntas: ['edicao', 'etapa', 'ordem', 'codigo', 'tipo', 'pergunta', 'opcoes', 'obrigatoria', 'situacao'],
  Comentarios: ['id', 'quando', 'edicao', 'alvo', 'alvo_texto', 'autor', 'comentario', 'status', 'resolvido_por', 'resolvido_em'],
  Acessos: ['login', 'senha', 'perfil', 'nome', 'ativo', 'criado_em', 'observacao'],
  Topicos: ['id', 'bloco', 'ordem', 'titulo', 'essencial', 'resumo', 'pontos', 'frase', 'recife', 'gatilhos', 'materiais', 'ativo', 'atualizado_em', 'atualizado_por'],
  Materiais: ['id', 'titulo', 'tipo', 'url', 'descricao', 'uso', 'topicos', 'origem', 'usf', 'status', 'enviado_em', 'enviado_por'],
  Diagnosticos: ['id', 'usf', 'publicado_em', 'publicado_por', 'json'],
  Parametros: ['chave', 'valor', 'descricao'],
  Auditoria: ['quando', 'login', 'acao', 'detalhe']
};
const ELN_META = ELN_CAB.Respostas;
const ELN_TIPOS = ['usf', 'estrelas', 'escala', 'unica', 'multipla', 'texto', 'link', 'arquivo'];
const ELN_ICONES = ['perfil', 'escutar', 'diagnosticar', 'verificar', 'direcionar', 'cocriar', 'validar', 'ouvir'];

/* ============================== ENTRADAS ============================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.api === 'ping') return elnJsonOut_({ok: true, data: elnPing_()});
  let out = null;
  try { out = HtmlService.createHtmlOutput(elnFrontendHtml_()); } catch (err) { console.warn('Interface do GitHub indisponível: ' + err); }
  if (!out) {
    out = HtmlService.createHtmlOutput('<div style="font:15px system-ui;padding:40px;max-width:560px"><h2>El Niño é pauta de saúde</h2>' +
      '<p>Não foi possível carregar o formulário agora. Tente de novo em instantes ou abra a versão publicada:</p>' +
      '<p><a target="_blank" href="' + ELN_GITHUB_PAGES_URL + '">' + ELN_GITHUB_PAGES_URL + '</a></p></div>');
  }
  return out.setTitle('Escuta da USF · El Niño é pauta de saúde').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return elnJsonOut_({ok: false, error: 'Requisição inválida.'}); }
  return elnJsonOut_(elninoApi(req));
}

/** API usada pela versão aberta dentro do Apps Script (google.script.run.elninoApi). */
function elninoApi(req) {
  try {
    const data = elnRoute_(req || {});
    return JSON.parse(JSON.stringify({ok: true, data: data}));
  } catch (err) {
    console.warn((req && req.op) + ' → ' + (err && err.stack || err));
    return {ok: false, error: String(err && err.message || err)};
  }
}

function elnRoute_(req) {
  switch (req.op) {
    /* públicas */
    case 'ping': return elnPing_();
    case 'enviar': return elnEnviar_(req);
    case 'comentar': return elnComentar_(req);
    case 'comentarios': return elnComentariosPub_();
    case 'banco_pub': return elnBanco_(false);
    case 'diagnostico': return elnDiagnostico_(req);
    case 'login': return elnLogin_(req);
    /* coordenação */
    case 'sair': elnAuth_(req.token); return {ok: true};
    case 'resultados': return elnResultados_(req);
    case 'comentarios_todos': elnAuth_(req.token); return {lista: elnComentariosLista_()};
    case 'banco': elnAuth_(req.token); return elnBanco_(true);
    case 'material_salvar': return elnMaterialSalvar_(req);
    case 'diagnostico_publicar': return elnDiagnosticoPublicar_(req);
    case 'historico': elnAuth_(req.token); return {lista: elnHistorico_()};
    /* administração */
    case 'publicar': return elnPublicar_(req);
    case 'comentario_status': return elnComentarioStatus_(req);
    case 'topico_salvar': return elnTopicoSalvar_(req);
    case 'parametros_salvar': return elnParametrosSalvar_(req);
    default: throw new Error('Operação desconhecida.');
  }
}

function elnJsonOut_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function elnFrontendHtml_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('eln_front_n') || 0);
  if (n > 0) {
    const keys = Array.from({length: n}, (_, i) => 'eln_front_' + i), parts = cache.getAll(keys);
    if (keys.every(k => parts[k] != null)) return keys.map(k => parts[k]).join('');
  }
  const res = UrlFetchApp.fetch(ELN_FRONTEND_URL + '?v=' + Math.floor(Date.now() / 300000), {muteHttpExceptions: true, followRedirects: true});
  if (res.getResponseCode() !== 200) throw new Error('GitHub respondeu ' + res.getResponseCode());
  const html = res.getContentText('UTF-8');
  elnAssert_(/<html/i.test(html), 'Conteúdo inesperado recebido do GitHub.');
  const size = 45000, chunks = {};
  let count = 0;
  for (let i = 0; i < html.length; i += size) chunks['eln_front_' + (count++)] = html.slice(i, i + size);
  chunks.eln_front_n = String(count);
  try { cache.putAll(chunks, 300); } catch (err) { /* cache é opcional */ }
  return html;
}

/** Execute no editor para o Apps Script buscar agora a versão mais nova do GitHub. */
function atualizarInterfaceElNino() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(['eln_front_n'].concat(Array.from({length: 40}, (_, i) => 'eln_front_' + i)));
  const html = elnFrontendHtml_();
  console.log('Interface atualizada a partir do GitHub (' + html.length + ' caracteres).');
  return html.length;
}

/* ============================== UTILITÁRIOS ============================== */

function elnNow_() { return Utilities.formatDate(new Date(), 'America/Recife', "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function elnId_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }
function elnClean_(x, max) { return String(x === null || x === undefined ? '' : x).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, max || 500); }
function elnAssert_(value, message) { if (!value) throw new Error(message); }
function elnLock_(fn) { const l = LockService.getScriptLock(); l.waitLock(28000); try { return fn(); } finally { l.releaseLock(); } }
function elnTrue_(v) { if (v === true) return true; const s = String(v === null || v === undefined ? '' : v).trim().toLowerCase(); return s === 'true' || s === 'verdadeiro' || s === 'sim' || s === '1'; }
function elnVal_(v) { return v instanceof Date ? (isNaN(v.getTime()) ? '' : Utilities.formatDate(v, 'America/Recife', "yyyy-MM-dd'T'HH:mm:ssXXX")) : v; }
function elnSecret_() {
  const s = PropertiesService.getScriptProperties().getProperty(ELN_SECRET_PROP);
  elnAssert_(s, 'O servidor ainda não foi configurado. Execute configurarElNino() no editor do Apps Script.');
  return s;
}
function elnDigest_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)).replace(/=+$/, ''); }
function elnHmac_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(text), elnSecret_(), Utilities.Charset.UTF_8)).replace(/=+$/, ''); }
function elnEqual_(a, b) { a = String(a); b = String(b); let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return !diff; }
function elnNovaSenha_() { return 'ElNino-' + String(Math.floor(100000 + Math.random() * 900000)); }
/** Evita que textos digitados virem fórmulas na planilha. */
function elnCell_(v) { if (v === null || v === undefined) return ''; if (typeof v === 'number' || typeof v === 'boolean') return v; const s = String(v); return /^[=+@\-]/.test(s) ? "'" + s : s; }
function elnCodigo_(v) { return /^[a-z][a-z0-9_]{0,39}$/.test(String(v || '')); }
function elnSoNegrito_(html) { return String(html || '').replace(/<(?!\/?b>)[^>]*>/gi, '').slice(0, 600); }
function elnRate_(chave, limite) {
  const cache = CacheService.getScriptCache();
  const k = 'eln_rate_' + chave + '_' + Math.floor(Date.now() / 60000);
  const usados = Number(cache.get(k) || 0);
  elnAssert_(usados < limite, 'Muitos envios ao mesmo tempo. Tente de novo em 1 minuto.');
  cache.put(k, String(usados + 1), 120);
}

/* ============================== PLANILHA ============================== */

function elnSs_() {
  if (ELN_PLANILHA_ID) return SpreadsheetApp.openById(ELN_PLANILHA_ID);
  const id = PropertiesService.getScriptProperties().getProperty(ELN_SS_PROP);
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  elnAssert_(ss, 'Planilha não encontrada. Execute configurarElNino() pelo editor aberto a partir da planilha.');
  return ss;
}
function elnAba_(nome) { const sh = elnSs_().getSheetByName(nome); elnAssert_(sh, 'Aba ' + nome + ' não encontrada. Execute configurarElNino().'); return sh; }
function elnCabecalho_(sh) { const lc = sh.getLastColumn(); return lc ? sh.getRange(1, 1, 1, lc).getValues()[0].map(String) : []; }
function elnRows_(nome) {
  const sh = elnSs_().getSheetByName(nome); if (!sh || sh.getLastRow() < 2) return [];
  const cab = elnCabecalho_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().map((r, i) => { const o = {_linha: i + 2}; cab.forEach((c, j) => { if (c) o[c] = elnVal_(r[j]); }); return o; });
}
function elnAppendObj_(nome, obj) {
  const sh = elnAba_(nome); const cab = elnCabecalho_(sh);
  sh.appendRow(cab.map(c => elnCell_(c in obj ? obj[c] : '')));
}
function elnSetRow_(nome, linha, obj) {
  const sh = elnAba_(nome); const cab = elnCabecalho_(sh);
  const atual = sh.getRange(linha, 1, 1, cab.length).getValues()[0];
  sh.getRange(linha, 1, 1, cab.length).setValues([cab.map((c, j) => c in obj ? elnCell_(obj[c]) : atual[j])]);
}
function elnParametros_() {
  const out = {};
  elnRows_(ELN_ABAS.PARAM).forEach(r => { if (r.chave) out[String(r.chave).trim()] = r.valor; });
  return out;
}
function elnSetParametro_(chave, valor, descricao) {
  const r = elnRows_(ELN_ABAS.PARAM).find(x => String(x.chave).trim() === chave);
  if (r) elnSetRow_(ELN_ABAS.PARAM, r._linha, {valor: valor});
  else elnAppendObj_(ELN_ABAS.PARAM, {chave: chave, valor: valor, descricao: descricao || ''});
}
function elnAuditoria_(login, acao, detalhe) {
  try { elnAppendObj_(ELN_ABAS.AUD, {quando: elnNow_(), login: login || '', acao: acao, detalhe: String(detalhe || '').slice(0, 400)}); } catch (e) { /* opcional */ }
}
function elnUrlPlanilha_() { try { return elnSs_().getUrl(); } catch (e) { return ''; } }
function elnUrlApp_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

/* ============================== QUESTIONÁRIO ============================== */

function elnQzAtual_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('eln_qz');
  if (c) { try { return JSON.parse(c); } catch (e) { /* segue */ } }
  const vs = elnRows_(ELN_ABAS.VERS).filter(v => Number(v.edicao) > 0 && v.json);
  if (!vs.length) return null;
  vs.sort((a, b) => Number(a.edicao) - Number(b.edicao));
  const v = vs[vs.length - 1];
  const qz = JSON.parse(String(v.json));
  qz.edicao = Number(v.edicao);
  try { const s = JSON.stringify(qz); if (s.length < 95000) cache.put('eln_qz', s, 600); } catch (e) { /* opcional */ }
  return qz;
}
function elnIdsQz_(qz) { const m = {}; if (qz) qz.etapas.forEach(et => (et.perguntas || []).forEach(q => { m[q.id] = q; })); return m; }

function elnValidaQz_(qz) {
  elnAssert_(qz && Array.isArray(qz.etapas) && qz.etapas.length >= 1 && qz.etapas.length <= 12, 'Questionário inválido (etapas).');
  const ids = {};
  const etapas = qz.etapas.map((et, i) => {
    elnAssert_(elnCodigo_(et.id), 'Código de etapa inválido.');
    const e = {id: et.id, num: i, nome: elnClean_(et.nome, 40) || ('Etapa ' + i), sub: elnClean_(et.sub, 120), icone: ELN_ICONES.indexOf(et.icone) >= 0 ? et.icone : 'validar', intro: elnSoNegrito_(et.intro), perguntas: []};
    elnAssert_(Array.isArray(et.perguntas) && et.perguntas.length <= 60, 'Etapa com perguntas demais.');
    e.perguntas = et.perguntas.map(q => {
      elnAssert_(elnCodigo_(q.id) && !ids[q.id] && ELN_META.indexOf(q.id) < 0, 'Código de pergunta inválido ou repetido: ' + q.id);
      elnAssert_(ELN_TIPOS.indexOf(q.tipo) >= 0, 'Tipo inválido em ' + q.id);
      ids[q.id] = true;
      const o = {id: q.id, tipo: q.tipo, texto: elnClean_(q.texto, 400), curto: elnClean_(q.curto, 80) || elnClean_(q.texto, 60)};
      elnAssert_(o.texto.length >= 3, 'Pergunta sem texto: ' + q.id);
      if (q.ajuda) o.ajuda = elnClean_(q.ajuda, 300);
      if (q.obrig) o.obrig = true;
      if (q.cols) o.cols = true;
      if (q.arquivada) o.arquivada = true;
      if (q.desde) o.desde = Math.max(1, Math.floor(Number(q.desde)) || 1);
      if (q.tipo === 'multipla' && Number(q.max) > 0) o.max = Math.min(20, Math.floor(Number(q.max)));
      if (q.exclusiva && elnCodigo_(q.exclusiva)) o.exclusiva = q.exclusiva;
      if ((q.tipo === 'escala' || q.tipo === 'estrelas')) o.ext = [elnClean_((q.ext || [])[0], 30) || 'Pouco', elnClean_((q.ext || [])[1], 30) || 'Muito'];
      if (q.par && elnCodigo_(q.par.com)) o.par = {com: q.par.com, nome: elnClean_(q.par.nome, 60)};
      if (q.se && elnCodigo_(q.se.q) && Array.isArray(q.se.em)) o.se = {q: q.se.q, em: q.se.em.filter(elnCodigo_).slice(0, 30)};
      if (q.tipo === 'unica' || q.tipo === 'multipla') {
        const vs = {};
        o.opcoes = (q.opcoes || []).slice(0, 40).map(op => {
          const v = Array.isArray(op) ? op[0] : op.v, t = Array.isArray(op) ? op[1] : op.t;
          elnAssert_(/^[a-z0-9][a-z0-9_]{0,39}$/.test(String(v || '')) && !vs[v], 'Código de alternativa inválido ou repetido em ' + q.id);
          vs[v] = true;
          const x = {v: v, t: elnClean_(t, 160) || v};
          if (!Array.isArray(op) && op.arquivada) x.arquivada = true;
          return x;
        });
        elnAssert_(o.opcoes.some(x => !x.arquivada) || o.arquivada, 'A pergunta ' + q.id + ' precisa de alternativas.');
      }
      return o;
    });
    return e;
  });
  elnAssert_(Object.keys(ids).length >= 1, 'Questionário vazio.');
  return {etapas: etapas};
}

/** Recoloca (arquivado) tudo o que existia na edição anterior e faltou na nova. Nada se perde. */
function elnMesclaArquivados_(ant, novo, historico) {
  if (!ant) return novo;
  const novoIds = elnIdsQz_(novo);
  ant.etapas.forEach(etA => {
    (etA.perguntas || []).forEach(qa => {
      const qn = novoIds[qa.id];
      if (!qn) {
        const destino = novo.etapas.find(e => e.id === etA.id) || novo.etapas[novo.etapas.length - 1];
        const copia = JSON.parse(JSON.stringify(qa)); copia.arquivada = true;
        destino.perguntas.push(copia); novoIds[qa.id] = copia;
        if (!qa.arquivada) historico.push([qa.id, 'ARQUIVADA', 'Pergunta “' + qa.curto + '” saiu do formulário (preservada como arquivada)']);
        return;
      }
      elnAssert_(qn.tipo === qa.tipo, 'O tipo da pergunta ' + qa.id + ' não pode mudar depois de publicada. Arquive e crie outra.');
      if (qa.opcoes) {
        qn.opcoes = qn.opcoes || [];
        qa.opcoes.forEach(oa => {
          if (!qn.opcoes.some(o => o.v === oa.v)) { qn.opcoes.push({v: oa.v, t: oa.t, arquivada: true}); if (!oa.arquivada) historico.push([qa.id, 'ALTERNATIVA_ARQUIVADA', '“' + oa.t + '” saiu de “' + qn.curto + '” (preservada)']); }
        });
      }
    });
  });
  return novo;
}
function elnDiff_(ant, novo, historico) {
  const a = elnIdsQz_(ant);
  const ordem = z => z.etapas.map(e => e.id + ':' + e.perguntas.filter(q => !q.arquivada).map(q => q.id).join(',')).join('|');
  novo.etapas.forEach(et => et.perguntas.forEach(q => {
    const x = a[q.id];
    if (!x) { historico.push([q.id, 'INCLUIDA', 'Incluída “' + q.curto + '” (' + q.tipo + ') na etapa ' + et.nome]); return; }
    if (x.arquivada && !q.arquivada) historico.push([q.id, 'RESTAURADA', 'Voltou ao formulário: “' + q.curto + '”']);
    if (!x.arquivada && q.arquivada && !historico.some(h => h[0] === q.id && h[1] === 'ARQUIVADA')) historico.push([q.id, 'ARQUIVADA', 'Arquivada: “' + q.curto + '” (respostas preservadas)']);
    if (x.texto !== q.texto) historico.push([q.id, 'TEXTO', 'Texto alterado: “' + x.texto + '” → “' + q.texto + '”']);
    if (!!x.obrig !== !!q.obrig) historico.push([q.id, 'OBRIGATORIEDADE', (q.obrig ? 'Passou a ser obrigatória: ' : 'Deixou de ser obrigatória: ') + q.curto]);
    if (JSON.stringify(x.se || null) !== JSON.stringify(q.se || null)) historico.push([q.id, 'CONDICAO', 'Condição de exibição alterada em “' + q.curto + '”']);
    if ((x.max || 0) !== (q.max || 0)) historico.push([q.id, 'MAXIMO', 'Máximo de escolhas de “' + q.curto + '”: ' + (x.max || 'sem limite') + ' → ' + (q.max || 'sem limite')]);
    (q.opcoes || []).forEach(o => {
      const ox = (x.opcoes || []).find(y => y.v === o.v);
      if (!ox) historico.push([q.id, 'ALTERNATIVA_INCLUIDA', '“' + o.t + '” em “' + q.curto + '”']);
      else if (ox.t !== o.t) historico.push([q.id, 'ALTERNATIVA_TEXTO', '“' + ox.t + '” → “' + o.t + '”']);
      else if (ox.arquivada && !o.arquivada) historico.push([q.id, 'ALTERNATIVA_RESTAURADA', '“' + o.t + '” voltou a “' + q.curto + '”']);
      else if (!ox.arquivada && o.arquivada && !historico.some(h => h[0] === q.id && h[1] === 'ALTERNATIVA_ARQUIVADA' && h[2].indexOf(o.t) >= 0)) historico.push([q.id, 'ALTERNATIVA_ARQUIVADA', '“' + o.t + '” arquivada em “' + q.curto + '”']);
    });
  }));
  if (ant && ordem(ant) !== ordem(novo)) historico.push(['', 'ORDEM', 'Ordem de etapas ou perguntas alterada']);
  if (ant) novo.etapas.forEach(e => { const ea = ant.etapas.find(x => x.id === e.id); if (!ea) historico.push(['etapa:' + e.id, 'ETAPA_INCLUIDA', 'Nova etapa: ' + e.nome]); else if (ea.nome !== e.nome || (ea.sub || '') !== e.sub || (ea.intro || '') !== e.intro) historico.push(['etapa:' + e.id, 'ETAPA_TEXTO', 'Textos da etapa ' + e.nome + ' alterados']); });
}
function elnPublicar_(req) {
  const acc = elnAuth_(req.token, 'admin');
  const novo = elnValidaQz_(req.questionario);
  return elnLock_(() => {
    const ant = elnQzAtual_();
    const hist = [];
    elnMesclaArquivados_(ant, novo, hist);
    elnDiff_(ant, novo, hist);
    elnAssert_(!ant || hist.length, 'Nada mudou em relação à edição publicada.');
    const todas = elnIdsQz_(novo);
    elnAssert_(Object.keys(todas).some(k => todas[k].tipo === 'usf' && !todas[k].arquivada), 'O questionário precisa manter a pergunta do nome da USF.');
    const edicao = (ant ? Number(ant.edicao) : 0) + 1;
    novo.edicao = edicao;
    const json = JSON.stringify(novo);
    elnAssert_(json.length < 49000, 'Questionário grande demais para uma célula da planilha.');
    elnAppendObj_(ELN_ABAS.VERS, {edicao: edicao, publicado_em: elnNow_(), publicado_por: acc.login, nota: elnClean_(req.nota, 300), json: json});
    const quando = elnNow_();
    if (!hist.length) hist.push(['', 'PUBLICADA', 'Edição inicial publicada']);
    const sh = elnAba_(ELN_ABAS.HIST);
    hist.forEach(h => sh.appendRow([quando, edicao, acc.login, h[0], h[1], elnCell_(String(h[2]).slice(0, 500))]));
    elnEscreveDicionario_(novo);
    CacheService.getScriptCache().remove('eln_qz');
    elnAuditoria_(acc.login, 'PUBLICAR', 'edição ' + edicao + ' · ' + hist.length + ' mudanças');
    return {questionario: novo, historico: elnHistorico_()};
  });
}
function elnEscreveDicionario_(qz) {
  const sh = elnAba_(ELN_ABAS.PERG);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, ELN_CAB.Perguntas.length).clearContent();
  const linhas = [];
  qz.etapas.forEach(et => et.perguntas.forEach((q, i) => linhas.push([qz.edicao, et.nome, i + 1, q.id, q.tipo, elnCell_(q.texto),
    elnCell_(q.opcoes ? q.opcoes.map(o => o.v + ' = ' + o.t + (o.arquivada ? ' (arquivada)' : '')).join(' | ') : (q.ext ? '1 = ' + q.ext[0] + ' … 5 = ' + q.ext[1] : '')),
    q.obrig ? 'sim' : 'não', q.arquivada ? 'arquivada' : 'ativa'])));
  if (linhas.length) sh.getRange(2, 1, linhas.length, ELN_CAB.Perguntas.length).setValues(linhas);
}
function elnHistorico_() {
  return elnRows_(ELN_ABAS.HIST).slice(-200).reverse().map(r => ({quando: r.quando, edicao: r.edicao, autor: r.autor, pergunta: r.pergunta, acao: r.acao, resumo: r.resumo}));
}

/* ============================== OPERAÇÕES PÚBLICAS ============================== */

function elnPing_() {
  const p = elnParametros_();
  return {versao: ELN_VERSAO, titulo: ELN_TITULO, ubs_padrao: String(p.UBS_PADRAO || ELN_UBS_PADRAO),
    form_aberto: p.FORM_ABERTO === undefined || p.FORM_ABERTO === '' ? true : elnTrue_(p.FORM_ABERTO),
    modo_validacao: elnTrue_(p.MODO_VALIDACAO),
    usfs: String(p.USFS || '').split(/[\n;]+/).map(s => s.trim()).filter(Boolean).slice(0, 200),
    url_app: elnUrlApp_(), questionario: elnQzAtual_()};
}

function elnPastaUploads_() {
  const p = elnParametros_();
  if (p.PASTA_UPLOADS_ID) { try { return DriveApp.getFolderById(String(p.PASTA_UPLOADS_ID)); } catch (e) { /* recria */ } }
  const pasta = DriveApp.createFolder('El Niño · materiais enviados pelas equipes');
  try { const pai = DriveApp.getFileById(elnSs_().getId()).getParents(); if (pai.hasNext()) pasta.moveTo(pai.next()); } catch (e) { /* fica na raiz */ }
  elnSetParametro_('PASTA_UPLOADS_ID', pasta.getId(), 'Pasta do Drive onde ficam os arquivos enviados pelo formulário.');
  return pasta;
}

/** Recebe uma resposta anônima do formulário (com anexos opcionais). Não exige login. */
function elnEnviar_(req) {
  const p = elnParametros_();
  elnAssert_(p.FORM_ABERTO === undefined || p.FORM_ABERTO === '' || elnTrue_(p.FORM_ABERTO), 'O formulário está encerrado.');
  const rid = String(req.request_id || '');
  elnAssert_(/^[A-Za-z0-9-]{8,64}$/.test(rid), 'Envio inválido (identificador).');
  const resp = req.respostas;
  elnAssert_(resp && typeof resp === 'object' && !Array.isArray(resp), 'Envio inválido (respostas).');
  const qz = elnQzAtual_();
  const conhecidas = qz ? elnIdsQz_(qz) : null;
  const chaves = Object.keys(resp);
  elnAssert_(chaves.length > 0 && chaves.length <= 120, 'Envio inválido (quantidade de respostas).');
  elnAssert_(JSON.stringify(resp).length < 40000, 'Envio inválido (tamanho).');
  const limpas = {};
  chaves.forEach(k => {
    elnAssert_(elnCodigo_(k) && ELN_META.indexOf(k) < 0, 'Envio inválido (pergunta ' + k + ').');
    const base = k.replace(/_outro$/, '');
    if (conhecidas) elnAssert_(conhecidas[k] || conhecidas[base], 'Envio inválido: a pergunta ' + k + ' não existe no questionário.');
    const v = resp[k];
    if (Array.isArray(v)) { elnAssert_(v.length <= 20 && v.every(x => /^[a-z0-9][a-z0-9_]{0,39}$/.test(String(x))), 'Envio inválido (opções de ' + k + ').'); limpas[k] = v.map(String).join(' | '); }
    else if (typeof v === 'number') { elnAssert_(isFinite(v) && v >= 0 && v <= 1000, 'Envio inválido (número em ' + k + ').'); limpas[k] = v; }
    else limpas[k] = elnClean_(v, 1500);
    const q = conhecidas && conhecidas[k];
    if (q && q.tipo === 'link' && limpas[k]) elnAssert_(/^https?:\/\//i.test(limpas[k]), 'O link deve começar com https://');
  });
  const arquivos = Array.isArray(req.arquivos) ? req.arquivos : [];
  elnAssert_(arquivos.length <= 3, 'Envie no máximo 3 arquivos.');
  let bytes = 0;
  const blobs = arquivos.map(a => {
    elnAssert_(a && elnCodigo_(a.q) && (!conhecidas || (conhecidas[a.q] && conhecidas[a.q].tipo === 'arquivo')), 'Anexo inválido.');
    const dados = Utilities.base64Decode(String(a.base64 || ''));
    bytes += dados.length;
    const nome = elnClean_(a.nome, 120).replace(/[\\/:*?"<>|]+/g, '_') || 'arquivo';
    return {q: a.q, nome: nome, blob: Utilities.newBlob(dados, String(a.tipo || 'application/octet-stream').slice(0, 100), nome)};
  });
  elnAssert_(bytes <= ELN_MAX_ANEXOS_MB * 1048576, 'Os anexos passam de ' + ELN_MAX_ANEXOS_MB + ' MB (grande demais).');
  elnRate_('enviar', ELN_LIMITE_POR_MINUTO);

  const usf = elnClean_(req.usf || limpas.usf_nome, 120) || String(p.UBS_PADRAO || ELN_UBS_PADRAO);
  return elnLock_(() => {
    const sh = elnAba_(ELN_ABAS.RESP);
    let cab = elnCabecalho_(sh);
    const colRid = cab.indexOf('request_id') + 1;
    if (colRid && sh.getLastRow() > 1) {
      const achou = sh.getRange(2, colRid, sh.getLastRow() - 1, 1).createTextFinder(rid).matchEntireCell(true).findNext();
      if (achou) return {duplicado: true, id: String(sh.getRange(achou.getRow(), 1).getValue())};
    }
    const agora = elnNow_();
    if (blobs.length) {
      const pasta = elnPastaUploads_();
      blobs.forEach(b => {
        b.blob.setName(agora.slice(0, 10) + ' · ' + usf + ' · ' + b.nome);
        const f = pasta.createFile(b.blob);
        const url = f.getUrl();
        limpas[b.q] = (limpas[b.q] ? limpas[b.q] + ' | ' : '') + url;
        elnAppendObj_(ELN_ABAS.MAT, {id: elnId_('MF'), titulo: b.nome, tipo: 'arquivo', url: url, descricao: 'Enviado pelo formulário', uso: 'referencia', topicos: '', origem: 'formulário', usf: usf, status: 'a revisar', enviado_em: agora, enviado_por: 'equipe (anônimo)'});
      });
    }
    if (conhecidas) Object.keys(limpas).forEach(k => {
      const q = conhecidas[k];
      if (q && q.tipo === 'link' && limpas[k]) elnAppendObj_(ELN_ABAS.MAT, {id: elnId_('ML'), titulo: 'Link sugerido pela equipe', tipo: 'link', url: limpas[k], descricao: q.curto, uso: 'referencia', topicos: '', origem: 'formulário', usf: usf, status: 'a revisar', enviado_em: agora, enviado_por: 'equipe (anônimo)'});
    });
    const novas = Object.keys(limpas).filter(k => cab.indexOf(k) < 0);
    if (novas.length) {
      sh.getRange(1, cab.length + 1, 1, novas.length).setValues([novas]).setFontWeight('bold').setBackground('#8b0c11').setFontColor('#ffffff');
      cab = cab.concat(novas);
    }
    const id = elnId_('R');
    const meta = {id_resposta: id, recebido_em: agora, usf: usf, edicao: Math.max(1, Math.floor(Number(req.edicao)) || 1), modo: req.modo === 'validacao' ? 'validacao' : 'oficial',
      origem: elnClean_(req.origem, 20), duracao_seg: Number(req.duracao_seg) > 0 ? Math.min(86400, Math.round(Number(req.duracao_seg))) : '', request_id: rid};
    sh.appendRow(cab.map(c => elnCell_(c in meta ? meta[c] : (c in limpas ? limpas[c] : ''))));
    return {id: id};
  });
}

/* ------------------------------ comentários de validação ------------------------------ */
function elnComentar_(req) {
  const p = elnParametros_();
  let autorLogin = '';
  if (req.token) { try { autorLogin = elnAuth_(req.token).login; } catch (e) { /* segue como público */ } }
  elnAssert_(autorLogin || elnTrue_(p.MODO_VALIDACAO), 'Os comentários estão fechados (a versão de validação foi encerrada).');
  const alvo = String(req.alvo || '');
  elnAssert_(/^(etapa:)?[a-z][a-z0-9_]{0,60}$/.test(alvo), 'Comentário inválido.');
  const texto = elnClean_(req.comentario, 1500);
  elnAssert_(texto.length >= 3, 'Escreva o comentário.');
  elnRate_('comentar', 30);
  const id = elnId_('C');
  elnAppendObj_(ELN_ABAS.COM, {id: id, quando: elnNow_(), edicao: Math.floor(Number(req.edicao)) || '', alvo: alvo, alvo_texto: elnClean_(req.alvo_texto, 300), autor: elnClean_(req.autor, 80) || autorLogin, comentario: texto, status: 'aberto'});
  return {id: id};
}
function elnComentariosLista_() {
  return elnRows_(ELN_ABAS.COM).map(r => ({id: r.id, quando: r.quando, edicao: r.edicao, alvo: r.alvo, alvo_texto: r.alvo_texto, autor: r.autor, comentario: r.comentario, status: r.status || 'aberto'}));
}
function elnComentariosPub_() {
  if (!elnTrue_(elnParametros_().MODO_VALIDACAO)) return {lista: []};
  return {lista: elnComentariosLista_()};
}
function elnComentarioStatus_(req) {
  const acc = elnAuth_(req.token, 'admin');
  const status = req.status === 'resolvido' ? 'resolvido' : 'aberto';
  const r = elnRows_(ELN_ABAS.COM).find(x => String(x.id) === String(req.id));
  elnAssert_(r, 'Comentário não encontrado.');
  elnSetRow_(ELN_ABAS.COM, r._linha, {status: status, resolvido_por: status === 'resolvido' ? acc.login : '', resolvido_em: status === 'resolvido' ? elnNow_() : ''});
  return {ok: true};
}

/* ------------------------------ banco de tópicos e materiais ------------------------------ */
function elnBanco_(completo) {
  const topicos = elnRows_(ELN_ABAS.TOP).filter(t => t.id && (completo || t.ativo === '' || elnTrue_(t.ativo))).map(t => { const o = Object.assign({}, t); delete o._linha; return o; });
  topicos.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  const materiais = elnRows_(ELN_ABAS.MAT).filter(m => m.id && (completo || (String(m.origem) !== 'formulário' && String(m.status) !== 'a revisar'))).map(m => { const o = Object.assign({}, m); delete o._linha; if (!completo) delete o.enviado_por; return o; });
  return {topicos: topicos, materiais: materiais};
}
function elnTopicoSalvar_(req) {
  const acc = elnAuth_(req.token, 'admin');
  const t = req.topico || {};
  const titulo = elnClean_(t.titulo, 160);
  elnAssert_(titulo.length >= 5, 'Escreva o título do tópico.');
  const dados = {bloco: elnClean_(t.bloco, 60) || 'Outros', titulo: titulo, essencial: t.essencial ? 'sim' : 'não', resumo: elnClean_(t.resumo, 600),
    pontos: (Array.isArray(t.pontos) ? t.pontos : String(t.pontos || '').split('\n')).map(x => elnClean_(x, 400)).filter(String).slice(0, 20).join('\n'),
    frase: elnClean_(t.frase, 240), recife: elnClean_(t.recife, 600), gatilhos: elnClean_(t.gatilhos, 600), materiais: elnClean_(t.materiais, 300),
    ativo: t.ativo === false ? 'não' : 'sim', atualizado_em: elnNow_(), atualizado_por: acc.login};
  return elnLock_(() => {
    const rows = elnRows_(ELN_ABAS.TOP);
    if (t.id) {
      const r = rows.find(x => String(x.id) === String(t.id));
      elnAssert_(r, 'Tópico não encontrado.');
      elnSetRow_(ELN_ABAS.TOP, r._linha, dados);
      elnAuditoria_(acc.login, 'TOPICO_EDITAR', t.id);
      return {id: t.id};
    }
    let n = rows.length + 1, id = 'T' + String(n).padStart(2, '0');
    while (rows.some(x => String(x.id) === id)) id = 'T' + String(++n).padStart(2, '0');
    dados.id = id; dados.ordem = n;
    elnAppendObj_(ELN_ABAS.TOP, dados);
    elnAuditoria_(acc.login, 'TOPICO_NOVO', id);
    return {id: id};
  });
}
function elnMaterialSalvar_(req) {
  const acc = elnAuth_(req.token);
  const m = req.material || {};
  const titulo = elnClean_(m.titulo, 200);
  elnAssert_(titulo.length >= 3, 'Escreva o título do material.');
  const url = elnClean_(m.url, 500);
  elnAssert_(!url || /^https?:\/\//i.test(url), 'O link deve começar com https://');
  const dados = {titulo: titulo, url: url, tipo: elnClean_(m.tipo, 20) || 'link', uso: m.uso === 'pre_workshop' ? 'pre_workshop' : 'referencia',
    status: ['aprovado', 'a revisar', 'a definir'].indexOf(m.status) >= 0 ? m.status : 'aprovado', descricao: elnClean_(m.descricao, 600), topicos: elnClean_(m.topicos, 200)};
  return elnLock_(() => {
    if (m.id) {
      const r = elnRows_(ELN_ABAS.MAT).find(x => String(x.id) === String(m.id));
      elnAssert_(r, 'Material não encontrado.');
      elnSetRow_(ELN_ABAS.MAT, r._linha, dados);
      elnAuditoria_(acc.login, 'MATERIAL_EDITAR', m.id);
      return {id: m.id};
    }
    const id = elnId_('M');
    elnAppendObj_(ELN_ABAS.MAT, Object.assign(dados, {id: id, origem: elnClean_(m.origem, 80) || acc.nome || acc.login, enviado_em: elnNow_(), enviado_por: acc.login}));
    elnAuditoria_(acc.login, 'MATERIAL_NOVO', id);
    return {id: id};
  });
}

/* ------------------------------ material diagnóstico publicado ------------------------------ */
function elnDiagnosticoPublicar_(req) {
  const acc = elnAuth_(req.token);
  const json = JSON.stringify(req.conteudo || {});
  elnAssert_(json.length > 20 && json.length < 49000, 'Material diagnóstico grande demais para publicar.');
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  elnAppendObj_(ELN_ABAS.DIAG, {id: id, usf: elnClean_(req.usf, 120), publicado_em: elnNow_(), publicado_por: acc.login, json: json});
  elnAuditoria_(acc.login, 'DIAGNOSTICO_PUBLICAR', elnClean_(req.usf, 120));
  return {id: id};
}
function elnDiagnostico_(req) {
  const id = String(req.id || '');
  elnAssert_(/^[a-f0-9]{16}$/.test(id), 'Material não encontrado.');
  const r = elnRows_(ELN_ABAS.DIAG).find(x => String(x.id) === id);
  elnAssert_(r, 'Material não encontrado.');
  return {conteudo: JSON.parse(String(r.json)), publicado_em: r.publicado_em};
}

/* ============================== ACESSO (coordenação e administração) ============================== */
function elnAcessos_() {
  return elnRows_(ELN_ABAS.ACESSOS).filter(a => String(a.login || '').trim()).map(a => ({login: String(a.login).trim().toLowerCase(), senha: String(a.senha), perfil: String(a.perfil || '').trim().toLowerCase() === 'admin' ? 'admin' : 'coordenacao', nome: String(a.nome || a.login), ativo: elnTrue_(a.ativo)}));
}
function elnLogin_(req) {
  const login = elnClean_(req.login, 60).toLowerCase(), senha = String(req.senha || '');
  elnAssert_(login && senha, 'Informe usuário e senha.');
  const cache = CacheService.getScriptCache(), chaveTent = 'eln_tent_' + elnDigest_(login).slice(0, 16);
  const tent = Number(cache.get(chaveTent) || 0);
  elnAssert_(tent < 8, 'Muitas tentativas. Aguarde 10 minutos.');
  const acc = elnAcessos_().find(a => a.login === login && a.ativo);
  if (!acc || !elnEqual_(acc.senha, senha)) {
    cache.put(chaveTent, String(tent + 1), 600);
    elnAuditoria_(login, 'LOGIN_FALHOU', '');
    throw new Error('Usuário ou senha incorretos.');
  }
  cache.remove(chaveTent);
  const exp = Date.now() + ELN_SESSAO_HORAS * 3600 * 1000;
  const corpo = Utilities.base64EncodeWebSafe(JSON.stringify({l: login, e: exp, v: elnDigest_(acc.senha + '|' + acc.perfil).slice(0, 12)}), Utilities.Charset.UTF_8).replace(/=+$/, '');
  elnAuditoria_(login, 'LOGIN', acc.perfil);
  return {token: corpo + '.' + elnHmac_(corpo), login: login, nome: acc.nome, perfil: acc.perfil, exp: exp, planilha_url: elnUrlPlanilha_()};
}
function elnAuth_(token, perfil) {
  const t = String(token || ''), i = t.lastIndexOf('.');
  elnAssert_(i > 0, 'Sessão inválida. Faça login de novo.');
  const corpo = t.slice(0, i), sig = t.slice(i + 1);
  elnAssert_(elnEqual_(elnHmac_(corpo), sig), 'Sessão inválida. Faça login de novo.');
  let dados;
  try { dados = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(corpo + '==='.slice((corpo.length + 3) % 4))).getDataAsString('UTF-8')); } catch (e) { throw new Error('Sessão inválida. Faça login de novo.'); }
  elnAssert_(dados && dados.e > Date.now(), 'Sessão expirada. Faça login de novo.');
  const acc = elnAcessos_().find(a => a.login === dados.l && a.ativo);
  elnAssert_(acc && elnDigest_(acc.senha + '|' + acc.perfil).slice(0, 12) === dados.v, 'Sessão encerrada (acesso alterado). Faça login de novo.');
  if (perfil === 'admin') elnAssert_(acc.perfil === 'admin', 'Somente administradores podem fazer isso.');
  return acc;
}

function elnResultados_(req) {
  const acc = elnAuth_(req.token);
  const sh = elnAba_(ELN_ABAS.RESP);
  const cab = elnCabecalho_(sh);
  const linhas = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues() : [];
  return {
    linhas: linhas.filter(r => String(r[0] || '').trim()).map(r => { const o = {}; cab.forEach((c, i) => { if (c) o[c] = elnVal_(r[i]); }); return o; }),
    total: linhas.length, login: acc.login, planilha_url: elnUrlPlanilha_(), url_app: elnUrlApp_(), questionario: elnQzAtual_()
  };
}
function elnParametrosSalvar_(req) {
  const acc = elnAuth_(req.token, 'admin');
  elnSetParametro_('MODO_VALIDACAO', req.modo_validacao ? 'sim' : 'não', 'sim = modo de validação (balão de comentário para todos; respostas marcadas como validação e fora dos resultados).');
  elnSetParametro_('FORM_ABERTO', req.form_aberto === false ? 'não' : 'sim', 'não = encerra o recebimento de respostas.');
  if (req.ubs_padrao !== undefined) elnSetParametro_('UBS_PADRAO', elnClean_(req.ubs_padrao, 120) || ELN_UBS_PADRAO, 'Nome da unidade quando o link não traz ?ubs=Nome.');
  if (Array.isArray(req.usfs)) elnSetParametro_('USFS', req.usfs.map(s => elnClean_(s, 120)).filter(String).slice(0, 200).join('\n'), 'USFs sugeridas no formulário (uma por linha).');
  elnAuditoria_(acc.login, 'PARAMETROS', JSON.stringify({validacao: !!req.modo_validacao, aberto: req.form_aberto !== false}));
  return {ok: true};
}

/* ============================== CONFIGURAÇÃO ============================== */

/** Execute uma vez no editor (e de novo depois de atualizar o código). Cria o que faltar; não apaga nada. */
function configurarElNino() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || (ELN_PLANILHA_ID ? SpreadsheetApp.openById(ELN_PLANILHA_ID) : null);
  elnAssert_(ss, 'Abra o editor pela planilha (Extensões > Apps Script) ou preencha ELN_PLANILHA_ID em Config.gs.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty(ELN_SS_PROP, ss.getId());
  if (!props.getProperty(ELN_SECRET_PROP)) props.setProperty(ELN_SECRET_PROP, Utilities.getUuid() + Utilities.getUuid());
  const laranja = {Acessos: 1, Auditoria: 1};
  if (!ss.getSheetByName(ELN_ABAS.RESP)) {
    const primeira = ss.getSheets()[0];
    if (primeira && primeira.getLastRow() === 0 && /^(sheet|página|planilha|pagina)\s*1$/i.test(primeira.getName())) primeira.setName(ELN_ABAS.RESP);
  }
  Object.keys(ELN_CAB).forEach(nome => {
    const cab = ELN_CAB[nome];
    let sh = ss.getSheetByName(nome);
    if (!sh) sh = ss.insertSheet(nome);
    const atual = elnCabecalho_(sh).filter(String);
    const faltam = cab.filter(c => atual.indexOf(c) < 0);
    if (!atual.length) sh.getRange(1, 1, 1, cab.length).setValues([cab]);
    else if (faltam.length) sh.getRange(1, atual.length + 1, 1, faltam.length).setValues([faltam]);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#8b0c11').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (laranja[nome]) sh.setTabColor('#e67e22');
  });
  const p = elnParametros_();
  const def = [['UBS_PADRAO', ELN_UBS_PADRAO, 'Nome da unidade quando o link não traz ?ubs=Nome.'], ['FORM_ABERTO', 'sim', 'não = encerra o recebimento de respostas.'],
    ['MODO_VALIDACAO', 'não', 'sim = modo de validação (balão de comentário para todos; respostas marcadas como validação e fora dos resultados).'], ['USFS', '', 'USFs sugeridas no formulário (uma por linha).']];
  def.forEach(d => { if (!(d[0] in p)) elnAppendObj_(ELN_ABAS.PARAM, {chave: d[0], valor: d[1], descricao: d[2]}); });
  /* dados iniciais: só entram se as abas estiverem vazias */
  const agora = elnNow_();
  if (!elnRows_(ELN_ABAS.VERS).some(v => v.json)) {
    const qz = JSON.parse(JSON.stringify(ELN_SEED.questionario)); qz.edicao = 1;
    elnAppendObj_(ELN_ABAS.VERS, {edicao: 1, publicado_em: agora, publicado_por: 'configuração', nota: 'Edição inicial (versão oficial)', json: JSON.stringify(qz)});
    elnAba_(ELN_ABAS.HIST).appendRow([agora, 1, 'configuração', '', 'PUBLICADA', 'Edição inicial publicada']);
    CacheService.getScriptCache().remove('eln_qz');
    elnEscreveDicionario_(qz);
  }
  if (!elnRows_(ELN_ABAS.TOP).length) {
    const linhas = ELN_SEED.topicos.map((t, i) => [t.id, t.bloco, i + 1, t.titulo, t.essencial ? 'sim' : 'não', t.resumo, t.pontos.join('\n'), t.frase, t.recife, t.gatilhos, t.materiais, 'sim', agora, 'configuração'].map(elnCell_));
    elnAba_(ELN_ABAS.TOP).getRange(2, 1, linhas.length, ELN_CAB.Topicos.length).setValues(linhas);
  }
  if (!elnRows_(ELN_ABAS.MAT).length) {
    const linhas = ELN_SEED.materiais.map(m => [m.id, m.titulo, m.tipo, m.url, m.descricao, m.uso, m.topicos, m.origem, '', m.status, agora, 'configuração'].map(elnCell_));
    elnAba_(ELN_ABAS.MAT).getRange(2, 1, linhas.length, ELN_CAB.Materiais.length).setValues(linhas);
  }
  const senhas = [];
  if (!elnAcessos_().length) {
    [['admin', 'admin', 'Administração'], ['coordenacao', 'coordenacao', 'Coordenação']].forEach(a => {
      const s = elnNovaSenha_(); senhas.push(a[0] + ' / ' + s);
      elnAppendObj_(ELN_ABAS.ACESSOS, {login: a[0], senha: s, perfil: a[1], nome: a[2], ativo: 'sim', criado_em: elnNow_(), observacao: 'Troque a senha aqui quando quiser.'});
    });
  }
  let instr = ss.getSheetByName(ELN_ABAS.INSTR);
  if (!instr) instr = ss.insertSheet(ELN_ABAS.INSTR);
  instr.clear();
  const linhas = [
    [ELN_TITULO],
    ['Esta planilha é o banco de dados do formulário de escuta, do painel e do Roteiro do Workshop.'],
    ['Respostas: uma linha por pessoa, com a edição do questionário em que respondeu. Não apague nem edite linhas; use filtros ou copie para outra aba.'],
    ['Múltipla escolha fica como códigos separados por " | ". O significado está na aba Perguntas (dicionário da edição atual).'],
    ['Versoes e Historico_Questionario: cada publicação feita na Montagem do app. Perguntas e alternativas retiradas ficam arquivadas, nunca apagadas.'],
    ['Comentarios: sugestões feitas no balão de cada pergunta durante a validação.'],
    ['Topicos e Materiais: banco de tópicos do workshop e das fontes. Podem ser editados aqui ou no app.'],
    ['Diagnosticos: Materiais Diagnósticos publicados (links enviados às equipes).'],
    ['Acessos: login, senha e perfil (admin ou coordenacao). Mude a senha ou escreva "não" em ativo para encerrar o acesso (a sessão cai na hora).'],
    ['Parametros: MODO_VALIDACAO (sim/não), FORM_ABERTO (sim/não), UBS_PADRAO e USFS.'],
    ['Abas em laranja guardam credenciais ou registros de acesso. Mantenha a planilha com compartilhamento Restrito.'],
    ['Formulário: ' + ELN_GITHUB_PAGES_URL + ' · para outra unidade, acrescente ?ubs=Nome%20da%20USF ao link.'],
    ['Versão do servidor: ' + ELN_VERSAO]
  ];
  instr.getRange(1, 1, linhas.length, 1).setValues(linhas);
  instr.getRange(1, 1).setFontWeight('bold').setFontSize(14).setFontColor('#8b0c11');
  instr.setColumnWidth(1, 980);
  CacheService.getScriptCache().remove('eln_qz');
  const qz = elnQzAtual_();
  const msg = 'Configuração concluída. ' + (senhas.length ? 'Acessos criados (também na aba Acessos): ' + senhas.join(' · ') : 'Acessos existentes mantidos.') + (qz ? ' Questionário: edição ' + qz.edicao + '.' : ' Ainda sem questionário publicado: o app usa a edição 1 embutida até a primeira publicação.');
  console.log(msg);
  return msg;
}

/** Mostra o estado da conexão sem alterar nada. */
function verificarElNino() {
  const ss = elnSs_();
  const qz = elnQzAtual_();
  const info = {planilha: ss.getName(), url: ss.getUrl(), abas: ss.getSheets().map(s => s.getName()), respostas: Math.max(0, elnAba_(ELN_ABAS.RESP).getLastRow() - 1),
    edicao: qz ? qz.edicao : 0, topicos: elnRows_(ELN_ABAS.TOP).length, materiais: elnRows_(ELN_ABAS.MAT).length, url_app: elnUrlApp_()};
  console.log(JSON.stringify(info, null, 2));
  return info;
}

/* ============================== DADOS INICIAIS ==============================
   Questionário (edição 1), banco de tópicos e materiais. configurarElNino() grava estes dados
   nas abas Versoes, Topicos e Materiais somente se elas estiverem vazias. Depois disso, a planilha manda. */
const ELN_SEED = {"questionario":{"edicao":1,"etapas":[{"id":"inicio","num":0,"nome":"Começo","sub":"de onde você fala","icone":"perfil","intro":"<b>Não pedimos nome, e-mail nem telefone.</b> Estas perguntas servem só para agrupar as respostas. Recortes com menos de 3 pessoas nunca aparecem no painel.","perguntas":[{"id":"usf_nome","tipo":"usf","obrig":true,"texto":"Qual é a USF (ou UBS) em que você trabalha?","ajuda":"Escreva o nome como a equipe costuma chamar a unidade.","curto":"USF"},{"id":"funcao","tipo":"unica","obrig":true,"cols":true,"texto":"Qual é a sua função na unidade?","curto":"Função na unidade","opcoes":[{"v":"acs","t":"Agente comunitário(a) de saúde (ACS)"},{"v":"enfermeiro","t":"Enfermeiro(a)"},{"v":"tecnico_enf","t":"Técnico(a) ou auxiliar de enfermagem"},{"v":"medico","t":"Médico(a)"},{"v":"saude_bucal","t":"Saúde bucal (dentista, ASB, TSB)"},{"v":"emulti","t":"Equipe multiprofissional (eMulti)"},{"v":"acolhimento","t":"Recepção, acolhimento ou administrativo"},{"v":"gestao","t":"Gestão ou coordenação"},{"v":"residente","t":"Residente ou estagiário(a)"},{"v":"outra","t":"Outra"}]},{"id":"tempo","tipo":"unica","obrig":true,"texto":"Há quanto tempo você atua nesta unidade?","curto":"Tempo na unidade","opcoes":[{"v":"ate1","t":"Até 1 ano"},{"v":"1a5","t":"De 1 a 5 anos"},{"v":"mais5","t":"Mais de 5 anos"}]},{"id":"p0_preocupacao","tipo":"estrelas","obrig":true,"texto":"Pensando no El Niño e no calor que vem aí, o quanto você se sente preocupado(a) com os seus pacientes e usuários?","ajuda":"Toque nas estrelas: 1 = pouco preocupado(a), 5 = muito preocupado(a).","curto":"Preocupação com pacientes e usuários","ext":["Pouco","Muito"]}]},{"id":"escutar","num":1,"nome":"Escutar","sub":"o que a equipe diz que conhece","icone":"escutar","intro":"Responda pelo que você sente <b>hoje</b>. Não existe resposta certa: estamos medindo o ponto de partida da equipe, <b>não avaliando ninguém</b>.","perguntas":[{"id":"e1_elnino","tipo":"escala","obrig":true,"texto":"Você se considera familiarizado(a) com o tema El Niño?","curto":"Familiaridade com o El Niño","ext":["Nada","Muito"]},{"id":"e2_calor_geral","tipo":"escala","obrig":true,"texto":"E com os efeitos do calor extremo na saúde, de modo geral?","curto":"Efeitos do calor na saúde (geral)","ext":["Nada","Muito"]},{"id":"e3_calor_ubs","tipo":"escala","obrig":true,"texto":"E sobre os impactos do calor na população atendida pela SUA unidade?","curto":"Impactos do calor na população da unidade","ext":["Nada","Muito"],"par":{"com":"e2_calor_geral","nome":"Conhecer os efeitos do calor"}},{"id":"e4_reconhecer","tipo":"escala","obrig":true,"texto":"Você se sente seguro(a) para reconhecer agravos associados ao calor?","curto":"Segurança para reconhecer agravos","ext":["Nada seguro(a)","Muito seguro(a)"]},{"id":"e5_orientar","tipo":"escala","obrig":true,"texto":"Você se sente seguro(a) para orientar um usuário sobre como se proteger do calor?","curto":"Segurança para orientar o usuário","ext":["Nada seguro(a)","Muito seguro(a)"]},{"id":"e6_ubs_upa","tipo":"escala","obrig":true,"texto":"Você se sente seguro(a) para dizer a um usuário quando procurar a UBS e quando ir à UPA ou chamar o SAMU?","curto":"Segurança para indicar UBS × UPA/SAMU","ext":["Nada seguro(a)","Muito seguro(a)"]}]},{"id":"diagnosticar","num":2,"nome":"Diagnosticar","sub":"o que já existe de material e fluxo","icone":"diagnosticar","intro":"Agora queremos saber <b>o que já chegou</b> até a equipe e o que existe na rotina da unidade.","perguntas":[{"id":"d1_recebeu","tipo":"unica","obrig":true,"texto":"Você ou sua equipe já recebeu material ou treinamento sobre calor, El Niño e saúde?","curto":"Já recebeu material ou treinamento","opcoes":[{"v":"treinamento","t":"Sim, treinamento (com ou sem material)"},{"v":"material","t":"Sim, só material (folder, nota técnica, mensagem)"},{"v":"nao","t":"Não"},{"v":"nao_sei","t":"Não sei"}]},{"id":"d2_origem","tipo":"multipla","se":{"q":"d1_recebeu","em":["treinamento","material"]},"texto":"De onde veio esse material ou treinamento?","ajuda":"Marque todas as opções que se aplicam.","curto":"Origem do material ou treinamento","opcoes":[{"v":"sms","t":"Secretaria de Saúde do Recife"},{"v":"distrito","t":"Distrito Sanitário"},{"v":"estado","t":"Secretaria Estadual de Saúde"},{"v":"ms","t":"Ministério da Saúde"},{"v":"universidade","t":"Universidade ou residência"},{"v":"midia","t":"Mídia ou redes sociais"},{"v":"propria","t":"Iniciativa da própria equipe"},{"v":"outro","t":"Outro"}]},{"id":"d3_ajuda","tipo":"unica","se":{"q":"d1_recebeu","em":["treinamento","material"]},"obrig":true,"texto":"As orientações recebidas ajudam na realidade do Recife e do seu território?","curto":"As orientações recebidas ajudam no território?","opcoes":[{"v":"muito","t":"Ajudam muito"},{"v":"parte","t":"Ajudam em parte"},{"v":"pouco","t":"Ajudam pouco"},{"v":"nao","t":"Não ajudam"}]},{"id":"d4_fluxo","tipo":"unica","obrig":true,"texto":"A unidade tem um fluxo combinado para casos relacionados ao calor (desidratação, exaustão, descompensação de doenças crônicas)?","curto":"Fluxo para casos relacionados ao calor","opcoes":[{"v":"formal","t":"Sim, um fluxo ou protocolo definido"},{"v":"informal","t":"Mais ou menos: cada profissional faz do seu jeito"},{"v":"nao","t":"Não existe"},{"v":"nao_sei","t":"Não sei"}]},{"id":"d5_material_usuario","tipo":"unica","obrig":true,"texto":"Hoje a unidade tem material sobre calor para orientar ou entregar aos usuários?","curto":"Material sobre calor para os usuários","opcoes":[{"v":"usa","t":"Sim, e é usado"},{"v":"pouco","t":"Sim, mas é pouco usado"},{"v":"nao","t":"Não tem"},{"v":"nao_sei","t":"Não sei"}]},{"id":"d6_alerta","tipo":"unica","obrig":true,"texto":"A equipe costuma ser avisada quando há previsão de onda de calor?","curto":"Aviso de onda de calor para a equipe","opcoes":[{"v":"sim","t":"Sim, recebemos alerta"},{"v":"as_vezes","t":"Às vezes ou informalmente"},{"v":"nao","t":"Não"},{"v":"nao_sei","t":"Não sei"}]}]},{"id":"verificar","num":3,"nome":"Verificar","sub":"o que muda quando a pergunta entra no contexto da sua unidade","icone":"verificar","intro":"Algumas perguntas parecem as da etapa 1, mas agora <b>no chão do território</b>. É essa comparação que mostra onde o workshop precisa chegar.","perguntas":[{"id":"v1_agravos","tipo":"multipla","obrig":true,"exclusiva":"nenhum","cols":true,"texto":"Nos períodos de muito calor, você percebe aumento de quais problemas entre os usuários da unidade?","ajuda":"Marque todos que se aplicam.","curto":"Agravos percebidos no calor","opcoes":[{"v":"desidratacao","t":"Desidratação"},{"v":"exaustao","t":"Exaustão pelo calor ou insolação"},{"v":"pressao","t":"Descompensação da pressão"},{"v":"diabetes","t":"Descompensação do diabetes"},{"v":"renal","t":"Piora de doença renal ou infecção urinária"},{"v":"cardio","t":"Piora de doença do coração"},{"v":"respiratorio","t":"Piora de problemas respiratórios"},{"v":"diarreia","t":"Diarreias e intoxicações por água ou alimentos"},{"v":"pele","t":"Problemas de pele (brotoejas, micoses, queimaduras)"},{"v":"arbovirose","t":"Dengue, zika ou chikungunya"},{"v":"mental","t":"Piora do sono, irritabilidade ou saúde mental"},{"v":"quedas","t":"Tontura, desmaio ou quedas em idosos"},{"v":"gestante","t":"Intercorrências em gestantes"},{"v":"nenhum","t":"Não percebo aumento"},{"v":"outro","t":"Outro"}]},{"id":"v2_grupos","tipo":"multipla","obrig":true,"max":3,"cols":true,"texto":"Quais grupos do seu território mais preocupam você em relação ao calor?","ajuda":"Escolha até 3.","curto":"Grupos que mais preocupam","opcoes":[{"v":"idosos_sos","t":"Idosos que moram sozinhos"},{"v":"idosos","t":"Idosos em geral"},{"v":"criancas","t":"Crianças pequenas (até 5 anos)"},{"v":"gestantes","t":"Gestantes e puérperas"},{"v":"cronicos","t":"Pessoas com doenças crônicas (pressão, diabetes, rins, coração)"},{"v":"acamados","t":"Pessoas acamadas ou domiciliadas"},{"v":"deficiencia","t":"Pessoas com deficiência"},{"v":"mental","t":"Pessoas com transtorno mental ou uso de álcool e outras drogas"},{"v":"rua","t":"Pessoas em situação de rua"},{"v":"trabalhadores","t":"Trabalhadores ao ar livre (ambulantes, catadores, obras)"},{"v":"outro","t":"Outro"}]},{"id":"v3_barreiras","tipo":"multipla","obrig":true,"max":3,"cols":true,"texto":"O que mais dificulta os moradores seguirem as orientações sobre calor?","ajuda":"Escolha até 3.","curto":"Barreiras do território","opcoes":[{"v":"casa_quente","t":"Casas pequenas, quentes e pouco ventiladas"},{"v":"telhado","t":"Telhado de zinco ou fibrocimento e pouca sombra"},{"v":"agua","t":"Falta ou irregularidade de água"},{"v":"energia","t":"Sem ventilador ou com conta de luz alta"},{"v":"renda","t":"Renda baixa e comida mais cara"},{"v":"trabalho","t":"Precisam trabalhar no sol"},{"v":"sozinho","t":"Moram sozinhos ou têm pouca rede de apoio"},{"v":"leitura","t":"Dificuldade de leitura"},{"v":"crenca","t":"Hábitos e crenças que contrariam as orientações"},{"v":"acesso","t":"Dificuldade de chegar à UBS ou à UPA"},{"v":"alagamento","t":"Alagamentos e áreas de risco"},{"v":"outro","t":"Outro"}]},{"id":"v4_orientar_real","tipo":"escala","obrig":true,"texto":"Pense numa família do seu território que mora numa casa pequena, quente e com falta d’água. Quão seguro(a) você se sente para orientá-la de um jeito que ela consiga cumprir?","curto":"Orientar família com casa quente e falta d’água","ext":["Nada seguro(a)","Muito seguro(a)"],"par":{"com":"e5_orientar","nome":"Orientar o usuário"}},{"id":"v5_ubs_upa_real","tipo":"escala","obrig":true,"texto":"Um idoso chega num dia muito quente com tontura, fraqueza e um pouco confuso. Quão seguro(a) você se sente para decidir se é cuidado na UBS ou encaminhamento para UPA ou SAMU?","curto":"Decidir UBS × UPA/SAMU no caso do idoso","ext":["Nada seguro(a)","Muito seguro(a)"],"par":{"com":"e6_ubs_upa","nome":"Decidir entre UBS e UPA/SAMU"}},{"id":"v6_reconhecer_real","tipo":"escala","obrig":true,"texto":"Nos atendimentos e visitas, quão seguro(a) você se sente para perceber que um usuário com doença crônica está piorando por causa do calor?","curto":"Perceber piora de crônicos pelo calor","ext":["Nada seguro(a)","Muito seguro(a)"],"par":{"com":"e4_reconhecer","nome":"Reconhecer agravos"}},{"id":"v7_nao_funciona","tipo":"texto","texto":"Tem alguma orientação comum sobre calor que NÃO funciona no seu território? Por quê?","ajuda":"Opcional. Ex.: pedir para beber mais água quando falta água em casa.","curto":"Orientações que não funcionam no território"},{"id":"v8_caso","tipo":"texto","texto":"Conte uma situação em que o calor afetou a saúde de um usuário ou o trabalho da equipe.","ajuda":"Opcional. Não use nomes nem detalhes que identifiquem pessoas.","curto":"Situações reais relatadas"}]},{"id":"direcionar","num":4,"nome":"Direcionar","sub":"o que deve virar workshop e material final","icone":"direcionar","intro":"Suas escolhas aqui decidem <b>a ordem do workshop</b> e <b>quais materiais</b> vamos construir juntos.","perguntas":[{"id":"r1_temas","tipo":"multipla","obrig":true,"max":3,"cols":true,"texto":"Quais temas o workshop deve priorizar?","ajuda":"Escolha até 3.","curto":"Temas prioritários para o workshop","opcoes":[{"v":"elnino_saude","t":"Como o El Niño e o calor afetam a saúde na comunidade"},{"v":"grupos","t":"Quem precisa de atenção especial"},{"v":"sinais","t":"Sinais de alerta no calor"},{"v":"ubs_upa","t":"Quando procurar a UBS e quando procurar a UPA ou o SAMU"},{"v":"hidratacao","t":"Hidratação possível com pouca água"},{"v":"cronicos_med","t":"Calor, doenças crônicas e medicamentos"},{"v":"idosos","t":"Cuidados com idosos"},{"v":"criancas_gest","t":"Cuidados com crianças e gestantes"},{"v":"casa","t":"Como refrescar a casa com poucos recursos"},{"v":"agua_alimentos","t":"Água e alimentos seguros no calor"},{"v":"trabalho","t":"Proteção de quem trabalha no sol"},{"v":"comunicacao","t":"Como falar com a população sobre o calor"},{"v":"fluxo","t":"Fluxo da equipe durante uma onda de calor"}]},{"id":"r2_materiais","tipo":"multipla","obrig":true,"max":3,"cols":true,"texto":"Que tipo de material seria mais útil para sua equipe e para os usuários?","ajuda":"Escolha até 3.","curto":"Materiais mais úteis","opcoes":[{"v":"folder","t":"Folder impresso para entregar"},{"v":"cartaz","t":"Banner ou cartaz na sala de espera"},{"v":"whatsapp_card","t":"Card ou imagem para WhatsApp"},{"v":"audio","t":"Áudio curto para WhatsApp"},{"v":"video","t":"Vídeo curto"},{"v":"roteiro_acs","t":"Roteiro de apoio para ACS nas visitas"},{"v":"fluxograma","t":"Fluxograma rápido para a equipe (UBS × UPA)"},{"v":"ima","t":"Ímã ou cartão de geladeira com sinais de alerta"},{"v":"outro","t":"Outro"}]},{"id":"r3_linguagem","tipo":"multipla","obrig":true,"max":2,"texto":"Que linguagem funciona melhor com os moradores do seu território?","ajuda":"Escolha até 2.","curto":"Linguagem que funciona","opcoes":[{"v":"curta","t":"Frases curtas e diretas"},{"v":"imagens","t":"Mais imagens do que texto"},{"v":"exemplos","t":"Exemplos do dia a dia do bairro"},{"v":"fala","t":"Fala ou áudio (muita gente não lê bem)"},{"v":"informal","t":"Jeito informal, como a gente fala aqui"},{"v":"outro","t":"Outro"}]},{"id":"r4_canais","tipo":"multipla","obrig":true,"max":3,"cols":true,"texto":"Por onde a informação chega melhor aos usuários?","ajuda":"Escolha até 3.","curto":"Canais que alcançam os usuários","opcoes":[{"v":"visita_acs","t":"Visita do ACS"},{"v":"sala_espera","t":"Sala de espera"},{"v":"consulta","t":"Consulta ou atendimento"},{"v":"grupos","t":"Grupos da unidade (hiperdia, gestantes, idosos)"},{"v":"whatsapp","t":"WhatsApp"},{"v":"radio","t":"Rádio comunitária ou carro de som"},{"v":"igrejas","t":"Igrejas e associações"},{"v":"escolas","t":"Escolas e creches"},{"v":"outro","t":"Outro"}]},{"id":"r5_formato","tipo":"unica","obrig":true,"texto":"Qual formato de encontro funciona melhor para a equipe?","curto":"Formato preferido do encontro","opcoes":[{"v":"digital","t":"Digital, durante a reunião mensal"},{"v":"presencial","t":"Presencial, durante a reunião mensal"},{"v":"tanto_faz","t":"Tanto faz"}]}]},{"id":"cocriar","num":5,"nome":"Cocriar","sub":"traga o que você já sabe e o que quer saber","icone":"cocriar","intro":"Este espaço é de <b>cocriação</b>. Tudo aqui é opcional: um link, um material ou uma pergunta já ajudam a montar o workshop com a cara da sua unidade.","perguntas":[{"id":"c1_link","tipo":"link","texto":"Tem algum site, matéria ou vídeo sobre o tema que você achou interessante? Cole o link.","ajuda":"Opcional. Pode ser notícia, vídeo, post ou documento.","curto":"Links sugeridos pela equipe"},{"id":"c2_arquivo","tipo":"arquivo","texto":"Quer compartilhar algum material (folder, foto de cartaz, PDF, apresentação)?","ajuda":"Opcional. Até 3 arquivos, 10 MB no total. Não envie documentos com dados de pacientes.","curto":"Materiais enviados pela equipe"},{"id":"c3_pergunta","tipo":"texto","texto":"Escreva uma pergunta que você quer que a gente pesquise e responda no workshop.","ajuda":"Opcional. Ex.: idoso que toma diurético deve beber mais água no calor?","curto":"Perguntas para pesquisarmos"},{"id":"r6_pedido","tipo":"texto","texto":"Se você pudesse pedir UMA coisa a este workshop, o que seria?","ajuda":"Opcional.","curto":"Pedidos ao workshop"}]}]},"topicos":[{"id":"T01","bloco":"Entender o fenômeno","titulo":"O que é o El Niño e por que ele é pauta de saúde no Recife","essencial":true,"resumo":"O aquecimento anormal do Pacífico muda o clima no Nordeste: menos chuva, mais calor, menos água nos reservatórios e comida mais cara. Cada uma dessas mudanças chega ao corpo das pessoas.","pontos":["El Niño é o aquecimento acima do normal das águas do Pacífico equatorial, que altera a circulação do ar e reduz as chuvas no Nordeste.","Boletins de 2026: o Inpe apontou mais de 90% de chance de um episódio muito forte entre setembro e novembro, com persistência até o início de 2027.","A APAC previu chuvas abaixo da média no Leste de Pernambuco e temperaturas acima do normal em todo o estado.","Quatro caminhos até a saúde: calor (corpo), menos chuva e água (higiene, hidratação, criadouros), ar mais seco e poeira (respiração), alimentos mais caros (nutrição).","Onda de calor: vários dias seguidos com temperatura bem acima da média da época (os alertas do Inmet usam pelo menos 5 °C acima da média).","O Ministério da Saúde lista entre os riscos do El Niño no Nordeste: piora do ar, insegurança alimentar, desidratação, surtos de diarreia, complicações cardiorrespiratórias e mais condições para o mosquito da dengue."],"frase":"O El Niño não é só notícia de tempo: ele mexe com a água, a comida e o corpo da gente.","recife":"Recife combina ilha de calor urbana, casas adensadas, morros e calendário de abastecimento de água. Por isso o mesmo calor pesa diferente em cada microárea.","gatilhos":"e1_elnino<=2*2; r1_temas=elnino_saude*3; e2_calor_geral<=2","materiais":"M08;M09;M10;M04"},{"id":"T02","bloco":"Entender o fenômeno","titulo":"Como acompanhar alertas: Inmet, APAC e Painel de Excesso de Calor","essencial":false,"resumo":"Saber antes é a forma mais barata de prevenir: quem na equipe acompanha os alertas e como o aviso chega aos usuários.","pontos":["Fontes oficiais: alertas do Inmet, boletins da APAC e o Painel de Excesso de Calor do Ministério da Saúde.","Definir uma pessoa da equipe para checar os alertas e avisar no grupo da unidade.","Combinar o que muda na rotina quando há alerta: busca ativa, visitas prioritárias, água na sala de espera.","Levar o aviso ao território pelos canais que funcionam (ACS, WhatsApp, rádio comunitária)."],"frase":"Calor forte chegando? A gente avisa, e você avisa quem mora perto.","recife":"Os boletins da APAC trazem a previsão por região do estado; o Leste (onde está o Recife) aparece separado do Agreste e do Sertão.","gatilhos":"d6_alerta=nao*2; d6_alerta=nao_sei; d6_alerta=as_vezes","materiais":"M07"},{"id":"T03","bloco":"Agravos do calor","titulo":"Desidratação: reconhecer, prevenir e orientar","essencial":true,"resumo":"O agravo mais citado pelas equipes e o mais evitável, desde que a orientação caiba na realidade de quem tem pouca água.","pontos":["Sinais: sede, boca seca, urina escura e em pouca quantidade, tontura, fraqueza, dor de cabeça.","Pessoas idosas sentem menos sede: oferecer líquidos ao longo do dia, sem esperar o pedido (Nota Técnica 38/2023).","Beber água regularmente, mesmo sem sede; evitar bebidas alcoólicas e com cafeína nos dias mais quentes (Ministério da Saúde).","Com diarreia ou vômitos, a perda de líquidos é maior: avaliar na unidade e usar soro de reidratação oral conforme orientação da equipe.","Sinais de gravidade (confusão, sonolência, não urinar, desmaio) pedem avaliação urgente."],"frase":"Não espere a sede: beba água aos pouquinhos o dia todo. Idoso sente menos sede, ofereça.","recife":"Com calendário de abastecimento, a orientação precisa vir junto com como guardar e tratar a água (ver tópico Hidratação possível quando falta água).","gatilhos":"v1_agravos=desidratacao*2; r1_temas=hidratacao*2; e4_reconhecer<=2","materiais":"M01;M03"},{"id":"T04","bloco":"Agravos do calor","titulo":"Exaustão pelo calor e insolação: diferenças e primeiros cuidados","essencial":true,"resumo":"Diferenciar o quadro que se resolve com resfriamento e líquidos do golpe de calor, que é emergência.","pontos":["Exaustão pelo calor: transpiração intensa, fraqueza, tontura, náuseas, dor de cabeça, cãibras e diarreia.","Insolação/golpe de calor: pele quente, seca e vermelha, pulso rápido, confusão, convulsão ou perda de consciência. É emergência médica: SAMU 192.","Primeiros cuidados: levar para lugar fresco e à sombra, afrouxar roupas, resfriar com pano úmido ou água, oferecer líquidos se a pessoa estiver acordada e conseguir engolir.","Não dar líquidos a quem está confuso ou inconsciente.","Registrar o atendimento como relacionado ao calor para a vigilância enxergar o problema."],"frase":"Tontura, fraqueza e muito suor no calor: sombra, água e descanso. Confusão ou desmaio: chame o 192.","recife":"Atenção a quem passa o dia na rua (ambulantes, catadores) e a quem fica em casas de telhado de zinco nas horas mais quentes.","gatilhos":"v1_agravos=exaustao*2; e4_reconhecer<=2; v6_reconhecer_real<=2; r1_temas=sinais*2","materiais":"M01;M02"},{"id":"T05","bloco":"Agravos do calor","titulo":"Sinais de alerta: quando ir à UBS, à UPA ou chamar o SAMU","essencial":true,"resumo":"Uma regra simples, igual para toda a equipe, para orientar o usuário e decidir o encaminhamento.","pontos":["Na UBS: sinais de alerta como fraqueza, tontura, náuseas, dor de cabeça, cãibras ou diarreia leve, para avaliação com um profissional (Ministério da Saúde).","UPA ou SAMU 192: confusão, convulsão, desmaio ou perda de consciência, falta de ar, dor no peito, vômitos que não param, sem urinar há muitas horas.","Recepção e acolhimento precisam reconhecer quem chega passando mal de calor e não deixar na fila.","Montar com a equipe um fluxograma de uma página (UBS × UPA × SAMU) e combinar o caminho da referência."],"frase":"Mal-estar leve no calor: procure a sua unidade. Confusão, desmaio ou falta de ar: SAMU 192.","recife":"Mapear a UPA de referência da área e o tempo de deslocamento; em áreas de morro, o acesso pesa na decisão.","gatilhos":"e6_ubs_upa<=2*2; v5_ubs_upa_real<=2*2; r1_temas=ubs_upa*3; r2_materiais=fluxograma; v3_barreiras=acesso","materiais":"M01"},{"id":"T06","bloco":"Agravos do calor","titulo":"Pressão, coração e AVC nos dias quentes","essencial":false,"resumo":"O calor faz o coração trabalhar mais e mexe com a pressão, especialmente em quem já usa medicamentos.","pontos":["O calor extremo agrava doenças do coração e da circulação (Ministério da Saúde).","Quem usa anti-hipertensivos e diuréticos pode ter queda de pressão e tontura com a perda de líquidos.","Não suspender nem mudar dose por conta própria: ajustar só com orientação da equipe.","Sinais de AVC e infarto continuam sendo emergência (SAMU 192), com ou sem calor."],"frase":"Tomou o remédio da pressão e ficou tonto no calor? Não pare por conta própria: fale com a sua equipe.","recife":"Hiperdia e grupos de crônicos são o canal natural para levar esta orientação.","gatilhos":"v1_agravos=pressao*2; v1_agravos=cardio; v2_grupos=cronicos","materiais":"M01"},{"id":"T07","bloco":"Agravos do calor","titulo":"Diabetes e rins no calor","essencial":false,"resumo":"A desidratação descompensa a glicemia e sobrecarrega os rins; infecção urinária aumenta quando se bebe pouca água.","pontos":["Perder líquidos concentra a glicose e favorece a descompensação.","Pouca água e muito calor aumentam o risco de lesão renal e de infecção urinária.","Insulina e outros medicamentos precisam ficar longe do calor, conforme a orientação da embalagem.","Orientar automonitoramento e sinais de alerta (muita sede, urinar pouco ou muito, fraqueza)."],"frase":"No calor, diabetes e rins pedem água e atenção ao remédio guardado em lugar fresco.","recife":"Casas quentes sem geladeira adequada exigem combinar onde guardar a insulina.","gatilhos":"v1_agravos=diabetes*2; v1_agravos=renal*2; r1_temas=cronicos_med","materiais":"M01"},{"id":"T08","bloco":"Agravos do calor","titulo":"Medicamentos que pedem atenção no calor","essencial":false,"resumo":"Alguns medicamentos aumentam a perda de líquidos ou atrapalham o controle da temperatura do corpo.","pontos":["Diuréticos, alguns anti-hipertensivos, psicotrópicos (como antipsicóticos e lítio) e medicamentos anticolinérgicos aumentam o risco no calor.","Na visita, verificar quais medicamentos a pessoa usa e se há sinais de desidratação (guia da SES-RJ para ACS).","Nunca orientar suspensão: levar o caso para revisão com médico(a) ou enfermeiro(a).","Guardar medicamentos em lugar fresco e seco; o Ministério da Saúde orienta manter abaixo de 25 °C conforme a embalagem."],"frase":"Remédio também sente calor: guarde em lugar fresco e não pare de tomar sem falar com a equipe.","recife":"Útil para o roteiro de visita do ACS e para a farmácia da unidade.","gatilhos":"r1_temas=cronicos_med*3; v2_grupos=cronicos; v2_grupos=mental","materiais":"M05;M01"},{"id":"T09","bloco":"Agravos do calor","titulo":"Diarreia e doenças transmitidas por água e alimentos","essencial":false,"resumo":"Água guardada sem cuidado e comida que estraga rápido no calor explicam muitos surtos de diarreia.","pontos":["O Ministério da Saúde cita surtos de diarreia entre os riscos do El Niño no Nordeste.","Água para beber: filtrar e tratar (2 gotas de hipoclorito de sódio 2,5% por litro, esperar 30 minutos) ou ferver.","No calor, alimentos prontos estragam mais rápido: não deixar fora da geladeira por muito tempo.","Diarreia com sinais de desidratação: soro de reidratação oral e avaliação; vários casos na mesma área: notificar a vigilância."],"frase":"Água de beber: filtre e use 2 gotas de hipoclorito por litro, espere meia hora. Comida pronta não fica fora da geladeira.","recife":"Em áreas com abastecimento intermitente, a água fica dias guardada: o cuidado com o recipiente é tão importante quanto o tratamento.","gatilhos":"v1_agravos=diarreia*2; r1_temas=agua_alimentos*2; v3_barreiras=agua","materiais":"M06;M08"},{"id":"T10","bloco":"Agravos do calor","titulo":"Dengue, zika e chikungunya: água guardada vira criadouro","essencial":false,"resumo":"Na seca, as famílias guardam mais água, e o recipiente destampado vira berçário do Aedes.","pontos":["O Ministério da Saúde alerta que o El Niño cria condições mais favoráveis à proliferação do mosquito.","No levantamento nacional de 2026 (LIRAa), recipientes do dia a dia responderam por 42,3% dos criadouros.","Baldes, tonéis e caixas d’água sempre tampados ou cobertos com tela; os ovos grudam nas paredes, então é preciso escovar o recipiente ao lavar.","Sinais de alerta da dengue continuam valendo: dor abdominal forte, vômitos persistentes, sangramento, tontura ao levantar."],"frase":"Guardou água? Tampe bem e escove o balde por dentro ao lavar.","recife":"Com calendário de abastecimento, quase toda casa guarda água: a orientação precisa ser como guardar, não proibir.","gatilhos":"v1_agravos=arbovirose*2; v3_barreiras=agua","materiais":"M08"},{"id":"T11","bloco":"Agravos do calor","titulo":"Pele, olhos e respiração no tempo quente e mais seco","essencial":false,"resumo":"Brotoejas, micoses e queimaduras de sol aumentam; ar mais seco e poeira pioram asma, rinite e irritação nos olhos.","pontos":["Pele: brotoejas e assaduras (sobretudo em bebês), micoses, queimaduras solares.","Ar mais seco e poeira irritam olhos e vias aéreas e podem piorar asma e rinite; o Ministério da Saúde cita piora da qualidade do ar entre os riscos.","Roupas leves e claras, sombra, chapéu e protetor solar quando possível.","Quem tem asma ou DPOC: manter o tratamento e conhecer os sinais de crise."],"frase":"Roupa leve, sombra e água. Se a falta de ar piorar, procure a unidade.","recife":"Mesmo numa cidade úmida, os dias mais secos e com vento levantam poeira em ruas sem calçamento.","gatilhos":"v1_agravos=pele*2; v1_agravos=respiratorio*2","materiais":"M12;M08"},{"id":"T12","bloco":"Agravos do calor","titulo":"Saúde mental, sono e violência no calor","essencial":false,"resumo":"Noites quentes sem dormir, irritação e conflitos dentro de casa também são efeitos do calor.","pontos":["O calor prolongado pode agravar ansiedade e depressão e aumentar violência e comportamento agressivo (Ministério da Saúde).","Sono ruim em casas quentes afeta humor, atenção e controle de doenças crônicas.","Pessoas em uso de psicotrópicos precisam de atenção redobrada à hidratação.","Acolher a preocupação com o clima sem alarmismo e com ações concretas."],"frase":"Calor tira o sono e a paciência. Cuidar da casa fresca e da água também cuida da cabeça.","recife":"Casas pequenas e muito quentes concentram a família no mesmo cômodo nas horas de mais calor.","gatilhos":"v1_agravos=mental*2; v2_grupos=mental","materiais":"M01"},{"id":"T13","bloco":"Quem precisa de atenção especial","titulo":"Pessoas idosas, sobretudo as que moram sozinhas","essencial":true,"resumo":"Sentem menos sede, têm menos água no corpo e muitas vezes ninguém por perto para perceber o mal-estar.","pontos":["Na velhice há menor sensação de sede e menor teor de água no organismo (Nota Técnica 38/2023).","Oferecer líquidos ao longo do dia e observar urina, tontura e confusão.","Tontura, desmaios e quedas aumentam no calor.","Lista de idosos que moram sozinhos por microárea e combinar quem passa ou liga nos dias de alerta (vizinho, familiar, ACS)."],"frase":"Tem um vizinho idoso que mora sozinho? No calor, bata na porta e ofereça água.","recife":"Idosos sozinhos em casas de morro e de telhado de zinco são o grupo de maior risco nas ondas de calor.","gatilhos":"v2_grupos=idosos_sos*3; v2_grupos=idosos*2; v1_agravos=quedas*2; r1_temas=idosos*3","materiais":"M03;M12"},{"id":"T14","bloco":"Quem precisa de atenção especial","titulo":"Bebês e crianças pequenas","essencial":false,"resumo":"Desidratam rápido e dependem do adulto para beber, se proteger do sol e sair do calor.","pontos":["Crianças estão entre os grupos que precisam de oferta constante de líquidos e ambientes frescos (Ministério da Saúde).","Manter o aleitamento materno em livre demanda.","Sinais de alerta: choro sem lágrimas, fralda seca por muitas horas, moleza, vômitos ou diarreia.","Nunca deixar a criança em carro ou cômodo fechado ao sol."],"frase":"Criança no calor: mais peito ou água, roupa leve e sombra. Moleza ou fralda seca: procure a unidade.","recife":"Creches e escolas do território são canal para levar o aviso às famílias.","gatilhos":"v2_grupos=criancas*3; r1_temas=criancas_gest*2","materiais":"M03"},{"id":"T15","bloco":"Quem precisa de atenção especial","titulo":"Gestantes e puérperas","essencial":false,"resumo":"O calor aumenta o desconforto e o risco de desidratação na gestação e no puerpério.","pontos":["Gestantes estão entre os grupos mais vulneráveis ao calor (Ministério da Saúde).","Hidratação, roupas leves e pausas no calor; atenção a tontura e desmaio.","Sinais obstétricos de alerta continuam valendo e devem ser buscados no pré-natal.","Espera longa em recepção abafada é risco: priorizar o acolhimento."],"frase":"Gestante no calor: água sempre por perto e descanso na sombra.","recife":"Grupos de gestantes e consultas de pré-natal são o melhor momento para a orientação.","gatilhos":"v2_grupos=gestantes*3; v1_agravos=gestante*2; r1_temas=criancas_gest","materiais":"M01"},{"id":"T16","bloco":"Quem precisa de atenção especial","titulo":"Pessoas acamadas e com doenças crônicas","essencial":false,"resumo":"Dependem de quem cuida para beber água, mudar de posição e ficar num ambiente mais fresco.","pontos":["Identificar acamados e domiciliados por microárea e priorizar visitas nos dias de alerta.","Orientar o cuidador: oferecer líquidos, roupas e lençóis leves, ventilação, observar urina e confusão.","Quartos sem janela e muito quentes pedem ajuste de onde a pessoa fica nas horas de mais calor.","Revisar medicamentos de risco com a equipe."],"frase":"Quem cuida de alguém acamado: ofereça água, deixe o quarto arejado e observe se a pessoa fica confusa.","recife":"Muitas casas têm um único cômodo ventilado; combinar com a família onde o acamado fica durante a tarde.","gatilhos":"v2_grupos=acamados*3; v2_grupos=cronicos*2","materiais":"M05"},{"id":"T17","bloco":"Quem precisa de atenção especial","titulo":"Pessoas em situação de rua","essencial":false,"resumo":"Exposição contínua ao sol e pouco acesso a água e sombra.","pontos":["População em situação de rua é grupo vulnerável ao calor (Ministério da Saúde).","Oferecer água e um ponto de descanso na sombra; a unidade pode ser um ponto de resfriamento.","Articular com Consultório na Rua e assistência social.","Sinais de exaustão e golpe de calor podem ser confundidos com uso de álcool ou drogas: avaliar."],"frase":"Água e sombra não se negam a ninguém.","recife":"Mapear onde ficam as pessoas em situação de rua da área e quem já as acompanha.","gatilhos":"v2_grupos=rua*3","materiais":"M01"},{"id":"T18","bloco":"Quem precisa de atenção especial","titulo":"Quem trabalha no sol: ambulantes, catadores, obras","essencial":false,"resumo":"Não dá para mandar evitar o sol de quem vive dele; dá para combinar pausas, água e sinais de alerta.","pontos":["Exposição prolongada ao sol causa insolação, desidratação, queimaduras e exaustão (Nota Técnica 18/2023).","Água sempre à mão, pausas na sombra e roupas leves; trabalho pesado nos horários mais frescos quando possível.","Reconhecer cedo os sinais de exaustão e parar.","O Ministério da Saúde orienta evitar o sol direto das 10h às 16h; para quem trabalha na rua, a orientação vira pausa e proteção."],"frase":"Trabalha no sol? Água por perto, pausa na sombra e atenção à tontura.","recife":"Feiras, comércio de rua e coleta de recicláveis concentram estes trabalhadores em várias áreas da cidade.","gatilhos":"v2_grupos=trabalhadores*3; v3_barreiras=trabalho*2; r1_temas=trabalho*3","materiais":"M02"},{"id":"T19","bloco":"Realidade do território","titulo":"Hidratação possível quando falta água","essencial":true,"resumo":"A orientação de beber mais água só funciona se vier com como guardar, tratar e priorizar a água que se tem.","pontos":["Priorizar a água guardada para beber e preparar alimentos.","Guardar em recipiente limpo, de uso só para isso e sempre tampado.","Tratar a água de beber: filtrar (filtro, coador de papel ou pano limpo) e pingar 2 gotas de hipoclorito de sódio 2,5% por litro, esperando 30 minutos; ou ferver.","Informar onde a família pode pegar hipoclorito na unidade.","Beber pouco e muitas vezes; oferecer a quem sente menos sede (idosos, crianças)."],"frase":"Pouca água em casa? Separe primeiro a de beber, guarde tampada e trate com 2 gotas de hipoclorito por litro.","recife":"Grande parte do Recife convive com calendário de abastecimento e, com o El Niño, o estado alerta para risco de falta de água.","gatilhos":"v3_barreiras=agua*3; r1_temas=hidratacao*3; v4_orientar_real<=2*2","materiais":"M06;M10"},{"id":"T20","bloco":"Realidade do território","titulo":"Casa quente: refrescar com poucos recursos","essencial":false,"resumo":"Ventilar na hora certa, barrar o sol e criar um canto mais fresco custa pouco e protege muito.","pontos":["Abrir janelas nas horas mais frescas (manhã cedo e noite) e fechar cortinas ou panos no sol forte.","Pano úmido, bacia de água e banho com água morna, evitando mudanças bruscas de temperatura (Ministério da Saúde).","Roupas leves, claras e que deixam o suor sair.","Nas horas mais quentes, procurar lugares frescos (o Ministério da Saúde cita centros comunitários; a unidade pode ter uma zona de resfriamento).","Ventilador ajuda; para quem não tem ou não pode pagar a luz, priorizar sombra, ventilação cruzada e água."],"frase":"Abra a casa cedo e à noite, feche no sol forte, use pano úmido e roupa leve.","recife":"Telhado de zinco e fibrocimento e casas coladas umas nas outras deixam muitos cômodos mais quentes do que a rua à tarde.","gatilhos":"v3_barreiras=casa_quente*3; v3_barreiras=telhado*2; v3_barreiras=energia*2; r1_temas=casa*3; v4_orientar_real<=2","materiais":"M01;M08"},{"id":"T21","bloco":"Realidade do território","titulo":"Comida mais cara: comer bem e com segurança no calor","essencial":false,"resumo":"A seca pode encarecer alimentos; o calor estraga a comida mais rápido. As duas coisas juntas pesam na saúde.","pontos":["O Ministério da Saúde cita insegurança alimentar entre os riscos do El Niño no Nordeste.","A alta de preços não é automática, mas a falta de chuva reduz a produção; especialistas recomendam pesquisar preços e evitar estocar demais.","Preferir refeições leves, frutas e saladas nos dias quentes (Ministério da Saúde).","Comida pronta no calor: consumir logo ou guardar na geladeira.","Famílias em insegurança alimentar: acionar a rede de proteção social do município (CRAS)."],"frase":"Comida leve, fresca e bem guardada. Se faltar comida em casa, procure o CRAS.","recife":"Feiras livres e mercados públicos ajudam a encontrar alimentos da estação mais baratos.","gatilhos":"v3_barreiras=renda*3; r1_temas=agua_alimentos*2","materiais":"M09;M08"},{"id":"T22","bloco":"Realidade do território","titulo":"Como falar com a população: mensagens que funcionam","essencial":false,"resumo":"A mesma orientação, dita de um jeito que o morador entende e consegue cumprir.","pontos":["Trocar orientações impossíveis por possíveis (ex.: em vez de beber 2 litros, separar primeiro a água de beber).","Frases curtas, imagens e áudio para quem tem dificuldade de leitura.","Usar exemplos do próprio bairro e a linguagem da comunidade.","Escolher os canais que alcançam o território: ACS, WhatsApp, sala de espera, rádio comunitária, igrejas e escolas."],"frase":"Fale como o bairro fala e peça só o que a família consegue fazer.","recife":"As respostas do formulário mostram quais canais e linguagens funcionam em cada unidade.","gatilhos":"r1_temas=comunicacao*3; v3_barreiras=leitura*2; v3_barreiras=crenca*2","materiais":""},{"id":"T23","bloco":"A unidade na onda de calor","titulo":"Fluxo da equipe durante uma onda de calor","essencial":true,"resumo":"Quem avisa, quem busca, quem acolhe e para onde encaminhar: tudo combinado antes do alerta.","pontos":["Responsável por acompanhar alertas e avisar a equipe.","Busca ativa dos grupos de risco por microárea nos dias de alerta.","Recepção: reconhecer sinais de alerta e não deixar quem passa mal esperando na fila; água disponível na sala de espera.","A unidade como ponto de resfriamento (o plano federal de 2026 prevê zonas de resfriamento nas UBS).","Referência combinada para UPA e SAMU e registro dos atendimentos relacionados ao calor."],"frase":"No dia de alerta de calor, a unidade também é lugar de água e sombra.","recife":"Cada unidade tem uma UPA de referência e microáreas com riscos diferentes: o fluxo é local.","gatilhos":"d4_fluxo=informal*2; d4_fluxo=nao*3; d4_fluxo=nao_sei*2; r1_temas=fluxo*3","materiais":"M02;M04;M08"},{"id":"T24","bloco":"A unidade na onda de calor","titulo":"Visita domiciliar no calor: o ACS como sentinela","essencial":false,"resumo":"O ACS entra nas casas: é quem percebe primeiro a casa quente, a água guardada e o idoso confuso.","pontos":["Checklist rápido da visita: ambiente (calor, ventilação), água (quanto tem, como guarda), medicamentos de risco, sinais de alerta.","Priorizar idosos sozinhos, acamados, gestantes e crianças pequenas nos dias de alerta (guia da SES-RJ para ACS).","Mobilizar a rede do território: vizinhos, família, igreja, associação.","Levar o caso para a equipe quando houver sinais de alerta."],"frase":"Na visita: olhe a casa, a água, os remédios e como a pessoa está.","recife":"O ACS conhece as ruas sem sombra, as casas de zinco e quem mora sozinho: é o mapa de risco vivo da unidade.","gatilhos":"r2_materiais=roteiro_acs*3; r4_canais=visita_acs*2; funcao=acs","materiais":"M05;M11"},{"id":"T25","bloco":"A unidade na onda de calor","titulo":"Cuidar de quem cuida: o trabalhador da unidade no calor","essencial":false,"resumo":"ACS e equipe também desidratam, e trabalham ao sol.","pontos":["Planejar visitas e atividades externas nos horários mais frescos.","Água, protetor solar, chapéu e pausas para quem trabalha na rua (Nota Técnica 1/2026 de Porto Alegre para ACS e ACE).","Ambiente da unidade: ventilação e água para a equipe.","Reconhecer em si os sinais de exaustão."],"frase":"Quem cuida também precisa de água e sombra.","recife":"As visitas a pé em áreas de morro, no meio do dia, somam esforço e sol.","gatilhos":"funcao=acs*2; r4_canais=visita_acs","materiais":"M11"},{"id":"T26","bloco":"A unidade na onda de calor","titulo":"Vigilância: registrar, notificar e aprender com cada onda de calor","essencial":false,"resumo":"O que não é registrado não aparece no planejamento da cidade.","pontos":["Registrar os atendimentos relacionados ao calor.","Vários casos de diarreia na mesma área: notificar a vigilância epidemiológica.","Acompanhar o Painel de Excesso de Calor do Ministério da Saúde.","Depois de cada onda de calor, uma conversa rápida da equipe: o que funcionou e o que mudar."],"frase":"Cada atendimento registrado ajuda a cidade a se preparar melhor.","recife":"Os registros da unidade alimentam o distrito sanitário e o planejamento municipal para o calor.","gatilhos":"d4_fluxo=nao; d6_alerta=nao","materiais":"M07;M04"}],"materiais":[{"id":"G01","titulo":"Material geral: todos os tópicos de El Niño e saúde","tipo":"pagina","url":"","descricao":"Página pública com os tópicos do workshop e seus destrinchamentos (gerada por este app).","uso":"pre_workshop","topicos":"","origem":"Equipe UPE","status":"aprovado"},{"id":"V01","titulo":"Vídeo 1 (pré-workshop): El Niño, calor e saúde no Recife","tipo":"video","url":"","descricao":"A definir pela equipe UPE. Cole o link quando o vídeo estiver pronto.","uso":"pre_workshop","topicos":"T01;T19","origem":"Equipe UPE","status":"a definir"},{"id":"V02","titulo":"Vídeo 2 (pré-workshop): sinais de alerta e onde buscar atendimento","tipo":"video","url":"","descricao":"A definir pela equipe UPE. Cole o link quando o vídeo estiver pronto.","uso":"pre_workshop","topicos":"T04;T05","origem":"Equipe UPE","status":"a definir"},{"id":"E01","titulo":"E-book geral: El Niño é pauta de saúde","tipo":"ebook","url":"","descricao":"A definir pela equipe UPE. Cole o link do e-book quando estiver pronto.","uso":"pre_workshop","topicos":"","origem":"Equipe UPE","status":"a definir"},{"id":"M01","titulo":"Ministério da Saúde · Calor: riscos, sinais de alerta e cuidados","tipo":"pagina","url":"https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/c/calor","descricao":"Riscos do calor, grupos vulneráveis, sinais de alerta e de emergência, orientações à população.","uso":"referencia","topicos":"T03;T04;T05;T06;T12;T20","origem":"Equipe UPE","status":"aprovado"},{"id":"M02","titulo":"Ministério da Saúde · Nota Técnica nº 18/2023-SVSA: recomendações para ondas de calor","tipo":"pdf","url":"https://fms.pontagrossa.pr.gov.br/visa/wp-content/uploads/2023/11/Nota_Tecnica_18_2023_recomendacoes_ondas_de_calor__1___1_.pdf","descricao":"Sintomas de insolação e de exaustão térmica; recomendações à população e aos serviços (cópia publicada pela FMS Ponta Grossa).","uso":"referencia","topicos":"T04;T18;T23","origem":"Equipe UPE","status":"aprovado"},{"id":"M03","titulo":"Ministério da Saúde · Nota Técnica nº 38/2023-SAPS: criança e pessoa idosa em ondas de calor","tipo":"pdf","url":"https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2023/nota-tecnica-conjunta-onda-calor.pdf","descricao":"Orientações da Atenção Primária para crianças e pessoas idosas durante ondas de calor.","uso":"referencia","topicos":"T13;T14","origem":"Equipe UPE","status":"aprovado"},{"id":"M04","titulo":"Ministério da Saúde/OPAS · Guia de bolso Mudanças Climáticas para Profissionais da Saúde","tipo":"pagina","url":"https://www.paho.org/pt/noticias/1-10-2024-com-base-em-guia-da-opas-brasil-lanca-publicacao-sobre-mudancas-climaticas-para","descricao":"Guia para médicos, enfermeiros, ACS e outros profissionais do SUS sobre efeitos do clima na saúde.","uso":"referencia","topicos":"T01;T23;T26","origem":"Equipe UPE","status":"aprovado"},{"id":"M05","titulo":"SES-RJ · Informe Técnico 03/2025: Calor extremo e visitas domiciliares (guia para ACS)","tipo":"pdf","url":"https://www.rj.gov.br/saude/sites/default/files/arquivo_pagina_basica/CALOR-EXTREMO-E-VISITAS-DOMICILIARES_SES-RJ.pdf","descricao":"Modelo prático de visita domiciliar no calor: grupos prioritários, medicamentos, ambiente e mobilização do território.","uso":"referencia","topicos":"T08;T24","origem":"Equipe UPE","status":"aprovado"},{"id":"M06","titulo":"SES-MG · Nota Técnica 39/2023: hipoclorito de sódio 2,5% na desinfecção caseira da água","tipo":"pdf","url":"https://www.saude.mg.gov.br/wp-content/uploads/2025/03/ANEXO-F-Nota-tcnica-39-2023_Orientaes-tratamento-intradomiciliar.pdf","descricao":"Filtrar e adicionar 2 gotas de hipoclorito 2,5% por litro, aguardando 30 minutos (recomendação do Ministério da Saúde).","uso":"referencia","topicos":"T09;T19","origem":"Equipe UPE","status":"aprovado"},{"id":"M07","titulo":"Ministério da Saúde · Painel de Excesso de Calor","tipo":"pagina","url":"https://clima.saude.gov.br","descricao":"Painel indicado pelo Ministério da Saúde para acompanhar excesso de calor.","uso":"referencia","topicos":"T02;T26","origem":"Equipe UPE","status":"aprovado"},{"id":"M08","titulo":"Ministério da Saúde prepara ações contra seca e calor no Nordeste (set/2026)","tipo":"noticia","url":"https://portaldeprefeitura.com.br/saude/el-nino-ministerio-da-saude-prepara-acoes-contra-seca-e-calor-no/632320/","descricao":"Riscos citados: qualidade do ar, insegurança alimentar, desidratação, diarreia, complicações cardiorrespiratórias e dengue; zonas de resfriamento nas UBS.","uso":"referencia","topicos":"T01;T09;T10;T21;T23","origem":"Equipe UPE","status":"aprovado"},{"id":"M09","titulo":"Painel El Niño 2026–2027 (Inpe) e efeitos no orçamento das famílias","tipo":"noticia","url":"https://portaldeprefeitura.com.br/clima/super-el-nino-nordeste-impactos-orcamento-pernambuco/631508/","descricao":"Probabilidade acima de 90% de episódio muito forte; APAC prevê chuvas abaixo da média no Leste e temperaturas acima do normal; possível alta de preços de alimentos.","uso":"referencia","topicos":"T01;T21","origem":"Equipe UPE","status":"aprovado"},{"id":"M10","titulo":"Defesa Civil/APAC: risco de falta de água em Pernambuco com o avanço do El Niño (nov/2026)","tipo":"noticia","url":"https://portaldeprefeitura.com.br/pernambuco/governo-pernambuco-alerta-risco-de-falta-de-agua-em-pernambuco-com/635705/","descricao":"Boletim aponta 29 reservatórios em colapso no estado e risco de estiagem.","uso":"referencia","topicos":"T01;T19","origem":"Equipe UPE","status":"aprovado"},{"id":"M11","titulo":"Prefeitura de Porto Alegre · NT 1/2026: atividades externas de ACS e ACE em calor extremo","tipo":"pdf","url":"https://prefeitura.poa.br/sites/default/files/usu_doc/hotsites/sms/vigilancia-em-saude/NT%201_26_Calor%20extremo.pdf","descricao":"Medidas para proteger agentes comunitários e de endemias nas atividades externas durante calor extremo.","uso":"referencia","topicos":"T24;T25","origem":"Equipe UPE","status":"aprovado"},{"id":"M12","titulo":"Prefeitura de São Paulo · Cuidados com idosos em altas temperaturas e baixa umidade","tipo":"pdf","url":"https://capital.sp.gov.br/documents/d/saude/orientacoes_saude_idosos_12_09-pdf","descricao":"Orientações para ambientes de cuidado a pessoas idosas em calor e tempo seco.","uso":"referencia","topicos":"T11;T13","origem":"Equipe UPE","status":"aprovado"}]};
