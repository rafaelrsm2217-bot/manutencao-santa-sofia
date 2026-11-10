/* Aba Frotas - Manutenção Faz. Santa Sofia. Carregado depois de app.js */
(function(){
const TIPOS=['Trator','Pulverizador','Colheitadeira','Implemento','Semeadora','Distribuidor de fertilizante','Veículos','Motocicletas','Equipamentos'];
const IMPL=['Implemento','Semeadora','Distribuidor de fertilizante'];
const F={filtro:'todas',busca:''};
const ativa=m=>m.ativa!==false;
const A=()=>window.SS_APP;
const $=(s,r=document)=>r.querySelector(s);
const hoje=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};

function lista(){
  const {S,cmpEq}=A();const q=F.busca.trim().toLowerCase();
  return S.maq.filter(m=>F.filtro==='todas'||(F.filtro==='ativas')===ativa(m))
    .filter(m=>!q||[m.nome,m.apelido,m.tipo,m.marca,m.modelo,m.ano].join(' ').toLowerCase().includes(q))
    .sort(cmpEq);
}
function linhas(){
  const {esc}=A();const l=lista();
  return l.length?l.map(m=>`<tr><td><button class="btn link" data-ficha="${m.id}">${esc(m.nome)}</button></td><td>${esc(m.tipo)}</td><td>${esc(m.apelido||'')}</td><td>${esc(m.marca)}</td><td>${esc(m.modelo)}</td><td>${esc(m.ano)}</td><td><span class="pill ${ativa(m)?'ok':'none'}">${ativa(m)?'Ativa':'Inativa'}</span></td><td class="r edit-only"><button class="btn sm edit-only" data-ed="${m.id}">Editar</button></td></tr>`).join('')
    :'<tr><td colspan="8" class="hint">Nenhuma frota encontrada.</td></tr>';
}

function render(v){
  const {S}=A();
  const na=S.maq.filter(ativa).length;
  const fb=(k,t)=>`<button class="btn sm${F.filtro===k?' primary':''}" data-f="${k}">${t}</button>`;
  v.innerHTML=`<div class="section">
    <div class="spread"><div><h2>Frotas</h2><span class="hint">${S.maq.length} cadastradas · ${na} ativas · ${S.maq.length-na} inativas</span></div>
      <div class="row"><button class="btn" id="fr-rel">Relatório Ativas / Inativas</button><button class="btn primary edit-only" id="fr-novo">Nova frota</button></div></div>
    <div id="fr-slot"></div>
    <div class="row">${fb('todas','Todas')}${fb('ativas','Ativas')}${fb('inativas','Inativas')}<input id="fr-q" type="search" placeholder="Buscar frota, tipo, modelo..." value="${A().esc(F.busca)}" style="flex:1;min-width:160px"></div>
    <div class="panel tbl-wrap"><table><thead><tr><th>Frota</th><th>Tipo</th><th>Nome</th><th>Fabricante</th><th>Modelo</th><th>Ano</th><th>Situação</th><th class="r edit-only"></th></tr></thead><tbody id="fr-body">${linhas()}</tbody></table></div>
  </div>`;
  v.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{F.filtro=b.dataset.f;A().render()});
  $('#fr-q').oninput=e=>{F.busca=e.target.value;$('#fr-body').innerHTML=linhas()};
  $('#fr-body').onclick=e=>{
    const ed=e.target.closest('[data-ed]');if(ed){form(ed.dataset.ed);return}
    const fi=e.target.closest('[data-ficha]');if(fi){A().S.ficha=fi.dataset.ficha;A().setTab('ficha')}
  };
  $('#fr-novo').onclick=()=>form(null);
  $('#fr-rel').onclick=relatorio;
}

