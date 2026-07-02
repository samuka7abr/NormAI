# NormAI — Documentação de Implementação

> Referência técnica e de design para implementar as páginas da plataforma. Complementa `docs/designclaude.md` (especificação) e `DESIGN.md` (sistema de design).
>
> Registro: **product** — o design serve o fluxo de trabalho. A interface deve desaparecer na tarefa.

---

## 1. Arquitetura de componentes

### 1.1. Mapa de rotas e componentes

```
app/(dashboard)/
├── layout.tsx                  → <Sidebar> + <main>                [IMPLEMENTADO]
├── page.tsx                    → redirect → /projects
├── projects/
│   ├── page.tsx                → <ProjectsHome>                    [STUB]
│   ├── new/page.tsx            → redirect após criar
│   └── [id]/
│       ├── page.tsx            → <ProjectPage>                     [STUB]
│       ├── config/page.tsx     → <ProjectConfigPage>
│       └── reports/
│           ├── new/page.tsx    → <NewReportPage>
│           └── [reportId]/
│               └── page.tsx   → <ReportDetailPage>
└── dictionary/page.tsx        → <DictionaryPage>

components/
├── layout/
│   └── sidebar.tsx             [IMPLEMENTADO — ver seção 5]
├── projects/
│   ├── project-list.tsx        → lista de projetos com filtros
│   ├── project-card.tsx        → linha da lista (grid 5 colunas)
│   ├── create-project-dialog.tsx
│   └── delete-project-dialog.tsx
├── reports/
│   ├── upload-dropzone.tsx     → slot de upload (2 estados)
│   ├── report-card.tsx         → slot de download (3 estados)
│   ├── processing-progress.tsx → pill animada
│   ├── feedback-form.tsx       → aprovado/rejeitado
│   ├── download-button.tsx     → CTA download
│   └── report-list.tsx
├── config/
│   ├── column-config-panel.tsx → drawer de configuração de colunas
│   ├── column-preview.tsx      → tabela pandas-style
│   ├── normalization-checkboxes.tsx
│   └── category-input.tsx
└── ui/                         → primitivos (button, input, badge, etc.)
```

### 1.2. Hierarquia de estado

| Dado | Tipo | Onde vive | Motivo |
|---|---|---|---|
| Lista de projetos | servidor | fetch em `projects/page.tsx` | Next.js Server Component |
| Projeto atual | servidor | fetch em `projects/[id]/page.tsx` | SSR com revalidação |
| Tema (light/dark) | localStorage + `data-theme` | `Sidebar` (já implementado) | Client-side persist |
| Sidebar expandida | `useState` local | `Sidebar` | Sem necessidade de compartilhar |
| Search query | `useState` local | `Sidebar` | Apenas filtra lista local |
| Drawer aberto | `useState` local | `ProjectPage` | Escopo de página |
| Colunas marcadas | server action / mutation | API + estado local otimista | Persiste entre sessões |
| Estado de processamento | polling ou SSE | `ReportDetailPage` | Job assíncrono real |

**Regra:** não use Context para estado que vive em servidor. Use Context apenas se dois componentes irmãos (sem ancestral comum próximo) precisam do mesmo estado de UI efêmero.

---

## 2. Home — `/projects`

### 2.1. Layout

```
┌─────────────────────────────────────────────────────┐
│  HEADER ROW                                          │
│  "Olá, Felipe."  [36px/700/−0.03em Inter]   [+ Novo projeto]│
│                                                     │
│  STATS BAR  [4 métricas separadas por border]        │
│                                                     │
│  SECTION HEADER                                     │
│  PROJETOS [uppercase/12px/600]      [Todos] [Com relatório] [Sem upload]│
│                                                     │
│  PROJECT ROWS (lista)                               │
│  …                                                  │
└─────────────────────────────────────────────────────┘
```

**Padding da page:** `padding: 40px 48px` (desktop). Nunca `padding: 32px` uniforme — o ritmo vertical exige mais espaço no topo.

### 2.2. Header row

```tsx
<header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "32px" }}>
  <h1 style={{
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "28px",           // reduzido de 36px: menos drama, mais instrumental
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
    color: "var(--text-default)",
    margin: 0,
  }}>
    Olá, {user.name.split(" ")[0]}.
  </h1>
  <button className="btn-primary" style={{ gap: "6px" }}>
    <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
    Novo projeto
  </button>
</header>
```

