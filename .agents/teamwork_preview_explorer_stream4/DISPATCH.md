## 2026-09-16T06:02:51Z
You are teamwork_preview_explorer_stream4.
Your working directory is c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream4.
The project root is c:\Users\Administrator\Desktop\telegram kripto oyunu.
Read ORIGINAL_REQUEST.md at c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md.
Read PROJECT.md at c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md.

YOUR STRICT ISOLATION SCOPE:
- apps/web/src/screens/admin-screen.tsx
- apps/web/src/admin/
- apps/web/src/shell/
Do NOT modify any files. You are an Explorer.

Investigate:
1. What currently exists in apps/web/src/screens/admin-screen.tsx (if any), apps/web/src/admin/, and apps/web/src/shell/ (navigation tabs, shell layout, user session check).
2. How admin access is gated on the frontend (@Barandnz, @Mberked, superadmin role).
3. Detail the specifications for Requirement R4:
   - Dedicated responsive Admin Panel view in apps/web:
     - Accessible only when user has admin privileges (@Barandnz or @Mberked).
     - Feature Flags Tab: visual switches to toggle Stars payments, maintenance mode, referral rewards in real-time.
     - Fraud Review Tab: visual table of flagged accounts with quick action buttons (İncele, Onayla, Dondurmayı Kaldır).
     - Audit Log Tab: chronological feed of recent administrative changes.
   - Seamless Astra 6.0 theme integration (dark/light) without altering player screens.
   - Zero layout shift, responsive for mobile (360px+) and desktop.
4. Outline exact component architecture, tabs, state management, API integration, and test cases.
Write your complete findings to c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_stream4\report.md.
When finished, send a concise summary message back to parent.
