"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const handler=require("../api/plan.js");
async function invoke(method,enabled,body){
  let result,status=200;
  const res={setHeader(){return this;},status(c){status=c;return this;},json(v){result=v;return this;},end(){return this;}};
  await handler({method,genieV2Enabled:enabled,headers:{origin:"https://chat.aiinsuregenie.com"},body},res);
  return {status,result};
}
test("planner is unavailable without the Cloudflare-controlled server flag",async()=>{
  assert.equal((await invoke("POST",false,{genie_v2:true,genie_facts:{state:"TX"}})).status,404);
  assert.equal((await invoke("POST",true,{genie_v2:false,genie_facts:{state:"TX"}})).status,404);
  assert.equal((await invoke("GET",true,{})).status,405);
  assert.equal((await invoke("OPTIONS",false,{})).status,200);
});
test("server planner uses explicit facts and skips previously answered questions",async()=>{
  const body={genie_v2:true,genie_facts:{state:"TX",situation:["sr22"],situation_confirmed:true,vehicle_status:"owned",coverage_goal:"minimum",coverage_goal_confirmed:true,urgency:"within_week",email:"private@invalid.example"}};
  const r=await invoke("POST",true,body);
  assert.equal(r.status,200);
  assert.equal(r.result.version,"2.1");
  assert.equal(r.result.complete,true);
  assert.equal(r.result.next.field,null);
  assert.equal(r.result.confirmed.state,"TX");
  assert.doesNotMatch(JSON.stringify(r.result),/private@invalid.example/);
});
test("risk and coverage unknown are never misclassified as confirmed",async()=>{
  const r=await invoke("POST",true,{genie_v2:true,genie_facts:{state:"TX",vehicle_status:"no_vehicle",coverage_goal:"unsure"}});
  assert.equal(r.result.next.field,"situation");
  const confirmed=await invoke("POST",true,{genie_v2:true,genie_facts:{state:"TX",situation_confirmed:true,vehicle_status:"no_vehicle",coverage_goal:"unsure",coverage_goal_confirmed:true,urgency:"later"}});
  assert.equal(confirmed.result.complete,true);
});
