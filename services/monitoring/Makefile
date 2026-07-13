# services/monitoring/Makefile — per-service entry points for the observability stack (ADR 0028 Phase 2).
#
# Usage:
#   make -C services/monitoring up         # prometheus + grafana + blackbox
#   make -C services/monitoring down       # stop (preserve persistent volumes)
#   make -C services/monitoring logging-up # ES + Kibana + Filebeat (heavy)
#   make -C services/monitoring logs       # tail the observability stack

REPO_ROOT := $(abspath ..)/..

.PHONY: help up down up-volumes logging-up logging-down logs render-prometheus verify

help:
	@echo "services/monitoring/Makefile — observability stack control"
	@echo ""
	@echo "  make up                Bring up prometheus + grafana + blackbox"
	@echo "  make down              Stop (preserve volumes)"
	@echo "  make logging-up        Bring up ES + Kibana + Filebeat (heavy ~2 GiB RAM)"
	@echo "  make logging-down      Stop the logging stack"
	@echo "  make logs              Tail observability stack logs"
	@echo "  make render-prometheus Render prometheus.tpl.yml → prometheus.yml (from root env)"

up:
	@docker compose -f docker-compose.observability.yml up -d
	@echo "✓ Observability up — prom :9090  ·  grafana :3010  ·  blackbox :9115"

down:
	@docker compose -f docker-compose.observability.yml down

up-volumes:
	@docker compose -f docker-compose.observability.yml down -v

logging-up:
	@docker compose -f docker-compose.logging.yml up -d
	@echo "✓ Logging stack up — ES :9200  ·  Kibana :5601"

logging-down:
	@docker compose -f docker-compose.logging.yml down

logs:
	@docker compose -f docker-compose.observability.yml logs -f --tail=100

# Re-render prometheus.tpl.yml → prometheus.yml using current root env values.
render-prometheus:
	@$(MAKE) -C $(REPO_ROOT) render-prometheus 2>/dev/null || \
	  $(REPO_ROOT)/.venv/bin/python $(REPO_ROOT)/tools/monitoring/render_prometheus_config.py

# verify — smoke-test the observability stack without bringing it up.
# Parses both compose files (observability + logging) so a broken bind-mount
# or YAML typo fails fast in CI without needing a Docker daemon spin.
verify:
	@printf "\033[36m== MONITORING VERIFY: START ==\033[0m\n"
	@printf "  i [1/2] docker compose config — observability\n"
	@docker compose -f docker-compose.observability.yml config --quiet
	@printf "  i [2/2] docker compose config — logging\n"
	@docker compose -f docker-compose.logging.yml config --quiet
	@printf "\033[32m== MONITORING VERIFY: SUCCESS ==\033[0m\n"
