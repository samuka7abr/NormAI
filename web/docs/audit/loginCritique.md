# Login Page — Critique & Audit

**Target:** `app/(auth)/login/page.tsx` + `components/auth/`
**Última atualização:** 2026-05-27
**Register:** Product (auth surface serving the application)

---

## Design Health Score (Nielsen's 10)

> Critique atual — reflete o estado do código após as correções do ciclo anterior.

| # | Heurística | Score | Achado principal |
|---|---|---|---|
| 1 | Visibilidade do status | 3/4 | "Entrando..." presente; painel deslizante não confirma visualmente o clique |
| 2 | Match com o mundo real | 4/4 | PT-BR natural, microcopy fluente, erros específicos e acionáveis |
| 3 | Controle e liberdade | 3/4 | Troca de modo funciona; mobile não tem escape visível para o início |
| 4 | Consistência | 4/4 | Floating labels, focus rings, estilos de erro todos internamente consistentes |
| 5 | Prevenção de erros | 3/4 | Validação client-side funciona; mismatch de confirmação de senha só no submit |
| 6 | Reconhecimento > Recall | 3/4 | PasswordStrength visível; eye icon hover-only (invisível em touch) |
| 7 | Flexibilidade | 2/4 | Sem atalhos de teclado; tab order não auditado |
| 8 | Estética minimalista | 4/4 | Sem ruído visual; tagline concisa; cada elemento justificado |
| 9 | Recuperação de erros | 3/4 | API errors nomeados; erro de confirmPassword isolado até o submit |
| 10 | Help/Documentação | 2/4 | Sem hint contextual em regras de senha; "Esqueceu a senha?" é o único apoio |
| **Total** | | **31/40** | **Good — corrigir áreas fracas antes do release** |

---

## Audit Health Score (Técnico)

> Scan de código em 5 dimensões: acessibilidade, performance, theming, responsividade, anti-patterns.

| # | Dimensão | Score | Achado principal |
|---|---|---|---|
| 1 | Acessibilidade | 2/4 | Submit button falha contraste AA (3.77:1 light); aria-describedby ausente em inputs; link sem focus ring |
| 2 | Performance | 3/4 | Ambos os forms montados simultaneamente (CSS hide, não condicional) |
| 3 | Theming | 1/4 | 67+ hex hard-coded; zero CSS custom properties; lógica dark/light duplicada 30× |
| 4 | Responsividade | 3/4 | Eye icon e theme-toggle abaixo de 44px; forms sem padding-bottom no mobile |
| 5 | Anti-Patterns | 3/4 | Limpo; easing repetido (0.16,1,0.3,1) 3×; sem slop real |
| **Total** | | **12/20** | **Acceptable — theming e a11y precisam de atenção antes do release** |

---

## Anti-Patterns Verdict

**Parece AI-generated? Não.**

Split-panel animado com brand color emerald, par tipográfico Space Grotesk + Archivo, e redact-reveal são escolhas intencionais com personalidade. Nenhum gradient text, glassmorphism como padrão, hero-metric, side-stripe border ou card grid idêntico encontrado.

**Exceção resolvida em ciclo anterior:** `backdropFilter: blur(4px)` removido do botão "Voltar para o Início". Substituído por cor sólida semitransparente sem blur.

**Único risco:** o easing `cubic-bezier(0.16, 1, 0.3, 1)` aparece 3× (page-loader, panel slide, password-strength bar). Repetição sugere cópia de template; considere extrair para `motion-config.ts`.

---

## O que está funcionando bem

1. **Floating label + peer selectors** — 11px no topo ao focar, escala do placeholder ao centro. Elegante, sem JS, economiza espaço sem sacrificar contexto.
2. **PasswordStrength transparente** — barra segmentada em 3 partes + checklist de regras ao vivo. Usuário sabe exatamente o que está bloqueando o cadastro.
3. **Animação sincronizada ao LOADER_TOTAL_MS** — tagline redact-reveal coordenada ao final do loader, sem números mágicos, runs once per session, respeita `prefers-reduced-motion`. Raro ver motion tão bem implementado.
4. **Dark mode funcional end-to-end** — hover, focus, error, disabled todos têm variantes dark. localStorage + cookie preserva a preferência.

