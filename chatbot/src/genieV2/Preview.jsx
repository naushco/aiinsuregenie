import React, { useState } from "react";
import { initialAssessment, nextQuestion, applyAnswer, assessmentResult, SCENARIOS } from "./engine.js";
import "./preview.css";

export default function GenieV2Preview() {
  const [profile, setProfile] = useState(initialAssessment);
  const [messages, setMessages] = useState([{ role:"assistant", text:"Hi, I'm Genie. Tell me what's happening with your auto insurance. I'll help you understand your next steps." }]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const question = nextQuestion(profile);
  const result = profile.completed ? assessmentResult(profile) : null;
  const total = profile.scenario === "dui" || profile.scenario === "sr22" ? 6 : 5;
  const completed = profile.history.length;
  function send(value) {
    if (!question) return;
    const raw = String(value || "").trim();
    if (!raw) return;
    const update = applyAnswer(profile, question.id, raw);
    if (update.error) { setError(update.error); return; }
    setError("");
    setDraft("");
    setProfile(update.profile);
    setMessages(old => [...old, { role:"user", text:raw },
      ...(update.question ? [{ role:"assistant", text:update.question.prompt }] : [{ role:"assistant", text:"Your assessment is ready. Here's what we know and what to do next." }])]);
  }
  function reset() {
    setProfile(initialAssessment());
    setMessages([{role:"assistant",text:"Hi, I'm Genie. Tell me what's happening with your auto insurance."}]);
    setDraft(""); setError("");
  }
  return <main className="genie-shell">
    <header className="genie-header"><div className="genie-brand"><span className="genie-logo">✦</span><div><strong>Genie <span className="genie-v2">2.0 preview</span></strong><small>AI InsureGenie · Insurance navigation</small></div></div><button className="genie-reset" onClick={reset}>Start over</button></header>
    <section className="genie-content">
      <div className="genie-intro"><span className="genie-eyebrow">A clearer path to coverage</span><h1>Let's figure out your insurance options.</h1><p>Tell us what's going on. We'll ask only the questions relevant to your situation.</p></div>
      <div className="genie-card">
        <div className="genie-progress"><span>Driver assessment</span><span>{result?.ready ? "Complete" : `${completed} of ${total} steps`}</span></div>
        <div className="genie-track"><div style={{width:`${Math.min(100,completed/total*100)}%`}} /></div>
        <div className="genie-messages" aria-live="polite">{messages.map((m,i)=><div key={i} className={`genie-bubble ${m.role}`}>{m.text}</div>)}</div>
        {question ? <div className="genie-response">
          {question.choices.length > 0 && <div className="genie-choices">{question.choices.map(c=><button key={c} onClick={()=>send(c)}>{c}</button>)}</div>}
          <form onSubmit={e=>{e.preventDefault();send(draft)}}><label htmlFor="genie-answer">Your answer</label><div className="genie-input-row"><input id="genie-answer" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={question.id==="state"?"Enter a US state (e.g., Texas)":"Type your answer here…"} maxLength={500}/><button type="submit">Send</button></div></form>
          {error && <p className="genie-error" role="alert">{error}</p>}
        </div> : result?.ready && <div className="genie-result"><span className="genie-eyebrow">Your assessment</span><h2>{SCENARIOS[profile.scenario]}</h2><dl><div><dt>State</dt><dd>{profile.state}</dd></div><div><dt>Owns a vehicle</dt><dd>{profile.ownsVehicle?"Yes":"No"}</dd></div><div><dt>Coverage needed</dt><dd>{profile.timing.replaceAll("_"," ")}</dd></div><div><dt>Partner connection</dt><dd>Pending verified integration</dd></div></dl>{result.needsFilingVerification && <p>Check your filing requirements with your state DMV or court.</p>}<p className="genie-disclaimer">{result.disclaimer}</p><button className="genie-primary" onClick={reset}>Start a new assessment</button></div>}
      </div>
      <p className="genie-footer">Prototype only. No personal contact details collected, no insurance quotes issued, and no leads transmitted to advertisers.</p>
    </section>
  </main>;
}