function form(id){
  const {S,esc,maqById,Store,toast,dbErr}=A();
  const m=id?maqById(id):null;const e=m||{};
  const slot=$('#fr-slot');
  const tipos=TIPOS.slice();if(e.tipo&&!tipos.includes(e.tipo))tipos.unshift(e.tipo);
  slot.innerHTML=`<form class="panel panel-pad" id="mf" style="display:flex;flex-direction:column;gap:14px">
    <h3>${m?'Editar frota':'Nova frota'}</h3>
    <div class="form-grid">
      <div class="field"><label for="ff-nome">Frota *</label><input id="ff-nome" required value="${esc(e.nome)}" placeholder="ex.: F-01"></div>
      <div class="field"><label for="ff-tipo">Tipo *</label><select id="ff-tipo">${tipos.map(t=>`<option ${t===e.tipo?'selected':''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label for="ff-ap">Nome</label><input id="ff-ap" value="${esc(e.apelido)}"></div>
      <div class="field"><label for="ff-fab">Fabricante *</label><input id="ff-fab" required value="${esc(e.marca)}"></div>
      <div class="field"><label for="ff-mod">Modelo</label><input id="ff-mod" value="${esc(e.modelo)}"></div>
      <div class="field"><label for="ff-ano">Ano</label><input id="ff-ano" inputmode="numeric" maxlength="4" value="${esc(e.ano)}"></div>
      <div class="field" id="ff-opw"><label for="ff-op">Operador</label><input id="ff-op" value="${esc(e.operador)}"></div>
      <div class="field"><label for="ff-at">Situação</label><select id="ff-at"><option value="1" ${ativa(e)?'selected':''}>Ativa</option><option value="0" ${ativa(e)?'':'selected'}>Inativa</option></select></div>
    </div>
    <p class="hint" id="ff-msg" style="margin:0"></p>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" id="ff-cancel">Cancelar</button><button class="btn primary">${m?'Salvar alterações':'Cadastrar'}</button></div>
  </form>`;
  const opVis=()=>{$('#ff-opw').hidden=$('#ff-tipo').value!=='Trator'};
  opVis();$('#ff-tipo').onchange=opVis;
  $('#ff-nome').focus();slot.scrollIntoView({behavior:'smooth',block:'start'});
  $('#ff-cancel').onclick=()=>{slot.innerHTML=''};
  $('#mf').onsubmit=async ev=>{
    ev.preventDefault();
    const nome=$('#ff-nome').value.trim(),marca=$('#ff-fab').value.trim();
    if(!nome||!marca){$('#ff-msg').textContent='Preencha Frota e Fabricante.';return}
    const tipo=$('#ff-tipo').value;
    const classe=(m&&m.tipo===tipo&&m.classe)?m.classe:(IMPL.includes(tipo)?'implemento':'maquina');
    const campos={nome,apelido:$('#ff-ap').value.trim(),classe,tipo,marca,modelo:$('#ff-mod').value.trim(),ano:$('#ff-ano').value.trim(),operador:tipo==='Trator'?$('#ff-op').value.trim():'',ativa:$('#ff-at').value==='1'};
    try{
      if(m)await Store.doc('maquinas/'+m.id).update(campos);
      else await Store.collection('maquinas').add({...campos,identificacao:'',obs:'',foto:null,anexos:[],horimetroAtual:0,horimetroData:hoje(),exemplo:false,criadoEm:new Date().toISOString()});
      toast(m?'Frota atualizada':'Frota cadastrada');slot.innerHTML='';A().render();
    }catch(er){dbErr(er)}
  };
}

function relatorio(){
  const {S,esc,cmpEq}=A();
  if(!$('#fr-print-css')){const st=document.createElement('style');st.id='fr-print-css';st.textContent='@media print{body>*:not(#modal-root){display:none!important}.rel-fr{position:static!important;overflow:visible!important}.rel-fr .noprint{display:none!important}}';document.head.appendChild(st)}
  const bloco=(t,arr)=>`<h2 style="margin:18px 0 6px">${t} (${arr.length})</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${['Frota','Tipo','Nome','Fabricante','Modelo','Ano'].map(h=>`<th style="text-align:left;border-bottom:1px solid #999;padding:5px">${h}</th>`).join('')}</tr></thead><tbody>${arr.sort(cmpEq).map(m=>`<tr>${[m.nome,m.tipo,m.apelido,m.marca,m.modelo,m.ano].map(x=>`<td style="border-bottom:1px solid #ddd;padding:5px">${esc(x||'')}</td>`).join('')}</tr>`).join('')||'<tr><td style="padding:5px">Nenhuma.</td></tr>'}</tbody></table>`;
  const todas=S.maq.slice();
  $('#modal-root').innerHTML=`<div class="rel-fr" style="position:fixed;inset:0;z-index:1000;overflow:auto;background:#fff;color:#000;padding:20px">
    <div class="row noprint" style="margin-bottom:12px"><button class="btn primary" id="fr-print">Imprimir / salvar PDF</button><button class="btn" id="fr-close">Fechar</button></div>
    <h1 style="margin:0">Relatório de Frotas - Faz. Santa Sofia</h1><div style="color:#555">Emitido em ${new Date().toLocaleDateString('pt-BR')}</div>
    ${bloco('Frotas Ativas',todas.filter(ativa))}${bloco('Frotas Inativas',todas.filter(m=>!ativa(m)))}</div>`;
  $('#fr-close').onclick=()=>{$('#modal-root').innerHTML=''};
  $('#fr-print').onclick=()=>window.print();
}

window.SS_FROTAS={render};
})();