**Nota:** `alignItems: "baseline"` alinha o botão com a base do texto, não com o centro. Mais preciso visualmente.

### 2.3. Barra de estatísticas

**Não são metric cards.** São quatro valores separados por `border-right: 1px solid var(--border-default)` numa linha única. O último não tem borda direita.

```tsx
<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  borderTop: "1px solid var(--border-default)",
  borderBottom: "1px solid var(--border-default)",
  marginBottom: "32px",
}}>
  {stats.map((s, i) => (
    <div key={s.label} style={{
      padding: "16px 24px",
      borderRight: i < 3 ? "1px solid var(--border-default)" : "none",
    }}>
      <div style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-default)" }}>
        {s.value}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
        {s.label}
      </div>
    </div>
  ))}
</div>
```

| Métrica | Cálculo | Formato |
|---|---|---|
| Projetos | `projects.length` | número inteiro |
| Com relatório | projetos com `reports.length > 0` | número inteiro |
| Normalizações | soma de `reports.length` de todos os projetos | número inteiro |
| Linhas processadas | soma de `report.rowCount` em milhares | `"120k"` |

**Proibido:** fundo colorido nas células, ícones decorativos, valores com gradiente.

### 2.4. Seção de projetos + filtros

```tsx
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
  <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase" }}>
    Projetos
  </span>
  <SegmentedFilter value={filter} onChange={setFilter} options={FILTERS} />
</div>
```

**`SegmentedFilter`** — não use tabs ou radio buttons estilizados de forma custom. Use um componente simples:

```tsx
// CSS inline — NÃO adicionar ao globals.css (único uso)
const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "with-report", label: "Com relatório" },
  { value: "no-upload", label: "Sem upload" },
];

function SegmentedFilter({ value, onChange, options }) {
  return (
    <div role="group" aria-label="Filtrar projetos" style={{
      display: "flex",
      gap: "2px",
      background: "var(--bg-subtle)",
      borderRadius: "8px",
      padding: "3px",
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            padding: "4px 12px",
            borderRadius: "6px",
            border: "none",
            fontSize: "13px",
            fontWeight: value === opt.value ? 500 : 400,
            background: value === opt.value ? "var(--bg-surface)" : "transparent",
            color: value === opt.value ? "var(--text-default)" : "var(--text-muted)",
            cursor: "pointer",
            boxShadow: value === opt.value ? "var(--box-shadow)" : "none",
            transition: "background 150ms ease, color 150ms ease",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

### 2.5. Lista de projetos (grid 5 colunas)

**Não são cards.** São linhas de tabela com hover. Use `<ul>` + `<li>` semântico.

```
grid-template-columns: 1fr 28px 80px 120px 24px
```

| Col | Conteúdo | Alinhamento |
|---|---|---|
| 1 | Título (500/14px) + descrição truncada (12px, muted, 1 linha) | esquerda |
| 2 | Dot colorido (status) | centro |
| 3 | `N norm.` (12px, muted) | direita |
| 4 | Data relativa (12px, muted) | direita |
| 5 | `›` chevron (muted) | centro |

```tsx
// Cores do dot de status
const STATUS_COLOR = {
  active: "#22c55e",    // green-500 — tem relatório recente
  pending: "#f59e0b",   // amber-500 — upload sem processamento
  empty: "#d1d5db",     // gray-300 — sem upload
};
```

**Estados da linha:**

```css
/* Adicionar ao globals.css na seção Dashboard */
.project-row {
  display: grid;
  grid-template-columns: 1fr 28px 80px 120px 24px;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-default);
  transition: background 150ms ease;
  gap: 8px;
}
.project-row:hover { background: var(--bg-subtle); }
.project-row:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}
```

**Estado vazio (sem projetos):**

```tsx
<div style={{ padding: "48px 0", textAlign: "center" }}>
  <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
    Nenhum projeto ainda.
  </p>
  <button className="btn-primary" style={{ marginTop: "16px" }}>
    Criar Projeto
  </button>
