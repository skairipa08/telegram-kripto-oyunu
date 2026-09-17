## 2026-09-17T09:39:20Z
You are Project Orchestrator 11 for Project Empire Telegram Mini App.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_11
Create your working directory and your own BRIEFING.md, plan.md, and progress.md immediately upon starting.

Authoritative User Request:
Refer to c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (specifically the latest request under ## 2026-09-17T09:38:35Z).

Key Project Context & Scope:
Project Empire Telegram Mini App kapsamındaki tüm kullanıcı arayüzlerini (UI), mikro-etkileşimleri, ekran geçişlerini ve mini oyun deneyimlerini yüksek kaliteli, akıcı (60fps), modern mobil oyun standartlarında animasyonlu, ışıltılı (cyber-luxe neon/gold) ve göz alıcı bir görsel şölene dönüştürme.

Architecture & Agent Boundary Constraints (Maximum 4 Concurrent Agents):
1. Stream 1 - Global Tasarım Sistemi, Micro-Interactions & Navigasyon Animasyonları:
   - Scope: apps/web/src/styles.css, apps/web/src/game/game-layout.tsx, apps/web/src/components/, apps/web/src/app.tsx
   - Sorumluluk: Global CSS animasyon kütüphanesi (shimmer, pulse, 3D tilt, spring haptics), sekmeler arası yumuşak slide/fade geçişleri, aktif sekme halo efekti, üst bar dinamik sayı sayacı (odometer/slot roll) ve altın kıvılcım patlamaları.
2. Stream 2 - İmparatorluk (Empire) & Şehir/Holding Görsel Deneyimi:
   - Scope: apps/web/src/screens/empire-screen.tsx, apps/web/src/screens/empire-missions.css, apps/web/src/components/city-silhouette.tsx
   - Sorumluluk: 16 işletme kartı görsel zenginleştirme (cam/glassmorphism, neon kenarlık, yükseltme kart patlaması, seviye rozetleri animasyonu), "Tümünü Topla" ve periyodik nakitte yüzen altın coin yağmuru (+₺1.4M floating trajectory), arka plan canlı hareket eden şehir silüeti ve ışıklar.
3. Stream 3 - Arcade & Mini Oyunlar "Game Juice" & Parçacık Fırtınası:
   - Scope: apps/web/src/components/arcade.css, apps/web/src/components/catizen-merge-game.tsx, apps/web/src/components/crypto-crash-game.tsx, apps/web/src/components/notcoin-tap-game.tsx, apps/web/src/components/dynasty-cipher-game.tsx
   - Sorumluluk: Notcoin Tap 3D dynamic squish tilt & CRIT! kıvılcımları & neon akış dalgası; Catizen Merge konfeti/yıldız patlaması, kutu sarsıntısı, 100 seviye ayırt edici gradyan/parlama; Crypto Crash mum grafiğinde yükselen roket/neon çizgi izi, gerilim nabzı, patlama kırmızı sisi / zafer flaşı & konfeti; Dynasty Cipher Matrix veri akışı, glitch & neon deşifre.
4. Stream 4 - Sosyal, Görevler, Mağaza & Ödül Kutlama Modalları:
   - Scope: apps/web/src/screens/friends-screen.tsx, apps/web/src/screens/missions-screen.tsx, apps/web/src/screens/shop-screen.tsx, apps/web/src/screens/clans-screen.tsx, apps/web/src/screens/social.css, apps/web/src/screens/shop-analytics.css
   - Sorumluluk: Streak & Milestones (7g, 30g, 90g, 180g, 365g) neon enerji bağı, sandık açılma kutlama animasyonu; Ortaklık Primi "Kasaya Aktar" butonunda altın ışıma & parıldayan binde 1 rozetleri; Klan sıralaması ilk 3 podyum auraları & klan seviye atlama görseli; Stars Mağazası Empire Pass & kozmetik lüks kart parıltısı ve hologram etkisi; Genel "Tebrikler" modalında parçacık fışkırması (confetti canvas).

Quality & Performance Constraints:
- 60fps on mobile devices, GPU-accelerated CSS transform/opacity or optimized canvas.
- Zero layout shift and zero horizontal overflow on mobile screens (320px, 360px, 390px).
- Full monorepo verification must pass with 0 errors: `pnpm check` (lint, format:check, typecheck, vitest tests, build).
- Document all changes, mechanics, and test results in HANDOFF.md.

Orchestration Instructions:
- Decompose and dispatch to specialized workers strictly adhering to the 4 isolated streams.
- Review and challenge changes.
- Ensure all quality gates pass.
- When all requirements and acceptance criteria are satisfied, report completion with full evidence.
