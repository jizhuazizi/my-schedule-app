// Deadline fields are Seattle wall-clock values, independent of device timezone.
function deadlineInstant(date, time = '09:00') {
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall)) return NaN;
  const fmt = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
  let result = wall;
  for (let i=0;i<4;i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(result)).map(p=>[p.type,p.value]));
    const rendered = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    const correction = wall-rendered;
    if (!correction) return result;
    result += correction;
  }
  return NaN; // A nonexistent spring-forward time must not silently shift.
}
function reminderInstant(task) {
  if (task.completedAt || !task.dueDate || !task.reminder?.enabled) return NaN;
  const r=task.reminder;
  const offsets={one_day:1440,half_day:720,at_due:0};
  const units={minute:1,hour:60,day:1440};
  const minutes=r.kind==='custom' ? Number(r.amount)*units[r.unit] : offsets[r.kind];
  if (!Number.isFinite(minutes) || minutes<0) return NaN;
  return deadlineInstant(task.dueDate,task.dueTime||'09:00')-minutes*60000;
}
function reminderInstants(task) {
  const list=Array.isArray(task.reminders)?task.reminders:(task.reminder?.enabled?[task.reminder]:[]);
  return list.map(r=>reminderInstant({...task,reminder:{...r,enabled:true}})).filter(Number.isFinite);
}
function showReminder(task, test=false, systemEnabled=preferences.systemNotifications) {
  const card=document.createElement('section');
  card.className='reminder-popup';
  card.setAttribute('role','alert');
  const title=document.createElement('strong');title.textContent=test?'测试提醒':task.title;
  const body=document.createElement('p');body.textContent=test?'你可以在这里收到到点提醒。':`提醒时间已到 · ${formatDue(task)}`;
  const dismiss=document.createElement('button');dismiss.textContent='知道了';dismiss.onclick=()=>card.remove();
  card.append(title,body,dismiss);document.getElementById('reminderAlerts').append(card);
  if (systemEnabled && 'Notification' in window && Notification.permission==='granted') {
    try { new Notification(title.textContent,{body:body.textContent,tag:test?'reminder-test':task.id}); } catch { /* The persistent in-page card remains available. */ }
  }
}
async function requestReminderPermission() {
  const status=document.getElementById('notificationStatus');
  if (!('Notification' in window)) { status.textContent='此浏览器暂不支持系统通知；网页内仍会弹出提醒。'; return; }
  try {
    const permission=await Notification.requestPermission();
    status.textContent=permission==='granted'?'系统通知已允许。网页需保持打开。':'系统通知未获允许，网页内仍会弹出提醒。可在浏览器网站权限中开启通知。';
  } catch { status.textContent='无法开启系统通知；网页内仍会弹出提醒。'; }
}
function checkReminders(now=Date.now()) {
  let delivered;
  try { delivered=JSON.parse(localStorage.getItem('personal_schedule_delivered_v1')||'{}'); } catch {delivered={};}
  // Read fresh data so another tab's edits/deletions are respected.
  for (const task of loadTasks()) {
    for(const at of reminderInstants(task)){
      const key=task.id+'|'+at;
      if (at>now || delivered[key]) continue;
      delivered[key]=now;
      showReminder(task);
    }
  }
  try {localStorage.setItem('personal_schedule_delivered_v1',JSON.stringify(delivered));} catch {}
}
document.getElementById('enableNotifications').addEventListener('click',async()=>{await requestReminderPermission();if(!preferences.systemNotifications)$('notificationStatus').textContent+=' 设置中的系统通知开关目前关闭，请开启并保存。';});
document.getElementById('saveTask').addEventListener('click',event=>{
  let error='';
  if ($('dateEnabled').checked && !$('dateInput').value) error='请选择截止日期';
  else if ($('timeEnabled').checked && (!$('dateEnabled').checked || !$('timeInput').value)) error='请设置截止日期和时间';
  else if ($('dateEnabled').checked && !Number.isFinite(deadlineInstant($('dateInput').value,$('timeEnabled').checked?$('timeInput').value:'09:00'))) error='该西雅图时间不存在，请选择其他时间';
  else if ($('reminderEnabled').checked && !$('dateEnabled').checked) error='请先设置截止日期，再开启提醒';
  else if ($('reminderEnabled').checked && state.reminders.some(r=>r.kind==='custom' && (!Number.isInteger(Number(r.amount)) || Number(r.amount)<1 || Number(r.amount)>999))) error='提前数量请填写 1 至 999 的整数';
  $('formHint').textContent=error;
  if(error){event.preventDefault();event.stopImmediatePropagation();}
},true);
['customReminderAmount','customReminderUnit'].forEach(id=>$(id).addEventListener('input',syncDateControls));
document.getElementById('testReminder').addEventListener('click',()=>showReminder({},true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminders();});
window.addEventListener('storage',()=>checkReminders());
setInterval(checkReminders,1000);
checkReminders();
