/**
 * EL NIÑO É PAUTA DE SAÚDE — Escuta da UBS · Servidor (Google Apps Script + Google Sheets)
 *
 * Instalação (uma vez, pela conta dona da planilha):
 *   1. Abra a planilha > Extensões > Apps Script e cole Config.gs e Codigo.gs.
 *   2. Execute configurarElNino() e autorize. As abas que faltarem são criadas; nada é apagado.
 *      O login e a senha iniciais da coordenação ficam na aba Acessos (podem ser alterados ali).
 *   3. Implantar > Nova implantação > App da Web · Executar como: Eu · Quem pode acessar: Qualquer pessoa.
 *   4. Cole a URL /exec na constante API_URL do index.html no GitHub.
 *
 * O formulário é público e anônimo (não exige login). O painel exige login e só ele lê as respostas.
 * Toda a validação acontece aqui, no servidor.
 */

const ELN_SECRET_PROP = 'ELN_SECRET_V1';
const ELN_SS_PROP = 'ELN_SS_ID';
const ELN_ABAS = {RESP: 'Respostas', ACESSOS: 'Acessos', PARAM: 'Parametros', DIC: 'Dicionario', AUD: 'Auditoria', INSTR: 'Instrucoes'};
const ELN_META = ['id_resposta', 'recebido_em', 'unidade', 'versao_form', 'origem', 'duracao_seg', 'request_id'];

/* ============================== ENTRADAS ============================== */

/** Abre o app pelo Apps Script exibindo exatamente o index.html publicado no GitHub. */
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
  return out.setTitle('Escuta da UBS · El Niño é pauta de saúde').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** API usada pela versão do GitHub Pages (fetch POST com corpo JSON em text/plain). */
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
    case 'ping': return elnPing_();
    case 'enviar': return elnEnviar_(req);
    case 'login': return elnLogin_(req);
    case 'resultados': return elnResultados_(req);
    case 'dicionario': return elnDicionario_(req);
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

/** Execute no editor para forçar o Apps Script a buscar agora a versão mais nova do GitHub. */
function atualizarInterfaceElNino() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(['eln_front_n'].concat(Array.from({length: 30}, (_, i) => 'eln_front_' + i)));
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
  elnAssert_(s, 'O servidor ainda não foi configurado. A coordenação deve executar configurarElNino() no editor do Apps Script.');
  return s;
}
function elnDigest_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)).replace(/=+$/, ''); }
function elnHmac_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(text), elnSecret_(), Utilities.Charset.UTF_8)).replace(/=+$/, ''); }
function elnEqual_(a, b) { a = String(a); b = String(b); let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return !diff; }
function elnNovaSenha_() { return 'ElNino' + String(Math.floor(100000 + Math.random() * 900000)); }
/** Evita que textos digitados virem fórmulas na planilha. */
function elnCell_(v) { if (v === null || v === undefined) return ''; if (typeof v === 'number' || typeof v === 'boolean') return v; const s = String(v); return /^[=+@\-]/.test(s) ? "'" + s : s; }

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
function elnParametros_() {
  const sh = elnSs_().getSheetByName(ELN_ABAS.PARAM); const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}
function elnSetParametro_(chave, valor, descricao) {
  const sh = elnAba_(ELN_ABAS.PARAM);
  const n = Math.max(0, sh.getLastRow() - 1);
  const vals = n ? sh.getRange(2, 1, n, 1).getValues() : [];
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === chave) { sh.getRange(i + 2, 2).setValue(valor); return; }
  sh.appendRow([chave, valor, descricao || '']);
}
function elnAuditoria_(login, acao, detalhe) {
  try { elnAba_(ELN_ABAS.AUD).appendRow([elnNow_(), login || '', acao, elnCell_(String(detalhe || '').slice(0, 400))]); } catch (e) { /* auditoria é opcional */ }
}
function elnUrlPlanilha_() { try { return elnSs_().getUrl(); } catch (e) { return ''; } }
function elnUrlApp_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

/* ============================== OPERAÇÕES ============================== */

function elnPing_() {
  const p = elnParametros_();
  return {versao: ELN_VERSAO, titulo: ELN_TITULO, ubs_padrao: String(p.UBS_PADRAO || ELN_UBS_PADRAO), form_aberto: p.FORM_ABERTO === undefined ? true : elnTrue_(p.FORM_ABERTO), url_app: elnUrlApp_()};
}

