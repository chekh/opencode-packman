# TypeScript Declaration Files

## Overview

Declaration files (`.d.ts`) describe the shape of JavaScript code without containing implementations. They enable TypeScript to understand JavaScript libraries.

## When You Need Declaration Files

1. Publishing a TypeScript library
2. Adding types to an untyped JavaScript library
3. Declaring ambient types (globals, modules)

---

## Quick Start

### For an NPM Package Without Types

```typescript
// types/some-untyped-package/index.d.ts
declare module 'some-untyped-package' {
  export function doSomething(input: string): number;
  export const version: string;
  export default class MyClass {
    constructor(options: { debug?: boolean });
    run(): Promise<void>;
  }
}
```

### For Your Own Library

```typescript
// dist/index.d.ts
export interface User {
  id: string;
  name: string;
}

export function getUser(id: string): Promise<User>;
export function createUser(data: Omit<User, 'id'>): Promise<User>;
```

---

## Declaration File Templates

### Global Variable

```typescript
// global.d.ts
declare const MY_GLOBAL: {
  version: string;
  config: {
    apiUrl: string;
    timeout: number;
  };
};
```

### Global Function

```typescript
declare function myGlobalFunction(input: string): number;
```

### UMD Module

```typescript
declare module 'my-library' {
  export function init(config: Config): void;
  export interface Config {
    apiKey: string;
  }
}
```

### ES6 Module

```typescript
declare module 'my-library' {
  export function init(config: Config): void;
  export interface Config {
    apiKey: string;
  }
}
```

### CommonJS Module

```typescript
declare module 'my-library' {
  export = MyModule;
}

declare namespace MyModule {
  function init(config: Config): void;
  interface Config {
    apiKey: string;
  }
}
```

---

## Common Patterns

### Callable/Constructable

```typescript
// Can be called as function AND with new
declare const MyFactory: {
  (input: string): MyInstance;
  new (input: string): MyInstance;
};

interface MyInstance {
  value: string;
}
```

### Function Overloads

```typescript
declare function createElement(tag: 'div'): HTMLDivElement;
declare function createElement(tag: 'span'): HTMLSpanElement;
declare function createElement(tag: string): HTMLElement;
```

### Merged Declarations

```typescript
// Class + namespace merging
declare class Observable<T> {
  subscribe(observer: Observer<T>): Subscription;
}

declare namespace Observable {
  function of<T>(...values: T[]): Observable<T>;
  function from<T>(input: Iterable<T>): Observable<T>;
}
```

### Optional Properties

```typescript
interface Options {
  required: string;
  optional?: number;
  optionalOrNull: string | null;
}
```

### Readonly Properties

```typescript
interface Config {
  readonly apiKey: string;
  readonly endpoints: readonly string[];
}
```

---

## Module Augmentation

### Extending Existing Modules

```typescript
// Extend Express Request
declare module 'express' {
  interface Request {
    user?: {
      id: string;
      role: string;
    };
  }
}
```

### Extending Global Objects

```typescript
declare global {
  interface Array<T> {
    first(): T | undefined;
    last(): T | undefined;
  }
}
```

### Extending Window

```typescript
declare global {
  interface Window {
    myCustomProperty: {
      version: string;
    };
  }
}
```

---

## Triple-Slash Directives

### Reference Other Declaration Files

```typescript
/// <reference path="./types.d.ts" />
/// <reference types="node" />
/// <reference lib="es2020" />
```

### When to Use

- When splitting declarations across files
- When depending on types from another package
- When targeting specific lib versions

---

## Publishing Types

### With Your Package

```json
// package.json
{
  "name": "my-library",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

### To DefinitelyTyped

For libraries without built-in types:

1. Fork https://github.com/DefinitelyTyped/DefinitelyTyped
2. Create `types/your-library/`
3. Add `index.d.ts`, `tsconfig.json`, `YOUR_LIBRARY-tests.ts`

```json
// types/your-library/tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "lib": ["es6"],
    "strict": true,
    "types": []
  },
  "files": ["index.d.ts", "YOUR_LIBRARY-tests.ts"]
}
```

---

## Do's and Don'ts

### Do

- Use `export` for ES6 module exports
- Use `interface` for object shapes (better errors)
- Document complex types with JSDoc
- Test your declarations

### Don't

- Don't use `any` - use `unknown` if type is truly unknown
- Don't duplicate declarations
- Don't create overly specific types
- Don't forget to handle `undefined`/`null`

---

## Testing Declarations

Create test files to verify your declarations work:

```typescript
// test/types.ts
import { getUser, User } from 'my-library';

// Should compile without errors
const user: User = await getUser('123');

// @ts-expect-error - should fail
const wrong: string = await getUser('123');
```

Or use Vitest type testing:

```typescript
// types.test-d.ts
import { expectTypeOf } from 'vitest';
import type { User } from 'my-library';

test('User type is correct', () => {
  expectTypeOf<User>().toHaveProperty('id');
  expectTypeOf<User['id']>().toEqualTypeOf<string>();
});
```

---

## Common Errors

### "Cannot find module 'X'"

Add declaration file or install `@types/X`:

```bash
npm install -D @types/library-name
```

### "Cannot find name 'Y'"

Declare the global:

```typescript
declare const Y: { ... };
```

### "Could not find a declaration file for module 'Z'"

Create ambient declaration:

```typescript
declare module 'z' {
  // minimal type info
}
```

---

## Resources

- [TypeScript Declaration Files Guide](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html)
- [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)
- [TypeScript Deep Dive - Declaration Files](https://basarat.gitbook.io/typescript/type-system/intro/d.ts)
