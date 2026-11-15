export interface Vehicle {id:string;name:string;payload:number;cost:number;reliability:number;unlock:string|null;}
export const VEHICLES:Vehicle[]=[
 {id:'lv_light',name:'Light Launcher',payload:150,cost:30,reliability:.9,unlock:null},
 {id:'lv_medium',name:'Medium Launcher',payload:300,cost:60,reliability:.93,unlock:'L1'},
 {id:'lv_heavy',name:'Heavy Launcher',payload:500,cost:110,reliability:.95,unlock:'L2'},
];
export const VEHICLE_BY_ID=Object.fromEntries(VEHICLES.map(v=>[v.id,v])) as Record<string,Vehicle>;
