import { Lock, UserPlus, KeyRound } from 'lucide-react';

interface Props {
  onContinue: () => void;
}

export default function LoginScreen({ onContinue }: Props) {
  return (
    <div className="w-[420px] min-h-[540px] bg-bg-primary p-8 flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease]">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-blue to-accent-blue flex items-center justify-center mb-4 shadow-lg shadow-accent-blue/20">
        <Lock className="w-7 h-7 text-white" />
      </div>
      <h2 className="text-lg font-bold text-text-primary mb-1">Sign In</h2>
      <p className="text-xs text-text-muted mb-6 text-center">
        Log in to unlock higher scan limits and premium features.
      </p>

      <div className="w-full space-y-3 mb-4">
        <div>
          <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full px-3 py-2 bg-bg-card border border-ui-border/[0.06] rounded-md text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-bg-card border border-ui-border/[0.06] rounded-md text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
          />
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full py-2.5 bg-gradient-to-br from-accent-blue to-accent-blue text-on-accent rounded-md text-sm font-semibold shadow-lg shadow-accent-blue/10 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all"
      >
        Log In
      </button>

      <div className="flex items-center gap-3 mt-4 text-xs">
        <button className="text-accent-blue font-medium hover:text-accent-blue-hover flex items-center gap-1">
          <UserPlus className="w-3 h-3" /> Create account
        </button>
        <button className="text-accent-blue font-medium hover:text-accent-blue-hover flex items-center gap-1">
          <KeyRound className="w-3 h-3" /> Forgot password?
        </button>
      </div>

      <button
        onClick={onContinue}
        className="mt-3 px-4 py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-ui-overlay/[0.03] rounded-md transition-all"
      >
        Continue as Guest (Free Tier — 50 polls/day)
      </button>
    </div>
  );
}
