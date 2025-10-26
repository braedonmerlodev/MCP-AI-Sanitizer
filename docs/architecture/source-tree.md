# Source Tree

```
obfuscation-aware-sanitizer/
├── src/
│   ├── components/
│   │   ├── ProxySanitizer.js
│   │   ├── SanitizationPipeline.js
│   │   │   ├── UnicodeNormalization.js
│   │   │   ├── SymbolStripping.js
│   │   │   ├── EscapeNeutralization.js
│   │   │   └── PatternRedaction.js
│   │   ├── ProvenanceValidator.js
│   │   ├── AuditLogger.js
│   │   ├── DataIntegrityValidator.js
│   │   └── data-integrity/
│   │       ├── SchemaValidator.js
│   │       ├── ReferentialChecker.js
│   │       ├── CryptographicHasher.js
│   │       ├── ErrorRouter.js
│   │       └── AuditLogger.js
│   ├── middleware/
│   │   └── destination-tracking.js
│   ├── models/
│   │   ├── SanitizationEvent.js
│   │   ├── ValidationResult.js
│   │   ├── ErrorQueue.js
│   │   ├── AuditLog.js
│   │   └── HashReference.js
│   ├── routes/
│   │   └── api.js
│   ├── utils/
│   │   └── helpers.js
│   ├── config/
│   │   └── index.js
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── middleware/
│   │   │     └── destination-tracking.test.js
│   │   │   └── data-integrity.test.js
│   │   └── integration/
│   │       └── data-validation.test.js
│   └── app.js
├── infrastructure/
│   ├── azure-bicep/
│   │   └── main.bicep
├── docs/
│   ├── prd.md
│   └── architecture.md
├── package.json
└── Dockerfile
```
