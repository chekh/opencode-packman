# TypeScript Tooling Ecosystem

## Overview

This reference covers the modern TypeScript tooling landscape for linting, formatting, testing, and building.

---

## Linting & Formatting

### Biome

Fast all-in-one toolchain for linting and formatting.

**When to use:**
- Speed is critical (often 10-35x faster than ESLint/Prettier)
- Want single tool for lint + format
- TypeScript-first project
- Okay with fewer rules than typescript-eslint

**Setup:**
```bash
npm install -D --save-exact @biomejs/biome
npx @biomejs/biome init
```

**Configuration:**
```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExtraBooleanCast": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  }
}
```

**Commands:**
```bash
# Check (lint + format check)
npx @biomejs/biome check ./src

# Fix issues
npx @biomejs/biome check --write ./src

# Format only
npx @biomejs/biome format --write ./src

# Lint only
npx @biomejs/biome lint ./src
```

**Limitations:**
- 64 TypeScript rules vs 100+ in typescript-eslint
- No type-aware linting yet
- Limited Vue/Angular support

### ESLint + typescript-eslint

Industry standard with comprehensive rule set.

**When to use:**
- Need specific rules/plugins
- Have complex custom rules
- Working with Vue/Angular
- Need type-aware linting

**Setup:**
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Configuration:**
```javascript
// eslint.config.js
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
];
```

**Type-aware rules (require project reference):**
- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/no-misused-promises`
- `@typescript-eslint/require-await`
- `@typescript-eslint/no-unnecessary-condition`

### Comparison Table

| Feature | Biome | ESLint |
|---------|-------|--------|
| Speed | Very fast | Slower |
| TS rules | 64 | 100+ |
| Type-aware | No | Yes |
| Plugins | Limited | Rich ecosystem |
| Vue/Angular | Limited | Full support |
| Config | Simple | Complex |

---

## Testing

### Vitest

Fast, Vite-native test framework with built-in type testing.

**Setup:**
```bash
npm install -D vitest
```

**Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    typecheck: {
      include: ['**/*.test-d.ts'],
    },
  },
});
```

**Type Testing:**
```typescript
// types.test-d.ts
import { expectTypeOf } from 'vitest';

test('types', () => {
  expectTypeOf<string>().toBeString();
});
```

See `type-testing.md` for full details.

### Jest

Industry standard test framework.

**Setup with TypeScript:**
```bash
npm install -D jest ts-jest @types/jest
npx ts-jest config:init
```

**Configuration:**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/*.test.ts'],
};
```

---

## Build Tools

### tsx

Fast TypeScript execution and REPL.

```bash
# Run TypeScript directly
npx tsx src/index.ts

# Watch mode
npx tsx watch src/index.ts

# REPL
npx tsx
```

### ts-node

TypeScript execution for Node.js.

```bash
# Run TypeScript
npx ts-node src/index.ts

# With ESM
npx ts-node --esm src/index.ts

# With tsconfig-paths
npx ts-node -r tsconfig-paths/register src/index.ts
```

### SWC

Fast TypeScript/JavaScript compiler.

```bash
npm install -D @swc/cli @swc/core
npx swc src -d dist
```

---

## Monorepo Tools

### Turborepo

Simple, fast monorepo build system.

**When to use:**
- Simple structure
- Need speed
- <20 packages

**Setup:**
```bash
npm install -D turbo
```

**Configuration:**
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

### Nx

Advanced monorepo tool with visualization.

**When to use:**
- Complex dependencies
- Need visualization
- >50 packages
- Plugins required

**Setup:**
```bash
npm install -D nx
```

**Configuration:**
```json
// nx.json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

### Comparison

| Feature | Turborepo | Nx |
|---------|-----------|-----|
| Setup | Simple | More config |
| Caching | Good | Advanced |
| Visualization | No | Yes |
| Plugins | Minimal | Rich |
| Best for | <20 packages | >50 packages |

---

## Migration Tools

### ts-migrate

Airbnb's toolkit for JS→TS migration.

```bash
npx ts-migrate migrate . --sources 'src/**/*.js'
```

### typesync

Install missing @types packages.

```bash
npx typesync
```

### TypeStat

Auto-fix TypeScript types.

```bash
npm install -D typestat
npx typestat
```

---

## Development Tools

### tsc-watch

TypeScript compiler with watch mode and success/failure hooks.

```bash
npm install -D tsc-watch
tsc-watch --onSuccess "node dist/index.js"
```

### tsconfig-paths

Load tsconfig paths at runtime.

```bash
npm install -D tsconfig-paths

# Node.js
node -r tsconfig-paths/register src/index.ts

# ts-node
ts-node -r tsconfig-paths/register src/index.ts
```

---

## Quick Decision Guide

| Need | Tool |
|------|------|
| Fast linting/formatting | Biome |
| Comprehensive linting | ESLint + typescript-eslint |
| Fast testing | Vitest |
| Type testing | Vitest |
| Monorepo (<20 pkgs) | Turborepo |
| Monorepo (>50 pkgs) | Nx |
| Run TS directly | tsx |
| JS→TS migration | ts-migrate |
| Missing @types | typesync |
