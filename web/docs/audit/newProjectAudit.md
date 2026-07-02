# Critique: projects/new

**Target:** `components/projects/new-project-page.tsx`
**Date:** 2026-05-28
**Register:** Product
**Detector:** Clean — 0 findings (27 pattern checks passed)

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Dict fetch is silent; "Criando…" is the only async signal; no backend progress |
| 2 | Match System / Real World | 3 | "Contexto para IA" is abstract; "Normalizar" needs definition for new users |
| 3 | User Control and Freedom | 2 | Cancel exists; no unsaved-changes warning; contenteditable Enter blurs silently |
| 4 | Consistency and Standards | 3 | Textareas have no borders (unconventional for tools); mixed font sourcing |
| 5 | Error Prevention | 2 | Raw API `detail` string shown as error; no navigation guard on partial fill |
| 6 | Recognition Rather Than Recall | 2 | Dict→form connection is invisible; applying entries has hidden side-effects |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no duplicate-from-existing project |
| 8 | Aesthetic and Minimalist Design | 3 | Placeholder output-file slot is visual noise during creation |
| 9 | Error Recovery | 2 | Error is a raw API string; no field-level validation |
| 10 | Help and Documentation | 1 | No contextual help anywhere; dict panel has no affordance explaining its effects |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**AI slop:** Passes. No gradient text, glassmorphism, hero metrics, or identical card grids. The contenteditable `h1` is a personality choice that works. The restrained color strategy is correct for a professional data tool.

**Automated scan:** `[]` — clean on all 27 patterns. Problems here are interaction design and IA failures, not visual slop.

---

## Overall Impression

The page looks credible but undersells the configuration it enables. A user is setting up the one project that will process all their future uploads — a consequential, configure-once action — and the form feels as uneventful as editing a text note. The biggest opportunity: make the three distinct concerns (metadata / AI processing config / file management) legible as separate sections, and make the dictionary panel's effects on the form _visible_ rather than invisible.

---

## What's Working

**1. Contenteditable title.** Using `contentEditable` on the `h1` avoids a clunky form field at the top. It signals this is an artifact being created, not a bureaucratic form being submitted. Correct decision.

**2. Dictionary panel — the idea.** A right-panel of reusable config entries that inject into the form is genuinely powerful. The applied/unapplied state tracking per entry is well-implemented.

**3. Restrained color strategy.** Tinted neutrals, one semantic accent, type-specific panel colors that are low-key by default. Doesn't overwhelm on first load.

---

## Priority Issues

### [P1] Dictionary panel effects on form fields are invisible

**What:** Applying a "Contexto" entry populates the AI Context textarea. Applying a "Categorias" entry silently checks the "Classificar" task. None of this is communicated in the UI. The `+ Aplicar` button provides no feedback about what it will do.

**Why it matters:** Users will apply entries without understanding the cascade. They'll find a filled-in AI Context field and not know where the text came from, or find "Classificar" suddenly checked without remembering why. Precision is this product's core value; invisible side-effects undermine it.

**Fix:** Add a one-line effect descriptor inside each dict card: *"Preenche o campo Contexto para IA"* / *"Ativa a tarefa Classificar"*. On apply, briefly highlight the target field (150ms color pulse on the textarea border or the task card). The connection must be visible.

**Suggested command:** `/impeccable clarify`

---

### [P1] No section grouping — three concerns compete equally

**What:** Project metadata (title/description), AI processing config (context + tasks), and file management (upload/output) are separated only by `1px borderTop` lines. Every section has the same visual weight.

**Why it matters:** Users scanning the page can't quickly locate "where do I configure what the AI does" vs "where do I manage files." Cognitive load checklist: 5/8 failures. The three sections map to three different mental models; the UI treats them as a flat list.

**Fix:** Group sections with a label hierarchy that visually anchors each group. Consider a subtle background tint on the AI config group to signal it's the "intelligence" portion vs the administrative portion. Not nested cards — section headings.

**Suggested command:** `/impeccable layout`

---

### [P2] Placeholder output slot is noise during creation

