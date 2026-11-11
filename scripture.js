(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LMC_SCRIPTURE=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const saved=new Map(),MAX_VERSES=200;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function references(value){
    const clean=String(value||'').trim().replace(/[–—−]/g,'-').replace(/\s*\((?:KJV|WEB|NIV|NKJV|ESV|NLT|NASB(?:\s*(?:1995|2020))?|NRSV(?:UE)?)\)/gi,'').replace(/,\s*heading\b/gi,'');
    const parts=clean.split(';').map(s=>s.trim()).filter(Boolean);if(!parts.length||parts.length>8||clean.length>500)throw new Error('Check the Scripture reference saved with this question.');
    let book='';
    return parts.map(part=>{const match=part.match(/^((?:[1-3]\s*)?[A-Za-z][A-Za-z. ]*?)\s*(\d[\d\s:,\-]*)$/);if(match){book=match[1].trim();part=book+' '+match[2];}else if(book&&/^\d[\d\s:,\-]*$/.test(part))part=book+' '+part;else throw new Error('Check the Scripture reference saved with this question.');return part.replace(/\s*,\s*/g,',');});
  }
  function readerUrl(reference){let search;try{search=references(reference).join('; ');}catch{search=String(reference||'').slice(0,500);}const url=new URL('https://www.biblegateway.com/passage/');url.searchParams.set('search',search);url.searchParams.set('version','NIV');return url.href;}
  function pages(blocks){return blocks.flatMap(block=>block.verses.map(verse=>({reference:verse.reference})));}
  function normalize(value,reference){
    if(!value||!reference||value.reference!==reference||!['loading','ready','error'].includes(value.status))return null;
    const result={reference,status:value.status,open:value.open===true,page:0,blocks:[]};if(value.status!=='ready')return result;
    if(!Array.isArray(value.blocks)||!value.blocks.length||value.blocks.length>8)return null;
    let count=0;
    for(const block of value.blocks){if(typeof block.reference!=='string'||block.reference.length>250||!Array.isArray(block.verses)||!block.verses.length)return null;const verses=[];for(const verse of block.verses){if(typeof verse.reference!=='string'||!/^((?:[1-3] )?[A-Za-z][A-Za-z. ]*?) \d{1,3}:\d{1,3}$/.test(verse.reference)||++count>MAX_VERSES)return null;verses.push({reference:verse.reference});}result.blocks.push({reference:block.reference.trim(),verses});}
    result.page=Number.isSafeInteger(value.page)?Math.max(0,Math.min(value.page,pages(result.blocks).length-1)):0;return result;
  }
  function project(value,reference){const reading=normalize(value,reference);if(!reading?.open)return null;const all=reading.status==='ready'?pages(reading.blocks):[],part=all[reading.page];return {status:reading.status,reference:part?.reference||reference,translation:'NIV',page:reading.page+1,pages:all.length};}
  function html(view){
    if(!view)return '';
    if(view.status==='loading')return '<p class="scripture-notice" role="status">Finding the passage…</p>';
    if(view.status==='error')return '<p class="scripture-notice" role="status">The passage could not be loaded. Try again or choose Open NIV Bible.</p>';
    const fragment=new URLSearchParams({reference:view.reference});
    return '<iframe class="scripture-reader" title="'+esc(view.reference)+' — New International Version" src="./scripture-reader.html?v=20261111-niv#'+esc(fragment.toString())+'" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>';
  }
  async function load(reference,{fetcher=globalThis.fetch,cache=saved,timeoutMs=12000}={}){
    const parts=references(reference),key=parts.join(';');
    if(!cache.has(key)){
      // This public-domain index supplies verse numbers only. NIV text is rendered
      // directly by the official Logos reader and is never copied into game state.
      const task=(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);try{const blocks=[];for(const part of parts){const response=await fetcher('https://bible-api.com/'+encodeURIComponent(part)+'?translation=web',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('Passage unavailable.');const data=await response.json();if(data.translation_id!=='web'||!Array.isArray(data.verses))throw new Error('Passage unavailable.');blocks.push({reference:data.reference,verses:data.verses.map(v=>({reference:v.book_name+' '+v.chapter+':'+v.verse}))});}const result=normalize({reference,status:'ready',open:true,page:0,blocks},reference);if(!result)throw new Error('Choose Open NIV Bible to read this passage.');return result;}finally{clearTimeout(timeout);}})();
      cache.set(key,task);task.catch(()=>{if(cache.get(key)===task)cache.delete(key);});
    }
    const result=await cache.get(key);return {...JSON.parse(JSON.stringify(result)),reference};
  }
  return {references,readerUrl,pages,normalize,project,html,load};
});