/** Recebe uma resposta anônima do formulário. Não exige login. */
function elnEnviar_(req) {
  const p = elnParametros_();
  elnAssert_(p.FORM_ABERTO === undefined || elnTrue_(p.FORM_ABERTO), 'O formulário está encerrado.');
  const rid = String(req.request_id || '');
  elnAssert_(/^[A-Za-z0-9-]{8,64}$/.test(rid), 'Envio inválido (identificador).');
  const resp = req.respostas;
  elnAssert_(resp && typeof resp === 'object' && !Array.isArray(resp), 'Envio inválido (respostas).');
  const chaves = Object.keys(resp);
  elnAssert_(chaves.length > 0 && chaves.length <= 80, 'Envio inválido (quantidade de respostas).');
  elnAssert_(JSON.stringify(resp).length < 30000, 'Envio inválido (tamanho).');
  const limpas = {};
  chaves.forEach(k => {
    elnAssert_(/^[a-z][a-z0-9_]{0,39}$/.test(k) && ELN_META.indexOf(k) < 0, 'Envio inválido (pergunta ' + k + ').');
    const v = resp[k];
    if (Array.isArray(v)) {
      elnAssert_(v.length <= 20 && v.every(x => /^[a-z0-9_]{1,40}$/.test(String(x))), 'Envio inválido (opções de ' + k + ').');
      limpas[k] = v.map(String).join(' | ');
    } else if (typeof v === 'number') {
      elnAssert_(isFinite(v) && v >= 0 && v <= 1000, 'Envio inválido (número em ' + k + ').');
      limpas[k] = v;
    } else {
      limpas[k] = elnClean_(v, 1500);
    }
  });

  /* proteção simples contra excesso de envios no link público */
  const cache = CacheService.getScriptCache();
  const minuto = 'eln_rate_' + Math.floor(Date.now() / 60000);
  const usados = Number(cache.get(minuto) || 0);
  elnAssert_(usados < ELN_LIMITE_POR_MINUTO, 'Muitos envios ao mesmo tempo. Tente de novo em 1 minuto.');
  cache.put(minuto, String(usados + 1), 120);

  return elnLock_(() => {
    const sh = elnAba_(ELN_ABAS.RESP);
    let cab = elnCabecalho_(sh);
    const colRid = cab.indexOf('request_id') + 1;
    if (colRid && sh.getLastRow() > 1) {
      const achou = sh.getRange(2, colRid, sh.getLastRow() - 1, 1).createTextFinder(rid).matchEntireCell(true).findNext();
      if (achou) return {duplicado: true, id: String(sh.getRange(achou.getRow(), 1).getValue())};
    }
    const novas = Object.keys(limpas).filter(k => cab.indexOf(k) < 0);
    if (novas.length) {
      sh.getRange(1, cab.length + 1, 1, novas.length).setValues([novas]).setFontWeight('bold').setBackground('#8b0c11').setFontColor('#ffffff');
      cab = cab.concat(novas);
    }
    const id = elnId_('R');
    const meta = {id_resposta: id, recebido_em: elnNow_(), unidade: elnClean_(req.unidade, 120) || String(p.UBS_PADRAO || ELN_UBS_PADRAO),
      versao_form: elnClean_(req.versao_form, 20), origem: elnClean_(req.origem, 20), duracao_seg: Number(req.duracao_seg) > 0 ? Math.min(86400, Math.round(Number(req.duracao_seg))) : '', request_id: rid};
    const linha = cab.map(c => elnCell_(c in meta ? meta[c] : (c in limpas ? limpas[c] : '')));
    sh.appendRow(linha);
    return {id: id};
  });
}

/* ------------------------------ acesso ao painel ------------------------------ */

