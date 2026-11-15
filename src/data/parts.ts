export type PartCategory = 'chassis'|'mobility'|'battery'|'solar'|'comm'|'computer'|'instrument';
export interface Part { id:string; name:string; category:PartCategory; mass:number; cost:number; unlock:string|null; description:string; slots?:number; durability?:number; capacityWh?:number; area?:number; efficiency?:number; whPerTile?:number; terrainTolerance?:number; downlinkDU?:number; transmitWh?:number; storageDU?:number; ap?:number; whPerSol?:number; hazardBonus?:number; useWh?:number; dataDU?:number; passiveDU?:number; requires?:string; }
export const PARTS:Part[]=[
 {id:'ch_light',name:'Light Chassis',category:'chassis',mass:60,cost:15,unlock:null,description:'Compact starter frame with two instrument bays.',slots:2,durability:0},
 {id:'ch_std',name:'Standard Chassis',category:'chassis',mass:100,cost:25,unlock:'R1',description:'Reinforced general-purpose rover frame.',slots:3,durability:.1},
 {id:'ch_heavy',name:'Heavy Chassis',category:'chassis',mass:150,cost:40,unlock:'R2',description:'High-capacity frame for demanding payloads.',slots:4,durability:.2},
 {id:'mob_wheels',name:'Flight Wheels',category:'mobility',mass:18,cost:8,unlock:null,description:'Lightweight wheels for plains and sand.',whPerTile:30,terrainTolerance:1,durability:0},
 {id:'mob_rb',name:'Rocker-Bogie',category:'mobility',mass:30,cost:18,unlock:'M1',description:'Improved clearance for rocky ground.',whPerTile:25,terrainTolerance:2,durability:.02},
 {id:'mob_rb2',name:'Reinforced Suspension',category:'mobility',mass:42,cost:30,unlock:'M2',description:'Reinforced suspension handles slopes.',whPerTile:25,terrainTolerance:3,durability:.05},
 {id:'bat_s',name:'Compact Battery',category:'battery',mass:5,cost:6,unlock:null,description:'500 Wh rechargeable battery.',capacityWh:500},
 {id:'bat_m',name:'Extended Battery',category:'battery',mass:10,cost:12,unlock:'P1',description:'1000 Wh rechargeable battery.',capacityWh:1000},
 {id:'bat_l',name:'High-Capacity Battery',category:'battery',mass:18,cost:22,unlock:'P2',description:'2000 Wh rechargeable battery.',capacityWh:2000},
 {id:'sol_s',name:'Compact Solar Array',category:'solar',mass:4,cost:6,unlock:null,description:'1.0 m² array · 22% efficiency.',area:1,efficiency:.22},
 {id:'sol_m',name:'Extended Solar Array',category:'solar',mass:7,cost:14,unlock:'P1',description:'2.0 m² array · 25% efficiency.',area:2,efficiency:.25},
 {id:'sol_l',name:'High-Efficiency Array',category:'solar',mass:10,cost:26,unlock:'P2',description:'3.0 m² array · 29% efficiency.',area:3,efficiency:.29},
 {id:'com_lga',name:'Low-Gain Antenna',category:'comm',mass:2,cost:4,unlock:null,description:'Sends up to 2 DU each transmitting sol.',downlinkDU:2,transmitWh:20},
 {id:'com_uhf',name:'UHF Relay Link',category:'comm',mass:3,cost:9,unlock:'C1',description:'Sends up to 5 DU each transmitting sol.',downlinkDU:5,transmitWh:35},
 {id:'com_hga',name:'High-Gain Antenna',category:'comm',mass:5,cost:18,unlock:'C2',description:'Sends up to 10 DU each transmitting sol.',downlinkDU:10,transmitWh:60},
 {id:'cpu_basic',name:'Basic Flight Computer',category:'computer',mass:3,cost:5,unlock:null,description:'3 AP/sol · 10 DU storage.',storageDU:10,ap:3,whPerSol:15},
 {id:'cpu_std',name:'Standard Flight Computer',category:'computer',mass:4,cost:10,unlock:'A1',description:'4 AP/sol · 25 DU storage.',storageDU:25,ap:4,whPerSol:20},
 {id:'cpu_adv',name:'Autonomous Computer',category:'computer',mass:5,cost:20,unlock:'A2',description:'5 AP/sol · 60 DU storage · +10% hazard success.',storageDU:60,ap:5,whPerSol:25,hazardBonus:.1},
 {id:'ins_cam',name:'Panoramic Camera',category:'instrument',mass:2,cost:6,unlock:null,description:'Survey imagery · 30 Wh/use · 1 DU.',useWh:30,dataDU:1},
 {id:'ins_wx',name:'Weather Station',category:'instrument',mass:2,cost:5,unlock:null,description:'Passive climate readings · 1 DU/sol.',whPerSol:10,passiveDU:1},
 {id:'ins_spec',name:'Spectrometer',category:'instrument',mass:3,cost:10,unlock:'S1',description:'Rock composition analysis · 60 Wh/use · 2 DU.',useWh:60,dataDU:2},
 {id:'ins_drill',name:'Core Drill',category:'instrument',mass:8,cost:16,unlock:'S2',description:'Subsurface sample collection · 150 Wh/use · 3 DU.',useWh:150,dataDU:3},
 {id:'ins_gpr',name:'Subsurface Radar',category:'instrument',mass:6,cost:14,unlock:'S3',description:'Ground penetrating survey · 80 Wh/use · 3 DU.',useWh:80,dataDU:3},
 {id:'ins_bio',name:'Biosignature Analyzer',category:'instrument',mass:12,cost:28,unlock:'S4',description:'Sample analysis · requires a drill sample · 200 Wh/use · 5 DU.',useWh:200,dataDU:5,requires:'ins_drill'},
];
export const PART_BY_ID=Object.fromEntries(PARTS.map(p=>[p.id,p])) as Record<string,Part>;
