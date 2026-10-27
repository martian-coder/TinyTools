# Contributing to Triagent

Thanks for helping. A few rules keep the project clean and its provenance clear.

## Clean-room rule

Contribute only work you wrote yourself and have the right to license under Apache-2.0. Never include code, data, field names, project keys, people's names or rule documents from an employer or customer. All examples and fixtures use the fictional **Northwind Devices** and synthetic data from `scripts/seed_synthetic.py`.

## Developer Certificate of Origin (DCO)

Every commit must be signed off, certifying the [Developer Certificate of Origin 1.1](https://developercertificate.org/):

```bash
git commit -s -m "feat(rules): add not_in operator"
```

This adds `Signed-off-by: Your Name <you@example.com>` to the commit message. Pull requests with unsigned commits fail the DCO check. To fix the last commit: `git commit --amend -s --no-edit`.

## Development setup

```bash
uv sync
uv run pre-commit install
docker compose up -d db
```

Before opening a pull request, run:

```bash
uv run ruff format --check . && uv run ruff check .
uv run mypy backend/triagent
uv run lint-imports
uv run pytest -q
```

## Pull requests

- Keep each PR small and focused. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- Add or update tests in the same PR. Golden decisions change only together with their golden files.
- Update `docs/` when behaviour or configuration changes.
- `core/` must not import frameworks, drivers or vendor SDKs; `lint-imports` enforces this.

## Reporting security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).
