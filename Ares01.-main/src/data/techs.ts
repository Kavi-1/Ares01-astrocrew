export interface Tech {id:string;branch:string;name:string;cost:number;prereq:string[];unlocks:string[];description:string;optional?:boolean;}
export const TECHS:Tech[]=[
 {id:'L1',branch:'Launch',name:'Medium Launcher',cost:20,prereq:[],unlocks:['lv_medium'],description:'Unlocks a 300 kg launch vehicle.'},
 {id:'L2',branch:'Launch',name:'Heavy Launcher',cost:50,prereq:['L1'],unlocks:['lv_heavy'],description:'Unlocks a 500 kg launch vehicle.',optional:true},
 {id:'D1',branch:'Landing',name:'Chute + Retro Landing',cost:15,prereq:[],unlocks:['+0.10 EDL'],description:'Improves landing reliability by 10%.'},
 {id:'D2',branch:'Landing',name:'Powered Descent',cost:45,prereq:['D1'],unlocks:['+0.20 EDL'],description:'Replaces D1 with a 20% landing bonus.'},
 {id:'R1',branch:'Structures',name:'Standard Chassis',cost:20,prereq:[],unlocks:['ch_std'],description:'Unlocks a 3-slot standard rover chassis.'},
 {id:'R2',branch:'Structures',name:'Heavy Chassis',cost:45,prereq:['R1'],unlocks:['ch_heavy'],description:'Unlocks a durable 4-slot chassis.',optional:true},
 {id:'M1',branch:'Mobility',name:'Rocker-Bogie Suspension',cost:15,prereq:[],unlocks:['mob_rb'],description:'Unlocks rock-capable suspension.'},
 {id:'M2',branch:'Mobility',name:'Reinforced Suspension',cost:40,prereq:['M1'],unlocks:['mob_rb2'],description:'Unlocks slope-rated suspension.'},
 {id:'P1',branch:'Power',name:'Improved Power',cost:15,prereq:[],unlocks:['bat_m','sol_m'],description:'Unlocks an extended battery and solar array.'},
 {id:'P2',branch:'Power',name:'High-Efficiency Power',cost:40,prereq:['P1'],unlocks:['bat_l','sol_l'],description:'Unlocks high-capacity power systems.',optional:true},
 {id:'C1',branch:'Comms',name:'UHF Relay Link',cost:15,prereq:[],unlocks:['com_uhf'],description:'Unlocks a higher-throughput antenna.'},
 {id:'C2',branch:'Comms',name:'High-Gain Antenna',cost:35,prereq:['C1'],unlocks:['com_hga'],description:'Unlocks a 10 DU/sol antenna.'},
 {id:'S1',branch:'Science',name:'Spectrometry',cost:10,prereq:[],unlocks:['ins_spec'],description:'Unlocks the spectrometer.'},
 {id:'S2',branch:'Science',name:'Drilling',cost:30,prereq:['S1'],unlocks:['ins_drill'],description:'Unlocks the core drill.'},
 {id:'S3',branch:'Science',name:'Subsurface Radar',cost:35,prereq:['S1'],unlocks:['ins_gpr'],description:'Unlocks ground penetrating radar.',optional:true},
 {id:'S4',branch:'Science',name:'Biosignature Analysis',cost:60,prereq:['S2'],unlocks:['ins_bio'],description:'Unlocks biosignature analysis.'},
 {id:'A1',branch:'Computing',name:'Standard Flight Computer',cost:15,prereq:[],unlocks:['cpu_std'],description:'Unlocks a computer with more AP and storage.'},
 {id:'A2',branch:'Computing',name:'Hazard-Avoidance Autonomy',cost:40,prereq:['A1'],unlocks:['cpu_adv'],description:'Unlocks an autonomous computer with improved hazard success.'},
 {id:'G1',branch:'Management',name:'Ops Training',cost:25,prereq:[],unlocks:['+3% ops bonus cap'],description:'Raises the operations bonus cap from 5% to 8%.'},
 {id:'G2',branch:'Management',name:'Reliability Engineering',cost:30,prereq:[],unlocks:['+0.03 launch reliability','−20% surface fault chance'],description:'Improves launch reliability and reduces surface fault risk.'},
];
export const TECH_BY_ID=Object.fromEntries(TECHS.map(t=>[t.id,t])) as Record<string,Tech>;
