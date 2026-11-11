(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = number => number.toLocaleString('en-US');
  const STORAGE_KEY = 'lmc-youth-jepordy-v1';
  const ICONS = {
    settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-.6 2.2-2 .9-2-.6-2 3.5L4 10.5v2.8l-1.6 1.5 2 3.5 2-.6 2 .9L9 21h4l.6-2.4 2-.9 2 .6 2-3.5-1.6-1.5v-2.8l1.6-1.5-2-3.5-2 .6-2-.9L13 3Z"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3v.1"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    collapse:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/>',
    edit:'<path d="m14 5 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-4-4L5 15l-1 5Z"/>',
    folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v1M3 7h16a2 2 0 0 1 2 2l-2 10H3L1 9a2 2 0 0 1 2-2Z"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'arrow-left':'<path d="M20 12H4m6-6-6 6 6 6"/>',
    undo:'<path d="M3 10h10a7 7 0 0 1 0 14M3 10l5-5m-5 5 5 5" transform="translate(0 -3)"/>',
    restart:'<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
    play:'<path d="m8 4 13 8-13 8V4Z"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    printer:'<path d="M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6v-7Z"/><path d="M17 11h1"/>',
    book:'<path d="M12 6v15M12 6C8 3 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-2-1-6-1-10 2Z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    sprout:'<path d="M12 21v-9m0 3C3 15 3 7 3 7s9-1 9 8Zm0-3C12 3 21 3 21 3s1 9-9 9Z"/>',
    person:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    heart:'<path d="m12 21-8-8C-3 6 7-2 12 5c5-7 15 1 8 8l-8 8Z"/>',
    sparkle:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/>',
    quote:'<path d="M9 6H3v7h5c0 3-2 5-5 5m18-12h-6v7h5c0 3-2 5-5 5"/>',
    hash:'<path d="m10 3-4 18M18 3l-4 18M3 9h18M2 16h18"/>',
    trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H3v4a5 5 0 0 0 6 4m8-8h4v4a5 5 0 0 1-6 4M12 14v6m-5 1h10"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.book) + '</svg>';
  function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  let state = { version:1, game: clone(window.STARTER_GAME), teams:[{name:'Team Grace',score:0},{name:'Team Hope',score:0}], activeTeam:0, used:{}, round:'single', dailySession:null, finalSession:null, finalScored:false, settings:{timer:30,deductWrong:false}, history:[] };
  let pending = null, draft = null, draftOriginal = '', editorCategory = 0, confirmAction = null, toastTimeout;
  let editorRound = 'single';
  let timerInterval = null, timerRemaining = 30, timerEnd = null;

  function validTeams(teams) { return Array.isArray(teams) && teams.length === 2 && teams.every(t => t && typeof t.name === 'string' && t.name.trim() && t.name.length <= 32 && Number.isSafeInteger(t.score)); }
  function keyFor(round,ci,qi) { return (round==='double'?'double:':'')+ci+':'+qi; }
  const categories=()=>GameCore.roundCategories(state.game,state.round);
  const playedInRound=()=>categories().reduce((n,c,ci)=>n+c.questions.filter((q,qi)=>state.used[keyFor(state.round,ci,qi)]).length,0);
  function cleanUsed(used, game) { const result = {};for(const round of ['single','double'])for (const [ci,c] of GameCore.roundCategories(game,round).entries()) for (const qi of c.questions.keys()) { const key = keyFor(round,ci,qi); if (used && used[key]) result[key] = used[key]; } return result; }
  function cleanFinal(session,game,teams) { if(!session||!game.finalJeopardy||!['question','review','complete'].includes(session.phase))return null;try{if(!Array.isArray(session.wagers)||session.wagers.length!==2) return null;session.wagers.forEach((w,i)=>GameCore.validateWager(w,session.phase==='complete'?Number.MAX_SAFE_INTEGER:Math.max(0,teams[i].score)));if(!Array.isArray(session.correct)||session.correct.length!==2||session.correct.some(v=>v!==null&&typeof v!=='boolean'))return null;return session;}catch{return null;} }
  function cleanDaily(session,game,teams,round) { if(!session)return null;try{const s={game,teams,round};if(!GameCore.questionFor(s,session.key).dailyDouble)return null;GameCore.validateWager(session.wager,GameCore.wagerLimit(s,session.team));return {key:session.key,team:session.team,wager:session.wager};}catch{return null;} }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      const game = GameCore.validateGame(saved.game);
      if (saved.version !== 1 || !validTeams(saved.teams)) throw new Error('Invalid saved game');
      state = { ...state, game, teams:saved.teams, activeTeam:saved.activeTeam===1?1:0, used:cleanUsed(saved.used,game), round:saved.round==='double'&&game.doubleJeopardy?'double':saved.round==='final'&&game.finalJeopardy?'final':'single',finalSession:cleanFinal(saved.finalSession,game,saved.teams),finalScored:saved.finalScored===true, settings:{ timer:[0,15,30,45,60].includes(saved.settings?.timer)?saved.settings.timer:30, deductWrong:saved.settings?.deductWrong===true }, history:[] };
      state.dailySession=cleanDaily(saved.dailySession,game,saved.teams,state.round);
      if(state.dailySession&&state.used[state.dailySession.key])state.dailySession=null;
      if(!state.finalSession)state.finalScored=false;
      if (Array.isArray(saved.history)) state.history=saved.history.filter(h=>validTeams(h?.teams)&&[0,1].includes(h.activeTeam)&&h.used&&typeof h.used==='object').slice(-40).map(h=>({...h,used:cleanUsed(h.used,game),round:h.round||'single',dailySession:cleanDaily(h.dailySession,game,h.teams,h.round||'single'),finalSession:cleanFinal(h.finalSession,game,h.teams),finalScored:h.finalScored===true}));
    }
  } catch (error) { /* A corrupt saved game falls back to the bundled starter. */ }
  function notifyLive() { document.dispatchEvent(new CustomEvent('lmc:change')); }
  function persist() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch { $('storage-warning').hidden=false; } notifyLive(); }
  function toast(message) { clearTimeout(toastTimeout); $('toast').textContent=message; $('toast').classList.add('show'); toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),3500); }
  function snapshot() { return clone({teams:state.teams,used:state.used,activeTeam:state.activeTeam,round:state.round,dailySession:state.dailySession,finalSession:state.finalSession,finalScored:state.finalScored}); }
  function remember() { state.history.push(snapshot()); if(state.history.length>40) state.history.shift(); }
  function show(id) { if(!$(id).open) $(id).showModal();notifyLive(); }
  function close(id) { if($(id).open) $(id).close();notifyLive(); }
  const totalQuestions = () => categories().reduce((n,c)=>n+c.questions.length,0);
  function render() {
    $('game-title').textContent=state.game.title;
    const final=state.round==='final',lockedFinal=final&&state.finalSession&&!state.finalScored;
    $('game-meta').textContent=final?'Final Jeopardy · both teams wager':categories().length+' categories · '+totalQuestions()+' questions';
    document.querySelector('.board-region').hidden=final;$('final-panel').hidden=!final;
    document.querySelectorAll('[data-round]').forEach(button=>{button.classList.toggle('active',button.dataset.round===state.round);button.setAttribute('aria-current',button.dataset.round===state.round?'step':'false');button.disabled=!!lockedFinal;});
    $('round-status').textContent=state.round==='double'?'Double points · scores carry over':final?(state.finalScored?'Final scored':state.finalSession?'Wagers locked':'Wager before the question'):'Round 1 · scores carry into the next round';
    document.querySelector('.board-hint').textContent=final?'Both teams answer. The host marks the results.':'Pick a category. Choose your points. Let’s play.';
    const board=$('board'), rows=Math.max(1,...categories().map(c=>c.questions.length));
    board.style.setProperty('--columns',categories().length);
    board.style.setProperty('--rows',rows);
    board.style.minWidth=(categories().length>6?categories().length*135:categories().length>3?650:0)+'px';
    const categoryIcons=['sprout','person','heart','sparkle','quote','hash','book','trophy'];
    board.innerHTML=categories().map((c,ci)=>'<div class="category"><div class="category-heading"><span class="category-icon">'+icon(categoryIcons[ci])+'</span><h3>'+esc(c.name)+'</h3></div>'+Array.from({length:rows},(_,qi)=>{
      const q=c.questions[qi]; if(!q) return '<div class="empty-slot" aria-hidden="true"></div>';
      const key=keyFor(state.round,ci,qi), used=!!state.used[key];
      return '<button class="clue-tile'+(String(q.value).length>=5?' wide-value':'')+(used?' used':'')+'" data-clue="'+key+'" aria-label="'+esc(c.name+', '+q.value+' points'+(used?', already played':''))+'"'+(used?' disabled':'')+'>'+(used?'<span class="used-mark">'+icon('check')+'</span>':fmt(q.value))+'</button>';
    }).join('')+'</div>').join('');
    state.teams.forEach((team,i)=>{
      const card=$('team-'+i); card.classList.toggle('active',!final&&state.activeTeam===i);
      card.innerHTML='<button class="team-selector" data-team="'+i+'" aria-pressed="'+(state.activeTeam===i)+'" aria-label="'+esc(team.name)+' chooses next"><span class="team-avatar">'+(i===0?'01':'02')+'</span><span class="team-name-wrap"><span class="team-caption">TEAM '+(i===0?'ONE':'TWO')+'</span><span class="team-name">'+esc(team.name)+'</span>'+(state.activeTeam===i?'<span class="choosing-badge">PICKING NEXT</span>':'')+'</span></button><button class="score-button" data-action="settings" aria-label="Edit '+esc(team.name)+' score: '+team.score+'"><span class="score-number'+(String(Math.abs(team.score)).length>4?' long-score':'')+'">'+fmt(team.score)+'</span><span class="score-label">POINTS</span></button><button class="icon-button edit-team" data-action="settings" aria-label="Rename '+esc(team.name)+'">'+icon('edit')+'</button>';
    });
    document.querySelectorAll('[data-team]').forEach(button=>{button.disabled=final;});
    document.querySelectorAll('[data-action="settings"]').forEach(button=>{button.disabled=!!lockedFinal;});
    if(final){document.querySelectorAll('.choosing-badge').forEach(b=>b.hidden=true);renderFinal();}
    const played=playedInRound();
    $('progress-text').textContent=final?(state.finalScored?'Final scored':'Final round'):played+' of '+totalQuestions()+' played';
    $('progress-fill').style.width=(final?(state.finalScored?100:0):played/totalQuestions()*100)+'%';
    $('undo-button').disabled=!state.history.length;
    hydrateIcons(); persist();
  }
  function confirm(title,message,label,action) { $('confirm-title').textContent=title; $('confirm-message').textContent=message; $('confirm-accept').textContent=label; confirmAction=action; show('confirm-dialog'); }
  $('confirm-dialog').addEventListener('close',()=>{confirmAction=null;});
  function hasProgress() { return Object.keys(state.used).length>0 || state.teams.some(t=>t.score!==0)||!!state.finalSession; }
  function restart() { state.teams=state.teams.map(t=>({...t,score:0}));state.used={};state.history=[];state.activeTeam=0;state.round='single';state.dailySession=null;state.finalSession=null;state.finalScored=false;render();toast('Fresh game. Let’s play!'); }
  function goRound(round,keepHistory=true) { if((round==='double'&&!state.game.doubleJeopardy)||(round==='final'&&!state.game.finalJeopardy)){openEditor(state.game,round);toast('Add questions for this round, or load the updated Bible Basics game.');return;}if(state.round===round)return;if(state.round==='final'&&state.finalSession&&!state.finalScored){toast('Finish Final Jeopardy or use Undo before changing rounds.');return;}if(keepHistory)remember();state.round=round;if(round==='double'&&playedInRound()===0)state.activeTeam=state.teams[0].score<=state.teams[1].score?0:1;render(); }
  function loadGame(game) {
    const apply=()=>{state.game=clone(game);restart();close('load-dialog');close('editor-dialog');draft=null;toast('Loaded '+game.title);};
    if(hasProgress()) confirm('Start this game?','This clears the current scores and played questions. Team names and settings stay the same.','Load game',apply); else apply();
  }
  function importGame(text) {
    try { if(text.length>1048576) throw new Error('Choose a game file smaller than 1 MB.'); const game=GameCore.validateGame(JSON.parse(text));$('import-error').textContent='';loadGame(game); }
    catch(error) { $('import-error').textContent=error instanceof SyntaxError?'This is not valid JSON. Check the file or download a template.':error.message; }
  }
  function download(game,filename) {
    const blob=new Blob([JSON.stringify(game,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename||game.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Game file downloaded');
  }
  const newQuestion=(index=0)=>({value:(index+1)*100,question:'',answer:'',reference:''});
  const blankGame=()=>({schemaVersion:1,title:'My Bible Game',categories:Array.from({length:3},(_,i)=>({name:'Category '+(i+1),questions:Array.from({length:5},(_,qi)=>newQuestion(qi))}))});

  function prepareAnswerSheet() {
    const groups=[['single','Round 1 · Jeopardy'],...(state.game.doubleJeopardy?[['double','Double Jeopardy']]:[])];
    const count=groups.reduce((n,[round])=>n+GameCore.roundCategories(state.game,round).reduce((m,c)=>m+c.questions.length,0),0)+(state.game.finalJeopardy?1:0);
    let content='<header class="sheet-title"><p class="sheet-eyebrow">LOOGOOTEE METHODIST YOUTH JEPORDY</p><h1>'+esc(state.game.title)+'</h1><p>Host answer sheet · '+count+' questions · includes all configured rounds</p></header>';
    for(const [round,label] of groups){content+='<h2 class="sheet-round">'+label+'</h2>'+GameCore.roundCategories(state.game,round).map((category,ci)=>'<section class="sheet-category"><h2><span>'+String(ci+1).padStart(2,'0')+'</span> '+esc(category.name)+'</h2><table><thead><tr><th scope="col">Points</th><th scope="col">Question & answer</th></tr></thead><tbody>'+category.questions.map(q=>'<tr><th scope="row">'+fmt(q.value)+(q.dailyDouble?'<small class="sheet-dd">Daily Double</small>':'')+'</th><td><p class="sheet-question">'+esc(q.question)+'</p><p class="sheet-answer"><strong>Answer:</strong> '+esc(q.answer)+'</p>'+(q.reference?'<p class="sheet-reference">'+esc(q.reference)+'</p>':'')+'</td></tr>').join('')+'</tbody></table></section>').join('');}
    if(state.game.finalJeopardy){const f=state.game.finalJeopardy;content+='<section class="sheet-category"><h2>Final Jeopardy · '+esc(f.category)+'</h2><p class="sheet-question">'+esc(f.question)+'</p><p class="sheet-answer"><strong>Answer:</strong> '+esc(f.answer)+'</p><p class="sheet-reference">'+esc(f.reference)+'</p></section>';}
    $('answer-sheet-preview').innerHTML=content;$('print-sheet').innerHTML=content;
  }
  function openAnswerSheet() { prepareAnswerSheet();show('answer-sheet-dialog'); }
  function printAnswerSheet() { prepareAnswerSheet();window.print(); }
  window.addEventListener('beforeprint',prepareAnswerSheet);

  function openClue(key) {
    if(state.used[key]||state.round==='final') return;
    const [ci]=key.split(':').slice(-2).map(Number),q=GameCore.questionFor(state,key);
    pending={key,value:q.value,question:q,category:categories()[ci].name,team:state.activeTeam,attempted:[],revealed:false,kind:q.dailyDouble?'daily-double':'regular'};
    if(q.dailyDouble){if(state.dailySession?.key===key){pending.team=state.dailySession.team;pending.wager=state.dailySession.wager;presentClue();return;}$('daily-team').textContent=state.teams[pending.team].name;$('daily-category').textContent=pending.category;const maximum=GameCore.wagerLimit(state,pending.team);$('daily-wager').max=maximum;$('daily-wager').value=Math.min(q.value,maximum);$('daily-limit').textContent='Score: '+fmt(state.teams[pending.team].score)+' · Allowed wager: 0–'+fmt(maximum)+' points';$('daily-error').textContent='';show('wager-dialog');return;}
    presentClue();
  }
  function presentClue() {
    if(!pending)return;const q=pending.question;
    $('clue-category').textContent=pending.category;$('clue-value').textContent=fmt(q.value)+' pts';$('clue-question').textContent=q.question;
    document.querySelector('.clue-content').classList.toggle('long-question',q.question.length>190);
    $('clue-answer').textContent=q.answer;$('clue-reference').textContent=q.reference;
    timerRemaining=state.settings.timer;stopTimer();updateClue();show('clue-dialog');$('reveal-button').focus();
  }
  $('daily-wager-form').addEventListener('submit',event=>{event.preventDefault();if(!pending||pending.kind!=='daily-double')return;try{if(!$('daily-wager').value.trim())throw new Error('Enter a wager.');pending.wager=GameCore.validateWager(Number($('daily-wager').value),GameCore.wagerLimit(state,pending.team));state.dailySession={key:pending.key,team:pending.team,wager:pending.wager};persist();close('wager-dialog');presentClue();}catch(error){$('daily-error').textContent=error.message;}});
  $('wager-dialog').addEventListener('cancel',()=>{pending=null;});
  const cluePoints=()=>pending?.kind==='daily-double'?pending.wager:pending?.value;
  function updateClue() {
    if(!pending)return;
    const reviewing=!!pending.review;
    document.querySelector('.clue-inner').classList.toggle('reviewing',reviewing);
    $('answer-box').hidden=!pending.revealed;$('timer-controls').hidden=state.settings.timer===0||reviewing;
    const daily=pending.kind==='daily-double',points=cluePoints();
    $('clue-value').textContent=fmt(points)+(daily?' wager':' pts');
    $('clue-kicker').textContent=reviewing?'THE CORRECT ANSWER':daily?'DAILY DOUBLE · '+state.teams[pending.team].name:pending.attempted.length?'STEAL OPPORTUNITY':pending.revealed?'CHECK THE ANSWER':'HERE’S YOUR QUESTION';
    $('responding-teams').innerHTML=state.teams.map((t,i)=>{const selected=pending.team===i,missed=pending.attempted.includes(i),label=selected?(reviewing?'REVIEW':pending.attempted.length?'STEAL OPPORTUNITY':'ANSWERING'):missed?'MISSED':'';return '<button class="responding-team team-'+(i===0?'a':'b')+(selected?' selected':'')+'" data-answer-team="'+i+'" aria-pressed="'+selected+'"'+(reviewing||missed?' disabled':'')+'><span class="responding-team-name">'+esc(t.name)+'</span>'+(label?'<span class="responding-status">'+label+'</span>':'')+'</button>';}).join('');
    $('attempt-note').textContent=reviewing?(pending.review.status==='correct'?'Correct answer · +'+fmt(points)+' points':daily?'Wager lost · −'+fmt(points)+' points':pending.review.status==='no-answer'?'No answer':'No correct answer')+' · '+state.teams[pending.review.result.activeTeam].name+' picks next.':daily?'Wager locked · only '+state.teams[pending.team].name+' answers · no steal':pending.attempted.length?state.teams[pending.attempted[0]].name+' missed'+(state.settings.deductWrong?' (−'+fmt(points)+' points)':'')+'. '+state.teams[pending.team].name+' can steal.':'';
    $('attempt-note').classList.toggle('review-note',reviewing);
    ['pass-button','wrong-button','correct-button','reveal-button','clue-board-button'].forEach(id=>{$(id).hidden=reviewing;});
    if(daily){$('clue-board-button').hidden=true;document.querySelectorAll('[data-answer-team]').forEach(button=>{button.disabled=true;});}
    $('next-category-button').hidden=!reviewing;
    $('next-category-button').innerHTML=(playedInRound()+1===totalQuestions()?(state.round==='single'&&state.game.doubleJeopardy?'Double Jeopardy':state.game.finalJeopardy?'Final Jeopardy':'See results'):'Next category')+' '+icon('arrow-right');
    $('clue-shortcuts').hidden=reviewing;
    $('clue-shortcuts').innerHTML=daily?'SPACE reveal <span>·</span> Wager locked · finish this question to continue':'SPACE reveal <span>·</span> 1 / 2 select team <span>·</span> ESC return to board';
    $('pass-button').title='Show the correct answer, then let '+state.teams[1-pending.team].name+' pick next.';
    $('wrong-button').title=daily?'Lose the wager and review the correct answer.':pending.attempted.length?'Show the correct answer, then let '+state.teams[1-pending.team].name+' pick next.':'Give '+state.teams[1-pending.team].name+' a chance to steal.';
    $('correct-button').title='Show the correct answer, then award '+fmt(points)+' points. '+state.teams[pending.team].name+' picks next.';
    $('reveal-button').innerHTML=icon('eye')+(pending.revealed?' Hide answer':' Reveal answer');
    updateTimer();
  }
  function revealAnswer() { if(!pending||pending.review)return;pending.revealed=!pending.revealed;if(pending.revealed)stopTimer();updateClue(); }
  function answer(status) {
    if(!pending||pending.review)return;const q=pending;
    const transition=GameCore.answerClue(state,q,status,state.settings.deductWrong);
    if(transition.clue){pending=transition.clue;resetTimer();updateClue();$('reveal-button').focus();toast(state.teams[pending.team].name+' has a chance to steal');return;}
    pending.review={status,result:transition.result};pending.revealed=true;stopTimer();updateClue();$('next-category-button').focus();
  }
  function finishClue() {
    if(!pending?.review)return;const q=pending;
    const points=cluePoints();remember();Object.assign(state,q.review.result);state.dailySession=null;closeClue();render();
    if(q.review.status==='correct')toast(state.teams[q.team].name+' +'+fmt(points)+' points · picks next');
    else toast((q.review.status==='no-answer'?'No answer':'No correct answer')+' · '+state.teams[state.activeTeam].name+' picks next');
    if(playedInRound()===totalQuestions()){if(state.round==='single'&&state.game.doubleJeopardy)goRound('double',false);else if(state.game.finalJeopardy)goRound('final',false);else complete();}
  }
  function leaveClue() { if(pending?.review)finishClue();else if(pending?.kind==='daily-double'){toast('Finish the locked Daily Double before returning to the board.');}else closeClue(); }
  function closeClue() { stopTimer();pending=null;close('clue-dialog'); }
  $('clue-dialog').addEventListener('cancel',event=>{event.preventDefault();leaveClue();});
  function stopTimer() { clearInterval(timerInterval);timerInterval=null;timerEnd=null; }
  function updateTimer() { $('timer-value').textContent=timerRemaining>0?timerRemaining+'s':'Time’s up';$('timer-toggle').classList.toggle('expired',timerRemaining===0);$('timer-toggle').querySelector('[data-icon]').innerHTML=icon(timerInterval?'pause':'play');$('timer-toggle').setAttribute('aria-label',(timerInterval?'Pause':'Start')+' timer, '+timerRemaining+' seconds remaining');$('timer-toggle').disabled=!!pending?.revealed;notifyLive(); }
  function resetTimer() { stopTimer();timerRemaining=state.settings.timer;updateTimer(); }
  function toggleTimer() {
    if(!pending||pending.revealed||state.settings.timer===0)return;
    if(timerInterval){timerRemaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));stopTimer();updateTimer();return;}
    if(timerRemaining===0)timerRemaining=state.settings.timer;timerEnd=Date.now()+timerRemaining*1000;
    timerInterval=setInterval(()=>{timerRemaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));if(timerRemaining===0){stopTimer();toast('Time’s up! The host decides what happens next.');}updateTimer();},150);updateTimer();
  }
  function complete() { const [a,b]=state.teams, winner=a.score===b.score?null:a.score>b.score?a:b;$('complete-title').textContent=winner?winner.name+' wins!':'It’s a tie!';$('complete-score').textContent=a.name+': '+fmt(a.score)+'  ·  '+b.name+': '+fmt(b.score);show('complete-dialog'); }

  function renderFinal() {
    const question=state.game.finalJeopardy;if(!question)return;
    const session=state.finalSession;
    let content='<div class="final-heading"><span class="eyebrow">FINAL JEOPARDY</span><h2>'+esc(question.category)+'</h2></div>';
    if(!session){
      content+='<p class="final-instruction">Both teams choose their wagers before seeing the question. Have teams write their wagers down, then enter them here. The amounts are masked on the screen.</p><form id="final-wager-form"><div class="final-wager-grid">'+state.teams.map((team,i)=>{const maximum=GameCore.wagerLimit(state,i,'final');return '<fieldset class="team-fieldset team-'+(i===0?'a':'b')+'"><legend>'+esc(team.name)+'</legend><p>Score: <strong>'+fmt(team.score)+'</strong></p><label>'+esc(team.name)+' wager<input id="final-wager-'+i+'" type="password" inputmode="numeric" pattern="[0-9]+" maxlength="12" required autocomplete="off"'+(maximum===0?' value="0" readonly':'')+'></label><small>0–'+fmt(maximum)+' points'+(maximum===0?' · play this question with a zero-point wager':'')+'</small></fieldset>';}).join('')+'</div><p class="form-error" id="final-error" role="alert"></p><button type="submit" class="button primary">Lock both wagers & show question '+icon('arrow-right')+'</button></form>';
    }else{
      content+='<p class="final-question">'+esc(question.question)+'</p>';
      if(session.phase==='question')content+='<p class="final-instruction">Wagers are locked. Both teams write down their answers before the host reveals the correct answer.</p><button class="button primary" data-action="final-reveal">'+icon('eye')+' Reveal final answer</button>';
      else {
        content+='<div class="final-answer"><span class="eyebrow">THE CORRECT ANSWER</span><p>'+esc(question.answer)+'</p><span>'+esc(question.reference)+'</span></div><div class="final-wager-grid">'+state.teams.map((team,i)=>'<section class="final-score-card team-'+(i===0?'a':'b')+'"><h3>'+esc(team.name)+'</h3><p>Wager: <strong>'+fmt(session.wagers[i])+'</strong> points</p>'+(state.finalScored?'<strong class="final-delta">'+(session.correct[i]?'+':'−')+fmt(session.wagers[i])+' points</strong>':'<div class="inline-actions"><button class="button '+(session.correct[i]===true?'primary':'secondary')+'" data-final-team="'+i+'" data-final-correct="true" aria-label="'+esc(team.name)+' correct" aria-pressed="'+(session.correct[i]===true)+'">Correct</button><button class="button '+(session.correct[i]===false?'primary':'secondary')+'" data-final-team="'+i+'" data-final-correct="false" aria-label="'+esc(team.name)+' incorrect" aria-pressed="'+(session.correct[i]===false)+'">Incorrect / no answer</button></div>')+'</section>').join('')+'</div>';
        content+=state.finalScored?'<button class="button primary" data-action="final-winner">See winner '+icon('trophy')+'</button>':'<p class="form-error" id="final-error" role="alert"></p><button class="button primary" data-action="final-score"'+(session.correct.some(v=>typeof v!=='boolean')?' disabled':'')+'>Score Final Jeopardy '+icon('check')+'</button>';
      }
    }
    $('final-panel').innerHTML=content;
  }
  $('final-panel').addEventListener('submit',event=>{
    if(event.target.id!=='final-wager-form')return;event.preventDefault();
    try{const wagers=state.teams.map((t,i)=>{const value=$('final-wager-'+i).value.trim();if(!/^\d+$/.test(value))throw new Error('Enter a whole-number wager for each team.');return GameCore.validateWager(Number(value),GameCore.wagerLimit(state,i,'final'));});remember();state.finalSession={phase:'question',wagers,correct:[null,null]};state.finalScored=false;render();}
    catch(error){$('final-error').textContent=error.message;}
  });
  function scoreFinal() { if(!state.finalSession||state.finalScored)return;try{const result=GameCore.settleFinal(state,state.finalSession.wagers,state.finalSession.correct);remember();Object.assign(state,result);state.finalSession.phase='complete';render();complete();}catch(error){$('final-error').textContent=error.message;} }

  function openSettings() { state.teams.forEach((t,i)=>{$('team-name-'+i).value=t.name;$('team-score-'+i).value=t.score;});$('timer-setting').value=state.settings.timer;$('deduct-setting').checked=state.settings.deductWrong;$('settings-error').textContent='';show('settings-dialog'); }
  $('settings-form').addEventListener('submit',event=>{
    event.preventDefault();const teams=state.teams.map((t,i)=>({name:$('team-name-'+i).value.trim(),score:Number($('team-score-'+i).value)}));
    if(!validTeams(teams)||teams.some(t=>Math.abs(t.score)>9999999)){$('settings-error').textContent='Give both teams a name and use whole-number scores between −9,999,999 and 9,999,999.';return;}
    if(JSON.stringify(teams)!==JSON.stringify(state.teams))remember();state.teams=teams;state.settings={timer:Number($('timer-setting').value),deductWrong:$('deduct-setting').checked};close('settings-dialog');render();toast('Teams & settings saved');
  });

  const editorCats=()=>editorRound==='double'?draft.doubleJeopardy.categories:draft.categories;
  function ensureDraftRound() {
    if(editorRound==='double'&&!draft.doubleJeopardy)draft.doubleJeopardy={categories:Array.from({length:3},(_,i)=>({name:'Category '+(i+1),questions:Array.from({length:5},(_,j)=>({...newQuestion(j),value:(j+1)*200}))}))};
    if(editorRound==='final'&&!draft.finalJeopardy)draft.finalJeopardy={category:'Final category',question:'',answer:'',reference:''};
  }
  function openEditor(game=state.game,round='single') { draft=clone(game);draftOriginal=JSON.stringify(draft);editorRound=round;editorCategory=0;ensureDraftRound();$('edit-game-title').value=draft.title;$('editor-error').textContent='';renderEditor();show('editor-dialog'); }
  function renderEditorSidebar() {
    $('edit-round').value=editorRound;$('remove-round').hidden=editorRound==='single';$('add-category').hidden=editorRound==='final';
    if(editorRound==='final'){$('category-count').textContent='1 question';$('editor-categories').innerHTML='<p class="muted editor-final-note">Both teams wager on this one final question. The category appears before the wagers are locked.</p>';return;}
    const cats=editorCats();$('category-count').textContent=cats.length+' / 8';
    $('editor-categories').innerHTML=cats.map((c,i)=>'<button class="editor-category'+(i===editorCategory?' active':'')+'" data-edit-category="'+i+'">'+esc(c.name||'Untitled category')+'<span>'+c.questions.length+'</span></button>').join('');$('add-category').disabled=cats.length>=8;
  }
  function renderEditor() {
    if(!draft)return;renderEditorSidebar();
    if(editorRound==='final'){const f=draft.finalJeopardy;$('editor-content').innerHTML='<div class="question-editor final-question-editor">'+[['category','Final category',40],['question','Final question',600],['answer','Correct answer',600],['reference','Scripture reference (optional)',150]].map(([field,label,max])=>'<label>'+label+(field==='question'||field==='answer'?'<textarea data-final-field="'+field+'" maxlength="'+max+'" rows="3">'+esc(f[field])+'</textarea>':'<input data-final-field="'+field+'" maxlength="'+max+'" value="'+esc(f[field])+'">')+'</label>').join('')+'</div>';return;}
    const cats=editorCats(),category=cats[editorCategory],maxDoubles=editorRound==='double'?2:1,dailyCount=cats.flatMap(c=>c.questions).filter(q=>q.dailyDouble).length;
    $('editor-content').innerHTML='<div class="category-editor-heading"><label>Category name<input id="edit-category-name" maxlength="40" value="'+esc(category.name)+'" placeholder="e.g. Women of the Bible"></label><button class="text-button" data-action="remove-category"'+(cats.length===1?' disabled':'')+'>'+icon('trash')+' Remove category</button></div><p class="editor-round-note">'+(editorRound==='double'?'Double Jeopardy · suggested values 200–1,000':'Round 1 · suggested values 100–500')+' · '+dailyCount+' of '+maxDoubles+' Daily Doubles marked</p>'+category.questions.map((q,i)=>'<section class="question-editor" aria-label="Question '+(i+1)+'"><div class="question-editor-top"><span class="eyebrow">QUESTION '+String(i+1).padStart(2,'0')+'</span><label>Points<input type="number" min="1" max="100000" step="1" data-question="'+i+'" data-field="value" value="'+esc(q.value)+'" aria-label="Question '+(i+1)+' points"></label><button class="icon-button" data-remove-question="'+i+'" aria-label="Remove question '+(i+1)+'"'+(category.questions.length===1?' disabled':'')+'>'+icon('trash')+'</button></div><label class="daily-double-editor"><input type="checkbox" data-question="'+i+'" data-field="dailyDouble"'+(q.dailyDouble?' checked':'')+(!q.dailyDouble&&dailyCount>=maxDoubles?' disabled':'')+'>Daily Double · team chooses a wager before the question</label><label>Question<textarea data-question="'+i+'" data-field="question" maxlength="600" rows="2" placeholder="What would you like to ask?">'+esc(q.question)+'</textarea></label><label>Answer<textarea data-question="'+i+'" data-field="answer" maxlength="600" rows="2" placeholder="The correct answer">'+esc(q.answer)+'</textarea></label><label>Scripture reference (optional)<input data-question="'+i+'" data-field="reference" maxlength="150" value="'+esc(q.reference)+'" placeholder="e.g. John 3:16"></label></section>').join('')+'<button class="button secondary" data-action="add-question"'+(category.questions.length>=8?' disabled':'')+'>'+icon('plus')+' Add question</button>';
  }
  $('edit-round').addEventListener('change',event=>{editorRound=event.target.value;editorCategory=0;ensureDraftRound();renderEditor();$('editor-content').scrollTop=0;$('editor-error').textContent='';});
  $('editor-dialog').addEventListener('input',event=>{
    if(!draft)return;const el=event.target;
    if(el.id==='edit-game-title')draft.title=el.value;
    else if(el.dataset.finalField)draft.finalJeopardy[el.dataset.finalField]=el.value;
    else if(el.id==='edit-category-name'){editorCats()[editorCategory].name=el.value;renderEditorSidebar();}
    else if(el.dataset.field){const field=el.dataset.field;editorCats()[editorCategory].questions[Number(el.dataset.question)][field]=field==='value'?Number(el.value):field==='dailyDouble'?el.checked:el.value;if(field==='dailyDouble'){const scroll=$('editor-content').scrollTop;renderEditor();$('editor-content').scrollTop=scroll;}}
    $('editor-error').textContent='';
  });
  function closeEditor() { if(draft&&JSON.stringify(draft)!==draftOriginal)confirm('Leave the workshop?','Your unsaved question edits will be discarded.','Discard edits',()=>{close('editor-dialog');draft=null;});else{close('editor-dialog');draft=null;} }
  $('editor-dialog').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  function validatedDraft() { try{return GameCore.validateGame(draft);}catch(error){$('editor-error').textContent=error.message;return null;} }
  function saveGame() { const game=validatedDraft();if(!game)return;loadGame(game); }

  async function fullscreen() { try { if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Use your browser’s fullscreen option to fill the TV.'); }catch{toast('Use your browser’s fullscreen option (usually F11).');} }
  document.addEventListener('fullscreenchange',()=>{$('fullscreen-label').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';const el=document.querySelector('.fullscreen-button [data-icon]');el.innerHTML=icon(document.fullscreenElement?'collapse':'expand');});
  const actions={
    settings:openSettings,help:()=>show('help-dialog'),fullscreen,edit:()=>openEditor(state.game,state.round),load:()=>{$('import-error').textContent='';$('import-json').value='';show('load-dialog');},
    undo:()=>{const previous=state.history.pop();if(!previous)return;Object.assign(state,previous);render();if(state.dailySession)openClue(state.dailySession.key);toast('Last change undone');},
    restart:()=>confirm('Start a fresh game?','Scores, played questions, and wagers will reset for every round. Your questions, team names, and settings stay the same.','New game',restart),
    'close-clue':leaveClue,'next-category':finishClue,'answer-sheet':openAnswerSheet,'print-sheet':printAnswerSheet,timer:toggleTimer,'timer-reset':resetTimer,reveal:revealAnswer,wrong:()=>answer('incorrect'),pass:()=>answer('no-answer'),correct:()=>answer('correct'),
    'import-file':()=>$('game-file').click(), 'import-paste':()=>importGame($('import-json').value),
    starter:()=>loadGame(GameCore.validateGame(window.STARTER_GAME)), 'new-game':()=>{close('load-dialog');openEditor(blankGame());},
    template:()=>download(blankGame(),'bible-game-template.json'), export:()=>download(state.game),
    'close-editor':closeEditor,'save-game':saveGame,
    'export-draft':()=>{const game=validatedDraft();if(game)download(game);},
    'add-category':()=>{const cats=editorCats();if(cats.length>=8)return;cats.push({name:'New category',questions:[{...newQuestion(),value:editorRound==='double'?200:100}]});editorCategory=cats.length-1;renderEditor();$('edit-category-name').focus();$('edit-category-name').select();},
    'remove-category':()=>{if(editorCats().length===1)return;confirm('Remove this category?','All questions in this category will be removed from your draft.','Remove category',()=>{editorCats().splice(editorCategory,1);editorCategory=Math.min(editorCategory,editorCats().length-1);renderEditor();});},
    'add-question':()=>{const questions=editorCats()[editorCategory].questions;if(questions.length>=8)return;questions.push({...newQuestion(questions.length),value:(questions.length+1)*(editorRound==='double'?200:100)});renderEditor();$('editor-content').scrollTop=$('editor-content').scrollHeight;},
    confirm:()=>{const action=confirmAction;close('confirm-dialog');if(action)action();},
    'play-again':()=>{close('complete-dialog');restart();},
    'cancel-wager':()=>{close('wager-dialog');pending=null;},
    'daily-max':()=>{if(pending)$('daily-wager').value=GameCore.wagerLimit(state,pending.team);},
    'daily-half':()=>{if(pending)$('daily-wager').value=Math.floor(Math.max(0,state.teams[pending.team].score)/2);},
    'final-reveal':()=>{if(state.finalSession?.phase==='question'){state.finalSession.phase='review';render();}},
    'final-score':scoreFinal,'final-winner':complete,
    'remove-round':()=>{if(editorRound==='single')return;confirm('Remove this round?','Its questions will be removed from your draft.','Remove round',()=>{delete draft[editorRound==='double'?'doubleJeopardy':'finalJeopardy'];editorRound='single';editorCategory=0;renderEditor();});}
  };
  document.addEventListener('click',event=>{
    const el=event.target.closest('button');if(!el||el.disabled)return;
    if(el.dataset.action&&actions[el.dataset.action]){actions[el.dataset.action]();return;}
    if(el.dataset.close){close(el.dataset.close);return;}
    if(el.dataset.clue){openClue(el.dataset.clue);return;}
    if(el.dataset.round){goRound(el.dataset.round);return;}
    if(el.dataset.finalTeam!==undefined&&state.finalSession?.phase==='review'&&!state.finalScored){state.finalSession.correct[Number(el.dataset.finalTeam)]=el.dataset.finalCorrect==='true';render();return;}
    if(el.dataset.team!==undefined&&state.round!=='final'){state.activeTeam=Number(el.dataset.team);render();return;}
    if(el.dataset.answerTeam!==undefined&&pending&&pending.kind!=='daily-double'&&!pending.review&&!pending.attempted.includes(Number(el.dataset.answerTeam))){pending.team=Number(el.dataset.answerTeam);updateClue();return;}
    if(el.dataset.editCategory!==undefined&&draft){editorCategory=Number(el.dataset.editCategory);renderEditor();$('editor-content').scrollTop=0;return;}
    if(el.dataset.removeQuestion!==undefined&&draft){const questions=editorCats()[editorCategory].questions;if(questions.length>1){questions.splice(Number(el.dataset.removeQuestion),1);renderEditor();}}
  });
  $('game-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>1048576){$('import-error').textContent='Choose a game file smaller than 1 MB.';}else{try{importGame(await file.text());}catch{$('import-error').textContent='The file could not be read. Try a different JSON file.';}}event.target.value='';});
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable)return;
    const dialogs=[...document.querySelectorAll('dialog[open]')];
    if(pending&&!pending.review&&dialogs.at(-1)?.id==='clue-dialog'){
      // Keep normal Space activation when a button is focused, except the reveal button.
      if(event.code==='Space'&&(event.target.tagName!=='BUTTON'||event.target.id==='reveal-button')){event.preventDefault();revealAnswer();}
      if(pending.kind!=='daily-double'&&['1','2'].includes(event.key)){const team=Number(event.key)-1;if(!pending.attempted.includes(team)){pending.team=team;updateClue();}}
    }
    if(!dialogs.length&&event.key.toLowerCase()==='f'){event.preventDefault();fullscreen();}
  });
  window.LMC_GAME={
    exportSnapshot(){return clone({state,pending,timer:{remaining:timerRemaining,running:!!timerInterval,endAt:timerEnd},resultsShown:$('complete-dialog').open});},
    restoreSnapshot(value){
      stopTimer();pending=null;document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());state=clone(value.state);state.game=GameCore.validateGame(state.game);render();
      if(value.pending){if(value.pending.kind==='daily-double'&&!state.dailySession){openClue(value.pending.key);}else{pending=clone(value.pending);presentClue();timerRemaining=value.timer?.running?Math.max(0,Math.ceil((value.timer.endAt-Date.now())/1000)):value.timer?.remaining??state.settings.timer;if(value.timer?.running&&timerRemaining>0&&!pending.revealed)toggleTimer();else updateTimer();}}
      else if(state.dailySession)openClue(state.dailySession.key);
      if(value.resultsShown)complete();persist();
    }
  };
  render();
  if(state.dailySession)openClue(state.dailySession.key);
})();