</div>
```

**Estado loading:** use skeleton rows — 3 linhas com `background: var(--bg-subtle)`, `borderRadius: 6px`, `height: 44px`, animação `pulse` (já definida no globals.css).

---

## 3. Página de Projeto — `/projects/[id]`

### 3.1. Layout geral

```
padding: 40px 48px
max-width: 800px   ← âncora de conforto de leitura; NÃO full-width
```

```
Breadcrumbs
────────────────
Título editável inline        [linha meta]
────────────────
Descrição (textarea 88px)
Contexto para IA (textarea 140px)
────────────────
Tarefas (grid 2 cards)
────────────────
Banco de dados (grid 2 slots)
```

### 3.2. Breadcrumbs

```tsx
<nav aria-label="Breadcrumb" style={{ marginBottom: "24px" }}>
  <ol style={{ display: "flex", alignItems: "center", gap: "6px", listStyle: "none", margin: 0, padding: 0 }}>
    <li>
      <Link href="/projects" style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}>
        Projetos
      </Link>
    </li>
    <li aria-hidden="true" style={{ color: "var(--text-muted)", fontSize: "13px" }}>·</li>
    <li style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
      Configuração do projeto
    </li>
  </ol>
</nav>
```

### 3.3. Título editável inline

```tsx
"use client";
const [title, setTitle] = useState(project.title);
const [dirty, setDirty] = useState(false);

<h1
  contentEditable
  suppressContentEditableWarning
  onInput={(e) => { setTitle(e.currentTarget.textContent ?? ""); setDirty(true); }}
  onBlur={async () => { if (dirty) { await updateProjectTitle(project.id, title); setDirty(false); } }}
  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
  style={{
    fontSize: "22px",
    fontWeight: 600,
    letterSpacing: "-0.025em",
    color: "var(--text-default)",
    outline: "none",
    borderBottom: "1px solid transparent",
    paddingBottom: "2px",
    transition: "border-color 150ms ease",
    cursor: "text",
    margin: 0,
  }}
  onFocus={(e) => { (e.target as HTMLElement).style.borderBottomColor = "var(--border-focus)"; }}
  onBlurCapture={(e) => { (e.target as HTMLElement).style.borderBottomColor = "transparent"; }}
  role="heading"
  aria-level={1}
/>
```

**Não** use `<input>` — o `contentEditable` em `h1` preserva a semântica de heading e escala naturalmente com o conteúdo.

### 3.4. Linha meta

```tsx
<div style={{ display: "flex", gap: "16px", marginTop: "6px", marginBottom: "32px" }}>
  {[
    `${project.runs} execuções`,
    `Última run: ${formatRelativeDate(project.lastRun)}`,
    `ID: ${project.id}`,
  ].map((item) => (
    <span key={item} style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item}</span>
  ))}
</div>
```

### 3.5. Campos de texto

```tsx
// Rótulo + textarea — padrão para ambos os campos
function ProjectField({ label, hint, icon, value, onChange, rows }: FieldProps) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
        {icon}
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={hint}
        rows={rows}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "10px 12px",
          fontSize: "14px",
          lineHeight: 1.5,
          color: "var(--text-default)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          outline: "none",
          transition: "border-color 150ms ease",
          fontFamily: "Inter, Arial, sans-serif",
        }}
        onFocus={e => e.target.style.borderColor = "var(--border-focus)"}
        onBlur={e => e.target.style.borderColor = "var(--border-default)"}
      />
    </div>
  );
}
```

| Campo | `rows` equivalente | `hint` |
|---|---|---|
| Descrição | `height: 88px` (não use rows) | `""` (sem placeholder) |
| Contexto para IA | `height: 140px` | `"Instruções aplicadas a todas as execuções"` |

O campo "Contexto para IA" usa `<Sparkles size={13} style={{ color: "var(--primary-700)" }} />` no rótulo.

### 3.6. Task cards (Normalizar / Classificar)

```tsx
// Estado checked: borda verde + fundo tintado + checkmark
function TaskCard({ id, label, description, checked, onChange }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        padding: "16px 20px",
        borderRadius: "10px",
        border: `1px solid ${checked ? "var(--primary-700)" : "var(--border-default)"}`,
        background: checked ? "rgba(0, 107, 90, 0.04)" : "var(--bg-surface)",
        cursor: "pointer",
        transition: "border-color 150ms ease, background 150ms ease",
        userSelect: "none",
      }}
    >
      <div
        role="checkbox"
        id={id}
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); } }}
        onClick={() => onChange(!checked)}
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "4px",
          border: `1.5px solid ${checked ? "var(--primary-700)" : "var(--border-strong)"}`,
          background: checked ? "var(--primary-700)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "1px",
          transition: "background 150ms ease, border-color 150ms ease",
        }}
      >
        {checked && <Check size={11} strokeWidth={2.5} color="#ffffff" />}
      </div>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-default)" }}>{label}</div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px", lineHeight: 1.45 }}>{description}</div>
      </div>
    </label>
  );
}
```

Grid dos cards:
```tsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
  <TaskCard id="task-normalize" label="Normalizar" description="Capitalização PT-BR, abreviar, remover sufixos, tratar nulos, split por separador." checked={tasks.normalize} onChange={v => setTasks(t => ({...t, normalize: v}))} />
  <TaskCard id="task-classify" label="Classificar" description="Cria coluna nova com a categoria de cada valor. IA — categorias definidas ou inferidas." checked={tasks.classify} onChange={v => setTasks(t => ({...t, classify: v}))} />
