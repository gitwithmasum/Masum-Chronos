"""Local headless Chromium smoke/regression tests for both workspaces. Requires playwright."""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
async def run():
    raw=(ROOT/'web'/'index.html').read_text(encoding='utf8')
    html=raw.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+ (ROOT/'web'/'styles.css').read_text(encoding='utf8')+'</style>')
    html=html.replace('<script defer src="./app.js"></script>','').replace('</body>','<script>'+(ROOT/'web'/'app.js').read_text(encoding='utf8')+'</script></body>')
    async def mount(page, persisted=None):
        await page.evaluate("""data => {
          window.__chronosMemory = data || {};
          Object.defineProperty(window,'localStorage',{configurable:true,value:{
            getItem(k){return window.__chronosMemory[k] || null},
            setItem(k,v){window.__chronosMemory[k]=String(v)},
            removeItem(k){delete window.__chronosMemory[k]}
          }});
        }""", persisted or {})
        await page.set_content(html,wait_until='domcontentloaded')
    try:
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
            desktop=await browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
            page=await desktop.new_page()
            errors=[]
            page.on('pageerror',lambda err: errors.append(str(err)))
            await mount(page)
            await page.wait_for_selector('#header-clock:not(:empty)')
            assert await page.locator('#timer-workspace').is_visible()
            assert '25:00' in await page.locator('#timer-display').inner_text()
            await page.locator('[data-workspace="tasks"]').click()
            assert await page.locator('#todo-workspace').is_visible()
            assert not await page.locator('#timer-workspace').is_visible()
            await page.locator('#todo-title').fill('Ship futuristic task manager')
            await page.locator('#todo-priority').select_option('critical')
            await page.locator('#todo-category').select_option('Code')
            await page.locator('#todo-due').fill('2099-12-24')
            await page.locator('.todo-deploy').click()
            assert await page.locator('.mission-row').count()==1
            assert 'Ship futuristic task manager' in await page.locator('.mission-row').inner_text()
            assert await page.locator('#todo-kpi-active').inner_text()=='01'
            await page.locator('#todo-search').fill('nothing')
            assert await page.locator('.mission-row').count()==0
            await page.locator('#todo-search').fill('futuristic')
            assert await page.locator('.mission-row').count()==1
            await page.locator('#todo-search').fill('')
            await page.locator('[data-task-filter="upcoming"]').click()
            assert await page.locator('.mission-row').count()==1
            await page.locator('.mission-row .mission-icon-btn[title^="Edit"]').click()
            await page.locator('#edit-task-text').fill('Ship CHRONOS v1.1')
            await page.locator('#edit-task-priority').select_option('high')
            await page.locator('#save-edited-task').click()
            assert await page.locator('.mission-row h3').inner_text()=='Ship CHRONOS v1.1'
            await page.locator('.mission-row .mission-focus').click()
            assert await page.locator('#timer-workspace').is_visible()
            assert 'Ship CHRONOS v1.1' in await page.locator('#focus-target').inner_text()
            await page.locator('#primary-btn').click()
            assert await page.locator('#timer-status').inner_text()=='SESSION IN PROGRESS'
            await page.locator('[data-workspace="tasks"]').click()
            assert await page.locator('#todo-workspace').is_visible()
            await page.wait_for_timeout(450)
            await page.locator('[data-workspace="timer"]').click()
            assert await page.locator('#timer-status').inner_text()=='SESSION IN PROGRESS'
            await page.locator('#primary-btn').click()
            persisted=await page.evaluate('window.__chronosMemory')
            await page.close()
            page=await desktop.new_page()
            page.on('pageerror',lambda err: errors.append(str(err)))
            await mount(page, persisted)
            await page.locator('[data-workspace="tasks"]').click()
            assert await page.locator('.mission-row h3').inner_text()=='Ship CHRONOS v1.1'
            await page.locator('.mission-row .mission-check').click()
            assert await page.locator('#todo-kpi-done').inner_text()=='01'
            await page.locator('[data-task-filter="completed"]').click()
            assert await page.locator('.mission-row').count()==1
            await page.locator('[data-task-filter="all"]').click()
            await page.locator('#todo-title').fill('Study machine learning')
            await page.locator('.todo-deploy').click()
            assert await page.locator('.mission-row').count()==2
            assert await page.locator('#todo-progress-pct').inner_text()=='50%'
            await page.locator('.mission-row .mission-icon-btn[title^="Delete"]').first.click()
            assert await page.locator('.mission-row').count()==1
            await page.locator('[data-workspace="timer"]').click()
            await page.locator('[data-mode="stopwatch"]').first.click()
            await page.locator('#primary-btn').click()
            await page.wait_for_timeout(250)
            await page.locator('#next-btn').click()
            assert await page.locator('#laps-list li').count()==1
            await page.locator('#primary-btn').click()
            await page.locator('[data-mode="countdown"]').first.click()
            await page.locator('[data-seconds="300"]').click()
            assert '05:00' in await page.locator('#timer-display').inner_text()
            await page.locator('#open-settings').click()
            await page.locator('[data-theme-choice="aurora"]').click()
            assert await page.locator('body').get_attribute('data-theme')=='aurora'
            await page.locator('#settings-dialog button[value="cancel"]').click()
            await page.screenshot(path=str(ROOT/'previews'/'desktop-v1.1-todo.png'),full_page=True)
            print('DESKTOP: CRUD, filters, task-focus linking, timer, stopwatch, countdown and theme passed')
            await desktop.close()
            mobile=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
            mob=await mobile.new_page()
            mob.on('pageerror',lambda err:errors.append('mobile: '+str(err)))
            await mount(mob)
            await mob.locator('[data-workspace="tasks"]').click()
            await mob.locator('#todo-title').fill('Phone mission')
            await mob.locator('.todo-deploy').click()
            assert await mob.locator('.mission-row').count()==1
            overflow=await mob.evaluate('document.documentElement.scrollWidth - window.innerWidth')
            assert overflow <= 2, f'mobile horizontal overflow {overflow}px'
            await mob.screenshot(path=str(ROOT/'previews'/'mobile-v1.1-todo.png'),full_page=True)
            print(f'MOBILE: task CRUD, navigation and responsive width passed; overflow {overflow}px')
            await mobile.close()
            legacy=await browser.new_context(viewport={'width':1280,'height':800})
            lp=await legacy.new_page()
            await mount(lp)
            await lp.evaluate("""() => localStorage.setItem('masum-chronos-v1',JSON.stringify({version:'1.0.0',mode:'focus',theme:'cyber',tasks:[{id:'legacy-1',text:'Keep existing user task',done:false}],focus:{focusMins:40},stats:{sessions:7,totalFocusSeconds:12600,daily:{}},updatedAt:Date.now()}))""")
            await mount(lp, await lp.evaluate('window.__chronosMemory'))
            await lp.locator('[data-workspace="tasks"]').click()
            assert await lp.locator('.mission-row h3').inner_text()=='Keep existing user task'
            assert await lp.locator('body').get_attribute('data-theme')=='cyber'
            assert await lp.locator('#total-sessions').inner_text()=='07'
            assert not errors, f'JS errors: {errors}'
            print('MIGRATION: old v1.0 task, theme, stats preserved; JS pageerrors 0')
            await browser.close()
    finally:
        pass

if __name__=='__main__':
    asyncio.run(run())
