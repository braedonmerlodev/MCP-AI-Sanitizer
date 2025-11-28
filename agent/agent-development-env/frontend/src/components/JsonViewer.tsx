import React, { useState, useId } from 'react'

interface JsonViewerProps {
  data: Record<string, unknown>
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentId = useId()

  const formatJson = (obj: unknown, indent = 0): React.ReactElement => {
    const indentStr = '  '.repeat(indent)

    if (obj === null) {
      return <span className="text-gray-500">null</span>
    }

    if (typeof obj === 'boolean') {
      return <span className="text-purple-600">{obj.toString()}</span>
    }

    if (typeof obj === 'number') {
      return <span className="text-blue-600">{obj}</span>
    }

    if (typeof obj === 'string') {
      return <span className="text-green-600">"{obj}"</span>
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return <span className="text-gray-600">[]</span>

      return (
        <span>
          [
          <div className="ml-4">
            {obj.map((item, index) => (
              <div key={index}>
                {formatJson(item, indent + 1)}
                {index < obj.length - 1 && ','}
              </div>
            ))}
          </div>
          {indentStr}]
        </span>
      )
    }

    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      const objRecord = obj as Record<string, unknown>
      const keys = Object.keys(objRecord)
      if (keys.length === 0)
        return <span className="text-gray-600">{'{}'}</span>

      return (
        <span>
          {'{'}
          <div className="ml-4">
            {keys.map((key, index) => (
              <div key={key}>
                <span className="text-red-600">"{key}"</span>
                <span className="text-gray-600">: </span>
                {formatJson(objRecord[key], indent + 1)}
                {index < keys.length - 1 && ','}
              </div>
            ))}
          </div>
          {indentStr}
          {'}'}
        </span>
      )
    }

    return <span>{String(obj)}</span>
  }

  return (
    <div className="border rounded-lg bg-gray-50 dark:bg-gray-900">
      <button
        id={contentId + '-button'}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} JSON viewer to ${isExpanded ? 'hide' : 'show'} structured output`}
      >
        <span className="font-medium text-sm flex items-center gap-2">
          <span>📄</span>
          Structured Output (JSON)
        </span>
        <span className="text-xs text-gray-500">
          {isExpanded ? '▼' : '▶'} Click to {isExpanded ? 'collapse' : 'expand'}
        </span>
      </button>
      {isExpanded && (
        <div
          id={contentId}
          className="p-3 border-t bg-white dark:bg-gray-800 rounded-b-lg"
          role="region"
          aria-labelledby={contentId + '-button'}
        >
          <div className="text-xs overflow-x-auto max-h-96 overflow-y-auto font-mono leading-relaxed">
            <div className="sr-only" aria-live="polite">
              {JSON.stringify(data, null, 2)}
            </div>
            {formatJson(data)}
          </div>
        </div>
      )}
    </div>
  )
}
