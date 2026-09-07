const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const data={},elements=new Map();
function element(id){if(!elements.has(id)) elements.set(id,{value:'',checked:false,hidden:false,dataset:{},selectedOptions:[{textContent:'选项'}],classList:{toggle(){},add(){},remove(){}},addEventListener(){},setAttribute(){},focus(){}});return elements.get(id);}
const ctx=vm.createContext({console,Intl,Date,JSON,Number,setTimeout(){},clearTimeout(){},document:{documentElement:{dataset:{}},getElementById:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){}},window:{},localStorage:{getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v},deadlineInstant:()=>Date.parse('2026-09-21T02:00:00Z')});
for(const file of ['app.js','settings.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),ctx);
ctx.renderSettings();
element('prefDefault').checked=true;element('prefKind').value='custom';element('prefAmount').value='3';element('prefUnit').value='hour';element('prefText').value='large';element('prefSystem').checked=false;
element('preferencesForm').onsubmit({preventDefault(){}});
assert.equal(JSON.parse(data.personal_schedule_settings_v1).amount,3);
assert.equal(ctx.document.documentElement.dataset.textSize,'large');
assert.equal(ctx.loadPreferences().systemNotifications,false);
ctx.openModal();assert.equal(element('reminderEnabled').checked,false);
element('dateEnabled').checked=true;ctx.syncPanels();assert.equal(element('reminderEnabled').checked,true);assert.equal(element('customReminderAmount').value,3);
element('reminderEnabled').checked=false;ctx.syncPanels();assert.equal(element('reminderEnabled').checked,false);
vm.runInContext("tasks=[{id:'existing',dueDate:'2026-09-20',reminder:{enabled:false,kind:'at_due'}}]",ctx);
ctx.openModal('existing');assert.equal(element('reminderEnabled').checked,false);assert.equal(element('reminderInput').value,'at_due');
console.log('PASS: preferences persisted/reloaded, font applied, new dated task defaults, manual override, existing task preserved');
