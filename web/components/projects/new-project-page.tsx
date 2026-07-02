"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useCallback, useEffect } from "react";
import axios from "axios";
import { createProject, saveLocalProjectData } from "@/lib/projects";
import { setPendingProjectUpload } from "@/lib/pending-upload";
import { useToast } from "@/components/ui/toast";
import { listGlobalEntries, createGlobalEntry } from "@/lib/dictionary";
import { Search, X, ChevronRight, Check, BookmarkPlus } from "lucide-react";
import { ProjectField } from "./_shared/project-field";
import { UploadSlot } from "./_shared/upload-slot";
import { DatabaseDrawer } from "./database-drawer";
import type {
  ColumnProcessingConfigMap,
  NormalizationType,
  UploadedFile,
} from "@/types/project";
import type { DictEntry, DictType, DictionaryEntry } from "@/types/dictionary";

/* ── Helpers ─────────────────────────────────────────────────── */
function toDictEntry(e: DictionaryEntry): DictEntry {
  return {
    id: e.id,
    type: e.kind,
    title: e.name,
    description: e.description,
    content: e.content,
    items: e.items,
  };
}

function mapCreateError(err: unknown): string {
  if (!axios.isAxiosError(err))
    return "Erro ao criar projeto. Tente novamente.";
  const status = err.response?.status;
  const detail =
    typeof err.response?.data?.detail === "string"
      ? err.response.data.detail.toLowerCase()
      : "";
  if (
    status === 409 ||
    detail.includes("already exists") ||
    detail.includes("already_exists")
  )
    return "Já existe um projeto com este nome.";
  if (status === 422)
    return "Verifique os campos obrigatórios e tente novamente.";
  if (status === 401 || status === 403)
    return "Sem permissão para criar projetos.";
  if (!err.response)
    return "Sem conexão. Verifique sua internet e tente novamente.";
  return "Erro ao criar projeto. Tente novamente.";
}

/* ── Normalization types ─────────────────────────────────────── */
const NORM_TYPES = [
  {
    key: "trim",
    label: "Trim",
    shortDesc: "Remove espaços extras",
    desc: "Remove espaços extras e normaliza whitespace interno",
  },
  {
    key: "nulls",
    label: "Nulls",
    shortDesc: "Trata valores vazios",
    desc: 'Converte "", "N/A", "Não informado" para string vazia',
  },
  {
    key: "split",
    label: "Split",
    shortDesc: "Divide por separadores",
    desc: "Divide o valor por |, ; ou / e normaliza cada token",
  },
  {
    key: "suffixes",
    label: "Sufixos",
    shortDesc: "Remove sufixos de órgãos",
    desc: 'Remove sufixos como "TRF1 - Tribunal..." → "TRF1"',
  },
  {
    key: "abbreviate",
    label: "Abreviar",
    shortDesc: "Abrevia nomes jurídicos",
    desc: '"Tribunal de Justiça de São Paulo" → "TJSP"',
  },
  {
    key: "accents",
    label: "Acentos",
    shortDesc: "Remove acentuação",
    desc: '"São Paulo" → "Sao Paulo"',
  },
  {
    key: "capitalize",
    label: "Capitalizar",
    shortDesc: "Capitalização PT-BR",
    desc: "Capitaliza com regras do PT-BR (artigos em minúscula)",
  },
] as const;

function emptyColumnConfigMap(columns: string[]): ColumnProcessingConfigMap {
  return Object.fromEntries(
    columns.map((column) => [
      column,
      { normalizationTypes: [], classify: false },
    ]),
  );
}

function syncColumnConfigKeys(
  columns: string[],
  configs: ColumnProcessingConfigMap,
): ColumnProcessingConfigMap {
  return Object.fromEntries(
    columns.map((column) => [
      column,
      configs[column] ?? { normalizationTypes: [], classify: false },
    ]),
  );
}

function columnsWithNormalizations(configs: ColumnProcessingConfigMap): string[] {
  return Object.entries(configs)
    .filter(([, config]) => config.normalizationTypes.length > 0)
    .map(([column]) => column);
}

function columnsWithClassification(configs: ColumnProcessingConfigMap): string[] {
  return Object.entries(configs)
    .filter(([, config]) => config.classify)
    .map(([column]) => column);
}

/* ── Dict panel config ───────────────────────────────────────── */
const TYPE_CONFIG: Record<
  DictType,
  { label: string; color: string; bg: string; borderApplied: string }