</div>
```

### 3.7. File slots — Banco de dados

```
grid-template-columns: 1fr 1fr
gap: 16px
```

#### Slot de Upload — 3 estados

**Vazio:**
```tsx
<div
  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={handleDrop}
  onClick={() => fileInputRef.current?.click()}
  style={{
    border: `1.5px dashed ${dragOver ? "var(--primary-700)" : "var(--border-default)"}`,
    borderRadius: "10px",
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    background: dragOver ? "rgba(0, 107, 90, 0.03)" : "transparent",
    transition: "border-color 150ms ease, background 150ms ease",
    textAlign: "center",
  }}
>
  <UploadCloud size={24} strokeWidth={1.4} style={{ color: "var(--text-muted)" }} />
  <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>Arraste um CSV ou XLSX</span>
  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>ou clique para selecionar do computador</span>
</div>
```

**Preenchido:**
```tsx
<div
  onClick={openDrawer}
  style={{
    border: "1px solid var(--border-default)",
    borderRadius: "10px",
    background: "var(--bg-surface)",
    cursor: "pointer",
    boxShadow: "var(--box-shadow)",
    transition: "border-color 150ms ease",
  }}
>
  {/* Header do card */}
  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
    <FileText size={18} strokeWidth={1.4} style={{ color: "var(--primary-700)", flexShrink: 0 }} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {file.name}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
        {formatRows(file.rows)} linhas · {formatSize(file.size)} · {formatRelativeDate(file.uploadedAt)}
      </div>
    </div>
  </div>
  {/* Footer com link substituir */}
  <div style={{ borderTop: "1px solid var(--border-default)", padding: "8px 16px" }}>
    <button
      onClick={e => { e.stopPropagation(); triggerReplace(); }}
      style={{ fontSize: "12px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      Substituir arquivo
    </button>
  </div>
</div>
```

#### Slot de Download — 3 estados

| Estado | Condição | UI |
|---|---|---|
| Não gerado | sem upload ou sem task ativa | botão "Processar agora" desabilitado |
| Processando | `status === "processing"` | pill animada com pulse |
| Pronto | `normalizedFile !== null` | card idêntico ao upload com sparkles icon |

**Processando:**
```tsx
<div style={{ padding: "24px", display: "flex", justifyContent: "center" }}>
  <div style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    borderRadius: "20px",
    background: "rgba(0, 107, 90, 0.08)",
    animation: "pulse 1.4s ease-in-out infinite",
  }}>
    <Loader2 size={14} strokeWidth={2} style={{ color: "var(--primary-700)", animation: "spin 1s linear infinite" }} />
    <span style={{ fontSize: "13px", color: "var(--primary-700)" }}>Gerando arquivo…</span>
  </div>
</div>
```

Adicionar ao globals.css:
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### 3.8. Lógica de processamento

```tsx
async function handleProcess() {
  if (!uploadedFile || (!tasks.normalize && !tasks.classify)) return;
  setStatus("processing");
  try {
    const result = await fetch(`/api/projects/${id}/reports`, {
      method: "POST",
      body: JSON.stringify({ fileId: uploadedFile.id, tasks }),
    });
    const report = await result.json();
    setNormalizedFile(report.output);
    setStatus("done");
  } catch {
    setStatus("error");
  }
}
```

**Botão desabilitado** quando `!uploadedFile || (!tasks.normalize && !tasks.classify)`:
```tsx
<button
  onClick={handleProcess}
  disabled={!canProcess}
  style={{
    opacity: canProcess ? 1 : 0.4,
    cursor: canProcess ? "pointer" : "not-allowed",
  }}
