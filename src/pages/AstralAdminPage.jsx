import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Mail, RotateCcw, ShieldCheck, Sparkles } from "../components/MysticIcons";
import { pdfFileToBase64, readAstralAdminSecret, requestAstralAdmin, storeAstralAdminSecret } from "../lib/astralAdmin";
import "../astral-admin.css";

const statusLabels = { pending: "Aguardando rascunho", reviewing: "Em revisão", delivered: "Entregue" };
const errorMessages = {
  unauthorized: "Segredo administrativo incorreto.",
  payment_ledger_not_ready: "Execute a migração database/arcane911-v31.sql no Supabase.",
  provider_unavailable: "Configure o provedor do Agent911 ou tente de novo.",
  astral_generation_required: "O Agent911 ainda não conseguiu produzir a leitura-base.",
  pdf_invalid: "Escolha um PDF válido.",
  pdf_too_large: "O PDF passou de 2,7 MB. Comprima antes de enviar.",
  pdf_upload_failed: "Não foi possível guardar o PDF no Storage privado.",
  email_not_configured: "Configure RESEND_API_KEY e ARCANE911_FROM_EMAIL antes de aprovar.",
  email_send_failed: "O e-mail não foi confirmado. O pedido continua em revisão.",
  astral_pdf_unavailable: "Suba o PDF revisado antes de aprovar.",
};

function humanDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function errorText(error) { return errorMessages[error?.code] || `Não foi possível concluir (${error?.code || "erro desconhecido"}).`; }

function OrderQueue({ orders, selectedId, onSelect }) {
  if (!orders.length) return <p className="astral-admin-empty">Nenhum pedido neste filtro.</p>;
  return <div className="astral-admin-queue">{orders.map((order) => (
    <button className={selectedId === order.orderId ? "is-active" : ""} type="button" key={order.orderId} onClick={() => onSelect(order.orderId)}>
      <span><strong>{order.fullName}</strong><small>{order.email}</small></span>
      <span className={`astral-admin-status is-${order.status}`}>{statusLabels[order.status] || order.status}</span>
      <small>{humanDate(order.createdAt)} · rascunho v{order.draftVersion || 0}{order.pdfReady ? " · PDF ✓" : ""}</small>
    </button>
  ))}</div>;
}

function EditablePage({ page, onChange }) {
  return <details className="astral-admin-page-editor">
    <summary><span>{String(page.number).padStart(2, "0")}</span>{page.section} · {page.title}</summary>
    <label>Seção<input value={page.section} onChange={(event) => onChange("section", event.target.value)} maxLength={80} /></label>
    <label>Título<input value={page.title} onChange={(event) => onChange("title", event.target.value)} maxLength={180} /></label>
    <label>Subtítulo<textarea value={page.subtitle} onChange={(event) => onChange("subtitle", event.target.value)} maxLength={320} rows={2} /></label>
    <label>Texto<textarea value={page.body} onChange={(event) => onChange("body", event.target.value)} maxLength={12000} rows={10} /></label>
    <label>Destaque<textarea value={page.callout} onChange={(event) => onChange("callout", event.target.value)} maxLength={1200} rows={3} /></label>
  </details>;
}

function DocumentPreview({ draft }) {
  if (!draft?.pages?.length) return null;
  return <section className="astral-admin-document" aria-label="Prévia do Documento Astral 911">{draft.pages.map((page) => (
    <article className={`astral-pdf-page ${page.number === 1 ? "is-cover" : ""}`} key={page.number}>
      <img className="astral-pdf-card" src={`/cards/${page.card}`} alt="" aria-hidden="true" />
      <div className="astral-pdf-brand"><span>☾</span><strong>ARCANE911</strong><small>DOCUMENTO ASTRAL</small></div>
      <div className="astral-pdf-content">
        <span className="astral-pdf-kicker">{page.section}</span><h2>{page.title}</h2>
        {page.subtitle ? <p className="astral-pdf-subtitle">{page.subtitle}</p> : null}
        <div className="astral-pdf-body">{page.body}</div>
        {page.callout ? <blockquote>{page.callout}</blockquote> : null}
      </div>
      <footer><span>Agent911 · curadoria humana</span><b>{String(page.number).padStart(2, "0")}</b></footer>
    </article>
  ))}</section>;
}

