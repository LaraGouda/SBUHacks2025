import { AppHeader } from "@/components/AppHeader";
import { NavLink } from "@/components/NavLink";

const ProjectUpdates = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbd3c9_0%,_#cec4b7_55%,_#c3b8a9_100%)]">
      <AppHeader showBack />
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold text-[#2f2318]">Project Walkthrough</h1>
            <p className="text-sm text-[#5d4a39]">
              This page is a demo walkthrough of FollowUp with key screenshots across transcript analysis, history, and dashboard views.
            </p>
          </header>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-[#2f2318]">Transcript Analysis Page</h2>
            <div className="rounded-xl border border-[#a18871] bg-[#ded4c8] p-3 shadow-lg">
              <img
                src="/transcriptanalysis.png"
                alt="FollowUp analysis page screenshot"
                className="h-auto w-full rounded-lg border border-[#b39c86] object-contain"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-[#2f2318]">History + Dashboard Continuation</h2>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-xl border border-[#a18871] bg-[#ded4c8] p-3 shadow-lg">
                <p className="mb-2 text-sm font-medium text-[#3d2d1f]">History Page</p>
                <img
                  src="/history.png"
                  alt="History page screenshot"
                  className="w-full rounded-lg border border-[#b39c86] object-contain"
                />
              </div>
              <div className="grid gap-6">
                <div className="rounded-xl border border-[#a18871] bg-[#ded4c8] p-3 shadow-lg">
                  <p className="mb-2 text-sm font-medium text-[#3d2d1f]">Dashboard - Email Drafts</p>
                  <img
                    src="/dashboard-emaildrafts.png"
                    alt="Dashboard email drafts screenshot"
                    className="w-full rounded-lg border border-[#b39c86] object-contain"
                  />
                </div>
                <div className="rounded-xl border border-[#a18871] bg-[#ded4c8] p-3 shadow-lg">
                  <p className="mb-2 text-sm font-medium text-[#3d2d1f]">Dashboard - Calendar Events</p>
                  <img
                    src="/dashboard-calendar.png"
                    alt="Dashboard calendar events screenshot"
                    className="w-full rounded-lg border border-[#b39c86] object-contain"
                  />
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t mt-0 py-1">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <span>© 2025 FollowUp. Transform your meetings into actionable insights.</span>
            <NavLink
              className="underline underline-offset-4 transition hover:text-foreground"
              to="/privacypolicy"
            >
              Privacy Policy
            </NavLink>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ProjectUpdates;
