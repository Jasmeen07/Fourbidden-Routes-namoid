import React from 'react';

export const SpiderWebDecor: React.FC = () => {
  return (
    <div className="spider-web-decor" aria-hidden="true">
      <svg
        width="220"
        height="190"
        viewBox="0 0 220 190"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="spider-web-svg"
      >
        {/* Radial spoke lines emanating from top-right corner (220, 0) */}
        <g stroke="rgba(180, 140, 140, 0.35)" strokeWidth="0.85">
          <line x1="220" y1="0" x2="30" y2="45" />
          <line x1="220" y1="0" x2="60" y2="85" />
          <line x1="220" y1="0" x2="95" y2="125" />
          <line x1="220" y1="0" x2="140" y2="155" />
          <line x1="220" y1="0" x2="185" y2="175" />
          <line x1="220" y1="0" x2="220" y2="180" />
        </g>

        {/* Concentric curved web segments */}
        {/* Ring 1 - inner */}
        <path
          d="M 180,10 Q 175,18 178,28 Q 185,36 195,40 Q 205,43 218,44"
          stroke="rgba(180, 140, 140, 0.45)"
          strokeWidth="0.8"
          fill="none"
        />
        {/* Ring 2 */}
        <path
          d="M 145,18 Q 138,32 142,48 Q 152,62 168,70 Q 185,76 215,78"
          stroke="rgba(180, 140, 140, 0.45)"
          strokeWidth="0.85"
          fill="none"
        />
        {/* Ring 3 */}
        <path
          d="M 110,26 Q 102,46 108,68 Q 120,88 142,100 Q 165,110 210,114"
          stroke="rgba(180, 140, 140, 0.4)"
          strokeWidth="0.9"
          fill="none"
        />
        {/* Ring 4 */}
        <path
          d="M 72,36 Q 64,62 72,90 Q 88,116 116,132 Q 145,145 205,152"
          stroke="rgba(180, 140, 140, 0.35)"
          strokeWidth="0.95"
          fill="none"
        />
        {/* Ring 5 - outer */}
        <path
          d="M 35,46 Q 26,78 36,112 Q 55,144 88,164 Q 122,180 195,188"
          stroke="rgba(180, 140, 140, 0.3)"
          strokeWidth="1"
          fill="none"
        />

        {/* Hanging silk thread */}
        <line
          x1="188"
          y1="120"
          x2="188"
          y2="152"
          stroke="rgba(139, 21, 27, 0.65)"
          strokeWidth="0.8"
          strokeDasharray="2,2"
        />

        {/* Little Crimson Spider */}
        <g transform="translate(188, 156)">
          {/* Spider legs */}
          <g stroke="#7f1d1d" strokeWidth="0.75" strokeLinecap="round">
            {/* Left legs */}
            <path d="M 0,-1 Q -4,-5 -7,-3" />
            <path d="M 0,0 Q -6,-2 -9,1" />
            <path d="M 0,1 Q -6,3 -8,6" />
            <path d="M 0,2 Q -5,6 -6,9" />
            {/* Right legs */}
            <path d="M 0,-1 Q 4,-5 7,-3" />
            <path d="M 0,0 Q 6,-2 9,1" />
            <path d="M 0,1 Q 6,3 8,6" />
            <path d="M 0,2 Q 5,6 6,9" />
          </g>
          {/* Spider body (abdomen & cephalothorax) */}
          <ellipse cx="0" cy="1" rx="2.5" ry="3.2" fill="#881337" />
          <circle cx="0" cy="-2.5" r="1.6" fill="#9f1239" />
          {/* Tiny glowing crimson dot on back */}
          <circle cx="0" cy="1.2" r="0.75" fill="#f43f5e" />
        </g>
      </svg>
    </div>
  );
};
