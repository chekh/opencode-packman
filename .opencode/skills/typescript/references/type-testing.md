# Type Testing with Vitest

## Overview

Vitest allows testing types using `expectTypeOf` and `assertType` syntaxes. Type tests are statically analyzed by the compiler, not executed at runtime.

## Setup

### Installation

```bash
npm install -D vitest
```

### Configuration

```typescript
// vitest.config.ts
export default {
  test: {
    typecheck: {
      include: ['**/*.test-d.ts'],
    },
  },
}
```

### Running Type Tests

```bash
# Add to package.json scripts
{
  "scripts": {
    "test:types": "vitest --typecheck"
  }
}
```

---

## expectTypeOf API

### Basic Assertions

```typescript
import { expectTypeOf } from 'vitest'

test('my types work properly', () => {
  expectTypeOf(mount).toBeFunction()
  expectTypeOf(mount).parameter(0).toExtend<{ name: string }>()
})
```

### Type Matchers

```typescript
// Check if type is a function
expectTypeOf(fn).toBeFunction()

// Check if type is an array
expectTypeOf(arr).toBeArray()

// Check if type is a string
expectTypeOf(str).toBeString()

// Check if type is a number
expectTypeOf(num).toBeNumber()

// Check if type is void
expectTypeOf(voidFn).toBeVoid()

// Check if type is null
expectTypeOf(null).toBeNull()

// Check if type is undefined
expectTypeOf(undefined).toBeUndefined()

// Check if type is any
expectTypeOf(anyVal).toBeAny()

// Check if type is never
expectTypeOf(neverVal).toBeNever()

// Check if type is unknown
expectTypeOf(unknownVal).toBeUnknown()
```

### Equality Assertions

```typescript
// Exact type match
expectTypeOf(value).toEqualTypeOf<{ a: string }>()

// Extends/implements check
expectTypeOf(value).toExtend<{ a: string }>()

// Match type with type parameter
expectTypeOf<Avatar>().toHaveProperty('size')
expectTypeOf<Avatar['size']>().toEqualTypeOf<'sm' | 'md' | 'lg'>()
```

### Parameter & Return Types

```typescript
// Check parameter types
expectTypeOf(fn).parameter(0).toEqualTypeOf<string>()
expectTypeOf(fn).parameters.toEqualTypeOf<[string, number]>()

// Check return type
expectTypeOf(fn).returns.toEqualTypeOf<number>()

// Check constructor parameters
expectTypeOf(Class).constructorParameter(0).toEqualTypeOf<string>()
```

### Property Checks

```typescript
// Check object has property
expectTypeOf(obj).toHaveProperty('name')

// Check property type
expectTypeOf(obj).property('name').toEqualTypeOf<string>()

// Pick specific properties
expectTypeOf(obj).pick('name').toEqualTypeOf<{ name: string }>()

// Omit specific properties
expectTypeOf(obj).omit('id').toEqualTypeOf<{ name: string }>()
```

### Nullable Checks

```typescript
// Check if nullable
expectTypeOf(value).toBeNullable()

// Make nullable
expectTypeOf(value).toBeNullable()

// Extract non-null
expectTypeOf(value).not.toBeNull()
```

---

## assertType API

A simpler alternative for straightforward type checks:

```typescript
import { assertType } from 'vitest'

const answer = 42

assertType<number>(answer)

// @ts-expect-error answer is not a string
assertType<string>(answer)
```

### With @ts-expect-error

```typescript
// This passes because it expects an error
// @ts-expect-error answer is not a string
assertType<string>(answer)

// Caution: typos create false positives!
// @ts-expect-error
assertType<string>(answr)  // Typo in variable name - still passes!
```

To catch typos, include type files in `test.include` so Vitest runs them:

```typescript
// vitest.config.ts
export default {
  test: {
    include: ['**/*.test-d.ts'],  // Type tests
    typecheck: {
      include: ['**/*.test-d.ts'],
    },
  },
}
```

---

## Reading Type Errors

### expectTypeOf Error Messages

```typescript
expectTypeOf({ a: 1 }).toEqualTypeOf<{ a: string }>()
```

Error:
```
error TS2344: Type '{ a: string; }' does not satisfy the constraint
'{ a: \"Expected: string, Actual: number\"; }'.
  Types of property 'a' are incompatible.
    Type 'string' is not assignable to type '"Expected: string, Actual: number"'.
```

Look for: `Expected: string, Actual: number`

### toBe... Error Messages

```typescript
expectTypeOf(1).toBeString()
```

Error:
```
error TS2349: This expression is not callable.
  Type 'ExpectString<number>' has no call signatures.
```

The meaningful part: `Type 'ExpectString<number> has no call signatures` - you passed a number but asserted string.

---

## Best Practices

### Typearg vs Concrete Values

Prefer typearg syntax for better error messages:

```typescript
// Better error messages
expectTypeOf({ a: 1 }).toEqualTypeOf<{ a: string }>()

// Less helpful errors
expectTypeOf({ a: 1 }).toEqualTypeOf({ a: '' })
```

### Comparing Two Concrete Types

```typescript
const one = valueFromFunctionOne({ some: { complex: inputs } })
const two = valueFromFunctionTwo({ some: { other: inputs } })

// Use typeof
expectTypeOf(one).toEqualTypeOf<typeof two>()
```

### When to Test Types

- Publishing libraries
- Complex generic functions
- Type-level utilities
- API contracts
- Branded types
- Conditional types

### Test File Convention

```typescript
// avatar.test-d.ts
// The -d.ts suffix indicates type tests

import { expectTypeOf } from 'vitest'
import type { Avatar } from './avatar'

describe('Avatar types', () => {
  test('has required properties', () => {
    expectTypeOf<Avatar>().toHaveProperty('size')
    expectTypeOf<Avatar>().toHaveProperty('src')
  })

  test('size is literal union', () => {
    expectTypeOf<Avatar['size']>().toEqualTypeOf<'sm' | 'md' | 'lg'>()
  })

  test('optional properties', () => {
    expectTypeOf<Avatar>().property('alt').toBeNullable()
  })
})
```

---

## Alternative: tsd

For standalone type testing without Vitest:

```bash
npm install -D tsd
```

```typescript
// test/index.test-d.ts
import { expectType } from 'tsd'
import type { MyType } from '../src'

expectType<MyType>({ ... })
```

```json
// package.json
{
  "scripts": {
    "test:types": "tsd"
  }
}
```

---

## CI Integration

```yaml
# GitHub Actions
- name: Type Tests
  run: npm run test:types

# Or as part of main test
- name: Tests
  run: npm test -- --typecheck
```

---

## Quick Reference

| Matcher | Description |
|---------|-------------|
| `toEqualTypeOf<T>()` | Exact type match |
| `toExtend<T>()` | Type extends T |
| `toBeFunction()` | Is function type |
| `toBeArray()` | Is array type |
| `toBeString()` | Is string type |
| `toBeNumber()` | Is number type |
| `toBeNull()` | Is null type |
| `toBeUndefined()` | Is undefined type |
| `toBeAny()` | Is any type |
| `toBeNever()` | Is never type |
| `toBeNullable()` | Is nullable |
| `toHaveProperty('x')` | Has property x |
| `parameter(n)` | Get nth parameter type |
| `returns` | Get return type |
| `pick('x')` | Pick property x |
| `omit('x')` | Omit property x |
