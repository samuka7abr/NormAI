import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-shell" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <main
        className="dashboard-page-bg"
        style={{ flex: 1, overflow: "hidden", height: "100%", margin: "10px 10px 10px 0", borderRadius: "12px" }}
      >
        {children}
      </main>
    </div>
  );
}
