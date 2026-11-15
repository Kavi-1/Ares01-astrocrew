/** NASA/JPL-derived Mars 2020 reference data. Status is carried with each datum. */
export type DataStatus = 'DOC' | 'CALC' | 'ASSUMED' | 'UNKNOWN';
export type InstrumentId = 'mastcam-z'|'supercam'|'sherloc'|'pixl'|'meda'|'moxie'|'rimfax';
export type Instrument = { id: InstrumentId; name: string; massKg: number; powerW: number; hours: number; mount: 'mast'|'arm'|'internal'|'rear'; detail: string; dataMbit?: number };
export const SOURCES = [
  {id:'S1',label:'JPL Mars 2020 launch press kit — Power',url:'https://www.jpl.nasa.gov/news/press_kits/mars_2020/launch/mission/spacecraft/power/'},
  {id:'S2',label:'JPL Mars 2020 Quick Facts',url:'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/quick_facts/'},
  {id:'S3',label:'NASA Science — Perseverance science instruments',url:'https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/'},
  {id:'S4',label:'NASA Science — Perseverance rover components',url:'https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/'},
  {id:'S5',label:'NASA Science — Updated Perseverance driving limit (2026)',url:'https://science.nasa.gov/blog/tracks-along-the-longest-drive-on-another-world/'},
] as const;
export const INSTRUMENTS: Instrument[] = [
  {id:'mastcam-z',name:'Mastcam-Z',massKg:4,powerW:17.4,hours:.5,mount:'mast',detail:'Stereo zoom imaging · 148 Mbit/sol average',dataMbit:148},
  {id:'supercam',name:'SuperCam',massKg:10.6,powerW:17.9,hours:.5,mount:'mast',detail:'Remote chemistry and mineralogy · 15.5 Mbit/experiment',dataMbit:15.5},
  {id:'sherloc',name:'SHERLOC',massKg:4.72,powerW:48.8,hours:1,mount:'arm',detail:'Fine-scale organic and mineral mapping',dataMbit:79.7},
  {id:'pixl',name:'PIXL',massKg:6.915,powerW:25,hours:2,mount:'arm',detail:'X-ray fluorescence elemental mapping · ~16 Mbit/experiment',dataMbit:16},
  {id:'meda',name:'MEDA',massKg:5.5,powerW:17,hours:24.6597*.25,mount:'mast',detail:'Weather and dust · 25% duty cycle is assumed'},
  {id:'moxie',name:'MOXIE',massKg:17.1,powerW:300,hours:1,mount:'internal',detail:'Oxygen production demonstration · ~1 hour per run',dataMbit:0},
  {id:'rimfax',name:'RIMFAX',massKg:3,powerW:10,hours:.661,mount:'rear',detail:'Ground penetrating radar · 3 kg upper bound; 10 W in 5–10 W published range'},
];
export const DEFAULT_INSTRUMENTS: InstrumentId[] = INSTRUMENTS.map(i=>i.id);
export const FIXED = {platform:'Mars 2020 · Perseverance',massKg:1025,rtgKg:45,batteryKg:26.5,batteryAh:43,packs:2,voltageV:28,rtgW:110,rtgEodlW:72,rtgEodlYear:17,solHours:88775/3600,wheelDiameterM:.525,driveSpeedMps:.042,wheels:6,obstacleM:.4,slopeLimitDeg:24,peakW:900,allowanceKg:1025,baseW:75,reserve:.2,roundTripEfficiency:.9,uhfBps:2_000_000,passS:480,xbandBps:500} as const;
export type RoverConfig = { instruments: InstrumentId[]; reserve: .2|.3|.4; baselineW: number; downlink:'UHF'|'X-band'; moxieRun:boolean; scienceCadence:1|4 };
export const DEFAULT_CONFIG: RoverConfig = {instruments:DEFAULT_INSTRUMENTS,reserve:.2,baselineW:75,downlink:'UHF',moxieRun:false,scienceCadence:1};
