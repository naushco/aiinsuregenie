import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteIntent,hasConfirmedDetails,reviewProfile,profileReady,safeAttribution,safeJourney } from "../src/genie-journeys.js";
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
