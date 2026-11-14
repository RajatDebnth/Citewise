import React from 'react';

/**
 * 3D Icons inspired by 3dicons.co
 * Hand-crafted vector SVGs with multi-stop radial gradients, inner shadows, 
 * glassmorphic specular highlights, and ambient ground shadows.
 */

export const Icon3DShield: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="shieldBg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#2dd4bf" />
        <stop offset="35%" stopColor="#0d9488" />
        <stop offset="85%" stopColor="#075448" />
        <stop offset="100%" stopColor="#042f2c" />
      </radialGradient>
      <linearGradient id="shieldRim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d9f078" />
        <stop offset="50%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#022c22" />
      </linearGradient>
      <linearGradient id="shieldCore" x1="20%" y1="10%" x2="80%" y2="90%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="60%" stopColor="#d9f078" />
        <stop offset="100%" stopColor="#84cc16" />
      </linearGradient>
      <filter id="shieldShadow" x="-20%" y="-10%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#042f2c" floodOpacity="0.35" />
      </filter>
    </defs>
    {/* Ambient Floor Shadow */}
    <ellipse cx="60" cy="108" rx="42" ry="7" fill="#042f2c" opacity="0.18" />
    {/* Outer Shell */}
    <path
      d="M60 14 C84 14 98 24 98 48 C98 76 74 96 60 102 C46 96 22 76 22 48 C22 24 36 14 60 14 Z"
      fill="url(#shieldBg)"
      stroke="url(#shieldRim)"
      strokeWidth="3.5"
      filter="url(#shieldShadow)"
    />
    {/* Inner Specular Bevel */}
    <path
      d="M60 22 C78 22 90 30 90 48 C90 70 70 86 60 92 C50 86 30 70 30 48 C30 30 42 22 60 22 Z"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.5"
      strokeOpacity="0.4"
    />
    {/* Central Check Glyph */}
    <path
      d="M45 54 L55 64 L76 43"
      stroke="url(#shieldCore)"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Gloss Sheen */}
    <ellipse cx="48" cy="32" rx="16" ry="7" transform="rotate(-25 48 32)" fill="#ffffff" opacity="0.35" />
  </svg>
);

export const Icon3DDossier: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="docCover" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fffef9" />
        <stop offset="60%" stopColor="#f3f4ee" />
        <stop offset="100%" stopColor="#dfe2d5" />
      </linearGradient>
      <linearGradient id="docAccent" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d9f078" />
        <stop offset="100%" stopColor="#075448" />
      </linearGradient>
      <filter id="docShadow" x="-20%" y="-10%" width="140%" height="140%">
        <feDropShadow dx="4" dy="12" stdDeviation="8" floodColor="#075448" floodOpacity="0.2" />
      </filter>
    </defs>
    <ellipse cx="62" cy="106" rx="44" ry="8" fill="#171a17" opacity="0.15" />
    {/* Back Page */}
    <rect x="36" y="16" width="58" height="76" rx="8" fill="#e2e6d8" transform="rotate(6 36 16)" />
    {/* Front Page */}
    <g filter="url(#docShadow)">
      <rect x="26" y="20" width="60" height="80" rx="8" fill="url(#docCover)" stroke="#cbd3be" strokeWidth="2" />
      {/* Ribbon Bookmark */}
      <path d="M72 20 V46 L79 40 L86 46 V20 Z" fill="url(#docAccent)" />
      {/* Content Lines */}
      <rect x="38" y="38" width="28" height="4" rx="2" fill="#075448" />
      <rect x="38" y="48" width="40" height="3" rx="1.5" fill="#8d9785" />
      <rect x="38" y="56" width="34" height="3" rx="1.5" fill="#8d9785" />
      <rect x="38" y="64" width="38" height="3" rx="1.5" fill="#8d9785" />
      {/* Verified Stamp Badge */}
      <circle cx="68" cy="80" r="10" fill="#d9f078" stroke="#075448" strokeWidth="1.5" />
      <path d="M64 80 L67 83 L73 77" stroke="#075448" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

