# REST API Spec

````yaml
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
   /api/sanitize/json:
     post:
       summary: Sanitize JSON content with trust token generation
       requestBody:
         required: true
         content:
           application/json:
             schema:
               type: object
               required:
                 - content
               properties:
                 content:
                   type: string
                   description: The content to be sanitized
                 classification:
                   type: string
                   description: Optional classification for sanitization rules
       responses:
         '200':
           description: Successfully sanitized content
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   sanitizedContent:
                     type: string
                     description: The sanitized content
                   trustToken:
                     type: object
                     description: Cryptographic trust token for verification
                     properties:
                       contentHash:
                         type: string
                         description: SHA-256 hash of sanitized content
                       originalHash:
                         type: string
                         description: SHA-256 hash of original content
                       sanitizationVersion:
                         type: string
                         description: Version of sanitization rules applied
                       rulesApplied:
                         type: array
                         items:
                           type: string
                         description: List of sanitization rules applied
                       timestamp:
                         type: string
                         format: date-time
                         description: Token creation timestamp
                       expiresAt:
                         type: string
                         format: date-time
                         description: Token expiration timestamp
                       signature:
                         type: string
                         description: HMAC-SHA256 signature for verification
                   metadata:
                     type: object
                     properties:
                       originalLength:
                         type: integer
                       sanitizedLength:
                         type: integer
                       timestamp:
                         type: string
                         format: date-time
         '400':
           description: Invalid request - missing or invalid content field
         '500':
           description: Internal server error during sanitization
  /documents/upload:
    post:
      summary: Upload PDF documents for processing and sanitization
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                pdf:
                  type: string
                  format: binary
                  description: PDF file to upload
      responses:
        '200':
          description: PDF uploaded and processed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                  fileName:
                    type: string
                  size:
                    type: integer
                  status:
                    type: string
                  trustToken:
                    type: object
                    description: Cryptographic trust token for sanitized content
        '400':
          description: Invalid file or validation error
        '413':
          description: File too large
        '429':
          description: Rate limit exceeded
        '500':
          description: Internal server error
   /health:
     get:
       summary: Health check
       responses:
         '200':
           description: OK
    /api/trust-tokens/validate:
     post:
       summary: Validate a trust token for authenticity and expiration
       requestBody:
         required: true
         content:
           application/json:
             schema:
               type: object
               properties:
                 contentHash:
                   type: string
                   description: Hash of the sanitized content
                 originalHash:
                   type: string
                   description: Hash of the original content
                 sanitizationVersion:
                   type: string
                   description: Version of sanitization rules applied
                 rulesApplied:
                   type: array
                   items:
                     type: string
                   description: List of sanitization rules applied
                 timestamp:
                   type: string
                   description: Timestamp when token was created
                 expiresAt:
                   type: string
                   description: Expiration timestamp
                 signature:
                   type: string
                   description: Cryptographic signature
       responses:
         '200':
           description: Token is valid
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   valid:
                     type: boolean
                     example: true
                   message:
                     type: string
                     example: "Trust token is valid"
         '400':
           description: Invalid token data or expired token
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   valid:
                     type: boolean
                     example: false
                   error:
                     type: string
                     example: "Token has expired"
         '500':
           description: Internal server error
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
````

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

```
