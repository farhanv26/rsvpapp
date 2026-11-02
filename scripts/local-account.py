#!/usr/bin/env python3
"""Interactive local-only password setup. Secrets never enter argv, files or logs."""
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys
import warnings

ROOT = Path(__file__).resolve().parent.parent

def main():
    if len(sys.argv) != 1 or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise RuntimeError('Run npm run local:account in your own interactive terminal. No password arguments or piped input are accepted.')
    if os.environ.get('NODE_ENV', '').lower() == 'production' or os.environ.get('VERCEL') or os.environ.get('CI'):
        raise RuntimeError('This command is disabled in production and CI.')
    print('Local-only Farhan password setup: 127.0.0.1:54330/rsvp_dev')
    print('Existing identity, role, memberships and wedding data will be preserved.')
    print('Choose a local password of at least 12 characters and at most 72 UTF-8 bytes.')
    warnings.simplefilter('error', getpass.GetPassWarning)
    password = getpass.getpass('New local password (hidden): ')
    confirmation = getpass.getpass('Confirm local password (hidden): ')
    if password != confirmation:
        raise RuntimeError('Passwords did not match. No changes made.')
    if len(password) < 12 or len(password.encode('utf-8')) > 72:
        raise RuntimeError('Password must contain at least 12 characters and at most 72 UTF-8 bytes. No changes made.')
    environment = dict(os.environ, VOWPAL_LOCAL_ACCOUNT_SETUP='interactive')
    # An anonymous pipe carries the secret to Node. Never put it in argv or environment.
    result = subprocess.run(['node', str(ROOT / 'scripts/local-account-worker.mjs')],
        input=json.dumps({'password': password}), text=True, cwd=ROOT,
        env=environment, capture_output=True)
    password = confirmation = None
    if result.returncode:
        raise RuntimeError('Local setup failed. No hosted service was contacted. Check that the local database is running; no password has been logged.')
    print(result.stdout.strip())

if __name__ == '__main__':
    try:
        main()
    except (EOFError, KeyboardInterrupt):
        print('\nCancelled.', file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
