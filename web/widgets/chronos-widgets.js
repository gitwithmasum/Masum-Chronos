/* MASUM CHRONOS v2.4 Universal Widget Loader (embed in any web app).
 * No automatic access to host storage, account tokens, or application data.
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
 function mount(element,options={}){
   const host=typeof element==='string'?document.querySelector(element):element;
   if(!host||typeof host.appendChild!=='function')throw new TypeError('ChronosWidgets.mount requires a real DOM container.');
   const type=fallback(options.type,kinds,'focus'),
      theme=fallback(options.theme,themes,'nebula'),
      size=fallback(options.size,sizes,'regular'),
      minutes=safeNumber(options.minutes);
   const source=options.source==='host'?'host':'local';
   const url=new URL(asset.href);
   const query=new URLSearchParams({type,theme,size,minutes:String(minutes),source});
   if(source==='host')query.set('hostOrigin',location.origin);
   url.search=query.toString();
   const iframe=document.createElement('iframe');
   iframe.src=url.href;
   iframe.title='MASUM CHRONOS '+type+' widget';
   iframe.loading='lazy';
   iframe.referrerPolicy='strict-origin-when-cross-origin';
   iframe.setAttribute('aria-label',iframe.title);
   iframe.style.display='block';
   iframe.style.border='0';
   iframe.style.width='100%';
   iframe.style.maxWidth=limits[size]+'px';
   iframe.style.height=heights[type][size]+'px';
   iframe.style.borderRadius='17px';
   iframe.style.background='transparent';
   // Trusted, maintained Chronos-origin iframe. No app tokens/host storage exposed.
   // Third-party browsers may partition iframe local storage automatically.
   let current=options.data||null,loaded=false;
   function update(data){
     current=data;
     if(source!=='host')return false;
     if(!loaded||!iframe.contentWindow)return true;
     try {
       // Bound data size (and prevent accidental large/circular host payloads).
       const json=JSON.stringify(data);
       if(!json||json.length>64000)throw new RangeError('Host widget data exceeds 64 KB.');
       iframe.contentWindow.postMessage({type:'chronos:widget:data',version:1,payload:JSON.parse(json)},asset.origin);
       return true;
     }catch{return false;}
   }
   iframe.addEventListener('load',()=>{loaded=true;if(source==='host'&&current)update(current);});
   host.appendChild(iframe);
   return Object.freeze({iframe,update,destroy(){iframe.remove();loaded=false;}});
 }
 root.ChronosWidgets=Object.freeze({mount,version:'2.4.0-beta.1',types:Object.freeze(kinds.slice()),themes:Object.freeze(themes.slice()),sizes:Object.freeze(sizes.slice())});
})(window);
