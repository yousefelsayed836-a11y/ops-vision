# استرجاع وتشغيل السيرفر المحلي — 20 أكتوبر 2026

النتيجة: قاعدة OpsVision القديمة ذات 15 حسابًا و7 مغاسل و9 جلسات غسيل فُتحت بعد إصلاح نسخة منها. ملفات `.data/pglite-development` الأصلية لم تُعدَّل. نسخة التشغيل هي `.data/pglite-original-repair-20261020`، وفيها الآن 17 حسابًا بعد إعادة حسابَي مغسلة التجربة بنفس كلمات المرور السابقة. النسخة الأخرى `.data/pglite-development-restored` كانت تحتوي 3 حسابات ومغسلة واحدة فقط، لذلك لم تُستخدم.

طريقة الإصلاح التي نجحت:

1. إيقاف أي عمليات PGlite/Next تستخدم المنفذين 51214 و3000.
2. نسخ مجلد `.data/pglite-development` إلى `.data/pglite-original-repair-20261020`، مع إبقاء الأصل محفوظًا.
3. حذف `postmaster.pid` من **النسخة فقط**. فحص `pg_resetwal --dry-run` على النسخة ثم تشغيل PostgreSQL 18.1 `pg_resetwal -f -D <copy>`. هذه أداة استرجاع أخيرة، وليست إجراء تشغيل يومي.
4. فحص النسخة بـ`node scripts/inspect-local-db.mjs <copy>`؛ أعادت 15 حسابًا و7 مغاسل.
5. تشغيل PGlite على 127.0.0.1:51214 باستعمال `OPSVISION_DB_DIR=.data\pglite-original-repair-20261020`، ثم Next على 127.0.0.1:3000. `START_OPSVISION.cmd` محدث ليستخدم هذا المسار.
6. استعادة حسابَي مغسلة التجربة من ملف بياناتهما الخاص؛ لم تتغير كلمات المرور. الصفحة `http://localhost:3000/ar/login` أعادت 200، وثلاثة حسابات التجربة الأصلية وحساب المالك الجديد سجّلوا الدخول بنجاح.

نسخة منطقية بعد الاسترجاع: `.data/opsvision-recovered-20261020.dump`، وفحص `pg_restore -l` عرض 36 جدول بيانات. احتفظ بالنسخة الأصلية والمسترجعة والنسخة المنطقية. لا تكرر `pg_resetwal` على المصدر الأصلي. لم يُتحقق من سلامة كل سجل تاريخي؛ قارن السجلات المهمة قبل استخدام البيانات في إنتاج فعلي.

20 October restart: The prior repaired PGlite directory had an unclean shutdown and could not open. A copy was made at .data/pglite-live-restart-reset-20261020 excluding postmaster.pid, then pg_resetwal --dry-run and -f were run on that copy only. Inspection found 17 users and 8 organizations. START_OPSVISION.cmd now points to this copy. The server and database started together; /ar/login returned HTTP 200 and three demo sign-ins returned 200. Keep the original, prior repair, and SQL dumps for recovery.
