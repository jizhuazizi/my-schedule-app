const STORAGE_KEY = 'personal_schedule_tasks_v1';
const DEFAULT_TZ = 'America/Los_Angeles';
const state = { page: 'all', menuOpen: true, searchOpen: false, query: '', editingId: null, repeat: 'none', weekdays: [], reminders: [] };
const weekdayNames = ['一','二','三','四','五','六','日'];
let tasks = loadTasks();

const $ = (id) => document.getElementById(id);
function loadTasks(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function escapeHtml(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalize(value=''){ return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}\s]/gu,''); }
function pinyinKey(value=''){ return normalize(value); }
function localDateString(date = new Date()){ const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
function formatDate(date){ if(!date) return ''; const d=new Date(`${date}T12:00:00`); return `${d.getMonth()+1}/${d.getDate()} 星期${weekdayNames[(d.getDay()+6)%7]}`; }
function formatDue(task){
  if(!task.dueDate && !task.dueTime) return '';
  if(task.dueDate && !task.dueTime) return `${formatDate(task.dueDate)} · Seattle / 北京`;
  if(!task.dueDate && task.dueTime) return `${task.dueTime} Seattle / 北京`;
  const local = new Date(deadlineInstant(task.dueDate,task.dueTime));
  if(!Number.isFinite(local.getTime())) return '该西雅图时间不存在，请调整截止时间';
  const seattle = new Intl.DateTimeFormat('en-US',{timeZone:DEFAULT_TZ,month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(local).replace(',','');
  const beijing = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(local).replace(',','');
  const abbr = new Intl.DateTimeFormat('en-US',{timeZone:DEFAULT_TZ,timeZoneName:'short'}).formatToParts(local).find(p=>p.type==='timeZoneName')?.value || 'PST';
  return `${seattle} ${abbr} · ${beijing} CST`;
}
function dateTimeKey(t){ return t.dueDate ? `${t.dueDate}T${t.dueTime || '23:59'}` : '9999-99-99T99:99'; }
function compareTasks(a,b){ const ad=!!a.dueDate,bd=!!b.dueDate; if(ad!==bd) return ad?1:-1; if(ad){ const c=dateTimeKey(a).localeCompare(dateTimeKey(b)); if(c) return c; } return pinyinKey(a.title).localeCompare(pinyinKey(b.title),'zh-Hans-CN-u-co-pinyin'); }
function visibleTasks(){
  let list = tasks.filter(t => state.page==='completed' ? t.completedAt : !t.completedAt);
  if(state.page==='today'){ const today=new Intl.DateTimeFormat('sv-SE',{timeZone:DEFAULT_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); list=list.filter(t=>t.dueDate===today); }
  if(state.page==='scheduled') list=list.filter(t=>t.dueDate);
  if(state.query){ const q=normalize(state.query); list=list.filter(t=>normalize(`${t.title} ${t.subtitle}`).includes(q)); }
  if(state.page==='completed') return list.sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
  return list.sort(compareTasks);
}
function pageTitle(){ return ({all:'我的事项',today:'今天',scheduled:'已安排',completed:'已完成',settings:'设置'})[state.page]; }
function renderNav(){
  const items=[['all','☰','我的事项'],['today','▣','今天'],['scheduled','◷','已安排'],['completed','✓','已完成'],['settings','⚙','设置']];
  $('nav').innerHTML=items.map(([id,icon,label])=>`<button class="nav-item ${state.page===id?'active':''}" data-page="${id}"><span class="nav-symbol">${icon}</span>${label}</button>`).join('');
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{state.page=b.dataset.page;state.query='';state.searchOpen=false;render();}));
}
function render(){ if(stopActiveVoice)stopActiveVoice();renderNav(); $('sidebar').classList.toggle('collapsed',!state.menuOpen);$('sidebar').inert=!state.menuOpen; $('topbarTitle').textContent=pageTitle(); $('searchToggle').classList.toggle('hidden',state.page==='settings'); if(state.page==='settings') renderSettings(); else renderList(); }
function renderList(){
  const search=state.searchOpen?'<div class="search-bar"><input id="searchInput" placeholder="搜索标题或副标题" aria-label="搜索标题或副标题"><button class="clear-search" id="clearSearch" aria-label="关闭搜索">×</button></div>':'';
  $('content').innerHTML='<div class="page-heading"><div><h1>'+pageTitle()+'</h1><p>'+({all:'所有未完成事项',today:'只看西雅图今天',scheduled:'按截止日期查看',completed:'最近完成的事项在最上面'})[state.page]+'</p></div></div>'+search+'<div id="taskResults"></div><button class="voice-fab" id="voiceTask" aria-label="开始或停止语音">🎙 开始说话</button><button class="fab" id="newTask">＋ 新增事项</button>';
  $('newTask').onclick=()=>openModal();
  setupVoiceCapture($('voiceTask'));
  const results=$('taskResults');
  results.onclick=e=>{
    const complete=e.target.closest('[data-complete]'),remove=e.target.closest('[data-delete]'),row=e.target.closest('[data-task]');
    if(complete)toggleTask(complete.dataset.complete);
    else if(remove)deleteTaskById(remove.dataset.delete);
    else if(row)openModal(row.dataset.task);
  };
  if(state.searchOpen){
    const input=$('searchInput');input.value=state.query;
    let composing=false;
    const update=()=>{state.query=input.value;renderResults();};
    input.addEventListener('compositionstart',()=>composing=true);
    input.addEventListener('compositionend',()=>{composing=false;update();});
    input.addEventListener('input',e=>{if(!composing&&!e.isComposing)update();});
    const close=()=>{state.query='';state.searchOpen=false;renderList();$('searchToggle').focus();};
    input.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing)close();});
    $('clearSearch').onclick=close;
    input.focus();
  }
  renderResults();
}
function renderResults(){
  const list=visibleTasks();
  if(!list.length){$('taskResults').innerHTML=state.query?'<div class="empty-state"><h2>没有找到匹配事项</h2><p>试试其他标题或副标题关键词。</p></div>':emptyHtml();return;}
  const groups=[];
  for(const t of list){const key=state.page==='scheduled'?t.dueDate:null;let g=groups.find(g=>g.key===key);if(!g){g={key,items:[]};groups.push(g);}g.items.push(t);}
  $('taskResults').innerHTML=groups.map(g=>(g.key?'<div class="group-title">'+formatDate(g.key)+'</div>':'')+'<div class="task-list">'+g.items.map(taskHtml).join('')+'</div>').join('');
}
function emptyHtml(){ const map={all:['☰','还没有事项','点击下方按钮新建，或用麦克风快速记录。'],today:['▣','今天没有截止事项','今天没有需要处理的截止事项。'],scheduled:['◷','还没有已安排的事项','设置截止日期后，事项会出现在这里。'],completed:['✓','还没有已完成事项','完成的事项可以在这里查看或取消完成。']}; const [icon,title,desc]=map[state.page]; return `<div class="empty-state"><div class="empty-symbol">${icon}</div><h2>${title}</h2><p>${desc}</p><button class="primary-button" id="emptyNew">新建事项</button></div>`; }
function taskHtml(t){ return `<article class="task-item" data-task="${t.id}"><button class="check ${t.completedAt?'completed':''}" data-complete="${t.id}" aria-label="${t.completedAt?'取消完成':'完成事项'}">${t.completedAt?'✓':''}</button><div class="task-main"><div class="task-title">${escapeHtml(t.title)}</div>${t.subtitle?`<div class="task-subtitle">${escapeHtml(t.subtitle)}</div>`:''}</div>${formatDue(t)?`<div class="task-meta ${t.reminder?.enabled?'has-reminder':''}">${escapeHtml(formatDue(t))}${t.reminder?.enabled?' · 🔔':''}</div>`:''}<button class="delete-inline" data-delete="${t.id}" aria-label="删除事项" title="删除"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v7M14 11v7M6 7l1 13h10l1-13M9 7l1-3h4l1 3"/></svg></button></article>`; }
function syncDateControls(){ $('dateValue').textContent=$('dateEnabled').checked?formatDate($('dateInput').value):'未设置'; $('timeValue').textContent=$('timeEnabled').checked?($('timeInput').value||'请选择'):'未设置'; const count=state.reminders.length;$('reminderValue').textContent=$('reminderEnabled').checked?(count?`${count}个提醒`:'请选择提醒'):'关闭'; $('repeatValue').textContent=state.repeat==='none'?'不重复':state.repeat==='daily'?'每天':state.repeat==='weekly'?`每周${state.weekdays.map(i=>weekdayNames[i-1]).join('、')||'未选择'}`:`每月第一个星期${weekdayNames[Number($('monthlyWeekday').value)-1]}`; }
function openModal(id=null){ if(stopActiveVoice)stopActiveVoice();$('voiceTranscriptPanel').classList.add('hidden'); state.editingId=id;state._repeatOpen=false; state._defaultReminderPending=!id; $('formHint').textContent=''; state.repeat='none';state.weekdays=[]; const t=id?tasks.find(x=>x.id===id):null; $('modalTitle').textContent=t?'事项详情':'新事项'; $('titleInput').value=t?.title||''; $('subtitleInput').value=t?.subtitle||''; $('dateEnabled').checked=!!t?.dueDate; $('dateInput').value=t?.dueDate||''; $('timeEnabled').checked=!!t?.dueTime; $('timeInput').value=t?.dueTime||''; $('reminderEnabled').checked=!!t?.reminder?.enabled; $('reminderInput').value=t?.reminder?.kind||preferences.kind; $('customReminderAmount').value=t?.reminder?.amount||preferences.amount; $('customReminderUnit').value=t?.reminder?.unit||preferences.unit; $('monthlyWeekday').value=t?.repeat?.monthlyWeekday||(t?.dueDate?(new Date(t.dueDate+'T12:00:00Z').getUTCDay()||7):1); state.repeat=t?.repeat?.frequency||'none';state.weekdays=t?.repeat?.weekdays||[]; $('repeatEndInput').value=t?.repeat?.endDate||''; $('deleteTask').classList.toggle('hidden',!t); syncPanels(); $('modalBackdrop').classList.remove('hidden'); state._repeatOpen=state.repeat!=='none';syncPanels();setTimeout(()=>$('titleInput').focus(),0); }
function syncPanels(){ $('repeatRow').setAttribute('aria-expanded',String(!!state._repeatOpen)); if(state._defaultReminderPending && $('dateEnabled').checked){$('reminderEnabled').checked=preferences.defaultReminder;state._defaultReminderPending=false;} $('datePanel').classList.toggle('hidden',!$('dateEnabled').checked); $('timePanel').classList.toggle('hidden',!$('timeEnabled').checked); $('reminderPanel').classList.toggle('hidden',!$('reminderEnabled').checked || !$('dateEnabled').checked); $('customReminderPanel').classList.toggle('hidden',$('reminderInput').value!=='custom'); $('repeatPanel').classList.toggle('hidden',!state._repeatOpen); $('monthlyPanel').classList.toggle('hidden',state.repeat!=='monthly'); $('weeklyPanel').classList.toggle('hidden',state.repeat!=='weekly'); $('repeatEndLabel').classList.toggle('hidden',state.repeat==='none'); document.querySelectorAll('.repeat-choice').forEach(b=>b.classList.toggle('selected',b.dataset.repeat===state.repeat)); document.querySelector('.weekday-grid').innerHTML=weekdayNames.map((n,i)=>`<button type="button" class="weekday ${state.weekdays.includes(i+1)?'selected':''}" data-weekday="${i+1}">周${n}</button>`).join('');document.querySelectorAll('[data-weekday]').forEach(b=>b.addEventListener('click',()=>{const n=Number(b.dataset.weekday);state.weekdays=state.weekdays.includes(n)?state.weekdays.filter(x=>x!==n):[...state.weekdays,n];syncPanels();})); syncDateControls(); }
function closeModal(){ $('modalBackdrop').classList.add('hidden');if($('voiceTask'))setupVoiceCapture($('voiceTask')); }
function saveTask(){
  const title=$('titleInput').value.trim();
  if(!title){$('formHint').textContent='请填写标题';return;}
  if(!$('taskForm').reportValidity())return;
  if(state.repeat!=='none'){
    if(!$('dateEnabled').checked||!$('dateInput').value){$('formHint').textContent='重复事项需要截止日期';return;}
    if(state.repeat==='weekly'&&!state.weekdays.length){$('formHint').textContent='请选择至少一个星期';return;}
    if($('repeatEndInput').value && $('repeatEndInput').value<$('dateInput').value){$('formHint').textContent='结束日期不能早于本次截止日期';return;}
  }
  const existing=tasks.find(t=>t.id===state.editingId);
  const t={...(existing||{id:crypto.randomUUID(),createdAt:new Date().toISOString()})};
  Object.assign(t,{title,subtitle:$('subtitleInput').value.trim(),dueDate:$('dateEnabled').checked?$('dateInput').value:'',dueTime:$('timeEnabled').checked?$('timeInput').value:'',updatedAt:new Date().toISOString()});
  t.reminder={enabled:$('reminderEnabled').checked&&!!t.dueDate,kind:$('reminderInput').value,amount:Number($('customReminderAmount').value)||1,unit:$('customReminderUnit').value};
  t.repeat=state.repeat==='none'?null:{frequency:state.repeat,weekdays:[...state.weekdays],monthlyWeekday:Number($('monthlyWeekday').value),endDate:$('repeatEndInput').value||''};
  if(!commitTasks(existing?tasks.map(x=>x.id===t.id?t:x):[...tasks,t]))return;
  closeModal();showToast('已保存');render();
}
function commitTasks(next){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));tasks=next;return true;}
  catch{showToast('保存失败：浏览器存储不可用，请重试。',5000);return false;}
}
function toggleTask(id){
  const original=tasks.find(t=>t.id===id);if(!original)return;
  const restored=!!original.completedAt;
  const t={...original,completedAt:restored?null:new Date().toISOString(),updatedAt:new Date().toISOString()};
  let next=tasks.map(x=>x.id===id?t:x);
  if(!restored)next=withNextOccurrence(next,t);
  if(commitTasks(next)){showToast(restored?'已恢复到未完成':'已完成');render();}
}
function deleteTask(){if(deleteTaskById(state.editingId))closeModal();}
function deleteTaskById(id){if(!tasks.some(t=>t.id===id))return false;if(!commitTasks(tasks.filter(t=>t.id!==id)))return false;showToast('事项已删除');render();return true;}
function showToast(text,duration=1800){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove('show'),duration);}

