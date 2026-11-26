import { useEffect, useMemo, useState } from "react";
import {
  api,
  htmlToText,
  type Card,
  type CardSummary,
  type Evaluation,
  type Health,
  type ScenarioSet,
  type ScenarioType,
  type Verdict,
} from "./api";

const TYPE_LABEL: Record<ScenarioType, string> = {
  feliz: "Caminho feliz",
  alternativo: "Alternativo",
  erro: "Erro",
  limite: "Limite",
};

const VERDICTS: { id: Verdict; label: string }[] = [
  { id: "util", label: "Útil como está" },
  { id: "editado", label: "Precisei editar" },
  { id: "descartado", label: "Descartei" },
];

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [filter, setFilter] = useState("");
  const [listError, setListError] = useState("");

  const [card, setCard] = useState<Card | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioSet | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [published, setPublished] = useState<{ published: boolean; html: string } | null>(null);

  const [busy, setBusy] = useState<"" | "card" | "evaluate" | "scenarios" | "publish">("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.health().then(setHealth).catch((e) => setListError(e.message));
    api.cards().then(setCards).catch((e) => setListError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? cards.filter((c) => String(c.id).includes(f) || c.title.toLowerCase().includes(f)) : cards;
  }, [cards, filter]);

  async function run<T>(kind: typeof busy, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(kind);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function openCard(id: number) {
    const c = await run("card", () => api.card(id));
    if (!c) return;
    setCard(c);
    setEvaluation(null);
    setScenarios(null);
    setVerdicts({});
    setPublished(null);
  }

  async function evaluate() {
    if (!card) return;
    const ev = await run("evaluate", () => api.evaluate(card.id));
    if (ev) {
      setEvaluation(ev);
      setScenarios(null);
      setPublished(null);
    }
  }

  async function generate(force = false) {
    if (!card) return;
    const set = await run("scenarios", () => api.scenarios(card.id, evaluation, force));
    if (set) {
      setScenarios(set);
      setVerdicts({});
      setPublished(null);
    }
  }

  async function publish() {
    if (!card) return;
    const res = await run("publish", () => api.publish(card.id, evaluation, scenarios));
    if (res) setPublished(res);
  }

  async function giveFeedback(title: string, verdict: Verdict) {
    if (!card) return;
    setVerdicts((v) => ({ ...v, [title]: verdict }));
    await api.feedback(card.id, title, verdict).catch((e) => setError(e.message));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">Card Validator</span>
          <span className="tag">PoC · Peers</span>
        </div>
        {health && (
          <div className="status">
            <span className={`pill ${health.mode}`}>
              {health.mode === "azdo" ? `Azure DevOps · ${health.project}` : "Modo demo · cards de exemplo"}
            </span>
            {health.aiMock ? (
              <span className="pill warn" title="Respostas prontas, sem chamar a API do Claude">IA simulada</span>
            ) : (
              <span className="pill muted">
                {health.provider === "gemini" ? "Gemini" : "Claude"} · {health.model}
              </span>
            )}
            {health.provider === "gemini" && (
              <span className="pill warn" title="No free tier, o Google pode usar os dados enviados para melhorar os produtos dele">
                Free tier: só cards de teste
              </span>
            )}
          </div>
        )}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = Number(filter.trim());
              if (Number.isInteger(id) && id > 0) openCard(id);
            }}
          >
            <input
              className="search"
              placeholder="Buscar ou digitar ID + Enter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </form>
          {listError && <p className="error small">{listError}</p>}
          <ul className="card-list">
            {filtered.map((c) => (
              <li key={c.id}>
                <button className={card?.id === c.id ? "active" : ""} onClick={() => openCard(c.id)}>
                  <span className="id">#{c.id}</span>
                  <span className="title">{c.title}</span>
                  <span className="meta">
                    {c.type} · {c.state}
                  </span>
                </button>
              </li>
            ))}
            {!filtered.length && !listError && <li className="empty">Nenhum card encontrado.</li>}
          </ul>
        </aside>

        <main className="main">
          {error && <div className="error banner">{error}</div>}
          {!card && <Empty loading={busy === "card"} />}

          {card && (
            <>
              <section className="panel">
                <div className="card-head">
                  <div>
                    <span className="id">#{card.id}</span> <span className="meta">{card.type} · {card.state}</span>
                    <h1>{card.title}</h1>
                  </div>
                  {card.url && (
                    <a href={card.url} target="_blank" rel="noreferrer" className="link">
                      Abrir no DevOps ↗
                    </a>
                  )}
                </div>
                <div className="card-body">
                  <div>
                    <h4>Descrição</h4>
                    <p className="pre">{htmlToText(card.description) || <i>vazio</i>}</p>
                  </div>
                  <div>
                    <h4>Critérios de aceite</h4>
                    <p className="pre">{htmlToText(card.acceptanceCriteria) || <i>vazio</i>}</p>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="step-head">
                  <h2>
                    <span className="num">1</span> Qualidade do card
                  </h2>
                  <button className="primary" onClick={evaluate} disabled={!!busy}>
                    {busy === "evaluate" ? "Avaliando…" : evaluation ? "Avaliar de novo" : "Avaliar card"}
                  </button>
                </div>
                {evaluation && <EvaluationView ev={evaluation} />}
              </section>

              <section className="panel">
                <div className="step-head">
                  <h2>
                    <span className="num">2</span> Cenários de teste
                  </h2>
                  <div className="actions">
                    {evaluation && !evaluation.passed && (
                      <button onClick={() => generate(true)} disabled={!!busy}>
                        Gerar mesmo assim
                      </button>
                    )}
                    <button
                      className="primary"
                      onClick={() => generate(false)}
                      disabled={!!busy || !evaluation || !evaluation.passed}
                      title={!evaluation ? "Avalie o card primeiro" : !evaluation.passed ? "Nota abaixo da mínima" : ""}
                    >
                      {busy === "scenarios" ? "Gerando…" : scenarios ? "Gerar de novo" : "Gerar cenários"}
                    </button>
                  </div>
                </div>
                {!evaluation && <p className="hint">Avalie o card primeiro. Os cenários são liberados quando a nota atinge a mínima.</p>}
                {evaluation && !evaluation.passed && !scenarios && (
                  <p className="hint">
                    Nota {evaluation.score} abaixo da mínima ({evaluation.minScore}). O ideal é responder às perguntas no
                    refinamento antes de gerar os cenários.
                  </p>
                )}
                {scenarios && (
                  <ScenariosView
                    set={scenarios}
                    verdicts={verdicts}
                    onVerdict={giveFeedback}
                    onDownload={() => api.downloadFeature(card.id, scenarios).catch((e) => setError(e.message))}
                  />
                )}
              </section>

              <section className="panel">
                <div className="step-head">
                  <h2>
                    <span className="num">3</span> Publicar no card
                  </h2>
                  <button className="primary" onClick={publish} disabled={!!busy || (!evaluation && !scenarios)}>
                    {busy === "publish" ? "Publicando…" : health?.mode === "azdo" ? "Comentar no card" : "Ver prévia do comentário"}
                  </button>
                </div>
                <p className="hint">Publica a nota, as perguntas e os cenários como comentário no work item.</p>
                {published && (
                  <>
                    <p className={published.published ? "ok" : "hint"}>
                      {published.published
                        ? "✓ Comentário publicado no Azure DevOps."
                        : "Modo demo: nada foi publicado. Prévia do comentário:"}
                    </p>
                    {/* HTML montado pelo servidor; todo texto vindo do card/IA já é escapado em comment.ts */}
                    <div className="preview" dangerouslySetInnerHTML={{ __html: published.html }} />
                  </>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return (
    <div className="empty-state">
      <h2>{loading ? "Carregando card…" : "Escolha um card"}</h2>
      <p>
        Selecione um card na lista ou digite o ID. Depois: <b>1.</b> avalie a qualidade, <b>2.</b> gere os cenários,{" "}
        <b>3.</b> publique no card.
      </p>
    </div>
  );
}

function EvaluationView({ ev }: { ev: Evaluation }) {
  const tone = ev.passed ? "good" : ev.score >= ev.minScore * 0.6 ? "mid" : "bad";
  return (
    <div className="evaluation">
      <div className="score-row">
        <div className={`score ${tone}`}>
          <span className="value">{ev.score}</span>
          <span className="of">/100</span>
        </div>
        <div>
          <span className={`badge ${tone}`}>{ev.passed ? "Pronto para desenvolvimento" : "Precisa de refinamento"}</span>
          <p className="summary">{ev.summary}</p>
          <p className="meta">
            Nota mínima {ev.minScore} · rubrica v{ev.rubricVersion}
          </p>
        </div>
      </div>

      <ul className="criteria">
        {ev.criteria.map((c) => (
          <li key={c.id}>
            <div className="crit-head">
              <span className="dots" aria-label={`${c.score} de 2`}>
                {[0, 1].map((i) => (
                  <span key={i} className={`dot ${i < c.score ? "on" : ""} s${c.score}`} />
                ))}
              </span>
              <b>{c.name}</b>
              <span className="meta">peso {c.weight}</span>
            </div>
            <p>{c.justification}</p>
          </li>
        ))}
      </ul>

      {ev.questions.length > 0 && (
        <div className="questions">
          <h4>Perguntas para o refinamento</h4>
          <ol>
            {ev.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ScenariosView({
  set,
  verdicts,
  onVerdict,
  onDownload,
}: {
  set: ScenarioSet;
  verdicts: Record<string, Verdict>;
  onVerdict: (title: string, v: Verdict) => void;
  onDownload: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const featureText = `# language: pt\nFuncionalidade: ${set.feature}\n\n${set.scenarios.map((s) => s.gherkin).join("\n\n")}`;
  const counts = set.scenarios.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.type]: (acc[s.type] ?? 0) + 1 }), {});

  return (
    <div className="scenarios">
      <div className="scen-toolbar">
        <span>
          <b>{set.scenarios.length}</b> cenários ·{" "}
          {Object.entries(counts)
            .map(([t, n]) => `${n} ${TYPE_LABEL[t as ScenarioType].toLowerCase()}`)
            .join(" · ")}
        </span>
        <div className="actions">
          <button
            onClick={() => {
              navigator.clipboard.writeText(featureText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copiado ✓" : "Copiar tudo"}
          </button>
          <button onClick={onDownload}>Baixar .feature</button>
        </div>
      </div>

      {set.scenarios.map((s) => (
        <article key={s.title} className="scenario">
          <div className="scen-head">
            <span className={`type ${s.type}`}>{TYPE_LABEL[s.type]}</span>
            <b>{s.title}</b>
          </div>
          <pre>{s.gherkin}</pre>
          <div className="feedback">
            <span className="meta">Avaliação do QA:</span>
            {VERDICTS.map((v) => (
              <button
                key={v.id}
                className={`chip ${verdicts[s.title] === v.id ? "selected " + v.id : ""}`}
                onClick={() => onVerdict(s.title, v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </article>
      ))}

      {set.gaps.length > 0 && (
        <div className="gaps">
          <h4>Cenários que ficaram de fora por falta de informação</h4>
          <ul>
            {set.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
