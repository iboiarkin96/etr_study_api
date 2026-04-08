PYTHON := .venv/bin/python
PIP    := .venv/bin/pip
ENV    := .env

.PHONY: help venv install requirements run migrate migration docs docs-watch check sync-docs

# ──────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────
help:
	@echo ""
	@echo "  Study App — available commands"
	@echo "  ─────────────────────────────────────────"
	@echo "  make venv             Create virtual environment"
	@echo "  make install          Install dependencies"
	@echo "  make requirements     Auto-generate requirements.txt from .venv"
	@echo "  make run              Start FastAPI dev server"
	@echo "  make migrate          Apply all Alembic migrations"
	@echo "  make migration name=… Auto-generate new Alembic migration"
	@echo "  make docs             Regenerate UML docs once"
	@echo "  make docs-watch       Watch UML sources, regenerate on change"
	@echo "  make check            Verify env, deps, and DB connectivity"
	@echo "  make sync-docs        Auto-update README.md & docs/index.html from code"
	@echo ""

# ──────────────────────────────────────────────
# Environment
# ──────────────────────────────────────────────
venv:
	@if [ -d ".venv" ]; then \
		echo "✓ .venv already exists"; \
	else \
		echo "→ Creating virtual environment…"; \
		python3 -m venv .venv && echo "✓ .venv created"; \
	fi

install:
	@if [ ! -d ".venv" ]; then \
		echo "✗ .venv not found. Run 'make venv' first."; exit 1; \
	fi
	@echo "→ Upgrading pip…"
	@$(PYTHON) -m pip install --upgrade pip -q
	@echo "→ Installing requirements…"
	@$(PIP) install -r requirements.txt -q
	@echo "✓ Dependencies installed"

requirements:
	@if [ ! -d ".venv" ]; then \
		echo "✗ .venv not found. Run 'make venv && make install' first."; exit 1; \
	fi
	@echo "→ Generating requirements.txt from current .venv…"
	@$(PIP) freeze | LC_ALL=C sort > requirements.txt
	@echo "✓ requirements.txt updated"

# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────
run:
	@if [ ! -f "$(ENV)" ]; then \
		echo "✗ $(ENV) not found. Copy .env.example → .env and configure it."; exit 1; \
	fi
	@if [ ! -d ".venv" ]; then \
		echo "✗ .venv not found. Run 'make venv && make install' first."; exit 1; \
	fi
	@echo "→ Starting server (reading $(ENV))…"
	@set -a; . ./$(ENV); set +a; \
	$(PYTHON) -m uvicorn app.main:app --host $$APP_HOST --port $$APP_PORT --reload

# ──────────────────────────────────────────────
# Database / Migrations
# ──────────────────────────────────────────────
migrate:
	@if [ ! -f "$(ENV)" ]; then \
		echo "✗ $(ENV) not found. Cannot resolve SQLITE_DB_PATH."; exit 1; \
	fi
	@echo "→ Applying migrations…"
	@$(PYTHON) -m alembic upgrade head && echo "✓ Migrations applied"

migration:
	@if [ -z "$(name)" ]; then \
		echo ""; \
		echo "✗ Missing migration name."; \
		echo ""; \
		echo "  Usage:"; \
		echo "    make migration name=full_name_of_migration"; \
		echo ""; \
		exit 1; \
	fi
	@echo "→ Generating migration '$(name)'…"
	@$(PYTHON) -m alembic revision --autogenerate -m "$(name)" && echo "✓ Migration created"

# ──────────────────────────────────────────────
# Docs
# ──────────────────────────────────────────────
docs:
	@if [ ! -f "scripts/regenerate_docs.py" ]; then \
		echo "✗ scripts/regenerate_docs.py not found."; exit 1; \
	fi
	@$(PYTHON) scripts/regenerate_docs.py

docs-watch:
	@if [ ! -f "scripts/regenerate_docs.py" ]; then \
		echo "✗ scripts/regenerate_docs.py not found."; exit 1; \
	fi
	@$(PYTHON) scripts/regenerate_docs.py --watch

# ──────────────────────────────────────────────
# Sync docs from code
# ──────────────────────────────────────────────
sync-docs:
	@if [ ! -d ".venv" ]; then \
		echo "✗ .venv not found. Run 'make venv && make install' first."; exit 1; \
	fi
	@echo "→ Syncing docs from code…"
	@$(PYTHON) scripts/sync_docs.py

# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────
check:
	@echo "→ Checking environment…"
	@if [ ! -d ".venv" ]; then echo "  ✗ .venv missing"; else echo "  ✓ .venv exists"; fi
	@if [ ! -f "$(ENV)" ]; then echo "  ✗ .env missing"; else echo "  ✓ .env exists"; fi
	@if [ ! -f "requirements.txt" ]; then echo "  ✗ requirements.txt missing"; else echo "  ✓ requirements.txt exists"; fi
	@if [ -d ".venv" ] && [ -f "$(ENV)" ]; then \
		$(PYTHON) -c "from app.core.config import get_settings; s=get_settings(); print('  ✓ Config OK — DB:', s.sqlite_db_path)" 2>/dev/null \
		|| echo "  ✗ Config load failed (check .env values)"; \
	fi
	@echo "→ Done"