>
  Processar agora
</button>
```

---

## 4. Database Drawer

### 4.1. Estrutura

```tsx
// Sempre renderizado no DOM; visibilidade via transform
<div
  role="dialog"
  aria-modal="true"
  aria-label={`Visualizar ${file.name}`}
  style={{
    position: "fixed",
    inset: 0,
    zIndex: 300,
    pointerEvents: open ? "auto" : "none",
  }}
>
  {/* Scrim */}
  <div
    onClick={onClose}
    style={{
      position: "absolute",
      inset: 0,
      background: "rgba(0, 12, 9, 0.35)",
      opacity: open ? 1 : 0,
      transition: "opacity 300ms ease",
    }}
  />
  {/* Painel */}
  <div
    style={{
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: "800px",
      maxWidth: "90vw",
      background: "var(--bg-surface)",
      boxShadow: "-16px 0 40px rgba(0, 0, 0, 0.10)",
      display: "flex",
      flexDirection: "column",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1)",
    }}
  >
    {/* conteúdo */}
  </div>
</div>
```

### 4.2. Cabeçalho do drawer

```tsx
<div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
    <div>
      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "4px" }}>
        {isNormalized ? "Saída normalizada" : "Upload bruto"}
      </div>
      <div style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-default)" }}>
        {file.name}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
        {file.totalRows.toLocaleString("pt-BR")} linhas · {file.columns.length} colunas · head({PREVIEW_ROWS})
      </div>
    </div>
    <button onClick={onClose} className="sb-icon-btn" aria-label="Fechar" style={{ marginTop: "-4px" }}>
      <X size={16} strokeWidth={2} />
    </button>
  </div>

  {/* Hint bar */}
  <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
      {isNormalized
        ? `Saída processada. Colunas _categoria foram criadas pela camada de classificação.`
        : "Clique no título de uma coluna para marcá-la para normalização."}
    </span>
    {!isNormalized && (
      <span style={{ fontSize: "12px", color: "var(--primary-700)", fontWeight: 500 }}>
        {markedColumns.length} marcadas
      </span>
    )}
  </div>
