# REST API Spec

```yaml
openapi: 3.0.0
info:
  title: Obfuscation-Aware Sanitizer Agent API
  version: 1.0.0
  description: API for sanitizing data in agentic AI systems
servers:
  - url: https://api.example.com
    description: Production server
paths:
  /sanitize:
    post:
      summary: Sanitize input data
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: string
      responses:
        '200':
          description: Sanitized data
          content:
            application/json:
              schema:
                type: object
                properties:
                  sanitizedData:
                    type: string
  /health:
    get:
      summary: Health check
      responses:
        '200':
          description: OK
```