export const Icon3DVault: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="vaultBody" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#1f2937" />
        <stop offset="70%" stopColor="#111827" />
        <stop offset="100%" stopColor="#030712" />
      </radialGradient>
      <linearGradient id="vaultGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#d9f078" />
        <stop offset="100%" stopColor="#65a30d" />
      </linearGradient>
      <linearGradient id="shackleMetal" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#e5e7eb" />
        <stop offset="50%" stopColor="#9ca3af" />
        <stop offset="100%" stopColor="#4b5563" />
      </linearGradient>
      <filter id="vaultShadow">
        <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#000000" floodOpacity="0.4" />
      </filter>
    </defs>
    <ellipse cx="60" cy="108" rx="40" ry="7" fill="#000" opacity="0.25" />
    {/* Heavy Steel Shackle */}
    <path
      d="M38 52 V36 C38 24 48 16 60 16 C72 16 82 24 82 36 V52"
      fill="none"
      stroke="url(#shackleMetal)"
      strokeWidth="11"
      strokeLinecap="round"
    />
    {/* Lock Body */}
    <rect
      x="24"
      y="46"
      width="72"
      height="56"
      rx="14"
      fill="url(#vaultBody)"
      stroke="#374151"
      strokeWidth="2.5"
      filter="url(#vaultShadow)"
    />
    {/* Gold Rotating Dial */}
    <circle cx="60" cy="72" r="16" fill="url(#vaultGold)" stroke="#fef08a" strokeWidth="2" />
    <circle cx="60" cy="72" r="6" fill="#111827" />
    {/* Keyhole slot */}
    <rect x="58.5" y="72" width="3" height="8" rx="1.5" fill="#111827" />
    {/* Status Neon LED */}
    <circle cx="83" cy="56" r="3.5" fill="#34d399" />
    <circle cx="83" cy="56" r="6" fill="#34d399" opacity="0.3" />
  </svg>
);

export const Icon3DPrism: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="glassFace" x1="10%" y1="10%" x2="90%" y2="90%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="40%" stopColor="#a7f3d0" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#075448" stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id="spectrumBeam" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#d9f078" />
        <stop offset="40%" stopColor="#2dd4bf" />
        <stop offset="70%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="108" rx="38" ry="6" fill="#075448" opacity="0.2" />
    {/* Prism Pyramid Faces */}
    <polygon points="60,20 18,92 102,92" fill="url(#glassFace)" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.8" />
    <polygon points="60,20 60,92 102,92" fill="#075448" fillOpacity="0.35" />
    {/* Light refraction beam */}
    <path d="M12 50 L60 58 L108 44" stroke="url(#spectrumBeam)" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
    {/* Sparkling star */}
    <path d="M60 14 L62 20 L68 22 L62 24 L60 30 L58 24 L52 22 L58 20 Z" fill="#d9f078" />
  </svg>
);

export const Icon3DLightning: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="boltGrad" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="40%" stopColor="#d9f078" />
        <stop offset="85%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <filter id="boltGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#d9f078" floodOpacity="0.45" />
      </filter>
    </defs>
    <ellipse cx="62" cy="110" rx="36" ry="6" fill="#075448" opacity="0.2" />
    <path
      d="M68 12 L30 64 L58 64 L46 108 L94 48 L66 48 L78 12 Z"
      fill="url(#boltGrad)"
      stroke="#ffffff"
      strokeWidth="2.5"
      strokeLinejoin="round"
      filter="url(#boltGlow)"
    />
  </svg>
);

