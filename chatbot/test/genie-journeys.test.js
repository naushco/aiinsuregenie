import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteIntent,hasConfirmedDetails,reviewProfile,profileReady,qualificationSummary,safeAttribution,safeJourney } from "../src/genie-journeys.js";
const base={st:"TX",sitDone:true,sits:["dui","lapse"],vehicleStatus:"no_vehicle",cov:"unsure",when:"today",pri:"price"};
test("quote intent requires deliberate purchase/quoting language, not education",()=>{
 for(const q of ["Get my quote","I need an auto insurance quote","I want to buy car insurance","Show me quotes","I need car insurance today"]) assert.equal(quoteIntent(q),true,q);
 for(const q of ["What is a quote?","How do insurance quotes work?","Suppose I get a quote","Can someone get quotes after DUI?","What if I have a DUI?"]) assert.equal(quoteIntent(q),false,q);
});
test("inferred facts never count as confirmed quote-ready details",()=>{
 assert.equal(hasConfirmedDetails({}),false);
 assert.equal(hasConfirmedDetails({st:"TX"}),true);
 assert.equal(profileReady({st:"TX",sitDone:true,sits:["none"],vehicleStatus:"no_vehicle",cov:"unsure"}),false);
 assert.equal(profileReady(base),true);
 assert.equal(profileReady({...base,vehicleStatus:"owned"}),false);
 assert.equal(profileReady({...base,vehicleStatus:"owned",make:"Toyota",year:"2022"}),true);
 assert.equal(profileReady({...base,vehicleStatus:"owned",make:"Toyota",year:"2022"},x=>x==="Toyota"),false);
});
test("review shows only confirmed structured information and distinguishes missing",()=>{
 const rows=reviewProfile(base,code=>code==="TX"?"Texas":code);
 assert.equal(rows.find(x=>x.key==="st").value,"Texas");
 assert.match(rows.find(x=>x.key==="sits").value,/DUI/);
 assert.equal(rows.find(x=>x.key==="vehicleStatus").value,"Non-owner coverage");
 assert.equal(rows.find(x=>x.key==="car").value,"Not applicable");
 assert.equal(rows.find(x=>x.key==="when").value,"Today");
 assert.equal(rows.find(x=>x.key==="cov").value,"Not sure yet");
 const empty=reviewProfile({st:"TX",sitDone:false,sits:[]});
 assert.equal(empty.find(x=>x.key==="sits").ready,false);
 assert.equal(empty.find(x=>x.key==="when").value,null);
 assert.doesNotMatch(JSON.stringify(rows),/email|phone|address|John/i);
});
test("first-party attribution is allowlisted, trimmed, and retains safe values across navigation",()=>{
 const original=safeAttribution("?utm_source=meta&utm_campaign=SR22_2026&pub=affiliate22&fbclid=XYZ123&email=test%40example.com&name=John&custom=secret&subid=pub987");
 assert.deepEqual(original,{utm_source:"meta",utm_campaign:"SR22_2026",pub:"affiliate22",subid:"pub987",fbclid:"XYZ123"});
 assert.deepEqual(safeAttribution("",original),original);
 assert.deepEqual(safeAttribution("?utm_source=google&gclid=123abc",original),{...original,utm_source:"google",gclid:"123abc"});
 assert.deepEqual(safeAttribution("?utm_source=meta",original,true),{});
 assert.equal(safeJourney("advisor","quote"),"quote");
 assert.equal(safeJourney("quote","unexpected"),"quote");
});

test("qualification completeness is not a price or eligibility score",()=>{
 const ready=qualificationSummary(base);
 assert.equal(ready.ready,true);
 assert.equal(ready.confirmed_count,5);
 assert.equal(ready.required_count,5);
 assert.deepEqual(ready.missing_fields,[]);
 assert.deepEqual(ready.situation,["dui","lapse"]);
 assert.equal(ready.buyer_routing,"not_configured");
 assert.equal(Object.hasOwn(ready,"premium"),false);
 assert.equal(Object.hasOwn(ready,"lead_value"),false);
 const partial=qualificationSummary({st:"TX",sitDone:false,sits:[],vehicleStatus:"owned",cov:"min"});
 assert.equal(partial.ready,false);
 assert.ok(partial.missing_fields.includes("sits"));
 assert.ok(partial.missing_fields.includes("when"));
 assert.ok(partial.missing_fields.includes("car"));
});
import { statedPart } from "../src/genie-journeys.js";
test("questions are not personal facts; statements are (Genie 2.3)",()=>{
 for(const q of ["How long do I need an SR-22 in Texas?","How long do I need an SR-22 in Texas and how much does filing cost?","What happens if I have a DUI?","Do I need full coverage?"]) assert.equal(statedPart(q),"",q);
 assert.match(statedPart("I live in Texas, got a DUI and my insurance lapsed last month. What should I do?"),/Texas/);
 assert.doesNotMatch(statedPart("I live in Texas, got a DUI and my insurance lapsed last month. What should I do?"),/What should/);
 assert.notEqual(statedPart("Texas, 2019 Camry, DUI, need SR-22"),"");
 assert.equal(statedPart("If I got a DUI would I need an SR-22?"),"");
});
test("coverage label matches the button the visitor tapped",()=>{
 assert.equal(reviewProfile({cov:"full"}).find(r=>r.key==="cov").value,"Full coverage");
});