> = {
  context: {
    label: "Contexto IA",
    color: "#6b4cc7",
    bg: "rgba(107, 76, 199, 0.07)",
    borderApplied: "rgba(107, 76, 199, 0.22)",
  },
  categories: {
    label: "Classificação",
    color: "#006b5a",
    bg: "rgba(0, 107, 90, 0.07)",
    borderApplied: "rgba(0, 107, 90, 0.22)",
  },
};
const TYPE_ORDER: DictType[] = ["context", "categories"];
const TAB_LABELS: Record<DictType, string> = {
  context: "Contexto",
  categories: "Classificação",
};
const ENTRY_EFFECT: Record<DictType, string> = {
  context: "Preenche Contexto para IA",
  categories: "Adiciona tags de classificação",
};

/* ── NormCheckbox ────────────────────────────────────────────── */
function NormCheckbox({
  id,
  label,
  shortDesc,
  desc,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  shortDesc: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      title={desc}
      onClick={() => onChange(!checked)}
      className="norm-checkbox-item"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "10px 10px",
        borderRadius: "7px",
        border: `1px solid ${checked ? "var(--border-active)" : "var(--border-default)"}`,
        background: checked ? "rgba(0,107,90,0.05)" : "transparent",
        cursor: "pointer",
        transition:
          "border-color 150ms ease, background 150ms ease, transform 80ms ease",
        userSelect: "none",
      }}
    >
      <div
        role="checkbox"
        id={id}
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          width: "14px",
          height: "14px",
          flexShrink: 0,
          marginTop: "2px",
          borderRadius: "3px",
          border: `1.5px solid ${checked ? "var(--primary-700)" : "var(--border-strong)"}`,
          background: checked ? "var(--primary-700)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 150ms ease, border-color 150ms ease",
          outline: "none",
        }}
      >
        {checked && (
          <Check
            size={9}
            strokeWidth={3}
            className="check-icon"
            style={{ color: "white" }}
          />
        )}
      </div>
      <div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: checked ? "var(--primary-700)" : "var(--text-default)",
            lineHeight: 1.2,
            transition: "color 150ms ease",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}
        >
          {shortDesc}
        </div>
      </div>
    </label>
  );
}

/* ── Column section heading ──────────────────────────────────── */
function ColHeading({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <h2
      style={{
        margin: "0 0 20px",
        fontSize: "20px",
        fontWeight: 700,
        color: color ?? "var(--text-default)",
        letterSpacing: "-0.02em",
        fontFamily: "var(--font-space-grotesk)",
      }}
    >
      {children}
    </h2>
  );
}