export const Icon3DVectorCluster: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="nodeGlow" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#d9f078" />
        <stop offset="70%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#075448" />
      </radialGradient>
    </defs>
    {/* Network Connectors */}
    <line x1="34" y1="40" x2="60" y2="72" stroke="#cbd6c2" strokeWidth="2.5" strokeDasharray="3 3" />
    <line x1="86" y1="36" x2="60" y2="72" stroke="#cbd6c2" strokeWidth="2.5" strokeDasharray="3 3" />
    <line x1="60" y1="72" x2="48" y2="98" stroke="#cbd6c2" strokeWidth="2.5" strokeDasharray="3 3" />
    <line x1="60" y1="72" x2="88" y2="92" stroke="#cbd6c2" strokeWidth="2.5" strokeDasharray="3 3" />
    {/* 3D Spherical Nodes */}
    <circle cx="34" cy="40" r="14" fill="url(#nodeGlow)" stroke="#fff" strokeWidth="2" />
    <circle cx="86" cy="36" r="12" fill="url(#nodeGlow)" stroke="#fff" strokeWidth="2" />
    <circle cx="48" cy="98" r="11" fill="url(#nodeGlow)" stroke="#fff" strokeWidth="1.5" />
    <circle cx="88" cy="92" r="10" fill="url(#nodeGlow)" stroke="#fff" strokeWidth="1.5" />
    {/* Central Core Master Node */}
    <circle cx="60" cy="72" r="18" fill="#075448" stroke="#d9f078" strokeWidth="3" />
    <text x="60" y="77" fill="#d9f078" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
      768d
    </text>
  </svg>
);

/**
 * OpenPeeps Characters
 * Handcrafted vector portraits inspired by Pablo Stanley's Open Peeps
 * with expressive human warmth, diverse personalities, and editorial line-art.
 */

export const PeepSarah: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="46" fill="#fef9c3" stroke="#eab308" strokeWidth="1.5" />
    {/* Hair Bun */}
    <circle cx="50" cy="22" r="14" fill="#451a03" />
    <circle cx="50" cy="15" r="9" fill="#78350f" />
    {/* Neck & Shoulders */}
    <path d="M42 62 V72 H58 V62" fill="#fed7aa" />
    <path d="M26 94 C26 78 40 74 50 74 C60 74 74 78 74 94 Z" fill="#075448" />
    <path d="M42 74 L50 82 L58 74" stroke="#d9f078" strokeWidth="2" fill="none" />
    {/* Face Base */}
    <path d="M34 38 C34 30 42 28 50 28 C58 28 66 30 66 38 V54 C66 62 58 66 50 66 C42 66 34 62 34 54 Z" fill="#fed7aa" />
    {/* Hair front strands */}
    <path d="M34 34 C40 26 60 26 66 34 C64 30 36 30 34 34 Z" fill="#451a03" />
    {/* Glasses */}
    <circle cx="43" cy="46" r="6" stroke="#171a17" strokeWidth="2" fill="#ffffff" fillOpacity="0.4" />
    <circle cx="57" cy="46" r="6" stroke="#171a17" strokeWidth="2" fill="#ffffff" fillOpacity="0.4" />
    <line x1="49" y1="46" x2="51" y2="46" stroke="#171a17" strokeWidth="2" />
    {/* Eyes */}
    <circle cx="43" cy="46" r="2" fill="#171a17" />
    <circle cx="57" cy="46" r="2" fill="#171a17" />
    {/* Cheerful Smile */}
    <path d="M46 56 Q50 60 54 56" stroke="#171a17" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

export const PeepMarcus: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="46" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
    {/* Curly Hair Top */}
    <path
      d="M30 36 C28 24 40 16 50 16 C62 16 72 24 70 36 C74 34 76 42 72 46 C70 42 68 40 66 40 V34 C66 26 58 22 50 22 C42 22 34 26 34 34 V40 C28 42 28 34 30 36 Z"
      fill="#1c1917"
    />
    {/* Neck & Shoulders */}
    <path d="M42 64 V72 H58 V64" fill="#fcd34d" />
    <path d="M24 94 C24 76 38 72 50 72 C62 72 76 76 76 94 Z" fill="#1e3a8a" />
    <path d="M50 72 V94" stroke="#60a5fa" strokeWidth="2" />
    {/* Face */}
    <path d="M34 36 C34 30 42 26 50 26 C58 26 66 30 66 36 V56 C66 64 58 68 50 68 C42 68 34 64 34 56 Z" fill="#fcd34d" />
    {/* Brows & Eyes */}
    <path d="M40 42 Q44 40 48 42" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
    <path d="M54 42 Q58 40 62 42" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
    <circle cx="44" cy="46" r="2" fill="#1c1917" />
    <circle cx="58" cy="46" r="2" fill="#1c1917" />
    {/* Short Beard & Smile */}
    <path d="M44 58 Q50 62 56 58" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M38 52 C38 66 46 70 50 70 C54 70 62 66 62 52" stroke="#78350f" strokeWidth="1.5" strokeDasharray="2 2" fill="none" />
  </svg>
);

