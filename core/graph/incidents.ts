export type IncidentSeverity='CRITICAL'|'HIGH'|'MEDIUM'|'LOW';
export type IncidentStatus='QUEUED'|'ASSIGNED'|'IN PROGRESS'|'RESOLVED';
export interface Incident { id:string; type:string; locationId:string; severity:IncidentSeverity; priority:number; status:IncidentStatus; affected:number; resource:string; waiting:string }
export const incidents:Incident[]=[
{id:'INC-104',type:'FIRE',locationId:'LOC-007',severity:'CRITICAL',priority:94.2,status:'QUEUED',affected:8,resource:'Fire Service',waiting:'02:41'},
{id:'INC-118',type:'MEDICAL',locationId:'LOC-010',severity:'HIGH',priority:81.6,status:'ASSIGNED',affected:3,resource:'Ambulance',waiting:'01:18'},
{id:'INC-121',type:'TRAFFIC COLLISION',locationId:'LOC-022',severity:'HIGH',priority:76.4,status:'IN PROGRESS',affected:5,resource:'Police + Medical',waiting:'00:47'},
{id:'INC-127',type:'UTILITY FAILURE',locationId:'LOC-019',severity:'MEDIUM',priority:52.8,status:'QUEUED',affected:0,resource:'Utility Response',waiting:'04:03'},
];