function elnAcessos_() {
  const sh = elnAba_(ELN_ABAS.ACESSOS);
  if (sh.getLastRow() < 2) return [];
  const cab = elnCabecalho_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().map(r => {
    const o = {}; cab.forEach((c, i) => o[c] = r[i]); return o;
  }).filter(a => String(a.login || '').trim());
}
function elnLogin_(req) {
  const login = elnClean_(req.login, 60).toLowerCase(), senha = String(req.senha || '');
  elnAssert_(login && senha, 'Informe usuário e senha.');
  const cache = CacheService.getScriptCache(), chaveTent = 'eln_tent_' + elnDigest_(login).slice(0, 16);
  const tent = Number(cache.get(chaveTent) || 0);
  elnAssert_(tent < 8, 'Muitas tentativas. Aguarde 10 minutos.');
  const acc = elnAcessos_().find(a => String(a.login).trim().toLowerCase() === login && elnTrue_(a.ativo));
  if (!acc || !elnEqual_(String(acc.senha), senha)) {
    cache.put(chaveTent, String(tent + 1), 600);
    elnAuditoria_(login, 'LOGIN_FALHOU', '');
    throw new Error('Usuário ou senha incorretos.');
  }
  cache.remove(chaveTent);
  const exp = Date.now() + ELN_SESSAO_HORAS * 3600 * 1000;
  const corpo = Utilities.base64EncodeWebSafe(JSON.stringify({l: login, e: exp, v: elnDigest_(String(acc.senha)).slice(0, 12)}), Utilities.Charset.UTF_8).replace(/=+$/, '');
  elnAuditoria_(login, 'LOGIN', '');
  return {token: corpo + '.' + elnHmac_(corpo), login: login, exp: exp, planilha_url: elnUrlPlanilha_()};
}
function elnAuth_(token) {
  const t = String(token || ''), i = t.lastIndexOf('.');
  elnAssert_(i > 0, 'Sessão inválida. Faça login de novo.');
  const corpo = t.slice(0, i), sig = t.slice(i + 1);
  elnAssert_(elnEqual_(elnHmac_(corpo), sig), 'Sessão inválida. Faça login de novo.');
  let dados;
  try { dados = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(corpo + '==='.slice((corpo.length + 3) % 4))).getDataAsString('UTF-8')); } catch (e) { throw new Error('Sessão inválida. Faça login de novo.'); }
  elnAssert_(dados && dados.e > Date.now(), 'Sessão expirada. Faça login de novo.');
  const acc = elnAcessos_().find(a => String(a.login).trim().toLowerCase() === dados.l && elnTrue_(a.ativo));
  elnAssert_(acc && elnDigest_(String(acc.senha)).slice(0, 12) === dados.v, 'Sessão encerrada (acesso alterado). Faça login de novo.');
  return dados.l;
}

/** Devolve todas as respostas para o painel (somente com login). */
function elnResultados_(req) {
  const login = elnAuth_(req.token);
  const sh = elnAba_(ELN_ABAS.RESP);
  const cab = elnCabecalho_(sh);
  const linhas = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues() : [];
  const p = elnParametros_();
  return {
    linhas: linhas.filter(r => String(r[0] || '').trim()).map(r => { const o = {}; cab.forEach((c, i) => { if (c) o[c] = elnVal_(r[i]); }); return o; }),
    total: linhas.length, login: login, planilha_url: elnUrlPlanilha_(), url_app: elnUrlApp_(),
    dicionario_versao: String(p.DICIONARIO_VERSAO || ''), ubs_padrao: String(p.UBS_PADRAO || ELN_UBS_PADRAO)
  };
}

/** Grava na aba Dicionario o texto de cada pergunta e o significado de cada código (enviado pelo painel). */
function elnDicionario_(req) {
  const login = elnAuth_(req.token);
  const versao = elnClean_(req.versao, 20);
  const itens = Array.isArray(req.perguntas) ? req.perguntas.slice(0, 120) : [];
  elnAssert_(versao && itens.length, 'Dicionário vazio.');
  return elnLock_(() => {
    const sh = elnAba_(ELN_ABAS.DIC);
    const linhas = itens.map(q => [elnClean_(q.codigo, 40), elnClean_(q.etapa, 40), elnCell_(elnClean_(q.pergunta, 400)), elnClean_(q.tipo, 40), elnCell_(elnClean_(q.opcoes, 2000))]);
    sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), 5).clearContent();
    sh.getRange(2, 1, linhas.length, 5).setValues(linhas);
    elnSetParametro_('DICIONARIO_VERSAO', versao, 'Versão do questionário descrita na aba Dicionario (atualizada pelo painel).');
    elnAuditoria_(login, 'DICIONARIO', 'versão ' + versao);
    return {atualizado: true};
  });
}

/* ============================== CONFIGURAÇÃO ============================== */

