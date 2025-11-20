# JSONTransformer API Documentation

## Overview

The JSONTransformer API provides advanced data transformation capabilities through the `/api/sanitize/json` endpoint. This document details the expanded `transformOptions` parameter and how to use the enhanced transformation features.

## Endpoint

```
POST /api/sanitize/json
```

## Request Format

```json
{
  "data": {
    "field1": "value1",
    "field2": "value2",
    "nested": {
      "field3": "value3"
    }
  },
  "transformOptions": {
    "filters": [
      {
        "pattern": "pattern_to_match",
        "type": "exclude"
      }
    ],
    "coercion": {
      "field_name": "target_type"
    },
    "preset": "preset_name"
  }
}
```

## Response Format

```json
{
  "transformed": {
    "transformed_field1": "transformed_value1",
    "transformed_field2": "transformed_value2"
  }
}
```

## Transform Options

### filters

Array of filter objects to remove fields from the data.

**Type**: `Array<Object>`

**Object Structure**:

```json
{
  "pattern": "string_or_regex",
  "type": "exclude"
}
```

**Examples**:

```json
// Remove exact field name
{
  "filters": [
    {"pattern": "password", "type": "exclude"}
  ]
}

// Remove fields matching regex
{
  "filters": [
    {"pattern": "/.*_temp$/", "type": "exclude"}
  ]
}

// Multiple filters
{
  "filters": [
    {"pattern": "password", "type": "exclude"},
    {"pattern": "/^_/", "type": "exclude"},
    {"pattern": "cache", "type": "exclude"}
  ]
}
```

### coercion

Object mapping field names to target data types for type coercion.

**Type**: `Object<string, string>`

**Supported Types**:

- `"number"`: Converts to numeric values
- `"boolean"`: Converts to boolean values
- `"date"`: Converts to ISO date strings
- `"string"`: Converts to string values

**Examples**:

```json
{
  "coercion": {
    "age": "number",
    "active": "boolean",
    "created_at": "date",
    "user_id": "string"
  }
}
```

### preset

Name of a predefined transformation preset to apply.

**Type**: `string`

**Available Presets**:

- `"aiProcessing"`: Optimizes data for AI processing
- `"apiResponse"`: Formats data for API responses
- `"dataExport"`: Prepares data for export
- `"databaseStorage"`: Formats data for database storage

**Example**:

```json
{
  "preset": "apiResponse"
}
```

## Complete Examples

### Example 1: Basic Field Filtering and Type Coercion

**Request**:

```json
{
  "data": {
    "user_name": "john_doe",
    "age": "30",
    "password": "secret123",
    "is_active": "true",
    "created_at": "2023-01-15"
  },
  "transformOptions": {
    "filters": [{ "pattern": "password", "type": "exclude" }],
    "coercion": {
      "age": "number",
      "is_active": "boolean",
      "created_at": "date"
    }
  }
}
```

**Response**:

```json
{
  "transformed": {
    "user_name": "john_doe",
    "age": 30,
    "is_active": true,
    "created_at": "2023-01-15T00:00:00.000Z"
  }
}
```

### Example 2: Using Presets

**Request**:

```json
{
  "data": {
    "userName": "john_doe",
    "password": "secret123",
    "confidence_score": "0.95",
    "is_active_status": "true",
    "created_at": "2023-01-15"
  },
  "transformOptions": {
    "preset": "aiProcessing"
  }
}
```

**Response**:

```json
{
  "transformed": {
    "user_name": "john_doe",
    "confidence_score": 0.95,
    "is_active_status": true,
    "created_at": "2023-01-15T00:00:00.000Z"
  }
}
```

### Example 3: Complex Filtering with Regex

**Request**:

```json
{
  "data": {
    "user_name": "john_doe",
    "email_temp": "temp@example.com",
    "email": "john@example.com",
    "cache_data": "old_data",
    "real_data": "current_data",
    "temp_field_1": "value1",
    "temp_field_2": "value2"
  },
  "transformOptions": {
    "filters": [
      { "pattern": "/.*_temp$/", "type": "exclude" },
      { "pattern": "/^temp_/", "type": "exclude" },
      { "pattern": "cache_data", "type": "exclude" }
    ]
  }
}
```

**Response**:

```json
{
  "transformed": {
    "user_name": "john_doe",
    "email": "john@example.com",
    "real_data": "current_data"
  }
}
```

### Example 4: Combined Options

**Request**:

```json
{
  "data": {
    "userName": "john_doe",
    "age": "30",
    "password": "secret123",
    "isActive": "true",
    "createdAt": "2023-01-15",
    "temp_id": "12345"
  },
  "transformOptions": {
    "filters": [
      { "pattern": "password", "type": "exclude" },
      { "pattern": "/temp_/", "type": "exclude" }
    ],
    "coercion": {
      "age": "number",
      "isActive": "boolean",
      "createdAt": "date"
    },
    "preset": "apiResponse"
  }
}
```

**Response**:

```json
{
  "transformed": {
    "userName": "john_doe",
    "age": 30,
    "isActive": true,
    "createdAt": "2023-01-15T00:00:00.000Z"
  }
}
```

## Error Handling

### Invalid Transform Options

**Status**: `400 Bad Request`

**Response**:

```json
{
  "error": "Invalid transformOptions: filters must be an array"
}
```

### Type Coercion Errors

**Status**: `200 OK` (with warnings)

**Response**:

```json
{
  "transformed": {
    "field": "invalid-value"
  },
  "warnings": ["Type coercion warning: Cannot coerce 'invalid-value' to number"]
}
```

### Preset Errors

**Status**: `400 Bad Request`

**Response**:

```json
{
  "error": "Unknown preset 'invalidPreset'. Available presets: aiProcessing, apiResponse, dataExport, databaseStorage"
}
```

## Performance Considerations

- **Caching**: Repeated transformations with the same options are cached for better performance
- **Regex Compilation**: Regex patterns are pre-compiled for optimal performance
- **Memory Limits**: Cache is limited to 100 entries to prevent memory issues
- **Recursive Processing**: All transformations work on nested objects and arrays

## Security Notes

- **Input Validation**: All inputs are validated before processing
- **Field Filtering**: Sensitive data can be automatically removed
- **Type Safety**: Type coercion helps prevent injection attacks
- **Error Isolation**: Transformation errors don't affect other operations

## Rate Limiting

The endpoint is subject to standard API rate limiting. Large datasets may require chunking for optimal performance.
