import{expect,test}from"@playwright/test";
test("eSign enqueue fails closed before authentication when live gate is disabled",async({request})=>{const response=await request.post("/api/workflows/00000000-0000-4000-8000-000000000000/dispatch");expect(response.status()).toBe(503);expect(await response.json()).toMatchObject({error:"eSign enqueue requires an explicit live gate"});});
