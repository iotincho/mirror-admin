/* Prototipo de diseño. Datos locales en memoria; no usa API ni almacenamiento. */
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const copy = value => structuredClone(value);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  menu:'M4 6h16M4 12h16M4 18h16', close:'M6 6l12 12M18 6L6 18',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  users:'M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M17 4a4 4 0 0 1 0 8M23 21v-2a4 4 0 0 0-3-3.87M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z',
  book:'M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2zM12 6v15',
  arrow:'M5 12h14M13 6l6 6-6 6', back:'M19 12H5M11 6l-6 6 6 6',
  chevron:'M9 5l7 7-7 7', check:'M5 12l4 4L19 6', clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  edit:'M16 3l5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z', plus:'M12 5v14M5 12h14',
  pause:'M8 4v16M16 4v16', play:'M7 4l14 8-14 8z', next:'M4 4l12 8-12 8zM20 4v16',
  refresh:'M21 4v6h-6M3 20v-6h6M19 7a8 8 0 0 0-14-1M5 17a8 8 0 0 0 14 1',
  info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  warning:'M12 3L1 21h22zM12 9v5M12 17h.01', calendar:'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  lock:'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3', up:'M5 14l7-7 7 7', down:'M5 10l7 7 7-7', trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', history:'M3 4v6h6M4 10a9 9 0 1 1-1 5M12 7v5l4 2',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`;
const button = (text, action, style = '', symbol = '', extra = '') => `<button class="button ${style}" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ''}${text}</button>`;
const pill = (text, kind = '', dot = false) => `<span class="pill ${kind}">${dot ? '<span class="dot"></span>' : ''}${text}</span>`;
const notice = (text, kind = '', title = '') => `<div class="notice ${kind}">${icon(kind === 'warning' || kind === 'error' ? 'warning' : 'info')}<div>${title ? `<strong>${title}</strong>` : ''}${text}</div></div>`;
const day = 86400000;
const instant = value => new Date(value).getTime();
const originalNow = instant('2026-11-03T12:00:00-03:00');
const viewZone = () => draft && sheet.open ? draft.timezone : state?.run?.timezone || 'America/Argentina/Buenos_Aires';
const date = value => new Intl.DateTimeFormat('es-AR', {day:'numeric',month:'short',timeZone:viewZone()}).format(value).replace('.', '');
const hour = value => new Intl.DateTimeFormat('es-AR', {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:viewZone()}).format(value);
const range = stage => `${date(stage.start)} → ${date(stage.end)}`;
const goal = (stage, run) => JSON.stringify([run.purpose, run.instructions, stage.objective, stage.instructions]);
const validQuestion = text => text.trim() === text && text.length > 0 && text.length <= 240 && !/[\r\n]/.test(text) && (text.match(/\?/g) || []).length === 1;
const validPrompts = stage => stage.prompts.every(p => ['gentle','middle','deep'].every(d => validQuestion(p[d])) && new Set([p.gentle,p.middle,p.deep]).size === 3);
const approved = (stage, run) => stage.approval === goal(stage, run) && validPrompts(stage);
const depths = {gentle:'Suave', middle:'Intermedia', deep:'Profunda'};

const definitions = [
  ['explore','Qué quiero explorar','Identificar una inquietud o propósito primario, todavía provisional.','Permitir que la intención empiece imprecisa y permanezca abierta.',[
    ['¿Qué te gustaría explorar hoy?','¿Qué te trae a esta búsqueda en este momento?','¿Qué vuelve significativa para vos esta búsqueda?'],
    ['¿Qué aspecto de estos días tenés presente?','¿Qué de tu momento actual te gustaría comprender mejor?','¿Qué relación encontrás entre tu momento actual y lo que querés explorar?'],
    ['¿Hay alguna duda que quieras dejar escrita?','¿Qué parte de tu búsqueda todavía no sabés cómo nombrar?','¿Qué te gustaría permitirte explorar sin resolverlo todavía?']]],
  ['meaning','Qué significa para mí','Explorar las palabras elegidas, los deseos, expectativas y tensiones.','No suponer causas ni conducir hacia una explicación particular.',[
    ['¿Qué palabra de tu intención te llama la atención?','¿Qué significa para vos esa palabra que elegiste?','¿Cómo reconocerías en tu vida eso que querés expresar con esa palabra?'],
    ['¿Qué expectativa tenés presente hoy?','¿Qué esperás encontrar en esta búsqueda?','¿Qué lugar te gustaría darle a esa expectativa si el resultado fuera distinto?'],
    ['¿Hay algo de tu intención que hoy quieras revisar?','¿Qué dudas aparecen al volver sobre tu intención?','¿Qué te gustaría comprender de esas dudas sin apurarte a resolverlas?']]],
  ['daily-life','Cómo aparece en mi vida','Reconocer situaciones cotidianas y vínculos relacionados con el propósito.','Invitar a nombrar ejemplos concretos sin exigir profundizar.',[
    ['¿Qué momento cotidiano querés dejar anotado?','¿En qué situación reciente reconocés algo de lo que querés explorar?','¿Qué te permite ver esa situación sobre tu intención?'],
    ['¿Qué encuentro de estos días tenés presente?','¿Cómo aparece tu intención en algún vínculo cotidiano?','¿Qué te gustaría comprender de tu lugar en ese vínculo?'],
    ['¿Qué reacción tuya te dio curiosidad últimamente?','¿Cómo respondiste en una situación relacionada con tu intención?','¿Qué necesitabas en ese momento, según lo ves hoy?']]],
  ['intention','Qué intención quiero llevar','Revisar lo escrito y formular una intención propia, flexible y revisable.','Incluir dudas, límites y apoyos, sin exigir una conclusión perfecta.',[
    ['¿Qué palabra llevarías hoy a tu intención?','¿Cómo expresarías ahora lo que te gustaría explorar?','¿Qué cambió en tu manera de nombrar tu intención desde que comenzaste?'],
    ['¿Qué apoyo te gustaría tener presente?','¿Qué necesitás poder expresar o pedir a quienes te acompañan?','¿Qué límite te gustaría comunicar para cuidar tu proceso?'],
    ['¿Qué pregunta te gustaría dejar abierta?','¿Qué te gustaría explorar aunque el resultado sea incierto?','¿Qué lugar querés darles a tus dudas al decidir cómo continuar?']]],
];
function template(start = instant('2026-10-27T12:00:00-03:00')) {
  const run = {name:'Preparación e intención',purpose:'Acompañar la exploración de una intención personal durante la preparación.',instructions:'Invitar a explorar sin inducir recuerdos, causas ni resultados esperados. Respetar límites y dar lugar a posponer o decidir no continuar. No evaluar aptitud clínica ni recomendar sustancias, dosis o cambios de medicación.',timezone:'America/Argentina/Buenos_Aires',status:'active',current:1,revision:3,start,stages:[],history:[]};
  let cursor = start;
  definitions.forEach(([id,name,objective,instructions,questions], i) => {
    const end = i === 0 ? instant(new Date(start).toISOString().slice(0,10) + 'T00:00:00-03:00') + 7 * day : cursor + 7 * day;
    const stage = {id,name,objective,instructions,days:7,start:cursor,end,prompts:questions.map((q,j) => ({key:`${id}-${j}`,gentle:q[0],middle:q[1],deep:q[2]}))};
    stage.approval = goal(stage, run); run.stages.push(stage); cursor = end;
  });
  run.history = [
    {revision:3,title:'Ajuste de indicaciones',detail:'Se precisó la orientación de la segunda etapa. Preguntas de respaldo revisadas.',at:originalNow - 45 * 60000,run:copy({...run,history:[]})},
    {revision:2,title:'Intención actualizada por el usuario',detail:'Se actualizó el contexto de las preguntas futuras. El texto personal permanece en su app.',at:originalNow-day},
    {revision:1,title:'Recorrido activado desde template v2',detail:'Cuatro etapas de siete días con avance automático.',at:start},
  ];
  return run;
}
let state, draft, sheetMode, editorIndex = 1, depth = 'middle', wizardStep = 1, wizardZone = 'America/Argentina/Buenos_Aires', wizardAccepted = false;
let scenario = 'active', activeTab = 'journals', returnFocus, catalogReturn = 'changes', deferred = false, busy = false, nextOutcome = 'success', errors = '', conflictResolved = false, commitCount = 0, toastTimer;
let modalAction = null;
let baseRun = null, localStageSequence = 0;
let conflictChoices = {};
const sheet = $('#sheet'), modal = $('#modal');

function reset(value = 'active') {
  sheet.close(); modal.close(); $('#toast').hidden = true;
  scenario=value; state={run:template(),now:originalNow,globalEnabled:true,accountActive:true,screen:'account',load:'ready',archives:[]};
  nextOutcome='success'; draft=null; errors=''; deferred=false; busy=false; conflictResolved=false; activeTab='journals';
  if(value==='empty') state.run=null;
  if(value==='paused'){state.run.status='paused';state.run.pausedAt=originalNow;state.now=originalNow+2*day;}
  if(value==='completed'){state.run.status='completed';state.run.current=4;state.now=originalNow+22*day;}
  if(value==='closed'){state.run.status='closed';state.run.closedAt=originalNow;}
  if(value==='review') state.run.stages[1].objective='Explorar qué significa la confianza en situaciones de desacuerdo.';
  if(value==='loading') state.load='loading';
  if(value==='error') state.load='error';
  if(value==='disabled') state.globalEnabled=false;
  if(value==='inactive') state.accountActive=false;
  if(value==='missing') state.load='missing';
  if(value==='conflict'||value==='conflict-field'||value==='save-error'||value==='ambiguous') nextOutcome=value;
  $('#scenario').value=value;render();
  if(['conflict','conflict-field','save-error','ambiguous'].includes(value)){
    openEditor(1);draft.stages[1].instructions='Invitar a reconocer qué significa la confianza en situaciones cotidianas, sin suponer causas.';renderSheet();
  }
}
function toast(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000);}
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=icon(node.dataset.icon);});}
function statusPill(run){return pill({active:'Activo',paused:'Pausado',completed:'Completado',closed:'Cerrado'}[run.status],run.status==='paused'?'gold':run.status==='active'?'':'neutral',run.status==='active');}
function isEditable(){return !!state.run && ['active','paused'].includes(state.run.status) && state.globalEnabled && state.accountActive;}
function pending(run){return run.stages.map((stage,i)=>i>=run.current&&!approved(stage,run)?i:null).filter(i=>i!==null);}
function currentStage(run=state.run){return run.stages[Math.min(run.current,run.stages.length-1)];}
function bottomNote(){return `<p class="bottom-note">${icon('lock')}<span>Este panel configura el recorrido. La intención personal, las notas y los audios permanecen en la app del usuario.</span></p>`;}
function header(){return `<div class="breadcrumbs"><a href="#users" data-page="users">Usuarios</a>${icon('chevron')}<a href="#account" data-page="account">piloto@example.com</a>${icon('chevron')}<span>Journals</span></div><div class="page-heading"><div><p class="eyebrow">ACOMPAÑAMIENTO</p><h1>Journals</h1><p>Un propósito, un recorrido y espacio para ajustarlo.</p></div>${button('Volver a Usuarios','users','','back')}</div><div class="account-strip"><span class="avatar">${icon('users')}</span><div class="grow"><strong>piloto@example.com</strong><small>Cuenta de prueba · 10000000…0001</small></div>${pill(state.accountActive?'Habilitada':'Deshabilitada',state.accountActive?'':'neutral')}</div><div class="tabs" role="tablist" aria-label="Detalle de cuenta"><button class="tab" role="tab" aria-selected="${activeTab==='summary'}" data-action="tab" data-tab="summary">Resumen</button><button class="tab" role="tab" aria-selected="${activeTab==='journals'}" data-action="tab" data-tab="journals">Journals <span class="count">${state.run?1:0}</span></button></div>`;}
function render(){
  let html='';
  if(state.screen==='users') html=`<div class="page-heading"><div><p class="eyebrow">CUENTAS</p><h1>Usuarios</h1><p>Estado de las cuentas y uso de la plataforma.</p></div></div><section class="card card-pad"><div class="row wrap"><span class="avatar">${icon('users')}</span><div class="grow"><h3>piloto@example.com</h3><p class="muted small">Cuenta de prueba · Datos ficticios</p></div>${pill('Habilitada')}${button('Ver cuenta','account','','arrow')}</div></section>`;
  else if(state.screen==='dashboard') html=`<div class="page-heading"><div><p class="eyebrow">GENERAL</p><h1>Una mirada a la plataforma</h1><p>Este prototipo se concentra en el acompañamiento desde una cuenta.</p></div></div>${button('Ir a Usuarios','users','primary','users')}`;
  else {html=header();
    if(activeTab==='summary')html+=`<section class="card card-pad"><h3>Identidad de la cuenta</h3><div class="rule"></div><div class="main-summary"><div><span class="label">Identificador</span><p style="overflow-wrap:anywhere">10000000-0000-4000-8000-000000000001</p></div><div><span class="label">Fecha de alta</span><p>20 oct 2026, 9:00</p></div><div><span class="label">Última actividad</span><p>Sin datos</p></div><div><span class="label">Notas existentes</span><p>Sin datos</p></div></div><div class="rule"></div>${button('Ver Journals de esta cuenta','journals','','book')}</section>`;
    else if(state.load==='loading')html+=`<section class="card card-pad" aria-busy="true" aria-label="Cargando recorrido"><p class="row muted mb"><span class="spinner"></span>Cargando recorrido…</p><div class="skeleton heading"></div><div class="skeleton line"></div><div class="skeleton block"></div><div class="skeleton block"></div></section>`;
    else if(state.load==='error')html+=notice('No pudimos cargar el recorrido. Tus cambios confirmados se conservan.','error','No se pudo conectar')+`<div class="mt">${button('Reintentar','retry','primary','refresh')}</div>`;
    else if(state.load==='missing')html+=notice('La cuenta no existe o ya no está disponible. Volvé al listado para seleccionar otra.','error','Cuenta no encontrada');
    else html+=journalContent();
    html+=bottomNote();
  }
  $('#content').innerHTML=`<div class="content-width">${html}</div>`;hydrateIcons();
  $('.review-description').textContent=`Simulación local · ${date(state.now)} 2026`;
}
function journalContent(){
  const run=state.run;
  let banner=!state.globalEnabled?notice('Los recorridos se conservan. No se pueden activar ni ajustar, y un recorrido activo no emitirá su pregunta mientras Journals esté apagado.','warning','Journals está deshabilitado en la plataforma'):!state.accountActive?notice('La configuración se conserva. Esta cuenta no puede recibir preguntas ni iniciar cambios hasta volver a estar habilitada.','warning','Cuenta deshabilitada'):'';
  if(!run)return banner+`<section class="card empty-state"><div class="empty-icon">${icon('book')}</div><p class="eyebrow gold-text">EL PRIMER RECORRIDO</p><h2>Una dirección para la práctica</h2><p>Activá un journal para acompañar la pregunta diaria con un propósito y etapas. Después podés adaptar cada etapa a su proceso.</p><div class="steps-inline"><div><span>01</span>Elegí un template</div><div><span>02</span>Revisá el calendario</div><div><span>03</span>Activá el recorrido</div></div>${button('Activar un journal','activate','primary','plus',!state.globalEnabled||!state.accountActive?'disabled':'')}<p class="small">La escritura libre sigue disponible en la app.</p></section>`;
  const live=['active','paused'].includes(run.status), stage=currentStage(), problem=pending(run), ended=!live;
  if(banner)banner=`<div class="mb">${banner}</div>`;
  let additional='';
  if(run.status==='paused')additional=`<div class="mt">${notice(`El calendario se congeló el ${date(run.pausedAt)} a las ${hour(run.pausedAt)}. Al reanudar se conserva el tiempo restante y se desplazan las etapas siguientes. La pregunta diaria vuelve al espacio libre durante la pausa.`,'info','Un tiempo para pausar')}</div>`;
  if(run.status==='closed')additional=`<div class="mt">${notice('El recorrido terminó por decisión explícita. La pregunta diaria vuelve al espacio libre; las respuestas previas conservan su contexto.','info','Cerrado el '+date(run.closedAt))}</div>`;
  if(run.status==='completed')additional=`<div class="mt">${notice('Terminó el calendario de preparación. La pregunta diaria vuelve al espacio libre. Integración no se activa automáticamente.','info','Recorrido completado')}</div>`;
  if(live&&problem.length)additional+=`<div class="mt">${notice(`${problem.length===1?'Una etapa necesita':'Algunas etapas necesitan'} revisar sus preguntas de respaldo después de un cambio de objetivo. En una etapa pendiente no se emitirá la pregunta del journal.`,'warning','Preguntas pendientes de revisión')}<div class="mt-sm">${button('Revisar preguntas de respaldo','review-pending','','edit',!isEditable()?'disabled':'')}</div></div>`;
  return banner+`<section class="card hero"><div class="hero-top"><div class="grow"><div class="row wrap"><span class="eyebrow gold-text">RECORRIDO PERSONAL</span>${statusPill(run)}</div><h2>${escape(run.name)}</h2><p class="purpose">${escape(run.purpose)}</p><button class="global-edit" data-action="purpose">${ended?'Ver orientación del recorrido':'Ver orientación y propósito'}</button></div><div class="hero-symbol" aria-hidden="true">◒</div></div><div class="hero-footer"><div><span class="label">${ended?'Calendario original':'Calendario previsto'}</span><span class="value">${range({start:run.start,end:run.stages.at(-1).end})} 2026</span></div><div><span class="label">Avance entre etapas</span><span class="value row" style="gap:6px">${icon('clock')}Automático</span></div><div><span class="label">Origen</span><span class="value">Template v2 · Revisión ${run.revision}</span></div></div></section>${additional}<div class="content-grid"><section><div class="section-heading"><div><h3>Etapas del recorrido</h3><p>Una estructura que podés adaptar cuando haga falta.</p></div>${live?button('Ajustar','edit-all','small-button','edit',isEditable()?'':'disabled'):''}</div><div class="card"><ol class="stage-list">${run.stages.map((s,i)=>stageRow(s,i,run)).join('')}</ol></div><p class="timeline-note">${icon('calendar')}<span>Fechas en ${run.timezone==='UTC'?'UTC':'Buenos Aires'} · Cada intervalo termina al comenzar la fecha siguiente. El avance no depende de las respuestas ni de una sesión.</span></p><div class="section-heading mt"><h3>Cambios del recorrido</h3>${button('Ver historial','history','quiet small-button','history')}</div><div class="card"><div class="history-row"><span class="history-revision">r${run.history[0]?.revision||run.revision}</span><div class="grow"><strong>${escape(run.history[0]?.title||'Recorrido activado')}</strong><p>${date(run.history[0]?.at||run.start)} · ${escape(run.history[0]?.detail||'Se creó una nueva copia del template.')}</p></div></div></div></section><aside class="card card-pad focus-card"><p class="eyebrow">${ended?'ESTE RECORRIDO':run.status==='paused'?'FOCO AL REANUDAR':'EL FOCO DE HOY'}</p><h3>${ended?'El recorrido se conserva':escape(stage.name)}</h3><p>${ended?'Podés consultar su configuración y volver a iniciar el mismo template en otro momento de la vida. Será un recorrido nuevo.':escape(stage.objective)}</p>${live?`<dl class="mini-details"><div><dt>Etapa</dt><dd>${run.current+1} de ${run.stages.length}</dd></div><div><dt>${run.status==='paused'?'Tiempo congelado':'Próximo cambio'}</dt><dd>${run.status==='paused'?'Se recalcula al reanudar':date(stage.end)+', '+hour(stage.end)}</dd></div><div><dt>Pregunta diaria</dt><dd>${run.status==='paused'?'En el espacio libre':approved(stage,run)&&state.globalEnabled&&state.accountActive?'20:30 · Dentro de este journal':'Suspendida en este contexto'}</dd></div></dl>${button(run.status==='paused'?'Ajustar etapa pausada':'Ajustar esta etapa','edit-current','','edit',isEditable()?'':'disabled')}<div class="minor-actions">${button(run.status==='paused'?'Reanudar':'Pausar',run.status==='paused'?'resume':'pause','quiet small-button',run.status==='paused'?'play':'pause',isEditable()?'':'disabled')}${run.status==='active'?button('Avanzar etapa','advance','quiet small-button','next',isEditable()&&state.now>stage.start?'':'disabled'):''}${button('Cerrar recorrido','close-run','quiet small-button','',isEditable()?'':'disabled')}</div>`:`<div class="mt">${button('Iniciar un nuevo recorrido','activate','primary','plus',state.globalEnabled&&state.accountActive?'':'disabled')}</div>`}<div class="rule"></div><p class="small">${live?'Los ajustes cambian esta copia personal. El template y las preguntas ya publicadas conservan su versión.':'Cada activación conserva su propia historia y sus propias respuestas.'}</p></aside></div>${state.archives.length?`<section class="card card-pad mt"><h3>Recorridos anteriores</h3>${state.archives.map((r,i)=>`<div class="row wrap mt-sm"><span class="grow">${escape(r.name)} <span class="muted small">· ${date(r.start)}</span></span>${statusPill(r)}${button('Ver configuración','archive','quiet small-button','',`data-index="${i}"`)}</div>`).join('')}</section>`:''}`;
}
function stageRow(stage,i,run){
  const done=i<run.current||run.status==='completed', now=i===run.current&&['active','paused'].includes(run.status);
  return `<li class="stage-row ${now?'current':''}"><span class="stage-marker ${done?'done':now?'now':''}">${done?icon('check'):String(i+1).padStart(2,'0')}</span><div><div class="row wrap" style="gap:8px"><h3>${escape(stage.name)}</h3>${now?pill(run.status==='paused'?'En pausa':'Actual',run.status==='paused'?'gold':''):''}</div><div class="stage-meta"><span>${range(stage)}</span><span>·</span><span>${stage.days} días</span>${done?'<span>· Completada</span>':''}</div><p>${escape(stage.objective)}</p>${!approved(stage,run)&&!done?'<div class="mt-sm">'+pill('Respaldo por revisar','gold')+'</div>':''}</div>${button(done||!isEditable()?'Ver': 'Ajustar','edit-stage','quiet small-button',done?'':'edit',`data-index="${i}"`)}</li>`;
}
function showSheet(mode){returnFocus=document.activeElement;sheetMode=mode;renderSheet();if(!sheet.open)sheet.showModal();}
function openEditor(index,orientation=false){draft=copy(state.run);baseRun=copy(state.run);editorIndex=index;errors='';deferred=false;conflictResolved=false;showSheet(orientation?'purpose':'editor');}
function closeSheet(){sheet.close();draft=null;errors='';returnFocus?.focus();}
function sheetFrame(title,subtitle,content,footer,kicker='AJUSTE DEL RECORRIDO'){
  return `<header class="sheet-header"><div class="grow"><p class="eyebrow">${kicker}</p><h2 id="sheet-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="dismiss" aria-label="Cerrar panel">${icon('close')}</button></header><div class="sheet-body">${errors?`<div class="save-error" role="alert">${errors}</div>`:''}${content}</div><footer class="sheet-footer">${footer}</footer>`;
}
function recompute(run){
  let previous;
  run.stages.forEach((stage,i)=>{
    const old=state.run?.stages.find(s=>s.id===stage.id);
    if(i<run.current&&old){stage.start=old.start;stage.end=old.end;}
    else if(i===run.current&&old){stage.start=old.start;stage.end=old.end+(stage.days-old.days)*day;}
    else {stage.start=previous;stage.end=previous+stage.days*day;}
    previous=stage.end;
  });
}
function calendar(run){return `<ol class="mini-calendar">${run.stages.map((s,i)=>`<li><span class="index">${i+1}</span><div>${escape(s.name)}<div class="dates">${range(s)}${s.end===state.run?.stages.find(x=>x.id===s.id)?.end?'':` <span class="gold-text">· Nueva fecha</span>`}</div></div><span class="days">${s.days} d</span></li>`).join('')}</ol>`;}
function inputField(label,key,value,{hint='',max=4000,lines=true,readonly=false}={}){return `<label class="field"><span>${label}</span>${lines?`<textarea data-field="${key}" maxlength="${max}" ${readonly?'readonly':''}>${escape(value)}</textarea>`:`<input data-field="${key}" value="${escape(value)}" maxlength="${max}" ${readonly?'readonly':''}>`}${hint?`<small class="hint">${hint}</small>`:''}</label>`;}
function renderSheet(){
  if(sheetMode==='wizard'){renderWizard();return;}
  if(sheetMode==='history'){sheet.innerHTML=sheetFrame('Historia de la configuración','Cambios de este recorrido. No incluye contenido personal.',`<div class="card">${state.run.history.map(item=>`<div class="history-row"><span class="history-revision">r${item.revision}</span><div class="grow"><strong>${escape(item.title)}</strong><p>${date(item.at)}, ${hour(item.at)}<br>${escape(item.detail)}</p>${item.run?button('Ver esta configuración','snapshot','quiet small-button','',`data-revision="${item.revision}"`):''}</div></div>`).join('')}</div>`,button('Cerrar','dismiss'),'HISTORIAL');return;}
  if(sheetMode==='snapshot'){sheet.innerHTML=sheetFrame('Configuración histórica',`Revisión ${draft.revision} · Sólo lectura`,inputField('Propósito','unused',draft.purpose,{readonly:true})+calendar(draft)+notice('Las revisiones conservan la configuración con la que se acompañó ese momento. El contenido de las notas y la intención no se muestra aquí.','info'),button('Cerrar','dismiss'),'RECORRIDO ARCHIVADO');return;}
  if(sheetMode==='conflict'){renderConflict();return;}
  if(sheetMode==='ambiguous'){sheet.innerHTML=sheetFrame('Falta confirmar el resultado','La conexión se interrumpió después de enviar el cambio.',notice('Todavía no podemos asegurar si se guardó. Conservamos tu borrador y la misma solicitud para comprobar el resultado.','warning','No vuelvas a crear el cambio')+`<div class="diff-block mt"><h3>Solicitud pendiente</h3><p class="diff-text">Ajuste del recorrido · desde revisión ${draft.revision}</p><p class="muted small">La comprobación recupera este mismo guardado; no crea una segunda revisión.</p></div>`,button('Comprobar resultado','check-result','primary','refresh'));return;}
  if(sheetMode==='catalog'){renderCatalog();return;}
  if(sheetMode==='changes'){renderChanges();return;}
  const readonly=!isEditable()||(sheetMode==='editor'&&editorIndex<state.run.current);
  if(sheetMode==='purpose'){
    sheet.innerHTML=sheetFrame('Orientación del recorrido','Los cambios se aplican sólo a este recorrido personal.',inputField('Propósito general','purpose',draft.purpose,{max:2000,readonly})+inputField('Indicaciones para las preguntas','instructions',draft.instructions,{readonly,hint:'Orientación acordada para las preguntas. La intención personal se edita en la app del usuario.'})+notice('Cambiar el propósito o estas indicaciones requiere revisar el respaldo de todas las etapas pendientes. La duración y las fechas se mantienen.','info'),readonly?button('Cerrar','dismiss'):button('Cancelar','dismiss')+button('Revisar cambios','to-changes','primary','arrow'));
    return;
  }
  const s=draft.stages[editorIndex];
  sheet.innerHTML=sheetFrame(readonly?'Configuración de la etapa':'Ajustar etapa',readonly?'Una etapa completada conserva su configuración.':'Adaptá el foco sin perder el sentido del recorrido.',`<div class="editor-nav"><label for="editor-stage" class="sr-only">Etapa seleccionada</label><select id="editor-stage">${draft.stages.map((stage,i)=>`<option value="${i}" ${i===editorIndex?'selected':''}>${String(i+1).padStart(2,'0')} · ${escape(stage.name)}${i<state.run.current?' · Completada':''}</option>`).join('')}</select></div>${inputField('Nombre de la etapa','name',s.name,{max:120,lines:false,readonly})}${inputField('Objetivo de exploración','objective',s.objective,{max:2000,readonly,hint:'Define para qué se pregunta durante esta etapa.'})}${inputField('Indicaciones para las preguntas','stageInstructions',s.instructions,{readonly,hint:'Por ejemplo: invitar a observar situaciones concretas, sin sugerir sus causas.'})}<label class="field"><span>Duración de la etapa</span><div class="row"><input data-field="days" type="number" min="1" max="365" value="${s.days}" ${readonly?'readonly':''}><span class="muted small">días de calendario</span></div><small class="hint">La duración cuenta desde el inicio de la etapa; no vuelve a empezar al guardar.</small></label><div id="calendar-preview"><div class="subheading"><h3>Calendario resultante</h3>${pill('Automático','neutral')}</div>${calendar(draft)}</div>${!readonly?`<div class="compact-note">Cambiar el objetivo o las indicaciones requiere revisar las preguntas de respaldo. Ajustar sólo la duración conserva su aprobación.</div><div class="subheading"><h3>Etapas futuras</h3>${button('Agregar','add-stage','quiet small-button','plus',draft.stages.length>=52?'disabled':'')}</div>${editorIndex>draft.current?`<div class="row wrap">${button('Subir','move-up','small-button','up',editorIndex<=draft.current+1?'disabled':'')}${button('Bajar','move-down','small-button','down',editorIndex===draft.stages.length-1?'disabled':'')}${button('Quitar etapa','remove-stage','quiet small-button','trash')}</div>`:'<p class="muted small">Seleccioná una etapa futura para reordenarla o quitarla. Las etapas completadas se conservan.</p>'}`:''}`,readonly?button('Cerrar','dismiss'):button('Cancelar','dismiss')+button('Revisar cambios','to-changes','primary','arrow'));
}
function newWizardRun(){const run=template(state.now);run.revision=1;run.current=0;run.history=[];return run;}
function renderWizard(){
  const run=draft;
  const stepper=`<div class="stepper">${['Template','Calendario','Activación'].map((s,i)=>`${i?'<span class="connector"></span>':''}<span class="step ${wizardStep===i+1?'active':''}"><span class="step-number">${i+1}</span>${s}</span>`).join('')}</div>`;
  let content=stepper;
  if(wizardStep===1)content+=`<div class="template-option"><div class="row between"><span class="eyebrow gold-text">TEMPLATE · VERSIÓN 2</span><span class="selection-check">${icon('check')}</span></div><h3>Preparación e intención</h3><p>Acompañar la exploración de una intención personal durante la preparación.</p><div class="template-meta"><span>4 etapas</span><span>7 días por etapa</span><span>28 días de calendario</span></div><div class="rule"></div><p>Explorar un propósito, entender qué significa, reconocerlo en la vida cotidiana y formular una intención flexible.</p></div><div class="mt">${notice('Se crea una copia personal de este template. Podés ajustarla después de cada sesión sin modificar la definición original.','info')}</div><details class="template-details mt"><summary>Ver qué explora cada etapa</summary>${run.stages.map((s,i)=>`<div class="compact-note mt-sm"><strong>${i+1}. ${escape(s.name)}</strong><p>${escape(s.objective)}</p></div>`).join('')}</details><p class="muted small mt">Por ahora, la activación se realiza desde administración.</p>`;
  if(wizardStep===2)content+=`<div class="row between mb"><h3>Cuatro etapas, avance automático</h3>${pill('28 días','neutral')}</div>${calendar(run)}<label class="field mt"><span>Zona horaria del recorrido</span><select id="wizard-zone"><option value="America/Argentina/Buenos_Aires" ${wizardZone==='America/Argentina/Buenos_Aires'?'selected':''}>Buenos Aires · UTC−03:00</option><option value="UTC" ${wizardZone==='UTC'?'selected':''}>UTC · UTC+00:00</option></select><small class="hint">Se fija al activar. Cambiar después el horario de notificaciones no mueve estas fechas.</small></label>${notice(`Empieza hoy, ${date(state.now)} a las ${hour(state.now)}. La primera etapa termina al comenzar el ${date(run.stages[0].end)}. El primer día puede ser parcial.`,'info','Inicio inmediato')}<p class="muted small mt">No hace falta confirmar el paso de etapa. Los ajustes semanales son opcionales.</p>`;
  if(wizardStep===3)content+=`<h3 class="mb">Revisá antes de activar</h3><section class="card card-pad"><div class="row between"><span class="eyebrow gold-text">NUEVO RECORRIDO</span>${pill('Template v2','neutral')}</div><h2 style="margin:14px 0">Preparación e intención</h2><p class="muted small">${escape(run.purpose)}</p><dl class="meta-list"><div><dt>Inicio</dt><dd>Hoy, ${hour(state.now)}</dd></div><div><dt>Fin previsto</dt><dd>${date(run.stages.at(-1).end)} 2026</dd></div><div><dt>Etapas</dt><dd>4 · Avance automático</dd></div><div><dt>Zona horaria</dt><dd>${wizardZone==='UTC'?'UTC':'Buenos Aires'}</dd></div></dl></section><div class="mt">${notice('La próxima pregunta programada usará este recorrido. No se crea otra pregunta hoy ni se cambian el horario o los avisos del usuario.','info')}</div><p class="muted small mt">Se conservan los límites de temas y la escritura libre. Las notas anteriores no se reasignan al nuevo recorrido.</p><label class="check-line"><input id="activate-check" type="checkbox" ${wizardAccepted?'checked':''}><span>Revisé el template, las etapas y el calendario para esta cuenta.</span></label>`;
  sheet.innerHTML=sheetFrame('Activar un journal','Para piloto@example.com',content,button(wizardStep===1?'Cancelar':'Volver',wizardStep===1?'dismiss':'wizard-back')+button(wizardStep===3?'Activar recorrido':'Continuar',wizardStep===3?'confirm-activation':'wizard-next','primary',wizardStep===3?'check':'arrow',wizardStep===3&&!wizardAccepted?'disabled':''),'NUEVO RECORRIDO');
}
function changes(){
  const diffs=[];
  for(const [key,label] of [['purpose','Propósito general'],['instructions','Indicaciones generales']])if(draft[key]!==state.run[key])diffs.push({label,old:state.run[key],value:draft[key]});
  draft.stages.forEach((s,i)=>{
    const previous=state.run.stages.find(x=>x.id===s.id);
    if(!previous){diffs.push({label:'Nueva etapa',old:'No estaba en el recorrido',value:s.name});return;}
    for(const [key,label] of [['name','Nombre'],['objective','Objetivo'],['instructions','Indicaciones'],['days','Duración']])if(s[key]!==previous[key])diffs.push({label:`Etapa ${i+1} · ${label}`,old:previous[key]+(key==='days'?' días':''),value:s[key]+(key==='days'?' días':'')});
    if(s.approval!==previous.approval||JSON.stringify(s.prompts)!==JSON.stringify(previous.prompts))diffs.push({label:`Etapa ${i+1} · Respaldo`,old:'Configuración anterior',value:approved(s,draft)?'Preguntas revisadas para el objetivo vigente':'Pendiente de revisión'});
  });
  state.run.stages.forEach(s=>{if(!draft.stages.some(x=>x.id===s.id))diffs.push({label:'Etapa futura quitada',old:s.name,value:'Se conserva en la historia; ya no forma parte del calendario.'});});
  if(draft.stages.map(s=>s.id).join()!==state.run.stages.map(s=>s.id).join())diffs.push({label:'Orden de etapas',old:state.run.stages.map(s=>s.name).join(' → '),value:draft.stages.map(s=>s.name).join(' → ')});
  return diffs;
}
function validateDraft(){
  if(!draft.purpose.trim()||draft.stages.some(s=>!s.name.trim()||!s.objective.trim()||!Number.isInteger(s.days)||s.days<1||s.days>365))return 'Completá el propósito, los nombres y los objetivos. Cada duración debe ser un número entero de 1 a 365 días.';
  const at=state.run.pausedAt||state.now;
  if(draft.stages[draft.current].end<=at)return 'Esa duración haría terminar la etapa actual antes de ahora. Conservá tiempo restante o usá la acción «Avanzar etapa».';
  return '';
}
function renderChanges(){
  const diffs=changes(), remaining=pending(draft);
  const changedDates=draft.stages.some(s=>s.end!==state.run.stages.find(x=>x.id===s.id)?.end);
  sheet.innerHTML=sheetFrame('Revisar el ajuste',`Se guardará como revisión ${draft.revision+1} de esta copia personal.`,`${conflictResolved?'<div class="mb">'+notice('Tu borrador se aplicó sobre la revisión actual. Revisá el resultado combinado antes de guardar.','info','Cambios recuperados')+'</div>':''}${diffs.length?diffs.map(d=>`<div class="diff-block"><h3>${escape(d.label)}</h3><p class="diff-label">Antes</p><p class="diff-text old">${escape(d.old)}</p><p class="diff-label">Después</p><p class="diff-text">${escape(d.value)}</p></div>`).join(''):notice('No hay cambios en la configuración. Podés volver para ajustar una etapa.','info')}${changedDates||conflictResolved?`<div class="subheading"><h3>Así queda el calendario</h3></div>${calendar(draft)}`:notice('Las fechas del recorrido se mantienen.','info')}${remaining.length?`<div class="mt">${notice('El nuevo objetivo necesita preguntas de respaldo compatibles. Hasta revisarlas, las etapas pendientes no emitirán la pregunta del journal.','warning','Revisión de preguntas pendiente')}</div><div class="mt-sm">${button('Revisar respaldo de '+remaining.length+(remaining.length===1?' etapa':' etapas'),'review-draft','','edit')}</div><label class="check-line"><input id="defer-check" type="checkbox" ${deferred?'checked':''}><span>Guardaré el ajuste y revisaré el respaldo después. Entiendo que esas etapas no emitirán su pregunta mientras estén pendientes.</span></label>`:`<div class="mt">${notice('El respaldo es compatible con los objetivos de las etapas pendientes. Los límites de temas del usuario siguen vigentes.','','Preguntas de respaldo revisadas')}</div>`}<p class="muted small mt">Las preguntas publicadas y sus respuestas conservan la revisión con la que se crearon.</p>`,button('Volver a editar','back-edit')+button(busy?'Guardando…':'Guardar ajuste','save','primary',busy?'':'check',busy||!diffs.length||remaining.length&&!deferred?'disabled':''));
  if(busy)$('[data-action="save"]',sheet).insertAdjacentHTML('afterbegin','<span class="spinner"></span>');
}
function renderCatalog(){
  const s=draft.stages[editorIndex];
  sheet.innerHTML=sheetFrame('Preguntas de respaldo',escape(s.name),`<p class="muted small">Se usan sin notas o cuando no hay una propuesta personal elegible. Revisá las tres profundidades para este objetivo.</p><div class="compact-note mt"><span class="label">Objetivo a acompañar</span>${escape(s.objective)}</div><div class="depth-tabs" aria-label="Profundidad de preguntas">${Object.entries(depths).map(([key,label])=>`<button data-action="depth" data-depth="${key}" aria-pressed="${depth===key}">${label}</button>`).join('')}</div>${s.prompts.map((p,i)=>`<div class="question-card"><label for="prompt-${i}">Tema ${i+1} de ${s.prompts.length} · ${depths[depth]}</label><textarea id="prompt-${i}" data-prompt="${i}" maxlength="240">${escape(p[depth])}</textarea><p class="question-count" data-count="${i}">${p[depth].length}/240</p></div>`).join('')}<div class="compact-note">Los temas conservan su identidad aunque ajustes la redacción. Un tema cerrado por el usuario no vuelve a habilitarse al aprobar estas preguntas.</div><label class="check-line"><input id="review-check" type="checkbox"><span>Revisé los tres temas y sus variantes suave, intermedia y profunda. Son adecuados para este objetivo.</span></label>`,button('Volver al ajuste','catalog-back')+button('Confirmar revisión','approve-catalog','primary','check','disabled'),'REVISIÓN EDITORIAL');
}
function renderConflict(){
  const old=state.run.stages[editorIndex];
  sheet.innerHTML=sheetFrame('El recorrido cambió','Otra actualización se guardó mientras estabas editando.',notice('Tu borrador se conserva. No sobrescribimos la revisión más reciente. Compará ambos cambios antes de continuar.','warning','Revisión desactualizada')+`<div class="diff-block mt"><h3>Guardado recientemente · Revisión ${state.run.revision}</h3><p class="diff-label">Duración de la etapa actual</p><p class="diff-text">${old.days} días · Fin ${date(old.end)}</p></div><div class="diff-block"><h3>Tu borrador</h3><p class="diff-label">Indicaciones</p><p class="diff-text">${escape(draft.stages[editorIndex].instructions)}</p></div><div class="conflict-comparison">Podés recuperar tus campos editados sobre la nueva revisión y volver a revisar el calendario. Si un mismo campo cambió en ambos lados, será necesario elegir cuál conservar.</div>`,button('Ver versión actual','use-latest')+button('Recuperar mi borrador','recover-draft','primary','refresh'));
  const conflicts=conflictingFields();
  if(conflicts.length){
    $('.sheet-body').insertAdjacentHTML('beforeend',`<section class="mt"><h3>Elegí qué conservar</h3><p class="muted small mt-sm">Estos campos cambiaron en las dos versiones. El resto de los cambios se combinará.</p>${conflicts.map(c=>`<fieldset class="conflict-field"><legend>${escape(c.label)}</legend><label class="check-line"><input type="radio" name="conflict-${c.id}" data-conflict-id="${c.id}" value="current"><span><strong>Versión actual</strong><br>${escape(typeof c.current==='object'?JSON.stringify(c.current):c.current)}</span></label><label class="check-line"><input type="radio" name="conflict-${c.id}" data-conflict-id="${c.id}" value="draft"><span><strong>Mi borrador</strong><br>${escape(typeof c.local==='object'?JSON.stringify(c.local):c.local)}</span></label></fieldset>`).join('')}</section>`);
    $('[data-action="recover-draft"]').disabled=true;
  }
}
function conflictingFields(){
  const fields=[];
  function check(id,label,before,local,current){
    if(JSON.stringify(before)!==JSON.stringify(local)&&JSON.stringify(before)!==JSON.stringify(current)&&JSON.stringify(local)!==JSON.stringify(current))fields.push({id,label,local,current});
  }
  for(const key of ['purpose','instructions'])check(key,key==='purpose'?'Propósito general':'Indicaciones generales',baseRun[key],draft[key],state.run[key]);
  draft.stages.forEach(s=>{
    const base=baseRun.stages.find(x=>x.id===s.id),current=state.run.stages.find(x=>x.id===s.id);
    if(base&&current)for(const key of ['name','objective','instructions','days','prompts'])check(s.id+'.'+key,s.name+' · '+({name:'Nombre',objective:'Objetivo',instructions:'Indicaciones',days:'Duración',prompts:'Preguntas'}[key]),base[key],s[key],current[key]);
  });
  return fields;
}
function showModal(title,text,action,label,kind='primary'){
  modalAction=action;
  modal.innerHTML=`<div class="modal-content"><div class="row between"><span class="eyebrow gold-text">RECORRIDO PERSONAL</span><button class="icon-button" data-action="cancel-modal" aria-label="Cerrar confirmación">${icon('close')}</button></div><h2 id="modal-title">${title}</h2><p>${text}</p><div class="modal-actions">${button('Cancelar','cancel-modal')}${button(label,'confirm-modal',kind)}</div></div>`;
  modal.showModal();
}
function requestDismiss(){if(busy)return;if(draft&&state.run&&['editor','purpose','changes','catalog','conflict'].includes(sheetMode)&&changes().length){showModal('¿Salir sin guardar?','Tu borrador todavía no se guardó. El recorrido conserva su configuración actual.','discard','Salir sin guardar');}else closeSheet();}
function saveRun(title,detail){
  draft.revision=state.run.revision+1;draft.history=copy(state.run.history);draft.history.unshift({revision:draft.revision,title,detail,at:state.now,run:copy({...draft,history:[]})});state.run=copy(draft);commitCount++;closeSheet();render();toast('Ajuste confirmado · Revisión '+state.run.revision);
}
async function save(){
  if(busy)return;busy=true;errors='';renderSheet();await new Promise(resolve=>setTimeout(resolve,650));busy=false;
  if(nextOutcome==='save-error'){nextOutcome='success';errors=notice('No se pudo confirmar el cambio. Tu borrador se conserva. Reintentá el mismo guardado.','error','El ajuste no está confirmado');renderSheet();return;}
  if(nextOutcome==='ambiguous'){nextOutcome='success';sheetMode='ambiguous';renderSheet();return;}
  if(nextOutcome==='conflict'||nextOutcome==='conflict-field'){
    if(nextOutcome==='conflict-field')state.run.stages[state.run.current].instructions='Explorar el significado del desacuerdo sin presuponer que sea un problema.';
    conflictChoices={};
    nextOutcome='success';state.run.stages[state.run.current].days+=2;state.run.stages[state.run.current].end+=2*day;for(let i=state.run.current+1;i<state.run.stages.length;i++){state.run.stages[i].start+=2*day;state.run.stages[i].end+=2*day;}state.run.revision++;state.run.history.unshift({revision:state.run.revision,title:'Ajuste guardado durante la edición',detail:'Se actualizó la duración de la etapa.',at:state.now,run:copy({...state.run,history:[]})});sheetMode='conflict';renderSheet();return;
  }
  saveRun('Configuración ajustada',pending(draft).length?'Objetivos actualizados. Respaldo pendiente de revisión.':'Etapas y respaldo revisados para las próximas preguntas.');
}
function finishLifecycle(action){
  const run=state.run,stage=currentStage();
  if(action==='pause'){run.status='paused';run.pausedAt=state.now;}
  if(action==='resume'){const delta=state.now-run.pausedAt;run.stages.forEach((s,i)=>{if(i>=run.current){s.end+=delta;if(i>run.current)s.start+=delta;}});run.status='active';delete run.pausedAt;}
  if(action==='close-run'){run.status='closed';run.closedAt=state.now;delete run.pausedAt;}
  if(action==='advance'){
    stage.end=state.now;run.current++;
    if(run.current>=run.stages.length)run.status='completed';
    else {let cursor=state.now;for(let i=run.current;i<run.stages.length;i++){run.stages[i].start=cursor;cursor+=run.stages[i].days*day;run.stages[i].end=cursor;}}
  }
  const titles={pause:'Recorrido pausado',resume:'Recorrido reanudado','close-run':'Recorrido cerrado',advance:run.status==='completed'?'Recorrido completado':'Avance explícito de etapa'};
  run.revision++;run.history.unshift({revision:run.revision,title:titles[action],detail:'Calendario y contexto futuro actualizados. Se conserva la historia.',at:state.now,run:copy({...run,history:[]})});render();toast(titles[action]);
}