/** Execute uma vez no editor (e de novo depois de atualizar o código). Cria o que faltar; não apaga nada. */
function configurarElNino() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || (ELN_PLANILHA_ID ? SpreadsheetApp.openById(ELN_PLANILHA_ID) : null);
  elnAssert_(ss, 'Abra o editor pela planilha (Extensões > Apps Script) ou preencha ELN_PLANILHA_ID em Config.gs.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty(ELN_SS_PROP, ss.getId());
  if (!props.getProperty(ELN_SECRET_PROP)) props.setProperty(ELN_SECRET_PROP, Utilities.getUuid() + Utilities.getUuid());

  const aba = (nome, cab, cor) => {
    let sh = ss.getSheetByName(nome);
    if (!sh) sh = ss.insertSheet(nome);
    const atual = elnCabecalho_(sh).filter(String);
    const faltam = cab.filter(c => atual.indexOf(c) < 0);
    if (!atual.length) sh.getRange(1, 1, 1, cab.length).setValues([cab]);
    else if (faltam.length) sh.getRange(1, atual.length + 1, 1, faltam.length).setValues([faltam]);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#8b0c11').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (cor) sh.setTabColor(cor);
    return sh;
  };
  aba(ELN_ABAS.RESP, ELN_META, '#a4161d');
  const acessos = aba(ELN_ABAS.ACESSOS, ['login', 'senha', 'ativo', 'criado_em', 'observacao'], '#e67e22');
  const param = aba(ELN_ABAS.PARAM, ['chave', 'valor', 'descricao']);
  aba(ELN_ABAS.DIC, ['codigo', 'etapa', 'pergunta', 'tipo', 'opcoes']);
  aba(ELN_ABAS.AUD, ['quando', 'login', 'acao', 'detalhe'], '#e67e22');

  const p = elnParametros_();
  if (!('UBS_PADRAO' in p)) param.appendRow(['UBS_PADRAO', ELN_UBS_PADRAO, 'Nome da unidade quando o link não traz ?ubs=Nome.']);
  if (!('FORM_ABERTO' in p)) param.appendRow(['FORM_ABERTO', 'sim', 'Escreva "não" para encerrar o recebimento de respostas.']);
  if (!('DICIONARIO_VERSAO' in p)) param.appendRow(['DICIONARIO_VERSAO', '', 'Preenchido automaticamente pelo painel.']);

  let senhaNova = '';
  if (acessos.getLastRow() < 2) {
    senhaNova = elnNovaSenha_();
    acessos.appendRow(['coordenacao', senhaNova, 'sim', elnNow_(), 'Acesso ao painel. Troque a senha aqui quando quiser.']);
  }

  let instr = ss.getSheetByName(ELN_ABAS.INSTR);
  if (!instr) instr = ss.insertSheet(ELN_ABAS.INSTR);
  instr.clear();
  instr.getRange(1, 1, 9, 1).setValues([
    [ELN_TITULO],
    ['Respostas: uma linha por pessoa. Não apague nem edite linhas; use filtros ou copie para outra aba.'],
    ['Múltipla escolha fica gravada como códigos separados por " | ". O significado de cada código está na aba Dicionario.'],
    ['Acessos: login e senha do painel. Mude a senha ou escreva "não" em ativo para encerrar o acesso (a sessão cai na hora).'],
    ['Parametros: UBS_PADRAO (nome da unidade) e FORM_ABERTO (sim/não).'],
    ['Abas em laranja guardam credenciais ou registros de acesso. Mantenha a planilha com compartilhamento Restrito.'],
    ['Formulário (GitHub Pages): ' + ELN_GITHUB_PAGES_URL],
    ['Para outra UBS, use o mesmo link com ?ubs=Nome%20da%20UBS no final.'],
    ['Versão do servidor: ' + ELN_VERSAO]
  ]);
  instr.getRange(1, 1).setFontWeight('bold').setFontSize(14).setFontColor('#8b0c11');
  instr.setColumnWidth(1, 900);

  try { ss.rename(ss.getName().indexOf('El Niño') >= 0 ? ss.getName() : 'El Niño · Escuta da UBS — respostas'); } catch (e) { /* opcional */ }
  const msg = 'Configuração concluída. ' + (senhaNova ? 'Login do painel: coordenacao · senha: ' + senhaNova + ' (também está na aba Acessos).' : 'Acessos já existentes foram mantidos.');
  console.log(msg);
  return msg;
}

/** Mostra o estado da conexão sem alterar nada. */
function verificarElNino() {
  const ss = elnSs_();
  const info = {planilha: ss.getName(), url: ss.getUrl(), abas: ss.getSheets().map(s => s.getName()), respostas: Math.max(0, elnAba_(ELN_ABAS.RESP).getLastRow() - 1), url_app: elnUrlApp_(), ping: elnPing_()};
  console.log(JSON.stringify(info, null, 2));
  return info;
}
