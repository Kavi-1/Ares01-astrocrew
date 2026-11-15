import { DEFAULT_CONFIG, FIXED, INSTRUMENTS, type RoverConfig } from './data';
export const RTG_DECAY_PER_YEAR = Math.log(FIXED.rtgW/FIXED.rtgEodlW)/FIXED.rtgEodlYear;
export const fixedPlatformResidualKg = () => FIXED.massKg-FIXED.rtgKg-FIXED.batteryKg-INSTRUMENTS.reduce((s,i)=>s+i.massKg,0);
export const nominalBatteryWh = () => FIXED.packs*FIXED.batteryAh*FIXED.voltageV;
export const deliveredBatteryWh = (reserve:number) => nominalBatteryWh()*(1-reserve)*Math.sqrt(FIXED.roundTripEfficiency);
export const rtgPowerW = (yearsSinceBol=0) => FIXED.rtgW*Math.exp(-RTG_DECAY_PER_YEAR*yearsSinceBol);
export const solGenerationWh = (yearsSinceBol=0) => rtgPowerW(yearsSinceBol)*FIXED.solHours;
export function calculateEngineering(config:RoverConfig=DEFAULT_CONFIG) {
  const selected=INSTRUMENTS.filter(i=>config.instruments.includes(i.id));
  const massKg=fixedPlatformResidualKg()+FIXED.rtgKg+FIXED.batteryKg+selected.reduce((s,i)=>s+i.massKg,0);
  const activities=selected.filter(i=>i.id!=='moxie'||config.moxieRun);
  const baseWh=config.baselineW*FIXED.solHours;
  // Fourfold cadence is an explicitly assumed educational operating schedule.
  // MOXIE remains one documented ~1 h experiment; other duty times are assumptions.
  const cadence=config.scienceCadence??1;
  const activityWh=activities.reduce((s,i)=>s+i.powerW*i.hours*(i.id==='moxie'?1:cadence),0);
  const genWh=solGenerationWh(), netWh=genWh-baseWh-activityWh;
  const eNominalWh=nominalBatteryWh(), eUsableWh=eNominalWh*(1-config.reserve), eDeliveredWh=eUsableWh*Math.sqrt(FIXED.roundTripEfficiency);
  const peakW=config.baselineW+Math.max(0,...activities.map(i=>i.powerW));
  const dataMbit=selected.reduce((s,i)=>s+(i.dataMbit??0),0);
  const linkMbit=config.downlink==='UHF'?FIXED.uhfBps*FIXED.passS/1e6:FIXED.xbandBps*FIXED.solHours*3600/1e6;
  const issues:string[]=[];
  if(config.instruments.some(id=>!INSTRUMENTS.some(i=>i.id===id))) issues.push('Unsupported instrument selection. Return to Mission Engineering and select only documented M2020 instruments.');
  if(![.2,.3,.4].includes(config.reserve)) issues.push('Battery reserve must use one of the modeled 20%, 30% or 40% policies.');
  if(cadence!==1&&cadence!==4) issues.push('Science cadence must use the standard or extended educational schedule.');
  if(massKg>FIXED.allowanceKg+1e-8) issues.push('Mass exceeds the 1,025 kg flown-mass scenario allowance.');
  if(peakW>FIXED.peakW) issues.push(`Peak load ${peakW.toFixed(1)} W exceeds the documented 900 W peak.`);
  if(config.moxieRun&&!config.instruments.includes('moxie')) issues.push('Enable MOXIE before scheduling its one-hour run.');
  const warnings:string[]=[];
  if(!config.instruments.some(id=>['supercam','pixl','sherloc'].includes(id))) warnings.push('Payload limitation (ARES-01 objective design): none of the selected instruments supports the three geology targets. Mission launch remains possible, but those objectives cannot be performed.');
  if(netWh<0) warnings.push(`Projected routine energy deficit: ${netWh.toFixed(1)} Wh/sol under this assumed activity plan. Launch is allowed, but the reserve may be reached; reduce science cadence or use safe mode.`);
  if(dataMbit>linkMbit) warnings.push('Known instrument data volume exceeds the idealized link capacity; actual data volume or pass availability may differ.');
  if(config.downlink==='X-band') warnings.push('X-band capacity assumes continuous operation at 500 bps; the actual DSN contact duration is unknown.');
  return {massKg,massMarginKg:FIXED.allowanceKg-massKg,eNominalWh,eUsableWh,eDeliveredWh,rtgW:rtgPowerW(),genWh,baseWh,activityWh,netWh,projectedSoc:Math.min(1,Math.max(0,1+netWh/Math.max(1,eNominalWh))),peakW,dataMbit,linkMbit,issues,warnings,selected:config.instruments};
}
export function validateRoverConfig(config:RoverConfig) { return calculateEngineering(config).issues; }
export function driveEnergyWh(distanceM:number,slopeDeg=0,massKg=1025,crr=.15,efficiency=.5) {const slope=slopeDeg*Math.PI/180;const force=massKg*3.73*(crr*Math.cos(slope)+Math.sin(slope));return force*distanceM/3600/efficiency;}
export function convertPowerTimeToWh(powerW:number,hours:number){return powerW*hours}
export function linkCapacityMbit(rateBps:number,seconds:number){return rateBps*seconds/1e6}
export function slopeAngleDeg(riseM:number,runM:number){return Math.atan2(Math.abs(riseM),Math.max(0,Math.abs(runM)))*180/Math.PI}
export const DEFAULT_RESULTS=calculateEngineering();
