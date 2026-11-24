import {reviewProfile,profileReady} from "./genie-journeys.js";

const helperStyle={color:"#52627d",fontSize:13,lineHeight:1.5};
export default function QuoteReview({profile,stateName,hasModels,onEdit,onContinue,onAdvice}) {
  const fields=reviewProfile(profile,stateName);
  const complete=profileReady(profile,hasModels);
  const missing=fields.filter(x=>!x.ready && !(x.key==="car" && profile.vehicleStatus==="no_vehicle") && x.key!=="pri").length;
  const issues=(profile.sits||[]).filter(k=>["sr22","dui","lapse","ride","record"].includes(k));
  return (
    <section aria-label="Review your insurance profile" style={{margin:"14px 0 20px 36px",border:"1px solid #dce5f0",borderRadius:16,padding:18,background:"#fff",boxShadow:"0 6px 24px rgba(11,42,91,.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <span aria-hidden="true" style={{display:"grid",placeItems:"center",width:36,height:36,borderRadius:10,background:"#eef3fb",fontSize:21}}>🛡️</span>
        <div>
          <h2 style={{fontSize:17,color:"#0b2a5b",margin:0}}>Your insurance profile</h2>
          <p style={{...helperStyle,margin:"3px 0 0"}}>Based on what you have confirmed with Genie</p>
        </div>
      </div>
      {issues.length ? <p style={{...helperStyle,margin:"10px 0",padding:"10px 12px",background:"#f5f8fd",borderRadius:10}}>
        Your situation may affect which coverage and insurers are available. Comparing options with accurate details can help you make an informed choice. We have not verified your eligibility or pricing.
      </p>:null}
      <p style={{...helperStyle,margin:"12px 0"}}>Review or correct your answers. Missing details will be asked only when needed. This is <strong>not a price quote</strong>.</p>
      <dl style={{margin:"0 0 16px"}}>
        {fields.filter(x=>x.key!=="pri" || x.value).filter(x=>x.key!=="car" || profile.vehicleStatus!=="no_vehicle").map(field=>(
          <div key={field.key} style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #edf0f5"}}>
            <div style={{minWidth:0}}>
              <dt style={{color:"#64738d",fontSize:12}}>{field.label}</dt>
              <dd style={{color:field.value?"#192a45":"#64738d",fontSize:14,fontWeight:field.value?600:400,margin:"4px 0 0",overflowWrap:"anywhere"}}>{field.value||"Not yet discussed"}</dd>
            </div>
            <button type="button" aria-label={"Change "+field.label} onClick={()=>onEdit(field.key)} style={{background:"#f1f4f8",border:"1px solid #e2e8f0",color:"#0b2a5b",fontSize:12,fontWeight:700,padding:"8px 10px",borderRadius:9,flexShrink:0}}>Edit</button>
          </div>
        ))}
      </dl>
      <p style={{...helperStyle,margin:"0 0 12px"}}>
        {complete?"Your confirmed information is ready for a quoting-partner search.":"You can continue with "+missing+" missing detail"+(missing===1?"":"s")+"."}
      </p>
      <button type="button" onClick={onContinue} style={{display:"block",width:"100%",background:"#0b2a5b",color:"#fff",border:0,borderRadius:10,padding:"13px 10px",fontSize:14,fontWeight:750,cursor:"pointer"}}>
        {complete?"Confirm and view quoting options":"Continue with quote questions"}
      </button>
      <button type="button" onClick={onAdvice} style={{display:"block",width:"100%",background:"none",color:"#0b2a5b",border:0,padding:"12px 8px",fontSize:13,fontWeight:650,cursor:"pointer"}}>Keep talking with Genie</button>
      <p style={{...helperStyle,margin:"8px 0 0",fontSize:11}}>Nothing is sent to an insurance buyer from this review. If you choose a quoting partner, you may be taken to their website. Providing contact details or requesting calls requires a separate, clear consent step.</p>
    </section>
  );
}
