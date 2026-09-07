// Keep each occurrence independently completable; restored occurrences do not erase later ones.
function nextRepeatDate(task){
  const r=task.repeat;if(!r || !task.dueDate || r.frequency==='none')return '';
  const start=new Date(task.dueDate+'T12:00:00Z');
  if(!Number.isFinite(start.getTime()))return '';
  const days=r.weekdays?.length?r.weekdays:[start.getUTCDay()||7];
  for(let i=1;i<=370;i++){
    const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);
    const date=d.toISOString().slice(0,10);
    if(r.endDate && date>r.endDate)return '';
    const weekday=d.getUTCDay()||7;
    if(r.frequency==='daily' || (r.frequency==='weekly' && days.includes(weekday)) || (r.frequency==='monthly' && d.getUTCDate()<=7 && weekday===(r.monthlyWeekday||start.getUTCDay()||7)))return date;
  }
  return '';
}
function withNextOccurrence(list,completedTask){
  const date=nextRepeatDate(completedTask);if(!date)return list;
  const seriesId=completedTask.seriesId||completedTask.id;
  const id=seriesId+'@'+date;
  if(list.some(t=>t.id===id || ((t.seriesId||t.id)===seriesId && t.dueDate===date)))return list;
  return [...list,{...completedTask,id,seriesId,dueDate:date,completedAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
}
