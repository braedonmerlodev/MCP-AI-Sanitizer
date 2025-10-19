# Coding Standards

## Core Standards

- **Languages & Runtimes:** Node.js 20.11.0
- **Style & Linting:** ESLint with standard config
- **Test Organization:** Tests in **tests** folder, named \*.test.js

## Naming Conventions

| Element   | Convention       | Example              |
| --------- | ---------------- | -------------------- |
| Variables | camelCase        | sanitizedData        |
| Functions | camelCase        | normalizeUnicode     |
| Classes   | PascalCase       | SanitizationPipeline |
| Constants | UPPER_SNAKE_CASE | MAX_RETRY_ATTEMPTS   |

## Critical Rules

- **No console.log in production:** Use Winston logger for all output
- **All API responses must use ApiResponse wrapper:** Standardize response format
- **Database queries must use repository pattern:** Never direct SQLite access

## Language-Specific Guidelines

### Node.js Specifics

- **Async/Await:** Use for all async operations, avoid callbacks
- **Error Handling:** Always catch and log errors in async functions
