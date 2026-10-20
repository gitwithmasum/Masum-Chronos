/* MASUM CHRONOS v2.4 Widget Studio — static preview and safe copyable embeds. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const loader='https://gitwithmasum.github.io/Masum-Chronos/web/widgets/chronos-widgets.js';
 const sample={
   tasks:[
     {id:'demo-1',text:'Complete Python practice',done:false,priority:'high'},
     {id:'demo-2',text:'Review project notes',done:true,priority:'medium'},
     {id:'demo-3',text:'Finish today’s mission',done:false,priority:'high'}
   ],
   stats:{sessions:12,focusSeconds:19800}
 };
 let preview=null;
 function config(){
   const type=$('studio-type').value;
   const source=['tasks','stats'].includes(type)?$('studio-source').value:'local';
   return {type,theme:$('studio-theme').value,size:$('studio-size').value,
     minutes:Number($('studio-minutes').value),source,
     ...(source==='host'?{data:sample}:{})};
 }
 function snippet(opts){
   const settings={type:opts.type,theme:opts.theme,size:opts.size,minutes:opts.minutes};
   if(opts.source==='host'){
     settings.source='host';settings.data=sample;
   }
   const json=JSON.stringify(settings,null,2);
   return '<div id="chronos-widget"></div>\n'
     +'<script src="'+loader+'"></'+'script>\n'
     +'<script>\n'
     +'  const chronos = ChronosWidgets.mount("#chronos-widget", '+json+');\n'
     +(opts.source==='host'?'  // Later: chronos.update({ tasks: yourTasks, stats: yourStats });\n':'')
     +'</'+'script>';
 }
 function update(){
   const type=$('studio-type').value;
   const hostEnabled=type==='tasks'||type==='stats';
   $('studio-source-wrap').hidden=!hostEnabled;
   $('studio-minutes-wrap').hidden=type==='tasks'||type==='stats';
   if(!hostEnabled)$('studio-source').value='local';
   const opts=config();
   if(preview)preview.destroy();
   $('studio-preview').replaceChildren();
   preview=window.ChronosWidgets.mount($('studio-preview'),opts);
   $('studio-code').value=snippet(opts);
   $('studio-mode-note').textContent=opts.source==='host'
     ?'This demo sends three example tasks and session totals. Your app must explicitly provide real data; no account, localStorage, or database is accessed automatically.'
     :'Independent mode has a separate widget storage namespace. Browser policies may restrict cross-site iframe persistence; the host app is never modified.';
   $('studio-copy-status').textContent='';
 }
 async function copy(){
   const text=$('studio-code').value;
   try{
     if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
     await navigator.clipboard.writeText(text);
     $('studio-copy-status').textContent='Embed code copied. Paste it into your HTML file.';
   }catch{
     const field=$('studio-code');field.focus();field.select();
     const copied=document.execCommand?.('copy');
     $('studio-copy-status').textContent=copied?'Embed code copied.':'Select the snippet above and press Ctrl+C to copy.';
   }
 }
 $('studio-update').addEventListener('click',update);
 for(const id of ['studio-type','studio-theme','studio-size','studio-minutes','studio-source'])$(id).addEventListener('change',update);
 $('studio-copy').addEventListener('click',()=>{void copy();});
 update();
})();
