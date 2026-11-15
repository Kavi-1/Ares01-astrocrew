export interface Site {id:string;name:string;edlSafety:number;solar:number;terrain:string;pois:string;}
export const SITES:Site[]=[
 {id:'plains',name:'Plains Site',edlSafety:.1,solar:1,terrain:'Mostly open plains and sand',pois:'3 rock outcrops · weather-friendly open ground'},
 {id:'delta',name:'Delta Site',edlSafety:0,solar:.95,terrain:'Plains with scattered rock fields',pois:'2 rock outcrops · drill sample · subsurface ice'},
 {id:'canyon',name:'Canyon Site',edlSafety:-.1,solar:.85,terrain:'Rock fields and steep slopes',pois:'2 rock outcrops · drill sample · ice · lakebed'},
];
export const SITE_BY_ID=Object.fromEntries(SITES.map(s=>[s.id,s])) as Record<string,Site>;
