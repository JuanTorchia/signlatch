import type { FoxitLifecycle } from "./foxit-webhook";
const rank:Record<FoxitLifecycle,number>={created:0,sent:1,viewed:2,completed:3,declined:3,cancelled:3};
export function nextLifecycle(current:FoxitLifecycle,event:FoxitLifecycle):FoxitLifecycle {if(rank[event]<rank[current]) return current; if(rank[current]===3&&event!==current) return current; return event;}
