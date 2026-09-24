// Har country ka IANA timezone + best weekdays (0=Sun..6=Sat, JS convention) + best hours.
// Python version me Mon=0 tha; yahan JS Date.getDay() convention (Sun=0) use kar rahe hain,
// isliye days ko convert kar diya gaya hai.
const COUNTRY_DATA = {
  "Pakistan":              { tz: "Asia/Karachi",        days: [2, 3, 4], hours: [9, 12, 17] },
  "India":                 { tz: "Asia/Kolkata",        days: [2, 3, 4], hours: [9, 13, 18] },
  "United States":         { tz: "America/New_York",    days: [2, 3, 4], hours: [8, 12, 17] },
  "United Kingdom":        { tz: "Europe/London",       days: [2, 3, 4], hours: [8, 12, 17] },
  "Canada":                { tz: "America/Toronto",     days: [2, 3, 4], hours: [8, 12, 17] },
  "Australia":             { tz: "Australia/Sydney",    days: [2, 3, 4], hours: [8, 12, 17] },
  "Germany":               { tz: "Europe/Berlin",       days: [2, 3, 4], hours: [8, 12, 17] },
  "France":                { tz: "Europe/Paris",        days: [2, 3, 4], hours: [8, 12, 17] },
  "United Arab Emirates":  { tz: "Asia/Dubai",          days: [0, 1, 2], hours: [9, 13, 20] },
  "Saudi Arabia":          { tz: "Asia/Riyadh",         days: [0, 1, 2], hours: [9, 13, 20] },
  "Singapore":             { tz: "Asia/Singapore",      days: [2, 3, 4], hours: [9, 12, 18] },
  "Netherlands":           { tz: "Europe/Amsterdam",    days: [2, 3, 4], hours: [8, 12, 17] },
  "Brazil":                { tz: "America/Sao_Paulo",   days: [2, 3, 4], hours: [9, 12, 18] },
  "South Africa":          { tz: "Africa/Johannesburg", days: [2, 3, 4], hours: [8, 12, 17] },
  "Japan":                 { tz: "Asia/Tokyo",          days: [2, 3, 4], hours: [8, 12, 19] },
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PKT_TZ = "Asia/Karachi";

// Diya gaya UTC Date ko kisi bhi IANA timezone ke "local wall clock" parts me todta hai.
function partsInTz(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

// Local wall-clock (saal/mahina/din/ghanta...) ko us timezone ke UTC instant me convert karta hai.
function localToUtc(y, mo, d, h, mi, tz) {
  // Pehle naive guess UTC banao, phir offset nikaal ke correct karo.
  let guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  for (let i = 0; i < 2; i++) {
    const parts = partsInTz(new Date(guess), tz);
    const gotUtcIfLocal = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    const diff = gotUtcIfLocal - Date.UTC(y, mo - 1, d, h, mi, 0);
    guess -= diff;
  }
  return new Date(guess);
}

function weekdayIndex(shortName) {
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[shortName];
}

function fmtDisplay(parts, tz) {
  const dow = DAY_NAMES[weekdayIndex(parts.weekday)];
  return `${dow}, ${parts.day} ${monthName(Number(parts.month))} ${parts.year} — ${parts.hour}:${parts.minute} (${tz})`;
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthName(n) { return MONTHS[n]; }

function bestTimeForCountry(country, clientNowIso) {
  const cfg = COUNTRY_DATA[country] || COUNTRY_DATA["Pakistan"];
  const tz = cfg.tz;
  const nowUtc = clientNowIso ? new Date(clientNowIso) : new Date();
  const nowLocal = partsInTz(nowUtc, tz);
  const nowPkt = partsInTz(nowUtc, PKT_TZ);

  const bestDays = cfg.days;
  const bestHours = cfg.hours;

  let candidateUtc = null;
  let candidateLocalParts = null;
  let isNextDay = false;

  for (let add = 0; add <= 14; add++) {
    // "add" din baad ka din local date me nikalo
    const dayGuessUtc = new Date(nowUtc.getTime() + add * 86400000);
    const dp = partsInTz(dayGuessUtc, tz);
    const dow = weekdayIndex(dp.weekday);
    if (!bestDays.includes(dow)) continue;

    for (const h of bestHours) {
      const slotUtc = localToUtc(Number(dp.year), Number(dp.month), Number(dp.day), h, 0, tz);
      if (slotUtc.getTime() > nowUtc.getTime() + 2 * 60000) {
        candidateUtc = slotUtc;
        candidateLocalParts = partsInTz(slotUtc, tz);
        break;
      }
    }
    if (candidateUtc) break;
  }

  if (!candidateUtc) {
    candidateUtc = new Date(nowUtc.getTime() + 3600000);
    candidateLocalParts = partsInTz(candidateUtc, tz);
  }

  isNextDay = candidateLocalParts.day !== nowLocal.day || candidateLocalParts.month !== nowLocal.month;
  const candidatePkt = partsInTz(candidateUtc, PKT_TZ);

  const reason =
    `${country} me LinkedIn engagement sab se zyada ` +
    bestDays.map((d) => DAY_NAMES[d]).join(", ") +
    ` ko ` + bestHours.map((h) => h + ":00").join(", ") + ` (local) par hoti hai.` +
    (isNextDay
      ? ` Aaj ke best slots guzar chuke the, is liye ${DAY_NAMES[weekdayIndex(candidateLocalParts.weekday)]} (${candidateLocalParts.day} ${monthName(Number(candidateLocalParts.month))}) ka waqt suggest kiya gaya hai.`
      : "");

  return {
    country,
    timezone: tz,
    local_now: fmtDisplay(nowLocal, tz),
    local_now_pkt: fmtDisplay(nowPkt, PKT_TZ) + " PKT",
    recommended_day: DAY_NAMES[weekdayIndex(candidateLocalParts.weekday)],
    recommended_local: `${candidateLocalParts.year}-${candidateLocalParts.month}-${candidateLocalParts.day} ${candidateLocalParts.hour}:${candidateLocalParts.minute}`,
    recommended_display: fmtDisplay(candidateLocalParts, tz),
    recommended_pkt_display: fmtDisplay(candidatePkt, PKT_TZ) + " PKT",
    recommended_iso: candidateUtc.toISOString(),
    recommended_local_iso: candidateUtc.toISOString(),
    is_next_day: isNextDay,
    best_days: bestDays.map((d) => DAY_NAMES[d]),
    best_hours: bestHours.map((h) => String(h).padStart(2, "0") + ":00"),
    reason,
  };
}

// Agle 7 dinon (aaj samet) ka pura list deta hai — har din ke liye ek suggested
// waqt, aur peak (best) din/ghante ko "is_peak: true" se mark karta hai. Isse
// user khud Friday, Saturday ya kisi bhi din ka waqt choose kar sakta hai.
function weekSlots(country, clientNowIso) {
  const cfg = COUNTRY_DATA[country] || COUNTRY_DATA["Pakistan"];
  const tz = cfg.tz;
  const nowUtc = clientNowIso ? new Date(clientNowIso) : new Date();
  const bestDays = cfg.days;
  const bestHours = cfg.hours;
  const peakHour = bestHours[Math.floor(bestHours.length / 2)]; // darmiyana hour = din ka peak
  const genericHour = 12; // non-peak din ke liye default suggestion (dopahar)

  const slots = [];
  for (let add = 0; add < 7; add++) {
    const dayGuessUtc = new Date(nowUtc.getTime() + add * 86400000);
    const dp = partsInTz(dayGuessUtc, tz);
    const dow = weekdayIndex(dp.weekday);
    const isPeakDay = bestDays.includes(dow);
    const hour = isPeakDay ? peakHour : genericHour;

    let slotUtc = localToUtc(Number(dp.year), Number(dp.month), Number(dp.day), hour, 0, tz);
    // Agar aaj ka suggested waqt guzar chuka hai to usi din ke agle best hour try karo,
    // warna agle din shift kar do.
    if (slotUtc.getTime() <= nowUtc.getTime() + 2 * 60000) {
      const hoursToTry = isPeakDay ? bestHours : [genericHour, 17];
      let found = null;
      for (const h of hoursToTry) {
        const t = localToUtc(Number(dp.year), Number(dp.month), Number(dp.day), h, 0, tz);
        if (t.getTime() > nowUtc.getTime() + 2 * 60000) { found = t; break; }
      }
      slotUtc = found; // null ho sakta hai agar din guzar gaya (aaj ke liye)
    }

    slots.push({
      date: `${dp.year}-${dp.month}-${dp.day}`,
      day_name: DAY_NAMES[dow],
      is_peak_day: isPeakDay,
      available: !!slotUtc,
      recommended_iso: slotUtc ? slotUtc.toISOString() : null,
      recommended_display: slotUtc ? fmtDisplay(partsInTz(slotUtc, tz), tz) : "Aaj ke slots guzar chuke",
      hour_label: isPeakDay ? `${String(hour).padStart(2, "0")}:00 (peak)` : `${String(hour).padStart(2, "0")}:00`,
    });
  }
  return { country, timezone: tz, slots };
}

module.exports = { COUNTRY_DATA, DAY_NAMES, bestTimeForCountry, weekSlots };
