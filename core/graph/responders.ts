export type ResponderStatus='AVAILABLE'|'ASSIGNED'|'EN ROUTE'|'BUSY'|'OFFLINE';
export interface Responder { id:string; type:'FIRE'|'AMBULANCE'|'POLICE'; locationId:string; status:ResponderStatus; targetIncidentId?:string; eta?:string; routeEdgeIds?:string[] }
export const responders:Responder[]=[
{id:'FIRE-UNIT-01',type:'FIRE',locationId:'LOC-003',status:'AVAILABLE'},
{id:'FIRE-UNIT-02',type:'FIRE',locationId:'LOC-004',status:'AVAILABLE'},
{id:'AMB-UNIT-01',type:'AMBULANCE',locationId:'LOC-018',status:'EN ROUTE',targetIncidentId:'INC-118',eta:'04:32',routeEdgeIds:['R-039','R-032','R-027']},
{id:'AMB-UNIT-02',type:'AMBULANCE',locationId:'LOC-023',status:'BUSY',targetIncidentId:'INC-121',eta:'03:18',routeEdgeIds:['R-021','R-020']},
{id:'POLICE-UNIT-01',type:'POLICE',locationId:'LOC-005',status:'EN ROUTE',targetIncidentId:'INC-121',eta:'02:11',routeEdgeIds:['R-004','R-003']},
{id:'POLICE-UNIT-02',type:'POLICE',locationId:'LOC-006',status:'AVAILABLE'},
{id:'FIRE-UNIT-03',type:'FIRE',locationId:'LOC-004',status:'ASSIGNED',targetIncidentId:'INC-104',eta:'04:32',routeEdgeIds:['R-011','R-020']},
];
