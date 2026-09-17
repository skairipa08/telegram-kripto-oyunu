## 2026-09-17T13:51:46Z

You are the Project Orchestrator (teamwork_preview_orchestrator) for Project Empire Telegram Mini App comprehensive testing and quality verification.

## Identity and Workspaces
- Your Working Directory: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_12`
- Project Workspace Root: `c:\Users\Administrator\Desktop\telegram kripto oyunu`
- Parent Sentinel Conversation ID: `6ad025e8-b120-45df-98e0-5e708297153e`
- Path to User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (see timestamp section `## 2026-09-17T10:50:36Z`)

## Mission
Execute comprehensive testing and quality verification via teamwork_preview multi-agent system across 2 isolated streams (maximum 2 concurrent agents):
- Stream 1: Core Math & Game Engine Unit Tests
- Stream 2: Full Integration, API Endpoints, Zod Schema Validation & Monorepo Health Gate

## Stream Boundary & Concurrency Constraints (MAX 2 CONCURRENT AGENTS)
Token israfını önlemek ve sorumlulukları net ayrıştırmak amacıyla çalışma 2 kesin çalışma alanına bölünmüştür:

1. **Stream 1 - Çekirdek Matematik Modelleri ve Mini Oyun Birim Testleri**:
   - Scope: `packages/game-core/`, `apps/web/src/game/crypto-mines-model.ts`, `apps/web/src/game/crypto-predictions-model.ts`
   - Sorumluluk:
     - Mayın Tarlası (Mines) Olasılık & Çarpan Testi: (1 - edge) * \prod (25 - i)/(25 - m - i) formülünün matematiksel doğruluğu, 1-20 mayın limitleri, kasa avantajı kuralı, geçerli kâr alma ve patlama senaryoları. Fisher-Yates tekrarsız ızgara (25) sınırları, ilk hamle adil çarpanları ve kural sınırları.
     - Tahmin Piyasası (Predictions) Model Testi: EVET/HAYIR oran hesaplamaları, kupon kazanç çarpanları, bakiye düşümü ve kâr tahsilatı limit testleri.
     - Çöküş (Crash) & Adaptif Kasa Algoritması Testi: Düşük ve yüksek bahislerdeki dinamik risk çarpanı, ani bahis artışı cezalandırma ve patlama noktası doğrulama testleri.
     - Binde 1 (%0.1) Ciro ve Kademeli Komisyon Hesaplama: 1M ciroda 1.000 nakit ve %3, %5, %7 komisyon basamaklarının kesin sayısal testleri.
     - Günlük giriş serisi (7g, 30g, 90g, 180g, 365g) bonuslarının sınır ve hesaplama testleri.

2. **Stream 2 - API Uç Noktaları, Zod Şema Doğrulaması & Monorepo Sağlık Kapısı**:
   - Scope: `apps/api/`, `apps/web/`, `packages/shared/`
   - Sorumluluk:
     - Görevler (Missions) & Streak API Doğrulaması: `getActiveMissions` ve `getStreak` uç noktalarının Zod şemalarına (`PlayerMissionInstance`, `PlayerStreakDto`) %100 uyumluluğu, görev ödülü talep (`claim`) akışları (`id` UUID kontrolü, `difficulty`, `key`, `assignedDate` varlığı).
     - API `/api/missions`, `/api/streak`, `/api/referral/status` ve `/api/economy/roi` rotalarının geçerli ve beklenen tipte veri döndürdüğünün doğrulanması.
     - Referral & Ortaklık Primi Entegrasyonu: Davet linki üretimi, bakiye güncelleme ve kickback claim akışlarının API seviyesinde doğrulanması.
     - Monorepo Kalite Kapısı: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` komutlarının hatasız ve 0 uyarı ile tamamlanması.

## Acceptance Criteria
- [ ] Kripto Mayın Tarlası matematik modeli birim testleri %100 başarıyla tamamlanır.
- [ ] Tahmin Piyasası bahis hesaplama ve bakiye doğrulama testleri hatasız geçer.
- [ ] Binde 1 ciro primi ve kademeli komisyon hesaplamaları test senaryolarında beklenen değerleri verir.
- [ ] Görevler (`/api/missions`) ve Seri (`/api/streak`) endpoint'leri Zod şemalarından 0 validasyon hatasıyla geçer.
- [ ] Mini oyunlar ile web arayüzü arasındaki bakiye güncelleme akışı doğrulanır.
- [ ] `pnpm typecheck` tüm paketlerde 0 hata verir.
- [ ] `pnpm test` (vitest) tüm test paketlerini başarıyla geçer.
- [ ] `HANDOFF.md` güncellenerek test sonuçları ve kanıtları raporlanır.

## Operational Rules
- Maintain `progress.md` and `BRIEFING.md` in your working directory.
- Dispatch exploratory and worker subagents according to the 2-stream domain isolation with maximum 2 concurrent subagents.
- Ensure all quality gates pass without skipping or suppressing tests.
- When all requirements are met and verified, write your final handoff and send a completion message to parent sentinel.
