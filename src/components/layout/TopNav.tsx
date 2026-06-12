import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AtlasPin } from "@/components/brand/AtlasPin";

export function TopNav() {
  const { user } = useAuth();
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 md:px-6">
      <Link to="/" className="flex items-center gap-2 rounded-full bg-card/95 px-3 py-2 shadow-soft backdrop-blur ring-1 ring-border/60">
        <AtlasPin className="h-6 w-auto" />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          PropertyAtlas
        </span>
        <span className="ml-1 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:inline">
          Pilot · St Francis Bay
        </span>
      </Link>

      <nav className="flex items-center gap-1.5 rounded-full bg-card/90 p-1.5 shadow-soft backdrop-blur">
        <Link to="/pricing" className="hidden px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
          Pricing
        </Link>
        {user ? (
          <>
            <Link to="/dashboard" className="hidden px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              Dashboard
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full text-xs"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link to="/auth" className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link to="/auth">
              <Button size="sm" className="h-8 rounded-full bg-gradient-brand text-xs">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Start free
              </Button>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
