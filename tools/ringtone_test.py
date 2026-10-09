"""WebAudio clock scheduling and Chrome UI regression tests for ten-second alarm."""
import asyncio,json,time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
raw=(ROOT/'web/index.html').read_text()
html=raw.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+(ROOT/'web/styles.css').read_text()+'</style>')
html=html.replace('<script defer src="./app.js"></script>','').replace('</body>','<script>'+(ROOT/'web/app.js').read_text()+'</script></body>')
mock="""() => { window.__audio = {starts:[],stops:[],disconnects:0};
 window.AudioContext = class {
   constructor(){this.currentTime=5;this.state='running';this.destination={};}
   resume(){return Promise.resolve();}
   createOscillator(){return {type:'sine',frequency:{value:0,setValueAtTime(){}},connect(x){return x},start(t){window.__audio.starts.push(t)},stop(t){window.__audio.stops.push(t)},disconnect(){window.__audio.disconnects++}}}
   createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},connect(x){return x},disconnect(){}}}
 }; }
"""
async def open_page(ctx,version='1.2.0', alert=True,late=0, mode='countdown'):
 page=await ctx.new_page()
 await page.evaluate(mock)
 data={'version':version,'mode':mode,'workspace':'timer','theme':'nebula','updatedAt':time.time_ns()//1000000,
       'timers':{'focus':{'durationMs':500,'remainingMs':500,'endsAt':None},'countdown':{'durationMs':500,'remainingMs':500,'endsAt':int(time.time()*1000)+250-late}},
       'settings':{'alertSound':alert,'volume':30,'soundscape':'off'},'tasks':[{'id':'old','text':'Legacy mission','done':False}], 'stats':{'sessions':4,'totalFocusSeconds':2000,'daily':{}}}
 await page.evaluate("s => {window.__chronosMemory={'masum-chronos-v1':JSON.stringify(s)};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__chronosMemory[k]||null,setItem:(k,v)=>window.__chronosMemory[k]=v}})}",data)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.set_content(html,wait_until='domcontentloaded')
 await page.wait_for_timeout(650)
 return page,errors
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=await browser.new_context()
  page,errs=await open_page(ctx)
  events=await page.evaluate('window.__audio')
  assert not errs,errs
  assert len(events['starts'])==40 and len(events['stops'])==40,len(events['starts'])
  assert abs(max(events['stops'])-min(events['starts'])-10.0)<.001,(max(events['stops']),min(events['starts']))
  assert await page.locator('#ringtone-banner').is_visible()
  saved=json.loads(await page.evaluate("localStorage.getItem('masum-chronos-v1')"))
  assert saved['tasks'][0]['text']=='Legacy mission' and saved['stats']['sessions']==4
  assert saved['version']=='1.2.1'
  await page.locator('#silence-ringtone').click()
  assert not await page.locator('#ringtone-banner').is_visible()
  assert await page.evaluate('window.__audio.disconnects')==40
  print('RINGTONE: 40 notes, WebAudio end at exactly 10.000 seconds, silence control and v1.2 data migration passed')
  await page.close()
  page,errs=await open_page(ctx,alert=False)
  assert not errs and len((await page.evaluate('window.__audio.starts')))==0
  print('SOUND OFF: Settings toggle suppresses ringtone')
  await page.close()
  page,errs=await open_page(ctx,alert=True,late=60_000)
  assert not errs and len((await page.evaluate('window.__audio.starts')))==0
  print('STALE TIMER: previous expired countdown never triggers surprise late ringtone')
  await page.close()
  await browser.close()
asyncio.run(main())