</div>
```

### 4.3. Tabela pandas-style

```css
/* globals.css — seção Database Drawer */
.db-table-wrap {
  overflow: auto;
  flex: 1;
}
.db-table {
  width: 100%;
  border-collapse: collapse;
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 12.5px;
  line-height: 1.4;
}
.db-table th {
  position: sticky;
  top: 0;
  background: var(--bg-subtle);
  padding: 8px 12px;
  text-align: left;
  font-weight: 500;
  font-size: 11px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-default);
  white-space: nowrap;
  cursor: default;
  transition: background 150ms ease, color 150ms ease;
  user-select: none;
}
.db-table th.clickable { cursor: pointer; }
.db-table th.clickable:hover { background: var(--bg-surface); color: var(--text-default); }
.db-table th.marked {
  background: var(--primary-700);
  color: #ffffff;
  cursor: pointer;
}
.db-table th.marked::after {
  content: "·";
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #ffffff;
  border-radius: 50%;
  margin-left: 6px;
  vertical-align: middle;
}
.db-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-default);
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.db-table td.col-index {
  position: sticky;
  left: 0;
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 11px;
  width: 40px;
  text-align: right;
}
.db-table td.null-cell {
  color: var(--text-muted);
  font-style: italic;
}
.db-table td.pipe-cell { color: #b45309; } /* amber-700 — não usar vermelho puro */
.db-table tbody tr.col-marked td { background: rgba(0, 107, 90, 0.04); color: #004d3d; }
.db-table caption {
  caption-side: bottom;
  font-size: 11px;
  color: var(--text-muted);
  padding: 8px 12px;
  text-align: left;
}
```

**Identificação de células nulas:**
```ts
const NULL_VALUES = ["NA", "Não informado", "Não aplicável", "null", "NULL", ""];
function isNull(v: string) { return NULL_VALUES.includes(v.trim()); }
function hasPipe(v: string) { return v.includes("|") || v.includes("/"); }
```

### 4.4. Rodapé do drawer

```tsx
<div style={{ borderTop: "1px solid var(--border-default)", padding: "14px 24px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
  {!isNormalized ? (
    <>
      <div style={{ fontSize: "13px", color: markedColumns.length > 0 ? "var(--text-secondary)" : "var(--text-muted)" }}>
        {markedColumns.length === 0
          ? "Marque pelo menos uma coluna para normalização."
          : (
            <>
              <span style={{ fontWeight: 500 }}>Normalizar:</span>
              {" "}
              {markedColumns.map(col => (
                <code key={col} style={{ fontSize: "11.5px", background: "var(--bg-subtle)", borderRadius: "4px", padding: "2px 5px", marginRight: "4px", fontFamily: "monospace" }}>
                  {col}
                </code>
              ))}
            </>
          )
        }
      </div>
      <button onClick={onClose} className="btn-primary" style={{ fontSize: "13px", padding: "8px 16px" }}>
        Concluir
      </button>
    </>
  ) : (
    <>
      <div />
      <a href={downloadUrl} download className="btn-primary" style={{ fontSize: "13px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
        <Download size={14} strokeWidth={2} aria-hidden="true" />
        Baixar CSV
      </a>
    </>
  )}
</div>
```

### 4.5. Toast

```tsx
// Manter no topo do componente raiz da page
function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function show(msg: string) {
    clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => setMessage(null), 2200);
  }

  return { message, show };
}

// Render (portado para body via createPortal)
{message && (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#1b3630",
      color: "#ffffff",
      fontSize: "13px",
      padding: "10px 18px",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      zIndex: 400,
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}
  >
    {message}
  </div>
)}
```

---

## 5. Sidebar — estado atual e extensões necessárias

### 5.1. O que está implementado

O `components/layout/sidebar.tsx` está funcional com:
- Colapso 56px / 248px com animação 380ms expo-out
- Tema light/dark com localStorage persist
- Lista de projetos filtrada por busca
- Search modal com Esc + focus automático
- Account overlay com posicionamento dinâmico
- Todas as classes `.sb-*` do globals.css

### 5.2. Extensões necessárias

**A. Projetos vêm da API, não são hardcoded:**
```tsx
// Remover o array PROJECTS estático
// Adicionar prop ou contexto:
interface SidebarProps {
  projects: { id: string; title: string }[];
  currentUser: { name: string; email: string; initials: string };
}
```

**B. Seção "Projetos · N" com botão `+`:**
```tsx
{expanded && (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", marginBottom: "8px" }}>
    <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>
      Projetos · {projects.length}
    </span>
    <button
      onClick={handleNewProject}
      className="sb-icon-btn"
      aria-label="Novo projeto"
      style={{ width: "20px", height: "20px" }}
    >
      <Plus size={12} strokeWidth={2.2} />
    </button>
  </div>
)}
```

**C. Badge de normalizações por projeto:**
```tsx
// sb-project-item precisa de layout flex para o badge
<Link href={`/projects/${p.id}`} className={`sb-project-item${active ? " active" : ""}`}
  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
>
  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
  {p.normalizationCount > 0 && (
    <span style={{
      fontSize: "10px",
      fontWeight: 600,
      padding: "1px 5px",
      borderRadius: "10px",
      background: "rgba(255,255,255,0.14)",
      color: "rgba(255,255,255,0.70)",
      flexShrink: 0,
      marginLeft: "6px",
    }}>
      {p.normalizationCount}
    </span>
  )}
</Link>
```

**D. Adicionar `href="/"` para "Início"** na lista `NAV`:
```tsx
const NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/projects", label: "Projetos", icon: FolderOpen },
  { href: "/dictionary", label: "Dicionário", icon: BookOpen },
];
```

---

## 6. Regras de uso do CSS

### 6.1. Classes existentes — use sem alterar

| Classe | Use em |
|---|---|
| `.sb`, `.sb-logo`, `.sb-wordmark` | Sidebar container, logo, nome |
| `.sb-divider` | Linhas divisórias horizontais da sidebar |
| `.sb-icon-btn`, `.sb-icon-link` | Botões e links ícone (collapsed) |
| `.sb-text-link`, `.sb-text-btn` | Links e botões com texto (expanded) |
| `.sb-search-field`, `.sb-search-input`, `.sb-search-icon` | Campo de busca inline |
| `.sb-project-list`, `.sb-project-item`, `.sb-project-empty` | Lista de projetos |
| `.sb-modal-overlay`, `.sb-modal-panel`, `.sb-modal-row`, `.sb-modal-input`, `.sb-modal-item`, `.sb-modal-empty`, `.sb-modal-close` | Search modal |
| `.sb-overlay`, `.sb-overlay-header`, `.sb-overlay-name`, `.sb-overlay-email`, `.sb-overlay-links`, `.sb-overlay-footer`, `.sb-overlay-item` | Account overlay |
| `.sb-avatar`, `.sb-account-btn`, `.sb-account-name`, `.sb-account-email` | Área de conta |
| `.dashboard-page-bg` | `<main>` do layout do dashboard |
| `.btn-primary` | Botões de ação primária na área de conteúdo |
| `.project-card`, `.new-project-card` | Cards de projeto (se usar grid de cards) |
| `.card-description` | Clamp 4 linhas em descrições de card |

### 6.2. Tokens semânticos — prefira sobre cores brutas

```css
/* PREFIRA */
color: var(--text-default);
background: var(--bg-surface);
border: 1px solid var(--border-default);

/* EVITE */
color: #1b3630;
background: #ffffff;
border: 1px solid #e8e8e8;
```

### 6.3. Quando escrever CSS novo

Adicione ao globals.css **apenas** quando:
1. O estilo se repete em 3+ lugares independentes
2. Precisa de overrides dark/light que seguem o padrão `html[data-theme="dark"]`

Para estilos de um único componente, use `style={}` inline. Não crie classes CSS de uso único.

### 6.4. CSS novo para adicionar ao globals.css

```css
/* ─── Projects Home ────────────────────────────────────── */
.project-row {
  display: grid;
  grid-template-columns: 1fr 28px 80px 120px 24px;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-default);
  transition: background 150ms ease;
  gap: 8px;
}
.project-row:hover { background: var(--bg-subtle); }
.project-row:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
}

