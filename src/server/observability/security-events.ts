export const securityEventNames=["provider_budget_denied","dispatch_denied","dispatch_reconcile","webhook_rejected","remote_cleanup_scheduled","artifact_quarantined"]as const;
export type SecurityEventName=(typeof securityEventNames)[number];
export interface SecurityEventSink{emit(event:{name:SecurityEventName;at:string;tenantId?:string;workflowId?:string;reasonCode?:string}):void|Promise<void>}
export class JsonSecurityEventSink implements SecurityEventSink{emit(event:{name:SecurityEventName;at:string;tenantId?:string;workflowId?:string;reasonCode?:string}){process.stdout.write(`${JSON.stringify({schema:"signlatch.security-event.v1",...event})}\n`);}}
export function securityEvent(name:SecurityEventName,data:Omit<Parameters<SecurityEventSink["emit"]>[0],"name"|"at">={}){return{name,at:new Date().toISOString(),...data};}