/* ── Field label ─────────────────────────────────────────────── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-accent)",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

/* ── Sub label ───────────────────────────────────────────────── */
function SubLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.09em",
        color: color ?? "var(--text-secondary)",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function NewProjectPage() {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);

  /* Col 1 */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const uploadedRawRef = useRef<File | null>(null);
  const [markedColumns, setMarkedColumns] = useState<string[]>([]);
  const [activeConfigColumn, setActiveConfigColumn] = useState<string | null>(null);
  const [columnConfigs, setColumnConfigs] = useState<ColumnProcessingConfigMap>({});

  /* Drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Col 2 — Classification */
  const [classifyTags, setClassifyTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [classifyTagsOnly, setClassifyTagsOnly] = useState(false);

  /* Col 3 — Dict panel */
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DictType>("context");
  const [expandedDictEntry, setExpandedDictEntry] = useState<string | null>(
    null,
  );

  /* Shared */
  const [dictEntries, setDictEntries] = useState<DictEntry[]>([]);
  const [appliedEntries, setAppliedEntries] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* Save to Dict modal */
  const [saveDictModal, setSaveDictModal] = useState(false);
  const [saveDictType, setSaveDictType] = useState<DictType>("context");
  const [saveDictName, setSaveDictName] = useState("");
  const [saveDictDesc, setSaveDictDesc] = useState("");
  const [savingDict, setSavingDict] = useState(false);
  const { show: showToast } = useToast();

  useEffect(() => {
    listGlobalEntries({ pageSize: 100 })
      .then((page) => setDictEntries(page.items.map(toDictEntry)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeConfigColumn && markedColumns.includes(activeConfigColumn)) return;
    setActiveConfigColumn(markedColumns[0] ?? null);
  }, [activeConfigColumn, markedColumns]);

  /* Derived */
  const activeColumnConfig =
    activeConfigColumn ? columnConfigs[activeConfigColumn] : undefined;
  const normTypes = new Set(activeColumnConfig?.normalizationTypes ?? []);
  const allNormChecked = normTypes.size === NORM_TYPES.length;
  const someNormChecked = normTypes.size > 0 && !allNormChecked;
  const classifiedColumns = columnsWithClassification(columnConfigs);
  const dictCategoryItems = dictEntries
    .filter((e) => e.type === "categories" && appliedEntries.has(e.id))
    .flatMap((e) => e.items ?? []);
  const searchLower = search.toLowerCase();
  const tabCounts = TYPE_ORDER.reduce<Record<DictType, number>>(
    (acc, type) => {
      acc[type] = dictEntries.filter(
        (e) =>
          e.type === type &&
          (!searchLower ||
            e.title.toLowerCase().includes(searchLower) ||
            e.description?.toLowerCase().includes(searchLower)),
      ).length;
      return acc;
    },
    { context: 0, categories: 0 },
  );
  const filteredDictEntries = dictEntries.filter(
    (e) =>
      e.type === activeTab &&
      (!searchLower ||
        e.title.toLowerCase().includes(searchLower) ||
        e.description?.toLowerCase().includes(searchLower)),
  );
  const canCreate = title.trim().length > 0;

  /* Norm handlers */
  function updateActiveColumnConfig(
    patch: Partial<{ normalizationTypes: NormalizationType[]; classify: boolean }>,
  ) {
    if (!activeConfigColumn) return;
    setColumnConfigs((prev) => {
      const current = prev[activeConfigColumn] ?? {
        normalizationTypes: [],
        classify: false,
      };
      return {
        ...prev,
        [activeConfigColumn]: {
          normalizationTypes: patch.normalizationTypes ?? current.normalizationTypes,
          classify: patch.classify ?? current.classify,
        },
      };
    });
  }
  function toggleNormType(key: NormalizationType) {
    const current = activeColumnConfig?.normalizationTypes ?? [];
    const next = current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key];
    updateActiveColumnConfig({ normalizationTypes: next });
  }
  function handleToggleAllNorm() {
    updateActiveColumnConfig({
      normalizationTypes: allNormChecked
        ? []
        : NORM_TYPES.map((type) => type.key),
    });
  }

  /* Classification handlers */
  function addClassifyTag() {
    const tag = tagInput.trim();
    if (!tag || classifyTags.includes(tag)) return;
    setClassifyTags((prev) => [...prev, tag]);
    setTagInput("");
  }
  function removeClassifyTag(tag: string) {
    setClassifyTags((prev) => prev.filter((t) => t !== tag));
  }

  /* Dict handlers */
  function handleApply(entry: DictEntry) {
    setAppliedEntries((prev) => new Set([...prev, entry.id]));
    if (entry.type === "context" && entry.content) {
      setAiContext((prev) => {
        const cur = prev.trim();
        return cur ? `${cur}\n\n${entry.content}` : entry.content!;
      });
    }
  }
  function handleUnapply(entryId: string) {
    setAppliedEntries((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
    const entry = dictEntries.find((e) => e.id === entryId);
    if (entry?.type === "context" && entry.content) {
      setAiContext((prev) =>
        prev
          .replace(`\n\n${entry.content}`, "")
          .replace(`${entry.content}\n\n`, "")
          .replace(entry.content!, "")
          .trim(),
      );
    }
  }

  /* Save to Dict */
  function openSaveDictModal() {
    const defaultType: DictType = aiContext.trim()
      ? "context"
      : classifyTags.length > 0
        ? "categories"
        : "context";
    setSaveDictType(defaultType);
    setSaveDictName("");
    setSaveDictDesc("");
    setSaveDictModal(true);
  }
  async function handleSaveToDict() {
    if (!saveDictName.trim()) return;
    setSavingDict(true);
    try {
      await createGlobalEntry({
        kind: saveDictType,
        name: saveDictName.trim(),
        description: saveDictDesc.trim() || undefined,
        content: saveDictType === "context" ? aiContext : undefined,
        items: saveDictType === "categories" ? classifyTags : undefined,
      });
      setSaveDictModal(false);
      setSaveDictName("");
      setSaveDictDesc("");
      showToast("Predefinição salva no dicionário.");
    } catch {
      showToast("Erro ao salvar. Tente novamente.");
    } finally {
      setSavingDict(false);
    }
  }
  /* Create */
  const handleCreate = useCallback(async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createProject({
        name: title.trim(),
        description: description.trim() || undefined,
        ai_context: aiContext.trim() || undefined,
      });
      const normalizedColumns = columnsWithNormalizations(columnConfigs);
      const classificationColumns = columnsWithClassification(columnConfigs);
      saveLocalProjectData(created.id, {
        uploadedFile: uploadedFile ?? null,
        tasks: {
          normalize: normalizedColumns.length > 0,
          classify: classificationColumns.length > 0,
        },
        columnsToNormalize: normalizedColumns,
        columnsToClassify: classificationColumns,
        normalizationTypes: [],
        columnConfigs,
      });
      if (uploadedRawRef.current) {
        setPendingProjectUpload(created.id, uploadedRawRef.current);
      }
      sessionStorage.setItem("projects-toast", `Projeto "${title.trim()}" criado com sucesso.`);
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setCreateError(mapCreateError(err));
      setCreating(false);
    }
  }, [
    canCreate,
    creating,
    title,
    description,
    aiContext,
    uploadedFile,
    columnConfigs,
    router,
  ]);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          minHeight: 0,
        }}
      >
        {/* ════════════════════════════════════════════════════════
          COLUMN 1 — Identidade + Arquivo
      ════════════════════════════════════════════════════════ */}
        <div
          style={{
            borderRight: "1px solid rgba(0, 107, 90, 0.18)",
            background: "rgba(0, 107, 90, 0.025)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "40px 32px 40px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              overflowY: "auto",
              flex: 1,
            }}
            className="scroll-styled"
          >
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb">
              <ol
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                <li>
                  <Link
                    href="/projects"
                    className="nav-link"
                    style={{
                      fontSize: "13px",
                      color: "var(--text-muted)",
                      textDecoration: "none",
                    }}
                  >
                    Projetos
                  </Link>
                </li>
                <li
                  aria-hidden="true"
                  style={{
                    color: "var(--primary-700)",
                    fontSize: "13px",
                    opacity: 0.6,
                  }}
                >
                  ·
                </li>
                <li
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  Novo Projeto
                </li>
              </ol>
            </nav>

            {/* Title */}
            <h1
              ref={titleRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Nome do projeto"
              onInput={(e) => setTitle(e.currentTarget.textContent ?? "")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLElement).blur();
                }
              }}
              className="new-project-title"
              style={{
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "var(--text-default)",
                outline: "none",
                cursor: "text",
                margin: 0,
                fontFamily: "var(--font-space-grotesk)",
                minHeight: "1.4em",
              }}
              role="heading"
              aria-label="Nome do projeto"
              aria-level={1}
            />

            {/* Divider below title */}
            <div
              style={{
                borderTop: "1px solid var(--border-default)",
                margin: "-8px 0",
              }}
            />

            {/* Description */}
            <div>
              <ProjectField
                label="Descrição"
                hint="Escreva a Descrição do projeto..."
                value={description}
                onChange={setDescription}
                minRows={3}
              />
            </div>

            {/* AI Context */}
            <div>
              <ProjectField
                label="Contexto para IA"
                hint="Descreva o contexto da normalização e/ou classificação para a IA..."
                value={aiContext}
                onChange={setAiContext}
                minRows={4}
              />
            </div>

            {/* File upload */}
            <div>
              <FieldLabel>Arquivo</FieldLabel>
              <UploadSlot
                file={uploadedFile}
                onUpload={(f, raw) => {
                  uploadedRawRef.current = raw;
                  setUploadedFile(f);
                  setDrawerOpen(true);
                }}
                onRemove={() => {
                  uploadedRawRef.current = null;
                  setUploadedFile(null);
                  setMarkedColumns([]);
                  setActiveConfigColumn(null);
                  setColumnConfigs({});
                }}
                onOpenDrawer={() => setDrawerOpen(true)}
              />
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "12.5px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                O arquivo processado estará disponível após a primeira execução.
              </p>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
          COLUMN 2 — Normalização + Classificação
      ════════════════════════════════════════════════════════ */}
        <div
          style={{
            borderRight: "1px solid rgba(122, 74, 0, 0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "40px 32px",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              flex: 1,
            }}
            className="scroll-styled"
          >
            {/* ── Normalização ───────────────────────────────────── */}
            <ColHeading>Configuração por coluna</ColHeading>

            <SubLabel>Coluna ativa</SubLabel>
            {markedColumns.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "18px",
                }}
              >
                {markedColumns.map((column) => {
                  const selected = column === activeConfigColumn;
                  const config = columnConfigs[column];
                  const configured =
                    !!config &&
                    (config.classify || config.normalizationTypes.length > 0);
                  return (
                    <button
                      key={column}
                      type="button"
                      onClick={() => setActiveConfigColumn(column)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        maxWidth: "100%",
                        padding: "5px 9px",
                        borderRadius: "6px",
                        border: selected
                          ? "1px solid var(--border-active)"
                          : "1px solid var(--border-default)",
                        background: selected
                          ? "rgba(0,107,90,0.08)"
                          : "var(--bg-tinted)",
                        color: selected
                          ? "var(--primary-700)"
                          : "var(--text-secondary)",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        fontWeight: selected ? 700 : 500,
                      }}
                    >
                      {configured && <Check size={11} strokeWidth={2.5} />}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {column}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p
                style={{
                  margin: "0 0 18px",
                  fontSize: "12.5px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                Selecione uma coluna no arquivo para configurar normalizações e IA.
              </p>
            )}

            <ColHeading>Normalização desta coluna</ColHeading>

            {/* Marque todas */}
            <div
              onClick={handleToggleAllNorm}
              role="checkbox"
              tabIndex={0}
              aria-checked={allNormChecked}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  handleToggleAllNorm();
                }
              }}
              className="norm-checkbox-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "11px 14px",
                borderRadius: "8px",
                border: `1px solid ${allNormChecked ? "var(--border-active)" : someNormChecked ? "var(--border-active)" : "var(--border-default)"}`,
                background: allNormChecked
                  ? "rgba(0,107,90,0.07)"
                  : someNormChecked
                    ? "rgba(0,107,90,0.03)"
                    : "var(--bg-tinted)",
                cursor: "pointer",
                marginBottom: "10px",
                transition:
                  "border-color 150ms ease, background 150ms ease, transform 80ms ease",
                outline: "none",
                userSelect: "none",
              }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  flexShrink: 0,
                  borderRadius: "4px",
                  border: `1.5px solid ${allNormChecked || someNormChecked ? "var(--primary-700)" : "var(--border-strong)"}`,
                  background: allNormChecked
                    ? "var(--primary-700)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 150ms ease, border-color 150ms ease",
                }}
              >
                {allNormChecked && (
                  <Check
                    size={10}
                    strokeWidth={3}
                    className="check-icon"
                    style={{ color: "white" }}
                  />
                )}
                {someNormChecked && !allNormChecked && (
                  <div
                    style={{
                      width: "8px",
                      height: "2px",
                      background: "var(--primary-700)",
                      borderRadius: "1px",
                    }}
                  />
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--text-default)",
                  }}
                >
                  Marque todas
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginTop: "1px",
                  }}
                >
                  Aplica todos os tipos de normalização
                </div>
              </div>
            </div>

            {/* 7 norm types — 4 col grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "6px",
                marginBottom: "28px",
              }}
            >
              {NORM_TYPES.map(({ key, label, shortDesc, desc }) => (
                <NormCheckbox
                  key={key}
                  id={`norm-${key}`}
                  label={label}
                  shortDesc={shortDesc}
                  desc={desc}
                  checked={normTypes.has(key)}
                  onChange={() => toggleNormType(key)}
                />
              ))}
            </div>

            {/* Divider between sections */}
            <div
              style={{
                borderTop: "1px solid var(--border-default)",
                marginBottom: "28px",
              }}
            />

            {/* ── Classificação ───────────────────────────────────── */}
            <ColHeading color="var(--primary-700)">Classificação</ColHeading>

            <label
              onClick={() =>
                updateActiveColumnConfig({
                  classify: !(activeColumnConfig?.classify ?? false),
                })
              }
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                cursor: activeConfigColumn ? "pointer" : "not-allowed",
                userSelect: "none",
                opacity: activeConfigColumn ? 1 : 0.55,
                padding: "12px",
                borderRadius: "8px",
                border: `1px solid ${
                  activeColumnConfig?.classify
                    ? "var(--border-active)"
                    : "var(--border-default)"
                }`,
                background: activeColumnConfig?.classify
                  ? "rgba(0,107,90,0.06)"
                  : "var(--bg-tinted)",
              }}
            >
              <div
                role="checkbox"
                aria-checked={activeColumnConfig?.classify ?? false}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    updateActiveColumnConfig({
                      classify: !(activeColumnConfig?.classify ?? false),
                    });
                  }
                }}
                style={{
                  width: "15px",
                  height: "15px",
                  marginTop: "2px",
                  flexShrink: 0,
                  borderRadius: "4px",
                  border: `1.5px solid ${
                    activeColumnConfig?.classify
                      ? "var(--primary-700)"
                      : "var(--border-strong)"
                  }`,
                  background: activeColumnConfig?.classify
                    ? "var(--primary-700)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 150ms ease, border-color 150ms ease",
                  outline: "none",
                }}
              >
                {activeColumnConfig?.classify && (
                  <Check
                    size={9}
                    strokeWidth={3}
                    className="check-icon"
                    style={{ color: "white" }}
                  />
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-default)",
                  }}
                >
                  Classificar esta coluna com IA
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginTop: "2px",
                    lineHeight: 1.4,
                  }}
                >
                  A IA usa o contexto do projeto e cria{" "}
                  <code style={{ fontFamily: "monospace" }}>
                    {activeConfigColumn ?? "coluna"}_categoria
                  </code>{" "}
                  apenas para a coluna ativa.
                </div>
              </div>
            </label>

            {classifiedColumns.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <SubLabel color="var(--primary-700)">Colunas com IA</SubLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {classifiedColumns.map((column) => (
                    <span
                      key={column}
                      style={{
                        padding: "3px 9px",
                        fontSize: "13px",
                        fontWeight: 500,
                        borderRadius: "5px",
                        background: "rgba(0,107,90,0.07)",
                        color: "var(--primary-700)",
                        border: "1px solid rgba(0,107,90,0.2)",
                      }}
                    >
                      {column}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
          COLUMN 3 — Dicionário + CTA
      ════════════════════════════════════════════════════════ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
            background: "rgba(107, 76, 199, 0.025)",
            position: "relative",
          }}
        >
          <div
            style={{
              padding: "40px 28px 0",
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <ColHeading color="#6b4cc7">Dicionário</ColHeading>

            {/* Search */}
            <div
              style={{
                position: "relative",
                marginBottom: "10px",
                flexShrink: 0,
              }}
            >
              <Search
                size={13}
                strokeWidth={2}
                style={{
                  position: "absolute",
                  left: "9px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar entradas..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  paddingLeft: "29px",
                  paddingRight: search ? "28px" : "10px",
                  paddingTop: "7px",
                  paddingBottom: "7px",
                  fontSize: "13px",
                  border: "1px solid var(--border-default)",
                  borderRadius: "6px",
                  background: "var(--bg-tinted)",
                  color: "var(--text-default)",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 150ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary-700)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Type tabs */}
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                borderBottom: "1px solid var(--border-default)",
                marginBottom: "8px",
              }}
            >
              {TYPE_ORDER.map((type) => {
                const cfg = TYPE_CONFIG[type];
                const count = tabCounts[type];
                const isActive = activeTab === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    style={{
                      flex: 1,
                      padding: "6px 4px 8px",
                      fontSize: "11px",
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? cfg.color : "var(--text-muted)",
                      background: "none",
                      border: "none",
                      borderBottom: `2px solid ${isActive ? cfg.color : "transparent"}`,
                      marginBottom: "-1px",
                      cursor: "pointer",
                      transition: "color 120ms ease, border-color 120ms ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {TAB_LABELS[type]}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        minWidth: "14px",
                        height: "14px",
                        borderRadius: "4px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 3px",
                        background: isActive ? cfg.bg : "transparent",
                        color: isActive
                          ? cfg.color
                          : count === 0
                            ? "var(--text-muted)"
                            : "var(--text-secondary)",
                        opacity: count === 0 ? 0.45 : 1,
                        transition: "background 120ms ease, color 120ms ease",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Single effect subtitle for active tab */}
            <div
              style={{
                fontSize: "12px",
                color: TYPE_CONFIG[activeTab].color,
                fontWeight: 500,
                paddingLeft: "2px",
                marginBottom: "2px",
                opacity: 0.85,
              }}
            >
              {ENTRY_EFFECT[activeTab]}
            </div>

            {/* Entry list — fills remaining space */}
            <div
              key={activeTab}
              className="scroll-styled dict-tab-content"
              style={{ overflowY: "auto", flex: 1 }}
            >
              {filteredDictEntries.length === 0 ? (
                <div
                  style={{
                    paddingTop: "36px",
                    textAlign: "center",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {search ? (
                    <>
                      Nenhum resultado para{" "}
                      <strong
                        style={{
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        &ldquo;{search}&rdquo;
                      </strong>
                    </>
                  ) : (
                    "Nenhuma entrada neste tipo."
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {filteredDictEntries.map((entry) => {
                    const applied = appliedEntries.has(entry.id);
                    const expanded = expandedDictEntry === entry.id;
                    const cfg = TYPE_CONFIG[entry.type];
                    const hasExtra =
                      entry.type === "categories" &&
                      (entry.items?.length ?? 0) > 0;

                    return (
                      <div
                        key={entry.id}
                        style={{
                          borderRadius: "7px",
                          border: `1px solid ${applied ? cfg.borderApplied : "transparent"}`,
                          background: applied ? cfg.bg : "transparent",
                          transition:
                            "background 150ms ease, border-color 150ms ease",
                          overflow: "hidden",
                        }}
                      >
                        {/* Main row: title + description + apply */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            padding: "10px 10px 10px 12px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: applied
                                  ? cfg.color
                                  : "var(--text-default)",
                                lineHeight: 1.3,
                                marginBottom: "2px",
                                transition: "color 150ms ease",
                              }}
                            >
                              {entry.title}
                            </div>
                            {entry.description && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-secondary)",
                                  lineHeight: 1.4,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {entry.description}
                              </div>
                            )}
                            {hasExtra && (
                              <button
                                onClick={() =>
                                  setExpandedDictEntry(
                                    expanded ? null : entry.id,
                                  )
                                }
                                style={{
                                  marginTop: "4px",
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  fontSize: "11.5px",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                <ChevronRight
                                  size={10}
                                  strokeWidth={2.5}
                                  style={{
                                    transition: "transform 150ms ease",
                                    transform: expanded
                                      ? "rotate(90deg)"
                                      : "rotate(0deg)",
                                  }}
                                />
                                {`${entry.items?.length ?? 0} categorias`}
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              applied
                                ? handleUnapply(entry.id)
                                : handleApply(entry)
                            }
                            className="dict-apply-btn"
                            style={{
                              flexShrink: 0,
                              fontSize: "12px",
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: "5px",
                              border: `1px solid ${applied ? cfg.borderApplied : "var(--border-strong)"}`,
                              background: applied ? cfg.bg : "transparent",
                              color: applied ? cfg.color : "var(--text-muted)",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              marginTop: "2px",
                            }}
                          >
                            {applied ? "✓" : "+"}
                          </button>
                        </div>

                        {/* Expanded items */}
                        {expanded && (
                          <div style={{ padding: "0 12px 10px 12px" }}>
                            {entry.type === "categories" && entry.items && (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "4px",
                                }}
                              >
                                {entry.items.map((item, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      fontSize: "12px",
                                      padding: "2px 7px",
                                      borderRadius: "5px",
                                      background: "var(--bg-tinted)",
                                      color: "var(--text-default)",
                                      border: "1px solid var(--border-default)",
                                    }}
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── CTA — anchored to bottom of col 3 ──────────────── */}
            <div
              style={{
                flexShrink: 0,
                borderTop: "1px solid rgba(107, 76, 199, 0.2)",
                padding: "20px 0 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <button
                onClick={openSaveDictModal}
                className="btn-secondary-action"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                <BookmarkPlus size={14} strokeWidth={1.8} />
                Salvar predefinição
              </button>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                {createError && (
                  <span
                    style={{
                      fontSize: "13px",
                      color: "oklch(0.62 0.2 25)",
                      flex: 1,
                    }}
                  >
                    {createError}
                  </span>
                )}
                <Link
                  href="/projects"
                  className="btn-secondary-action"
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Cancelar
                </Link>
                <button
                  onClick={handleCreate}
                  disabled={!canCreate || creating}
                  className="btn-cta"
                  style={{
                    opacity: canCreate ? 1 : 0.45,
                    cursor: canCreate ? "pointer" : "not-allowed",
                    animation: canCreate ? undefined : "none",
                    padding: "11px 28px",
                    fontSize: "15px",
                  }}
                  aria-disabled={!canCreate}
                >
                  {creating ? "Criando…" : "Criar Projeto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Database drawer ──────────────────────────────────────── */}
      {uploadedFile && (
        <DatabaseDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          file={uploadedFile}
          isNormalized={false}
          markedColumns={markedColumns}
          onColumnsChange={(cols) => {
            setMarkedColumns(cols);
            setColumnConfigs((prev) => syncColumnConfigKeys(cols, prev));
            setActiveConfigColumn((current) => {
              if (current && cols.includes(current)) return current;
              return cols[0] ?? null;
            });
          }}
        />
      )}

      {/* ── Save to Dict Modal ────────────────────────────────── */}
      {saveDictModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSaveDictModal(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              border: "1px solid var(--border-default)",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              margin: "16px",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  fontFamily: "var(--font-space-grotesk, inherit)",
                  color: "var(--text-default)",
                }}
              >
                Salvar Predefinição
              </span>
              <button
                onClick={() => setSaveDictModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px",
                  display: "flex",
                  borderRadius: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px 24px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Type selector */}
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--primary-700)",
                    marginBottom: "8px",
                  }}
                >
                  Tipo
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {(["context", "categories"] as DictType[]).map(
                    (type) => {
                      const cfg = TYPE_CONFIG[type];
                      const active = saveDictType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setSaveDictType(type)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "7px",
                            fontSize: "13px",
                            fontWeight: 600,
                            border: `1px solid ${active ? cfg.color : "var(--border-default)"}`,
                            background: active ? cfg.bg : "transparent",
                            color: active ? cfg.color : "var(--text-secondary)",
                            cursor: "pointer",
                            transition: "all 120ms ease",
                          }}
                        >
                          {TAB_LABELS[type]}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--primary-700)",
                    marginBottom: "8px",
                  }}
                >
                  Nome
                </div>
                <input
                  autoFocus
                  value={saveDictName}
                  onChange={(e) => setSaveDictName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && saveDictName.trim())
                      handleSaveToDict();
                  }}
                  placeholder="Nome da predefinição..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: "14px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "7px",
                    background: "var(--bg-tinted)",
                    color: "var(--text-default)",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                  }}
                >
                  Descrição{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      textTransform: "none",
                      opacity: 0.6,
                      letterSpacing: 0,
                    }}
                  >
                    (opcional)
                  </span>
                </div>
                <input
                  value={saveDictDesc}
                  onChange={(e) => setSaveDictDesc(e.target.value)}
                  placeholder="Breve descrição..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: "14px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "7px",
                    background: "transparent",
                    color: "var(--text-default)",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Content preview */}
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                  }}
                >
                  Conteúdo a salvar
                </div>
                {saveDictType === "context" && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg-tinted)",
                      borderRadius: "7px",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      maxHeight: "120px",
                      overflowY: "auto",
                    }}
                  >
                    {aiContext.trim() ? (
                      aiContext
                    ) : (
                      <em style={{ opacity: 0.5 }}>
                        Nenhum contexto preenchido
                      </em>
                    )}
                  </div>
                )}
                {saveDictType === "categories" && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "5px",
                      padding: "10px 12px",
                      background: "var(--bg-tinted)",
                      borderRadius: "7px",
                      minHeight: "44px",
                      alignItems: "flex-start",
                    }}
                  >
                    {classifyTags.length > 0 ? (
                      classifyTags.map((t) => (
                        <span
                          key={t}
                          style={{
                            padding: "3px 9px",
                            borderRadius: "5px",
                            background: "rgba(0,107,90,0.1)",
                            color: "var(--primary-700)",
                            border: "1px solid var(--border-active)",
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <em
                        style={{ fontSize: "13px", color: "var(--text-muted)" }}
                      >
                        Nenhuma tag criada
                      </em>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setSaveDictModal(false)}
                  className="btn-secondary-action"
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    background: "transparent",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "8px",
                    padding: "9px 18px",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveToDict}
                  disabled={!saveDictName.trim() || savingDict}
                  className="btn-primary"
                  style={{
                    opacity: saveDictName.trim() && !savingDict ? 1 : 0.45,
                    cursor:
                      saveDictName.trim() && !savingDict
                        ? "pointer"
                        : "not-allowed",
                  }}
                >
                  {savingDict ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
