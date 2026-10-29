// A small library of classic patterns (RLE from LifeWiki). Descriptions are our own.

export interface LibraryPattern {
  id: string;
  name: string;
  text: string;
  rule: string;
  rle: string;
  /** Period of an oscillator / spaceship, if known (checked by the tests). */
  period?: number;
  /** Displacement per period for spaceships. */
  move?: [number, number];
}

export const PATTERNS: LibraryPattern[] = [
  { id: 'glider', name: 'רחפן', text: 'החללית הקטנה ביותר: חמישה תאים שזזים באלכסון, תא אחד כל ארבעה דורות.', rule: 'B3/S23', rle: 'bo$2bo$3o!', period: 4, move: [1, 1] },
  { id: 'lwss', name: 'חללית קלה', text: 'חללית שזזה אופקית, שני תאים כל ארבעה דורות.', rule: 'B3/S23', rle: 'bo2bo$o4b$o3bo$4o!', period: 4, move: [-2, 0] },
  { id: 'blinker', name: 'מהבהב', text: 'המתנד הקטן ביותר: שלושה תאים בשורה שמסתובבים, מחזור 2.', rule: 'B3/S23', rle: '3o!', period: 2 },
  { id: 'toad', name: 'קרפדה', text: 'מתנד עם מחזור 2.', rule: 'B3/S23', rle: 'b3o$3o!', period: 2 },
  { id: 'beacon', name: 'משואה', text: 'שני ריבועים שמהבהבים בפינות, מחזור 2.', rule: 'B3/S23', rle: '2o2b$2o2b$2b2o$2b2o!', period: 2 },
  {
    id: 'pulsar',
    name: 'פולסר',
    text: 'מתנד סימטרי וגדול עם מחזור 3.',
    rule: 'B3/S23',
    rle: '2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!',
    period: 3,
  },
  { id: 'pentadecathlon', name: 'פנטדקתלון', text: 'מתנד עם מחזור 15.', rule: 'B3/S23', rle: '2bo4bo2b$2ob4ob2o$2bo4bo!', period: 15 },
  {
    id: 'gosper',
    name: 'תותח הרחפנים של גוספר',
    text: 'התבנית הראשונה שנמצאה שגדלה לעד: יורה רחפן חדש כל 30 דורות.',
    rule: 'B3/S23',
    rle: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!',
  },
  { id: 'rpent', name: 'R־פנטומינו', text: 'חמישה תאים בלבד, אבל מתייצב רק אחרי 1103 דורות.', rule: 'B3/S23', rle: 'b2o$2o$bo!' },
  { id: 'acorn', name: 'בלוט', text: 'שבעה תאים שגדלים לאלפי דורות של פעילות.', rule: 'B3/S23', rle: 'bo5b$3bo3b$2o2b3o!' },
  { id: 'diehard', name: 'דאיהארד', text: 'נעלם לגמרי אחרי 130 דורות.', rule: 'B3/S23', rle: '6bob$2o6b$bo3b3o!' },
  { id: 'replicator', name: 'משכפל (HighLife)', text: 'ב־HighLife התבנית הזו יוצרת עותקים של עצמה.', rule: 'B36/S23', rle: '2b3o$bo2bo$o3bo$o2bob$3o!' },
];
