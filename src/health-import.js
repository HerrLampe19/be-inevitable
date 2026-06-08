// Apple-Health-Export-Parser.
// Liest die "export.xml" aus dem Apple-Health-Export und aggregiert die für uns
// relevanten Werte pro Tag: Gewicht (letzter Wert/Tag), Schritte (Summe/Tag),
// Schlaf (summierte Stunden, dem Aufwach-Tag zugeordnet).
//
// Bewusst zeilen-/regex-basiert statt vollem XML-DOM, damit auch sehr große
// Exporte (viele MB) ohne hohen Speicherverbrauch verarbeitet werden können.

// Datum aus einem Apple-Health-Datumsstring ziehen ("2026-05-01 08:00:00 +0200" -> "2026-05-01")
function dayOf(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Millisekunden zwischen zwei Apple-Health-Datumsstrings (für Schlafdauer)
function diffMs(start, end) {
  // Format: "YYYY-MM-DD HH:MM:SS +ZZZZ" -> ISO-tauglich machen
  const norm = x => {
    const m = x.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s*([+-]\d{2})(\d{2})?/);
    if (!m) return null;
    return `${m[1]}T${m[2]}${m[3]}:${m[4] || '00'}`;
  };
  const a = norm(start), b = norm(end);
  if (!a || !b) return 0;
  const ta = Date.parse(a), tb = Date.parse(b);
  if (isNaN(ta) || isNaN(tb)) return 0;
  return Math.max(0, tb - ta);
}

// Ein einzelnes <Record ... /> auswerten und in die Akkumulatoren einsortieren.
function handleRecord(attrs, acc) {
  const type = attrs.type;
  if (!type) return;

  if (type === 'HKQuantityTypeIdentifierBodyMass') {
    const day = dayOf(attrs.startDate || attrs.endDate);
    const val = parseFloat(attrs.value);
    if (day && !isNaN(val)) {
      // letzter Wert des Tages gewinnt (Records kommen chronologisch; wir überschreiben)
      acc.weight[day] = val;
    }
  } else if (type === 'HKQuantityTypeIdentifierStepCount') {
    const day = dayOf(attrs.startDate || attrs.endDate);
    const val = parseFloat(attrs.value);
    if (day && !isNaN(val)) {
      acc.steps[day] = (acc.steps[day] || 0) + val; // über den Tag summieren
    }
  } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
    // Nur tatsächliche Schlafphasen zählen (nicht "InBed", nicht "Awake")
    const v = attrs.value || '';
    const isAsleep = /Asleep/i.test(v); // AsleepCore/Deep/REM/Unspecified
    if (!isAsleep) return;
    const ms = diffMs(attrs.startDate, attrs.endDate);
    if (ms <= 0) return;
    // Schlaf dem AUFWACH-Tag zuordnen (endDate), das entspricht dem gefühlten "heute"
    const day = dayOf(attrs.endDate || attrs.startDate);
    if (day) acc.sleepMs[day] = (acc.sleepMs[day] || 0) + ms;
  }
}

// Attribute eines Record-Tags aus einem String extrahieren
function parseAttrs(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

// Haupteinstieg: kompletter XML-Text -> { days: { 'YYYY-MM-DD': {weight,steps,sleep} }, stats }
export function parseHealthExport(xml) {
  const acc = { weight: {}, steps: {}, sleepMs: {} };
  if (typeof xml !== 'string' || !xml.length) {
    return { days: {}, stats: { records: 0, weightDays: 0, stepDays: 0, sleepDays: 0 } };
  }
  // Alle <Record .../> bzw. <Record ...> Tags finden (Attribute stehen im öffnenden Tag)
  let count = 0;
  for (const m of xml.matchAll(/<Record\b([^>]*)>/g)) {
    handleRecord(parseAttrs(m[1]), acc);
    count++;
  }
  // Zusammenführen pro Tag
  const days = {};
  const ensure = d => (days[d] = days[d] || {});
  for (const [d, v] of Object.entries(acc.weight)) ensure(d).weight = Math.round(v * 10) / 10;
  for (const [d, v] of Object.entries(acc.steps)) ensure(d).steps = Math.round(v);
  for (const [d, ms] of Object.entries(acc.sleepMs)) ensure(d).sleep = Math.round((ms / 3600000) * 10) / 10;

  return {
    days,
    stats: {
      records: count,
      weightDays: Object.keys(acc.weight).length,
      stepDays: Object.keys(acc.steps).length,
      sleepDays: Object.keys(acc.sleepMs).length,
    },
  };
}
