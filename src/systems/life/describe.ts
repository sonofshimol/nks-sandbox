// A short Hebrew description of a Life-like rule.

import { maxCount, type LifeRule } from '../../engine/life';

function counts(a: boolean[]): string {
  const list: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (!a[i]) continue;
    let j = i;
    while (j + 1 < a.length && a[j + 1]) j++;
    list.push(j - i >= 2 ? `${i} עד ${j}` : j === i ? `${i}` : `${i}, ${j}`);
    i = j;
  }
  if (!list.length) return '';
  return list.length === 1 ? list[0] : list.slice(0, -1).join(', ') + ' או ' + list[list.length - 1];
}

export function describeLifeRule(rule: LifeRule): string {
  if (rule.family === 'wireworld') {
    return 'ארבעה מצבים: {0} ריק, {1} ראש אלקטרון, {2} זנב, {3} חוט. ראש הופך לזנב, זנב חוזר להיות חוט, וחוט הופך לראש כשבדיוק אחד או שניים משמונת שכניו הם ראשים.';
  }
  const b = counts(rule.birth);
  const s = counts(rule.survive);
  const where =
    rule.range === 1 && !rule.vonNeumann
      ? 'מתוך 8 השכנים'
      : `בתוך ${rule.vonNeumann ? 'מעוין' : 'ריבוע'} ברדיוס ${rule.range} (${maxCount(rule.range, rule.vonNeumann, rule.center)} תאים${rule.center ? ', כולל התא עצמו' : ''})`;
  const birth = b ? `תא ריק נולד כשיש לו ${b} שכנים חיים` : 'אף תא לא נולד';
  const survive = s ? `תא חי שורד כשיש לו ${s}` : 'כל תא חי מת אחרי צעד';
  let text = `סופרים שכנים חיים ${where}. ${birth}, ו${survive}${s ? '; אחרת הוא מת' : ''}.`;
  if (rule.states > 2) {
    text += ` תא שמת לא נעלם מיד: הוא עובר ${rule.states - 2 === 1 ? 'מצב גסיסה אחד' : `${rule.states - 2} מצבי גסיסה`} (${Array.from({ length: rule.states - 2 }, (_, i) => `{${i + 2}}`).join(' ')}) ורק אז נעשה ריק. רק תאים חיים {1} נספרים.`;
  }
  return text;
}
