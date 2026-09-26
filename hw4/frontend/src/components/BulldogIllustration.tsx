// Fallback chat avatar (used if the photo is missing): an illustration of Handsome Dan, Yale's bulldog, drawn from a
// reference photo (not the photo itself): white English bulldog with dark brown folded ears,
// amber eyes, a black nose, pink jowls, an underbite, a navy knit sweater, and a navy
// bow tie with a white "Y" pattern.
export default function BulldogIllustration({ size = 36 }: { size?: number }) {
  const ink = '#1c1917'
  const navy = '#1b2a4a'
  return (
    <svg
      className="bulldog-avatar"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Handsome Dan, Yale's bulldog"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="dan-circle">
          <circle cx="32" cy="32" r="30.5" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#cfd4da" />
      <g clipPath="url(#dan-circle)">
        {/* navy knit sweater */}
        <path d="M6 64 C7 53 17 48 32 48 C47 48 57 53 58 64 Z" fill={navy} />
        <path d="M14 55 V64 M20 52 V64 M26 50.5 V64 M38 50.5 V64 M44 52 V64 M50 55 V64" stroke="#2c3e63" strokeWidth="1.4" />
        {/* dark brown folded ears */}
        <path d="M13.5 16 C8 15 6 22 8.5 27 C10 24 12.5 21.5 16.5 20.5 Z" fill="#4a3426" />
        <path d="M50.5 16 C56 15 58 22 55.5 27 C54 24 51.5 21.5 47.5 20.5 Z" fill="#4a3426" />
        {/* white head, wide jaw */}
        <path
          d="M14 22 C15 13.5 23 10 32 10 C41 10 49 13.5 50 22 C54 29 54 39 49 45 C44 51 38 52.5 32 52.5 C26 52.5 20 51 15 45 C10 39 10 29 14 22 Z"
          fill="#f7f4ef"
        />
        {/* forehead wrinkles */}
        <path d="M25.5 17 Q32 14.5 38.5 17" stroke="#d6cfc4" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M27.5 20.2 Q32 18.6 36.5 20.2" stroke="#d6cfc4" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* amber eyes */}
        <circle cx="22.5" cy="25.5" r="2.9" fill="#b7791f" />
        <circle cx="41.5" cy="25.5" r="2.9" fill="#b7791f" />
        <circle cx="22.5" cy="25.5" r="1.5" fill={ink} />
        <circle cx="41.5" cy="25.5" r="1.5" fill={ink} />
        <circle cx="23.3" cy="24.7" r="0.7" fill="#ffffff" />
        <circle cx="42.3" cy="24.7" r="0.7" fill="#ffffff" />
        {/* dark muzzle patch and big black nose */}
        <path d="M26 29 C27 27 37 27 38 29 L36.5 36 L27.5 36 Z" fill="#3f3a36" opacity="0.55" />
        <ellipse cx="32" cy="30.5" rx="5.6" ry="3.6" fill={ink} />
        <ellipse cx="30.2" cy="29.6" rx="1.4" ry="0.8" fill="#57534e" />
        {/* pink jowls */}
        <path d="M17.5 36 C18 31.5 25 31 28 34.5 C27 39.5 22 42 18.5 41 Z" fill="#f2b6b0" opacity="0.85" />
        <path d="M46.5 36 C46 31.5 39 31 36 34.5 C37 39.5 42 42 45.5 41 Z" fill="#f2b6b0" opacity="0.85" />
        {/* drooping jowls (flews) framing the mouth */}
        <path d="M25.5 33.5 Q20 40 25.5 45.8" stroke="#78716c" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d="M38.5 33.5 Q44 40 38.5 45.8" stroke="#78716c" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* open mouth: underbite with the lower teeth pointing up from the jaw */}
        <path d="M26 37.8 Q32 35.8 38 37.8 Q37 44.2 32 44.8 Q27 44.2 26 37.8 Z" fill="#7f1d1d" />
        <path d="M28.5 42.3 Q32 40.8 35.5 42.3 Q34 44.4 32 44.5 Q30 44.4 28.5 42.3 Z" fill="#f4a7a7" />
        <path d="M26.9 41.6 L27.9 39.2 L28.9 41.6 Z M35.1 41.6 L36.1 39.2 L37.1 41.6 Z" fill="#ffffff" />
        <path d="M29.6 41.2 L30.4 39.6 L31.2 41.2 Z M32.8 41.2 L33.6 39.6 L34.4 41.2 Z" fill="#ffffff" />
        {/* lower lip */}
        <path d="M25.5 45.5 Q32 48.2 38.5 45.5" stroke="#292524" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* navy bow tie with white Y pattern */}
        <path d="M32 50.5 L21 45.5 L21.5 56 Z" fill="#23386b" />
        <path d="M32 50.5 L43 45.5 L42.5 56 Z" fill="#23386b" />
        <rect x="29.6" y="48" width="4.8" height="5" rx="1.2" fill="#1a2c55" />
        <g stroke="#ffffff" strokeWidth="0.7" strokeLinecap="round" fill="none">
          <path d="M24 48.6 l0.9 1 l0.9 -1 M24.9 49.6 v1.1" />
          <path d="M24.3 52.6 l0.9 1 l0.9 -1 M25.2 53.6 v1.1" />
          <path d="M38.2 48.6 l0.9 1 l0.9 -1 M39.1 49.6 v1.1" />
          <path d="M37.9 52.6 l0.9 1 l0.9 -1 M38.8 53.6 v1.1" />
        </g>
      </g>
      <circle cx="32" cy="32" r="31" fill="none" stroke="#ffffff" strokeWidth="2" />
    </svg>
  )
}
