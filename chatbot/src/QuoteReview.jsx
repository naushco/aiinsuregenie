import {reviewProfile,qualificationSummary} from "./genie-journeys.js";

const helperStyle={color:"#52627d",fontSize:13,lineHeight:1.5};
const ES_LABELS={"State":"Estado","Insurance situation":"Situación","Vehicle status":"Tipo de vehículo","Vehicle":"Vehículo","Coverage":"Cobertura","When coverage is needed":"Cuándo la necesita","Main priority":"Prioridad",
 "SR-22 filing":"SR-22","DUI / DWI":"DUI / DWI","Coverage lapse":"Interrupción de cobertura","Rideshare / delivery":"Uber / reparto","Tickets or accidents":"Multas o accidentes","New driver":"Conductor nuevo","No special driving issue":"Ninguna situación especial","Not specified":"Sin especificar",
 "Own a vehicle":"Tiene un vehículo","Financing a vehicle":"Vehículo financiado","Leasing a vehicle":"Vehículo arrendado","Non-owner coverage":"Seguro sin vehículo","Not applicable":"No aplica",
 "State minimum":"Mínimo del estado","Full coverage":"Cobertura total","Not sure yet":"Todavía no sé","Today":"Hoy","Within a week":"Esta semana","Comparing options":"Solo comparando","Lower cost":"Precio más bajo","2015 or older":"2015 o antes"};
export default function QuoteReview({profile,stateName,hasModels,onEdit,onContinue,onAdvice,es}) {
  const L=x=>!es||x==null?x:String(x).split(", ").map(p=>ES_LABELS[p]||p).join(", ").replace("2015 or older","2015 o antes");
  const T=(en,sp)=>es?sp:en;
  const fields=reviewProfile(profile,stateName);
  const readiness=qualificationSummary(profile,hasModels);
  const complete=readiness.ready;
  const missing=readiness.required_count-readiness.confirmed_count;
  const issues=(profile.sits||[]).filter(k=>["sr22","dui","lapse","ride","record"].includes(k));
  return (
    <section aria-label={T("Review your insurance profile","Revise su perfil de seguro")} style={{margin:"14px 0 20px 36px",border:"1px solid #dce5f0",borderRadius:16,padding:18,background:"#fff",boxShadow:"0 6px 24px rgba(11,42,91,.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <span aria-hidden="true" style={{display:"grid",placeItems:"center",width:36,height:36,borderRadius:10,background:"#eef3fb",fontSize:21}}>🛡️</span>
        <div>
          <h2 style={{fontSize:17,color:"#0b2a5b",margin:0}}>{T("Your insurance profile","Su perfil de seguro")}</h2>
          <p style={{...helperStyle,margin:"3px 0 0"}}>{T("Based on what you have confirmed with Genie","Según lo que confirmó con Genie")}</p>
        </div>
      </div>
      {issues.length ? <p style={{...helperStyle,margin:"10px 0",padding:"10px 12px",background:"#f5f8fd",borderRadius:10}}>
        {T("Your situation may affect which coverage and insurers are available. Comparing options with accurate details can help you make an informed choice. We have not verified your eligibility or pricing.","Su situación puede afectar qué coberturas y aseguradoras están disponibles. Comparar con datos correctos le ayuda a decidir. No hemos verificado su elegibilidad ni precios.")}
      </p>:null}
      <p style={{...helperStyle,margin:"12px 0"}}>{T("Review or correct your answers. ","Revise o corrija sus respuestas. ")}<strong>{readiness.confirmed_count} {T("of","de")} {readiness.required_count} {T("required details confirmed.","datos requeridos confirmados.")}</strong> {T("Missing details will be asked only when needed. This is ","Solo preguntaremos lo que falte. Esto ")}<strong>{T("not a price quote","no es una cotización")}</strong>.</p>
      <dl style={{margin:"0 0 16px"}}>
        {fields.filter(x=>x.key!=="pri" || x.value).filter(x=>x.key!=="car" || profile.vehicleStatus!=="no_vehicle").map(field=>(
          <div key={field.key} style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #edf0f5"}}>
            <div style={{minWidth:0}}>
              <dt style={{color:"#64738d",fontSize:12}}>{L(field.label)}</dt>
              <dd style={{color:field.value?"#192a45":"#64738d",fontSize:14,fontWeight:field.value?600:400,margin:"4px 0 0",overflowWrap:"anywhere"}}>{L(field.value)||T("Not yet discussed","Aún no conversado")}</dd>
            </div>
            <button type="button" aria-label={T("Change ","Cambiar ")+L(field.label)} onClick={()=>onEdit(field.key)} style={{background:"#f1f4f8",border:"1px solid #e2e8f0",color:"#0b2a5b",fontSize:12,fontWeight:700,padding:"8px 10px",borderRadius:9,flexShrink:0}}>{T("Edit","Editar")}</button>
          </div>
        ))}
      </dl>
      <p style={{...helperStyle,margin:"0 0 12px"}}>
        {complete?T("Your confirmed information is ready for a quoting-partner search.","Sus datos confirmados están listos para buscar un socio de cotización."):T("You can continue with "+missing+" missing detail"+(missing===1?"":"s")+".","Puede continuar; faltan "+missing+" dato"+(missing===1?"":"s")+".")}
      </p>
      <button type="button" onClick={onContinue} style={{display:"block",width:"100%",background:"#0b2a5b",color:"#fff",border:0,borderRadius:10,padding:"13px 10px",fontSize:14,fontWeight:750,cursor:"pointer"}}>
        {complete?T("Confirm and view quoting options","Confirmar y ver opciones"):T("Continue with quote questions","Continuar con las preguntas")}
      </button>
      <button type="button" onClick={onAdvice} style={{display:"block",width:"100%",background:"none",color:"#0b2a5b",border:0,padding:"12px 8px",fontSize:13,fontWeight:650,cursor:"pointer"}}>{T("Keep talking with Genie","Seguir hablando con Genie")}</button>
      <p style={{...helperStyle,margin:"8px 0 0",fontSize:11}}>{T("Nothing is sent to an insurance buyer from this review. If you choose a quoting partner, you may be taken to their website. Providing contact details or requesting calls requires a separate, clear consent step.","Esta revisión no envía nada a ningún comprador de seguros. Si elige un socio de cotización, puede ir a su sitio web. Dar sus datos de contacto o pedir una llamada requiere un consentimiento aparte y claro.")}</p>
    </section>
  );
}