/* ─── Database Drawer ──────────────────────────────────── */
/* [adicionar as classes .db-table-* da seção 4.3] */

/* ─── Animations ───────────────────────────────────────── */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## 7. Estado global — estrutura de dados

### 7.1. Tipo `Project`

```ts
// types/project.ts
export interface Project {
  id: string;
  title: string;
  description: string;
  aiContext: string;
  tasks: {
    normalize: boolean;
    classify: boolean;
  };
  columnsToNormalize: string[];
  columnsToClassify: string[];
  runs: number;
  lastRun: string | null;   // ISO 8601
  createdAt: string;        // ISO 8601
  uploadedFile: UploadedFile | null;
  normalizedFile: NormalizedFile | null;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;             // bytes
  rows: number;
  uploadedAt: string;       // ISO 8601
}

export interface NormalizedFile {
  id: string;
  name: string;             // sempre "original_normalized.csv"
  size: number;
  rows: number;
  generatedAt: string;
  downloadUrl: string;
}
```

### 7.2. Fluxo de ações

```
Ação                        → Método
────────────────────────────────────────────────────────
Listar projetos             → GET /api/projects
Criar projeto               → POST /api/projects → redirect /projects/[id]
Atualizar título            → PATCH /api/projects/[id] (debounce 800ms)
Atualizar config            → PUT /api/projects/[id]/config
Upload de arquivo           → POST /api/projects/[id]/reports (multipart)
Iniciar processamento       → POST /api/projects/[id]/reports (com fileId)
Verificar status            → GET /api/projects/[id]/reports/[reportId]
Download                    → GET /api/projects/[id]/reports/[reportId]/download
Feedback (aprovar/rejeitar) → POST /api/projects/[id]/reports/[reportId]/feedback
Marcar colunas              → PATCH /api/projects/[id]/config (columnsToNormalize)
```

### 7.3. useState vs. useContext vs. servidor

| Estado | Estratégia |
|---|---|
| Lista de projetos | `fetch` em Server Component, revalidate por tag |
| Projeto atual | `fetch` em Server Component, params `[id]` |
| Tema | `useState` + localStorage em `Sidebar` (já funciona) |
| Sidebar expanded | `useState` local em `Sidebar` |
| Drawer open/file | `useState` local em `ProjectPage` |
| Toast message | `useState` local + hook `useToast` |
| Colunas marcadas | estado local otimista + mutation para API |
| Status de processamento | `useState` + polling `setInterval` a cada 2s enquanto `status === "processing"` |

**Não crie Context** para nenhum desses. O projeto não tem estado global compartilhado entre rotas que justifique Context. O Next.js Server Components resolvem o problema de fetching.

---

