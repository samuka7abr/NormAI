"use client";

import { useEffect, useRef, useState } from "react";
import { getExecutionStatus } from "@/lib/reports";
import type { ExecutionStatusData } from "@/types/report";

interface UseExecutionPollingParams {
  reportId: string | null;
  executionId: string | null;
  projectId: string;
  /** Liga/desliga o polling. */
  enabled: boolean;
  /** Intervalo entre tentativas (ms). Default 3s. */
  intervalMs?: number;
  /** Chamado uma vez quando a execução atinge estado terminal (READY/ERROR). */
  onTerminal?: (data: ExecutionStatusData) => void;
}

interface UseExecutionPollingReturn {
  data: ExecutionStatusData | null;
  error: Error | null;
  isPolling: boolean;
}

const TERMINAL = new Set(["READY", "ERROR"]);

/**
 * Faz polling do status de uma execução até ela terminar (READY/ERROR).
 *
 * Usa setTimeout encadeado (não setInterval) pra nunca sobrepor requisições.
 * Sobrevive a reload: basta ter os ids persistidos — não precisa dos bytes
 * do arquivo, já que a execução já existe no backend.
 */
export function useExecutionPolling({
  reportId,
  executionId,
  projectId,
  enabled,
  intervalMs = 3000,
  onTerminal,
}: UseExecutionPollingParams): UseExecutionPollingReturn {
  const [data, setData] = useState<ExecutionStatusData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    if (!enabled || !reportId || !executionId) {
      setIsPolling(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setIsPolling(true);
    setError(null);

    async function tick() {
      try {
        const result = await getExecutionStatus(reportId!, executionId!, projectId);
        if (cancelled) return;
        setData(result);

        if (TERMINAL.has(result.status)) {
          setIsPolling(false);
          onTerminalRef.current?.(result);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // Erro transitório de rede não derruba o polling — tenta de novo.
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, reportId, executionId, projectId, intervalMs]);

  return { data, error, isPolling };
}
