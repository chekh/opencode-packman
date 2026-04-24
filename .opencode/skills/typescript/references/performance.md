# TypeScript Performance Optimization

## Table of Contents
1. [Diagnosing Performance Issues](#diagnosing-performance-issues)
2. [Compiler Options](#compiler-options)
3. [Type-Level Optimizations](#type-level-optimizations)
4. [Project Structure](#project-structure)
5. [Monorepo Performance](#monorepo-performance)
6. [IDE/Language Server](#idelanguage-server)

---

## Diagnosing Performance Issues

### Extended Diagnostics

```bash
# Get detailed timing information
npx tsc --extendedDiagnostics --incremental false
```

Key metrics to watch:
- **Type count**: High counts indicate complex types
- **Check time**: Total type checking time
- **Files/Lines/Nodes**: Project size indicators

### Generate Trace

```bash
# Generate detailed trace
npx tsc --generateTrace trace --incremental false

# Analyze trace (requires @typescript/analyze-trace)
npx @typescript/analyze-trace trace
```

The trace shows which types take longest to check.

### Memory Analysis

```bash
# Increase memory limit if needed
node --max-old-space-size=8192 node_modules/typescript/lib/tsc.js
```

---

## Compiler Options

### Performance-Focused Configuration

```json
{
  "compilerOptions": {
    // Skip checking library types (often biggest win)
    "skipLibCheck": true,

    // Enable incremental compilation
    "incremental": true,

    // Limit what's checked
    "include": ["src/**/*"],
    "exclude": ["node_modules", "**/*.test.ts", "**/__tests__/**"]
  }
}
```

### skipLibCheck Trade-offs

**Pros:**
- Often significantly improves performance on large projects
- Reduces type checking overhead for dependencies

**Cons:**
- May mask app typing issues in poorly-typed libraries
- Doesn't catch errors in .d.ts files

**When to use:** Large projects with well-typed dependencies.

### Incremental Compilation

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

- Caches type information between runs
- `.tsbuildinfo` file stores cached state
- Add `.tsbuildinfo` to `.gitignore`

---

## Type-Level Optimizations

### Simplify Complex Types

**Bad: Complex intersections**
```typescript
type Bad = TypeA & TypeB & TypeC & TypeD & TypeE;
```

**Good: Use interfaces**
```typescript
interface Good extends TypeA, TypeB, TypeC, TypeD, TypeE {}
```

Interfaces are more efficient for the compiler.

### Split Large Union Types

```typescript
// Bad: Large union
type Large = 'a' | 'b' | ... | 'z' | 'aa' | ...; // 100+ members

// Good: Split into categories
type LettersAtoM = 'a' | 'b' | ... | 'm';
type LettersNtoZ = 'n' | 'o' | ... | 'z';
type Large = LettersAtoM | LettersNtoZ | OtherTypes;
```

### Avoid Circular Generic Constraints

```typescript
// Bad: Circular constraint
type Bad<T extends Bad<T>> = { value: T };

// Good: Break the cycle
interface Base {
  value: Base;
}
type Good<T extends Base> = T;
```

### Use Type Aliases for Recursion Breaks

```typescript
// Type alias acts as a checkpoint
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// For very deep nesting, add depth limit
type DeepPartial<T, D extends number = 10> = D extends 0
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K], [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9][D]> }
    : T;
```

---

## Project Structure

### Precise Include/Exclude

```json
{
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/__tests__/**",
    "**/__mocks__/**",
    "dist",
    "coverage"
  ]
}
```

### Project References

Split large projects into smaller, independently-type-checked units:

```json
// tsconfig.json (root)
{
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/ui" },
    { "path": "./apps/web" }
  ],
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true
  }
}

// packages/core/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

Benefits:
- Only rebuild changed projects
- Better caching
- Parallel type checking possible

---

## Monorepo Performance

### Nx vs Turborepo

| Feature | Nx | Turborepo |
|---------|-----|-----------|
| Best for | Complex dependencies, >50 packages | Simple structure, <20 packages |
| Caching | Advanced | Good |
| Visualization | Yes | No |
| Plugins | Rich ecosystem | Minimal |
| Performance | Better on large repos | Simpler setup |

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### TypeScript Monorepo Best Practices

1. **Use project references** - Enables incremental builds
2. **Shared tsconfig base** - DRY configuration
3. **Explicit package boundaries** - Clear dependencies
4. **Avoid barrel exports** - They break tree-shaking

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "incremental": true,
    "composite": true
  }
}

// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

---

## IDE/Language Server

### Exclude Heavy Directories

```json
{
  "typescript": {
    "tsserver": {
      "watchOptions": {
        "excludeDirectories": ["**/node_modules", "**/dist", "**/.git"]
      }
    }
  }
}
```

### VS Code Settings

```json
{
  "typescript.tsserver.maxTsServerMemory": 8192,
  "typescript.tsserver.watchOptions": {
    "watchFile": "useFsEvents",
    "watchDirectory": "useFsEvents",
    "synchronousWatchDirectory": true
  }
}
```

### Disable Specific Features

For very large projects, consider disabling:

```json
{
  "typescript.tsserver.experimental.enableProjectDiagnostics": false,
  "javascript.suggestionActions.enabled": false
}
```

---

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Slow type checking | `skipLibCheck`, `incremental`, project references |
| Slow builds | Check bundler config, enable caching |
| Slow tests | Vitest with threads, avoid type checking in tests |
| Slow language server | Exclude node_modules, limit files in tsconfig |
| "Type instantiation too deep" | Limit recursion, use interfaces over type intersections |
| "Excessive stack depth" | Simplify generic constraints, break circular types |

---

## Performance Checklist

- [ ] `skipLibCheck: true` enabled
- [ ] `incremental: true` with .tsbuildinfo
- [ ] `include`/`exclude` precisely configured
- [ ] Project references for monorepos
- [ ] No excessive type intersections (use interfaces)
- [ ] Large union types split into categories
- [ ] No circular generic constraints
- [ ] IDE excludes heavy directories
- [ ] Memory limit increased if needed
