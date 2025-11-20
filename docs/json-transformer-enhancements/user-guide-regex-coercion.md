# JSONTransformer User Guide: Advanced Regex Filtering and Type Coercion

## Overview

This guide provides detailed instructions for using the advanced regex filtering and type coercion features in the JSONTransformer. These features allow for sophisticated data transformation and validation in your sanitization pipelines.

## Advanced Regex Filtering

### Basic Concepts

Regex filtering allows you to remove fields from JSON objects using pattern matching. The system supports both exact string matches and regular expression patterns.

### Supported Pattern Types

1. **String Patterns**: Exact field name matches
2. **RegExp Objects**: Full regular expression support
3. **String Regex Notation**: `/pattern/flags` syntax

### Basic Usage

```javascript
const { removeFields } = require('./utils/jsonTransformer');

// Remove exact field names
const result1 = removeFields({ name: 'John', password: 'secret', age: 30 }, ['password']);
// Result: {name: 'John', age: 30}

// Remove using regex patterns
const result2 = removeFields({ email_temp: 'test@example.com', email: 'real@example.com' }, [
  /.*_temp$/,
]);
// Result: {email: 'real@example.com'}
```

### Advanced Pattern Examples

```javascript
// Remove all fields starting with underscore
removeFields(data, [/^_/]);

// Remove fields containing 'temp' or 'cache'
removeFields(data, [/temp|cache/i]);

// Remove nested fields (works recursively)
const nested = {
  user: { name: 'John', password: 'secret' },
  metadata: { temp_id: 123, real_id: 456 },
};
removeFields(nested, ['password', /temp_.*/]);
/* Result:
{
  user: {name: 'John'},
  metadata: {real_id: 456}
}
*/
```

### Conditional Filtering

Use conditional filtering to remove fields based on their values:

```javascript
// Remove fields with null or undefined values
removeFields(data, [], {
  conditionalFilter: {
    condition: (key, value) => value === null || value === undefined,
  },
});

// Remove numeric fields with values less than 0
removeFields(data, [], {
  conditionalFilter: {
    condition: (key, value) => typeof value === 'number' && value < 0,
  },
});

// Remove string fields that are empty or whitespace
removeFields(data, [], {
  conditionalFilter: {
    condition: (key, value) => typeof value === 'string' && value.trim() === '',
  },
});
```

## Type Coercion

### Supported Types

The type coercion system supports automatic conversion to four data types:

- **number**: Converts strings and numbers to numeric values
- **boolean**: Converts various truthy/falsy representations to booleans
- **date**: Converts strings to ISO date strings
- **string**: Converts any value to string representation

### Basic Type Coercion

```javascript
const { coerceTypes } = require('./utils/jsonTransformer');

// Basic type mapping
const result = coerceTypes(
  {
    age: '25',
    active: 'true',
    score: 95.5,
    created: '2023-01-15',
  },
  {
    age: 'number',
    active: 'boolean',
    score: 'number',
    created: 'date',
  },
);
/* Result:
{
  age: 25,
  active: true,
  score: 95.5,
  created: '2023-01-15T00:00:00.000Z'
}
*/
```

### Number Coercion Rules

```javascript
// Valid conversions
coerceTypes({ a: '123' }, { a: 'number' }); // {a: 123}
coerceTypes({ a: '123.45' }, { a: 'number' }); // {a: 123.45}
coerceTypes({ a: 123 }, { a: 'number' }); // {a: 123}

// Invalid conversions (returns original value with warning)
coerceTypes({ a: 'not-a-number' }, { a: 'number' });
// Result: {a: 'not-a-number'} (with console warning)
```

### Boolean Coercion Rules

```javascript
// Truthy values
coerceTypes({ a: 'true' }, { a: 'boolean' }); // {a: true}
coerceTypes({ a: '1' }, { a: 'boolean' }); // {a: true}
coerceTypes({ a: 'yes' }, { a: 'boolean' }); // {a: true}
coerceTypes({ a: 'on' }, { a: 'boolean' }); // {a: true}
coerceTypes({ a: true }, { a: 'boolean' }); // {a: true}
coerceTypes({ a: 1 }, { a: 'boolean' }); // {a: true}

// Falsy values
coerceTypes({ a: 'false' }, { a: 'boolean' }); // {a: false}
coerceTypes({ a: '0' }, { a: 'boolean' }); // {a: false}
coerceTypes({ a: 'no' }, { a: 'boolean' }); // {a: false}
coerceTypes({ a: 'off' }, { a: 'boolean' }); // {a: false}
coerceTypes({ a: false }, { a: 'boolean' }); // {a: false}
coerceTypes({ a: 0 }, { a: 'boolean' }); // {a: false}

// Invalid values (throws error)
coerceTypes({ a: 'maybe' }, { a: 'boolean' });
// Error: Cannot coerce 'maybe' to boolean - use true/false, 1/0, yes/no, on/off
```

