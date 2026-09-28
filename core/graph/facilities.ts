import type { LocationType } from './Graph';
export interface Facility { id:string; nodeId:string; name:string; type:LocationType; detail:string; units?:number }
export const facilities:Facility[]=[
{id:'HOSP-01',nodeId:'LOC-001',name:'Central Medical Center',type:'hospital',detail:'Emergency trauma & triage',units:12},
{id:'HOSP-02',nodeId:'LOC-002',name:'Northside Hospital',type:'hospital',detail:'Emergency department',units:8},
{id:'FIRE-01',nodeId:'LOC-003',name:'Central Fire Station',type:'fire',detail:'Engine / rescue response',units:2},
{id:'FIRE-02',nodeId:'LOC-004',name:'East Fire Station',type:'fire',detail:'Engine / ladder response',units:3},
{id:'POL-01',nodeId:'LOC-005',name:'Central Police Station',type:'police',detail:'Patrol & incident control',units:6},
{id:'POL-02',nodeId:'LOC-006',name:'North Police Station',type:'police',detail:'Patrol response',units:4},
{id:'MARKET-01',nodeId:'LOC-007',name:'Central Market',type:'market',detail:'High-footfall commercial zone'},
{id:'MARKET-02',nodeId:'LOC-008',name:'North Market',type:'market',detail:'Commercial district'},
{id:'SCHOOL-01',nodeId:'LOC-009',name:'Central School',type:'school',detail:'Education facility'},
{id:'SCHOOL-02',nodeId:'LOC-010',name:'East School',type:'school',detail:'Education facility'},
{id:'SHELTER-01',nodeId:'LOC-012',name:'Civic Shelter A',type:'shelter',detail:'Emergency evacuation shelter',units:180},
{id:'SHELTER-02',nodeId:'LOC-013',name:'Civic Shelter B',type:'shelter',detail:'Emergency evacuation shelter',units:140},
{id:'AMB-01',nodeId:'LOC-018',name:'Ambulance Base A',type:'transport',detail:'Rapid medical response',units:3},
{id:'AMB-02',nodeId:'LOC-023',name:'Ambulance Base B',type:'transport',detail:'Rapid medical response',units:2},
{id:'TOWN-01',nodeId:'LOC-017',name:'Crisis City Hall',type:'civic',detail:'Municipal emergency coordination'},
{id:'UNI-01',nodeId:'LOC-011',name:'Crisis City University',type:'school',detail:'University district'},
{id:'BUS-01',nodeId:'LOC-018',name:'Central Bus Terminal',type:'transport',detail:'Public transit interchange'},
{id:'RAIL-01',nodeId:'LOC-021',name:'North Railway Station',type:'transport',detail:'Rail interchange'},
{id:'IND-01',nodeId:'LOC-019',name:'Industrial Zone',type:'industrial',detail:'Heavy logistics district'},
];
