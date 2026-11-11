(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.LMC_FIREBASE=factory({config:root.LMC_FIREBASE_CONFIG,core:root.LMC_LIVE_CORE,loadSDK:async()=>{
    const base='https://www.gstatic.com/firebasejs/13.2.0/';
    const [appSDK,authSDK,storeSDK]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
    const app=appSDK.initializeApp(root.LMC_FIREBASE_CONFIG.firebase);
    const auth=authSDK.getAuth(app),db=storeSDK.getFirestore(app);
    return {...authSDK,...storeSDK,auth,db};
  }});
})(typeof globalThis!=='undefined'?globalThis:this,function(options){
  'use strict';
  const {config,core,loadSDK}=options;
  const ID=/^[a-f0-9-]{36}$/i,TOKEN=/^[a-f0-9]{64}$/i;
  const LIFE=8*60*60*1000,CODE_LIFE=10*60*1000;
  let loaded=null,clockOffset=null;
  function fail(status,message){const error=new Error(message);error.status=status;throw error;}
  function available(){return config?.enabled===true&&!!config.hostUid&&!config.hostUid.startsWith('REPLACE_')&&!!config.firebase?.projectId&&!!config.firebase?.apiKey&&!config.firebase.apiKey.startsWith('REPLACE_');}
  async function sdk(){if(!available())fail(503,'Complete the Firebase setup to connect your phone.');if(!loaded)loaded=Promise.resolve().then(loadSDK).catch(error=>{loaded=null;throw error;});return loaded;}
  async function identity(s){await s.auth.authStateReady();const user=s.auth.currentUser;if(!user)fail(401,'Sign in as the game host on this device.');if(user.uid!==config.hostUid)fail(403,'This account is not the configured game host.');return user.uid;}
  const clockNow=()=>Date.now()+(clockOffset??0);
  async function serverTime(s,uid){
    // Firestore checks expiry against its own clock. A device a few seconds
    // fast must not create a code that appears to exceed the ten-minute limit.
    const ref=s.doc(s.db,'lmcClock',uid);
    await s.setDoc(ref,{checkedAt:s.serverTimestamp()});
    const document=await s.getDocFromServer(ref),stamp=document.data()?.checkedAt;
    const now=stamp&&typeof stamp.toMillis==='function'?Math.floor(stamp.toMillis()):NaN;
    if(!Number.isSafeInteger(now))fail(503,'Could not check the game server time. Please try again.');
    clockOffset=now-Date.now();return now;
  }
  const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const randomCode=()=>{const a='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';return Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>a[v%32]).join('');};
  async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');}
  function normalize(value){if(!core)fail(500,'The game rules did not load. Reload the page.');const result=core.normalizeSnapshot(value);if(new TextEncoder().encode(JSON.stringify(result)).length>800000)fail(413,'This game is too large to share. Download a backup and start a new game to clear its history.');return result;}
  function alive(row){if(!row)fail(404,'This live session has ended.');if(row.expiresAt<=clockNow())fail(410,'This live session has expired. Start a new connection.');return row;}
  async function hostRow(s,id,key,transaction){if(!TOKEN.test(key||''))fail(403,'This device is not the active host.');const uid=await identity(s);if(clockOffset===null)await serverTime(s,uid);const ref=s.doc(s.db,'lmcRooms',id),document=transaction?await transaction.get(ref):await s.getDocFromServer(ref);const row=alive(document.exists()?document.data():null);if(row.ownerId!==uid||row.hostHash!==await hash(key))fail(403,'This device is not the active host.');return {ref,row};}
  async function run(path,{method='GET',data,key}={}){
    if(path==='/api/live/config'){
      if(!available())return {available:false,signedIn:false};
      const s=await sdk();await s.auth.authStateReady();return {available:true,signedIn:s.auth.currentUser?.uid===config.hostUid};
    }
    const s=await sdk();
    if(path==='/api/live/rooms'&&method==='POST'){
      const uid=await identity(s),snapshot=normalize(data.snapshot),now=await serverTime(s,uid);
      const id=crypto.randomUUID(),hostKey=randomToken(),displayKey=randomToken(),code=randomCode(),codeHash=await hash(code),expiresAt=now+LIFE,codeExpires=now+CODE_LIFE;
      const row={ownerId:uid,displayKey,codeHash,codeExpires,expiresAt,paired:false,revision:0,mutationId:null,hostHash:await hash(hostKey),snapshotJson:JSON.stringify(snapshot)};
      const batch=s.writeBatch(s.db);
      batch.set(s.doc(s.db,'lmcRooms',id),row);
      batch.set(s.doc(s.db,'lmcDisplays',displayKey),{ownerId:uid,roomId:id,expiresAt,revision:0,paired:false,view:core.projectDisplay(snapshot)});
      batch.set(s.doc(s.db,'lmcPairs',codeHash),{ownerId:uid,roomId:id,expiresAt:codeExpires,consumed:false});
      await batch.commit();return {id,hostKey,displayKey,code,codeExpires:codeExpires-clockOffset,expiresAt,revision:0};
    }
    if(path==='/api/live/pair'&&method==='POST'){
      const uid=await identity(s),code=String(data.code||'').replace(/[\s-]/g,'').toUpperCase();if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))fail(400,'Enter the eight-character pairing code.');
      await serverTime(s,uid);
      const pairRef=s.doc(s.db,'lmcPairs',await hash(code)),hostKey=randomToken(),hostHash=await hash(hostKey);
      return s.runTransaction(s.db,async transaction=>{
        const pairDoc=await transaction.get(pairRef);if(!pairDoc.exists())fail(403,'The code is expired or has already been used.');const pair=pairDoc.data();if(pair.ownerId!==uid||pair.consumed||pair.expiresAt<=clockNow())fail(403,'The code is expired or has already been used.');
        const roomRef=s.doc(s.db,'lmcRooms',pair.roomId),roomDoc=await transaction.get(roomRef),row=alive(roomDoc.exists()?roomDoc.data():null);if(row.ownerId!==uid||row.paired)fail(403,'This session is already paired.');const revision=row.revision+1;
        transaction.update(pairRef,{consumed:true});transaction.update(roomRef,{hostHash,paired:true,revision});transaction.update(s.doc(s.db,'lmcDisplays',row.displayKey),{paired:true,revision});
        return {id:pair.roomId,hostKey,revision,snapshot:JSON.parse(row.snapshotJson),expiresAt:row.expiresAt};
      });
    }
    const match=path.match(/^\/api\/live\/rooms\/([a-f0-9-]+)\/(host|display)$/i);if(!match||!ID.test(match[1]))fail(404,'Session not found.');const id=match[1];
    if(match[2]==='display'){
      if(method!=='GET')fail(405,'The TV connection is read-only.');if(!TOKEN.test(key||''))fail(403,'Invalid display connection.');
      const document=await s.getDocFromServer(s.doc(s.db,'lmcDisplays',key)),row=alive(document.exists()?document.data():null);if(row.roomId!==id)fail(403,'Invalid display connection.');return {view:row.view,revision:row.revision,paired:row.paired,expiresAt:row.expiresAt};
    }
    if(method==='GET'){const {row}=await hostRow(s,id,key);return {snapshot:JSON.parse(row.snapshotJson),revision:row.revision,mutationId:row.mutationId,expiresAt:row.expiresAt};}
    if(method==='DELETE'){
      const {row,ref}=await hostRow(s,id,key),batch=s.writeBatch(s.db);batch.delete(ref);batch.delete(s.doc(s.db,'lmcDisplays',row.displayKey));batch.delete(s.doc(s.db,'lmcPairs',row.codeHash));await batch.commit();return {ended:true};
    }
    if(method==='PUT'){
      await identity(s);if(!Number.isSafeInteger(data.revision)||data.revision<0||!ID.test(data.mutationId||''))fail(400,'Missing update receipt.');const snapshot=normalize(data.snapshot);
      return s.runTransaction(s.db,async transaction=>{
        const {row,ref}=await hostRow(s,id,key,transaction);
        if(row.mutationId===data.mutationId)return {revision:row.revision,expiresAt:row.expiresAt};if(row.revision!==data.revision)fail(409,'The game changed in another host tab.');const revision=row.revision+1;
        transaction.update(ref,{snapshotJson:JSON.stringify(snapshot),mutationId:data.mutationId,revision});transaction.update(s.doc(s.db,'lmcDisplays',row.displayKey),{view:core.projectDisplay(snapshot),revision});return {revision,expiresAt:row.expiresAt};
      });
    }
    fail(405,'Unsupported operation.');
  }
  async function api(path,options){try{return await run(path,options);}catch(error){if(error.status)throw error;if(error.code==='permission-denied')fail(403,'Access denied. Check the host account, pairing code expiry, and published Firebase rules.');if(error.code==='unavailable')fail(503,'The connection is unavailable. Your phone will retry saved changes.');throw error;}}
  async function signIn(email,password){const s=await sdk();try{const result=await s.signInWithEmailAndPassword(s.auth,email.trim(),password);if(result.user.uid!==config.hostUid){await s.signOut(s.auth);fail(403,'This account is not the configured game host.');}return true;}catch(error){if(error.status)throw error;fail(401,'Sign-in failed. Check the host email and password, and enable Email/Password in Firebase Authentication.');}}
  async function prepareDisplay(){const s=await sdk();await s.signOut(s.auth);}
  return {api,signIn,available,prepareDisplay};
});