### Date Coercion Rules

```javascript
// Valid date strings
coerceTypes({ a: '2023-01-15' }, { a: 'date' });
// {a: '2023-01-15T00:00:00.000Z'}

coerceTypes({ a: '2023-01-15T10:30:00Z' }, { a: 'date' });
// {a: '2023-01-15T10:30:00.000Z'}

coerceTypes({ a: new Date('2023-01-15') }, { a: 'date' });
// {a: '2023-01-15T00:00:00.000Z'}

// Invalid dates (returns original value with warning)
coerceTypes({ a: 'invalid-date' }, { a: 'date' });
// Result: {a: 'invalid-date'} (with console warning)
```

### String Coercion Rules

```javascript
// Any value can be converted to string
coerceTypes({ a: 123 }, { a: 'string' }); // {a: '123'}
coerceTypes({ a: true }, { a: 'string' }); // {a: 'true'}
coerceTypes({ a: null }, { a: 'string' }); // {a: 'null'}
coerceTypes({ a: undefined }, { a: 'string' }); // {a: 'undefined'}
coerceTypes({ a: { obj: 'value' } }, { a: 'string' }); // {a: '[object Object]'}
```

### Array Handling

Type coercion works recursively on arrays:

```javascript
const data = {
  scores: ['85', '92', '78'],
  flags: ['true', 'false', 'true'],
};

const result = coerceTypes(data, {
  scores: 'number', // coerces each array element
  flags: 'boolean', // coerces each array element
});
/* Result:
{
  scores: [85, 92, 78],
  flags: [true, false, true]
}
*/
```

## Error Handling

### Strict Mode vs. Lenient Mode

By default, type coercion operates in lenient mode:

- Invalid conversions return the original value
- Warnings are logged to console
- Processing continues

For strict mode, set the global flag:

```javascript
globalThis.TRANSFORM_STRICT_MODE = true;
// Now invalid conversions will throw errors instead of returning original values
```

### Common Error Scenarios

```javascript
// Number coercion errors
coerceTypes({ a: 'abc' }, { a: 'number' }); // Warning: Cannot coerce 'abc' to number

// Boolean coercion errors
coerceTypes({ a: 'maybe' }, { a: 'boolean' }); // Error: Cannot coerce 'maybe' to boolean...

// Date coercion errors
coerceTypes({ a: 'not-a-date' }, { a: 'date' }); // Warning: Cannot parse 'not-a-date' as date
```

## API Integration Examples

### Using with /api/sanitize/json

```json
POST /api/sanitize/json
{
  "data": {
    "user_name": "john_doe",
    "age": "30",
    "is_active": "true",
    "created_at": "2023-01-15",
    "temp_field": "remove_me"
  },
  "transformOptions": {
    "filters": [
      {"pattern": "temp_field", "type": "exclude"}
    ],
    "coercion": {
      "age": "number",
      "is_active": "boolean",
      "created_at": "date"
    }
  }
}
```

### Response

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

## Best Practices

### Regex Filtering

1. **Use specific patterns**: Prefer exact matches over broad regex patterns
2. **Test patterns thoroughly**: Regex can have unexpected matches
3. **Consider performance**: Complex regex patterns may impact performance
4. **Document patterns**: Comment your regex patterns for maintainability

### Type Coercion

1. **Validate input data**: Know your data types before applying coercion
2. **Handle edge cases**: Plan for invalid data in your application logic
3. **Use appropriate types**: Choose the most appropriate target type for your use case
4. **Consider strict mode**: Use strict mode for data validation scenarios

### Security Considerations

1. **Input validation**: Always validate input before transformation
2. **Sensitive data**: Use regex filtering to remove sensitive fields
3. **Type safety**: Type coercion helps prevent injection attacks
4. **Error handling**: Implement proper error handling for transformation failures

## Troubleshooting

### Common Issues

**Regex pattern not matching:**

- Check if the pattern is properly escaped
- Test the regex separately
- Verify the field name casing

**Type coercion failing:**

- Check the input data format
- Verify the target type is supported
- Review error messages for specific issues

**Performance problems:**

- Avoid overly complex regex patterns
- Use caching when possible
- Consider preprocessing large datasets

### Debug Tips

Enable verbose logging to see transformation details:

```javascript
// Set environment variable for detailed logging
process.env.DEBUG_TRANSFORM = 'true';
```

Check the console for warnings and errors during transformation.