$('menuToggle').addEventListener('click',()=>{state.menuOpen=!state.menuOpen;$('sidebar').classList.toggle('collapsed',!state.menuOpen);$('sidebar').inert=!state.menuOpen;});
$('searchToggle').addEventListener('click',()=>{if(state.page==='settings')return;state.searchOpen=!state.searchOpen;state.query='';if(state.searchOpen){state.menuOpen=false;}render();});
$('closeModal').addEventListener('click',closeModal); $('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();}); $('deleteTask').addEventListener('click',deleteTask);
['dateEnabled','timeEnabled','reminderEnabled','dateInput','timeInput','monthlyWeekday'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='dateEnabled'&&!$('dateEnabled').checked){$('reminderEnabled').checked=false;$('timeEnabled').checked=false;state.repeat='none';state._repeatOpen=false;} if((id==='timeEnabled'||id==='reminderEnabled')&&$(id).checked&&!$('dateEnabled').checked){$('dateEnabled').checked=true;showToast('请先选择截止日期',3500);}syncPanels();}));
document.addEventListener('click',e=>{if(e.target.id==='emptyNew')openModal();});
$('taskForm').addEventListener('submit',e=>{e.preventDefault();$('saveTask').click();});
document.addEventListener('DOMContentLoaded',render);
function parseVoiceText(text){
  const now=new Date(); let dueDate=''; let dueTime=''; let cleaned=text.trim();
  const dateMatch=cleaned.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/);
  const months={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  const enDate=cleaned.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if(dateMatch) dueDate=now.getFullYear()+'-'+String(Number(dateMatch[1])).padStart(2,'0')+'-'+String(Number(dateMatch[2])).padStart(2,'0');
  else if(enDate) dueDate=now.getFullYear()+'-'+String(months[enDate[1].toLowerCase()]).padStart(2,'0')+'-'+String(Number(enDate[2])).padStart(2,'0');
  else if(/后天|the day after tomorrow/i.test(cleaned)){const d=new Date(now);d.setDate(d.getDate()+2);dueDate=localDateString(d);}
  else if(/明天|tomorrow/i.test(cleaned)){const d=new Date(now);d.setDate(d.getDate()+1);dueDate=localDateString(d);}
  else if(/今天|today/i.test(cleaned)) dueDate=localDateString(now);
  const tm=cleaned.match(/(?:(早上|上午|晚上|下午|凌晨)\s*)?(\d{1,2})\s*(?:[点时:]\s*(\d{1,2})?|\s*(上午|下午|晚上|早上|凌晨|am|pm))/i);
  if(tm){let h=Number(tm[2]),m=Number(tm[3]||0),mark=(tm[1]||tm[4]||'').toLowerCase();if((mark==='下午'||mark==='晚上'||mark==='pm')&&h<12)h+=12;if((mark==='凌晨'||mark==='am')&&h===12)h=0;if(h<=23&&m<=59)dueTime=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
  cleaned=cleaned.replace(/^(?:我|我要|我想|请|需要|要)?\s*(?:在|于)?\s*/,'').replace(/\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号)?/g,'').replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/ig,'').replace(/后天|明天|今天|the day after tomorrow|tomorrow|today/ig,'').replace(/(?:早上|上午|晚上|下午|凌晨)?\s*\d{1,2}(?:\s*[点时:]\s*\d{1,2})?\s*(?:上午|下午|晚上|早上|凌晨|am|pm)?/ig,'').replace(/^(?:这|在|于)\s*/,'').replace(/^(?:完成|截止|交|提交|做完|finish|complete|submit)\s*/i,'').replace(/^(?:我要|我想|需要|要)\s*(?:完成|交|提交|做完|finish|complete|submit)\s*/i,'').replace(/(?:的时候|时|标题为|标题是)/g,' ').replace(/(完成|截止|交|提交|做完|前|due|by|at|on)/ig,' ').replace(/[，,。.!！]/g,' ').replace(/\s+/g,' ').trim();
  return {title:cleaned||text.trim(),dueDate,dueTime};
}
let stopActiveVoice=null;
function setupVoiceCapture(button){
  if(stopActiveVoice)stopActiveVoice();
  button.disabled=false;button.classList.remove('recording');button.textContent='🎙 开始说话';
  const Engine=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Engine){button.textContent='语音暂不可用';button.title='此浏览器不支持语音识别，请使用手动新增';button.disabled=true;return;}
  let rec=null,phase='idle',transcript='',failed=false,disposed=false,watchdog;
  const reset=()=>{clearTimeout(watchdog);phase='idle';rec=null;button.disabled=false;button.classList.remove('recording');button.textContent='🎙 开始说话';};
  stopActiveVoice=()=>{disposed=true;clearTimeout(watchdog);if(rec){rec.onend=null;rec.onerror=null;try{rec.abort();}catch{}}};
  button.onclick=()=>{
    if(phase==='stopping')return;
    if(phase!=='idle'){
      phase='stopping';button.disabled=true;button.textContent='正在识别…';
      try{rec.stop();}catch{reset();showToast('停止录音失败，请重试',4000);}
      return;
    }
    phase='starting';failed=false;transcript='';button.textContent='正在启动麦克风…';
    const session=rec=new Engine();session.lang='zh-CN';session.continuous=true;session.interimResults=true;
    watchdog=setTimeout(()=>{if(rec===session){failed=true;session.abort();reset();showToast('语音等待超时，请检查麦克风权限或重试',5000);}},90000);
    session.onstart=()=>{if(disposed||rec!==session)return;if(phase==='stopping'){session.stop();return;}phase='recording';button.classList.add('recording');button.textContent='⏹ 停止录音';showToast('正在录音，说完后再点一次停止',4000);};
    session.onresult=e=>{if(!disposed)transcript=Array.from(e.results).map(r=>r[0].transcript).join(' ');};
    session.onerror=e=>{
      failed=true;
      const errors={'not-allowed':'麦克风未获允许，请检查浏览器网站权限','audio-capture':'没有检测到可用麦克风','network':'语音服务连接失败，请稍后重试','no-speech':'没有识别到语音，请重试','service-not-allowed':'此浏览器的语音服务不可用'};
      if(!disposed)showToast(errors[e.error]||'语音识别失败，请重试',5000);
    };
    session.onend=()=>{
      if(disposed||rec!==session)return;
      const text=transcript.trim();reset();
      if(failed)return;
      if(!text){showToast('没有识别到内容，请再试一次',4000);return;}
      const p=parseVoiceText(text);openModal();
      $('voiceTranscriptText').textContent=text;$('voiceTranscriptPanel').classList.remove('hidden');
      $('titleInput').value=p.title;$('dateEnabled').checked=!!p.dueDate;$('dateInput').value=p.dueDate;$('timeEnabled').checked=!!p.dueTime;$('timeInput').value=p.dueTime;syncPanels();
      showToast('请检查识别结果，点击绿色勾保存',4000);
    };
    try{session.start();}catch{failed=true;reset();showToast('语音启动失败，请重试',4000);}
  };
}
