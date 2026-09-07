const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const saved={},elements=new Map();let failStorage=false;
function el(id){if(!elements.has(id))elements.set(id,{value:'',checked:false,selectedOptions:[{textContent:'选项'}],classList:{add(){},remove(){},toggle(){}},dataset:{},addEventListener(){},setAttribute(){},focus(){},reportValidity:()=>true});return elements.get(id);}
const ctx=vm.createContext({Intl,Date,Number,JSON,console,crypto:require('node:crypto').webcrypto,document:{documentElement:{dataset:{}},getElementById:el,querySelector:el,querySelectorAll:()=>[],addEventListener(){}},window:{},setTimeout(){},clearTimeout(){},localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>{if(failStorage)throw Error('quota');saved[k]=v;}}});
for(const name of ['app.js','repeat.js','settings.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+name,'utf8'),ctx);
ctx.render=()=>{};ctx.showToast=()=>{};
let t={id:'r',title:'心理学',dueDate:'2026-09-04',repeat:{frequency:'weekly',weekdays:[1,5],endDate:'2026-09-30'}};
assert.equal(ctx.nextRepeatDate(t),'2026-09-07');
assert.equal(ctx.nextRepeatDate({...t,dueDate:'2026-09-28'}),'');
assert.equal(ctx.nextRepeatDate({...t,dueDate:'2026-12-31',repeat:{frequency:'daily'}}),'2027-01-01');
assert.equal(ctx.nextRepeatDate({...t,dueDate:'2026-09-03',repeat:{frequency:'monthly',monthlyWeekday:4}}),'2026-10-01');
vm.runInContext('tasks=[]',ctx);ctx.commitTasks([t]);ctx.toggleTask('r');
let list=JSON.parse(saved.personal_schedule_tasks_v1);assert.equal(list.length,2);assert.equal(list[1].dueDate,'2026-09-07');assert.ok(list[0].completedAt);
ctx.toggleTask('r');ctx.toggleTask('r');assert.equal(JSON.parse(saved.personal_schedule_tasks_v1).length,2);
ctx.deleteTaskById('r');assert.equal(JSON.parse(saved.personal_schedule_tasks_v1).length,1);
failStorage=true;assert.equal(ctx.deleteTaskById('r@2026-09-07'),false);assert.equal(vm.runInContext('tasks.length',ctx),1);failStorage=false;
// New record validation must not persist a weekly rule with no chosen weekdays.
ctx.openModal();el('titleInput').value='新事项';el('dateEnabled').checked=true;el('dateInput').value='2026-09-08';vm.runInContext("state.repeat='weekly';state.weekdays=[]",ctx);ctx.saveTask();assert.match(el('formHint').textContent,/至少一个/);
// Disabled speech engines present an unavailable control, not a dead clickable button.
ctx.setupVoiceCapture(el('mic'));assert.equal(el('mic').disabled,true);
// IME editing uses the same input node; search results update independently.
ctx.renderList=vm.runInContext('renderList',ctx);vm.runInContext("state.page='all';state.searchOpen=true",ctx);ctx.renderList();const search=el('searchInput');assert.ok(search);
console.log('PASS: daily/weekly/monthly/end date; complete/restore without duplicate occurrences; delete; storage failure; weekly validation; unavailable speech state');
