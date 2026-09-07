const SETTINGS_KEY='personal_schedule_settings_v1';
function loadPreferences(){
  const defaults={defaultReminder:false,kind:'one_day',amount:1,unit:'hour',systemNotifications:true,textSize:'normal',theme:'light'};
  try{return {...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};}catch{return defaults;}
}
let preferences=loadPreferences();
function applyPreferences(){document.documentElement.dataset.textSize=preferences.textSize;document.documentElement.dataset.theme=preferences.theme==='dark'?'dark':'light';}
function settingsPanel(title,content){return `<details class="settings-section"><summary>${title}<span aria-hidden="true">›</span></summary><div class="settings-body">${content}</div></details>`;}
function renderSettings(){
  $('content').innerHTML=`<div class="page-heading"><div><h1>设置</h1><p>点击项目展开设置</p></div></div><form id="preferencesForm">
  ${settingsPanel('默认提醒',`<label class="preferences-row">新事项设置日期后自动开启提醒<input id="prefDefault" type="checkbox" class="switch" ${preferences.defaultReminder?'checked':''}></label><p class="reminder-help">仅影响新建事项。已有事项保留原设置；每条事项都能单独关闭或修改提醒。</p><div id="prefReminderOptions" ${preferences.defaultReminder?'':'hidden'}><label class="field-label">默认提前时间<select id="prefKind"><option value="one_day">截止前一天</option><option value="half_day">截止前半天</option><option value="at_due">截止那一刻</option><option value="custom">自定义</option></select></label><div id="prefCustom"><label class="field-label">提前数量<input id="prefAmount" type="number" min="1" max="999" step="1" value="${Number(preferences.amount)||1}"></label><label class="field-label">单位<select id="prefUnit"><option value="minute">分钟</option><option value="hour">小时</option><option value="day">天</option></select></label></div></div>`)}
  ${settingsPanel('提醒设备',`<p>当前电脑：网页内弹窗已启用。</p><label class="preferences-row">同时发送系统通知<input id="prefSystem" type="checkbox" class="switch" ${preferences.systemNotifications?'checked':''}></label><div class="notification-actions"><button type="button" id="settingsPermission">允许系统通知</button><button type="button" id="settingsTest">测试提醒</button></div><p id="settingsNotificationStatus" role="status" class="reminder-help"></p><p class="reminder-help">网页需要保持打开。iPhone 提醒、账号同步和关闭网页后的提醒尚未接入。</p>`)}
  ${settingsPanel('时区显示',`<p>截止时间按西雅图时间输入，同时显示北京时间。</p><p class="reminder-help">西雅图按日期自动使用 PDT / PST；北京时间显示 CST。两个时间并排显示。</p><p id="timezonePreview"></p>`)}
  ${settingsPanel('外观',`<label class="field-label">页面颜色<select id="prefTheme"><option value="light">浅色</option><option value="dark">深色</option></select></label><label class="field-label">文字大小<select id="prefText"><option value="normal">标准</option><option value="large">较大</option></select></label>`)}
  <div class="preferences-footer"><span id="preferencesStatus" role="status"></span><button class="confirm-button" type="submit" aria-label="保存设置" title="保存设置">✓</button></div></form>`;
  $('prefKind').value=preferences.kind;$('prefUnit').value=preferences.unit;$('prefText').value=preferences.textSize;$('prefTheme').value=preferences.theme==='dark'?'dark':'light';
  $('prefTheme').onchange=()=>{
    const theme=$('prefTheme').value==='dark'?'dark':'light';
    preferences={...preferences,theme};applyPreferences();
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({...loadPreferences(),theme}));$('preferencesStatus').textContent='页面颜色已保存';}
    catch{$('preferencesStatus').textContent='颜色已切换，但保存失败，重新打开后可能恢复';}
  };
  const sync=()=>{$('prefReminderOptions').hidden=!$('prefDefault').checked;$('prefCustom').hidden=$('prefKind').value!=='custom';$('prefAmount').disabled=!$('prefDefault').checked||$('prefKind').value!=='custom';};
  $('prefText').onchange=()=>{
    const textSize=$('prefText').value;preferences={...preferences,textSize};applyPreferences();
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({...loadPreferences(),textSize}));$('preferencesStatus').textContent='文字大小已保存';}
    catch{$('preferencesStatus').textContent='字号已调整，但未能保存';}
  };
  const changed=()=>{sync();$('preferencesStatus').textContent='提醒设置有修改，请点绿色勾保存';};
  $('prefDefault').onchange=changed;$('prefKind').onchange=changed;$('prefSystem').onchange=changed;$('prefAmount').oninput=changed;$('prefUnit').onchange=changed;sync();
  const status=()=>{$('settingsNotificationStatus').textContent=!('Notification' in window)?'此浏览器不支持系统通知。':Notification.permission==='granted'?'系统通知权限已允许。':Notification.permission==='denied'?'系统通知被阻止，请在浏览器网站权限中允许通知。':'系统通知尚未授权。';};status();
  $('settingsPermission').onclick=async()=>{await requestReminderPermission();status();};
  $('settingsTest').onclick=()=>showReminder({},true,$('prefSystem').checked);
  $('timezonePreview').textContent=formatDue({dueDate:'2026-09-20',dueTime:'19:00'});
  $('preferencesForm').onsubmit=event=>{
    event.preventDefault();
    const next={defaultReminder:$('prefDefault').checked,kind:$('prefKind').value,amount:Number($('prefAmount').value)||1,unit:$('prefUnit').value,systemNotifications:$('prefSystem').checked,textSize:$('prefText').value,theme:$('prefTheme').value==='dark'?'dark':'light'};
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));preferences=next;applyPreferences();$('preferencesStatus').textContent='设置已保存';}
    catch{$('preferencesStatus').textContent='保存失败，请检查浏览器存储空间后重试';}
  };
}
applyPreferences();
