/* MASUM CHRONOS v2.6 — secure, observable cross-app widget SDK.
 * Host data is opt-in, bounded, and sent only to the Chronos iframe origin.
 */
(function(root){
 'use strict';
 const script=document.currentScript;
 const base=script?.src||'https://gitwithmasum.github.io/Masum-Chronos/web/widgets/chronos-widgets.js';
 const asset=new URL('widget.html',base);
 const kinds=['focus','countdown','tasks','stats'];
 const themes=['nebula','cyber','aurora','black-gold','pearl-waves'];
 const sizes=['compact','regular','wide'];
 const fallback=(value,valid,other)=>valid.includes(value)?value:other;
 const limits={compact:310,regular:390,wide:620};
 const heights={focus:{compact:408,regular:480,wide:490},
   countdown:{compact:408,regular:480,wide:490},
   tasks:{compact:368,regular:455,wide:465},
   stats:{compact:275,regular:345,wide:355}};
 const safeNumber=value=>Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=180?Number(value):25;
 function makeBridgeToken(){
   if(!root.crypto||typeof root.crypto.getRandomValues!=='function')throw new Error('Secure randomness is unavailable; the widget bridge was not opened.');
   const bytes=new Uint8Array(24);root.crypto.getRandomValues(bytes);
   return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 }
 const safeCall=(callback,...args)=>{if(typeof callback==='function')try{callback(...args);}catch{}};
 function mount(element,options={}){
   options=options&&typeof options==='object'?options:{};
   const host=typeof element==='string'?document.querySelector(element):element;
   if(!host||typeof host.appendChild!=='function')throw new TypeError('ChronosWidgets.mount requires a real DOM container.');
   const type=fallback(options.type,kinds,'focus'),
      theme=fallback(options.theme,themes,'nebula'),
      size=fallback(options.size,sizes,'regular'),
      minutes=safeNumber(options.minutes),
      source=options.source==='host'?'host':'local';
   const url=new URL(asset.href);
   const bridgeToken=makeBridgeToken();
   const query=new URLSearchParams({type,theme,size,minutes:String(minutes),source,bridgeToken});
   // Used only for exact-origin readiness/resize messages; host data is still accepted only in host mode.
   if(typeof location.origin==='string'&&location.origin!=='null')query.set('hostOrigin',location.origin);
   url.search=query.toString();
   const iframe=document.createElement('iframe');
   iframe.src=url.href;
   iframe.title=String(options.title||('MASUM CHRONOS '+type+' widget')).slice(0,120);
   iframe.loading=options.loading==='lazy'?'lazy':'eager';
   iframe.referrerPolicy='strict-origin-when-cross-origin';
   iframe.setAttribute('aria-label',iframe.title);
   // Opaque-origin sandbox prevents the widget from reading the host DOM/storage, even when both pages share a domain.
   iframe.setAttribute('sandbox','allow-scripts allow-forms');
   iframe.style.display='block';
   iframe.style.border='0';
   iframe.style.width='100%';
   iframe.style.maxWidth=limits[size]+'px';
   iframe.style.height=heights[type][size]+'px';
   iframe.style.borderRadius='17px';
   iframe.style.background='transparent';
   let current=options.data||null,loaded=false,readySettled=false,errorReported=false;
   let resolveReady,rejectReady;
   const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
   // A caller may choose not to await readiness; prevent an unhandled-rejection warning while preserving ready's rejection for awaiters.
   ready.catch(()=>{});
   const timeoutValue=Number(options.readyTimeoutMs);
   const timeout=Number.isInteger(timeoutValue)&&timeoutValue>=1000&&timeoutValue<=30000?timeoutValue:10000;
   let readyTimer=setTimeout(()=>reportError(new Error('Chronos widget did not become ready in time.')),timeout);
   function reportError(error){
     if(!readySettled){readySettled=true;clearTimeout(readyTimer);readyTimer=null;rejectReady(error);}
     if(!errorReported){errorReported=true;safeCall(options.onError,error);}
   }
   function finishReady(){
     if(readySettled)return;
     readySettled=true;clearTimeout(readyTimer);readyTimer=null;
     resolveReady(iframe);safeCall(options.onReady,iframe);
   }
   function update(data){
     current=data;
     if(source!=='host')return false;
     if(!loaded||!iframe.contentWindow)return true;
     try{
       const json=JSON.stringify(data);
       if(!json||json.length>64000)throw new RangeError('Host widget data exceeds 64 KB.');
       // Opaque sandbox origins require '*'; direct-frame identity, host origin and bridge token are checked by the receiver.
       iframe.contentWindow.postMessage({type:'chronos:widget:data',version:1,bridgeToken,payload:JSON.parse(json)},'*');
       return true;
     }catch{return false;}
   }
   function onMessage(event){
     if(event.source!==iframe.contentWindow||event.origin!=='null'||!event.data||event.data.version!==1||event.data.bridgeToken!==bridgeToken)return;
     if(event.data.type==='chronos:widget:ready'){finishReady();return;}
     if(event.data.type==='chronos:widget:error'){reportError(new Error('Chronos widget runtime reported an error.'));return;}
     if(event.data.type==='chronos:widget:resize'){
       const height=Number(event.data.height);
       if(!Number.isInteger(height)||height<220||height>720)return;
       iframe.style.height=height+'px';safeCall(options.onResize,height);
     }
   }
   function onLoad(){loaded=true;if(source==='host'&&current)update(current);}
   function onFrameError(){reportError(new Error('Chronos widget failed to load.'));}
   iframe.addEventListener('load',onLoad);
   iframe.addEventListener('error',onFrameError);
   root.addEventListener('message',onMessage);
   host.appendChild(iframe);
   return Object.freeze({
     iframe,ready,update,
     destroy(){
       clearTimeout(readyTimer);readyTimer=null;
       root.removeEventListener('message',onMessage);
       iframe.removeEventListener('load',onLoad);
       iframe.removeEventListener('error',onFrameError);
       iframe.remove();loaded=false;
       if(!readySettled){readySettled=true;resolveReady(null);}
     }
   });
 }
 root.ChronosWidgets=Object.freeze({mount,version:'2.6.0-beta.1',types:Object.freeze(kinds.slice()),themes:Object.freeze(themes.slice()),sizes:Object.freeze(sizes.slice())});
})(window);