export const PeepElena: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="46" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5" />
    {/* Hair Flow */}
    <path d="M30 34 C30 20 40 18 50 18 C60 18 70 20 70 34 V68 C70 74 66 78 62 76 C58 74 62 64 62 56 V36 H38 V56 C38 64 42 74 38 76 C34 78 30 74 30 68 Z" fill="#b45309" />
    {/* Headband */}
    <path d="M32 34 C40 30 60 30 68 34" stroke="#075448" strokeWidth="4" strokeLinecap="round" fill="none" />
    {/* Neck & Shoulders */}
    <path d="M43 62 V72 H57 V62" fill="#fed7aa" />
    <path d="M26 94 C26 78 40 74 50 74 C60 74 74 78 74 94 Z" fill="#0f766e" />
    {/* Face */}
    <path d="M36 36 C36 30 42 26 50 26 C58 26 64 30 64 36 V54 C64 62 58 66 50 66 C42 66 36 62 36 54 Z" fill="#fed7aa" />
    {/* Eyes & Lashes */}
    <circle cx="43" cy="46" r="2" fill="#171a17" />
    <circle cx="57" cy="46" r="2" fill="#171a17" />
    <path d="M41 43 L40 41" stroke="#171a17" strokeWidth="1.5" />
    <path d="M59 43 L60 41" stroke="#171a17" strokeWidth="1.5" />
    {/* Confident Smile */}
    <path d="M46 56 Q50 60 55 55" stroke="#171a17" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

/**
 * Editorial Handcrafted Scene Illustration (inspired by unDraw & Open Peeps)
 * "From Uncertainty to Verified Grounding"
 */
