import { Link } from "@tanstack/react-router";
import { MapPinned, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function TopNav() {
  const { user } = useAuth();
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 md:px-6">
      <Link to="/" className="flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 shadow-soft backdrop-blur">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-brand text-white">
          <MapPinned className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">
          Property<span className="text-primary">Atlas</span>
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
