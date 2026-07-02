# Product

## Register

product

## Users

Legal analysts and data professionals at JusBrasil (and partnering teams like IDP) who receive raw judicial decision reports from LLM pipelines. They work in a professional data-processing context: they know their domain, understand spreadsheets, and use Power BI or Looker Studio downstream. They are not technical engineers, but they are precise and results-oriented. Their main friction is repetitive, error-prone manual cleanup before analysis can begin.

## Product Purpose

Normalizador JusBrasil automates the normalization and AI-assisted classification of judicial report spreadsheets (CSV/XLSX). Users configure a project once — defining which columns to clean and how — and from that point forward every uploaded report is processed automatically. The platform eliminates the manual cleanup step between LLM output and BI analysis, delivering a standardized, ready-to-load file with consistent category columns added.

Success looks like: an analyst uploads a 120k-row report, comes back 15 minutes later, downloads the cleaned file, marks it approved, and loads it into Power BI without touching a cell.

## Brand Personality

Precise, calm, expert. The product should feel like a tool built by people who understand legal data deeply — not a generic SaaS product that happens to handle CSVs. Confident without being cold. Clear without being sparse. The interface should inspire trust in the output quality.

## Anti-references

- **SaaS landing clichés**: gradient hero sections, glowing blobs, floating cards, generic startup aesthetic. None of that belongs in a workflow tool.
- **Generic gov/legal portals**: bulky tables, blue-link overload, circa-2010 e-gov visual language. The legal domain doesn't mandate visual bureaucracy.
- **Dark "hacker" tools**: terminal themes, neon-on-black, heavy monospace everywhere. This is a professional data tool, not a CLI wrapper.
- **Overdesigned dashboards**: metric card grids, too many charts, gradient accents everywhere. If it looks like a BI demo template, it has failed.

## Design Principles

1. **Workflow clarity over decoration.** Every visual element earns its place by serving the task. If it doesn't help the user configure, upload, monitor, or download — it doesn't belong.
2. **Expert confidence.** The interface should assume the user knows what they're doing. No hand-holding copy, no infantilizing tooltips on every field. Reserve explanations for genuinely ambiguous states.
3. **Transparency at scale.** Processing 120k rows is invisible to the user. The UI's job is to make progress, status, and errors legible without drama — not to hide async reality behind false optimism.
4. **Configure once, trust forever.** The configuration is the user's most valuable artifact. The UI should reinforce its durability: show it prominently, make it easy to review, and make it clear which runs were processed under which config.
5. **Precision as a value.** Labels, status names, error messages, and feedback copy must be unambiguous. When data quality is the product, ambiguity in the interface erodes confidence in the output.

## Accessibility & Inclusion

WCAG 2.1 AA compliance. Keyboard navigation for all interactive elements. Sufficient contrast ratios across light and dark modes. Focus indicators visible at all times. No reliance on color alone to convey status (use labels alongside color-coded states).
