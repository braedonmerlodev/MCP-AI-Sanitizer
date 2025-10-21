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
   /webhook/n8n:
     post:
       summary: Handle n8n webhook with automatic sanitization
       requestBody:
         required: true
         content:
           application/json:
             schema:
               type: object
               properties:
                 data:
                   type: string
                   description: The input data from n8n to be sanitized and processed
       responses:
         '200':
           description: Processed response
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   result:
                     type: string
                     description: The sanitized and processed result
         '400':
           description: Invalid request payload
         '500':
           description: Internal server error

## n8n Integration Examples

### Webhook Payload Format

```json
{
  "data": "User input text that may contain obfuscated content"
}
```

### Response Format

```json
{
  "result": "Sanitized and processed response from LLM/MCP"
}
```

### Example n8n Workflow

1. n8n Webhook node triggers on external event
2. Send POST request to `/api/webhook/n8n` with payload containing user data
3. The API automatically sanitizes input, forwards to LLM, sanitizes output
4. n8n receives the result and continues the workflow
```
