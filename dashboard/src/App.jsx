import { useState, useEffect, useRef } from "react";

var STORAGE_KEY = "aiinsuregenie-partners-v3";
var SHARED = true; // Both dashboard and chatbot read from this

var DEFAULT_PARTNERS = [
  {id:"p1",name:"Super Budget Insurance",logo:"🧞",badge:"BEST VALUE",bc:"#0074D4",rating:4.5,payout:6.00,link:"https://superbudgetinsurance.com",enabled:true,leads:1247,revenue:7482,cr:6.9, priority:3,boost:0,pinned:false,featured:false,customTag:"",features:"Snapshot discount, Name Your Price, Multi-car discount",bestFor:"budget"},
  {id:"p2",name:"QuoteWizard",logo:"🔮",badge:"TOP MATCH",bc:"#6D28D9",rating:4.4,payout:10.00,link:"https://auto.quotewizard.com",enabled:true,leads:834,revenue:8340,cr:8.2, priority:1,boost:0,pinned:false,featured:false,customTag:"",features:"Fast comparison, 10+ carriers, Best rate guarantee",bestFor:"comparison"},
  {id:"p3",name:"LendingTree",logo:"🌳",badge:"PREMIUM",bc:"#059669",rating:4.6,payout:15.00,link:"https://lendingtree.com/auto",enabled:true,leads:621,revenue:9315,cr:12.1, priority:2,boost:0,pinned:false,featured:false,customTag:"",features:"Multiple offers, Trusted brand, Easy comparison",bestFor:"comprehensive"},
  {id:"p4",name:"Value Seeker",logo:"🔍",badge:"SAVINGS",bc:"#D97706",rating:3.9,payout:2.50,link:"https://value-seeker.com",enabled:false,leads:156,revenue:390,cr:1.2, priority:5,boost:0,pinned:false,featured:false,customTag:"",features:"Budget options, State minimum rates",bestFor:"budget"},
  {id:"p5",name:"Solvant Auto",logo:"🚗",badge:"FAST QUOTE",bc:"#DC2626",rating:4.1,payout:4.00,link:"https://solvantauto.com",enabled:true,leads:934,revenue:3736,cr:4.8, priority:4,boost:0,pinned:false,featured:false,customTag:"",features:"Quick quotes, Instant coverage, Affordable",bestFor:"quick"},
  {id:"p6",name:"SmartFinancial",logo:"💡",badge:"HIGHEST PAY",bc:"#0891B2",rating:4.7,payout:12.00,link:"https://smartfinancial.com",enabled:false,leads:0,revenue:0,cr:0, priority:2,boost:0,pinned:false,featured:false,customTag:"",features:"Top rates, Premium service, Smart matching",bestFor:"service"},
];

