/**
 * Type definitions for validation and sanitization utilities
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
  sanitizedValue?: string
}

export interface ValidationOptions {
  minLength?: number
  maxLength?: number
  required?: boolean
  pattern?: RegExp
  customValidator?: (value: string) => ValidationResult
}

export interface SanitizationOptions {
  allowHtml?: boolean
  allowedTags?: string[]
  maxLength?: number
}

export type ValidationFunction = (value: string) => ValidationResult
export type SanitizationFunction = (
  value: string,
  options?: SanitizationOptions
) => string

export interface InputValidationProps {
  value: string
  onChange: (value: string) => void
  onValidationChange?: (result: ValidationResult) => void
  validator?: ValidationFunction
  sanitizer?: SanitizationFunction
  placeholder?: string
  disabled?: boolean
  className?: string
  showError?: boolean
  realTimeValidation?: boolean
}
