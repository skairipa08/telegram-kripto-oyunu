import '../screens/empire-missions.css';

export function CitySilhouette() {
  return (
    <div className="city-art" aria-hidden="true">
      <div className="city-orbit city-orbit-one">
        <span className="city-orbit-node" />
      </div>
      <div className="city-orbit city-orbit-two">
        <span className="city-orbit-node" />
      </div>
      <svg viewBox="0 0 700 560" role="img">
        <defs>
          <linearGradient id="cityGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#52e7ae" stopOpacity="0.95" />
            <stop offset="1" stopColor="#087052" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="cityInk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#142d28" />
            <stop offset="1" stopColor="#06100e" />
          </linearGradient>
          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <path
          className="city-ground-glow"
          d="M75 472c92-69 177-100 275-100 111 0 205 37 284 111-96 33-188 49-276 49-100 0-194-20-283-60Z"
          fill="#1dd99a"
          filter="url(#softGlow)"
        />
        <path
          className="city-buildings-silhouette"
          d="M89 463h522v45H89zM129 322h72v141h-72zM144 292h42v30h-42zM153 266h24v26h-24zM231 355h84v108h-84zM249 329h48v26h-48zM339 238h94v225h-94zM358 185h56v53h-56zM377 137h18v48h-18zM457 299h89v164h-89zM475 264h53v35h-53zM566 367h31v96h-31z"
          fill="url(#cityInk)"
        />
        {/* Staggered twinkling window lights */}
        <path
          className="city-windows-twinkle-1"
          d="M158 346h14v18h-14zM258 378h13v18h-13zM367 270h15v22h-15zM485 328h13v20h-13zM367 356h15v22h-15z"
          fill="url(#cityGlow)"
        />
        <path
          className="city-windows-twinkle-2"
          d="M158 380h14v18h-14zM282 378h13v18h-13zM397 270h15v22h-15zM510 328h13v20h-13zM397 356h15v22h-15z"
          fill="url(#cityGlow)"
        />
        <path
          className="city-windows-twinkle-3"
          d="M367 313h15v22h-15zM397 313h15v22h-15zM485 369h13v20h-13zM510 369h13v20h-13z"
          fill="url(#cityGlow)"
        />
        <path
          className="city-ground-grid"
          d="M75 463h560M105 508h500"
          fill="none"
          stroke="#53eab1"
          strokeLinecap="round"
          strokeOpacity="0.4"
          strokeWidth="2"
        />
        {/* Left antenna red beacon */}
        <circle
          className="city-tower-beacon-sec"
          cx="165"
          cy="266"
          r="3.5"
          fill="#ff708f"
        />
        {/* Main central tower radio beacons at 60fps GPU acceleration */}
        <circle
          className="city-tower-pulse"
          cx="386"
          cy="155"
          r="16"
          fill="#37dca3"
        />
        <circle
          className="city-tower-beacon"
          cx="386"
          cy="155"
          r="5"
          fill="#69f4be"
        />
        <circle
          className="city-tower-core"
          cx="386"
          cy="155"
          r="2.5"
          fill="#ffffff"
        />
      </svg>
      <div className="city-caption">
        <span />
        <p>Yeni bir şehir yükseliyor</p>
      </div>
    </div>
  );
}
