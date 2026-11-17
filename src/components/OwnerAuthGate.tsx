import React, { useState } from 'react';
import { Shield, Lock, KeyRound, Tv } from 'lucide-react';
import { useGameSync } from '../context/GameSyncContext';
import { OceanicBackdrop } from './OceanicBackdrop';

export const OwnerAuthGate: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => {
  const { ownerAuth, authError, loginWithPasscode, loginWithGoogle } = useGameSync();
  const [passcode, setPasscode] = useState('2026');
  const [submitting, setSubmitting] = useState(false);

  if (ownerAuth.authenticated) {
    return <>{children}</>;
  }

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await loginWithPasscode(passcode.trim() || '2026');
    setSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    await loginWithGoogle();
    setSubmitting(false);
  };

  return (
    <div className="relative min-h-screen bg-[#040F1A] text-slate-100 flex items-center justify-center p-6 font-['Chakra_Petch'] overflow-hidden">
      <OceanicBackdrop fixed />
      <div className="relative z-10 w-full max-w-md glass-panel glass-noise rounded-2xl p-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#4DB8FF]/15 border border-[#4DB8FF]/45 flex items-center justify-center text-[#4DB8FF] shrink-0 shadow-[inset_0_1px_0_rgba(186,230,253,0.3)]">
              <Shield className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold font-['Unbounded'] tracking-tight text-white truncate">
                {title}
              </h1>
              <p className="text-xs text-slate-300">{subtitle}</p>
            </div>
          </div>
          <a
            href="/studio"
            target="_blank"
            rel="noreferrer"
            className="min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs font-bold text-[#4DB8FF] hover:border-[#4DB8FF]/60 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Tv className="w-4 h-4" />
            Studio Screen
          </a>
        </div>

        {/* Google Sign-In for Broadcast Owner */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white/95 text-slate-950 font-bold text-sm flex items-center justify-center gap-3 hover:bg-white transition-colors cursor-pointer mb-6 shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>Sign in with Google Owner Account</span>
        </button>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-[#4DB8FF]/20" />
          <span className="flex-shrink mx-3 text-xs text-slate-300">
            Or Studio Owner Passcode Fallback
          </span>
          <div className="flex-grow border-t border-[#4DB8FF]/20" />
        </div>

        <form onSubmit={handlePasscodeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Studio Owner Passcode (Default: 2026)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#4DB8FF] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter Studio Owner Passcode (2026)"
                className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl glass-panel-deep text-white font-['JetBrains_Mono'] text-sm focus:outline-none focus:border-[#4DB8FF]"
              />
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-[#FB6F84]/15 border border-[#FB6F84]/40 text-xs text-rose-200">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[0_0_24px_rgba(77,184,255,0.28)]"
          >
            <Lock className="w-4 h-4" />
            <span>{submitting ? 'Unlocking Console...' : 'Unlock Broadcast Console'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
