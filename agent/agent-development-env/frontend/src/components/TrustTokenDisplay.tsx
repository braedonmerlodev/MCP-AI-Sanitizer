import React from 'react'
import type { TrustToken } from '../types/api'

interface TrustTokenDisplayProps {
  trustToken: TrustToken
}

export const TrustTokenDisplay: React.FC<TrustTokenDisplayProps> = ({
  trustToken,
}) => {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
      <div className="flex items-center mb-3">
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
          <svg
            className="w-4 h-4 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800">
          Trust Token Generated
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium text-gray-700">Content Hash:</span>
          <code className="block bg-gray-100 p-2 rounded mt-1 text-xs break-all">
            {trustToken.contentHash}
          </code>
        </div>

        <div>
          <span className="font-medium text-gray-700">Original Hash:</span>
          <code className="block bg-gray-100 p-2 rounded mt-1 text-xs break-all">
            {trustToken.originalHash}
          </code>
        </div>

        <div>
          <span className="font-medium text-gray-700">Version:</span>
          <span className="block mt-1 text-gray-600">
            {trustToken.sanitizationVersion}
          </span>
        </div>

        <div>
          <span className="font-medium text-gray-700">Rules Applied:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {trustToken.rulesApplied.map((rule, index) => (
              <span
                key={index}
                className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
              >
                {rule}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="font-medium text-gray-700">Generated:</span>
          <span className="block mt-1 text-gray-600">
            {new Date(trustToken.timestamp).toLocaleString()}
          </span>
        </div>

        <div>
          <span className="font-medium text-gray-700">Expires:</span>
          <span className="block mt-1 text-gray-600">
            {new Date(trustToken.expiresAt).toLocaleString()}
          </span>
        </div>

        <div className="md:col-span-2">
          <span className="font-medium text-gray-700">Signature:</span>
          <code className="block bg-gray-100 p-2 rounded mt-1 text-xs break-all">
            {trustToken.signature}
          </code>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          <strong>Security Note:</strong> This trust token cryptographically
          verifies that the content has been properly sanitized and processed.
          It can be used to cache and reuse this sanitized content without
          re-processing.
        </p>
      </div>
    </div>
  )
}
