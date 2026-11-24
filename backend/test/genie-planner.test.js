"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { nextQuestion } = require("../lib/genie-planner");
test("state first, then driving situation, vehicle, coverage, urgency",()=>{
  assert.equal(nextQuestion({}).field,"state");
  assert.equal(nextQuestion({state:"TX"}).field,"situation");
  assert.equal(nextQuestion({state:"TX",situation_confirmed:true}).field,"vehicle_status");
  assert.equal(nextQuestion({state:"TX",situation_confirmed:true,vehicle_status:"no_vehicle"}).field,"coverage_goal");
  assert.equal(nextQuestion({state:"TX",situation_confirmed:true,vehicle_status:"no_vehicle",coverage_goal:"unsure",coverage_goal_confirmed:true}).field,"urgency");
});
test("explicitly confirmed none or unsure are accepted, never inferred",()=>{
  const f={state:"TX",situation:[],situation_confirmed:true,vehicle_status:"no_vehicle",coverage_goal:"unsure",coverage_goal_confirmed:true,urgency:"today"};
  assert.equal(nextQuestion(f).complete,true);
  delete f.coverage_goal_confirmed;
  assert.equal(nextQuestion(f).field,"coverage_goal");
});
test("requires explicit risk confirmation instead of assuming clean record",()=>{
  assert.equal(nextQuestion({state:"TX",urgency:"today",vehicle_status:"owned",coverage_goal:"full"}).field,"situation");
});
test("allows buyer-specific required question sets without modifying general defaults",()=>{
  assert.equal(nextQuestion({state:"TX"},{required:["state","coverage_goal"]}).field,"coverage_goal");
});
test("complete only with confirmed required fields",()=>{
  assert.equal(nextQuestion({state:"TX",situation:["sr22"],urgency:"today",vehicle_status:"owned",coverage_goal:"minimum"}).complete,true);
});