document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-page]');
  if(nav){event.preventDefault();state.screen=nav.dataset.page;$('#sidebar').classList.remove('open');$('#menu-button').setAttribute('aria-expanded','false');render();return;}
  const control=event.target.closest('[data-action]');if(!control||control.disabled)return;
  const action=control.dataset.action;
  if(action==='menu'){const open=$('#sidebar').classList.toggle('open');$('#menu-button').setAttribute('aria-expanded',String(open));return;}
  if(action==='reset'){reset($('#scenario').value);return;}
  if(action==='users'||action==='account'){state.screen=action;render();return;}
  if(action==='journals'){activeTab='journals';render();return;}
  if(action==='tab'){activeTab=control.dataset.tab;render();return;}
  if(action==='retry'){state.load='ready';render();return;}
  if(action==='activate'){draft=newWizardRun();wizardStep=1;wizardZone='America/Argentina/Buenos_Aires';wizardAccepted=false;errors='';showSheet('wizard');return;}
  if(action==='wizard-next'||action==='wizard-back'){wizardStep+=action==='wizard-next'?1:-1;renderSheet();$('.sheet-body').scrollTop=0;return;}
  if(action==='confirm-activation'){
    if(!wizardAccepted)return;draft.status='active';draft.revision=1;draft.current=0;
    draft.history=[{revision:1,title:'Recorrido activado desde template v2',detail:'Cuatro etapas con avance automático. Inicio inmediato.',at:state.now,run:copy({...draft,history:[]})}];
    if(state.run)state.archives.unshift(copy(state.run));state.run=copy(draft);commitCount++;closeSheet();render();toast('Recorrido activado · La próxima pregunta usará este contexto.');return;
  }
  if(action==='purpose'){openEditor(state.run.current,true);return;}
  if(action==='edit-all'||action==='edit-current'){openEditor(state.run.current);return;}
  if(action==='edit-stage'){openEditor(Number(control.dataset.index));return;}
  if(action==='dismiss'){requestDismiss();return;}
  if(action==='to-changes'){
    recompute(draft);const invalid=validateDraft();if(invalid){errors=notice(invalid,'error');renderSheet();return;}
    errors='';sheetMode='changes';renderSheet();$('.sheet-body').scrollTop=0;return;
  }
  if(action==='back-edit'){errors='';sheetMode='editor';renderSheet();return;}
  if(action==='add-stage'){
    draft.stages.push({id:'custom-'+(++localStageSequence),name:'Nueva etapa',objective:'',instructions:'',days:7,prompts:[0,1,2].map(i=>({key:'new-'+i,gentle:'',middle:'',deep:''})),approval:''});recompute(draft);editorIndex=draft.stages.length-1;renderSheet();return;
  }
  if(action==='move-up'||action==='move-down'){const target=editorIndex+(action==='move-up'?-1:1);if(target<=draft.current||target>=draft.stages.length)return;[draft.stages[editorIndex],draft.stages[target]]=[draft.stages[target],draft.stages[editorIndex]];editorIndex=target;recompute(draft);renderSheet();return;}
  if(action==='remove-stage'){showModal('¿Quitar esta etapa futura?',`«${escape(draft.stages[editorIndex].name)}» saldrá del calendario. Sus referencias históricas se conservan. El resto de las fechas se recalculará al revisar el ajuste.`,'remove-stage','Quitar etapa','danger');return;}
  if(action==='review-pending'){draft=copy(state.run);baseRun=copy(state.run);editorIndex=pending(draft)[0];catalogReturn='changes';depth='middle';deferred=false;errors='';showSheet('catalog');return;}
  if(action==='review-draft'){editorIndex=pending(draft)[0];catalogReturn='changes';depth='middle';errors='';sheetMode='catalog';renderSheet();return;}
  if(action==='depth'){depth=control.dataset.depth;errors='';renderSheet();$(`[data-depth="${depth}"]`,sheet).focus();return;}
  if(action==='catalog-back'){sheetMode=catalogReturn;errors='';renderSheet();return;}
  if(action==='approve-catalog'){
    if(!$('#review-check').checked)return;
    if(!validPrompts(draft.stages[editorIndex])){errors=notice('Cada variante debe ser distinta, ocupar una línea, incluir una pregunta y tener hasta 240 caracteres. Revisá las tres profundidades.','error');renderSheet();return;}
    draft.stages[editorIndex].approval=goal(draft.stages[editorIndex],draft);errors='';sheetMode='changes';renderSheet();return;
  }
  if(action==='save'){save();return;}
  if(action==='check-result'){saveRun('Configuración ajustada','Resultado recuperado de la misma solicitud; no se duplicó la revisión.');return;}
  if(action==='recover-draft'){
    const fieldConflicts=conflictingFields(), edited=draft;draft=copy(state.run);
    for(const key of ['purpose','instructions'])if(edited[key]!==baseRun[key]){if(!fieldConflicts.some(c=>c.id===key)||conflictChoices[key]==='draft')draft[key]=edited[key];}
    const orderChanged=edited.stages.map(s=>s.id).join()!==baseRun.stages.map(s=>s.id).join();
    const merged=edited.stages.map(s=>{
      const baseline=baseRun.stages.find(x=>x.id===s.id), latest=draft.stages.find(x=>x.id===s.id);
      if(!baseline||!latest)return copy(s);
      for(const key of ['name','objective','instructions','days','prompts','approval'])if(JSON.stringify(s[key])!==JSON.stringify(baseline[key])){const id=s.id+'.'+key;if(!fieldConflicts.some(c=>c.id===id)||conflictChoices[id]==='draft')latest[key]=copy(s[key]);}
      return latest;
    });
    if(orderChanged)draft.stages=merged;else draft.stages=draft.stages.map(s=>merged.find(x=>x.id===s.id)||s);
    baseRun=copy(state.run);
    conflictResolved=true;errors='';sheetMode='changes';recompute(draft);renderSheet();return;
  }
  if(action==='use-latest'){draft=copy(state.run);conflictResolved=false;errors='';sheetMode='editor';renderSheet();return;}
  if(action==='history'){draft=null;errors='';showSheet('history');return;}
  if(action==='snapshot'){const item=state.run.history.find(x=>x.revision===Number(control.dataset.revision));draft=copy(item.run);sheetMode='snapshot';renderSheet();return;}
  if(action==='archive'){draft=copy(state.archives[Number(control.dataset.index)]);showSheet('snapshot');return;}
  if(['pause','resume','close-run','advance'].includes(action)){
    const text={pause:['¿Pausar el recorrido?','Se congela el tiempo restante. Durante la pausa, la pregunta diaria vuelve al espacio libre. Podés reanudar el recorrido más adelante.','Pausar recorrido'],resume:['¿Reanudar el recorrido?',`Se conserva el tiempo restante de «${escape(currentStage().name)}». En esta simulación, las etapas pendientes se desplazan ${Math.round((state.now-state.run.pausedAt)/day)} días por la pausa. La próxima pregunta programada usará el journal.`,'Reanudar recorrido'],'close-run':['¿Cerrar este recorrido?','Se conserva la historia y la próxima pregunta disponible vuelve al espacio libre. Este recorrido no podrá reanudarse. Podés iniciar otro desde el template.','Cerrar recorrido'],advance:['¿Avanzar ahora?',state.run.current===state.run.stages.length-1?'La última etapa termina ahora y el recorrido queda completado. No se activa integración automáticamente.':`«${escape(currentStage().name)}» termina ahora. La siguiente etapa comienza hoy y las fechas posteriores se recalculan; los próximos cambios serán a esta hora.`,'Confirmar avance']}[action];
    showModal(text[0],text[1],action,text[2],action==='close-run'?'danger':'primary');return;
  }
  if(action==='cancel-modal'){modal.close();return;}
  if(action==='confirm-modal'){
    const decision=modalAction;modal.close();
    if(decision==='discard'){closeSheet();return;}
    if(decision==='remove-stage'){draft.stages.splice(editorIndex,1);editorIndex=Math.min(editorIndex,draft.stages.length-1);recompute(draft);renderSheet();return;}
    finishLifecycle(decision);
  }
});
document.addEventListener('input',event=>{
  const node=event.target;if(!draft)return;
  if(node.dataset.field){
    const key=node.dataset.field;
    if(sheetMode==='purpose')draft[key]=node.value;
    else if(sheetMode==='editor'){
      draft.stages[editorIndex][key==='stageInstructions'?'instructions':key]=key==='days'?Number(node.value):node.value;
      if(key==='days'){recompute(draft);$('#calendar-preview').innerHTML=`<div class="subheading"><h3>Calendario resultante</h3>${pill('Automático','neutral')}</div>${calendar(draft)}`;}
    }
  }
  if(node.dataset.prompt!==undefined){draft.stages[editorIndex].prompts[Number(node.dataset.prompt)][depth]=node.value;$(`[data-count="${node.dataset.prompt}"]`).textContent=node.value.length+'/240';$('#review-check').checked=false;$('[data-action="approve-catalog"]').disabled=true;}
});
document.addEventListener('change',event=>{
  const node=event.target;
  if(node.id==='scenario'){reset(node.value);return;}
  if(node.id==='editor-stage'){editorIndex=Number(node.value);errors='';renderSheet();return;}
  if(node.id==='activate-check'){wizardAccepted=node.checked;$('[data-action="confirm-activation"]').disabled=!node.checked;}
  if(node.id==='defer-check'){deferred=node.checked;$('[data-action="save"]').disabled=!node.checked||!changes().length;}
  if(node.id==='review-check')$('[data-action="approve-catalog"]').disabled=!node.checked;
  if(node.dataset.conflictId){conflictChoices[node.dataset.conflictId]=node.value;$('[data-action="recover-draft"]').disabled=conflictingFields().some(c=>!conflictChoices[c.id]);}
  if(node.id==='wizard-zone'){
    wizardZone=node.value;draft.timezone=wizardZone;const first=draft.stages[0];first.end=instant(new Date(state.now).toISOString().slice(0,10)+'T00:00:00'+(wizardZone==='UTC'?'Z':'-03:00'))+7*day;
    let cursor=first.end;draft.stages.slice(1).forEach(s=>{s.start=cursor;s.end=cursor+7*day;cursor=s.end;});renderSheet();
  }
});
sheet.addEventListener('cancel',event=>{event.preventDefault();requestDismiss();});
modal.addEventListener('cancel',()=>{modalAction=null;});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!sheet.open&&!modal.open){$('#sidebar').classList.remove('open');$('#menu-button').setAttribute('aria-expanded','false');}
});
$('#menu-button').innerHTML=icon('menu');
reset(new URLSearchParams(location.search).get('scenario')||'active');
