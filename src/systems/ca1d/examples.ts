// Ready-made examples. Page numbers refer to the original book and were checked
// against the figure references in the Hebrew translation ("איור 1, עמוד 27 במקור").
// The texts are our own words.

import type { Example } from '../types';
import { defaults, type CA1DParams } from './params';

const ex = (
  id: string,
  title: string,
  text: string,
  page: number | string | undefined,
  change: Partial<CA1DParams>,
): Example<CA1DParams> => ({ id, title, text, page, params: { ...defaults(), ...change } });

export const examples: Example<CA1DParams>[] = [
  ex('r254', 'כלל 254: משולש מלא', 'הדוגמה הפשוטה ביותר: תא נעשה שחור אם הוא או אחד משכניו היה שחור. התבנית פשוט מתרחבת.', 24, {
    code: '254',
    steps: 30,
  }),
  ex('r250', 'כלל 250: לוח שחמט', 'שינוי קטן בכלל, והתוצאה תבנית חזרתית של משבצות לסירוגין.', 25, {
    code: '250',
    steps: 30,
  }),
  ex('r90', 'כלל 90: משולש סרפינסקי', 'תא נעשה שחור כשבדיוק אחד משני שכניו שחור. מתקבלת תבנית מקוננת: משולשים בתוך משולשים.', '25–26', {
    code: '90',
    steps: 255,
  }),
  ex('r30', 'כלל 30: אקראיות מכלל פשוט', 'הדוגמה המרכזית של הספר: כלל פשוט ותא אחד, ובכל זאת התבנית נראית אקראית ברובה, בייחוד בצד ימין.', 27, {
    code: '30',
    steps: 250,
  }),
  ex('r30big', 'כלל 30: אלף צעדים', 'גם אחרי הרבה צעדים לא מופיעה סדירות כוללת. נסו לגלול ולהתקרב לצד שמאל, שם יש קצת סדר.', '29–30', {
    code: '30',
    steps: 1000,
  }),
  ex('r110', 'כלל 110: מורכבות', 'לא סדיר לגמרי ולא אקראי לגמרי: מבנים ממוקמים שנעים ומתנגשים. מאוחר יותר מתברר שהכלל הזה אוניברסלי.', 32, {
    code: '110',
    steps: 300,
  }),
  ex('r110long', 'כלל 110: לאורך זמן', 'אחרי זמן רב התבנית מתייצבת לרקע חזרתי, עם מבנים ממוקמים שנעים עליו.', '33–38', {
    code: '110',
    steps: 2000,
  }),
  ex('r22', 'כלל 22: עוד תבנית מקוננת', 'גם הכלל הזה מייצר מבנה מקונן מתא אחד, בדומה לכלל 90.', 58, { code: '22', steps: 255 }),
  ex('r30rand', 'כלל 30 מתנאי התחלה אקראיים', 'אותו כלל, אבל בהתחלה כל תא נבחר באקראי. משולשים בכל הגדלים מופיעים בכל מקום.', undefined, {
    code: '30',
    init: { kind: 'random', density: 0.5, seed: 7 },
    boundary: 'periodic',
    width: 400,
    steps: 300,
  }),
  ex('r184', 'כלל 184: תנועה', 'כל תא שחור הוא מכונית שזזה ימינה אם יש לפניה מקום. בצפיפות נמוכה הכל זורם, ובגבוהה נוצרים פקקים.', undefined, {
    code: '184',
    init: { kind: 'random', density: 0.45, seed: 3 },
    boundary: 'periodic',
    width: 300,
    steps: 200,
  }),
  ex('t1599', 'קוד 1599: טוטליסטי בשלושה צבעים', 'כלל טוטליסטי בשלושה צבעים שמתחיל מתא אפור אחד. רק אחרי אלפי צעדים מתברר שהתבנית בסוף מתייצבת.', '69–70', {
    k: 3,
    totalistic: true,
    code: '1599',
    steps: 1500,
  }),
  ex('t20r2', 'קוד 20, טווח 2', 'כלל טוטליסטי בשני צבעים עם שני שכנים מכל צד. מתנאי התחלה אקראיים מופיעים מבנים ממוקמים שנעים.', undefined, {
    r: 2,
    totalistic: true,
    code: '20',
    init: { kind: 'random', density: 0.5, seed: 11 },
    boundary: 'periodic',
    width: 400,
    steps: 300,
  }),
];
