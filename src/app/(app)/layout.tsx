import { TopNav } from "@/components/top-nav";
import { AttributionFooter } from "@/components/attribution-footer";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
      <AttributionFooter />
    </div>
  );
}