**What:** "Arquivo de saída — Disponível após a primeira execução" is displayed during project creation for layout symmetry with the upload slot. It communicates nothing actionable.

**Why it matters:** It forces a cognitive halt: "Wait, should I configure this? Oh, it's disabled." Empty affordances erode trust. For a tool whose value proposition is output quality, a locked placeholder is an awkward first impression.

**Fix:** Remove it entirely from the creation flow. It belongs on the project detail page, post-creation. The upload slot can take full width or be paired with a brief inline note: *"O arquivo processado estará disponível após a primeira execução."*

**Suggested command:** `/impeccable distill`

---

### [P2] Form fields have no focus indicators

**What:** `ProjectField` textareas are fully transparent (`border: none; background: transparent`) with no focus ring defined.

**Why it matters:** Keyboard navigators cannot tell which field is active. Breaks WCAG 2.1 AA 2.4.7 (Focus Visible) and the product's own stated accessibility commitment.

**Fix:** Add a `focus-within` border on the wrapper, or a `::focus` style via the `new-project-field` CSS class. A `border-bottom: 1.5px solid var(--primary-500)` on focus is sufficient.

**Suggested command:** `/impeccable audit`

---

### [P2] Error message surfaces raw API strings

**What:** `setCreateError(err.response?.data?.detail ?? "Erro ao criar projeto.")` — raw FastAPI validation errors or HTTP exception strings appear verbatim.

**Why it matters:** "422 Unprocessable Entity" or "Field required: name" will appear as-is. Design principle #5 ("Precision as a value") is violated by ambiguous error copy.

**Fix:** Map common error states to user-readable messages ("Já existe um projeto com este nome", "Erro de conexão — tente novamente"). Fall back to a specific actionable message, never raw API output.

**Suggested command:** `/impeccable harden`

---

## Persona Red Flags

**Priya (power user — configures once, reuses forever)**
- Applies a "Categorias" dict entry; "Classificar" task silently becomes checked. Doesn't notice. Creates the project. Later discovers classification ran on the wrong column. No audit trail of how the task was enabled.
- Wants to duplicate a previous project configuration. No such affordance exists — fills in the form again from scratch.
- Tabs through fields with keyboard. `ProjectField` textareas have no visible focus state; she cannot tell which field is active.

**Marco (first-time user — first project, no prior training)**
- Sees "Contexto para IA." Doesn't know if it's required or optional, or what "contexto" means in this domain. The hint says "Descreva o contexto..." but provides no example.
- Looks at the right panel. Sees "Dicionário" grouped by "Contexto IA / Categorias / Mapeamentos." Has no idea what applying any of these does until he tries one.
- After applying a context entry, the AI Context field fills with text he didn't write. Doesn't know if he should edit it, keep it, or remove it.
- Creates the project. Gets a server error. Reads "422 Unprocessable Entity." Doesn't know what to fix.

---

## Minor Observations

- `handleFiles` assigns `Math.random()` for row count on upload — prototype code that must be replaced with real CSV/XLSX row parsing before shipping.
- Error color `#ef4444` is hardcoded, bypassing the token system. Should use `var(--error)` or equivalent semantic token.
- `font-family: "Inter, Arial, sans-serif"` is hardcoded in `ProjectField` while the rest of the page uses CSS vars. If the body font changes, this field won't follow.
- The `+ Aplicar` / `✓ Aplicado` text prefix could use Lucide `Plus`/`Check` icons to match the icon system already used in `task-card.tsx`.
- `role="heading" aria-level={1}` on a `contentEditable` div is non-standard; some screen readers may announce it oddly when editing.

---

## Questions to Consider

- **What if the dict panel were opt-in?** A collapsed "Aplicar do Dicionário" toggle would reduce overwhelm for first-time users while keeping the power accessible for experts.
- **Does the output slot need to exist here at all?** A one-line note under the upload slot would achieve the same communication at zero visual cost.
- **What would a more intentional creation flow look like?** This is the one configuration that governs all future runs. Would a labeled three-section structure (1. Projeto / 2. Configuração IA / 3. Arquivo) give users a stronger sense of scope without becoming a wizard?
