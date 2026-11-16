import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { commitPlan, createCampaign, endSol, restoreCampaign, scienceSummary, traverse, type Campaign } from '../src/engine/campaign';
import { batteryPercent } from '../src/engine/energy';
import { createMissionRecord } from '../src/engine/missionFailure';
import { calculateEngineering } from '../src/nasa/engineering';
import { FIXED, type RoverConfig } from '../src/nasa/data';

/** Narrow instrument-interface fixtures, NOT native campaign/navigation proof.
 * Every campaign/resource value comes from the canonical engine. The RIMFAX
 * track is an explicitly synthetic, flat100m model traverse, not terrain data.
 * Only pose/presentation metadata places the renderer beside the formation.
 */
type Envelope = { version:number; state:Record<string,any> & {campaign:Campaign} };
const saved = (page:Page):Promise<Envelope> => page.evaluate(()=>JSON.parse(localStorage.getItem('ares-01-campaign')!));
const campaign = async(page:Page)=>(await saved(page)).state.campaign;
const press = async(page:Page,name:string|RegExp)=>{
  const button=page.getByRole('button',{name,exact:typeof name==='string'});
  await button.focus();await button.press('Enter');
};
test.use({viewport:{width:640,height:700},reducedMotion:'reduce'});

async function nativeEnvelope(page:Page) {
  await page.addInitScript(()=>{
    const prefix='ares-instrument-interface-fixture:';
    if(window.name.startsWith(prefix)){
      localStorage.setItem('ares-01-campaign',window.name.slice(prefix.length));window.name='';
    }
  });
  await page.goto('/?quality=low');
  const skip=page.getByRole('radio',{name:'Skip',exact:true});if(await skip.isVisible())await skip.check();
  for(const name of ['ENTER MISSION CONTROL','Enter mission control','Begin workshop','Review mission','Approve & launch','BEGIN COUNTDOWN','CONFIRM LIFTOFF','BEGIN MARS APPROACH','DEPLOY ROVER'])await press(page,name);
  await expect(page.getByRole('complementary',{name:'Field mission',exact:true})).toBeVisible();
  return saved(page);
}

async function showEngineFixture(page:Page,base:Envelope,c:Campaign) {
  const fixture=structuredClone(base),results=calculateEngineering(c.config);
  expect(results.issues).toEqual([]);
  fixture.state.campaign=c;
  fixture.state.roverConfig=structuredClone(c.config);
  fixture.state.missionOptions=structuredClone(c.options);
  fixture.state.confirmedMission={config:structuredClone(c.config),results,options:structuredClone(c.options)};
  fixture.state.missionRecord=createMissionRecord(c.config,results,[]);
  fixture.state.missionPhase='mars';
  fixture.state.missionProgress={...fixture.state.missionProgress,x:-18,z:12,heading:0,distance:c.driveMeters,battery:batteryPercent(c.energyWh),sol:c.sol,scannedTargets:[],science:0};
  await page.evaluate(value=>{window.name='ares-instrument-interface-fixture:'+JSON.stringify(value);},fixture);
  await page.reload();
  await expect(page.getByRole('complementary',{name:'Field mission',exact:true})).toBeVisible();
  expect(await campaign(page)).toEqual(restoreCampaign(JSON.stringify(c)));
}

async function reading(page:Page,label:string,points:number) {
  await press(page,new RegExp('^Begin '+label));
  const progress=page.getByRole('progressbar',{name:'Confirmed reading points',exact:true});
  await expect(progress).toHaveAttribute('max',String(points));
  await expect(progress).toHaveAttribute('value','0');
  for(let i=0;i<points;i++){
    await press(page,/^Confirm reading/);
    if(i<points-1)await expect(progress).toHaveAttribute('value',String(i+1));
  }
  await expect(progress).toHaveCount(0);
}

