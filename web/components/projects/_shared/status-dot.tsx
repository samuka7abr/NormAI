import { STATUS_COLOR, STATUS_LABEL } from "@/lib/project-status";

type DotStatus = "active" | "pending" | "error" | "empty";

interface StatusDotProps {
  status: DotStatus;
  /** Pulse green — project is new (appeared in list unseen) */
  isNew?: boolean;
  /** Pulse green — just finished processing in this session */
  justCompleted?: boolean;
  /** Diameter in px, default 9 */
  size?: number;
}

export function StatusDot({ status, isNew = false, justCompleted = false, size = 9 }: StatusDotProps) {
  const pulseGreen = status === "active" && (isNew || justCompleted);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        className={`status-dot${
          status === "error"
            ? " status-dot--error"
            : pulseGreen
              ? " status-dot--new"
              : ""
        }`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          background: STATUS_COLOR[status],
        }}
      />
      <span className="sr-only">{STATUS_LABEL[status]}</span>
    </div>
  );
}
