(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./game-core.js'),require('./scripture.js'));else root.LMC_LIVE_CORE=factory(root.GameCore,root.LMC_SCRIPTURE);})(typeof globalThis!=='undefined'?globalThis:this,function(GameCore,Scripture){'use strict';
function teams(value){if(!Array.isArray(value)||value.length!==2)throw new Error('Two teams are required.');return value.map(t=>{if(typeof t?.name!=='string'||!t.name.trim()||t.name.length>32||!Number.isSafeInteger(t.score)||Math.abs(t.score)>1e9)throw new Error('Invalid team name or score.');return {name:t.name.trim(),score:t.score};});}
function roundFor(value,game){if(!['single','double','final'].includes(value))throw new Error('Invalid round.');if(value==='double'&&!game.doubleJeopardy||value==='final'&&!game.finalJeopardy)throw new Error('That round is not in this game.');return value;}
function usedFor(value,game){const result={};for(const round of ['single','double'])GameCore.roundCategories(game,round).forEach((c,ci)=>c.questions.forEach((q,qi)=>{const key=(round==='double'?'double:':'')+ci+':'+qi,v=value?.[key];if(v){result[key]={winner:[0,1].includes(v.winner)?v.winner:null,missed:Array.isArray(v.missed)?[...new Set(v.missed.filter(i=>i===0||i===1))]:[]};if(v.kind==='daily-double'&&Number.isSafeInteger(v.wager)&&v.wager>=0&&v.wager<=1e9)Object.assign(result[key],{kind:v.kind,wager:v.wager});}}));return result;}
function stateFields(raw,game){
  const state={version:1,game,teams:teams(raw.teams),activeTeam:raw.activeTeam===1?1:0,round:roundFor(raw.round||'single',game),used:usedFor(raw.used,game),dailySession:null,finalSession:null,finalScored:false,settings:{timer:[0,15,30,45,60].includes(raw.settings?.timer)?raw.settings.timer:30,deductWrong:raw.settings?.deductWrong===true}};
  if(raw.dailySession){const d=raw.dailySession;if(![0,1].includes(d.team)||!GameCore.questionFor(state,d.key).dailyDouble||state.used[d.key])throw new Error('Invalid locked Daily Double.');state.dailySession={key:d.key,team:d.team,wager:GameCore.validateWager(d.wager,GameCore.wagerLimit(state,d.team))};}
  if(raw.finalSession){const f=raw.finalSession;if(!game.finalJeopardy||!['question','review','complete'].includes(f.phase)||!Array.isArray(f.wagers)||f.wagers.length!==2||!Array.isArray(f.correct)||f.correct.length!==2||f.correct.some(v=>v!==null&&typeof v!=='boolean'))throw new Error('Invalid final round.');f.wagers.forEach((w,i)=>GameCore.validateWager(w,f.phase==='complete'?1e9:Math.max(0,state.teams[i].score)));if(f.phase==='complete'&&f.correct.some(v=>typeof v!=='boolean'))throw new Error('Mark both final answers.');state.finalSession={phase:f.phase,wagers:[...f.wagers],correct:[...f.correct]};state.finalScored=f.phase==='complete'&&raw.finalScored===true;}
  return state;
}
function normalizeSnapshot(raw){
  if(!raw?.state)throw new Error('Missing game state.');const game=GameCore.validateGame(raw.state.game),state=stateFields(raw.state,game);
  state.history=Array.isArray(raw.state.history)?raw.state.history.slice(-40).map(h=>{const value=stateFields({...h,settings:state.settings},game);delete value.game;delete value.settings;delete value.version;return value;}):[];
  let pending=null;
  if(raw.pending){const p=raw.pending,q=GameCore.questionFor(state,p.key),indices=p.key.split(':').slice(-2).map(Number);if(state.used[p.key]||![0,1].includes(p.team)||!Array.isArray(p.attempted)||p.attempted.some(i=>i!==0&&i!==1)||p.attempted.length>2)throw new Error('Invalid current question.');pending={key:p.key,value:q.value,question:q,category:GameCore.roundCategories(game,state.round)[indices[0]].name,team:p.team,attempted:[...new Set(p.attempted)],revealed:p.revealed===true,kind:q.dailyDouble?'daily-double':'regular'};
    if(q.dailyDouble&&state.dailySession?.key===p.key){pending.team=state.dailySession.team;pending.wager=state.dailySession.wager;}
    if(p.review){if(q.dailyDouble&&!state.dailySession)throw new Error('Lock the wager first.');const result=GameCore.answerClue(state,pending,p.review.status,state.settings.deductWrong);if(!result.result)throw new Error('A steal is still available.');pending.review={status:p.review.status,result:result.result};pending.revealed=true;}
    if(pending.review){const reading=Scripture.normalize(p.scripture,q.reference);if(reading)pending.scripture=reading;}
  }
  const remaining=Number.isInteger(raw.timer?.remaining)?Math.max(0,Math.min(60,raw.timer.remaining)):state.settings.timer;
  const endAt=Number.isSafeInteger(raw.timer?.endAt)&&raw.timer.endAt<=Date.now()+120000&&raw.timer.endAt>=Date.now()-86400000?raw.timer.endAt:null;
  return {state,pending,timer:{remaining,running:raw.timer?.running===true&&!!endAt,endAt},resultsShown:raw.resultsShown===true};
}
function projectDisplay(snapshot){
  const {state,pending,timer}=snapshot,final=state.game.finalJeopardy,f=state.finalSession;
  const view={title:state.game.title,round:state.round,teams:state.teams,activeTeam:state.activeTeam,screen:'board',board:GameCore.roundCategories(state.game,state.round).map((c,ci)=>({name:c.name,clues:c.questions.map((q,qi)=>({value:q.value,used:!!state.used[(state.round==='double'?'double:':'')+ci+':'+qi]}))})),timer};
  if(state.round==='final'&&final){view.screen='final';view.final={category:final.category,phase:f?.phase||'wager',question:f?final.question:null,answer:f&&f.phase!=='question'?final.answer:null,reference:f&&f.phase!=='question'?final.reference:null,wagers:f&&f.phase!=='question'?f.wagers:null,correct:f&&f.phase!=='question'?f.correct:null,scored:state.finalScored};}
  if(pending){const locked=pending.kind!=='daily-double'||state.dailySession?.key===pending.key;view.screen=locked?'clue':'daily-wager';view.activeTeam=pending.review?.result.activeTeam??pending.team;view.clue={category:pending.category,team:pending.team,value:pending.kind==='daily-double'?pending.wager??null:pending.value,dailyDouble:pending.kind==='daily-double',question:locked?pending.question.question:null,answer:locked&&pending.revealed?pending.question.answer:null,reference:locked&&pending.revealed?pending.question.reference:null,reviewing:!!pending.review,attempted:pending.attempted};}
  if(pending?.review&&view.clue){const reading=Scripture.project(pending.scripture,pending.question.reference);if(reading)view.clue.scripture=reading;}
  if(snapshot.resultsShown)view.screen='results';
  return view;
}

function syncSignature(snapshot){const copy=JSON.parse(JSON.stringify(snapshot));if(copy.timer?.running)copy.timer.remaining=0;return JSON.stringify(copy);}
return {normalizeSnapshot,projectDisplay,syncSignature};
});
