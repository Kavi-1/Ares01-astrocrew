import { test, expect, type Page } from '@playwright/test';

test.use({viewport:{width:640,height:700},reducedMotion:'reduce'});
const press=async(page:Page,name:string)=>{const scope=name==='Reroute safely'?page.getByRole('complementary',{name:'Sol operations',exact:true}):page;const b=scope.getByRole('button',{name,exact:true});await b.focus();await b.press('Enter');};
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state);
const coach=(page:Page,id:string)=>page.locator(`[data-tutorial-prompt="${id}"]`);
const missionOnly=(s:Record<string,unknown>)=>Object.fromEntries(Object.entries(s).filter(([key])=>!key.startsWith('tutorial')&&key!=='paceMode'));
const errors=(page:Page)=>{const list:string[]=[];page.on('pageerror',e=>list.push(e.message));return list;};
async function dismiss(page:Page){const button=page.getByRole('button',{name:'Dismiss prompt',exact:true});if(await button.isVisible())await button.press('Enter');}
async function openStation(page:Page,name:string){const dock=page.locator('.dock-open').filter({hasText:name});await dock.focus();await dock.press('Enter');}
async function start(page:Page){await page.goto('/?visual=v2&quality=low');await press(page,'ENTER MISSION CONTROL');}
async function briefing(page:Page){await start(page);await dismiss(page);await press(page,'Enter mission control');await expect(page.getByRole('region',{name:'Science briefing',exact:true})).toBeVisible();}
async function viewportProof(page:Page,name:string){
 for(const width of [390,820,1440]){
  await page.setViewportSize({width,height:900});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  for(const node of await page.locator('[data-tutorial-prompt]').all()){
   const box=await node.boundingBox();if(!box)continue;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  }
  const console=page.locator('.sol-console');
  if(await console.count())for(const note of await page.locator('[data-tutorial-prompt]').all()){
   await expect.poll(async()=>{const a=await note.boundingBox(),b=await console.boundingBox();if(!a||!b)return 0;
    return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
   }).toBeLessThanOrEqual(1);
  }
  await page.screenshot({path:`work-logs/tutorial-screenshots/${name}-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:640,height:700});
}

test('first launch is Guided/Quick; keyboard dismissal, Help, glossary, replay and disable preserve the mission',async({page})=>{
 const uncaught=errors(page);await page.goto('/?visual=v2&quality=low');
 await expect(page.getByText('You choose. The numbers decide. The report tells you why.',{exact:true})).toBeVisible();
 await expect(page.getByRole('radio',{name:'Guided',exact:true})).toBeChecked();
 await expect(page.getByRole('radio',{name:'Quick',exact:true})).toBeChecked();
 await press(page,'ENTER MISSION CONTROL');await expect(coach(page,'C1')).toBeVisible();
 await expect(page.locator('[data-coach=seats]')).toHaveClass(/tutorial-highlight/);
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 expect(await coach(page,'C1').evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
 const selected=(await state(page)).selectedCrewId;
 // A visible coach neither traps focus nor blocks the real seat keyboard control.
 await page.keyboard.press('ArrowRight');expect((await state(page)).selectedCrewId).not.toBe(selected);
 await page.keyboard.press('ArrowLeft');expect((await state(page)).selectedCrewId).toBe(selected);
 await viewportProof(page,'crew-coach');
 const original=missionOnly(await state(page));
 await page.keyboard.press('Escape');await expect(coach(page,'C1')).toHaveCount(0);
 expect(missionOnly(await state(page))).toEqual(original);
 await press(page,'Help');await press(page,'Reopen tutorial prompt');await expect(coach(page,'C1')).toBeVisible();
 await press(page,'Dismiss prompt');expect(missionOnly(await state(page))).toEqual(original);
 await press(page,'Help');await press(page,'Glossary');
 const help=page.getByRole('complementary',{name:'Mission help',exact:true});
 for(const term of ['Margin','Reserve','Sol','Safe mode','Accepted risk','Relay pass','Relay orbit','Areostationary','Tier','Budget'])await expect(help).toContainText(new RegExp(term,'i'));
 await page.keyboard.press('ArrowRight');expect((await state(page)).selectedCrewId).toBe(selected);
 await page.screenshot({path:'work-logs/tutorial-screenshots/glossary.png',fullPage:true});
 await press(page,'Close help');await expect(page.getByRole('button',{name:'Help',exact:true})).toBeFocused();
 await page.keyboard.press('ArrowRight');expect((await state(page)).selectedCrewId).not.toBe(selected);
 await page.keyboard.press('ArrowLeft');expect((await state(page)).selectedCrewId).toBe(selected);expect(missionOnly(await state(page))).toEqual(original);
 await press(page,'Help');await press(page,'Replay Tutorial');await expect(coach(page,'C1')).toBeVisible();
 expect(missionOnly(await state(page))).toEqual(original);
 await press(page,'Help');await press(page,'Disable tutorial prompts');await expect(page.locator('[data-tutorial-prompt]')).toHaveCount(0);
 expect((await state(page)).tutorialMode).toBe('skip');expect(missionOnly(await state(page))).toEqual(original);
 await page.reload();await expect(page.getByRole('group',{name:'Crew seats',exact:true})).toBeVisible();
 await expect(page.locator('[data-tutorial-prompt]')).toHaveCount(0);expect((await state(page)).tutorialMode).toBe('skip');
 expect((await state(page)).tutorialStepsSeen).toContain('C1');
 await press(page,'Home');await page.reload();await expect(page.getByRole('button',{name:'ENTER MISSION CONTROL',exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Crew seats',exact:true})).toHaveCount(0);await expect(page.getByRole('radio',{name:'Guided',exact:true})).toHaveCount(0);
 await press(page,'ENTER MISSION CONTROL');await expect(page.getByRole('group',{name:'Crew seats',exact:true})).toBeVisible();
 await expect(page.locator('[data-tutorial-prompt]')).toHaveCount(0);expect((await state(page)).tutorialMode).toBe('skip');expect(uncaught).toEqual([]);
});

test('Explore uses real proposals/rankings and immutable C5 preview with current instrument deltas',async({page})=>{
 const uncaught=errors(page);await page.goto('/?visual=v2&quality=low');await page.getByRole('radio',{name:'Explore',exact:true}).check();
 await press(page,'ENTER MISSION CONTROL');await dismiss(page);await press(page,'Enter mission control');
 await expect(coach(page,'C3')).toBeVisible();await expect(coach(page,'C3')).toContainText(/50|0\.5/);
 await page.getByLabel('Objective priority 1',{exact:true}).selectOption('B');
 expect((await state(page)).missionOptions.ranking).toEqual(['B','G','E']);
 await expect(coach(page,'C3')).toContainText('50% Potential biosignature context');
 const journal=page.locator('details').filter({has:page.getByText('Field notes journal',{exact:true})});
 await journal.locator('summary').focus();await journal.locator('summary').press('Enter');
 for(const name of ['Kavi','Aaryan','Houssam','Huzaifa','Lautaro','Rihabe'])await expect(journal).toContainText(name);
 await press(page,'Help');await expect(page.getByRole('complementary',{name:'Mission help',exact:true})).toContainText(/briefing|objectives/i);await press(page,'Close help');
 // Continue by mouse while C3 remains visible: the coach must not intercept the real control.
 await expect(coach(page,'C3')).toBeVisible();
 await page.getByRole('button',{name:'Begin workshop',exact:true}).click();await openStation(page,'Payload workshop');
 await expect(coach(page,'C2')).toBeVisible();
 await expect(page.getByRole('button',{name:'Accept proposal',exact:true})).toBeEnabled();
 await expect(page.getByLabel('Proposal priority',{exact:true})).toBeEnabled();
 await page.getByLabel('Proposal priority',{exact:true}).selectOption('mass');
 await press(page,'Take over');await dismiss(page);
 const mastcam=page.getByRole('checkbox',{name:/Mastcam-Z/});await mastcam.uncheck();await press(page,'Apply changes');
 const beforeAdd=await state(page);expect(beforeAdd.roverConfig.instruments).not.toContain('mastcam-z');
 await mastcam.check();await expect(coach(page,'C4')).toBeVisible();
 const highlighted=page.locator('[data-coach="margins"].tutorial-highlight:visible');
 await expect(highlighted).toBeVisible();await expect(highlighted).toBeInViewport({ratio:.1});
 await expect(coach(page,'C4')).toContainText('1021.0');
 await expect(coach(page,'C4')).toContainText('1025.0');
 await expect(coach(page,'C4')).toContainText('$2660');
 await expect(coach(page,'C4')).toContainText('$2700');
 // Adding hardware is still a draft until the player chooses Apply.
 expect((await state(page)).roverConfig).toEqual(beforeAdd.roverConfig);
 await page.screenshot({path:'work-logs/tutorial-screenshots/instrument-delta.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'work-logs/tutorial-screenshots/instrument-delta-1440.png',fullPage:true});await page.setViewportSize({width:640,height:700});
 await dismiss(page);await press(page,'Apply changes');
 const realPlan=missionOnly(await state(page));await page.locator('[data-coach=red-preview-trigger]').focus();await page.locator('[data-coach=red-preview-trigger]').press('Enter');
 const preview=page.locator('[data-tutorial-preview="red-check"]');await expect(preview).toBeVisible();
 await expect(preview).toContainText(/fix|reduce|switch|drop|remove|change/i);
 expect(missionOnly(await state(page))).toEqual(realPlan);
 await page.setViewportSize({width:1440,height:900});
 await preview.locator('.preview-failed').scrollIntoViewIfNeeded();await expect(preview.locator('.preview-failed')).toBeInViewport();
 await page.screenshot({path:'work-logs/tutorial-screenshots/red-check-preview.png',fullPage:true});
 await preview.locator('.preview-fixed').scrollIntoViewIfNeeded();await expect(preview.locator('.preview-fixed')).toBeInViewport();
 await page.screenshot({path:'work-logs/tutorial-screenshots/red-check-fix.png',fullPage:true});await page.setViewportSize({width:640,height:700});
 await page.keyboard.press('Escape');await expect(preview).toHaveCount(0);
 expect(missionOnly(await state(page))).toEqual(realPlan);
 await expect(page.getByRole('region',{name:'Payload workshop',exact:true})).toBeVisible();
 for(const station of ['Power station','Communications','Readiness review']){
  const dock=page.locator('.dock-open').filter({hasText:station});await dock.focus();await dock.press('Enter');await press(page,'Station help');
  await expect(page.getByRole('complementary',{name:'Mission help',exact:true})).toContainText(new RegExp(station==='Readiness review'?'vehicle mass, landing index and budget':station==='Power station'?'power|energy':'communications|data|relay','i'));
  await press(page,'Close help');await dismiss(page);
 }
 const explored=await state(page);expect(explored.paceMode).toBe('explore');
 for(const id of ['C1','C2','C3','C4','C5','C6'])expect(explored.tutorialStepsSeen).toContain(id);
 expect(uncaught).toEqual([]);
});

test('actual launch, first drive/scan, scheduled event and report are coached without changing outcomes',async({page})=>{
 const uncaught=errors(page);await briefing(page);await dismiss(page);await press(page,'Begin workshop');await openStation(page,'Payload workshop');await expect(coach(page,'C2')).toBeVisible();await dismiss(page);await press(page,'Review mission');
 await expect(coach(page,'C6')).toBeVisible();
 // A retained confirmation is historical after the player returns to redesign.
 await press(page,'Approve & launch');await press(page,'Return to engineering');
 const room=page.locator('.room-canvas');await expect(room).toHaveAttribute('data-player-z',/^-?\d/);const startZ=Number(await room.getAttribute('data-player-z'));
 await press(page,'Help');await press(page,'Close help');await expect(page.getByRole('button',{name:'Help',exact:true})).toBeFocused();
 await page.keyboard.down('w');await expect.poll(async()=>Math.abs(Number(await room.getAttribute('data-player-z'))-startZ)).toBeGreaterThan(.05);await page.keyboard.up('w');
 await press(page,'Review mission');
 expect((await state(page)).confirmedMission.options.relay).toBe('O1');
 await press(page,'Help');await press(page,'Reopen tutorial prompt');await expect(coach(page,'C6')).toBeVisible();
 await page.getByLabel('Relay orbit',{exact:true}).selectOption('O3');
 expect((await state(page)).confirmedMission.options.relay).toBe('O1');expect((await state(page)).missionOptions.relay).toBe('O3');
 await expect(page.locator('.launch-setup')).toContainText(/20 sols/);
 await press(page,'Help');const full=page.getByRole('complementary',{name:'Mission help',exact:true});
 await full.getByText('Full current explanation',{exact:true}).focus();await full.getByText('Full current explanation',{exact:true}).press('Enter');
 await expect(full).toContainText('shortens surface operations to 20 sols');await expect(full).toContainText('$2840');
 await press(page,'Close help');await expect(coach(page,'C6')).toBeVisible();
 expect(await coach(page,'C6').evaluate(node=>getComputedStyle(node).pointerEvents)).toBe('none');
 const note=await coach(page,'C6').boundingBox(),form=await page.locator('.console-body').boundingBox();expect(note!.y+note!.height).toBeLessThanOrEqual(form!.y+1);
 await page.getByRole('checkbox',{name:/Accept budget overrun/}).check();
 await press(page,'Approve & launch');await press(page,'BEGIN COUNTDOWN');await expect(coach(page,'C7:launch')).toBeVisible();
 await expect(coach(page,'C7:launch')).toContainText(/1375|1,375/);await dismiss(page);
 await press(page,'CONFIRM LIFTOFF');await press(page,'BEGIN MARS APPROACH');await expect(coach(page,'C7:landing')).toBeVisible();await dismiss(page);await press(page,'DEPLOY ROVER');await press(page,'Engineering');
 await expect(page.getByRole('complementary',{name:'Sol operations',exact:true})).toBeVisible();
 await expect(coach(page,'C8:plan')).toBeVisible();
 const firstSol=await state(page),physicalBefore=firstSol.campaign;
 await expect(coach(page,'C8:plan')).toContainText(physicalBefore.energyWh.toFixed(1)+' Wh');
 await press(page,'Help');await press(page,'Glossary');await press(page,'Close help');
 expect((await state(page)).campaign).toEqual(physicalBefore);
 await press(page,'Pause');await expect(page.getByRole('button',{name:'RESUME MISSION',exact:true})).toBeVisible();
 await press(page,'Help');await press(page,'Glossary');await press(page,'Close help');
 await expect(page.getByRole('button',{name:'RESUME MISSION',exact:true})).toBeVisible();expect((await state(page)).campaign).toEqual(physicalBefore);
 await press(page,'RESUME MISSION');await expect(coach(page,'C8:plan')).toBeVisible();
 await viewportProof(page,'first-sol-coach');expect((await state(page)).campaign).toEqual(physicalBefore);
 await page.screenshot({path:'work-logs/tutorial-screenshots/first-sol.png',fullPage:true});
 await dismiss(page);await press(page,'Commit sol plan');await expect(coach(page,'C8:drive')).toBeVisible();await dismiss(page);
 await press(page,'End sol 1');await press(page,'Commit sol plan');await press(page,'Engineering');
 const beforeFocusedHelp=(await state(page)).campaign;await press(page,'Help');await press(page,'Close help');
 await expect(page.getByRole('button',{name:'Help',exact:true})).toBeFocused();await page.keyboard.press(' ');
 await expect(page.getByRole('complementary',{name:'Mission help',exact:true})).toBeVisible();await press(page,'Close help');
 await expect(page.getByRole('button',{name:'Help',exact:true})).toBeFocused();expect((await state(page)).campaign).toEqual(beforeFocusedHelp);
 await page.keyboard.down('w');
 await expect.poll(async()=>(await state(page)).missionProgress.distance).toBeGreaterThan(.1);await page.keyboard.up('w');
 await page.getByRole('button',{name:'Pause',exact:true}).focus();await page.keyboard.down(' ');
 await expect(coach(page,'C8:scan')).toBeVisible();await dismiss(page);
 await page.getByText('Science context and quick observation',{exact:true}).focus();await page.getByText('Science context and quick observation',{exact:true}).press('Enter');
 await page.getByRole('button',{name:/START SCAN/}).focus();await page.getByRole('button',{name:/START SCAN/}).press('Enter');
 await expect.poll(async()=>(await state(page)).campaign.completed,{timeout:90_000}).toContain('science:jezero-G-1');await page.keyboard.up(' ');
 await expect(coach(page,'C8:end')).toBeVisible();await dismiss(page);await press(page,'Engineering');await press(page,'End sol 2');
 for(let sol=3;sol<5;sol++)await press(page,'End sol');
 await expect(coach(page,'C9:event')).toBeVisible();await expect(coach(page,'C9:event')).toContainText(/5/);
 const scheduled=(await state(page)).campaign.events.find((e:{id:string})=>e.id==='E1');expect(scheduled.sol).toBe(5);
 await dismiss(page);await press(page,'Reroute safely');
 await press(page,'Abort');await press(page,'Abort mission');await expect(coach(page,'C9:report')).toBeVisible();
 const report=await state(page);expect(report.missionRecord.outcome).toBe('mission-abort');
 await press(page,'Open mission dossier');await expect(coach(page,'C9:report')).toBeVisible();
 const reportTarget=page.locator('[data-coach=report].tutorial-highlight:visible');await expect(reportTarget).toHaveCount(1);await expect(reportTarget).toBeInViewport({ratio:.1});
 await dismiss(page);await press(page,'Science return');
 await expect(page.locator('.campaign-result')).toContainText('20-sol mission');
 await page.screenshot({path:'work-logs/tutorial-screenshots/tutorial-report.png',fullPage:true});
 for(const id of ['C1','C2','C3','C6','C7:launch','C7:landing','C8:plan','C8:drive','C8:scan','C8:end','C9:event','C9:report'])expect(report.tutorialStepsSeen).toContain(id);
 // Subsequent campaigns retain preferences/progress, default to Skip, and never force another chooser.
 await press(page,'NEW CAMPAIGN');await expect(page.getByRole('radio',{name:'Guided',exact:true})).toHaveCount(0);
 await press(page,'ENTER MISSION CONTROL');await expect(page.getByRole('group',{name:'Crew seats',exact:true})).toBeVisible();
 expect((await state(page)).tutorialMode).toBe('skip');await expect(page.locator('[data-tutorial-prompt]')).toHaveCount(0);
 expect(uncaught).toEqual([]);
});


test.describe('supported mobile touch',()=>{
 test.use({hasTouch:true,viewport:{width:390,height:844}});
 test('mobile touch activates coaching, glossary and replay without changing the real mission',async({page})=>{
  const uncaught=errors(page);await page.goto('/?visual=v2&quality=low');
  await expect(page.getByRole('radio',{name:'Guided',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'ENTER MISSION CONTROL',exact:true}).tap();await expect(coach(page,'C1')).toBeVisible();
  const actual=missionOnly(await state(page));
  const close=page.getByRole('button',{name:'Dismiss prompt',exact:true}),closeBox=await close.boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:'work-logs/tutorial-screenshots/touch-coach-390.png',fullPage:true});
  await close.tap();await expect(coach(page,'C1')).toHaveCount(0);expect(missionOnly(await state(page))).toEqual(actual);
  await page.getByRole('button',{name:'Help',exact:true}).tap();
  const help=page.getByRole('complementary',{name:'Mission help',exact:true});await expect(help).toBeVisible();
  await help.getByRole('button',{name:'Glossary',exact:true}).tap();await expect(help).toContainText('Areostationary');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'work-logs/tutorial-screenshots/touch-glossary-390.png',fullPage:true});
  await help.getByRole('button',{name:'Close help',exact:true}).tap();expect(missionOnly(await state(page))).toEqual(actual);
  await page.getByRole('button',{name:'Help',exact:true}).tap();await help.getByRole('button',{name:'Replay Tutorial',exact:true}).tap();
  await expect(coach(page,'C1')).toBeVisible();expect(missionOnly(await state(page))).toEqual(actual);
  await page.getByRole('button',{name:'Help',exact:true}).tap();await help.getByRole('button',{name:'Disable tutorial prompts',exact:true}).tap();await expect(page.locator('[data-tutorial-prompt]')).toHaveCount(0);
  expect((await state(page)).tutorialMode).toBe('skip');expect(missionOnly(await state(page))).toEqual(actual);expect(uncaught).toEqual([]);
 });
});
