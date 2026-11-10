(() => {
  'use strict';
  const $=id=>document.getElementById(id),KEY='lmc-github-host-v1';
  let session=null,restoring=false,sending=false,queued=null,lastSent='',lastObserved='',retry=null,timer=null,blocked=false;
  try{session=JSON.parse(localStorage.getItem(KEY));if(!session?.id||!session.hostKey||session.expiresAt<=Date.now())session=null;}catch{}
  function saveSession(){try{if(session)localStorage.setItem(KEY,JSON.stringify(session));else localStorage.removeItem(KEY);}catch{}}
  function status(text,error=false){$('live-status-text').textContent=text;$('live-status-bar').hidden=!session;$('live-status-bar').classList.toggle('has-error',error);document.body.classList.toggle('is-live-host',!!session);$('live-reload').hidden=!error;}
  async function api(path,options){return window.LMC_FIREBASE.api(path,options);}
  function updatePrivateAnswer(){
    const snapshot=window.LMC_GAME?.exportSnapshot(),pending=snapshot?.pending;
    const visible=!!session&&!!pending&&!pending.revealed&&(pending.kind!=='daily-double'||!!snapshot.state.dailySession);
    $('private-host-answer').hidden=!visible;
    if(visible){$('private-answer-text').textContent=pending.question.answer;$('private-answer-reference').textContent=pending.question.reference||'';}
    const final=document.getElementById('final-panel');let box=final.querySelector('.final-host-answer');
    const showFinal=!!session&&snapshot?.state.round==='final'&&snapshot.state.finalSession?.phase==='question';
    if(showFinal){if(!box){box=document.createElement('aside');box.className='final-host-answer host-private-answer';const label=document.createElement('strong');label.textContent='HOST ANSWER · PRIVATE';box.append(label,document.createElement('p'),document.createElement('small'));final.append(box);}box.querySelector('p').textContent=snapshot.state.game.finalJeopardy.answer;box.querySelector('small').textContent=snapshot.state.game.finalJeopardy.reference||'';}else box?.remove();
  }
  async function send(){
    if(!session||blocked||sending||(!queued&&!session.inFlight))return;
    const connection=session;
    if(!connection.inFlight){if(queued===lastSent){queued=null;connection.pending=null;saveSession();return;}connection.inFlight={id:crypto.randomUUID(),revision:connection.revision,payload:queued};saveSession();}
    const update=connection.inFlight;sending=true;
    try{
      const result=await api('/api/live/rooms/'+connection.id+'/host',{method:'PUT',key:connection.hostKey,data:{revision:update.revision,mutationId:update.id,snapshot:JSON.parse(update.payload)}});
      if(session!==connection)return;
      connection.revision=result.revision;connection.expiresAt=result.expiresAt;connection.inFlight=null;lastSent=update.payload;if(queued===update.payload)queued=null;connection.pending=queued;saveSession();status('PHONE HOST · live updates saved');
    }catch(error){
      if(session!==connection)return;
      if(error.status===409){blocked=true;status('Another host tab changed the game. Unsent changes remain on this phone. End this connection before starting a new one.',true);}
      else if([401,403,404,410].includes(error.status)){blocked=true;status(error.message,true);}
      else{status('Connection interrupted. Changes are saved on this phone; retrying…',true);clearTimeout(retry);retry=setTimeout(()=>{retry=null;send();},1800);}
    }finally{sending=false;if(session===connection&&(queued||connection.inFlight)&&!blocked&&!retry)timer=setTimeout(send,150);}
  }
  function changed(){
    updatePrivateAnswer();if(!session||restoring)return;
    const snapshot=window.LMC_GAME.exportSnapshot(),signature=window.LMC_LIVE_CORE.syncSignature(snapshot);if(signature===lastObserved)return;lastObserved=signature;queued=JSON.stringify(snapshot);session.pending=queued;saveSession();clearTimeout(timer);timer=setTimeout(send,280);
  }
  document.addEventListener('lmc:change',changed);
  async function resume(){
    if(!session)return;restoring=true;blocked=true;clearTimeout(retry);retry=null;clearTimeout(timer);
    try{
      const result=await api('/api/live/rooms/'+session.id+'/host',{key:session.hostKey});
      const pending=session.pending||session.inFlight?.payload;
      if(pending&&result.revision!==session.revision&&result.mutationId!==session.inFlight?.id)throw new Error('Another host tab changed the game. Unsent changes remain on this phone. End this connection before starting a new one.');
      session.revision=result.revision;session.expiresAt=result.expiresAt;session.inFlight=null;
      window.LMC_GAME.restoreSnapshot(pending?JSON.parse(pending):result.snapshot);restoring=false;blocked=false;
      const current=JSON.stringify(window.LMC_GAME.exportSnapshot());lastObserved=window.LMC_LIVE_CORE.syncSignature(JSON.parse(current));lastSent=pending?'':current;queued=pending?current:null;session.pending=queued;saveSession();status(pending?'PHONE HOST · saving recovered changes…':'PHONE HOST · live game resumed');updatePrivateAnswer();if(queued)send();
    }catch(error){restoring=false;blocked=true;status(error.message,true);}
  }
  async function openConnect(){
    $('live-connect-error').textContent='';$('live-connect-actions').hidden=true;$('live-login-form').hidden=true;$('live-setup-link').hidden=true;
    if(!$('live-connect-dialog').open)$('live-connect-dialog').showModal();
    try{
      const config=await api('/api/live/config');
      if(!config.available){$('live-connect-intro').textContent='Your GitHub game is ready to play. Phone syncing needs the one-time Firebase setup.';$('live-setup-link').hidden=false;return;}
      $('live-connect-actions').hidden=!config.signedIn;$('live-login-form').hidden=config.signedIn;
      $('live-connect-intro').textContent=config.signedIn?'On the computer, start a TV session. On your phone, open this same GitHub website, sign in as the same game host, and enter the code.':'Sign in as the game host to connect the computer and your phone.';
    }catch(error){$('live-connect-error').textContent=error.message;}
  }
  async function login(event){
    event.preventDefault();const button=$('live-login-button');button.disabled=true;$('live-connect-error').textContent='';
    try{await window.LMC_FIREBASE.signIn($('live-login-email').value,$('live-login-password').value);$('live-login-password').value='';await openConnect();if(session)await resume();}
    catch(error){$('live-connect-error').textContent=error.message;}finally{button.disabled=false;}
  }
  async function createSession(){
    const button=$('live-create');button.disabled=true;$('live-connect-error').textContent='';
    try{if(session)throw new Error('End the current live connection before creating another.');const result=await api('/api/live/rooms',{method:'POST',data:{snapshot:window.LMC_GAME.exportSnapshot()}});const fragment=new URLSearchParams({r:result.id,k:result.displayKey,c:result.code,e:String(result.codeExpires)});await window.LMC_FIREBASE.prepareDisplay();location.assign('./display.html#'+fragment.toString());}
    catch(error){$('live-connect-error').textContent=error.message;button.disabled=false;}
  }
  async function pair(event){
    event.preventDefault();const button=$('live-pair-button');button.disabled=true;$('live-connect-error').textContent='';
    try{if(session)throw new Error('End your current host connection first.');const result=await api('/api/live/pair',{method:'POST',data:{code:$('live-pair-code').value}});session={id:result.id,hostKey:result.hostKey,revision:result.revision,expiresAt:result.expiresAt};saveSession();restoring=true;window.LMC_GAME.restoreSnapshot(result.snapshot);restoring=false;lastSent=JSON.stringify(window.LMC_GAME.exportSnapshot());lastObserved=window.LMC_LIVE_CORE.syncSignature(JSON.parse(lastSent));blocked=false;status('PHONE HOST · connected to the TV');$('live-connect-dialog').close();updatePrivateAnswer();history.replaceState(null,'',location.pathname+location.search);}
    catch(error){restoring=false;$('live-connect-error').textContent=error.message;}
    finally{button.disabled=false;}
  }
  async function end(){if(!session)return;try{await api('/api/live/rooms/'+session.id+'/host',{method:'DELETE',key:session.hostKey,data:{}});}catch(error){status(error.message,true);return;}session=null;blocked=false;queued=null;clearTimeout(retry);clearTimeout(timer);saveSession();status('');updatePrivateAnswer();$('live-ended-note').textContent='Live session ended. Your game remains saved on this device.';}
  $('live-login-form').addEventListener('submit',login);$('live-connect-button').addEventListener('click',openConnect);$('live-create').addEventListener('click',createSession);$('live-pair-form').addEventListener('submit',pair);$('live-end').addEventListener('click',end);$('live-reload').addEventListener('click',resume);$('live-connect-close').addEventListener('click',()=>$('live-connect-dialog').close());
  if(session)resume();
  const join=new URLSearchParams(location.hash.slice(1)).get('join');if(join&&/^[A-HJ-NP-Z2-9]{8}$/i.test(join)){$('live-pair-code').value=join;openConnect();}
})();
