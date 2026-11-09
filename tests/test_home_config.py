"""The home's AQI and news keys in config.json are passed on only when they are valid."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "bridge"))
import config


class HomeAqiNewsTests(unittest.TestCase):
    def test_both_left_out_by_default(self):
        out = config._home({})
        self.assertNotIn("aqi", out)
        self.assertNotIn("news_feed", out)

    def test_aqi_takes_only_true_or_false(self):
        self.assertIs(config._home({"aqi": True})["aqi"], True)
        self.assertIs(config._home({"aqi": False})["aqi"], False)
        for bad in ("yes", 1, 0, None, "true"):
            self.assertNotIn("aqi", config._home({"aqi": bad}), bad)

    def test_news_feed_takes_an_https_address(self):
        url = "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"
        self.assertEqual(config._home({"news_feed": url})["news_feed"], url)

    def test_news_feed_refuses_http_other_schemes_and_junk(self):
        for bad in ("http://example.com/rss", "javascript:alert(1)", "file:///etc/hosts", "", None, 42,
                    "https://x.example/" + "a" * 2000):
            self.assertNotIn("news_feed", config._home({"news_feed": bad}), bad)


if __name__ == "__main__":
    unittest.main()
