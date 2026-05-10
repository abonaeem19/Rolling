# 🎯 Rolling Draw — نظام السحب الإلكتروني

نظام **QR Registration + Admin Panel + Public Roulette Draw** للفعالية، مبني وفقًا للمواصفات المعتمدة بالكامل.

---

## 📦 المكدس التقني

| العنصر | التقنية |
|---|---|
| Backend | Node.js (≥18) + Express |
| Database | SQLite (better-sqlite3) — ملف واحد، بدون إعدادات |
| Auth | express-session + bcryptjs (httpOnly cookie) |
| Security | Helmet + Rate Limit + Prepared Statements |
| QR | qrcode (PNG screen + print-ready) |
| Export | xlsx + CSV (UTF-8 BOM للعربية) |
| Frontend | HTML/CSS/JS صرف، RTL، خط Tajawal |

---

## 🚀 التشغيل المحلي

### 1. تثبيت الاعتماديات

```bash
cd Rolling
npm install
```

### 2. ضبط متغيرات البيئة (اختياري)

ملف `.env` موجود بقيم افتراضية. **غيّرها قبل النشر**:

```env
PORT=3000
PUBLIC_URL=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
SESSION_SECRET=long-random-string-here
REGISTER_RATE_LIMIT=10
```

### 3. تشغيل السيرفر

```bash
npm start
```

ستظهر:

```
==============================================
  Rolling Draw server is running
  Local:    http://localhost:3000
  Register: http://localhost:3000/register
  Admin:    http://localhost:3000/admin/login
  Roulette: http://localhost:3000/roulette
==============================================
```

### 4. توليد QR Code للطباعة

```bash
npm run generate-qr
```

يُنشئ ملفين في `public/qr/`:
- `register-qr.png` — للشاشة (600px)
- `register-qr-print.png` — للطباعة (1200px)

> 💡 يمكن أيضًا تحميل QR من داخل لوحة الإدارة → بطاقة "QR Code" → "تحميل QR" → "تنزيل QR Code".

---

## 🌐 الصفحات

| المسار | الوصف | الوصول |
|---|---|---|
| `/register` | صفحة تسجيل المشاركين | عام (يفتح من QR) |
| `/admin/login` | تسجيل دخول الإدارة | عام |
| `/admin` | لوحة الإدارة | محمي بجلسة |
| `/roulette` | صفحة العرض والسحب | عام (تُعرض على البروجكتر) |

**بيانات دخول الإدارة الافتراضية:** `admin` / `admin123` — **غيّرها فورًا في `.env`**.

---

## 🔌 واجهات API

### المشاركون

```
POST   /api/participants                     [public, rate-limited] تسجيل
GET    /api/participants?search=&filter=     [admin] قائمة + بحث/فلترة
GET    /api/participants/count               [admin] إحصاءات
GET    /api/participants/non-winners         [public] للروليت
GET    /api/participants/export?format=csv|xlsx  [admin] تصدير
PUT    /api/participants/:id                 [admin] تعديل
DELETE /api/participants/:id                 [admin] حذف (Cascade)
```

### الفائزون والسحب

```
GET    /api/winners            [public] سجل الفائزين
POST   /api/draw               [public, rate-limited] السحب من السيرفر
DELETE /api/winners/:id        [admin] حذف فائز + إعادته للقائمة
```

### الإدارة

```
POST   /api/admin/login        تسجيل الدخول
POST   /api/admin/logout       تسجيل الخروج
GET    /api/admin/me           جلسة حالية
GET    /api/admin/qr           بيانات QR
```

---

## 🛡️ الالتزامات الإدارية الملزمة (من المواصفات)

| الالتزام | كيف نُلبّيه |
|---|---|
| منع التكرار من قاعدة البيانات وليس الواجهة | `UNIQUE` على `full_name`, `email`, `employee_number` + `COLLATE NOCASE` + `UNIQUE` constraint مع رد `409` |
| السحب من السيرفر وليس الواجهة | `POST /api/draw` يستخدم `crypto.randomBytes` داخل **Transaction** يمنع السباق |
| منع تكرار الفائز | `UPDATE ... WHERE is_winner = 0` ضمن نفس Transaction + `UNIQUE` على `winners.participant_id` |
| لوحة الإدارة محمية | `requireAdminPage` على HTML + `requireAdminAPI` على كل المسارات الإدارية + bcrypt + login rate limit |
| QR جاهز للطباعة | `npm run generate-qr` ينتج PNG بدقة 1200px |

