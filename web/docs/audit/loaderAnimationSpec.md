# Loader Animation Spec — N Logo Variants

> Objetivo: testar três direções de animação para o loader do NormAI.
> Conceito central: confusão → normalização, espelhando a proposta do produto.

## Estrutura do SVG (`public/whiteN.svg`)

ViewBox `0 0 240 240`. Três `<path>` separados:

| ID | Papel | Centro aproximado |
|----|-------|-------------------|
| **L** | Pipe esquerdo `|` | (75, 118) |
| **R** | Pipe direito `|` | (164, 118) |
| **D** | Diagonal `\` | (120, 120) |

As paths serão extraídas do SVG e usadas inline para permitir animar cada elemento individualmente.

---

## Variante A — Spatial Dispersal (Glitch Digital)

**Sensação:** Fragmentos espalhados no espaço, trepidando caoticamente, depois batendo na posição correta em um único momento decisivo.

**ormAI:** Typewriter (mantém o comportamento atual).

### Timeline (~4150ms total)

| Intervalo | Evento |
|-----------|--------|
| 0–200ms | Fade in. Paths aparecem em posições dispersas. |
| 200–3000ms | Fase de caos. Glitch interval de 80ms adiciona ruído aleatório ±15px sobre o deslocamento base. |
| 3000ms | **SNAP.** Offset zerado; CSS transition 280ms expo-out puxa tudo para a posição correta. |
| 3050ms | Typewriter "ormAI" inicia (45ms/char). |
| 3800ms | Início do fade-out (350ms). |
| 4150ms | Done. |

### Deslocamentos base

| Path | Translate | Rotate | SkewX |
|------|-----------|--------|-------|
| L | (-90px, -50px) | -22deg | 0 |
| R | (85px, 60px) | 28deg | 0 |
| D | (-5px, 75px) | 0 | -25deg |

### Glitch

Cada 80ms: novo offset aleatório aplicado sobre o base. Cada path tem semente diferente no mesmo tick.
Amplitude: ±15px translate, ±8deg rotate, ±5deg skew.
`transition: none` durante caos — mudança instantânea.
No snap: `transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1)` + offset zerado.

### Abordagem técnica

- Inline SVG com 3 `<g>` elementos
- `transform-box: fill-box; transform-origin: center` em cada `<g>`
- CSS transforms via React state (inline style)
- `setInterval(80)` para o glitch; limpeza no snap
- Shift lateral para o "ormAI" (mesmo padrão do loader atual)

---

## Variante B — SVG Turbulence (Orgânica)

**Sensação:** O N distorcido por uma força orgânica — como visto através de vidro embaçado — até clarear de repente.

**ormAI:** Palavra inteira aparece com blur(12px) → blur(0) + fade (não typewriter).

### Timeline (~4050ms total)

| Intervalo | Evento |
|-----------|--------|
| 0–200ms | Fade in. N aparece fortemente distorcido. |
| 200–3200ms | Fase orgânica. RAF loop decai `baseFrequency` (0.065→0.002) e `scale` (60→5) com easing cúbico. Spikes aleatórios (5% de chance/frame) adicionam irregularidade. |
| 3200ms | **SNAP.** Filter removido instantaneamente. |
| 3300ms | "ormAI" aparece: blur 12px→0 + opacity 0→1 em 400ms. |
| 3700ms | Hold. |
| 3700ms | Início do fade-out (350ms). |
| 4050ms | Done. |

### Parâmetros do filtro

```
feTurbulence:       baseFrequency 0.065 → 0.002 (eased-out cúbico)
feDisplacementMap:  scale 60 → 5 (eased-out), → 0 no snap
```

Spikes orgânicos: 5% de probabilidade por frame de adicionar +0.2–0.4 ao baseFrequency transitoriamente.

### ormAI reveal

Span com `filter: blur(Xpx)` e `opacity` driven por state, animados em 400ms.
Sem shift lateral — a palavra aparece diretamente à direita do N.

### Abordagem técnica

- Inline SVG com `<filter id>` + `<feTurbulence>` e `<feDisplacementMap>`
- `useRef` nos elementos SVG do filtro para mutação direta via `setAttribute`
- RAF loop (não setInterval) para frame-accurate decay
- No snap: `filter` attr removido do SVG + "ormAI" blur state iniciado

---

## Variante C — Calligraphic Convergence (Gradual)

**Sensação:** Três pinceladas que começam no lugar errado e, uma a uma, derivam para onde deveriam estar. O último elemento se acomodando sinaliza conclusão.

**ormAI:** Escrito caractere a caractere via clip-path wipe (direção caligrática), 100ms/char.

### Timeline (~4550ms total)

| Intervalo | Evento |
|-----------|--------|
| 0–200ms | Fade in. Paths aparecem em deslocamento suave. |
| 200ms | Convergência inicia. Cada path tem timing individual via CSS transition. |
| 0–2500ms | Path L se acomoda (delay 200ms, duration 2300ms, spring ease). |
| 0–3000ms | Path R se acomoda (delay 100ms, duration 2900ms, spring ease). |
| 0–3500ms | Path D se acomoda por último (delay 0ms, duration 3500ms, spring pesado). |
| 3500ms | Todos acomodados. |
| 3600ms | "ormAI" escrita caligrática inicia (100ms/char × 5 = 500ms). |
| 4100ms | Hold. |
| 4100ms | Início do fade-out (350ms). |
| 4550ms | Done. |

### Deslocamentos base (mais suaves que A)

| Path | Translate | Rotate | SkewX |
|------|-----------|--------|-------|
| L | (-45px, -25px) | -12deg | 0 |
| R | (50px, 35px) | 15deg | 0 |
| D | (10px, 45px) | 8deg | -10deg |

### Easing (spring com overshooting suave)

| Path | Curva |
|------|-------|
| L | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| R | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| D | `cubic-bezier(0.22, 1.2, 0.36, 1)` (overshooting mais pesado) |

### ormAI caligrático

Cada caractere revelado via `clip-path: inset(0 100% 0 0)` → `inset(0 0% 0 0)`.
Duração 100ms por char, delay `i × 100ms`.

### Abordagem técnica

- Inline SVG com 3 `<g>` elementos
- `isSettling: boolean` state: false → true no mount (dispara CSS transitions)
- Cada `<g>` tem `transition` e `transitionDelay` distintos no inline style
- `transform-box: fill-box; transform-origin: center`
- "ormAI": array de chars, cada um com `clipPath` state próprio via setTimeout escalonado

---

## API compartilhada

```tsx
interface LoaderProps {
  onDone?: () => void;
}

// Variant A
export function LoaderA({ onDone }: LoaderProps): React.ReactElement | null

// Variant B
export function LoaderB({ onDone }: LoaderProps): React.ReactElement | null

// Variant C
export function LoaderC({ onDone }: LoaderProps): React.ReactElement | null
```

## Páginas de teste

| Rota | Conteúdo |
|------|----------|
| `/loader-test` | Índice com links A / B / C e descrições |
| `/loader-test/a` | Variante A isolada com botão Reiniciar |
| `/loader-test/b` | Variante B isolada com botão Reiniciar |
| `/loader-test/c` | Variante C isolada com botão Reiniciar |

## Acessibilidade

Todos os variantes: `aria-hidden="true"` no container.
`prefers-reduced-motion`: skip fase de caos, mostrar N estável imediatamente.

## Integração com o loader existente

Após escolher a variante definitiva:

```tsx
// page-loader.tsx — trocar implementação interna pela variante escolhida
// Exportar LOADER_TOTAL_MS atualizado conforme a variante:
// A: 4150, B: 4050, C: 4550
```

O `PageLoader` existente continuará sendo o ponto de entrada público.
As 3 variantes serão descartadas ou consolidadas após o teste visual.
