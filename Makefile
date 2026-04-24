SHELL := /bin/bash

REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
CLI_DEV := pnpm --dir "$(REPO_ROOT)" --filter @opencode-packman/cli dev --

PROJECT_DIR ?= .
PACKAGE_REF ?= $(REPO_ROOT)/examples/packages/backend-review
TMP_PATTERNS := /tmp/opm-* /tmp/test-opencode-project /tmp/opm-resource-test

.PHONY: help install build test lint typecheck smoke check ensure-core opm version init preview preview-isolated install-package doctor remove-package tmp-project clean-tmp clean

help:
	@printf "opencode-packman developer commands\n\n"
	@printf "  make install                     # install dependencies\n"
	@printf "  make build|test|lint|typecheck|smoke  # project checks\n"
	@printf "  make check                       # build + test + lint + typecheck\n"
	@printf "  make version                     # local dev CLI version\n"
	@printf "  make opm ARGS=\"<args>\"          # run local CLI without global install\n"
	@printf "  make init PROJECT_DIR=/path      # opm init in target project\n"
	@printf "  make preview PROJECT_DIR=/path [PACKAGE_REF=...]\n"
	@printf "  make preview-isolated [PACKAGE_REF=...]  # init+preview in temporary project\n"
	@printf "  make install-package PROJECT_DIR=/path [PACKAGE_REF=...]\n"
	@printf "  make doctor PROJECT_DIR=/path\n"
	@printf "  make remove-package PROJECT_DIR=/path PACKAGE_NAME=backend-review\n"
	@printf "  make tmp-project                 # create temporary project dir in /tmp\n"
	@printf "  make clean-tmp                   # remove known /tmp opm directories\n"
	@printf "  make clean                       # remove build/test artifacts in repo\n"

install:
	pnpm install

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

smoke:
	pnpm smoke

check: build test lint typecheck

ensure-core:
	@pnpm --dir "$(REPO_ROOT)" --filter @opencode-packman/core build >/dev/null

version:
	@$(MAKE) --no-print-directory ensure-core
	@$(CLI_DEV) --version

opm:
	@if [ -z "$(ARGS)" ]; then \
		echo "Usage: make opm ARGS=\"<args>\" [PROJECT_DIR=/path]"; \
		exit 1; \
	fi
	@$(MAKE) --no-print-directory ensure-core
	@cd "$(PROJECT_DIR)" && $(CLI_DEV) $(ARGS)

init:
	@$(MAKE) --no-print-directory ensure-core
	@cd "$(PROJECT_DIR)" && $(CLI_DEV) init

preview:
	@$(MAKE) --no-print-directory ensure-core
	@cd "$(PROJECT_DIR)" && $(CLI_DEV) preview "$(PACKAGE_REF)"

preview-isolated:
	@$(MAKE) --no-print-directory ensure-core
	@tmp_project="$$(mktemp -d "/tmp/opm-preview-XXXXXX")"; \
	trap 'rm -rf "$$tmp_project"' EXIT; \
	echo "[preview-isolated] project: $$tmp_project"; \
	cd "$$tmp_project"; \
	$(CLI_DEV) init; \
	$(CLI_DEV) preview "$(PACKAGE_REF)"

install-package:
	@$(MAKE) --no-print-directory ensure-core
	@cd "$(PROJECT_DIR)" && $(CLI_DEV) install "$(PACKAGE_REF)" --yes

doctor:
	@$(MAKE) --no-print-directory ensure-core
	@cd "$(PROJECT_DIR)" && $(CLI_DEV) doctor

remove-package:
	@if [ -z "$(PACKAGE_NAME)" ]; then \
		echo "Usage: make remove-package PROJECT_DIR=/path PACKAGE_NAME=<name>"; \
		exit 1; \
	fi
	@$(MAKE) --no-print-directory ensure-core
	@cd "$(PROJECT_DIR)" && $(CLI_DEV) remove "$(PACKAGE_NAME)" --yes

tmp-project:
	@mktemp -d "/tmp/opm-project-XXXXXX"

clean-tmp:
	@set -eu; \
	for pattern in $(TMP_PATTERNS); do \
		for target in $$pattern; do \
			case "$$target" in \
				/tmp/opm-*|/tmp/test-opencode-project|/tmp/opm-resource-test) ;; \
				*) continue ;; \
			esac; \
			if [ -e "$$target" ]; then \
				echo "remove $$target"; \
				rm -rf "$$target"; \
			fi; \
		done; \
	done

clean:
	rm -rf apps/cli/dist packages/core/dist coverage .vitest vitest-coverage
