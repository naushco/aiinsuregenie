import {reviewProfile,qualificationSummary} from "./genie-journeys.js";

export default function QuoteReview({profile,stateName,hasModels,onEdit,onContinue,onAdvice,es:esProp}) {
  const es=typeof esProp==="boolean"?esProp:(typeof document!=="undefined" && document.documentElement.lang==="es");
  const t=(en,sp)=>es?sp:en;
  const readiness=qualificationSummary(profile,hasModels);
  const complete=readiness.ready;
  const fields=reviewProfile(profile,stateName).filter(f=>(f.key!=="pri"||f.value)&&(f.key!=="car"||profile.vehicleStatus!=="no_vehicle"));
  const labels={st:"Estado",sits:"Situación de seguro",vehicleStatus:"Situación del vehículo",car:"Vehículo",cov:"Cobertura",when:"Cuándo necesita cobertura",pri:"Prioridad"};
  const values={"SR-22 filing":"Presentación SR-22","DUI / DWI":"DUI / DWI","Coverage lapse":"Interrupción de cobertura","Rideshare / delivery":"Transporte / reparto","Tickets or accidents":"Multas o accidentes","New driver":"Conductor nuevo","No special driving issue":"Sin situación especial","Own a vehicle":"Tengo un vehículo","Financing a vehicle":"Financio un vehículo","Leasing a vehicle":"Alquilo un vehículo","Buying a vehicle today":"Compro un vehículo hoy","Tomorrow":"Mañana","Non-owner coverage":"Cobertura sin vehículo","State minimum":"Mínimo estatal","Full coverage":"Cobertura total","Broader coverage":"Cobertura más amplia","2015 or older":"2015 o antes","Not sure yet":"No estoy seguro","Today":"Hoy","Within a week":"En una semana","Comparing options":"Comparando opciones","Lower cost":"Menor costo","Coverage":"Cobertura","Service":"Servicio"};
  const value=f=>!f.value?t("Not yet discussed","Sin confirmar"):es?f.value.split(", ").map(v=>values[v]||v).join(", "):f.value;
  return <section className="aig3-review" aria-label={t("Review your insurance profile","Revise su perfil de seguro")}>
    <h2 className="pj">{t("Your insurance profile","Su perfil de seguro")}</h2>
    <p>{t("Review or correct your confirmed details before we explore quoting options.","Revise o corrija sus datos confirmados antes de explorar cotizaciones.")}</p>
    <div className="aig3-profile-meter" role="progressbar" aria-label={t("Confirmed details","Datos confirmados")} aria-valuenow={readiness.confirmed_count} aria-valuemax={readiness.required_count} aria-valuemin={0}><i style={{width:(100*readiness.confirmed_count/Math.max(1,readiness.required_count))+"%"}}/></div>
    <p><strong>{readiness.confirmed_count} / {readiness.required_count}</strong> {t("required details confirmed","datos requeridos confirmados")}</p>
    <dl>{fields.map(f=><div key={f.key} className="aig3-profile-row"><div><dt>{es?labels[f.key]||f.label:f.label}</dt><dd>{value(f)}</dd></div><button type="button" className="lk" aria-label={t("Change "+f.label,"Cambiar "+(labels[f.key]||f.label))} onClick={()=>onEdit(f.key)}>{t("Edit","Editar")}</button></div>)}</dl>
    <p>{complete?t("Your confirmed information is ready for a quoting-partner search.","Sus datos confirmados están listos para buscar socios."):t("We will ask only for the missing details.","Solo preguntaremos por los datos faltantes.")} {t("This is not a price quote.","Esto no es una cotización de precio.")}</p>
    <button type="button" className="p1" onClick={onContinue}>{complete?t("Confirm and view quoting options","Confirmar y ver opciones"):t("Continue with quote questions","Continuar con preguntas")}</button>
    <button type="button" className="p2" style={{marginTop:10}} onClick={onAdvice}>{t("Keep talking with AI InsureGenie","Seguir hablando con AI InsureGenie")}</button>
    <p className="fine">{t("Nothing is sent to an insurance buyer from this review. Contact requests require separate consent. Actual prices and eligibility are determined by the provider.","No enviamos datos a compradores de seguros en esta revisión. Las solicitudes de contacto requieren consentimiento separado. El proveedor determina los precios y la elegibilidad.")}</p>
  </section>;
}
