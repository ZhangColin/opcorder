"""Safety/control-flow tests with a fake Docker executable; no database touched."""
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "restore-prod-dump-local.sh"
MOCK_DOCKER = r"""#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
a = sys.argv[1:]
mode = os.environ.get('TEST_MODE', '')
with open(os.environ['TEST_CALLS'], 'a') as f:
    f.write(json.dumps(a) + '\n')
text = ' '.join(a)
if a[:2] == ['context', 'show']:
    print('desktop-linux')
elif a[:2] == ['context', 'inspect']:
    print('ssh://remote-host' if mode == 'remote' else 'unix:///tmp/fake-docker.sock')
elif a[0] == 'inspect':
    print('jiedanba-local')
elif 'ps -q db' in text:
    print('fake-container')
elif 'pg_restore --list' in text:
    sys.stdin.buffer.read()
    if mode == 'bad_archive':
        print('unsupported archive', file=sys.stderr)
        sys.exit(9)
    version = '18.1' if mode == 'newer_source' else '17.11'
    print(';     Dumped from database version: ' + version)
    print(';     Dumped by pg_dump version: 17.11')
elif 'SHOW server_version_num' in text:
    print('170011')
elif 'SELECT count(*) FROM pg_database' in text:
    print('0' if mode == 'missing_db' and 'jiedanba_local' in text and not Path(os.environ['TEST_CALLS'] + '.created').exists() else '1')
elif 'createdb ' in text:
    Path(os.environ['TEST_CALLS'] + '.created').touch()
elif 'pg_dump ' in text:
    if mode == 'backup_failure':
        sys.exit(8)
    sys.stdout.buffer.write(b'PGDMP-fixture')
elif 'pg_restore ' in text:
    sys.stdin.buffer.read()
    if mode == 'restore_failure':
        print('simulated SQL failure', file=sys.stderr)
        sys.exit(7)
elif 'psql ' in text:
    sys.stdin.read()
    print('simulated checks complete')
"""


class LocalRestoreTests(unittest.TestCase):
    def test_variables_adjacent_to_non_ascii_are_braced(self):
        self.assertIsNone(re.search(r"\$[A-Za-z_][A-Za-z_0-9]*[^\x00-\x7f]", SCRIPT.read_text()))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.local = self.root / "local-dev"
        self.local.mkdir()
        (self.root / "scripts").mkdir()
        shutil.copyfile(SCRIPT, self.root / "scripts/restore-prod-dump-local.sh")
        for file in ["compose.yaml", ".env", "api.env"]:
            (self.local / file).write_text("unchanged fixture\n")
        (self.local / "prod.dump").write_bytes(b"PGDMP-fixture")
        bindir = self.root / "bin"
        bindir.mkdir()
        mock = bindir / "docker"
        mock.write_text(MOCK_DOCKER)
        mock.chmod(0o700)
        self.calls_file = self.root / "calls.jsonl"
        self.env = {**os.environ, "PATH": str(bindir) + os.pathsep + os.environ["PATH"],
                    "TEST_CALLS": str(self.calls_file)}
        self.env.pop("DOCKER_HOST", None)
        self.env.pop("DOCKER_CONTEXT", None)
        self.calls = []

    def tearDown(self):
        self.temp.cleanup()

    def run_restore(self, mode="", answer="RESTORE_LOCAL\n"):
        result = subprocess.run(
            ["bash", str(self.root / "scripts/restore-prod-dump-local.sh")],
            input=answer, text=True, capture_output=True, cwd=self.root,
            env={**self.env, "TEST_MODE": mode},
        )
        self.calls = [json.loads(s) for s in self.calls_file.read_text().splitlines()] \
            if self.calls_file.exists() else []
        self.assertEqual((self.local / "api.env").read_text(), "unchanged fixture\n")
        # Only the explicitly confirmed local DB may be dropped; never start the app.
        for args in self.calls:
            text = " ".join(args)
            if "dropdb" in text:
                self.assertEqual(args[-1], "jiedanba_local")
            self.assertNotIn("--clean", text)
            self.assertNotIn("up -d", text)
            self.assertNotIn("run dev", text)
        return result

    def assert_no_stop_or_create(self):
        text = "\n".join(" ".join(a) for a in self.calls)
        self.assertNotIn("stop dev", text)
        self.assertNotIn("createdb", text)
        self.assertNotIn("dropdb", text)

    def test_missing_file(self):
        (self.local / "prod.dump").unlink()
        self.assertNotEqual(self.run_restore().returncode, 0)
        self.assertEqual(self.calls, [])

    def test_remote_docker_rejected(self):
        self.assertNotEqual(self.run_restore("remote").returncode, 0)
        self.assert_no_stop_or_create()

    def test_bad_archive_rejected(self):
        self.assertNotEqual(self.run_restore("bad_archive").returncode, 0)
        self.assert_no_stop_or_create()

    def test_newer_source_rejected(self):
        result = self.run_restore("newer_source")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("源库主版本18高于本地17", result.stderr)
        self.assertNotIn("unbound variable", result.stderr)
        self.assert_no_stop_or_create()

    def test_cancel_preserves_running_app(self):
        self.assertNotEqual(self.run_restore(answer="no\n").returncode, 0)
        self.assert_no_stop_or_create()

    def test_backup_failure_stops_before_creation(self):
        self.assertNotEqual(self.run_restore("backup_failure").returncode, 0)
        self.assertFalse(any("createdb" in " ".join(a) for a in self.calls))
        self.assertFalse(any("dropdb" in " ".join(a) for a in self.calls))

    def test_restore_failure_not_marked_success(self):
        self.assertNotEqual(self.run_restore("restore_failure").returncode, 0)
        self.assertEqual(list(self.local.glob("restore-reports/*/database-name.txt")), [])

    def test_success_uses_fixed_db_and_transaction(self):
        result = self.run_restore()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("源库主版本：17；本地库主版本：17", result.stdout)
        restore = next(a for a in self.calls if "--single-transaction" in " ".join(a))
        self.assertIn("--exit-on-error", " ".join(restore))
        self.assertEqual(restore[-1], "jiedanba_local")
        texts = [" ".join(a) for a in self.calls]
        backup = next(i for i, t in enumerate(texts) if "pg_dump " in t)
        drop = next(i for i, t in enumerate(texts) if "dropdb " in t)
        create = next(i for i, t in enumerate(texts) if "createdb " in t)
        self.assertLess(backup, drop)
        self.assertLess(drop, create)
        reports = list(self.local.glob("restore-reports/*"))
        self.assertEqual(len(reports), 1)
        for name in ["archive.list", "checks.txt", "before-jiedanba_local.dump", "database-name.txt"]:
            self.assertTrue((reports[0] / name).exists(), name)
        self.assertEqual(reports[0].stat().st_mode & 0o777, 0o700)
        self.assertEqual((reports[0] / "before-jiedanba_local.dump").stat().st_mode & 0o777, 0o600)

    def test_missing_local_db_can_be_initialized(self):
        result = self.run_restore("missing_db")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any("pg_dump " in " ".join(a) for a in self.calls))
        self.assertTrue(any("createdb " in " ".join(a) and a[-1] == "jiedanba_local" for a in self.calls))


if __name__ == "__main__":
    unittest.main()