export const SceneVerificationArt: React.FC<{ className?: string }> = ({ className = 'w-full h-auto' }) => (
  <svg viewBox="0 0 680 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="deskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#e5e7dc" />
        <stop offset="50%" stopColor="#dce1d5" />
        <stop offset="100%" stopColor="#cbd3c2" />
      </linearGradient>
      <linearGradient id="hologramBeam" x1="50%" y1="100%" x2="50%" y2="0%">
        <stop offset="0%" stopColor="#d9f078" stopOpacity="0.35" />
        <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#075448" stopOpacity="0" />
      </linearGradient>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="8" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Ambient Glow in Background */}
    <circle cx="340" cy="180" r="140" fill="#d9f078" opacity="0.12" filter="url(#softGlow)" />

    {/* Modern Curved Office Desk */}
    <path d="M80 340 C200 325 480 325 600 340 L630 380 H50 Z" fill="url(#deskGrad)" />
    <line x1="120" y1="340" x2="120" y2="390" stroke="#b2bfa6" strokeWidth="6" strokeLinecap="round" />
    <line x1="560" y1="340" x2="560" y2="390" stroke="#b2bfa6" strokeWidth="6" strokeLinecap="round" />

    {/* Central Knowledge Hologram Projector */}
    <ellipse cx="340" cy="330" rx="60" ry="14" fill="#075448" stroke="#d9f078" strokeWidth="2.5" />
    <ellipse cx="340" cy="330" rx="30" ry="7" fill="#d9f078" />

    {/* Holographic Projection Beam */}
    <polygon points="310,330 370,330 460,110 220,110" fill="url(#hologramBeam)" />

    {/* Floating Verified Document Card */}
    <g transform="translate(230, 90)">
      <rect x="0" y="0" width="220" height="150" rx="14" fill="#fffef9" stroke="#075448" strokeWidth="2.5" filter="drop-shadow(0 14px 20px rgba(7, 84, 72, 0.15))" />
      {/* Header bar */}
      <rect x="14" y="16" width="90" height="12" rx="6" fill="#075448" />
      <circle cx="196" cy="22" r="6" fill="#8bbd47" />
      {/* Content lines */}
      <rect x="14" y="40" width="160" height="6" rx="3" fill="#cbd5e1" />
      <rect x="14" y="54" width="180" height="6" rx="3" fill="#cbd5e1" />
      <rect x="14" y="68" width="140" height="6" rx="3" fill="#cbd5e1" />
      {/* Exact Golden Citation Box */}
      <rect x="14" y="86" width="192" height="46" rx="8" fill="#f7fee7" stroke="#d9f078" strokeWidth="1.5" />
      <circle cx="32" cy="109" r="9" fill="#d9f078" />
      <path d="M29 109 L32 112 L36 106" stroke="#075448" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="50" y="106" fill="#075448" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
        CITATION [1] VERIFIED
      </text>
      <text x="50" y="121" fill="#4b5563" fontSize="9" fontFamily="monospace">
        Travel SOP · Page 1 · Sec 1
      </text>
    </g>

    {/* Left Peep (Analyzing with Tablet) */}
    <g transform="translate(110, 170)">
      {/* Body */}
      <path d="M40 170 C40 120 70 110 90 110 C110 110 140 120 140 170 Z" fill="#075448" />
      {/* Arm holding tablet */}
      <path d="M120 135 L145 155" stroke="#fcd34d" strokeWidth="10" strokeLinecap="round" />
      <rect x="135" y="130" width="36" height="48" rx="5" fill="#171a17" stroke="#d9f078" strokeWidth="1.5" transform="rotate(-15 135 130)" />
      {/* Head & Face */}
      <circle cx="90" cy="74" r="26" fill="#fcd34d" />
      <path d="M66 68 C66 45 80 40 95 40 C110 40 116 52 114 68 Z" fill="#1c1917" />
      {/* Glasses & Smile */}
      <circle cx="86" cy="76" r="5" stroke="#171a17" strokeWidth="1.5" fill="#ffffff" fillOpacity="0.5" />
      <circle cx="98" cy="76" r="5" stroke="#171a17" strokeWidth="1.5" fill="#ffffff" fillOpacity="0.5" />
      <line x1="91" y1="76" x2="93" y2="76" stroke="#171a17" strokeWidth="1.5" />
      <path d="M88 88 Q93 92 98 88" stroke="#171a17" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </g>

    {/* Right Peep (Pointing & Delighted) */}
    <g transform="translate(450, 160)">
      {/* Body */}
      <path d="M30 180 C30 130 60 120 80 120 C100 120 130 130 130 180 Z" fill="#f97316" />
      {/* Extended pointing arm */}
      <path d="M45 140 L-10 115" stroke="#fed7aa" strokeWidth="11" strokeLinecap="round" />
      {/* Head & Hair */}
      <circle cx="80" cy="80" r="26" fill="#fed7aa" />
      {/* Curly hair */}
      <circle cx="60" cy="70" r="12" fill="#451a03" />
      <circle cx="70" cy="56" r="14" fill="#451a03" />
      <circle cx="88" cy="56" r="14" fill="#451a03" />
      <circle cx="102" cy="70" r="12" fill="#451a03" />
      {/* Eye & Big Smile */}
      <circle cx="72" cy="80" r="2.5" fill="#171a17" />
      <path d="M68 92 Q76 100 84 92" stroke="#171a17" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Aha / Sparkle Indicator */}
      <path d="M40 40 L44 48 L52 52 L44 56 L40 64 L36 56 L28 52 L36 48 Z" fill="#d9f078" />
    </g>
  </svg>
);
