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
│   │   └── AuditLogger.js
│   ├── middleware/
│   │   └── destination-tracking.js
│   ├── models/
│   │   └── SanitizationEvent.js
│   ├── routes/
│   │   └── api.js
│   ├── utils/
│   │   └── helpers.js
│   ├── config/
│   │   └── index.js
│   ├── tests/
│   │   ├── unit/
│   │   │   └── middleware/
│   │   │     └── destination-tracking.test.js
│   │   └── integration/
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