function EditModal({partner, onSave, onClose}) {
  var [form, setForm] = useState(Object.assign({priority:3,boost:0,pinned:false,featured:false,customTag:"",features:"",bestFor:"budget"}, partner));
  var [tab, setTab] = useState("basic");
  var update = function(field, val) { setForm(function(f) { var n = Object.assign({}, f); n[field] = val; return n; }); };
  var labelSt = {fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5};
  var inputSt = {width:"100%",padding:"10px 12px",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  var tabBtnSt = function(active) { return {padding:"7px 14px",borderRadius:8,border:"none",background:active?"#0F172A":"transparent",color:active?"#FFF":"#94A3B8",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}; };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.6)",backdropFilter:"blur(4px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#FFF",borderRadius:16,maxWidth:520,width:"100%",boxShadow:"0 25px 60px rgba(0,0,0,.2)",overflow:"hidden",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:700,color:"#0F172A"}}>{form.logo} Edit Partner</div>
          <button onClick={onClose} style={{background:"#F1F5F9",border:"none",borderRadius:8,width:32,height:32,fontSize:16,cursor:"pointer",color:"#64748B"}}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{padding:"10px 24px",display:"flex",gap:4,borderBottom:"1px solid #F1F5F9",background:"#F8FAFC",flexShrink:0}}>
          {[["basic","Basic Info"],["promote","Promote & Boost"],["display","Display & Features"]].map(function(t) {
            return <button key={t[0]} onClick={function(){setTab(t[0]);}} style={tabBtnSt(tab===t[0])}>{t[1]}</button>;
          })}
        </div>

        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto",flex:1}}>

          {/* BASIC TAB */}
          {tab === "basic" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><label style={labelSt}>Partner Name</label><input value={form.name} onChange={function(e){update("name",e.target.value);}} style={inputSt} /></div>
                <div><label style={labelSt}>Badge Text</label><input value={form.badge} onChange={function(e){update("badge",e.target.value);}} style={inputSt} /></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><label style={labelSt}>Logo Emoji</label><input value={form.logo} onChange={function(e){update("logo",e.target.value);}} style={inputSt} /></div>
                <div>
                  <label style={labelSt}>Brand Color</label>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input type="color" value={form.bc} onChange={function(e){update("bc",e.target.value);}} style={{width:40,height:40,border:"none",borderRadius:8,cursor:"pointer",padding:0}} />
                    <input value={form.bc} onChange={function(e){update("bc",e.target.value);}} style={Object.assign({},inputSt,{flex:1,width:"auto",fontFamily:"monospace",fontSize:13})} />
                  </div>
                </div>
              </div>
              <div><label style={labelSt}>Redirect / Quote Link</label><input value={form.link} onChange={function(e){update("link",e.target.value);}} placeholder="https://..." style={Object.assign({},inputSt,{fontSize:13})} /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><label style={labelSt}>CPL Payout ($)</label><input type="number" step="0.50" value={form.payout} onChange={function(e){update("payout",parseFloat(e.target.value)||0);}} style={inputSt} /></div>
                <div><label style={labelSt}>Rating (1-5)</label><input type="number" step="0.1" min="1" max="5" value={form.rating} onChange={function(e){update("rating",parseFloat(e.target.value)||4);}} style={inputSt} /></div>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 0"}}>
                <input type="checkbox" checked={form.enabled} onChange={function(e){update("enabled",e.target.checked);}} style={{width:18,height:18,accentColor:"#0EA5E9"}} />
                <span style={{fontSize:14,fontWeight:600,color:form.enabled?"#059669":"#94A3B8"}}>{form.enabled ? "Enabled — Receiving Leads" : "Disabled — Paused"}</span>
              </label>
            </div>
          )}

          {/* PROMOTE TAB */}
          {tab === "promote" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Priority */}
              <div>
                <label style={labelSt}>Priority (1 = shown first, 5 = shown last)</label>
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  {[1,2,3,4,5].map(function(n) {
                    return <button key={n} onClick={function(){update("priority",n);}} style={{width:44,height:44,borderRadius:10,border:form.priority===n?"2px solid #0EA5E9":"1.5px solid #E2E8F0",background:form.priority===n?"#EFF6FF":"#FFF",color:form.priority===n?"#0EA5E9":"#64748B",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>{n}</button>;
                  })}
                </div>
                <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>Lower number = higher position in chatbot results</div>
              </div>

              {/* Boost */}
              <div>
                <label style={labelSt}>Boost Score (+0 to +50)</label>
                <input type="range" min="0" max="50" value={form.boost||0} onChange={function(e){update("boost",parseInt(e.target.value));}} style={{width:"100%",accentColor:"#0EA5E9"}} />
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{fontSize:11,color:"#94A3B8"}}>No boost</span>
                  <span style={{fontSize:14,fontWeight:700,color:form.boost>0?"#0EA5E9":"#94A3B8",fontFamily:"'JetBrains Mono',monospace"}}>+{form.boost||0}</span>
                  <span style={{fontSize:11,color:"#94A3B8"}}>Max boost</span>
                </div>
                <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>Adds extra score to push this partner higher in matching algorithm</div>
              </div>

              {/* Pin to Top */}
              <div style={{background:"#F0F9FF",border:"1.5px solid #BAE6FD",borderRadius:12,padding:14}}>
                <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.pinned||false} onChange={function(e){update("pinned",e.target.checked);}} style={{width:20,height:20,accentColor:"#0EA5E9"}} />
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#0369A1"}}>📌 Pin to #1 Position</div>
                    <div style={{fontSize:11,color:"#0369A1",opacity:.7,marginTop:2}}>Always show this partner as the first card. Overrides priority & scoring.</div>
                  </div>
                </label>
              </div>

              {/* Featured Highlight */}
              <div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:12,padding:14}}>
                <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.featured||false} onChange={function(e){update("featured",e.target.checked);}} style={{width:20,height:20,accentColor:"#D97706"}} />
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#92400E"}}>⭐ Featured Partner</div>
                    <div style={{fontSize:11,color:"#92400E",opacity:.7,marginTop:2}}>Adds a gold "RECOMMENDED" highlight border + badge on the card.</div>
                  </div>
                </label>
              </div>

              {/* Custom Tag */}
              <div>
                <label style={labelSt}>Custom Promotion Tag (shown on card)</label>
                <input value={form.customTag||""} onChange={function(e){update("customTag",e.target.value);}} placeholder="e.g. BEST FOR YOU, #1 PICK, EDITOR'S CHOICE, MOST POPULAR" style={inputSt} />
                <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                  {["BEST FOR YOU","#1 PICK","MOST POPULAR","RECOMMENDED","EDITOR'S CHOICE","TRENDING"].map(function(tag) {
                    return <button key={tag} onClick={function(){update("customTag",tag);}} style={{padding:"4px 10px",borderRadius:14,border:form.customTag===tag?"1.5px solid #0EA5E9":"1px solid #E2E8F0",background:form.customTag===tag?"#EFF6FF":"#FFF",color:form.customTag===tag?"#0EA5E9":"#94A3B8",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{tag}</button>;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* DISPLAY TAB */}
          {tab === "display" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={labelSt}>Features (comma-separated, shown as bullet points on card)</label>
                <input value={form.features||""} onChange={function(e){update("features",e.target.value);}} placeholder="e.g. Fast quotes, Military discount, Bundle savings" style={inputSt} />
                <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
                  {(form.features||"").split(",").filter(Boolean).map(function(f,i) {
                    return <div key={i} style={{fontSize:12,color:"#374151",display:"flex",alignItems:"center",gap:4}}><span style={{color:form.bc,fontWeight:700}}>✓</span>{f.trim()}</div>;
                  })}
                </div>
              </div>
              <div>
                <label style={labelSt}>Best For Category</label>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {["budget","comparison","comprehensive","service","quick","military","high-risk","young","family","digital"].map(function(cat) {
                    return <button key={cat} onClick={function(){update("bestFor",cat);}} style={{padding:"6px 12px",borderRadius:16,border:form.bestFor===cat?"2px solid #0EA5E9":"1.5px solid #E2E8F0",background:form.bestFor===cat?"#EFF6FF":"#FFF",color:form.bestFor===cat?"#0EA5E9":"#64748B",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize"}}>{cat}</button>;
                  })}
                </div>
                <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>Affects smart matching — this partner shows higher when user's priority matches this category</div>
              </div>

              {/* Live Card Preview */}
              <div>
                <label style={labelSt}>Live Card Preview</label>
                <div style={{background:"#F8FAFC",borderRadius:12,padding:16,border:"1px solid #E2E8F0"}}>
                  <div style={{maxWidth:260}}>
                    <div style={{background:"#FFF",borderRadius:12,overflow:"hidden",border:form.featured?"2px solid #F59E0B":"1px solid #E5E7EB",boxShadow:form.featured?"0 4px 20px rgba(245,158,11,.2)":"0 1px 4px rgba(0,0,0,.04)",position:"relative"}}>
                      {(form.customTag || form.featured) && (
                        <div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",background:form.featured?"linear-gradient(135deg,#F59E0B,#EF4444)":"#0EA5E9",color:"#FFF",fontSize:8,fontWeight:700,padding:"3px 10px",borderRadius:"0 0 8px 8px",zIndex:2,whiteSpace:"nowrap",letterSpacing:.5}}>
                          {form.customTag || "⭐ RECOMMENDED"}
                        </div>
                      )}
                      <div style={{background:"linear-gradient(135deg,"+form.bc+"10,"+form.bc+"04)",padding:form.customTag||form.featured?"18px 12px 8px":"10px 12px 8px",borderBottom:"1px solid #F3F4F6"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:20}}>{form.logo}</span>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:"#111"}}>{form.name}</div>
                              <div style={{fontSize:9,color:"#6B7280"}}>{form.rating} ★</div>
                            </div>
                          </div>
                          <span style={{background:form.bc,color:"#FFF",fontSize:7,fontWeight:700,padding:"2px 6px",borderRadius:12}}>{form.badge}</span>
                        </div>
                      </div>
                      <div style={{padding:"8px 12px"}}>
                        <div style={{fontSize:20,fontWeight:800,color:"#111"}}>$89<span style={{fontSize:10,color:"#6B7280",fontWeight:400}}>/mo</span></div>
                        {(form.features||"").split(",").filter(Boolean).slice(0,3).map(function(f,i) {
                          return <div key={i} style={{fontSize:10,color:"#374151",display:"flex",alignItems:"center",gap:4,marginTop:3}}><span style={{color:form.bc,fontWeight:700}}>✓</span>{f.trim()}</div>;
                        })}
                      </div>
                      <div style={{padding:"0 12px 10px"}}><div style={{width:"100%",padding:7,textAlign:"center",background:"linear-gradient(135deg,"+form.bc+","+form.bc+"DD)",color:"#FFF",borderRadius:8,fontSize:11,fontWeight:700}}>View My Quote →</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{padding:"16px 24px",borderTop:"1px solid #F1F5F9",display:"flex",gap:10,justifyContent:"flex-end",flexShrink:0}}>
          <button onClick={onClose} style={{padding:"10px 20px",border:"1.5px solid #E2E8F0",borderRadius:10,background:"#FFF",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#64748B"}}>Cancel</button>
          <button onClick={function(){onSave(form);}} style={{padding:"10px 24px",border:"none",borderRadius:10,background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",color:"#FFF"}}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function LivePreviewCard({p, idx}) {
  var [hov, setHov] = useState(false);
  var feats = (p.features||"").split(",").filter(Boolean).slice(0,3);
  return (
    <div onMouseEnter={function(){setHov(true);}} onMouseLeave={function(){setHov(false);}} style={{minWidth:220,maxWidth:240,background:"#FFF",borderRadius:12,overflow:"hidden",border:p.featured?"2px solid #F59E0B":hov?"1.5px solid "+p.bc+"50":"1px solid #E5E7EB",boxShadow:p.featured?"0 4px 20px rgba(245,158,11,.15)":hov?"0 8px 24px "+p.bc+"15":"0 1px 4px rgba(0,0,0,.04)",transform:hov?"translateY(-2px)":"none",transition:"all .3s",flexShrink:0,position:"relative"}}>
      {(p.customTag || p.featured) && (
        <div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",background:p.featured?"linear-gradient(135deg,#F59E0B,#EF4444)":"#0EA5E9",color:"#FFF",fontSize:7.5,fontWeight:700,padding:"2px 10px",borderRadius:"0 0 8px 8px",zIndex:2,whiteSpace:"nowrap",letterSpacing:.5}}>
          {p.customTag || "⭐ RECOMMENDED"}
        </div>
      )}
      <div style={{background:"linear-gradient(135deg,"+p.bc+"10,"+p.bc+"04)",padding:(p.customTag||p.featured)?"16px 12px 8px":"10px 12px 8px",borderBottom:"1px solid #F3F4F6"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:20}}>{p.logo}</span>
            <div>
              <div style={{fontSize:12.5,fontWeight:700,color:"#111"}}>{p.name}</div>
              <div style={{display:"flex",alignItems:"center",gap:1}}>
                {[1,2,3,4,5].map(function(s){return <span key={s} style={{color:s<=Math.floor(p.rating)?"#F59E0B":"#D1D5DB",fontSize:9}}>★</span>;})}
                <span style={{marginLeft:3,fontSize:9,color:"#6B7280",fontWeight:600}}>{p.rating}</span>
              </div>
            </div>
          </div>
          <span style={{background:p.bc,color:"#FFF",fontSize:7,fontWeight:700,padding:"2px 6px",borderRadius:14,whiteSpace:"nowrap"}}>{p.badge}</span>
        </div>
      </div>
      <div style={{padding:"10px 12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
          <div><span style={{fontSize:22,fontWeight:800,color:"#111"}}>$89</span><span style={{fontSize:10,color:"#6B7280"}}>/mo</span></div>
          <div style={{background:"#ECFDF5",color:"#059669",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4}}>Save $432/yr</div>
        </div>
        {feats.length > 0 && (
          <div style={{marginTop:6}}>
            {feats.map(function(f,i){return <div key={i} style={{fontSize:10,color:"#374151",display:"flex",alignItems:"center",gap:4,marginTop:2}}><span style={{color:p.bc,fontWeight:700}}>✓</span>{f.trim()}</div>;})}
          </div>
        )}
      </div>
      <div style={{padding:"0 12px 10px"}}>
        <a href={p.link} target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",padding:8,textAlign:"center",background:"linear-gradient(135deg,"+p.bc+","+p.bc+"DD)",color:"#FFF",border:"none",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",textDecoration:"none",boxSizing:"border-box"}}>View My Quote →</a>
      </div>
    </div>
  );
}

export default function Dashboard() {
  var [partners, setPartners] = useState(DEFAULT_PARTNERS);
  var [editing, setEditing] = useState(null);
  var [tab, setTab] = useState("partners");
  var [loaded, setLoaded] = useState(false);

  // Load from persistent storage
  useEffect(function() {
    async function load() {
      try {
        var result = await window.storage.get(STORAGE_KEY, SHARED);
        if (result && result.value) {
          setPartners(JSON.parse(result.value));
        }
      } catch(e) { /* first load, use defaults */ }
      setLoaded(true);
    }
    load();
  }, []);

  // Save to persistent storage whenever partners change
  useEffect(function() {
    if (!loaded) return;
    async function save() {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(partners), SHARED); } catch(e) { console.error(e); }
    }
    save();
  }, [partners, loaded]);

  var handleSave = function(updated) {
    setPartners(function(prev) {
      return prev.map(function(p) { return p.id === updated.id ? updated : p; });
    });
    setEditing(null);
  };

  var addPartner = function() {
    var newP = {id:"p"+Date.now(),name:"New Partner",logo:"🏢",badge:"NEW",bc:"#6366F1",rating:4.0,payout:5.00,link:"https://",enabled:false,leads:0,revenue:0,cr:0,priority:3,boost:0,pinned:false,featured:false,customTag:"",features:"",bestFor:"budget"};
    setPartners(function(prev) { return prev.concat([newP]); });
    setEditing(newP);
  };

  var deletePartner = function(id) {
    setPartners(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
  };

  var togglePartner = function(id) {
    setPartners(function(prev) {
      return prev.map(function(p) { return p.id === id ? Object.assign({}, p, {enabled: !p.enabled}) : p; });
    });
  };

  var activePartners = partners.filter(function(p) { return p.enabled; }).sort(function(a, b) {
    // Pinned always first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Then by priority (lower = better) minus boost
    var scoreA = (a.priority || 3) - (a.boost || 0) * 0.1;
    var scoreB = (b.priority || 3) - (b.boost || 0) * 0.1;
    return scoreA - scoreB;
  });
  var totalRevenue = partners.reduce(function(s,p){return s+p.revenue;},0);
  var totalLeads = partners.reduce(function(s,p){return s+p.leads;},0);

  return (
    <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",background:"#0F172A",fontFamily:"'DM Sans',sans-serif",overflow:"hidden",color:"#E2E8F0"}}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0}.ptr:hover{background:#1E293B !important}.tab-active{background:linear-gradient(135deg,#0EA5E9,#06D6A0) !important;color:#FFF !important}.s-row::-webkit-scrollbar{height:4px}.s-row::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}"}</style>

      {/* Top Bar */}
      <div style={{padding:"12px 20px",background:"#1E293B",borderBottom:"1px solid #334155",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🧞</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#F8FAFC"}}>AI InsureGenie</div>
            <div style={{fontSize:10,color:"#94A3B8"}}>Lead Distribution Dashboard</div>
          </div>
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Total Revenue</div>
            <div style={{fontSize:18,fontWeight:800,color:"#06D6A0",fontFamily:"'JetBrains Mono',monospace"}}>${totalRevenue.toLocaleString()}</div>
          </div>
          <div style={{width:1,height:30,background:"#334155"}} />
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Total Leads</div>
            <div style={{fontSize:18,fontWeight:800,color:"#F8FAFC",fontFamily:"'JetBrains Mono',monospace"}}>{totalLeads.toLocaleString()}</div>
          </div>
          <div style={{width:1,height:30,background:"#334155"}} />
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Active Partners</div>
            <div style={{fontSize:18,fontWeight:800,color:"#0EA5E9",fontFamily:"'JetBrains Mono',monospace"}}>{activePartners.length}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* Left: Admin Panel */}
        <div style={{flex:1,display:"flex",flexDirection:"column",borderRight:"1px solid #334155",overflow:"hidden"}}>
          {/* Tabs */}
          <div style={{padding:"12px 16px",display:"flex",gap:6,borderBottom:"1px solid #1E293B",background:"#0F172A",flexShrink:0}}>
            {["partners","stats"].map(function(t) {
              return <button key={t} onClick={function(){setTab(t);}} className={tab===t?"tab-active":""} style={{padding:"7px 16px",borderRadius:8,border:"none",background:tab===t?undefined:"transparent",color:tab===t?"#FFF":"#94A3B8",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize",transition:"all .2s"}}>{t}</button>;
            })}
            <div style={{flex:1}} />
            <button onClick={addPartner} style={{padding:"7px 14px",borderRadius:8,border:"1.5px dashed #475569",background:"transparent",color:"#0EA5E9",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Add Partner</button>
          </div>

          {/* Partner List */}
          <div style={{flex:1,overflowY:"auto",padding:16}}>
            {tab === "partners" && (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {partners.map(function(p) {
                  return (
                    <div key={p.id} className="ptr" style={{background:"#1E293B",borderRadius:12,padding:14,border:"1px solid #334155",transition:"all .2s",opacity:p.enabled?1:.5}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:36,height:36,borderRadius:10,background:p.bc+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,border:"1px solid "+p.bc+"30"}}>{p.logo}</div>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:"#F1F5F9"}}>{p.name}</div>
                            <div style={{fontSize:10,color:"#64748B",fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{p.link.replace("https://","").substring(0,35)}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{background:p.enabled?"#059669":"#475569",color:"#FFF",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:12}}>{p.enabled?"LIVE":"OFF"}</span>
                          {p.pinned && <span style={{background:"#0EA5E9",color:"#FFF",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:12}}>📌 #1</span>}
                          {p.featured && <span style={{background:"#F59E0B",color:"#FFF",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:12}}>⭐</span>}
                          {(p.boost||0) > 0 && <span style={{background:"#7C3AED",color:"#FFF",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:12}}>+{p.boost}</span>}
                          <button onClick={function(){setEditing(p);}} style={{background:"#334155",border:"none",borderRadius:6,padding:"5px 10px",color:"#94A3B8",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                        <div style={{background:"#0F172A",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>CPL</div>
                          <div style={{fontSize:16,fontWeight:800,color:"#06D6A0",fontFamily:"'JetBrains Mono',monospace"}}>${p.payout.toFixed(2)}</div>
                        </div>
                        <div style={{background:"#0F172A",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Leads</div>
                          <div style={{fontSize:16,fontWeight:800,color:"#F1F5F9",fontFamily:"'JetBrains Mono',monospace"}}>{p.leads.toLocaleString()}</div>
                        </div>
                        <div style={{background:"#0F172A",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Revenue</div>
                          <div style={{fontSize:16,fontWeight:800,color:"#0EA5E9",fontFamily:"'JetBrains Mono',monospace"}}>${p.revenue.toLocaleString()}</div>
                        </div>
                        <div style={{background:"#0F172A",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Conv %</div>
                          <div style={{fontSize:16,fontWeight:800,color:p.cr>5?"#06D6A0":p.cr>2?"#F59E0B":"#EF4444",fontFamily:"'JetBrains Mono',monospace"}}>{p.cr}%</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,marginTop:8}}>
                        <button onClick={function(){togglePartner(p.id);}} style={{flex:1,padding:7,borderRadius:8,border:"none",background:p.enabled?"#7F1D1D":"#14532D",color:p.enabled?"#FCA5A5":"#86EFAC",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{p.enabled?"⏸ Pause":"▶ Enable"}</button>
                        <button onClick={function(){deletePartner(p.id);}} style={{padding:"7px 12px",borderRadius:8,border:"1px solid #7F1D1D",background:"transparent",color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "stats" && (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{background:"#1E293B",borderRadius:12,padding:16,border:"1px solid #334155"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#F1F5F9",marginBottom:12}}>Revenue by Partner</div>
                  {partners.sort(function(a,b){return b.revenue-a.revenue;}).map(function(p) {
                    var maxRev = Math.max.apply(null, partners.map(function(x){return x.revenue;})) || 1;
                    return (
                      <div key={p.id} style={{marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:11,color:"#94A3B8"}}>{p.logo} {p.name}</span>
                          <span style={{fontSize:11,fontWeight:700,color:"#06D6A0",fontFamily:"'JetBrains Mono',monospace"}}>${p.revenue.toLocaleString()}</span>
                        </div>
                        <div style={{height:6,background:"#0F172A",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:(p.revenue/maxRev*100)+"%",height:"100%",background:"linear-gradient(90deg,"+p.bc+","+p.bc+"88)",borderRadius:3,transition:"width .5s"}} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{background:"#1E293B",borderRadius:12,padding:16,border:"1px solid #334155"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#F1F5F9",marginBottom:8}}>Quick Stats</div>
                  <div style={{fontSize:12,color:"#94A3B8",lineHeight:2}}>
                    Avg CPL: <span style={{color:"#06D6A0",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>${totalLeads>0?(totalRevenue/totalLeads).toFixed(2):"0.00"}</span><br/>
                    Best Partner: <span style={{color:"#F1F5F9",fontWeight:600}}>{partners.reduce(function(a,b){return a.revenue>b.revenue?a:b;}).name}</span><br/>
                    Avg Conv Rate: <span style={{color:"#0EA5E9",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{(partners.reduce(function(s,p){return s+p.cr;},0)/partners.length).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Chatbot Preview */}
        <div style={{width:380,display:"flex",flexDirection:"column",background:"#F8FAFC",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",background:"#FFF",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#06D6A0",animation:"pulse 2s ease infinite"}} />
              <span style={{fontSize:12,fontWeight:700,color:"#0F172A"}}>LIVE PREVIEW</span>
            </div>
            <span style={{fontSize:10,color:"#94A3B8"}}>Updates in real-time</span>
          </div>

          {/* Simulated Chat */}
          <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
            {/* Bot greeting */}
            <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#FFF",fontWeight:800,flexShrink:0}}>AI</div>
              <div style={{background:"#FFF",border:"1px solid #E5E7EB",padding:"9px 12px",borderRadius:"4px 12px 12px 12px",fontSize:12,lineHeight:1.5,color:"#333"}}>
                Great news! I found <strong>{activePartners.length} insurers</strong> competing for your business in <strong>75001, TX</strong>!
              </div>
            </div>

            {/* User message */}
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <div style={{background:"linear-gradient(135deg,#0EA5E9,#0284C7)",color:"#FFF",padding:"9px 12px",borderRadius:"12px 12px 4px 12px",fontSize:12}}>Show me my quotes</div>
            </div>

            {/* Bot with cards */}
            <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#FFF",fontWeight:800,flexShrink:0}}>AI</div>
              <div style={{background:"#FFF",border:"1px solid #E5E7EB",padding:"9px 12px",borderRadius:"4px 12px 12px 12px",fontSize:12,lineHeight:1.5,color:"#333"}}>
                Here are your personalized quotes:
              </div>
            </div>

            {/* Partner Cards — reflects admin changes in real-time */}
            <div className="s-row" style={{display:"flex",gap:8,overflowX:"auto",paddingLeft:30,paddingBottom:6}}>
              {activePartners.length === 0 ? (
                <div style={{padding:20,textAlign:"center",color:"#94A3B8",fontSize:12,width:"100%"}}>No active partners. Enable partners in the admin panel.</div>
              ) : (
                activePartners.map(function(p, i) {
                  return <LivePreviewCard key={p.id} p={p} idx={i} />;
                })
              )}
            </div>

            {/* Follow-up */}
            <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#FFF",fontWeight:800,flexShrink:0}}>AI</div>
              <div style={{background:"#FFF",border:"1px solid #E5E7EB",padding:"9px 12px",borderRadius:"4px 12px 12px 12px",fontSize:12,lineHeight:1.5,color:"#333"}}>
                Click any quote to get your exact rate. Have questions? Ask me anything!
              </div>
            </div>
          </div>

          {/* Preview footer */}
          <div style={{padding:"10px 14px",background:"#FFF",borderTop:"1px solid #E5E7EB",flexShrink:0}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {["Lower rate?","Compare options","Talk to agent"].map(function(s,i){
                return <span key={i} style={{padding:"5px 10px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:14,fontSize:10,fontWeight:600,color:"#0369A1"}}>{s}</span>;
              })}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"#F3F4F6",borderRadius:20,padding:"3px 3px 3px 12px"}}>
              <input disabled placeholder="Ask me anything..." style={{flex:1,border:"none",background:"none",outline:"none",fontSize:12,color:"#999",fontFamily:"inherit"}} />
              <div style={{width:30,height:30,borderRadius:"50%",background:"#D1D5DB",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              </div>
            </div>
            <div style={{textAlign:"center",marginTop:4,fontSize:8,color:"#C0C0C0"}}>Powered by AI · {activePartners.length} active insurers</div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && <EditModal partner={editing} onSave={handleSave} onClose={function(){setEditing(null);}} />}

      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}"}</style>
    </div>
  );
}
