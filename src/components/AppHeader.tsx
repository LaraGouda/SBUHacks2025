import { ArrowLeft, History, LayoutDashboard, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";

type AppHeaderProps = {
  showBack?: boolean;
  onBack?: () => void;
  onDashboard?: () => void;
  onSignOut?: () => Promise<void> | void;
};

export const AppHeader = ({ showBack, onBack, onDashboard, onSignOut }: AppHeaderProps) => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAuthed = Boolean(user);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate("/");
  };

  const handleDashboard = () => {
    if (!isAuthed) {
      toast({
        title: "Sign in required",
        description: "Please sign in to access your dashboard.",
      });
      navigate("/auth");
      return;
    }
    if (onDashboard) {
      onDashboard();
      return;
    }
    navigate("/dashboard");
  };

  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
      return;
    }
    await signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
    navigate("/auth");
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="FollowUp" className="w-10 h-10" />
          <span className="text-xl font-bold text-foreground">FollowUp</span>
        </div>
        <div className="flex items-center gap-2">
          {showBack && (
            <Button type="button" variant="ghost" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          )}
          {isAuthed && (
            <Button type="button" variant="outline" onClick={handleDashboard}>
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          )}
          {isAuthed && (
            <Button asChild variant="outline">
              <NavLink to="/meetings">
                <History className="w-4 h-4 mr-2" />
                History
              </NavLink>
            </Button>
          )}
          {isAuthed && (
            <Button asChild variant="outline">
              <NavLink to="/profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </NavLink>
            </Button>
          )}
          {isAuthed ? (
            <Button type="button" variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          ) : (
            <Button asChild variant="outline">
              <NavLink to="/auth">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </NavLink>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
