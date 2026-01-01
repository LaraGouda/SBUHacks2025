import { Dashboard } from "@/components/Dashboard";
import { AppHeader } from "@/components/AppHeader";

const DashboardPage = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader showBack />
      <main className="container mx-auto px-4 py-12">
        <div className="animate-fade-in">
          <Dashboard />
        </div>
      </main>
      <footer className="border-t mt-0 py-1">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 FollowUp. Transform your meetings into actionable insights.</p>
        </div>
      </footer>
    </div>
  );
};

export default DashboardPage;
