import {test} from "node:test";
import assert from "node:assert/strict";
import {confirmedFacts,localStage,stageFromPlan,candidateToWizard,candidateDescription} from "../src/genie-flow.js";

const models=make=>make==="Toyota";
test("Genie 2.1 asks only missing verified fields and respects non-owner coverage",()=>{
  assert.equal(localStage({},models),"state");
  assert.equal(localStage({st:"TX"},models),"sit");
  assert.equal(localStage({st:"TX",sitDone:true,sits:["none"]},models),"vehicle");
  const noCar={st:"TX",sitDone:true,sits:["none"],vehicleStatus:"no_vehicle"};
  assert.equal(localStage(noCar,models),"cov");
  assert.equal(localStage({...noCar,cov:"unsure"},models),"when");
  assert.equal(localStage({...noCar,cov:"unsure",when:"compare"},models),"done");
  const facts=confirmedFacts({...noCar,cov:"unsure",when:"compare"});
  assert.equal(facts.situation_confirmed,true);
  assert.deepEqual(facts.situation,[]);
  assert.equal(facts.vehicle_status,"no_vehicle");
  assert.equal(facts.coverage_goal_confirmed,true);
  assert.equal(facts.urgency,"later");
});
test("vehicle-owner asks relevant car details and not a duplicate state question",()=>{
  const s={st:"TX",sits:["sr22"],sitDone:true,vehicleStatus:"owned"};
  assert.equal(localStage(s,models),"make");
  assert.equal(localStage({...s,make:"Toyota"},models),"model");
  assert.equal(localStage({...s,make:"Toyota",model:"Corolla"},models),"year");
  assert.equal(localStage({...s,make:"Toyota",model:"Corolla",year:"2022"},models),"cov");
  assert.equal(stageFromPlan({...s,make:"Toyota",model:"Corolla",year:"2022"},{field:"coverage_goal",complete:false},models),"cov");
});
test("a verified backend plan can correct the local question selection",()=>{
  const done={st:"TX",sitDone:true,sits:["none"],vehicleStatus:"no_vehicle",cov:"min",when:"today"};
  assert.equal(localStage(done,models),"done");
  assert.equal(stageFromPlan(done,{field:"situation",complete:false},models),"sit");
  assert.equal(stageFromPlan(done,{field:null,complete:true},models),"done");
  assert.equal(stageFromPlan(done,null,models),"done");
});
test("backend candidate facts are mapped to pending UI facts, not confirmed profile",()=>{
  const s={st:"",sits:[],sitDone:false,when:""};
  const pending=candidateToWizard({state:"TX",situation:["sr22","coverage_lapse"],urgency:"within_week",goal:["lower_price"],email:"private@example.test"},s);
  assert.deepEqual(pending,{st:"TX",sits:["sr22","lapse"],sitDone:true,when:"week",pri:"price"});
  assert.equal(confirmedFacts(s).state,null);
  assert.equal(confirmedFacts(s).situation_confirmed,false);
  assert.doesNotMatch(JSON.stringify(pending),/private@example.test/);
  assert.match(candidateDescription(pending,{TX:"Texas"}),/Texas/);
});
test("empty candidate and unsupported risk do not invent a DUI or vehicle",()=>{
  assert.deepEqual(candidateToWizard({situation:["fr44"]},{sits:[],sitDone:false}),{});
  assert.deepEqual(candidateToWizard({},{st:"",sits:[],sitDone:false}),{});
  const facts=confirmedFacts({st:"TX",sits:["sr22"],sitDone:true});
  assert.deepEqual(facts.situation,["sr22"]);
  assert.equal(facts.vehicle_status,"unknown");
  assert.equal(facts.urgency,"unknown");
});
