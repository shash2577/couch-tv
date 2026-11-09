// India's AQI (tv-home/web/aqi.js) against CPCB's breakpoints.  node --test tests/aqi.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const AQI = createRequire(import.meta.url)("../tv-home/web/aqi.js");
const hours = (v, n = 24) => Array(n).fill(v);

test("PM2.5 sub-index at each CPCB breakpoint", () => {
  assert.equal(AQI.subIndex(0, AQI.PM25), 0);
  assert.equal(AQI.subIndex(30, AQI.PM25), 50);
  assert.equal(AQI.subIndex(60, AQI.PM25), 100);
  assert.equal(AQI.subIndex(90, AQI.PM25), 200);
  assert.equal(AQI.subIndex(120, AQI.PM25), 300);
  assert.equal(AQI.subIndex(250, AQI.PM25), 400);
  assert.equal(AQI.subIndex(380, AQI.PM25), 500);
});

test("PM10 sub-index at each CPCB breakpoint", () => {
  assert.equal(AQI.subIndex(50, AQI.PM10), 50);
  assert.equal(AQI.subIndex(100, AQI.PM10), 100);
  assert.equal(AQI.subIndex(250, AQI.PM10), 200);
  assert.equal(AQI.subIndex(350, AQI.PM10), 300);
  assert.equal(AQI.subIndex(430, AQI.PM10), 400);
});

test("sub-index interpolates inside a band", () => {
  assert.equal(AQI.subIndex(45, AQI.PM25), 75);    // halfway 30..60 -> halfway 50..100
  assert.equal(AQI.subIndex(105, AQI.PM25), 250);  // halfway 90..120 -> halfway 200..300
});

test("sub-index caps at 500 above the scale and refuses bad readings", () => {
  assert.equal(AQI.subIndex(999, AQI.PM25), 500);
  assert.equal(AQI.subIndex(-1, AQI.PM25), null);
  assert.equal(AQI.subIndex(null, AQI.PM25), null);
  assert.equal(AQI.subIndex(NaN, AQI.PM25), null);
  assert.equal(AQI.subIndex(Infinity, AQI.PM25), null);
});

test("average needs at least 16 hourly readings and skips missing hours", () => {
  assert.equal(AQI.average(hours(10, 15)), null);
  assert.equal(AQI.average(hours(10, 16)), 10);
  assert.equal(AQI.average([...hours(20, 16), null, null, NaN]), 20);
  assert.equal(AQI.average(undefined), null);
  assert.equal(AQI.average([]), null);
});

test("category edges", () => {
  assert.equal(AQI.category(50), "good");
  assert.equal(AQI.category(51), "satisfactory");
  assert.equal(AQI.category(100), "satisfactory");
  assert.equal(AQI.category(200), "moderate");
  assert.equal(AQI.category(201), "poor");
  assert.equal(AQI.category(300), "poor");
  assert.equal(AQI.category(400), "very_poor");
  assert.equal(AQI.category(401), "severe");
  assert.equal(AQI.category(500), "severe");
  assert.equal(AQI.category(null), null);
});

test("index is the worse of PM2.5 and PM10", () => {
  assert.deepEqual(AQI.fromHourly({ pm2_5: hours(105), pm10: hours(75) }), { index: 250, category: "poor" });
  assert.deepEqual(AQI.fromHourly({ pm2_5: hours(20), pm10: hours(300) }), { index: 250, category: "poor" });
});

test("one pollutant missing still gives an index; both missing gives none", () => {
  assert.deepEqual(AQI.fromHourly({ pm2_5: hours(45), pm10: hours(null) }), { index: 75, category: "satisfactory" });
  assert.deepEqual(AQI.fromHourly({ pm2_5: undefined, pm10: hours(50) }), { index: 50, category: "good" });
  assert.equal(AQI.fromHourly({ pm2_5: hours(null), pm10: hours(10, 3) }), null);
  assert.equal(AQI.fromHourly(null), null);
});

test("url asks for the last 24 hours of PM2.5 and PM10 at the place", () => {
  const u = new URL(AQI.url(28.4744, 77.504));
  assert.equal(u.host, "air-quality-api.open-meteo.com");
  assert.equal(u.searchParams.get("latitude"), "28.4744");
  assert.equal(u.searchParams.get("longitude"), "77.504");
  assert.equal(u.searchParams.get("hourly"), "pm2_5,pm10");
  assert.equal(u.searchParams.get("past_hours"), "24");
  assert.equal(u.searchParams.get("forecast_hours"), "0");
});
