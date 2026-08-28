import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.counties = json.loads((APP / "data" / "counties.json").read_text())
        cls.cities = json.loads((APP / "data" / "cities.json").read_text())

    def test_county_count_and_identity_are_complete(self):
        self.assertEqual(len(self.counties), 254)
        self.assertEqual(len({row["id"] for row in self.counties}), 254)
        self.assertEqual(len({row["county"] for row in self.counties}), 254)

    def test_required_county_fields(self):
        required = {"id", "county", "seat", "region", "website", "tax", "search"}
        for row in self.counties:
            with self.subTest(county=row.get("county")):
                self.assertTrue(required.issubset(row))
                self.assertTrue(row["seat"])
                self.assertRegex(row["website"], r"^https?://")
                self.assertIsInstance(row["tax"], dict)
                self.assertIsInstance(row["search"], dict)

    def test_no_sos_alphabet_navigation_in_addresses(self):
        fragment = re.compile(r"^(?:\||\|?\s*[A-Z]\s*\|?)$")
        bad = []
        for row in self.counties:
            for part in row["tax"].get("address", "").split(";"):
                if fragment.fullmatch(part.strip()):
                    bad.append((row["county"], part.strip()))
        self.assertEqual(bad, [])

    def test_known_missing_seats_are_patched(self):
        by_name = {row["county"]: row for row in self.counties}
        self.assertEqual(by_name["Hardeman"]["seat"], "Quanah")
        self.assertEqual(by_name["Wood"]["seat"], "Quitman")

    def test_city_rows_map_to_existing_counties(self):
        self.assertEqual(len(self.cities), 45)
        county_names = {row["county"] for row in self.counties}
        missing = [row for row in self.cities if row["county"] not in county_names]
        self.assertEqual(missing, [])


class StaticApplicationTests(unittest.TestCase):
    def test_expected_dashboard_assets_are_linked(self):
        html = (APP / "index.html").read_text()
        self.assertIn('data-view="deals"', html)
        self.assertIn('id="view-deals"', html)
        self.assertIn('src="/dashboard.js"', html)
        self.assertIn('href="/dashboard.css"', html)
        self.assertNotIn("perduelaw.com", html)
        self.assertNotIn("sale of property-tax liens to investors is prohibited", html.lower())

    def test_javascript_syntax(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js is not installed")
        for script in (APP / "app.js", APP / "dashboard.js"):
            result = subprocess.run(
                [node, "--check", str(script)],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_python_syntax(self):
        result = subprocess.run(
            [sys.executable, "-m", "py_compile", str(APP / "server.py"), str(APP / "build_dataset.py")],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_dataset_builder_runs_cleanly(self):
        result = subprocess.run(
            [sys.executable, str(APP / "build_dataset.py")],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("counties built: 254", result.stdout)


class ServerTests(unittest.TestCase):
    def test_server_health_and_dashboard_assets(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]

        env = os.environ.copy()
        env["PORT"] = str(port)
        process = subprocess.Popen(
            [sys.executable, str(APP / "server.py")],
            cwd=ROOT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        try:
            health = None
            deadline = time.time() + 8
            while time.time() < deadline:
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1) as response:
                        health = json.loads(response.read())
                    break
                except Exception:
                    time.sleep(0.1)
            self.assertIsNotNone(health, "server did not become ready")
            self.assertEqual(health["counties"], 254)
            self.assertEqual(health["cities"], 45)
            self.assertEqual(health["version"], "1.1")

            for path, expected_type in (
                ("/", "text/html"),
                ("/app.js", "text/javascript"),
                ("/dashboard.js", "text/javascript"),
                ("/style.css", "text/css"),
                ("/dashboard.css", "text/css"),
            ):
                with self.subTest(path=path):
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=2) as response:
                        body = response.read()
                        self.assertEqual(response.status, 200)
                        self.assertIn(expected_type, response.headers.get("Content-Type", ""))
                        self.assertTrue(body)
                        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        finally:
            process.terminate()
            try:
                process.wait(timeout=4)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
