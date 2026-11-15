import { test, expect } from '@playwright/test';

test('rover has six axle pivots, correct ground alignment and independent instrument visibility', async ({ page }) => {
  await page.route('**/asset-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto('/asset-test');
  const result = await page.evaluate(async () => {
    const { createRoverModel, INSTRUMENT_NODES } = await import('/src/models/roverModel.ts');
    const { Box3, Vector3 } = await import('/node_modules/three/build/three.module.js');
    const asset = await createRoverModel(['mastcam-z', 'supercam', 'sherloc', 'pixl', 'meda', 'moxie', 'rimfax']);
    const wheels: any[] = [];
    asset.root.traverse((node: any) => { if (node.name.startsWith('ImportedWheel_')) wheels.push(node); });
    const bounds = new Box3().setFromObject(asset.root);
    const size = bounds.getSize(new Vector3());
    const mapped = Object.values(INSTRUMENT_NODES).flat().map((name: any) => !!asset.root.getObjectByName(name));
    asset.setInstruments([]);
    const hidden = Object.values(INSTRUMENT_NODES).flat().every((name: any) => asset.root.getObjectByName(name)?.visible === false);
    const fixed = ['Body', 'NavCams', 'rtg', 'antenna_uhf'].every(name => asset.root.getObjectByName(name)?.visible);
    asset.setInstruments(['pixl']);
    const restored = asset.root.getObjectByName('PIXL')?.visible;
    asset.update(.525, .2, 0, 0);
    const rotations = wheels.map(wheel => [wheel.children[0].rotation.x, wheel.rotation.y]);
    asset.dispose();
    return { count: wheels.length, floor: bounds.min.y, size: size.toArray(), mapped, hidden, fixed, restored, rotations };
  });
  expect(result.count).toBe(6);
  expect(Math.abs(result.floor)).toBeLessThan(.01);
  expect(result.size[1]).toBeGreaterThan(1.8);
  expect(result.size[1]).toBeLessThan(2.5);
  expect(result.mapped.every(Boolean)).toBeTruthy();
  expect(result.hidden && result.fixed && result.restored).toBeTruthy();
  result.rotations.forEach(([roll, steer], i) => {
    expect(roll).toBeCloseTo(2);
    expect(Math.abs(steer)).toBeCloseTo(i % 3 === 1 ? 0 : .2);
  });
});


async function enterWorkshop(page: import('@playwright/test').Page, seat='Kavi') {
  await page.goto('/');
  // This suite isolates the existing game controls; Guided behavior has its own browser suite.
  const skip=page.getByRole('radio',{name:'Skip',exact:true});if(await skip.isVisible())await skip.check();
  await page.getByRole('button',{name:'ENTER MISSION CONTROL'}).click();
  if(seat!=='Kavi')await page.getByRole('button',{name:new RegExp('^'+seat+' ')}).click();
  await page.getByRole('button',{name:'Enter mission control',exact:true}).click();
  await expect(page.getByRole('region',{name:'Science briefing'})).toBeVisible();
  await page.getByRole('button',{name:'Begin workshop',exact:true}).click();
}

test('connected workshop keeps its scene, supports role ownership, previews, and mobile layout',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await enterWorkshop(page,'Aaryan');
  const canvas=page.locator('.crew-room canvas');
  await canvas.evaluate(el=>el.setAttribute('data-scene-identity','original'));
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-status','ready');
  await page.getByRole('button',{name:'Payload workshop YOUR STATION',exact:true}).click();
  await expect(page.getByText('You own this decision.',{exact:true})).toBeVisible();
  const original=await page.evaluate(async()=>JSON.stringify((await import('/src/store/gameStore.ts')).useGameStore.getState().roverConfig));
  await page.getByRole('button',{name:'Inspect SuperCam',exact:true}).click();
  await page.getByLabel('Installed SuperCam',{exact:true}).uncheck();
  expect(await page.evaluate(async()=>JSON.stringify((await import('/src/store/gameStore.ts')).useGameStore.getState().roverConfig))).toBe(original);
  await expect(page.getByText(/Unapplied preview/)).toBeVisible();
  await page.getByRole('button',{name:'Apply changes',exact:true}).click();
  expect(await page.evaluate(async()=>(await import('/src/store/gameStore.ts')).useGameStore.getState().roverConfig.instruments.includes('supercam'))).toBe(false);
  await page.getByLabel('Add SuperCam',{exact:true}).check();
  await page.getByRole('button',{name:'Apply changes',exact:true}).click();
  await page.getByRole('button',{name:'Inspect MOXIE on rover',exact:true}).click();
  await expect(page.getByText(/INTERNAL INSTRUMENT/)).toBeVisible();
  // A removed instrument retains an inspection marker so it can be restored.
  await page.getByLabel('Installed RIMFAX',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Inspect RIMFAX on rover',exact:true}).click();
  await expect(page.getByRole('button',{name:'Inspect RIMFAX',exact:true})).toHaveClass('active');
  await page.getByLabel('Add RIMFAX',{exact:true}).check();
  await page.screenshot({path:'/tmp/ares-hub-payload.png'});
  await page.getByRole('button',{name:'Power station Houssam',exact:true}).click();
  await expect(page.getByRole('button',{name:'Accept proposal',exact:true})).toBeEnabled();
  await page.getByLabel('Proposal priority').selectOption('science');
  await page.getByRole('button',{name:'Take over',exact:true}).click();
  await expect(page.getByText('You have taken over this decision.')).toBeVisible();
  await page.getByLabel('Battery reserve',{exact:true}).selectOption('0.4');
  await page.getByRole('button',{name:'Apply changes',exact:true}).click();
  await page.getByRole('button',{name:'Review mission',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Flight readiness review',exact:true})).toBeVisible();
  await expect(canvas).toHaveAttribute('data-scene-identity','original');
  await page.screenshot({path:'/tmp/ares-hub-review.png'});
  for(const width of [390,820]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await expect(page.getByRole('button',{name:'Approve & launch',exact:true})).toBeVisible();
    if(width===390)await page.screenshot({path:'/tmp/ares-hub-mobile.png'});
  }
  expect(errors).toEqual([]);
});

test('crew proposals update only after acceptance and respond to changed constraints',async({page})=>{
  await enterWorkshop(page);
  await page.getByRole('button',{name:'Power station Houssam',exact:true}).click();
  const before=await page.evaluate(async()=>(await import('/src/store/gameStore.ts')).useGameStore.getState().roverConfig.reserve);
  expect(before).toBe(.2);
  await page.getByRole('button',{name:'Accept proposal',exact:true}).click();
  expect(await page.evaluate(async()=>(await import('/src/store/gameStore.ts')).useGameStore.getState().roverConfig.reserve)).toBe(.4);
  await page.getByRole('button',{name:'Communications Huzaifa',exact:true}).click();
  await page.evaluate(async()=>{const s=(await import('/src/store/gameStore.ts')).useGameStore.getState();s.setRoverConfig({...s.roverConfig,baselineW:950});});
  await expect(page.getByRole('button',{name:'Accept proposal',exact:true})).toBeDisabled();
  await expect(page.getByText(/No safe proposal can preserve/)).toBeVisible();
  await page.getByRole('button',{name:'Review mission',exact:true}).click();
  await expect(page.getByRole('button',{name:'Approve & launch',exact:true})).toBeDisabled();
});

test('hub walking, station navigation, and station closure preserve controls',async({page})=>{
  await enterWorkshop(page);
  const player=page.locator('.room-canvas');
  const initial=Number(await player.getAttribute('data-player-z'));
  await page.keyboard.down('w');
  await expect.poll(async()=>Number(await player.getAttribute('data-player-z'))).toBeLessThan(initial-.3);
  await page.keyboard.up('w');
  await page.getByRole('button',{name:'Walk to Power station',exact:true}).click();
  await expect(page.getByRole('button',{name:'Accept proposal',exact:true})).toBeVisible();
  const position=await player.getAttribute('data-player-x');
  await page.keyboard.down('a');await page.waitForTimeout(200);await page.keyboard.up('a');
  expect(await player.getAttribute('data-player-x')).toBe(position);
  await page.keyboard.press('Escape');
  await expect(page.locator('.hub-panel')).toHaveCount(0);
  await page.keyboard.press('e');
  await expect(page.getByRole('button',{name:'Accept proposal',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close station',exact:true}).click();
  const old=Number(await player.getAttribute('data-player-x'));
  await page.keyboard.down('a');
  await expect.poll(async()=>Number(await player.getAttribute('data-player-x'))).toBeLessThan(old-.2);
  await page.keyboard.up('a');
});

test('hub review launches, rover drives, abort resets home',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await enterWorkshop(page);
  await page.getByRole('button',{name:'Review mission',exact:true}).click();
  await page.getByRole('button',{name:'Approve & launch',exact:true}).click();
  await page.getByRole('button',{name:'BEGIN COUNTDOWN'}).click();
  await page.getByRole('button',{name:'CONFIRM LIFTOFF'}).click();
  await page.getByRole('button',{name:'BEGIN MARS APPROACH'}).click();
  await page.getByRole('button',{name:'DEPLOY ROVER'}).click();
  await expect(page.getByRole('button',{name:'End mission',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Commit sol plan',exact:true}).click();
  await page.keyboard.down('w');
  await page.waitForFunction(async()=>(await import('/src/store/marsStore.ts')).useMarsStore.getState().distance>.1);
  await page.keyboard.up('w');
  await page.getByRole('button',{name:'Abort',exact:true}).click();
  await page.getByRole('button',{name:'Abort mission',exact:true}).click();
  await page.getByRole('button',{name:'Open mission dossier',exact:true}).click();
  await expect(page.getByRole('heading',{name:'MISSION ABORT',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'NEW CAMPAIGN'}).click();
  await expect(page.getByRole('button',{name:'ENTER MISSION CONTROL'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('missing models retain station controls and development reload opens home',async({page})=>{
  await page.route('**/models/**/*.glb',route=>route.abort());
  await enterWorkshop(page,'Houssam');
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-status','fallback');
  await page.getByRole('button',{name:'Power station YOUR STATION',exact:true}).click();
  await expect(page.getByLabel('Battery reserve',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'ENTER MISSION CONTROL'})).toBeVisible();
  expect(await page.evaluate(async()=>(await import('/src/store/gameStore.ts')).useGameStore.getState().preparation.stage)).toBe('entry');
});
