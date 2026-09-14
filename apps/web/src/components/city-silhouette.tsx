export function CitySilhouette() {
  return (
    <div className="city-art" aria-hidden="true">
      <div className="city-orbit city-orbit-one" />
      <div className="city-orbit city-orbit-two" />
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
          d="M89 463h522v45H89zM129 322h72v141h-72zM144 292h42v30h-42zM153 266h24v26h-24zM231 355h84v108h-84zM249 329h48v26h-48zM339 238h94v225h-94zM358 185h56v53h-56zM377 137h18v48h-18zM457 299h89v164h-89zM475 264h53v35h-53zM566 367h31v96h-31z"
          fill="url(#cityInk)"
        />
        <path
          d="M158 346h14v18h-14zM158 380h14v18h-14zM258 378h13v18h-13zM282 378h13v18h-13zM367 270h15v22h-15zM397 270h15v22h-15zM367 313h15v22h-15zM397 313h15v22h-15zM367 356h15v22h-15zM397 356h15v22h-15zM485 328h13v20h-13zM510 328h13v20h-13zM485 369h13v20h-13zM510 369h13v20h-13z"
          fill="url(#cityGlow)"
        />
        <path
          d="M75 463h560M105 508h500"
          fill="none"
          stroke="#53eab1"
          strokeLinecap="round"
          strokeOpacity="0.4"
          strokeWidth="2"
        />
        <circle cx="386" cy="155" r="5" fill="#69f4be" />
        <circle cx="386" cy="155" r="15" fill="#37dca3" opacity="0.17" />
      </svg>
      <div className="city-caption">
        <span />
        <p>Yeni bir şehir yükseliyor</p>
      </div>
    </div>
  );
}
