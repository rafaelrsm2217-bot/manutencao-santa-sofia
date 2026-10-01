/**
 * Manutenção - Faz. Santa Sofia
 * Apps Script que guarda os dados do sistema numa Google Planilha.
 *
 * - Leitura (GET): liberada. Qualquer pessoa com o link do site vê os dados.
 * - Gravação (POST): só aceita se a senha enviada for igual à SENHA
 *   guardada em Propriedades do script. A senha não fica no GitHub.
 *
 * Como configurar a senha:
 *   Configurações do projeto (ícone de engrenagem) > Propriedades do script >
 *   Adicionar propriedade > Propriedade: SENHA  |  Valor: a senha que você quiser.
 */

const ABA = 'dados';
const TAMANHO_PARTE = 45000; // cada célula aceita até 50.000 caracteres

function getAba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA);
  if (!sh) {
    sh = ss.insertSheet(ABA);
    sh.appendRow(['chave', 'parte', 'valor', 'atualizado em']);
    sh.getRange('C:C').setNumberFormat('@');
  }
  return sh;
}

function senhaCorreta_(senha) {
  const certa = PropertiesService.getScriptProperties().getProperty('SENHA');
  return !!certa && String(senha || '') === String(certa);
}

function ler_(chave) {
  const sh = getAba_();
  const linhas = sh.getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0] === chave; })
    .sort(function (a, b) { return Number(a[1]) - Number(b[1]); });
  if (!linhas.length) return null;
  return linhas.map(function (r) { return String(r[2]); }).join('');
}

function gravar_(chave, valor) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getAba_();
    const dados = sh.getDataRange().getValues();
    for (let i = dados.length - 1; i >= 1; i--) {
      if (dados[i][0] === chave) sh.deleteRow(i + 1);
    }
    const partes = [];
    for (let i = 0; i < valor.length; i += TAMANHO_PARTE) partes.push(valor.slice(i, i + TAMANHO_PARTE));
    if (!partes.length) partes.push('');
    const agora = new Date();
    const linhas = partes.map(function (p, i) { return [chave, i, p, agora]; });
    const inicio = sh.getLastRow() + 1;
    sh.getRange(inicio, 3, linhas.length, 1).setNumberFormat('@');
    sh.getRange(inicio, 1, linhas.length, 4).setValues(linhas);
  } finally {
    lock.releaseLock();
  }
}

function resposta_(obj, callback) {
  const txt = JSON.stringify(obj);
  if (callback && /^[\w.$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + txt + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'check') {
    Utilities.sleep(400); // atrasa tentativas de adivinhar a senha
    return resposta_({ ok: senhaCorreta_(p.senha) }, p.callback);
  }
  const chave = p.key;
  return resposta_({ key: chave, value: chave ? ler_(chave) : null }, p.callback);
}

function doPost(e) {
  let corpo = {};
  try { corpo = JSON.parse(e.postData.contents); } catch (err) {
    return resposta_({ ok: false, erro: 'formato' });
  }
  if (!senhaCorreta_(corpo.senha)) return resposta_({ ok: false, erro: 'senha' });
  if (!corpo.key) return resposta_({ ok: false, erro: 'chave' });
  gravar_(String(corpo.key), String(corpo.value == null ? '' : corpo.value));
  return resposta_({ ok: true });
}