---

## 🧪 الاختبارات اليدوية المطلوبة (من المواصفات)

| # | الاختبار | المتوقع |
|---|---|---|
| 1 | تسجيل مشارك جديد | "تم تسجيلك بنجاح..." |
| 2 | إعادة نفس الاسم | "تم تسجيلك مسبقًا..." (`409`) |
| 3 | إعادة نفس البريد | "تم تسجيلك مسبقًا..." (`409`) |
| 4 | إعادة نفس الرقم الوظيفي | "تم تسجيلك مسبقًا..." (`409`) |
| 5 | تعديل بدون تكرار | "تم تحديث بيانات المشارك..." |
| 6 | تعديل لقيم مكررة | "لا يمكن حفظ التعديلات..." (`409`) |
| 7 | حذف مشارك | يختفي من القائمة |
| 8 | عرض المشاركين | جدول مع عداد |
| 9 | بحث وفلترة | نتائج صحيحة |
| 10 | تصدير CSV/Excel | تنزيل ملف بالعربية صحيحة |
| 11 | سحب ناجح | اسم الفائز يظهر، يُسجل في `winners` |
| 12 | الفائز لا يدخل السحب مجددًا | `is_winner = 1` يُستثنى من القائمة |
| 13 | السحب حتى انتهاء الجميع | "تم سحب جميع المشاركين المتاحين." |
| 14 | تجربة الجوال | الصفحة متجاوبة، الخطوط لا تتحول |
| 15 | الروليت على شاشة كبيرة | عرض ممتلئ، اسم الفائز كبير |

---

## 🗂️ هيكل المشروع

```
Rolling/
├── server.js                 # السيرفر الرئيسي
├── package.json
├── .env / .env.example
├── README.md
│
├── database/
│   ├── schema.sql            # جداول + قيود + Triggers
│   └── db.js                 # اتصال + إعدادات
│
├── routes/
│   ├── participants.js       # CRUD المشاركين
│   ├── winners.js            # السحب + سجل الفائزين
│   └── admin.js              # دخول/خروج + QR
│
├── middleware/
│   ├── auth.js               # حماية المسارات
│   └── rateLimit.js          # حدود معدل
│
├── utils/
│   └── validation.js         # تحقق وتنظيف المدخلات
│
├── scripts/
│   └── generate-qr.js        # توليد QR للطباعة
│
└── public/
    ├── register.html
    ├── login.html
    ├── admin.html
    ├── roulette.html
    ├── qr/                   # ينتج بعد npm run generate-qr
    └── static/
        ├── css/
        │   ├── register.css
        │   ├── login.css
        │   ├── admin.css
        │   └── roulette.css
        └── js/
            ├── register.js
            ├── login.js
            ├── admin.js
            └── roulette.js
```

> ملف قاعدة البيانات يُنشأ تلقائيًا في `data/rolling.db` عند أول تشغيل.

---

## 🔐 ملاحظات الأمان

- جلسات httpOnly + `sameSite=lax` + `secure` في الإنتاج
- bcrypt على كلمة مرور الإدارة (Hash بـ 10 جولات)
- Helmet + CSP صارمة
- Prepared statements في كل الاستعلامات (لا SQL Injection)
- Rate limit على `/register` (افتراضي 10/دقيقة) و`/admin/login` (10/15 دقيقة)
- لا تُكشف أخطاء السيرفر للمستخدم النهائي (رسائل عامة فقط)
- جميع المدخلات تُنظَّف وتُتحقق في السيرفر قبل أي عملية على القاعدة

---

## 🚢 خطوات النشر

1. غيّر `SESSION_SECRET` و`ADMIN_PASSWORD` في `.env`
2. اضبط `PUBLIC_URL` لدومينك الفعلي
3. اضبط `NODE_ENV=production`
4. شغّل خلف Reverse Proxy (Nginx) مع HTTPS
5. شغّل `npm run generate-qr` بعد ضبط `PUBLIC_URL`
6. اطبع `register-qr-print.png`

---

© نظام السحب الإلكتروني للفعالية
