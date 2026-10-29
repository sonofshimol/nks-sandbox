# ארגז חול לאוטומטים תאיים

ארגז חול לחקירת אוטומטים תאיים ותוכניות פשוטות, בהשראת "סוג חדש של מדע" (A New Kind of Science) של סטיבן וולפרם.

## הרצה מקומית

```bash
npm install
npm run dev
```

ואז לפתוח את http://localhost:5173. כדי לפתוח מהטלפון באותה רשת: `npm run dev -- --host`, ולגלוש לכתובת ה־IP שמופיעה.

בדיקות: `npm test`. בדיקת טיפוסים: `npm run check`. בנייה: `npm run build`.

## העלאה לאינטרנט עם Cloudflare Pages (פעם אחת)

1. להיכנס ל־https://dash.cloudflare.com (ליצור חשבון חינמי אם אין).
2. בתפריט: **Workers & Pages** ← **Create** ← לשונית **Pages** ← **Connect to Git**.
3. לחבר את חשבון GitHub ולבחור את המאגר `nks-sandbox`.
4. בהגדרות הבנייה:
   - Framework preset: **None** (או Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Production branch: `main`
5. **Save and Deploy**.

מאז, כל push לענף `main` מעלה גרסה לכתובת הקבועה `https://nks-sandbox.pages.dev`
(אם השם תפוס, Cloudflare מוסיפה סיומת, והכתובת מופיעה בלוח הבקרה). כל ענף אחר מקבל
כתובת תצוגה מקדימה משלו, בצורה `https://<branch>.nks-sandbox.pages.dev`.

אחרי הביקור הראשון האתר עובד גם בלי אינטרנט. כשעולה גרסה חדשה מופיעה ההודעה "יש גרסה חדשה, לרענן?".
