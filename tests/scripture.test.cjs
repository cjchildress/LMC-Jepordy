const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const scripture=require('../scripture.js');
const core=require('../live-core.js');
const game=require('../game-core.js');
const {sample}=require('./game-fixture.cjs');
const index=Array.from({length:7},(_,i)=>({book_name:'Genesis',chapter:1,verse:i+1,text:'PUBLIC_DOMAIN_TEXT_NOT_NIV'}));
const reading=reference=>({reference,open:true,status:'ready',page:0,blocks:[{reference:'Genesis 1:1-7',verses:index.map(v=>({reference:`${v.book_name} ${v.chapter}:${v.verse}`}))}]});
test('references support NIV tags, multiple books, inherited chapters and headings',()=>{
 assert.deepEqual(scripture.references('Genesis 2:7, 18–23; 3:20 (NIV)'),['Genesis 2:7,18-23','Genesis 3:20']);
 assert.deepEqual(scripture.references('Mark 4:14; Luke 8:11'),['Mark 4:14','Luke 8:11']);
 assert.deepEqual(scripture.references('Psalm 23, heading (NIV)'),['Psalm 23']);
 assert.throws(()=>scripture.references('https://example.org'),/reference/);
});
test('all bundled questions are NIV, and the JS bundle matches the downloadable JSON',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../starter-game.js'),'utf8'),context);
 const bundled=JSON.parse(JSON.stringify(context.window.STARTER_GAME)),json=require('../games/bible-basics.json');assert.deepEqual(bundled,json);
 for(const categories of [json.categories,json.doubleJeopardy.categories])for(const category of categories)for(const question of category.questions){assert.match(question.reference,/\(NIV\)$/);assert.ok(scripture.references(question.reference).length);}
 assert.match(json.finalJeopardy.reference,/\(NIV\)$/);assert.equal(JSON.stringify(json).includes('KJV'),false);
});
test('older built-in quotations migrate while custom wording, point values and game progress survive',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../starter-game.js'),'utf8'),context);
 const state={game:JSON.parse(JSON.stringify(context.window.STARTER_GAME)),teams:[{name:'Youth',score:1400}],used:{'0:0':true}};
 const q=state.game.categories[4].questions[0];Object.assign(q,{question:'‘The LORD is my ______; I shall not want.’',answer:'Shepherd',reference:'Psalm 23:1 (KJV)',value:750});
 const custom=state.game.categories[4].questions[1];custom.question='Our own question';const prior=JSON.stringify(custom);
 context.window.LMC_MIGRATE_STARTER_NIV(state.game);assert.match(q.question,/I lack nothing/);assert.equal(q.value,750);assert.equal(q.reference,'Psalm 23:1 (NIV)');assert.equal(JSON.stringify(custom),prior);assert.equal(state.teams[0].score,1400);assert.equal(state.used['0:0'],true);
 const other={...state.game,title:'My custom game'};other.categories=structuredClone(state.game.categories);other.categories[4].questions[0].reference='Psalm 23:1 (KJV)';context.window.LMC_MIGRATE_STARTER_NIV(other);assert.equal(other.categories[4].questions[0].reference,'Psalm 23:1 (KJV)');
});
test('pagination sends only the selected NIV verse reference, never text, to the TV',()=>{
 const ref='Genesis 1:1-7',value=reading(ref);value.blocks[0].verses[0].text='SHOULD_NOT_BE_SHARED';let view=scripture.project(value,ref);assert.equal(view.pages,7);assert.equal(view.reference,'Genesis 1:1');assert.equal(view.translation,'NIV');assert.equal(JSON.stringify(scripture.normalize(value,ref)).includes('SHOULD_NOT_BE_SHARED'),false);
 value.page=2;assert.equal(scripture.project(value,ref).reference,'Genesis 1:3');value.page=999;assert.equal(scripture.project(value,ref).reference,'Genesis 1:7');value.open=false;assert.equal(scripture.project(value,ref),null);
});
test('the verse index discards its source text, caches metadata and returns independent page state',async()=>{
 let requests=0;const cache=new Map(),fetcher=async(url,options)=>{requests++;assert.equal(options.credentials,'omit');assert.equal(new URL(url).searchParams.get('translation'),'web');return {ok:true,json:async()=>({reference:'Genesis 1:1-7',translation_id:'web',verses:index})};};
 const a=await scripture.load('Genesis 1:1-7',{cache,fetcher});a.page=3;const b=await scripture.load('Genesis 1:1-7',{cache,fetcher});assert.equal(requests,1);assert.equal(b.page,0);assert.equal(JSON.stringify(b).includes('PUBLIC_DOMAIN_TEXT'),false);assert.match(scripture.html(scripture.project(b,b.reference)),/sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"/);assert.equal(scripture.html(scripture.project(b,b.reference)).includes('allow-same-origin'),false);
});
test('failed index requests retry and external passage links always choose NIV on a fixed HTTPS site',async()=>{
 let requests=0;const cache=new Map(),fetcher=async()=>{requests++;return requests===1?{ok:false}:{ok:true,json:async()=>({reference:'Genesis 1:1-7',translation_id:'web',verses:index})};};await assert.rejects(scripture.load('Genesis 1:1-7',{cache,fetcher}));assert.equal((await scripture.load('Genesis 1:1-7',{cache,fetcher})).status,'ready');
 const url=new URL(scripture.readerUrl('John 3:16 (KJV)'));assert.equal(url.origin,'https://www.biblegateway.com');assert.equal(url.searchParams.get('version'),'NIV');assert.equal(url.searchParams.get('search'),'John 3:16');
});
test('malformed or unrelated reader state cannot add executable URLs or arbitrary text to the display',()=>{
 const ref='Genesis 1:1-7',value=reading(ref);assert.equal(scripture.normalize(value,'John 3:16'),null);value.blocks[0].verses[0].reference='javascript:alert(1)';assert.equal(scripture.normalize(value,ref),null);
});
test('Scripture stays hidden before answer review and throughout a steal',()=>{
 const snapshot=core.normalizeSnapshot(sample());snapshot.pending.scripture=reading(snapshot.pending.question.reference);assert.equal(core.normalizeSnapshot(snapshot).pending.scripture,undefined);assert.equal(core.projectDisplay(core.normalizeSnapshot(snapshot)).clue.scripture,undefined);
 snapshot.pending=game.answerClue(snapshot.state,snapshot.pending,'incorrect',false).clue;snapshot.pending.scripture=reading(snapshot.pending.question.reference);assert.equal(core.projectDisplay(core.normalizeSnapshot(snapshot)).clue.scripture,undefined);
});
test('opening, paging and closing Scripture preserves the pending result and normal next-category scoring',()=>{
 const snapshot=core.normalizeSnapshot(sample()),result=game.answerClue(snapshot.state,snapshot.pending,'correct',false).result;snapshot.pending.review={status:'correct',result};snapshot.pending.revealed=true;snapshot.pending.scripture=reading(snapshot.pending.question.reference);
 let view=core.projectDisplay(core.normalizeSnapshot(snapshot));assert.equal(view.clue.scripture.reference,'Genesis 1:1');assert.equal(snapshot.state.teams[0].score,500);snapshot.pending.scripture.page=1;view=core.projectDisplay(core.normalizeSnapshot(snapshot));assert.equal(view.clue.scripture.reference,'Genesis 1:2');snapshot.pending.scripture.open=false;assert.equal(core.projectDisplay(core.normalizeSnapshot(snapshot)).clue.scripture,undefined);
 Object.assign(snapshot.state,result);snapshot.pending=null;view=core.projectDisplay(core.normalizeSnapshot(snapshot));assert.equal(view.screen,'board');assert.equal(view.clue,undefined);assert.equal(view.teams[0].score,600);
});