---

## Findings por Severidade

### P0 — Crítico (fix imediato)

**[P0] Submit button falha WCAG AA em light mode**
- **Local:** `utils/auth-styles.ts:28-37` — `bg-[#059669]` sobre fundo branco
- **Categoria:** Acessibilidade
- **Impacto:** Usuários com baixa visão não conseguem ler o label do botão. Texto branco (#ffffff) sobre #059669 = ~3.77:1 (mínimo AA = 4.5:1)
- **WCAG:** SC 1.4.3 Contrast (Minimum) AA
- **Fix:** Escurecer para `bg-[#047857]` (~5.1:1) ou `bg-[#065F46]` (~6.2:1). Ajustar hover/active proporcionalmente.
- **Comando:** `/impeccable audit`

---

### P1 — Major (fix antes do release)

**[P1] Keyboard navigation sem focus ring nos links**
- **Local:** `utils/auth-styles.ts:48` — `linkClass` tem `focus-visible:outline-none` sem ring substituto
- **Categoria:** Acessibilidade
- **Impacto:** Usuários de teclado tabando para "Esqueceu a senha?" e "Cadastre-se" não recebem indicador de foco. Violação clara de WCAG 2.1 AA SC 2.4.7.
- **Fix:** Substituir `focus-visible:outline-none` por `focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1 rounded-sm`
- **Comando:** `/impeccable audit`

**[P1] aria-describedby ausente em todos os campos de input**
- **Local:** `ui/floating-input.tsx`, `ui/password-field.tsx`
- **Categoria:** Acessibilidade
- **Impacto:** Screen readers não associam as mensagens de erro ao campo que as gerou. Usuário ouve o erro mas não sabe a qual campo pertence.
- **WCAG:** SC 1.3.1 Info and Relationships
- **Fix:** Adicionar `aria-describedby={errorId}` no `<input>` e `id={errorId}` no `<FieldError>`. Usar `useId()` já importado no componente.
- **Comando:** `/impeccable audit`

**[P1] Tab order não auditado — keyboard flow desconhecido**
- **Local:** auth-form.tsx, login-content.tsx, register-content.tsx
- **Categoria:** Acessibilidade
- **Impacto:** Analistas jurídicos que usam teclado (e QA) não conseguem traçar a sequência de tab. Redução de produtividade em uso diário.
- **WCAG:** SC 2.1.1 Keyboard
- **Fix:** Rodar fluxo manual de teclado. Ordem esperada: theme-toggle → email → senha → "Lembrar de mim" → "Esqueceu a senha?" → Entrar → Cadastre-se. Adicionar skip-to-content no topo.
- **Comando:** `/impeccable audit`

**[P1] Eye icon e theme-toggle abaixo de 44×44px**
- **Local:** `ui/password-field.tsx` (p-2.5 → ~40px), `ui/theme-toggle.tsx` (p-3 → ~44px borderline)
- **Categoria:** Responsividade
- **Impacto:** Em touch, botões pequenos causam erros de toque. Pior em modo mobile onde hover não existe.
- **WCAG:** SC 2.5.5 Target Size (AAA) / mobile best practice
- **Fix:** Password eye: `p-3` (de p-2.5). Theme toggle: `p-3.5`. Verify final hit area ≥ 44px.
- **Comando:** `/impeccable adapt`

**[P1] Ambos os forms montados simultaneamente — performance waste**
- **Local:** `auth-form.tsx:69-89` — LoginContent e RegisterContent renderizados via `hidden` CSS, não condicionalmente
- **Categoria:** Performance
- **Impacto:** Ambos os forms processam onChange, validação, e subscrevem ao AuthContext mesmo quando invisíveis. PasswordStrength recalcula com o form escondido.
- **Fix:** Substituir por `{mode === "login" ? <LoginContent ... /> : <RegisterContent ... />}`. Isso reduz computation ~50% e elimina subscriptions desnecessárias.
- **Comando:** `/impeccable optimize`

**[P1] Password strength bar: cor como único sinal de estado**
- **Local:** `ui/password-strength.tsx` — barra segmentada sem label de texto
- **Categoria:** Acessibilidade
- **Impacto:** Usuários com daltonismo (deuteranopia/protanopia, ~8% dos homens) não distinguem os estados. PRODUCT.md exige WCAG 2.1 AA.
- **WCAG:** SC 1.4.1 Use of Color
- **Fix:** Adicionar label textual abaixo da barra: "Fraca" / "Média" / "Forte" com a cor correspondente (3 linhas de código).
- **Comando:** `/impeccable audit`

**[P1] Forms sem padding-bottom no mobile — keyboard avoidance ausente**
- **Local:** `login-content.tsx:56`, `register-content.tsx:61` — nenhum `pb-X` definido
- **Categoria:** Responsividade
- **Impacto:** Teclado virtual do mobile pode encobrir o botão de submit. Usuários não conseguem enviar o formulário sem fechar o teclado.
- **Fix:** Adicionar `pb-24 md:pb-0` nos containers dos forms.
- **Comando:** `/impeccable adapt`

**[P1] 67+ hex colors hard-coded — zero tokens**
- **Local:** auth-styles.ts, floating-input.tsx, password-field.tsx, password-strength.tsx e mais 7 arquivos
- **Categoria:** Theming
- **Impacto:** Qualquer ajuste de paleta exige editar 11 arquivos manualmente. Design system inexistente na prática.
- **Fix:** Extrair tokens de cor para `tailwind.config.ts` (tema customizado) ou `styles/tokens.css` (CSS custom properties). Mínimo: `--color-brand`, `--color-brand-dark`, `--color-error`, `--color-surface`.
- **Comando:** `/impeccable extract auth`

---

### P2 — Minor (próxima passagem)

**[P2] confirmPassword sem feedback em tempo real**
- **Local:** `register-content.tsx:122-128`
- **Categoria:** Prevenção de erros
- **Impacto:** Usuário digita senha diferente, sobe na página, volta, não vê o problema. Erro só aparece no submit.
- **Fix:** Adicionar verificação `onBlur` no campo confirmPassword: se value !== password e o campo foi touched, mostrar "Não coincidem" inline.

**[P2] "Voltar para o Início" ausente no mobile**
- **Local:** `auth-form.tsx:121-150` — link existe apenas no painel (desktop-only)
- **Categoria:** Controle e liberdade
- **Impacto:** Usuários mobile ficam presos no fluxo de auth sem escape visível.
- **Fix:** Adicionar link "← Início" no topo do form mobile (ao lado do logo), com `md:hidden`.

**[P2] lógica dark/light duplicada ~30 vezes**
- **Local:** todos os componentes de auth
- **Categoria:** Theming
- **Impacto:** Toda mudança de tema exige editar múltiplos arquivos. Alto risco de divergência entre componentes.
- **Fix:** Parte da solução de tokens (P1 acima). Extrair cor por papel semântico, não por componente.

**[P2] RedactWord não respeita `instant` totalmente em reduced motion**
- **Local:** `panel-tagline.tsx:26-34` — `transition` ainda definido quando `instant === true`
- **Categoria:** Performance / A11y
- **Impacto:** Timer ainda executa; transição é declarada mesmo que não rode. Inofensivo mas inconsistente com o hook `useReducedMotion`.
- **Fix:** Adicionar `transition: instant ? "none" : "transform 520ms..."` (já está, verificar se `instant` prop está chegando corretamente).

---

### P3 — Polish (se houver tempo)

**[P3] `bottom-1/10` não é classe Tailwind padrão**
- **Local:** `panel-tagline.tsx:72` — `bottom-1/10`
- **Fix:** Trocar por `bottom-[10%]` para ser explícito e evitar surpresas com purge.

**[P3] API error 422 no register é vago**
- **Local:** `register-content.tsx:47` — `"Dados inválidos. Verifique os campos."`
- **Fix:** `"Verifique se o e-mail é válido e todos os campos estão preenchidos."`

**[P3] Easing `cubic-bezier(0.16, 1, 0.3, 1)` repetido 3×**
- **Local:** `auth-form.tsx:62`, `page-loader.tsx`, `ui/password-strength.tsx`
- **Fix:** Extrair para `const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)"` em `motion-config.ts` e importar nos três locais.

---

## Issus Resolvidos (ciclo anterior)

| # | Heurística | Fix aplicado |
|---|---|---|
| P1 | Inputs sem labels visíveis | Floating labels com `FloatingInput` e `PasswordField`. Label flutua para cima com `peer :placeholder-shown`. |
| P1 | Register sem top padding desktop | `md:pt-28` adicionado ao register container. |
| P1 | Glassmorphism no botão "Voltar" | `backdropFilter: blur(4px)` removido. Substituído por `rgba(..., 0.22)` sólido. |
| P2 | Touch targets abaixo de 44px (eye, theme) | Eye toggle: `p-2.5 rounded-md` + `focus-visible:ring-2`. Theme toggle: `p-2 → p-3`. |
| P2 | FieldError sem aria-live | `role="alert" aria-live="polite"` adicionado. |
| Layout | Proporção 50:50 → 40:60 | forms em `md:w-[40%]`, painel em `w-[60%]`. |

---

## Padrões Sistêmicos

1. **Fragmentação de tema** (afeta todas as dimensões) — 67 hex hard-coded em 11 arquivos. Cada componente reimplementa dark/light de forma independente. Solução: criar token system centralizado antes de adicionar novos componentes.

2. **Motion não consolidado** — o mesmo easing aparece 3×, `useReducedMotion` integrado mas não propagado para todos os sub-componentes (RedactWord). Extrair `motion-config.ts`.

3. **Form rendering over-computation** — ambos os forms montados e ativos simultaneamente. Cada keystroke dispara handlers em ambos. Condicionar com `{mode === "login" ? ... : ...}`.

4. **A11y gaps sistêmicos** — aria-describedby ausente em todos os inputs, tab order desconhecido. Fazer uma passagem com axe DevTools antes do release.

---

## Persona Red Flags

**Sam (Usuário com deficiência visual):** Faz login pelo teclado. Chega em "Esqueceu a senha?": sem indicador de foco visível (P1 acima). Submete formulário com erro de senha: FieldError tem `aria-live`, mas sem `aria-describedby` não sabe a qual campo o erro pertence. Risco de abandono alto na recuperação de erros.

**Alex (Analista jurídico, usuário diário, 7h da manhã):** Tab pelo formulário, submit. Funciona. Tenta trocar para cadastro pelo teclado: só via link "Cadastre-se" inline. Sem contexto visual, não intuitivo. Em mobile: teclado virtual encobre o botão de submit (P1 bottom-padding ausente).

---

## Recommended Actions

1. **[P0] `/impeccable audit`** — Submit button contrast: escurecer `bg-[#059669]` para `#047857` ou `#065F46` em `auth-styles.ts:28`
2. **[P1] `/impeccable audit`** — Fix `linkClass` focus ring: substituir `focus-visible:outline-none` por ring-2 em `auth-styles.ts:48`
3. **[P1] `/impeccable audit`** — Adicionar `aria-describedby` em `floating-input.tsx` e `password-field.tsx`
4. **[P1] `/impeccable audit`** — Label textual "Fraca/Média/Forte" em `ui/password-strength.tsx`
5. **[P1] `/impeccable optimize`** — Condicionar rendering: `{mode === "login" ? <LoginContent> : <RegisterContent>}` em `auth-form.tsx`
6. **[P1] `/impeccable adapt`** — Eye icon `p-2.5 → p-3`; adicionar `pb-24 md:pb-0` nos form containers
7. **[P1] `/impeccable extract`** — Extrair 67 hex colors para token system em `tailwind.config.ts`
8. **[P2] `/impeccable harden`** — Feedback em tempo real em confirmPassword; back link no mobile
9. **[P3] `/impeccable polish`** — Pass final: bottom-[10%], easing extraído, error copy 422

> Você pode pedir que eu rode esses um a um, todos de uma vez, ou em qualquer ordem.
>
> Rode `/impeccable critique` e `/impeccable audit` depois das correções para ver o score melhorar.