## 8. Acessibilidade e navegação por teclado

### 8.1. Focus trap no Drawer

```ts
// hooks/use-focus-trap.ts
import { useEffect } from "react";

export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const el = containerRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    el.addEventListener("keydown", handler);
    first?.focus();
    return () => el.removeEventListener("keydown", handler);
  }, [active, containerRef]);
}
```

### 8.2. Fechar com Esc — padrão para todos os overlays

```ts
// hooks/use-escape.ts
export function useEscape(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    function h(e: KeyboardEvent) { if (e.key === "Escape") onEscape(); }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [active, onEscape]);
}
```

Use em: Drawer, Search Modal, Account Overlay.

### 8.3. Task cards — Space/Enter

O componente `TaskCard` da seção 3.6 já implementa:
```tsx
onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); } }}
```

**Importante:** o `e.preventDefault()` no `Space` evita scroll da página.

### 8.4. Status do dot — não dependa só de cor

```tsx
// CORRETO — cor + label visível (ou sr-only)
<div style={{ width: "8px", height: "8px", borderRadius: "50%", background: STATUS_COLOR[status], flexShrink: 0 }} />
<span className="sr-only">{STATUS_LABEL[status]}</span>

// sr-only já existe? Adicionar ao globals.css se não tiver:
// .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
```

### 8.5. Títulos de seção nos file slots

```tsx
<section aria-labelledby="upload-slot-heading">
  <h2 id="upload-slot-heading" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
    Arquivo de entrada
  </h2>
  {/* slot */}
</section>
```

### 8.6. Restore focus ao fechar overlays

```tsx
// Ao abrir drawer ou modal, salvar o elemento focado:
const previousFocusRef = useRef<HTMLElement | null>(null);

function openDrawer() {
  previousFocusRef.current = document.activeElement as HTMLElement;
  setDrawerOpen(true);
}

function closeDrawer() {
  setDrawerOpen(false);
  previousFocusRef.current?.focus();
}
```

### 8.7. `aria-live` no status de processamento

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {status === "processing" && <span>Processando arquivo…</span>}
  {status === "done" && <span>Arquivo gerado com sucesso.</span>}
  {status === "error" && <span>Falha no processamento. Tente novamente.</span>}
</div>
```

---

## 9. Checklist de implementação

Use como critério de "pronto" para cada item:

**Home `/projects`**
- [ ] Header com saudação + botão "Novo projeto"
- [ ] Barra de 4 métricas (sem cards — linha com bordas)
- [ ] Filtros segmentados funcionais (client component)
- [ ] Lista de projetos como `<ul>` + `<li>` com grid 5 colunas
- [ ] Estado vazio com CTA
- [ ] Estado loading com skeleton rows (pulse)
- [ ] Hover nas linhas com `project-row`
- [ ] Focus-visible com anel de foco

**Projeto `/projects/[id]`**
- [ ] Breadcrumbs com `<nav aria-label="Breadcrumb">`
- [ ] Título editável inline (save no blur)
- [ ] Linha meta (runs, lastRun, id)
- [ ] Campos Descrição e Contexto IA com autosave debounced
- [ ] Task cards com Space/Enter + estados visuais
- [ ] File slot upload (vazio + preenchido + drag-over)
- [ ] File slot download (3 estados + botão desabilitado correto)
- [ ] Botão "Processar" habilitado apenas com upload + task
- [ ] `aria-live` para status de processamento

**Database Drawer**
- [ ] Animação 400ms cubic-bezier(0.16, 1, 0.3, 1)
- [ ] Focus trap ativo quando aberto
- [ ] Esc fecha o drawer + restore focus
- [ ] Click no scrim fecha
- [ ] Tabela com JetBrains Mono, sticky headers, index sticky
- [ ] Headers clicáveis no CSV bruto (toggle marcado/desmarcado)
- [ ] Colunas marcadas com cor #006b5a
- [ ] Células nulas em itálico muted
- [ ] Células com `|` em amber-700
- [ ] Caption estilo pandas no rodapé
- [ ] Toast ao marcar/desmarcar coluna
- [ ] Rodapé com chips de colunas marcadas OU botão download
- [ ] `aria-live` no toast

**Sidebar**
- [ ] Projetos da API (remover hardcode)
- [ ] Seção "Projetos · N" com botão `+`
- [ ] Badge de normalizações por projeto
- [ ] Item "Início" na nav
