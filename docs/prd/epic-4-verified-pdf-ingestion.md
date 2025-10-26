# Epic 4 Verified PDF Data Ingestion Pipeline

This epic creates a comprehensive PDF processing and sanitization system that ensures AI agents can only access verified, sanitized document content. The pipeline ingests raw PDFs, extracts text content, converts to structured Markdown, sanitizes through the existing API, generates clean validated PDFs, and implements strict access controls. The goal is to provide a trusted document processing system where all content is verified safe for AI consumption, preventing prompt injection and ensuring data integrity.

## Story 4.1 PDF Ingestion and Text Extraction

As a content curator, I want to upload PDF documents and have their text content reliably extracted, so that the raw document data can be processed for sanitization.

Acceptance Criteria:
1: POST `/api/documents/upload` endpoint accepts PDF file uploads with proper validation.
2: File validation ensures only PDF files are accepted (MIME type, file extension, magic bytes).
3: File size limits are enforced (configurable, default 25MB per document).
4: pdf-parse library successfully extracts text content from uploaded PDFs.
5: Document metadata is captured (filename, upload timestamp, file size, page count, PDF version).
6: Error handling for corrupted PDFs, password-protected files, and extraction failures.
7: Progress tracking and status updates during processing.

