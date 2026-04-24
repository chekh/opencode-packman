# Advanced Type Patterns

## Table of Contents
1. [Branded Types](#branded-types)
2. [Conditional Types](#conditional-types)
3. [Template Literal Types](#template-literal-types)
4. [Type Inference Techniques](#type-inference-techniques)
5. [Mapped Types](#mapped-types)
6. [Utility Types](#utility-types)

---

## Branded Types

Branded types create nominal types from primitives, preventing accidental mixing of domain concepts.

### Basic Implementation

```typescript
type Brand<K, T> = K & { __brand: T };
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

// Prevents accidental mixing
function processOrder(orderId: OrderId, userId: UserId) { }
// processOrder(userId, orderId) // Error!
```

### Strong Implementation

Use `unique symbol` to prevent brand collision:

```typescript
declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;
```

### Use Cases

**Domain Modeling:**
```typescript
type EmailAddress = Branded<string, 'EmailAddress'>;
type PhoneNumber = Branded<string, 'PhoneNumber'>;

function validateEmail(email: string): EmailAddress {
  if (!email.includes('@')) throw new Error('Invalid email');
  return email as EmailAddress;
}
```

**API Boundaries:**
```typescript
type ApiSuccess<T> = T & { __apiSuccessBrand: true };
type ApiFailure = {
  code: number;
  message: string;
} & { __apiFailureBrand: true };

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

---

## Conditional Types

Conditional types let you express type-level logic.

### Basic Conditional Types

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false
```

### Recursive Type Manipulation

```typescript
type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

type DeepRequired<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { [K in keyof T]-?: DeepRequired<T[K]> }
    : T;
```

### Distributive Conditional Types

```typescript
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>; // string[] | number[]
```

### Limiting Recursion Depth

Avoid "Type instantiation is excessively deep" errors:

```typescript
// Bad: Infinite recursion
type InfiniteArray<T> = T | InfiniteArray<T>[];

// Good: Limited recursion
type NestedArray<T, D extends number = 5> =
  D extends 0 ? T : T | NestedArray<T, [-1, 0, 1, 2, 3, 4][D]>[];
```

---

## Template Literal Types

Template literal types enable string manipulation at the type level.

### Basic Patterns

```typescript
type World = 'world';
type Greeting = `hello ${World}`; // "hello world"
```

### Event Systems

```typescript
type PropEventSource<Type> = {
  on<Key extends string & keyof Type>(
    eventName: `${Key}Changed`,
    callback: (newValue: Type[Key]) => void
  ): void;
};

interface User {
  name: string;
  age: number;
}

declare const userEvents: PropEventSource<User>;
userEvents.on('nameChanged', (name) => {}); // name: string
userEvents.on('ageChanged', (age) => {});   // age: number
```

### String Utilities

```typescript
type Split<S extends string, D extends string> =
  S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];

type Join<T extends string[], D extends string> =
  T extends [infer F extends string, ...infer R extends string[]]
    ? R extends [] ? F : `${F}${D}${Join<R, D>}`
    : '';

type Words = Split<'hello world', ' '>; // ['hello', 'world']
type Joined = Join<['a', 'b', 'c'], '-'>; // 'a-b-c'
```

### Case Conversion

```typescript
type CamelCase<S extends string> =
  S extends `${infer T}_${infer U}` ? `${T}${Capitalize<CamelCase<U>>}` : S;

type SnakeCase<S extends string> =
  S extends `${infer T}${infer U}` ?
    T extends Uppercase<T> ?
      `${Lowercase<T>}${SnakeCase<U>}` :
      `_${Lowercase<T>}${SnakeCase<U>}` :
    S;
```

---

## Type Inference Techniques

### The `satisfies` Operator (TS 5.0+)

Validates constraints while preserving literal types:

```typescript
const config = {
  api: "https://api.example.com",
  timeout: 5000
} satisfies Record<string, string | number>;
// Preserves { api: string, timeout: number } while ensuring constraints
```

### Const Assertions

Lock down types to their literal values:

```typescript
const routes = ['/home', '/about', '/contact'] as const;
type Route = typeof routes[number]; // '/home' | '/about' | '/contact'

const obj = { x: 10, y: 20 } as const;
type Point = typeof obj; // { readonly x: 10; readonly y: 20 }
```

### Infer Keyword

Extract types from complex structures:

```typescript
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type Result = GetReturnType<() => string>; // string

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type Unwrapped = UnwrapPromise<Promise<number>>; // number
```

### Type Guards & Predicates

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

// Usage with type narrowing
if (isString(value)) {
  // value is string here
}
```

---

## Mapped Types

### Object Transformations

```typescript
type Getter<T> = {
  [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getter<Person>;
// { getName: () => string; getAge: () => number }
```

### Key Remapping

```typescript
type RemoveNull<T> = {
  [K in keyof T as T[K] extends null ? never : K]: T[K];
};

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T];
```

### Property Modifiers

```typescript
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type ReadonlyDeep<T> = {
  readonly [K in keyof T]: T[K] extends object ? ReadonlyDeep<T[K]> : T[K];
};
```

---

## Utility Types

### Common Patterns

```typescript
// Pick by value type
type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// Omit by value type
type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

// Required keys only
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

// Merge types (second overrides first)
type Merge<T, U> = Omit<T, keyof U> & U;
```

### Function Utilities

```typescript
// Get parameters as tuple
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

// Get return type
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Get constructor parameters
type ConstructorParameters<T> = T extends new (...args: infer P) => any ? P : never;

// Get instance type
type InstanceType<T> = T extends new (...args: any[]) => infer R ? R : any;
```

---

## Best Practices

1. **Prefer `interface` over `type` for object shapes** - better error messages
2. **Use const assertions for literal types** - preserves specificity
3. **Leverage type guards and predicates** - runtime + compile-time safety
4. **Avoid type gymnastics when simpler solution exists** - readability first
5. **Document complex types** - help future maintainers (and AI)
6. **Limit recursion depth** - prevent compiler errors
