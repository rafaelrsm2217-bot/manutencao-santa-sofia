/* Manutenção - Faz. Santa Sofia
   Armazenamento: Google Planilha via Apps Script (mesmo modelo do painel de fertilizantes).
   Leitura liberada para quem tem o link; gravação só com a senha, conferida pelo Apps Script. */
const Store=(()=>{
  const CFG=window.SS_CONFIG||{};
  const remote=!!(CFG.API_URL&&/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(CFG.API_URL));
  const KEY=CFG.DATA_KEY||'manutencao_santa_sofia';
  const CACHE='ss_manut_cache_'+KEY;
  let state=vazio(), last='', pin=null, statusFn=()=>{};
  const subs={maquinas:[],revisoes:[]};
  function vazio(){return {maquinas:{},revisoes:{},atualizadoEm:null}}
  function norm(d){d=d&&typeof d==='object'?d:{};return {maquinas:d.maquinas&&typeof d.maquinas==='object'?d.maquinas:{},revisoes:d.revisoes&&typeof d.revisoes==='object'?d.revisoes:{},atualizadoEm:d.atualizadoEm||null}}
  function emit(force){const j=JSON.stringify(state);if(!force&&j===last)return;last=j;for(const c in subs){const docs=Object.entries(state[c]).map(([id,d])=>({id,data:()=>d}));subs[c].forEach(f=>f({docs}))}}
  function cache(){try{localStorage.setItem(CACHE,JSON.stringify(state))}catch(e){}}
  function hora(){return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
  function jsonp(params){return new Promise(res=>{const cb='ssJsonp_'+Math.random().toString(36).slice(2);const s=document.createElement('script');let done=false;const clean=()=>{delete window[cb];s.remove()};window[cb]=d=>{done=true;res(d);clean()};s.onerror=()=>{if(!done){res(null);clean()}};const q=Object.entries(params).map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');s.src=CFG.API_URL+'?'+q+'&_='+Date.now()+'&callback='+cb;document.body.appendChild(s);setTimeout(()=>{if(!done){res(null);clean()}},12000)})}
  async function lerRemoto(){const d=await jsonp({key:KEY});if(!d)throw {code:'unavailable'};let v=null;try{v=d.value?JSON.parse(d.value):null}catch(e){v=null}return norm(v)}
  async function gravarRemoto(){
    const body=JSON.stringify({key:KEY,value:JSON.stringify(state),senha:pin||''});
    await fetch(CFG.API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body});
    // confere se a planilha aceitou (resposta do POST não é legível fora do Google)
    const conf=await lerRemoto();
    if(conf.atualizadoEm!==state.atualizadoEm){state=conf;emit();throw {code:'senha'}}
  }
  async function carregar(){
    if(remote){
      try{state=await lerRemoto();cache();statusFn('Dados sincronizados com a Google Planilha · atualizado às '+hora())}
      catch(e){const c=JSON.parse(localStorage.getItem(CACHE)||'null');if(!c)throw e;state=norm(c);statusFn('Sem conexão com a planilha · mostrando os últimos dados vistos neste aparelho')}
    }else{
      try{state=norm(JSON.parse(localStorage.getItem(CACHE)||'null'))}catch(e){state=vazio()}
      statusFn('Modo de teste: os dados ficam só neste navegador. Configure a planilha em js/config.js para compartilhar.');
    }
    emit();
  }
  async function alterar(fn){
    if(remote){if(!pin)throw {code:'senha'};state=await lerRemoto()}
    fn(state);state.atualizadoEm=new Date().toISOString()+'#'+Math.random().toString(36).slice(2,7);
    emit();
    if(remote)await gravarRemoto();
    cache();statusFn((remote?'Salvo na Google Planilha às ':'Salvo neste navegador às ')+hora());
  }
  const novoId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const split=p=>{const [c,id]=p.split('/');return [c,id]};
  function docRef(path){const [c,id]=split(path);return {id,
    set:data=>alterar(s=>{s[c][id]=JSON.parse(JSON.stringify(data))}),
    update:data=>alterar(s=>{if(!s[c][id])throw {code:'invalid_argument'};s[c][id]={...s[c][id],...JSON.parse(JSON.stringify(data))}}),
    delete:()=>alterar(s=>{delete s[c][id]})}}
  return {
    collection:c=>({onSnapshot:fn=>{subs[c].push(fn)},add:async data=>{const id=novoId();await docRef(c+'/'+id).set(data);return {id}},doc:id=>docRef(c+'/'+(id||novoId()))}),
    doc:docRef,
    start:async()=>{await carregar();setInterval(()=>{if(document.visibilityState==='visible')carregar().catch(()=>{})},20000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')carregar().catch(()=>{})})},
    onStatus:f=>{statusFn=f},
    snapshot:()=>JSON.parse(JSON.stringify(state)),
    replaceAll:d=>alterar(s=>{const n=norm(d);s.maquinas=n.maquinas;s.revisoes=n.revisoes}),
    setPin:p=>{pin=p;try{p?sessionStorage.setItem('ss_manut_pin',p):sessionStorage.removeItem('ss_manut_pin')}catch(e){}},
    checkPin:async p=>{let ok;if(remote){const d=await jsonp({action:'check',senha:p});ok=!!(d&&d.ok)}else{ok=String(p)===String(CFG.SENHA_TESTE||'')}if(ok)Store.setPin(p);return ok},
    remote
  };
})();

(function(){
const CATS=['Óleo do motor','Filtro de óleo do motor','Filtro de combustível','Filtro separador de água','Filtro de ar primário','Filtro de ar secundário','Óleo hidráulico / transmissão','Filtro hidráulico','Óleo do diferencial / redutor','Graxa / lubrificação','Líquido de arrefecimento','Correia','Rolamento','Disco / lâmina','Ponteira / faca','Bico de pulverização','Corrente','Pneu / câmara','Peça','Mão de obra','Outro'];
const SEM_INTERVALO=['Mão de obra'];
const TIPOS_MAQ=['Trator','Colheitadeira','Pulverizador autopropelido','Caminhão','Pá carregadeira','Outro'];
const TIPOS_IMPL=['Plantadeira / semeadeira','Pulverizador de arrasto','Grade / arado','Subsolador','Distribuidor de adubo / calcário','Roçadeira','Carreta / graneleira','Plataforma','Implemento','Outro'];
const IMPL_ANTIGOS=['Plantadeira','Grade / Arado','Implemento'];
const classeOf=m=>(m&&m.classe)||(m&&(IMPL_ANTIGOS.includes(m.tipo)||(TIPOS_IMPL.includes(m.tipo)&&!TIPOS_MAQ.includes(m.tipo)))?'implemento':'maquina');
const CL={maquina:{plural:'Máquinas',sing:'Máquina',view:'frota',tipos:TIPOS_MAQ,novo:'Cadastrar máquina',horas:'Horímetro',ex:'ex.: Trator 01'},implemento:{plural:'Implementos',sing:'Implemento',view:'implementos',tipos:TIPOS_IMPL,novo:'Cadastrar implemento',horas:'Horas de uso',ex:'ex.: Plantadeira 12 linhas'}};
const isImpl=m=>classeOf(m)==='implemento';
function maqOptions(sel,grupo,vazio){const g=c=>{const l=S.maq.filter(m=>classeOf(m)===c).sort((a,b)=>a.nome.localeCompare(b.nome));return l.length?`<optgroup label="${CL[c].plural}">${l.map(m=>`<option value="${m.id}" ${m.id===sel?'selected':''}>${esc(m.nome)} · ${esc(m.tipo)}</option>`).join('')}</optgroup>`:''};return `<option value="">${vazio}</option>`+(grupo?g(grupo):g('maquina')+g('implemento'))}
const SERVICOS=['Revisão preventiva','Troca de óleo e filtros','Lubrificação','Manutenção corretiva','Troca de peças'];
const UNIDS=['un','L','kg','h'];
const S={maq:[],rev:[],view:'painel',ficha:null,editRev:null,db:null,dl:null,loaded:{m:false,r:false},offline:false,prefMaq:null};
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const nf=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const money=v=>brl.format(+v||0);
const hrs=v=>nf.format(+v||0);
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const fdate=s=>{if(!s)return'—';const[y,m,d]=s.split('-');return `${d}/${m}/${y}`};
const num=v=>{if(v===''||v==null)return 0;const n=parseFloat(String(v).replace(/\./g,'').replace(',','.'));return isNaN(n)?0:n};
const numIn=v=>{if(v===''||v==null)return NaN;const s=String(v).trim();if(/^\d{1,3}(\.\d{3})+$/.test(s))return parseFloat(s.replace(/\./g,''));const n=s.includes(',')?parseFloat(s.replace(/\./g,'').replace(',','.')):parseFloat(s);return n};
const itemTotal=it=>(+it.qtd||0)*(+it.valor||0);
const revTotal=r=>(r.itens||[]).reduce((a,it)=>a+itemTotal(it),0);
const maqById=id=>S.maq.find(m=>m.id===id);
const meter=(h,big)=>{const n=Math.round(+h||0);const s=String(n).padStart(6,'0');let lead=0;while(lead<s.length-1&&s[lead]==='0')lead++;return `<span class="meter${big?' big':''}"><span class="dim">${s.slice(0,lead)}</span>${s.slice(lead)}<small>H</small></span>`};

function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
function confirmBox(title,text,okLabel,onOk){
  const root=$('#modal-root');
  root.innerHTML=`<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p class="muted" style="margin:0">${esc(text)}</p><div class="row" style="justify-content:flex-end"><button class="btn" id="m-no">Cancelar</button><button class="btn primary" id="m-ok">${esc(okLabel)}</button></div></div></div>`;
  $('#m-no').onclick=()=>root.innerHTML='';
  $('#m-ok').onclick=async()=>{root.innerHTML='';await onOk()};
  $('#m-ok').focus();
}
function dbErr(e){console.error(e);const c=e&&e.code;toast(c==='senha'?'Senha recusada pela planilha. Entre de novo no modo de edição.':c==='quota_exceeded'?'Limite de armazenamento atingido. Apague registros antigos.':c==='invalid_argument'?'Você não tem permissão para alterar estes dados.':'Não foi possível salvar. Tente de novo.')}

/* ---------- componentes e alertas ---------- */
const POR_DESC=['Peça','Outro','Correia','Rolamento','Disco / lâmina','Ponteira / faca','Corrente','Pneu / câmara'];
function compKey(it){const c=it.categoria||'Outro';return POR_DESC.includes(c)?c+' · '+(it.descricao||'').trim().toLowerCase():c}
function componentes(m){
  if(isImpl(m))return [];
  const revs=S.rev.filter(r=>r.maquinaId===m.id).sort((a,b)=>(+a.horimetro||0)-(+b.horimetro||0)||String(a.data).localeCompare(b.data));
  const map=new Map();
  for(const r of revs)for(const it of (r.itens||[])){const iv=+it.intervalo||0;if(iv<=0)continue;map.set(compKey(it),{nome:POR_DESC.includes(it.categoria)?(it.descricao||it.categoria):it.categoria,descricao:it.descricao,ultima:+r.horimetro||0,data:r.data,intervalo:iv})}
  const atual=+m.horimetroAtual||0;
  return [...map.values()].map(c=>{const prox=c.ultima+c.intervalo;const falta=prox-atual;const lim=Math.max(25,c.intervalo*0.1);const st=falta<0?'bad':falta<=lim?'warn':'ok';const usado=Math.min(1,Math.max(0,(atual-c.ultima)/c.intervalo));return {...c,prox,falta,st,usado}}).sort((a,b)=>a.falta-b.falta)
}
const stLabel={ok:'Em dia',warn:'Próxima',bad:'Vencida',none:'Sem plano'};
function maqStatus(m){const cs=componentes(m);if(!cs.length)return 'none';if(cs.some(c=>c.st==='bad'))return 'bad';if(cs.some(c=>c.st==='warn'))return 'warn';return 'ok'}
function faltaTxt(c){return c.falta<0?`${hrs(-c.falta)} h atrasada`:`faltam ${hrs(c.falta)} h`}

/* ---------- render ---------- */
function setTab(v){S.view=v;document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.view===v||(v==='ficha'&&b.dataset.view===CL[classeOf(maqById(S.ficha))].view)?'true':'false'));render();window.scrollTo(0,0)}
document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>{if(b.dataset.view==='lancar'){S.editRev=null}setTab(b.dataset.view)});

function render(){
  const v=$('#view');
  if(S.offline){v.innerHTML=`<div class="section"><div class="banner err"><span>Não foi possível carregar os dados da planilha. Verifique a internet e tente de novo.</span><button class="btn sm" onclick="location.reload()">Tentar de novo</button></div></div>`;return}
  if(!(S.loaded.m&&S.loaded.r)){return}
  ({painel:vPainel,frota:v=>vFrota(v,'maquina'),implementos:v=>vFrota(v,'implemento'),ficha:vFicha,lancar:vLancar,gastos:vGastos}[S.view]||vPainel)(v);
}
function exemploBanner(){
  if(!S.maq.some(m=>m.exemplo)&&!S.rev.some(r=>r.exemplo))return '';
  return `<div class="banner"><span><b>Dados de exemplo.</b> As máquinas e revisões marcadas como exemplo servem só para você ver o sistema funcionando.</span><button class="btn sm edit-only" data-act="limpar-ex">Apagar exemplos</button></div>`
}
function excluirMaq(m,depois){
  const revs=S.rev.filter(r=>r.maquinaId===m.id);const C=CL[classeOf(m)];
  confirmBox('Excluir '+m.nome+'?',`O cadastro e ${revs.length===1?'a revisão lançada':'as '+revs.length+' revisões lançadas'} serão apagados. Isso não pode ser desfeito.`,'Excluir',async()=>{try{for(const r of revs)await S.db.doc('revisoes/'+r.id).delete();await S.db.doc('maquinas/'+m.id).delete();toast(C.sing+' excluído(a)');if(depois)depois()}catch(e){dbErr(e)}});
}
function bindCommon(v){
  v.querySelectorAll('[data-edit-maq]').forEach(b=>b.onclick=()=>{const m=maqById(b.dataset.editMaq);if(!m)return;maqForm(m,classeOf(m));const sl=$('#maq-form-slot');if(sl)sl.scrollIntoView({behavior:'smooth',block:'start'})});
  v.querySelectorAll('[data-del-maq]').forEach(b=>b.onclick=()=>{const m=maqById(b.dataset.delMaq);if(m)excluirMaq(m)});
  v.querySelectorAll('[data-act="limpar-ex"]').forEach(b=>b.onclick=()=>confirmBox('Apagar dados de exemplo?','As máquinas e revisões de exemplo serão removidas. Seus próprios registros continuam.','Apagar exemplos',async()=>{try{for(const r of S.rev.filter(r=>r.exemplo))await S.db.doc('revisoes/'+r.id).delete();for(const m of S.maq.filter(m=>m.exemplo))await S.db.doc('maquinas/'+m.id).delete();toast('Exemplos apagados')}catch(e){dbErr(e)}}));
  v.querySelectorAll('[data-ficha]').forEach(b=>b.onclick=()=>{S.ficha=b.dataset.ficha;setTab('ficha')});
  v.querySelectorAll('[data-horas]').forEach(b=>b.onclick=()=>horasModal(b.dataset.horas));
  v.querySelectorAll('[data-nova-rev]').forEach(b=>b.onclick=()=>{S.editRev=null;S.prefMaq=b.dataset.novaRev;setTab('lancar')});
}

function vPainel(v){
  const ano=String(new Date().getFullYear());
  const revAno=S.rev.filter(r=>String(r.data||'').startsWith(ano));
  const gastoAno=revAno.reduce((a,r)=>a+revTotal(r),0);
  const alertas=[];for(const m of S.maq)for(const c of componentes(m))alertas.push({m,c});
  alertas.sort((a,b)=>a.c.falta-b.c.falta);
  const venc=alertas.filter(a=>a.c.st==='bad').length, prox=alertas.filter(a=>a.c.st==='warn').length;
  const ult=[...S.rev].sort((a,b)=>String(b.data).localeCompare(a.data)).slice(0,6);
  if(!S.maq.length){v.innerHTML=`<div class="section">${exemploBanner()}<div class="panel empty"><h3>Nenhuma máquina ou implemento cadastrado</h3><p>Comece cadastrando seus tratores, colheitadeiras e implementos com o horímetro atual. Depois lance cada revisão com as peças, os valores e em quantas horas deve ser feita a próxima troca.</p><button class="btn primary edit-only" id="go-frota">Cadastrar primeira máquina</button></div></div>`;$('#go-frota').onclick=()=>{setTab('frota');setTimeout(()=>maqForm(),0)};return}
  v.innerHTML=`<div class="section">
    ${exemploBanner()}
    <div class="stats">
      <div class="stat"><span class="lbl">Trocas vencidas</span><b class="${venc?'bad':''}">${venc}</b></div>
      <div class="stat"><span class="lbl">Próximas da troca</span><b class="${prox?'warn':''}">${prox}</b></div>
      <div class="stat"><span class="lbl">Máquinas / implementos</span><b>${S.maq.filter(m=>classeOf(m)==='maquina').length} / ${S.maq.filter(m=>classeOf(m)==='implemento').length}</b></div>
      <div class="stat"><span class="lbl">Gasto em ${ano}</span><b>${money(gastoAno)}</b></div>
    </div>
    <div class="spread"><h2>Próximas trocas</h2><span class="hint">Ordenado pelo que vence primeiro, com base no último horímetro informado.</span></div>
    <div class="panel tbl-wrap">${alertas.length?`<table><thead><tr><th>Equipamento</th><th>Item</th><th class="r">Última troca</th><th class="r">Próxima em</th><th class="r">Horímetro atual</th><th>Situação</th></tr></thead><tbody>
      ${alertas.slice(0,40).map(({m,c})=>`<tr><td><button class="btn link" data-ficha="${m.id}">${esc(m.nome)}</button><div class="hint">${CL[classeOf(m)].sing}</div></td><td>${esc(c.nome)}<div class="hint">a cada ${hrs(c.intervalo)} h</div></td><td class="r mono">${hrs(c.ultima)} h</td><td class="r mono">${hrs(c.prox)} h</td><td class="r mono">${hrs(m.horimetroAtual)} h</td><td><span class="pill ${c.st}">${stLabel[c.st]}</span><div class="hint">${faltaTxt(c)}</div></td></tr>`).join('')}
    </tbody></table>`:`<div class="empty"><p>Nenhuma troca programada ainda. Ao lançar uma revisão, preencha "Próxima troca a cada (h)" em cada item para que o sistema avise quando vencer.</p></div>`}</div>
    <div class="spread"><h2>Últimas revisões</h2><button class="btn edit-only" id="go-lancar">Lançar revisão</button></div>
    <div class="panel tbl-wrap">${ult.length?`<table><thead><tr><th>Data</th><th>Equipamento</th><th>Serviço</th><th class="r">Horímetro</th><th class="r">Valor</th><th class="r edit-only">Ações</th></tr></thead><tbody>${ult.map(r=>{const m=maqById(r.maquinaId);return `<tr><td class="mono">${fdate(r.data)}</td><td>${m?`<button class="btn link" data-ficha="${m.id}">${esc(m.nome)}</button>`:'<span class="muted">Máquina removida</span>'}</td><td>${esc(r.servico)}</td><td class="r mono">${m&&isImpl(m)?'—':hrs(r.horimetro)+' h'}</td><td class="r">${money(revTotal(r))}</td><td class="r edit-only" style="white-space:nowrap"><button class="btn sm edit-only" data-edit-rev="${r.id}">Editar</button> <button class="btn sm danger edit-only" data-del-rev="${r.id}">Excluir</button></td></tr>`}).join('')}</tbody></table>`:`<div class="empty"><p>Nenhuma revisão lançada.</p></div>`}</div>
  </div>`;
  $('#go-lancar').onclick=()=>{S.editRev=null;setTab('lancar')};
  bindRevActions(v);
  bindCommon(v);
}

function vFrota(v,cl){
  const C=CL[cl];const ord={bad:0,warn:1,ok:2,none:3};
  const list=S.maq.filter(m=>classeOf(m)===cl).sort((a,b)=>ord[maqStatus(a)]-ord[maqStatus(b)]||a.nome.localeCompare(b.nome));
  const gastoGrupo=S.rev.filter(r=>{const m=maqById(r.maquinaId);return m&&classeOf(m)===cl}).reduce((a,r)=>a+revTotal(r),0);
  v.innerHTML=`<div class="section">
    ${exemploBanner()}
    <div class="spread"><div><h2>${C.plural}</h2><span class="hint">${list.length} cadastrad${cl==='maquina'?'as':'os'} · ${money(gastoGrupo)} em revisões no total</span></div><button class="btn primary edit-only" id="add-maq">${C.novo}</button></div>
    <div id="maq-form-slot"></div>
    ${list.length?`<div class="fleet">${list.map(m=>{if(cl==='implemento')return implCard(m);const st=maqStatus(m);const cs=componentes(m);const gasto=S.rev.filter(r=>r.maquinaId===m.id).reduce((a,r)=>a+revTotal(r),0);const prox=cs[0];return `<article class="card">
      <div class="spread"><span class="kind">${esc(m.tipo)}${m.exemplo?' · exemplo':''}</span><span class="pill ${st}">${stLabel[st]}</span></div>
      <div><h3>${esc(m.nome)}</h3><div class="meta">${esc([m.marca,m.modelo,m.ano].filter(Boolean).join(' · ')||'Sem modelo informado')}${m.identificacao?` · ${esc(m.identificacao)}`:''}</div></div>
      <div class="spread">${meter(m.horimetroAtual)}<span class="hint">${C.horas}${m.horimetroData?' · lido em '+fdate(m.horimetroData):''}</span></div>
      <div class="meta">${prox?`Próxima: <b style="color:var(--ink)">${esc(prox.nome)}</b> em ${hrs(prox.prox)} h (${faltaTxt(prox)})`:'Sem trocas programadas'}<br>Total gasto: <b style="color:var(--ink)">${money(gasto)}</b></div>
      <div class="foot"><button class="btn sm edit-only" data-horas="${m.id}">Atualizar horas</button><button class="btn sm edit-only" data-nova-rev="${m.id}">Lançar revisão</button><button class="btn sm link" data-ficha="${m.id}">Ver ficha</button></div>
      <div class="foot card-acts edit-only"><button class="btn sm edit-only" data-edit-maq="${m.id}">Editar</button><button class="btn sm danger edit-only" data-del-maq="${m.id}">Excluir</button></div>
    </article>`}).join('')}</div>`:`<div class="panel empty"><h3>${cl==='maquina'?'Nenhuma máquina cadastrada':'Nenhum implemento cadastrado'}</h3><p>${cl==='maquina'?'Cadastre tratores, colheitadeiras, pulverizadores autopropelidos e caminhões com o horímetro atual.':'Cadastre plantadeiras, grades, pulverizadores de arrasto, distribuidores e demais implementos. Para cada um você registra as revisões, a data e quanto foi gasto.'}</p><button class="btn primary edit-only" id="add-maq-2">${C.novo}</button></div>`}
  </div>`;
  $('#add-maq').onclick=()=>maqForm(null,cl);
  if($('#add-maq-2'))$('#add-maq-2').onclick=()=>maqForm(null,cl);
  bindCommon(v);
}

function implCard(m){
  const revs=S.rev.filter(r=>r.maquinaId===m.id).sort((a,b)=>String(b.data).localeCompare(a.data));
  const gasto=revs.reduce((a,r)=>a+revTotal(r),0);const u=revs[0];
  return `<article class="card">
    <div class="spread"><span class="kind">${esc(m.tipo)}${m.exemplo?' · exemplo':''}</span><span class="pill none">${revs.length} ${revs.length===1?'revisão':'revisões'}</span></div>
    <div><h3>${esc(m.nome)}</h3><div class="meta">${esc([m.marca,m.modelo,m.ano].filter(Boolean).join(' · ')||'Sem modelo informado')}${m.identificacao?` · ${esc(m.identificacao)}`:''}</div></div>
    <div class="meta">Última revisão: <b style="color:var(--ink)">${u?fdate(u.data)+' · '+esc(u.servico):'nenhuma lançada'}</b>${u?`<br>Gasto na última: <b style="color:var(--ink)">${money(revTotal(u))}</b>`:''}<br>Total gasto: <b style="color:var(--ink)">${money(gasto)}</b></div>
    <div class="foot"><button class="btn sm edit-only" data-nova-rev="${m.id}">Lançar revisão</button><button class="btn sm link" data-ficha="${m.id}">Ver ficha</button></div>
      <div class="foot card-acts edit-only"><button class="btn sm edit-only" data-edit-maq="${m.id}">Editar</button><button class="btn sm danger edit-only" data-del-maq="${m.id}">Excluir</button></div>
  </article>`
}

function maqForm(m,cl){
  const slot=$('#maq-form-slot');if(!slot)return;
  const e=m||{};cl=cl||(m?classeOf(m):'maquina');
  const tipoOpts=(c,sel)=>{const l=CL[c].tipos.slice();if(sel&&!l.includes(sel))l.unshift(sel);return l.map(t=>`<option ${t===sel?'selected':''}>${esc(t)}</option>`).join('')};
  slot.innerHTML=`<form class="panel panel-pad" id="mf" style="display:flex;flex-direction:column;gap:14px">
    <h3>${m?'Editar cadastro':CL[cl].novo}</h3>
    <div class="form-grid">
      <div class="field"><label for="mf-nome">Nome / apelido *</label><input id="mf-nome" required value="${esc(e.nome)}" placeholder="${CL[cl].ex}"></div>
      <div class="field"><label for="mf-cl">Grupo</label><select id="mf-cl"><option value="maquina" ${cl==='maquina'?'selected':''}>Máquina</option><option value="implemento" ${cl==='implemento'?'selected':''}>Implemento</option></select></div>
      <div class="field"><label for="mf-tipo">Tipo</label><select id="mf-tipo">${tipoOpts(cl,e.tipo)}</select></div>
      <div class="field"><label for="mf-marca">Marca</label><input id="mf-marca" value="${esc(e.marca)}"></div>
      <div class="field"><label for="mf-modelo">Modelo</label><input id="mf-modelo" value="${esc(e.modelo)}"></div>
      <div class="field"><label for="mf-ano">Ano</label><input id="mf-ano" inputmode="numeric" value="${esc(e.ano)}"></div>
      <div class="field"><label for="mf-id">Nº de série / chassi / placa</label><input id="mf-id" value="${esc(e.identificacao)}"></div>
      <div class="field" id="mf-hw" ${cl==='implemento'?'hidden':''}><label for="mf-h">Horímetro atual (h)</label><input id="mf-h" inputmode="decimal" value="${e.horimetroAtual??''}" placeholder="0"></div>
    </div>
    <div class="field"><label for="mf-obs">Observações</label><textarea id="mf-obs" placeholder="Óleo recomendado, capacidade, fornecedor de peças, trator que puxa...">${esc(e.obs)}</textarea></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" id="mf-cancel">Cancelar</button><button class="btn primary" type="submit">${m?'Salvar alterações':'Cadastrar'}</button></div>
  </form>`;
  $('#mf-nome').focus();
  $('#mf-cl').onchange=ev=>{const c=ev.target.value;$('#mf-tipo').innerHTML=tipoOpts(c,'');$('#mf-hw').hidden=c==='implemento';$('#mf-nome').placeholder=CL[c].ex};
  $('#mf-cancel').onclick=()=>slot.innerHTML='';
  $('#mf').onsubmit=async ev=>{ev.preventDefault();
    const h=numIn($('#mf-h').value);const hv=($('#mf-cl').value==='implemento'||isNaN(h))?0:h;
    const data={nome:$('#mf-nome').value.trim(),classe:$('#mf-cl').value,tipo:$('#mf-tipo').value,marca:$('#mf-marca').value.trim(),modelo:$('#mf-modelo').value.trim(),ano:$('#mf-ano').value.trim(),identificacao:$('#mf-id').value.trim(),obs:$('#mf-obs').value.trim(),horimetroAtual:hv,horimetroData:m&&+m.horimetroAtual===hv?(m.horimetroData||today()):today(),exemplo:m?!!m.exemplo:false,criadoEm:m?.criadoEm||new Date().toISOString()};
    if(!data.nome)return;
    const lbl=CL[data.classe].sing;
    try{ if(m) await S.db.doc('maquinas/'+m.id).set(data); else await S.db.collection('maquinas').add(data); toast(m?lbl+' atualizado(a)':lbl+' cadastrado(a)'); slot.innerHTML=''; render(); if(data.classe!==cl&&S.view!=='ficha')setTab(CL[data.classe].view)}catch(e){dbErr(e)}
  };
}

function horasModal(id){
  const m=maqById(id);if(!m)return;
  const root=$('#modal-root');
  root.innerHTML=`<div class="modal-bg"><form class="modal" id="hf"><h3>Atualizar horímetro</h3><div class="spread"><span>${esc(m.nome)}</span>${meter(m.horimetroAtual)}</div>
    <div class="field"><label for="hf-h">Nova leitura do horímetro (h)</label><input id="hf-h" inputmode="decimal" required value="${m.horimetroAtual??''}"></div>
    <div class="field"><label for="hf-d">Data da leitura</label><input id="hf-d" type="date" value="${today()}"></div>
    <p class="hint" id="hf-msg" style="margin:0"></p>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" id="hf-no">Cancelar</button><button class="btn primary">Salvar leitura</button></div></form></div>`;
  const inp=$('#hf-h');inp.select();
  $('#hf-no').onclick=()=>root.innerHTML='';
  $('#hf').onsubmit=async ev=>{ev.preventDefault();const h=numIn(inp.value);if(isNaN(h)){$('#hf-msg').textContent='Informe um número de horas, ex.: 1520 ou 1520,5.';return}
    if(h<(+m.horimetroAtual||0)&&!$('#hf').dataset.ok){$('#hf-msg').textContent=`A leitura é menor que a atual (${hrs(m.horimetroAtual)} h). Clique em Salvar de novo para confirmar, por exemplo após troca do horímetro.`;$('#hf').dataset.ok='1';return}
    try{await S.db.doc('maquinas/'+m.id).update({horimetroAtual:h,horimetroData:$('#hf-d').value||today()});root.innerHTML='';render();toast('Horímetro atualizado')}catch(e){dbErr(e)}};
}

function vFicha(v){
  const m=maqById(S.ficha);
  if(!m){setTab('frota');return}
  const C=CL[classeOf(m)];const impl=isImpl(m);
  const revs=S.rev.filter(r=>r.maquinaId===m.id).sort((a,b)=>String(b.data).localeCompare(a.data)||(+b.horimetro||0)-(+a.horimetro||0));
  const cs=componentes(m);
  const total=revs.reduce((a,r)=>a+revTotal(r),0);
  const hs=revs.map(r=>+r.horimetro||0).concat([+m.horimetroAtual||0]);
  const span=hs.length>1?Math.max(...hs)-Math.min(...revs.map(r=>+r.horimetro||0).concat([Infinity])):0;
  v.innerHTML=`<div class="section">
    <div><button class="btn link" id="back" style="padding-left:0">← ${C.plural}</button></div>
    <div class="spread"><div><span class="lbl" style="color:var(--accent)">${esc(m.tipo)}${m.exemplo?' · exemplo':''}</span><h2>${esc(m.nome)}</h2><div class="muted">${esc([m.marca,m.modelo,m.ano].filter(Boolean).join(' · '))}${m.identificacao?' · '+esc(m.identificacao):''}</div></div>${impl?'':meter(m.horimetroAtual,true)}</div>
    <div class="row"><button class="btn primary edit-only" data-nova-rev="${m.id}">Lançar revisão</button>${impl?'':`<button class="btn edit-only" data-horas="${m.id}">Atualizar horas</button>`}<button class="btn edit-only" id="edit-maq">Editar dados</button><button class="btn danger edit-only" id="del-maq">Excluir</button></div>
    <div id="maq-form-slot"></div>
    ${m.obs?`<div class="panel panel-pad"><span class="lbl">Observações</span><div style="white-space:pre-wrap">${esc(m.obs)}</div></div>`:''}
    <div class="stats">
      <div class="stat"><span class="lbl">Revisões</span><b>${revs.length}</b></div>
      <div class="stat"><span class="lbl">Total gasto</span><b>${money(total)}</b></div>
      <div class="stat" ${impl?'hidden':''}><span class="lbl">Custo por hora</span><b>${span>0?money(total/span):'—'}</b><span class="hint">${span>0?`sobre ${hrs(span)} h registradas`:'precisa de 2 leituras'}</span></div>
      <div class="stat"><span class="lbl">Última revisão</span><b style="font-size:24px">${revs[0]?fdate(revs[0].data):'—'}</b></div>
    </div>
    <div ${impl?'hidden':''} style="display:flex;flex-direction:column;gap:16px"><h3>Situação dos itens</h3>
    ${cs.length?`<div class="comp-grid">${cs.map(c=>`<div class="comp ${c.st}"><div class="spread"><b>${esc(c.nome)}</b><span class="pill ${c.st}">${stLabel[c.st]}</span></div><div class="gauge"><i style="width:${Math.round(c.usado*100)}%"></i></div><div class="hint num">Trocado em ${hrs(c.ultima)} h · ${fdate(c.data)}<br>Próxima em <b style="color:var(--ink)">${hrs(c.prox)} h</b> · ${faltaTxt(c)}</div></div>`).join('')}</div>`:`<p class="hint" style="margin:0">Nenhum item com intervalo de troca. Ao lançar a revisão, informe "Próxima troca a cada (h)".</p>`}
    </div><h3>Histórico de revisões</h3>
    <div class="panel">${revs.length?revs.map(revDetails).join(''):`<div class="empty"><p>Nenhuma revisão lançada para esta máquina.</p></div>`}</div>
  </div>`;
  $('#back').onclick=()=>setTab(C.view);
  $('#edit-maq').onclick=()=>maqForm(m,classeOf(m));
  $('#del-maq').onclick=()=>excluirMaq(m,()=>setTab(C.view));
  bindRevActions(v);bindCommon(v);
}
function revDetails(r){
  const impl=isImpl(maqById(r.maquinaId));
  return `<details class="rev"><summary><span class="mono num">${fdate(r.data)}</span><span class="d"><b>${esc(r.servico)}</b> <span class="hint">${[impl?'':hrs(r.horimetro)+' h',r.oficina?esc(r.oficina):''].filter(Boolean).map(x=>'· '+x).join(' ')}${r.exemplo?' · exemplo':''}</span></span><b class="num">${money(revTotal(r))}</b></summary>
  <div class="body"><div class="tbl-wrap"><table><thead><tr><th>Item</th><th>Descrição</th><th class="r">Qtd</th><th class="r">Valor un.</th><th class="r">Subtotal</th>${impl?'':'<th class="r">Próxima troca</th>'}</tr></thead><tbody>${(r.itens||[]).map(it=>`<tr><td>${esc(it.categoria)}</td><td>${esc(it.descricao)}</td><td class="r">${nf.format(+it.qtd||0)} ${esc(it.unidade||'')}</td><td class="r">${money(it.valor)}</td><td class="r">${money(itemTotal(it))}</td>${impl?'':`<td class="r mono">${+it.intervalo>0?`${hrs((+r.horimetro||0)+(+it.intervalo))} h <span class="hint">(+${hrs(it.intervalo)})</span>`:'—'}</td>`}</tr>`).join('')}</tbody></table></div>
  ${r.obs?`<div class="hint" style="white-space:pre-wrap">${esc(r.obs)}</div>`:''}
  <div class="row"><button class="btn sm edit-only" data-edit-rev="${r.id}">Editar</button><button class="btn sm danger edit-only" data-del-rev="${r.id}">Excluir revisão</button></div></div></details>`
}
function bindRevActions(v){
  v.querySelectorAll('[data-edit-rev]').forEach(b=>b.onclick=()=>{S.editRev=b.dataset.editRev;setTab('lancar')});
  v.querySelectorAll('[data-del-rev]').forEach(b=>b.onclick=()=>{const r=S.rev.find(x=>x.id===b.dataset.delRev);confirmBox('Excluir esta revisão?',`${r.servico} de ${fdate(r.data)} (${money(revTotal(r))}) será apagada.`,'Excluir',async()=>{try{await S.db.doc('revisoes/'+r.id).delete();toast('Revisão excluída')}catch(e){dbErr(e)}})});
}

/* ---------- lançar revisão ---------- */
function itemRow(it={},i){
  return `<div class="item-row" data-i="${i}">
    <div class="field"><label>Item</label><select class="it-cat">${CATS.map(c=>`<option ${c===(it.categoria||'Óleo do motor')?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Descrição / marca / código</label><input class="it-desc" value="${esc(it.descricao)}" placeholder="ex.: 15W40 CI-4, filtro P550..."></div>
    <div class="field"><label>Qtd</label><input class="it-qtd" inputmode="decimal" value="${it.qtd??1}"></div>
    <div class="field"><label>Unid.</label><select class="it-un">${UNIDS.map(u=>`<option ${u===(it.unidade||'un')?'selected':''}>${u}</option>`).join('')}</select></div>
    <div class="field"><label>Valor un. (R$)</label><input class="it-val" inputmode="decimal" value="${it.valor!=null?String(it.valor).replace('.',','):''}" placeholder="0,00"></div>
    <div class="field it-int-f"><label>Próxima troca a cada (h)</label><input class="it-int" inputmode="decimal" value="${it.intervalo||''}" placeholder="ex.: 250"></div>
    <div class="sub num">R$ 0,00</div>
    <button type="button" class="x" title="Remover item" aria-label="Remover item">×</button>
  </div>`
}
function vLancar(v){
  if(!S.edit){v.innerHTML=`<div class="section"><div class="panel empty"><h3>Lançamento bloqueado</h3><p>Para lançar ou editar revisões, entre no modo de edição com a senha.</p><button class="btn primary" id="go-pin">Digitar senha</button></div></div>`;$('#go-pin').onclick=()=>pinModal();return}
  if(!S.maq.length){v.innerHTML=`<div class="section"><div class="panel empty"><h3>Cadastre uma máquina ou implemento primeiro</h3><p>A revisão é lançada para um equipamento específico.</p><button class="btn primary edit-only" id="go">Cadastrar máquina</button></div></div>`;$('#go').onclick=()=>{setTab('frota');setTimeout(()=>maqForm(),0)};return}
  const r=S.editRev?S.rev.find(x=>x.id===S.editRev):null;
  const maqSel=r?r.maquinaId:(S.prefMaq||'');S.prefMaq=null;
  const its=r?(r.itens||[]):[{categoria:'Óleo do motor'},{categoria:'Filtro de óleo do motor'}];
  v.innerHTML=`<form class="section" id="rf">
    <div class="spread"><h2>${r?'Editar revisão':'Lançar revisão'}</h2>${r?'<button type="button" class="btn" id="rf-novo">Nova revisão em branco</button>':''}</div>
    <div class="panel panel-pad" style="display:flex;flex-direction:column;gap:14px">
      <div class="form-grid">
        <div class="field"><label for="rf-maq">Máquina ou implemento *</label><select id="rf-maq" required>${maqOptions(maqSel,'','Selecione...')}</select></div>
        <div class="field"><label for="rf-data">Data *</label><input id="rf-data" type="date" required value="${esc(r?.data||today())}"></div>
        <div class="field" id="rf-hw"><label for="rf-h">Horímetro na revisão (h) *</label><input id="rf-h" inputmode="decimal" value="${r?.horimetro??''}"><span class="hint" id="rf-hh"></span></div>
        <div class="field"><label for="rf-serv">Tipo de serviço</label><input id="rf-serv" list="servs" value="${esc(r?.servico||SERVICOS[0])}"><datalist id="servs">${SERVICOS.map(s=>`<option value="${s}">`).join('')}</datalist></div>
        <div class="field"><label for="rf-of">Mecânico / oficina</label><input id="rf-of" value="${esc(r?.oficina)}"></div>
      </div>
    </div>
    <div class="spread"><h3>Peças, óleos e serviços</h3><span class="hint" id="rf-ih">Preencha "Próxima troca a cada (h)" nos itens que têm troca periódica.</span></div>
    <div class="items" id="rf-items">${its.map((it,i)=>itemRow(it,i)).join('')}</div>
    <div><button type="button" class="btn" id="rf-add">+ Adicionar item</button></div>
    <div class="field"><label for="rf-obs">Observações</label><textarea id="rf-obs" placeholder="Defeitos encontrados, peças a comprar, nota fiscal...">${esc(r?.obs)}</textarea></div>
    <div class="panel total-bar"><div><span class="lbl">Total da revisão</span><div class="sum" id="rf-total">R$ 0,00</div></div><div class="row"><button type="button" class="btn" id="rf-cancel">Cancelar</button><button class="btn primary" type="submit">${r?'Salvar alterações':'Salvar revisão'}</button></div></div>
    <p class="hint" id="rf-msg" style="margin:0"></p>
  </form>`;
  const box=$('#rf-items');
  const recalc=()=>{let t=0;box.querySelectorAll('.item-row').forEach(row=>{const s=num(row.querySelector('.it-qtd').value)*num(row.querySelector('.it-val').value);t+=s;row.querySelector('.sub').textContent=money(s)});$('#rf-total').textContent=money(t)};
  const hint=()=>{const m=maqById($('#rf-maq').value);const im=!!m&&isImpl(m);$('#rf-hw').hidden=im;$('#rf-ih').hidden=im;box.classList.toggle('sem-horas',im);$('#rf-hh').textContent=m&&!im?`Último horímetro registrado: ${hrs(m.horimetroAtual)} h`:''};
  box.addEventListener('input',recalc);
  box.addEventListener('click',e=>{if(e.target.closest('.x')){const rows=box.querySelectorAll('.item-row');if(rows.length>1)e.target.closest('.item-row').remove();else{rows[0].querySelectorAll('input').forEach(i=>i.value='')}recalc()}});
  box.addEventListener('change',e=>{if(e.target.classList.contains('it-cat')){const row=e.target.closest('.item-row');const un=row.querySelector('.it-un');if(/Óleo|Líquido/.test(e.target.value))un.value='L';else if(/Graxa/.test(e.target.value))un.value='kg';else if(e.target.value==='Mão de obra')un.value='h';else un.value='un';if(SEM_INTERVALO.includes(e.target.value))row.querySelector('.it-int').value=''}});
  $('#rf-add').onclick=()=>{box.insertAdjacentHTML('beforeend',itemRow({categoria:'Peça'},box.children.length));recalc();box.lastElementChild.querySelector('.it-desc').focus()};
  $('#rf-maq').onchange=hint;hint();recalc();
  $('#rf-cancel').onclick=()=>{S.editRev=null;setTab('painel')};
  if($('#rf-novo'))$('#rf-novo').onclick=()=>{S.editRev=null;render()};
  $('#rf').onsubmit=async ev=>{ev.preventDefault();const msg=$('#rf-msg');
    const maquinaId=$('#rf-maq').value;const h=numIn($('#rf-h').value);
    if(!maquinaId){msg.textContent='Selecione a máquina.';return}
    const impl=isImpl(maqById(maquinaId));
    if(!impl&&isNaN(h)){msg.textContent='Informe o horímetro no momento da revisão, ex.: 1520.';return}
    const itens=[...box.querySelectorAll('.item-row')].map(row=>({categoria:row.querySelector('.it-cat').value,descricao:row.querySelector('.it-desc').value.trim(),qtd:num(row.querySelector('.it-qtd').value),unidade:row.querySelector('.it-un').value,valor:num(row.querySelector('.it-val').value),intervalo:impl?0:num(row.querySelector('.it-int').value)})).filter(it=>it.descricao||it.valor||it.intervalo);
    const data={maquinaId,data:$('#rf-data').value||today(),horimetro:impl?null:h,servico:$('#rf-serv').value.trim()||'Revisão',oficina:$('#rf-of').value.trim(),obs:$('#rf-obs').value.trim(),itens,total:itens.reduce((a,it)=>a+itemTotal(it),0),exemplo:r?!!r.exemplo:false,criadoEm:r?.criadoEm||new Date().toISOString()};
    try{
      if(r)await S.db.doc('revisoes/'+r.id).set(data);else await S.db.collection('revisoes').add(data);
      const m=maqById(maquinaId);if(m&&!impl&&h>(+m.horimetroAtual||0))await S.db.doc('maquinas/'+m.id).update({horimetroAtual:h,horimetroData:data.data});
      toast(r?'Revisão atualizada':'Revisão salva');S.editRev=null;S.ficha=maquinaId;setTab('ficha');
    }catch(e){dbErr(e)}
  };
}

/* ---------- gastos ---------- */
const G={grupo:'',maq:'',de:new Date().getFullYear()+'-01-01',ate:today()};
function vGastos(v){
  const revs=S.rev.filter(r=>(!G.grupo||classeOf(maqById(r.maquinaId))===G.grupo)&&(!G.maq||r.maquinaId===G.maq)&&(!G.de||r.data>=G.de)&&(!G.ate||r.data<=G.ate)).sort((a,b)=>String(b.data).localeCompare(a.data));
  const total=revs.reduce((a,r)=>a+revTotal(r),0);
  const porMaq=new Map();for(const r of revs){const o=porMaq.get(r.maquinaId)||{n:0,t:0,hs:[]};o.n++;o.t+=revTotal(r);o.hs.push(+r.horimetro||0);porMaq.set(r.maquinaId,o)}
  const porCat=new Map();for(const r of revs)for(const it of (r.itens||[])){porCat.set(it.categoria,(porCat.get(it.categoria)||0)+itemTotal(it))}
  const cats=[...porCat.entries()].sort((a,b)=>b[1]-a[1]);const maxC=cats.length?cats[0][1]:0;
  v.innerHTML=`<div class="section">
    <div class="spread"><h2>Gastos com manutenção</h2>${S.dl?'<button class="btn" id="csv">Exportar planilha (CSV)</button>':''}</div>
    <div class="panel panel-pad"><div class="form-grid">
      <div class="field"><label for="g-grupo">Grupo</label><select id="g-grupo"><option value="">Máquinas e implementos</option><option value="maquina" ${G.grupo==='maquina'?'selected':''}>Só máquinas</option><option value="implemento" ${G.grupo==='implemento'?'selected':''}>Só implementos</option></select></div>
      <div class="field"><label for="g-maq">Equipamento</label><select id="g-maq">${maqOptions(G.maq,G.grupo,'Todos')}</select></div>
      <div class="field"><label for="g-de">De</label><input type="date" id="g-de" value="${G.de}"></div>
      <div class="field"><label for="g-ate">Até</label><input type="date" id="g-ate" value="${G.ate}"></div>
    </div></div>
    <div class="stats">
      <div class="stat"><span class="lbl">Total no período</span><b>${money(total)}</b></div>
      <div class="stat"><span class="lbl">Revisões</span><b>${revs.length}</b></div>
      <div class="stat"><span class="lbl">Média por revisão</span><b>${revs.length?money(total/revs.length):'—'}</b></div>
      <div class="stat"><span class="lbl">Máquinas</span><b>${money(revs.filter(r=>classeOf(maqById(r.maquinaId))==='maquina').reduce((a,r)=>a+revTotal(r),0))}</b></div>
      <div class="stat"><span class="lbl">Implementos</span><b>${money(revs.filter(r=>classeOf(maqById(r.maquinaId))==='implemento').reduce((a,r)=>a+revTotal(r),0))}</b></div>
    </div>
    ${revs.length?`
    <h3>Por máquina e implemento</h3>
    <div class="panel tbl-wrap"><table><thead><tr><th>Equipamento</th><th>Grupo</th><th class="r">Revisões</th><th class="r">Horas entre revisões</th><th class="r">Custo por hora</th><th class="r">Total</th></tr></thead><tbody>
      ${[...porMaq.entries()].sort((a,b)=>b[1].t-a[1].t).map(([id,o])=>{const m=maqById(id);const sp=Math.max(...o.hs)-Math.min(...o.hs);return `<tr><td>${m?`<button class="btn link" data-ficha="${id}">${esc(m.nome)}</button>`:'<span class="muted">Removido</span>'}</td><td>${m?CL[classeOf(m)].sing:'—'}</td><td class="r">${o.n}</td><td class="r">${sp>0?hrs(sp)+' h':'—'}</td><td class="r">${sp>0?money(o.t/sp):'—'}</td><td class="r"><b>${money(o.t)}</b></td></tr>`}).join('')}
    </tbody></table></div>
    <h3>Por tipo de item</h3>
    <div class="panel panel-pad bars">${cats.map(([c,t])=>`<div class="bar"><span>${esc(c)}</span><div class="track"><div class="fill" style="width:${maxC?Math.max(1,t/maxC*100):0}%"></div></div><b class="num">${money(t)}</b></div>`).join('')}</div>
    <h3>Revisões no período</h3>
    <div class="panel">${revs.map(r=>{const m=maqById(r.maquinaId);return revDetails(r).replace('<span class="d">',`<span class="d"><span class="lbl" style="color:var(--accent)">${esc(m?m.nome:'Máquina removida')}</span><br>`)}).join('')}</div>
    `:`<div class="panel empty"><p>Nenhuma revisão neste período.</p></div>`}
  </div>`;
  $('#g-grupo').onchange=e=>{G.grupo=e.target.value;const m=maqById(G.maq);if(m&&G.grupo&&classeOf(m)!==G.grupo)G.maq='';render()};
  $('#g-maq').onchange=e=>{G.maq=e.target.value;render()};
  $('#g-de').onchange=e=>{G.de=e.target.value;render()};
  $('#g-ate').onchange=e=>{G.ate=e.target.value;render()};
  if($('#csv'))$('#csv').onclick=async()=>{
    const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';const n2=x=>String((+x||0).toFixed(2)).replace('.',',');
    const lines=[['Data','Grupo','Equipamento','Tipo','Serviço','Horímetro','Oficina','Item','Descrição','Qtd','Unid.','Valor un.','Subtotal','Próxima troca a cada (h)','Próxima troca em (h)'].map(q).join(';')];
    for(const r of revs){const m=maqById(r.maquinaId);for(const it of (r.itens||[]))lines.push([fdate(r.data),m?CL[classeOf(m)].sing:'',m?.nome,m?.tipo,r.servico,r.horimetro,r.oficina,it.categoria,it.descricao,String(it.qtd).replace('.',','),it.unidade,n2(it.valor),n2(itemTotal(it)),it.intervalo||'',+it.intervalo>0?(+r.horimetro||0)+(+it.intervalo):''].map(q).join(';'))}
    try{await S.dl.save({filename:`manutencao_${G.de||'inicio'}_${G.ate||'hoje'}.csv`,data:'﻿'+lines.join('\r\n')})}catch(e){if(e&&e.code!=='cancelled')toast('Não foi possível gerar o arquivo.')}
  };
  bindRevActions(v);bindCommon(v);
}

/* ---------- modo de edição (PIN) ---------- */
function setEdit(on){S.edit=on;if(!on)Store.setPin(null);document.body.classList.toggle('editing',on);const b=$('#modeBadge');b.textContent=on?'Modo de edição · Sair':'Somente visualização · Editar';b.classList.toggle('on',on);if(!on&&S.view==='lancar')S.view='painel';render()}
function pinModal(){
  const root=$('#modal-root');
  root.innerHTML=`<div class="modal-bg"><form class="modal" id="pf"><h3>Entrar em modo de edição</h3><p class="muted" style="margin:0">Digite a senha para cadastrar, lançar, editar e excluir.</p><input type="password" id="pf-pin" class="pin-input" autocomplete="current-password" aria-label="Senha"><p class="err-msg" id="pf-err" hidden>Senha incorreta ou sem conexão com a planilha.</p><div class="row" style="justify-content:flex-end"><button type="button" class="btn" id="pf-no">Cancelar</button><button class="btn primary">Entrar</button></div></form></div>`;
  $('#pf-pin').focus();
  $('#pf-no').onclick=()=>{root.innerHTML='';render()};
  $('#pf').onsubmit=async e=>{e.preventDefault();const pin=$('#pf-pin').value.trim();if(!pin)return;const btn=e.submitter||$('#pf button.primary');btn.disabled=true;btn.textContent='Verificando...';let ok=false;try{ok=await Store.checkPin(pin)}catch(err){ok=false}btn.disabled=false;btn.textContent='Entrar';if(ok){root.innerHTML='';setEdit(true);toast('Modo de edição ativado')}else{$('#pf-err').hidden=false;$('#pf-pin').select()}};
}
$('#modeBadge').onclick=()=>S.edit?setEdit(false):pinModal();

/* ---------- arquivos (CSV / backup) ---------- */
S.dl={save:async({filename,data})=>{const blob=data instanceof Blob?data:new Blob([data],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);return {status:'saved'}}};
$('#bk-exp').onclick=()=>S.dl.save({filename:`backup_manutencao_${today()}.json`,data:JSON.stringify(Store.snapshot(),null,1)});
$('#bk-imp').onclick=()=>$('#bk-file').click();
$('#bk-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const d=JSON.parse(await f.text());if(!d||typeof d.maquinas!=='object'||typeof d.revisoes!=='object')throw 0;confirmBox('Importar backup?',`O arquivo tem ${Object.keys(d.maquinas).length} equipamentos e ${Object.keys(d.revisoes).length} revisões. Ele vai substituir todos os dados atuais.`,'Importar',async()=>{try{await Store.replaceAll(d);toast('Backup importado')}catch(err){dbErr(err)}})}catch(err){toast('Arquivo inválido. Use um backup exportado por este sistema.')}};

/* ---------- conexão ---------- */
function refresh(){if(S.view==='lancar'&&document.getElementById('rf'))return;if(document.getElementById('mf')||$('#modal-root').innerHTML)return;render()}
(async()=>{
  try{const p=sessionStorage.getItem('ss_manut_pin');if(p){Store.setPin(p);S.edit=true}}catch(e){}
  setEdit(!!S.edit);
  S.db=Store;
  Store.collection('maquinas').onSnapshot(s=>{S.maq=s.docs.map(d=>({id:d.id,...d.data()}));S.loaded.m=true;refresh()});
  Store.collection('revisoes').onSnapshot(s=>{S.rev=s.docs.map(d=>({id:d.id,...d.data()}));S.loaded.r=true;refresh()});
  Store.onStatus(t=>{$('#status').textContent=t});
  try{await Store.start()}catch(e){console.error(e);S.offline=true;render()}
})();
})();
