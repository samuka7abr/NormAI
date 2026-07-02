"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderOpen,
  LogOut,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SIDEBAR_EASE,
  SIDEBAR_DURATION,
  SEARCH_SLIDE_UP,
  SIDEBAR_DEFAULT_W,
  SIDEBAR_MIN_W,
  SIDEBAR_MAX_W,
  SIDEBAR_COLLAPSED_W,
  NAV,
  PROJECTS,
  ACCOUNT_LINKS,
  revealStyle,
  applyTheme,
  type Theme,
} from "@/lib/sidebar-config";
import { useAuth } from "@/contexts/AuthContext";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const userName = user
    ? `${user.name ?? ""} ${user.last_name ?? ""}`.trim()
    : "";
  const userEmail = user?.email ?? "";
  const userInitials = user
    ? `${user.name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";

  const [expanded, setExpanded] = useState(false);
  const [isRising, setIsRising] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  useEffect(() => {
    const saved = localStorage.getItem("normai-theme");
    if (saved) { setIsDark(saved === "dark"); return; }
    setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);
  const [accountPos, setAccountPos] = useState({ bottom: 0, left: 0 });
  const [logoutPending, setLogoutPending] = useState(false);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT_W;
    const savedW = localStorage.getItem("sidebar-width");
    return savedW
      ? Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, parseInt(savedW, 10)))
      : SIDEBAR_DEFAULT_W;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const accountDropRef = useRef<HTMLDivElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const bottomBlockRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sidebarDragRef = useRef({ startX: 0, startW: 0 });

  /* Mark as mounted for portal rendering */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /* Hydrate last-project-id from localStorage after mount */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setLastProjectId(localStorage.getItem("last-project-id"));
  }, []);

  /* Apply saved theme to DOM on mount */
  useEffect(() => {
    const saved = localStorage.getItem("normai-theme") as Theme | null;
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  /* Track last opened project */
  useEffect(() => {
    const match = pathname.match(/^\/projects\/([^/]+)$/);
    if (match && match[1] !== "new") {
      const id = match[1];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastProjectId(id);
      localStorage.setItem("last-project-id", id);
    }
  }, [pathname]);

  /* Fade in modal overlay one frame after mount */
  useEffect(() => {
    if (searchModalOpen) {
      const id = requestAnimationFrame(() => setModalVisible(true));
      return () => cancelAnimationFrame(id);
    }
  }, [searchModalOpen]);

  /* Cleanup close timers */
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (accountCloseTimerRef.current)
        clearTimeout(accountCloseTimerRef.current);
    },
    [],
  );

  /* Close account on outside click */
  useEffect(() => {
    if (!accountOpen) return;
    function h(e: MouseEvent) {
      if (
        accountDropRef.current?.contains(e.target as Node) ||
        accountBtnRef.current?.contains(e.target as Node)
      )
        return;
      closeAccount();
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [accountOpen]);

  /* Escape closes account dropdown */
  useEffect(() => {
    if (!accountOpen) return;
    function h(e: KeyboardEvent) {
      if (e.key === "Escape") closeAccount();
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [accountOpen]);

  /* Close search modal on Escape */
  useEffect(() => {
    if (!searchModalOpen) return;
    function h(e: KeyboardEvent) {
      if (e.key === "Escape") closeSearchModal();
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [searchModalOpen]);

  /* CMD+K / CTRL+K opens search modal */
  useEffect(() => {
    function h(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchQuery("");
        openSearchModal();
      }
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  /* Focus modal input when opened */
  useEffect(() => {
    if (searchModalOpen) setTimeout(() => modalInputRef.current?.focus(), 40);
  }, [searchModalOpen]);

  /* Track bottom block height for search translate animation */
  useEffect(() => {
    const el = bottomBlockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBottomHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Persist sidebar width after drag settles */
  useEffect(() => {
    if (isResizingSidebar) return;
    const t = setTimeout(
      () => localStorage.setItem("sidebar-width", String(sidebarWidth)),
      300,
    );
    return () => clearTimeout(t);
  }, [sidebarWidth, isResizingSidebar]);

  function toggleTheme() {
    const next: Theme = isDark ? "light" : "dark";
    setIsDark(!isDark);
    applyTheme(next);
  }

  function onSidebarResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    sidebarDragRef.current = {
      startX: e.clientX,
      startW: expanded ? sidebarWidth : SIDEBAR_COLLAPSED_W,
    };
    setIsResizingSidebar(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      const newW =
        sidebarDragRef.current.startW +
        (ev.clientX - sidebarDragRef.current.startX);
      if (newW < SIDEBAR_MIN_W - 30) {
        setExpanded(false);
        setIsRising(false);
        setSearchQuery("");
      } else {
        const clamped = Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, newW));
        setIsRising(true);
        setExpanded(true);
        setSidebarWidth(clamped);
      }
    }

    function onUp() {
      setIsResizingSidebar(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function openAccount() {
    if (accountOpen) {
      closeAccount();
      return;
    }
    if (accountBtnRef.current) {
      const rect = accountBtnRef.current.getBoundingClientRect();
      setAccountPos({
        bottom: window.innerHeight - rect.top + 8,
        left: expanded ? rect.left : rect.right + 8,
      });
    }
    setLogoutPending(false);
    setAccountOpen(true);
    requestAnimationFrame(() => setAccountVisible(true));
  }

  function closeAccount(cb?: () => void) {
    setAccountVisible(false);
    if (accountCloseTimerRef.current)
      clearTimeout(accountCloseTimerRef.current);
    accountCloseTimerRef.current = setTimeout(() => {
      setAccountOpen(false);
      setLogoutPending(false);
      cb?.();
    }, 200);
  }

  function handleLogout() {
    if (!logoutPending) {
      setLogoutPending(true);
      return;
    }
    closeAccount(async () => {
      await logout();
      router.push("/login");
    });
  }

  function toggleSidebar(forceOpen?: boolean) {
    const opening = forceOpen ?? !expanded;
    if (opening) {
      setIsRising(true);
      requestAnimationFrame(() => setExpanded(true));
    } else {
      setIsRising(false);
      setExpanded(false);
      setSearchQuery("");
    }
  }

  function openSearchModal() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSearchQuery("");
    setSearchModalOpen(true);
  }

  function closeSearchModal() {
    setModalVisible(false);
    closeTimerRef.current = setTimeout(() => setSearchModalOpen(false), 250);
  }

  function handleProjectsNavClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!lastProjectId) {
      openSearchModal();
      return;
    }
    router.push(`/projects/${lastProjectId}`);
  }

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const filtered = PROJECTS.filter((p) =>
    normalize(p.title).includes(normalize(searchQuery)),
  );
  const W = expanded ? sidebarWidth : SIDEBAR_COLLAPSED_W;
  const itemMaxW = expanded ? `${sidebarWidth - 20}px` : "40px";
  const modalId = "sb-search-modal-label";

  const searchTranslateY = expanded
    ? 0
    : Math.max(0, bottomHeight - 14 - 36 - 8);
  const slideTransition = isRising
    ? `transform ${SEARCH_SLIDE_UP}ms ${SIDEBAR_EASE}`
    : `transform ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`;

  /* Derive active states */
  const onProjectDetail =
    /^\/projects\/[^/]+$/.test(pathname) && pathname !== "/projects/new";

  function isNavActive(href: string) {
    if (href === "/projects") return pathname === "/projects";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="sb"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, a, input")) return;
          toggleSidebar();
        }}
        style={{
          cursor: "pointer",
          width: `${W}px`,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "sticky",
          top: 0,
          overflow: "hidden",
          willChange: "width",
          contain: "layout style",
          transition: isResizingSidebar
            ? "none"
            : `width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
        }}
      >
        {/* ── TOP BLOCK ────────────────────────────────────────── */}
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            padding: expanded ? "22px 10px 16px" : "22px 15px 16px",
            minHeight: 0,
          }}
        >
          {/* Header: logo + toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: expanded ? "space-between" : "center",
              height: "36px",
              marginBottom: "16px",
              flexShrink: 0,
            }}
          >
            {expanded && (
              <Link
                href="/projects"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  textDecoration: "none",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <Image
                  src="/whiteN.svg"
                  alt="NormAI"
                  width={26}
                  height={26}
                  className="sb-logo"
                  style={{ flexShrink: 0 }}
                />
                <span className="sb-wordmark">NormAI</span>
              </Link>
            )}
            <button
              onClick={() => toggleSidebar()}
              className="sb-panel-toggle"
              aria-label={expanded ? "Colapsar menu" : "Expandir menu"}
              style={{
                width: expanded ? "32px" : "40px",
                height: expanded ? "32px" : "40px",
                flexShrink: 0,
              }}
            >
              <PanelLeft size={24} strokeWidth={1.8} />
            </button>
          </div>

          {/* Nav links */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginTop: "8px",
            }}
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isNavActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`sb-icon-link${active ? " active" : ""}`}
                  aria-label={label}
                  title={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: expanded ? "10px" : "0",
                    height: expanded ? "36px" : "40px",
                    width: "100%",
                    maxWidth: expanded ? itemMaxW : "40px",
                    alignSelf: "center",
                    padding: expanded ? "0 12px" : "0",
                    justifyContent: expanded ? "flex-start" : "center",
                    borderRadius: "8px",
                    textDecoration: "none",
                    transition: `max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, height ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, gap ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
                  }}
                >
                  <Icon
                    size={23}
                    strokeWidth={active ? 2 : 1.6}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    aria-hidden="true"
                    className={active ? "sb-text-link active" : "sb-text-link"}
                    style={{
                      ...revealStyle(expanded),
                      padding: 0,
                      background: "transparent",
                      fontSize: "14px",
                      fontWeight: active ? 600 : 500,
                      color: "inherit",
                    }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}

            {/* Gerenciar Conta */}
            {(() => {
              const active = pathname === "/account/settings";
              return (
                <Link
                  href="/account/settings"
                  className={`sb-icon-link${active ? " active" : ""}`}
                  aria-label="Gerenciar conta"
                  title="Gerenciar conta"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: expanded ? "10px" : "0",
                    height: expanded ? "36px" : "40px",
                    width: "100%",
                    maxWidth: expanded ? itemMaxW : "40px",
                    alignSelf: "center",
                    padding: expanded ? "0 12px" : "0",
                    justifyContent: expanded ? "flex-start" : "center",
                    borderRadius: "8px",
                    textDecoration: "none",
                    transition: `max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, height ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, gap ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
                  }}
                >
                  <Settings
                    size={20}
                    strokeWidth={active ? 2 : 1.6}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    aria-hidden="true"
                    className={active ? "sb-text-link active" : "sb-text-link"}
                    style={{
                      ...revealStyle(expanded),
                      padding: 0,
                      background: "transparent",
                      fontSize: "14px",
                      fontWeight: active ? 600 : 500,
                      color: "inherit",
                    }}
                  >
                    Gerenciar Conta
                  </span>
                </Link>
              );
            })()}

            {/* Projects nav item — links to last opened project */}
            <a
              href={lastProjectId ? `/projects/${lastProjectId}` : "/projects"}
              onClick={handleProjectsNavClick}
              className={`sb-icon-link${onProjectDetail ? " active" : ""}`}
              aria-label="Projetos"
              title="Projetos"
              style={{
                display: "flex",
                alignItems: "center",
                gap: expanded ? "10px" : "0",
                height: expanded ? "36px" : "40px",
                width: "100%",
                maxWidth: expanded ? itemMaxW : "40px",
                alignSelf: "center",
                padding: expanded ? "0 12px" : "0",
                justifyContent: expanded ? "flex-start" : "center",
                borderRadius: "8px",
                textDecoration: "none",
                transition: `max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, height ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, gap ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
              }}
            >
              <FolderOpen
                size={23}
                strokeWidth={onProjectDetail ? 2 : 1.6}
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              />
              <span
                aria-hidden="true"
                className={
                  onProjectDetail ? "sb-text-link active" : "sb-text-link"
                }
                style={{
                  ...revealStyle(expanded),
                  padding: 0,
                  background: "transparent",
                  fontSize: "14px",
                  fontWeight: onProjectDetail ? 600 : 500,
                  color: "inherit",
                }}
              >
                Projetos
              </span>
            </a>

            {/* Criar Novo */}
            {(() => {
              const active = pathname === "/projects/new";
              return (
                <Link
                  href="/projects/new"
                  className={`sb-icon-link${active ? " active" : ""}`}
                  aria-label="Criar novo projeto"
                  title="Criar novo projeto"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: expanded ? "10px" : "0",
                    height: expanded ? "36px" : "40px",
                    width: "100%",
                    maxWidth: expanded ? itemMaxW : "40px",
                    alignSelf: "center",
                    padding: expanded ? "0 12px" : "0",
                    justifyContent: expanded ? "flex-start" : "center",
                    borderRadius: "8px",
                    textDecoration: "none",
                    transition: `max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, height ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, gap ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
                  }}
                >
                  <Plus
                    size={23}
                    strokeWidth={active ? 2 : 1.6}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    aria-hidden="true"
                    className={active ? "sb-text-link active" : "sb-text-link"}
                    style={{
                      ...revealStyle(expanded),
                      padding: 0,
                      background: "transparent",
                      fontSize: "14px",
                      fontWeight: active ? 600 : 500,
                      color: "inherit",
                    }}
                  >
                    Criar Novo
                  </span>
                </Link>
              );
            })()}
          </div>
        </div>

        {/* ── FIRST DIVIDER ────────────────────────────────────── */}
        <div
          className="sb-divider"
          style={{
            transform: `translateY(${searchTranslateY}px)`,
            transition: slideTransition,
          }}
        />

        {/* ── BOTTOM BLOCK ─────────────────────────────────────── */}
        <div
          ref={bottomBlockRef}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: expanded ? "14px 14px 0" : "14px 15px 0",
            transition: `padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
          }}
        >
          {/* Search wrapper — always in DOM, slides via transform */}
          <div
            style={{
              position: "relative",
              height: expanded ? "36px" : "40px",
              width: expanded ? "100%" : "40px",
              margin: expanded ? 0 : "0 auto",
              flexShrink: 0,
              transform: `translateY(${searchTranslateY}px)`,
              transition: slideTransition,
            }}
          >
            {/* Icon button — visible when collapsed */}
            <button
              onClick={() => openSearchModal()}
              className="sb-icon-btn"
              aria-label="Buscar projeto (⌘K)"
              title="Buscar (⌘K)"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                opacity: expanded ? 0 : 1,
                pointerEvents: expanded ? "none" : "auto",
                transition: expanded
                  ? "opacity 80ms ease"
                  : `opacity 120ms ease ${SIDEBAR_DURATION * 0.25}ms`,
              }}
            >
              <Search size={20} strokeWidth={1.6} />
            </button>

            {/* Search field — visible when expanded */}
            <div
              className="sb-search-field"
              style={{
                position: "absolute",
                inset: 0,
                opacity: expanded ? 1 : 0,
                pointerEvents: expanded ? "auto" : "none",
                transition: expanded
                  ? "opacity 180ms ease 354ms"
                  : "opacity 60ms ease",
              }}
            >
              <Search
                size={13}
                strokeWidth={1.9}
                className="sb-search-icon"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Buscar projeto…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sb-search-input"
                aria-label="Buscar projeto"
              />
            </div>
          </div>

          {/* Project list — expanded only */}
          {expanded && (
            <div
              className="sb-project-list sb-projects-animate"
              style={{ flex: 1, overflowY: "auto", marginTop: "14px" }}
            >
              {filtered.length === 0 ? (
                <div
                  className="sb-fade-in"
                  style={{ padding: "12px 8px", textAlign: "center" }}
                >
                  {searchQuery && (
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.72)",
                        margin: "0 0 3px",
                        letterSpacing: "-0.01em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      &ldquo;{searchQuery}&rdquo;
                    </p>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 500,
                      fontStyle: "normal",
                      color: "rgba(255,255,255,0.62)",
                    }}
                  >
                    Nenhum resultado.
                  </p>
                </div>
              ) : (
                filtered.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className={`sb-project-item${pathname === `/projects/${p.id}` ? " active" : ""}`}
                  >
                    {p.title}
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── THEME TOGGLE — between bottom block and account ──── */}
        <div
          style={{
            flexShrink: 0,
            padding: expanded ? "10px 14px 14px" : "10px 15px 14px",
            transition: `padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
          }}
        >
          <button
            onClick={toggleTheme}
            className="sb-icon-btn"
            aria-label={
              isDark ? "Mudar para modo claro" : "Mudar para modo escuro"
            }
            title={isDark ? "Modo claro" : "Modo escuro"}
            style={{
              width: "100%",
              maxWidth: expanded ? itemMaxW : "40px",
              alignSelf: "center",
              justifyContent: expanded ? "flex-start" : "center",
              gap: expanded ? "10px" : "0",
              padding: expanded ? "0 12px" : "0",
              height: expanded ? "36px" : "40px",
              transition: `max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, height ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, gap ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
            }}
          >
            {isDark ? (
              <Sun
                size={22}
                strokeWidth={1.7}
                className="sb-theme-sun"
                style={{ flexShrink: 0 }}
              />
            ) : (
              <Moon
                size={22}
                strokeWidth={1.7}
                className="sb-theme-moon"
                style={{ flexShrink: 0 }}
              />
            )}
            <span
              aria-hidden="true"
              style={{
                ...revealStyle(expanded),
                fontSize: "14px",
                letterSpacing: "-0.01em",
                fontWeight: 400,
                color: "inherit",
              }}
            >
              {isDark ? "Modo claro" : "Modo escuro"}
            </span>
          </button>
        </div>

        {/* ── SECOND DIVIDER ───────────────────────────────────── */}
        <div className="sb-divider" />

        {/* ── ACCOUNT ──────────────────────────────────────────── */}
        <div
          style={{
            padding: expanded ? "12px 10px 18px" : "12px 15px 18px",
            flexShrink: 0,
          }}
        >
          <button
            ref={accountBtnRef}
            onClick={openAccount}
            className="sb-account-btn"
            aria-expanded={accountOpen}
            aria-label="Conta"
            title="Conta"
            style={{
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "6px 8px" : "6px",
              width: "100%",
              maxWidth: expanded ? itemMaxW : "40px",
              height: expanded ? "auto" : "40px",
              alignSelf: "center",
              gap: expanded ? "10px" : "0",
              transition: `max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, padding ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}, gap ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
            }}
          >
            <div className="sb-avatar">{userInitials}</div>
            <div
              style={{
                ...revealStyle(expanded),
                textAlign: "left",
                minWidth: 0,
              }}
            >
              <div className="sb-account-name">{userName}</div>
              <div className="sb-account-email">{userEmail}</div>
            </div>
          </button>
        </div>

        {/* ── Resize handle ────────────────────────────────────── */}
        <div
          className={`sb-resize-handle${isResizingSidebar ? " is-dragging" : ""}`}
          onMouseDown={onSidebarResizeStart}
          onClick={(e) => e.stopPropagation()}
        />
      </aside>

      {/* ── Search Modal (portal to document.body) ───────────────── */}
      {searchModalOpen &&
        isMounted &&
        createPortal(
          <div
            className={`sb-modal-overlay${modalVisible ? " is-visible" : ""}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeSearchModal();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalId}
          >
            <div className="sb-modal-panel">
              <div className="sb-modal-row">
                <span id={modalId} className="sr-only">
                  Buscar projeto
                </span>
                <Search
                  size={18}
                  strokeWidth={1.9}
                  className="sb-modal-icon"
                  aria-hidden="true"
                />
                <input
                  ref={modalInputRef}
                  type="text"
                  placeholder="Buscar projeto…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="sb-modal-input"
                  aria-label="Buscar projeto"
                />
                <button
                  onClick={closeSearchModal}
                  className="sb-modal-close"
                  aria-label="Fechar busca"
                >
                  <X size={16} strokeWidth={2.2} />
                </button>
              </div>
              <div className="sb-modal-results">
                {filtered.length === 0 ? (
                  <p className="sb-modal-empty">Nenhum projeto encontrado</p>
                ) : (
                  filtered.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="sb-modal-item"
                      onClick={() => {
                        closeSearchModal();
                        setSearchQuery("");
                      }}
                    >
                      <FolderOpen
                        size={16}
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                      {p.title}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Account overlay ──────────────────────────────────────── */}
      {accountOpen && (
        <div
          ref={accountDropRef}
          className={`sb-overlay${accountVisible ? " is-visible" : ""}`}
          style={{
            position: "fixed",
            bottom: accountPos.bottom,
            left: accountPos.left,
          }}
        >
          <div className="sb-overlay-header">
            <div className="sb-overlay-avatar">{userInitials}</div>
            <div className="sb-overlay-identity">
              <div className="sb-overlay-name">{userName}</div>
              <div className="sb-overlay-email">{userEmail}</div>
            </div>
          </div>
          <div className="sb-overlay-links">
            {ACCOUNT_LINKS.map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                className="sb-overlay-item"
                onClick={() => closeAccount()}
              >
                <Icon size={14} strokeWidth={1.6} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
          <div className="sb-overlay-footer">
            {logoutPending ? (
              <div className="sb-overlay-confirm">
                <p className="sb-overlay-confirm-label">Confirmar saída?</p>
                <div className="sb-overlay-confirm-actions">
                  <button
                    className="sb-overlay-btn-cancel"
                    onClick={() => setLogoutPending(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="sb-overlay-btn-danger"
                    onClick={handleLogout}
                  >
                    <LogOut size={13} strokeWidth={1.8} aria-hidden="true" />
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <button className="sb-overlay-item danger" onClick={handleLogout}>
                <LogOut size={14} strokeWidth={1.6} aria-hidden="true" />
                Sair
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
