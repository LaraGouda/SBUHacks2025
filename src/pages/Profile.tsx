import { useAuth } from "@/contexts/AuthContext";
import { useGoogleAuth } from "@/contexts/GoogleAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, CheckCircle, XCircle, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { NavLink } from "@/components/NavLink";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isGoogleConnected, connectGoogle, disconnectGoogle } = useGoogleAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader showBack />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
            <p className="text-muted-foreground">Manage your account and integration settings</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details and authentication status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                <p className="text-base">{user?.email || "Not available"}</p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">User ID</p>
                <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{user?.id || "Not available"}</p>
              </div>

              <Separator />

              <div className="pt-4">
                <Button variant="destructive" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Google Integration
              </CardTitle>
              <CardDescription>
                Connect your Google account to send emails and create calendar events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Connection Status</p>
                    {isGoogleConnected ? (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isGoogleConnected 
                      ? "Your Google account is connected and ready to use"
                      : "Connect Google to enable email and calendar features"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Available Features</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>Send follow-up emails via Gmail</span>
                    {isGoogleConnected && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Create calendar events automatically</span>
                    {isGoogleConnected && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                {isGoogleConnected ? (
                  <Button variant="outline" onClick={disconnectGoogle}>
                    Disconnect Google Account
                  </Button>
                ) : (
                  <Button onClick={connectGoogle}>
                    Connect Google Account
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t mt-20 py-8 bg-card/50 backdrop-blur-sm">
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
}