test('canonical instrument-interface fixtures: SuperCam, acquired RIMFAX profile and MOXIE context',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const base=await nativeEnvelope(page),config=structuredClone(base.state.campaign.config);
  const options=structuredClone(base.state.campaign.options),target='jezero-G-1';
  const evidence:Record<string,unknown>={provenance:'Canonical engine-produced instrument-interface fixtures; not native mission or navigation proof.'};
  const fieldPlan={driveHours:1,scienceHours:3,science:true,weather:false,transmit:true};

  // SuperCam: choose the composition method in the actual field interface.
  console.log('[instrument-interface fixture] SuperCam context and remote chemistry');
  let supercam=commitPlan(endSol(createCampaign(options,config)),fieldPlan);
  expect(supercam.mode).toBe('operations');
  await showEngineFixture(page,base,supercam);
  await page.getByRole('group',{name:'Geology composition method',exact:true}).getByRole('button',{name:'SuperCam',exact:true}).click();
  await reading(page,'Mastcam-Z',3);
  const beforeSupercam=await campaign(page);
  await reading(page,'SuperCam',2);
  supercam=await campaign(page);
  expect(supercam.targetMethods?.[target]).toBe('supercam');
  expect(supercam.elapsedHours-beforeSupercam.elapsedHours).toBe(.5);
  const superEntry=supercam.energy.filter(entry=>entry.id===`activity:${target}:supercam`);
  expect(superEntry).toHaveLength(1);
  expect(superEntry[0].requestedWh).toBeCloseTo((config.baselineW+17.9)*.5,8);
  expect(supercam.products.filter(product=>product.id===`${target}:supercam`)).toHaveLength(1);
  expect(supercam.products.find(product=>product.id===`${target}:supercam`)!.bits).toBe(62e6);
  expect(supercam.completed).toContain(`science:${target}`);
  evidence.supercam={campaign:supercam,modeledHours:.5,instrumentPowerW:17.9,dataBits:62e6};

  // RIMFAX: generate actual unique profile cells with exported traverse. Never
  // assign profileMeters/radarKeys, and never credit navigation in this test.
  console.log('[instrument-interface fixture] RIMFAX canonical100m profile review');
  let radar=commitPlan(endSol(createCampaign(options,config)),fieldPlan);
  radar=traverse(radar,100,0,{from:[-118,12],to:[-18,12]});
  expect(radar.profileMeters).toBeCloseTo(100,6);
  expect(radar.driveMeters).toBeCloseTo(100,8);
  expect(radar.radarUnits).toBe(0);
  await showEngineFixture(page,base,radar);
  await page.getByRole('group',{name:'Geology composition method',exact:true}).getByRole('button',{name:'RIMFAX',exact:true}).click();
  await reading(page,'Mastcam-Z',3);
  const beforeReview=await campaign(page);
  await reading(page,'RIMFAX',1);
  radar=await campaign(page);
  expect(radar.targetMethods?.[target]).toBe('rimfax');
  expect(radar.elapsedHours).toBe(beforeReview.elapsedHours);
  expect(radar.scienceSpentHours).toBe(beforeReview.scienceSpentHours);
  expect(radar.energyWh).toBe(beforeReview.energyWh);
  expect(radar.energy).toEqual(beforeReview.energy);
  expect(radar.driveMeters).toBe(beforeReview.driveMeters);
  expect(radar.profileMeters).toBeCloseTo(0,6);
  expect(radar.radarUnits).toBe(1);
  expect(radar.products.filter(product=>product.id===`${target}:rimfax`)).toHaveLength(1);
  expect(radar.products.find(product=>product.id===`${target}:rimfax`)!.bits).toBe(80e6);
  expect(radar.completed).toContain(`science:${target}`);
  evidence.rimfax={input:'Synthetic flat100m canonical traverse with unique profile cells',beforeReview,campaign:radar};

  // MOXIE: the new campaign is configured and forecast through canonical APIs;
  // zero driving and one science hour leave room for the MEDA context duty.
  console.log('[instrument-interface fixture] MOXIE and one MEDA context unit');
  const oxygenConfig:RoverConfig={...config,moxieRun:true};
  let oxygen=commitPlan(createCampaign(options,oxygenConfig),{driveHours:0,scienceHours:1,science:true,weather:true,transmit:true});
  expect(oxygen.mode).toBe('operations');expect(oxygen.safe).toBe(false);
  await showEngineFixture(page,base,oxygen);
  const beforeOxygen=await campaign(page);
  await press(page,'MOXIE');
  expect(await campaign(page)).toEqual(beforeOxygen);
  await press(page,'Compare sensor view');
  expect(await campaign(page)).toEqual(beforeOxygen);
  await press(page,'Confirm environmental record');
  await expect.poll(async()=>(await campaign(page)).completed).toContain('science:moxie:1');
  oxygen=await campaign(page);
  expect(oxygen.elapsedHours).toBeCloseTo(1+FIXED.solHours*.25,8);
  expect(oxygen.scienceSpentHours).toBe(1);
  expect(oxygen.energyWh).toBeLessThan(beforeOxygen.energyWh);
  expect(oxygen.products.map(product=>product.id).sort()).toEqual(['moxie:1:meda','moxie:1:moxie']);
  expect(oxygen.products.find(product=>product.id==='moxie:1:moxie')!.bits).toBe(1e6);
  expect(oxygen.products.find(product=>product.id==='moxie:1:meda')!.bits).toBe(88e6);
  expect(oxygen.energy.filter(entry=>entry.id==='activity:moxie:1:moxie')).toHaveLength(1);
  expect(oxygen.energy.find(entry=>entry.id==='activity:moxie:1:moxie')!.requestedWh).toBe(oxygenConfig.baselineW+300);
  expect(oxygen.energy.filter(entry=>entry.id==='activity:moxie:1:meda')).toHaveLength(1);
  expect(oxygen.energy.find(entry=>entry.id==='activity:moxie:1:meda')!.requestedWh).toBeCloseTo((oxygenConfig.baselineW+17)*FIXED.solHours*.25,8);
  await expect(page.getByRole('button',{name:/^Log weather/})).toBeDisabled();
  await expect(page.getByRole('button',{name:'MOXIE',exact:true})).toBeDisabled();
  await press(page,'Communications');await press(page,'Transmit queued science');
  oxygen=await campaign(page);
  expect(oxygen.products.every(product=>product.sentBits===product.bits)).toBe(true);
  expect(scienceSummary(oxygen).fractions.E).toBe(.1);
  expect(oxygen.products).toHaveLength(2);
  evidence.moxie={campaign:oxygen,oneEnvironmentUnit:true};
  await mkdir('work-logs',{recursive:true});
  await writeFile('work-logs/optional-instruments-interface-fixtures.json',JSON.stringify(evidence,null,2));
  await page.screenshot({path:'work-logs/expedition-screenshots/moxie-interface-fixture.png',fullPage:true});
  expect(errors).toEqual([]);
});
