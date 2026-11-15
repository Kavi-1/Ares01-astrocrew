import { test, expect, type Page } from '@playwright/test';
const press=async(page:Page,name:string)=>{const b=page.getByRole('button',{name,exact:true});await b.focus();await b.press('Enter');};
async function briefing(page:Page){await page.goto('/?visual=v2&quality=low');const skip=page.getByRole('radio',{name:'Skip',exact:true});if(await skip.isVisible())await skip.check();await press(page,'ENTER MISSION CONTROL');await press(page,'Enter mission control');await expect(page.getByRole('region',{name:'Science briefing',exact:true})).toBeVisible();}
const errors=(page:Page)=>{const list:string[]=[];page.on('pageerror',e=>list.push(e.message));return list;};
test.use({viewport:{width:640,height:600},reducedMotion:'reduce'});

test('all sites and all six objective rankings are selectable and survive save/load',async({page})=>{
 const uncaught=errors(page);await briefing(page);
 for(const site of ['Jezero','Northeast Syrtis','Columbia Hills']){
  const card=page.getByRole('button',{name:new RegExp('^'+site+' ')});await card.focus();await card.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed','true');
  for(const ranks of [['G','B','E'],['G','E','B'],['B','G','E'],['B','E','G'],['E','G','B'],['E','B','G']]){
   for(let i=0;i<3;i++)await page.getByLabel(`Objective priority ${i+1}`,{exact:true}).selectOption(ranks[i]);
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.missionOptions);
   expect(saved.ranking).toEqual(ranks);
  }
 }
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`work-logs/screenshots/scenario-selection-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:640,height:600});
 const before=await page.evaluate(()=>localStorage.getItem('ares-01-campaign'));
 await page.reload();
 // Production hydrates the same persisted state before mounting the resumed stage.
 await expect(page.getByRole('button',{name:/^Columbia Hills /})).toHaveAttribute('aria-pressed','true');
 expect(JSON.parse(before!).state.missionOptions).toEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.missionOptions));
 expect(uncaught).toEqual([]);
});

for(const site of ['Jezero','Northeast Syrtis','Columbia Hills'])test(`${site}: real UI launch, sol planning, MEDA return, 30-sol progression and report`,async({page})=>{
 test.setTimeout(300_000);
 const uncaught=errors(page);await briefing(page);const card=page.getByRole('button',{name:new RegExp('^'+site+' ')});await card.focus();await card.press('Enter');
 await page.screenshot({path:`work-logs/screenshots/${site.replaceAll(' ','-')}-briefing.png`,fullPage:true});
 await press(page,'Begin workshop');await press(page,'Review mission');
 if(site==='Columbia Hills')await page.getByRole('checkbox',{name:/Accept hard landing/}).check();
 await press(page,'Approve & launch');
 await press(page,'BEGIN COUNTDOWN');await press(page,'CONFIRM LIFTOFF');
 await press(page,'BEGIN MARS APPROACH');await press(page,'DEPLOY ROVER');
 await expect(page.getByRole('complementary',{name:'Sol operations'})).toBeVisible();
 if(site==='Columbia Hills')await expect(page.locator('.sol-console [role=alert]')).toContainText('S6 hard landing');
 if(site==='Jezero'){for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const box=await page.locator('.sol-console').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  await page.screenshot({path:`work-logs/screenshots/sol-planning-${width}.png`,fullPage:true});
 }await page.setViewportSize({width:640,height:600});}
 await press(page,'Commit sol plan');
 await page.locator('.sol-console summary').focus();await page.locator('.sol-console summary').press('Enter');
 await press(page,'Record MEDA weather');
 await press(page,'Transmit queued science');
 await expect(page.locator('.sol-console')).toContainText('Scientific value 0.60 / 30');
 // No timer may consume a sol or recharge while the player reads.
 const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign.energyWh);
 await page.waitForTimeout(250);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign.energyWh)).toBe(initial);
 await page.screenshot({path:`work-logs/screenshots/${site.replaceAll(' ','-')}-sol-1.png`,fullPage:true});
 await press(page,'End sol 1');
 for(let sol=2;sol<=30;sol++){
  await expect(page.locator('.sol-console summary')).toContainText(`SOL ${sol} / 30`);
  if(sol===5&&site!=='Columbia Hills')await press(page,'Reroute safely');
  if(sol===5&&site==='Columbia Hills')await expect(page.getByRole('button',{name:'Reroute safely',exact:true})).toHaveCount(0);
  await press(page,sol===30?'Complete final sol':'End sol');
 }
 await expect(page.getByRole('button',{name:'Open mission dossier',exact:true})).toBeVisible();
 await press(page,'Open mission dossier');
 await page.getByRole('button',{name:'Science return',exact:true}).focus();await page.getByRole('button',{name:'Science return',exact:true}).press('Enter');
 await expect(page.locator('.campaign-result')).toContainText(`${site} / 30-sol mission`);
 await expect(page.locator('.campaign-result')).toContainText('0.60 / 30');
 const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state);
 await page.screenshot({path:`work-logs/screenshots/${site.replaceAll(' ','-')}-report.png`,fullPage:true});
 expect(record.campaign?.history).toHaveLength(30);
 expect(record.missionRecord?.outcome).toBe(site==='Columbia Hills'?'mission-failure':'partial-success');
 expect(uncaught).toEqual([]);
});

test('accepted budget overrun runs 20 sols; a mass failure gives one locked retry and remains in the final report',async({page})=>{
 test.setTimeout(300_000);
 const uncaught=errors(page);await briefing(page);await press(page,'Begin workshop');await press(page,'Review mission');
 await page.getByLabel('Relay orbit',{exact:true}).selectOption('O3');
 await page.getByLabel('Launch vehicle',{exact:true}).selectOption('light');
 await page.getByRole('checkbox',{name:/Accept budget overrun/}).check();
 await page.getByRole('checkbox',{name:/Accept launch failure/}).check();
 await press(page,'Approve & launch');await press(page,'BEGIN COUNTDOWN');
 await expect(page.getByRole('region',{name:'Payload workshop',exact:true})).toBeVisible();
 await expect(page.locator('.console-body [role=alert]')).toContainText('S5 launch failure');
 const failed=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state);
 expect(failed.launchAttempt).toBe(2);expect(failed.launchFailures[0]).toContain('S5 launch failure');
 await press(page,'Review mission');
 await expect(page.getByRole('checkbox',{name:/Mass failure locked/})).toBeDisabled();
 await page.getByLabel('Launch vehicle',{exact:true}).selectOption('heavy');
 await expect(page.locator('.launch-setup')).toContainText('$2840 / $2700 M');
 await press(page,'Approve & launch');await press(page,'BEGIN COUNTDOWN');await press(page,'CONFIRM LIFTOFF');await press(page,'BEGIN MARS APPROACH');await press(page,'DEPLOY ROVER');
 await expect(page.locator('.sol-console summary')).toContainText('SOL 1 / 20');
 await press(page,'Commit sol plan');await page.locator('.sol-console summary').focus();await page.locator('.sol-console summary').press('Enter');
 await press(page,'Record MEDA weather');await press(page,'End sol 1');
 for(let sol=2;sol<=20;sol++){
  await expect(page.locator('.sol-console summary')).toContainText(`SOL ${sol} / 20`);
  if(sol===5)await press(page,'Reroute safely');
  await press(page,sol===20?'Complete final sol':'End sol');
 }
 await press(page,'Open mission dossier');
 await page.getByRole('button',{name:'Science return',exact:true}).focus();await page.getByRole('button',{name:'Science return',exact:true}).press('Enter');
 await expect(page.locator('.campaign-result')).toContainText('20-sol mission');
 await expect(page.locator('.campaign-result')).toContainText('S5 launch failure');
 const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state);
 expect(final.campaign.history).toHaveLength(20);expect(final.missionRecord.outcome).toBe('mission-failure');
 await press(page,'NEW CAMPAIGN');await expect(page.getByRole('button',{name:'ENTER MISSION CONTROL',exact:true})).toBeVisible();
 expect(uncaught).toEqual([]);
});

test('actual rover movement and G/B scans use the activity ledger once each',async({page})=>{
 test.setTimeout(300_000);const uncaught=errors(page);await briefing(page);await press(page,'Begin workshop');await press(page,'Review mission');await press(page,'Approve & launch');await press(page,'BEGIN COUNTDOWN');await press(page,'CONFIRM LIFTOFF');await press(page,'BEGIN MARS APPROACH');await press(page,'DEPLOY ROVER');
 await press(page,'End sol');await press(page,'Commit sol plan');
 await page.getByRole('button',{name:'Pause',exact:true}).focus();await page.keyboard.down('w');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.missionProgress.distance)).toBeGreaterThan(.1);
 await page.keyboard.up('w');await page.keyboard.down(' ');
 await page.getByRole('button',{name:/START SCAN/}).focus();await page.getByRole('button',{name:/START SCAN/}).press('Enter');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign.completed),{timeout:90_000}).toContain('science:jezero-G-1');
 await page.keyboard.up(' ');
 const savedScan=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign);
 await page.reload();await expect(page.getByRole('complementary',{name:'Sol operations'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign)).toEqual(savedScan);
 await press(page,'End sol 2');await press(page,'Commit sol plan');
 await page.getByRole('button',{name:/START SCAN/}).focus();await page.getByRole('button',{name:/START SCAN/}).press('Enter');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign.completed),{timeout:90_000}).toContain('science:jezero-B-1');
 const c=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign);
 expect(c.products.filter((p:{id:string})=>p.id.startsWith('jezero-G-1:'))).toHaveLength(2);
 expect(c.products.filter((p:{id:string})=>p.id.startsWith('jezero-B-1:'))).toHaveLength(2);
 expect(c.energy.filter((e:{id:string})=>e.id==='activity:jezero-B-1:sherloc')).toHaveLength(1);
 expect(c.energy.find((e:{id:string})=>e.id==='activity:jezero-B-1:sherloc').storedWh).toBeLessThan(2408);
 await press(page,'End sol 3');
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!).state.campaign);
 expect(after.products.every((p:{bits:number;sentBits:number})=>p.bits===p.sentBits)).toBe(true);
 expect(uncaught).toEqual([]);
});
