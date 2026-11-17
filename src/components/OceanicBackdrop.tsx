import React, { useId } from 'react';

// Pixel-measured staggered brick lattice extracted from Asset_1_e5d12792.png:
// V1 = (124, -90), V2 = (0, 180) -> TILE_W = 248, TILE_H = 180
const TILE_W = 248;
const TILE_H = 180;
const STEP_X = 124;
const STEP_Y = -90;

function buildReferenceSHookMotif(ox: number, oy: number): string {
  const f = (n: number) => Number(n.toFixed(1));
  return [
    `M ${f(ox + 110)} ${f(oy - 102)}`,
    `C ${f(ox + 90)} ${f(oy - 122)}, ${f(ox + 60)} ${f(oy - 132)}, ${f(ox + 24)} ${f(oy - 100)}`,
    `C ${f(ox + 4)} ${f(oy - 74)}, ${f(ox - 12)} ${f(oy - 34)}, ${f(ox - 16)} ${f(oy + 8)}`,
    `C ${f(ox - 20)} ${f(oy + 42)}, ${f(ox - 22)} ${f(oy + 74)}, ${f(ox - 40)} ${f(oy + 90)}`,
    `C ${f(ox - 54)} ${f(oy + 96)}, ${f(ox - 64)} ${f(oy + 88)}, ${f(ox - 68)} ${f(oy + 78)}`,
    `C ${f(ox - 72)} ${f(oy + 106)}, ${f(ox - 54)} ${f(oy + 126)}, ${f(ox - 32)} ${f(oy + 126)}`,
    `C ${f(ox - 10)} ${f(oy + 126)}, ${f(ox + 4)} ${f(oy + 102)}, ${f(ox + 11)} ${f(oy + 70)}`,
    `C ${f(ox + 13)} ${f(oy + 44)}, ${f(ox + 13)} ${f(oy + 26)}, ${f(ox + 14)} ${f(oy + 8)}`,
    `C ${f(ox + 16)} ${f(oy - 24)}, ${f(ox + 24)} ${f(oy - 56)}, ${f(ox + 42)} ${f(oy - 76)}`,
    `C ${f(ox + 62)} ${f(oy - 100)}, ${f(ox + 84)} ${f(oy - 104)}, ${f(ox + 104)} ${f(oy - 96)}`,
    `L ${f(ox + 110)} ${f(oy - 102)} Z`,
  ].join(' ');
}

function buildSeamlessTilePath(): string {
  const parts: string[] = [];
  for (let m = -2; m <= 4; m++) {
    for (let n = -2; n <= 4; n++) {
      const ox = m * STEP_X;
      const oy = m * STEP_Y + n * TILE_H;
      if (ox >= -130 && ox <= TILE_W + 130 && oy >= -150 && oy <= TILE_H + 150) {
        parts.push(buildReferenceSHookMotif(ox, oy));
      }
    }
  }
  return parts.join(' ');
}

const REFERENCE_S_HOOK_PATTERN_D = buildSeamlessTilePath();

export const OceanicBackdrop: React.FC<{
  subtle?: boolean;
  fixed?: boolean;
  withAmbientGlow?: boolean;
}> = ({ subtle = false, fixed = false, withAmbientGlow = true }) => {
  const rawId = useId();
  const patternId = `fz-asset1-loop-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div
      className={`pointer-events-none ${
        fixed ? 'fixed inset-0 z-0' : 'absolute inset-0'
      } overflow-hidden`}
      aria-hidden="true"
    >
      {/* Reference Oceanic Teal (#0F6560) to Deep Petrol-Slate (#12343B) Gradient Base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(102deg, #0F6560 0%, #115555 28%, #13464A 56%, #12343B 100%)',
        }}
      />

      {/* Seamlessly Loopable Reference Calligraphic S-Hook Pattern */}
      <div
        className={`absolute -left-[260px] -right-[260px] -top-[200px] -bottom-[200px] animate-pattern-loop ${
          subtle ? 'opacity-35' : 'opacity-65'
        }`}
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id={patternId}
              width={TILE_W}
              height={TILE_H}
              patternUnits="userSpaceOnUse"
            >
              <path d={REFERENCE_S_HOOK_PATTERN_D} fill="#187E78" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      </div>

      {/* Reference Atmospheric Gradient Wash (Soft Aqua Blend Left -> Crisp Mid -> Calm Dark Petrol Right) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(104deg, rgba(15, 101, 96, 0.58) 0%, rgba(16, 92, 89, 0.14) 24%, rgba(18, 52, 59, 0.0) 58%, rgba(18, 52, 59, 0.42) 100%)',
        }}
      />

      {/* Subtle Dual-Team Coral & Cyan Rim Glow */}
      {withAmbientGlow && (
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(circle at 14% 8%, rgba(251,111,132,0.12), transparent 38%), radial-gradient(circle at 86% 8%, rgba(77,184,255,0.14), transparent 38%)',
          }}
        />
      )}
    </div>
  );
};
