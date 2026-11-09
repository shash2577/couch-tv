// India's National Air Quality Index (CPCB) for the date line, next to the weather (home.aqi in
// config.json). The readings are Open-Meteo's free air quality model (CAMS, no key): the last 24
// hours of PM2.5 and PM10. The index is the worse of the two sub-indices, each worked out from its
// 24 hour average the way CPCB does, and CPCB's rule of at least 16 hourly readings applies.
// Used by app.js; tests/aqi.test.mjs checks the numbers.
(function (root) {
  // [concentration low, high, index low, high], µg/m³, CPCB's breakpoints
  var PM25 = [[0, 30, 0, 50], [30, 60, 50, 100], [60, 90, 100, 200], [90, 120, 200, 300], [120, 250, 300, 400], [250, 380, 400, 500]];
  var PM10 = [[0, 50, 0, 50], [50, 100, 50, 100], [100, 250, 100, 200], [250, 350, 200, 300], [350, 430, 300, 400], [430, 510, 400, 500]];
  var MIN_HOURS = 16;
  var CATEGORIES = [[50, "good"], [100, "satisfactory"], [200, "moderate"], [300, "poor"], [400, "very_poor"], [500, "severe"]];

  function subIndex(c, bands) {
    if (c == null || !isFinite(c) || c < 0) return null;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (c <= b[1]) return Math.round(b[2] + (b[3] - b[2]) * (c - b[0]) / (b[1] - b[0]));
    }
    return 500;   // above the last breakpoint: the scale ends at 500
  }

  // the 24 hour average, or null with fewer than MIN_HOURS readings (missing hours come as null)
  function average(values) {
    var got = (values || []).filter(function (v) { return v != null && isFinite(v); });
    if (got.length < MIN_HOURS) return null;
    return got.reduce(function (a, v) { return a + v; }, 0) / got.length;
  }

  function category(index) {
    if (index == null) return null;
    for (var i = 0; i < CATEGORIES.length; i++) if (index <= CATEGORIES[i][0]) return CATEGORIES[i][1];
    return "severe";
  }

  // hourly: Open-Meteo's "hourly" block with pm2_5 and pm10. {index, category} or null.
  function fromHourly(hourly) {
    if (!hourly) return null;
    var a = subIndex(average(hourly.pm2_5), PM25), b = subIndex(average(hourly.pm10), PM10);
    if (a == null && b == null) return null;
    var index = Math.max(a == null ? 0 : a, b == null ? 0 : b);
    return { index: index, category: category(index) };
  }

  function url(lat, lon) {
    return "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + lat + "&longitude=" + lon +
      "&hourly=pm2_5,pm10&past_hours=24&forecast_hours=0";
  }

  var api = { subIndex: subIndex, average: average, category: category, fromHourly: fromHourly, url: url, PM25: PM25, PM10: PM10 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AQI = api;
})(this);