export default function AstralAdminPage() {
  const [secret, setSecret] = useState(readAstralAdminSecret);
  const [secretInput, setSecretInput] = useState(readAstralAdminSecret);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const [configuration, setConfiguration] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const delivered = record?.order?.status === "delivered";
  const dirty = useMemo(() => record?.draft && JSON.stringify(record.draft) !== JSON.stringify(draft), [draft, record]);

  async function call(body, label = "") {
    setBusy(label || body.action); setError(""); setMessage("");
    try { return await requestAstralAdmin(secret, body); }
    catch (requestError) {
      if (requestError.status === 401) { setSecret(""); storeAstralAdminSecret(""); }
      setError(errorText(requestError)); throw requestError;
    } finally { setBusy(""); }
  }
  async function loadQueue(nextFilter = filter) {
    const result = await call({ action: "list", status: nextFilter, limit: 100 }, "list");
    setOrders(result.orders || []); setConfiguration(result.configuration || null); return result.orders || [];
  }
  async function loadDetail(orderId) {
    setSelectedId(orderId); setConfirmingDelivery(false);
    const result = await call({ action: "detail", orderId }, "detail");
    setRecord(result); setDraft(result.draft || null); setNote(result.order?.reviewNote || "");
  }
  function enter(event) {
    event.preventDefault(); const normalized = storeAstralAdminSecret(secretInput); setSecret(normalized);
  }
  useEffect(() => { if (secret) loadQueue().catch(() => {}); }, [secret, filter]);

  async function generate(force = false) {
    try {
      const result = await call({ action: "generate", orderId: selectedId, force, note }, force ? "regenerate" : "generate");
      setRecord(result); setDraft(result.draft); setNote(result.order?.reviewNote || ""); await loadQueue();
      setMessage(force ? "Nova versão gerada. Leia tudo antes de salvar o PDF." : "Rascunho de 21 páginas preparado para sua revisão.");
    } catch { /* A mensagem já foi traduzida pela chamada. */ }
  }
  async function save() {
    try {
      const result = await call({ action: "save", orderId: selectedId, draft, note }, "save");
      setRecord(result); setDraft(result.draft); setNote(result.order?.reviewNote || ""); await loadQueue(); setMessage("Sua revisão foi salva.");
    } catch { /* A mensagem já foi traduzida pela chamada. */ }
  }
  function updatePage(index, field, value) {
    setDraft((current) => ({ ...current, pages: current.pages.map((page, pageIndex) => pageIndex === index ? { ...page, [field]: value } : page) }));
  }
  async function upload(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 2_700_000) { setError(errorMessages.pdf_too_large); return; }
    try {
      const pdfBase64 = await pdfFileToBase64(file);
      const result = await call({ action: "upload_pdf", orderId: selectedId, pdfBase64 }, "upload");
      setRecord(result); setDraft(result.draft); await loadQueue();
      setMessage(`PDF privado anexado (${Math.round(result.uploaded.bytes / 1024)} KB). Ainda não foi enviado.`);
    } catch (uploadError) { if (uploadError?.code === "pdf_invalid") setError(errorText(uploadError)); }
  }
  async function openUploadedPdf() {
    try { const result = await call({ action: "pdf_preview", orderId: selectedId }, "preview_pdf"); window.open(result.url, "_blank", "noopener,noreferrer"); }
    catch { /* A mensagem já foi traduzida pela chamada. */ }
  }
  async function approve() {
    try {
      await call({ action: "approve", orderId: selectedId }, "approve"); setConfirmingDelivery(false);
      await loadDetail(selectedId); await loadQueue(); setMessage("Entrega confirmada: e-mail enviado e 5 perguntas liberadas.");
    } catch { /* A mensagem já foi traduzida pela chamada. */ }
  }

  if (!secret) return <main className="astral-admin-login" id="astral-admin-main"><form onSubmit={enter}>
    <span className="astral-admin-moon">☾</span><small>Bancada privada · Arcane911</small>
    <h1>Se cada mapa passa pelos seus olhos, é aqui que ele espera.</h1>
    <p>O segredo fica somente nesta aba e nunca entra no código público do site.</p>
    <label>Segredo administrativo<input type="password" value={secretInput} onChange={(event) => setSecretInput(event.target.value)} minLength={24} autoComplete="current-password" required /></label>
    <button className="button button-primary" type="submit">Entrar na revisão <ShieldCheck size={17} /></button>
    {error ? <p className="astral-admin-feedback is-error">{error}</p> : null}
  </form></main>;

  return <main className="astral-admin" id="astral-admin-main">
    <header className="astral-admin-heading"><div><small>Bancada privada · V31</small><h1>Mapas esperando o seu olhar.</h1><p>Agent911 redige. Você revisa. O cliente só recebe depois da sua aprovação.</p></div><button className="button button-glass" type="button" onClick={() => loadQueue().catch(() => {})} disabled={Boolean(busy)}><RotateCcw size={15} /> Atualizar</button></header>
    <section className="astral-admin-config">
      <span className={configuration?.reviewerEmailConfigured ? "is-ready" : "is-warning"}><Mail size={15} /> {configuration?.reviewerEmailConfigured ? "E-mail do revisor configurado" : "REVIEWER_EMAIL está no exemplo — troque quando quiser"}</span>
      <span className={configuration?.outboundEmailConfigured ? "is-ready" : "is-warning"}><ShieldCheck size={15} /> {configuration?.outboundEmailConfigured ? "Envio ao cliente configurado" : "Resend/remetente ainda não configurados"}</span>
    </section>
    <div className="astral-admin-layout">
      <aside className="astral-admin-sidebar"><label>Fila<select value={filter} onChange={(event) => { setFilter(event.target.value); setSelectedId(""); setRecord(null); }}><option value="">Todos</option><option value="pending">Aguardando rascunho</option><option value="reviewing">Em revisão</option><option value="delivered">Entregues</option></select></label><OrderQueue orders={orders} selectedId={selectedId} onSelect={(id) => loadDetail(id).catch(() => {})} /></aside>
      <section className="astral-admin-workbench">
        {!record ? <div className="astral-admin-placeholder"><Sparkles size={28} /><h2>Escolha um pedido.</h2><p>Os dados, o autorrelato e o rascunho aparecem aqui.</p></div> : <>
          <div className="astral-admin-order-head"><div><small>{record.order.orderId}</small><h2>{record.order.fullName}</h2><p>{record.order.email} · {record.order.cityName}, {record.order.regionName}</p></div><span className={`astral-admin-status is-${record.order.status}`}>{statusLabels[record.order.status]}</span></div>
          <div className="astral-admin-actions">
            {!draft && !delivered ? <button className="button button-primary" type="button" onClick={() => generate(false)} disabled={Boolean(busy)}><Sparkles size={16} /> Gerar rascunho Agent911</button> : null}
            {draft && !delivered ? <button className="button button-glass" type="button" onClick={save} disabled={Boolean(busy) || !dirty}>Salvar revisão</button> : null}
            {draft && !delivered ? <button className="button button-glass" type="button" onClick={() => generate(true)} disabled={Boolean(busy)}>Regenerar com Agent911</button> : null}
            {draft ? <button className="button button-glass" type="button" onClick={() => window.print()} disabled={Boolean(busy)}><FileText size={15} /> Imprimir / salvar PDF</button> : null}
            {draft && !delivered ? <label className="button button-glass astral-admin-upload">Anexar PDF revisado<input type="file" accept="application/pdf" onChange={upload} disabled={Boolean(busy)} /></label> : null}
            {record.order.pdfReady ? <button className="button button-glass" type="button" onClick={openUploadedPdf} disabled={Boolean(busy)}>Conferir PDF anexado</button> : null}
            {record.order.pdfReady && !delivered && !confirmingDelivery ? <button className="button button-primary" type="button" onClick={() => setConfirmingDelivery(true)} disabled={Boolean(busy)}><CheckCircle2 size={16} /> Aprovar e enviar</button> : null}
          </div>
          {confirmingDelivery ? <div className="astral-admin-confirm"><strong>Última conferência</strong><p>O PDF será enviado para <b>{record.order.email}</b> e as 5 perguntas serão liberadas. Essa é a entrega real.</p><button className="button button-primary" type="button" onClick={approve} disabled={Boolean(busy)}>Sim, aprovar e enviar</button><button className="text-button" type="button" onClick={() => setConfirmingDelivery(false)} disabled={Boolean(busy)}>Voltar e revisar</button></div> : null}
          {busy ? <p className="astral-admin-feedback">Processando: {busy}…</p> : null}
          {message ? <p className="astral-admin-feedback is-success">{message}</p> : null}
          {error ? <p className="astral-admin-feedback is-error">{error}</p> : null}
          {!delivered ? <label className="astral-admin-note">Nota interna de revisão<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} rows={3} placeholder="O que você quer ajustar antes da entrega?" /></label> : null}
          {draft ? <div className="astral-admin-editors"><div className="astral-admin-editors-head"><span>Editor página por página</span><small>{dirty ? "alterações ainda não salvas" : `versão ${record.order.draftVersion}`}</small></div>{draft.pages.map((page, index) => <EditablePage key={page.number} page={page} onChange={(field, value) => updatePage(index, field, value)} />)}</div> : null}
          <DocumentPreview draft={draft} />
        </>}
      </section>
    </div>
  </main>;
}
