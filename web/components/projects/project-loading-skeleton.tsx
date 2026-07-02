export function ProjectLoadingSkeleton() {
  return (
    <div style={{ flex: 1, padding: "60px 100px", maxWidth: "800px" }}>
      <div
        style={{
          height: "32px",
          background: "#e0e0e0",
          borderRadius: "4px",
          marginBottom: "24px",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: "20px",
          background: "#f0f0f0",
          borderRadius: "4px",
          marginBottom: "48px",
          animation: "pulse 1.5s ease-in-out infinite",
          maxWidth: "60%",
        }}
      />
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          style={{
            height: "16px",
            background: "#f5f5f5",
            borderRadius: "4px",
            marginBottom: "12px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
