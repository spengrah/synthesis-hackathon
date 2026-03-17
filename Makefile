CONTRACTS_DIR := packages/contracts

-include $(CONTRACTS_DIR)/.env

FORK_BLOCK := 43454644
FORK_PORT  := 8545
ANVIL_PID  := $(CONTRACTS_DIR)/.anvil.pid
FOUNDRY_TOML := $(CONTRACTS_DIR)/foundry.toml

# ── Local Anvil fork ──────────────────────────────────────────────

.PHONY: c-fork c-fork-stop c-fork-status

c-fork: ## Start a persistent local Anvil fork of Base mainnet
	@if [ -f $(ANVIL_PID) ] && kill -0 $$(cat $(ANVIL_PID)) 2>/dev/null; then \
		echo "Anvil already running (pid $$(cat $(ANVIL_PID)))"; \
	else \
		echo "Starting Anvil fork (this may take a moment on first run)..."; \
		anvil \
			--fork-url "https://base-mainnet.g.alchemy.com/v2/$(ALCHEMY_API_KEY)" \
			--fork-block-number $(FORK_BLOCK) \
			--fork-retry-backoff 3000 \
			--port $(FORK_PORT) \
			--silent & \
		echo $$! > $(ANVIL_PID); \
		for i in 1 2 3 4 5 6 7 8 9 10; do \
			sleep 2; \
			if ! kill -0 $$(cat $(ANVIL_PID)) 2>/dev/null; then \
				echo "Anvil exited — likely RPC rate-limited. Wait a minute and retry."; \
				rm -f $(ANVIL_PID); exit 1; \
			fi; \
			if curl -sf http://localhost:$(FORK_PORT) -X POST -H "Content-Type: application/json" \
				-d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then \
				echo "Anvil fork running on :$(FORK_PORT) (pid $$(cat $(ANVIL_PID)))"; \
				break; \
			fi; \
			if [ $$i = 10 ]; then echo "Anvil did not become ready in time"; kill $$(cat $(ANVIL_PID)) 2>/dev/null; rm -f $(ANVIL_PID); exit 1; fi; \
		done; \
	fi
	@sed -i '' 's|^base = .* # managed by.*|base = "http://localhost:$(FORK_PORT)" # managed by `make c-fork`|' $(FOUNDRY_TOML)
	@echo "foundry.toml base RPC → localhost:$(FORK_PORT)"

c-fork-stop: ## Stop the local Anvil fork
	@if [ -f $(ANVIL_PID) ]; then \
		kill $$(cat $(ANVIL_PID)) 2>/dev/null || true; \
		rm -f $(ANVIL_PID); \
		echo "Anvil stopped"; \
	else \
		echo "No Anvil pid file found"; \
	fi
	@sed -i '' 's|^base = .* # managed by.*|base = "https://base-mainnet.g.alchemy.com/v2/$${ALCHEMY_API_KEY}" # managed by `make c-fork`|' $(FOUNDRY_TOML)
	@echo "foundry.toml base RPC → Alchemy"

c-fork-status: ## Check if local Anvil fork is running
	@if [ -f $(ANVIL_PID) ] && kill -0 $$(cat $(ANVIL_PID)) 2>/dev/null; then \
		echo "Anvil running (pid $$(cat $(ANVIL_PID)), port $(FORK_PORT))"; \
	else \
		echo "Anvil not running"; \
	fi

# ── Contract tests ────────────────────────────────────────────────

.PHONY: c-test c-test-unit c-test-fast c-test-ci

c-test: ## Run full contract test suite
	cd $(CONTRACTS_DIR) && forge test

c-test-unit: ## Run contract unit tests only (no integration/invariant)
	cd $(CONTRACTS_DIR) && forge test --match-path "test/unit/**"

c-test-fast: ## Run contract tests with minimal fuzz/invariant iterations
	cd $(CONTRACTS_DIR) && FOUNDRY_PROFILE=lite forge test

c-test-ci: ## Run contract tests with CI-level fuzz/invariant iterations
	cd $(CONTRACTS_DIR) && FOUNDRY_PROFILE=ci forge test

# ── SDK tests ─────────────────────────────────────────────────────

.PHONY: sdk-test sdk-build sdk-abis

sdk-test: ## Run SDK unit tests
	cd packages/sdk && pnpm test

sdk-build: ## Build SDK
	cd packages/sdk && pnpm run build

sdk-abis: ## Regenerate SDK ABIs from forge artifacts
	cd packages/sdk && pnpm run generate-abis

# ── Ponder tests ──────────────────────────────────────────────────

.PHONY: ponder-test ponder-codegen

ponder-test: ## Run Ponder utility tests
	cd packages/ponder && pnpm test

ponder-codegen: ## Regenerate Ponder schema types
	cd packages/ponder && pnpm run codegen

# ── Cross-package ─────────────────────────────────────────────────

.PHONY: test-all

test-all: c-test sdk-test ponder-test ## Run all tests across all packages

# ── Helpers ───────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
