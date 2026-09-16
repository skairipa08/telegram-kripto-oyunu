## 2026-09-16T06:02:50Z
You are teamwork_preview_explorer_stream1.
Your working directory is c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream1.
The project root is c:\Users\Administrator\Desktop\telegram kripto oyunu.
Read ORIGINAL_REQUEST.md at c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md.
Read PROJECT.md at c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md.

YOUR STRICT ISOLATION SCOPE:
- apps/api/src/shop/
- packages/shared/src/
You may also read apps/api/src/index.ts and apps/api/src/auth/test-db.ts to understand route mounting and database test harness structure.
Do NOT modify any files. You are an Explorer.

Investigate:
1. What files currently exist in apps/api/src/shop/ (routes, store, test files).
2. What DTOs and schemas exist in packages/shared/src/ for shop, invoices, payments, entitlements, webhooks.
3. Detail the specifications for Requirement R1:
   - Invoice generation endpoint (POST /shop/invoice): parameters, XTR currency, title/description, Stars invoice link / payload generation.
   - Webhook verification & handler (POST /shop/webhook or updates):
     - X-Telegram-Bot-Api-Secret-Token validation.
     - pre_checkout_query: payload validation, currency XTR check, invoice existence, answerPreCheckoutQuery ok: true.
     - successful_payment: atomic invoice marking, entitlement crediting (Empire Pass, badges), ledger recording, replay-safety via telegram_payment_charge_id.
     - Status lookup endpoint (GET /shop/invoices/:id).
4. Outline exact changes needed, function signatures, DTOs, and test cases.
Write your complete findings to c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream1\report.md.
When finished, send a concise summary message back to parent.
