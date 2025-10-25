# Epic 4.1 PDF Ingestion and Text Extraction

This sub-epic focuses on implementing robust PDF upload and text extraction capabilities. It establishes the foundation for the document processing pipeline by creating secure file upload endpoints and reliable text extraction using pdf-parse. The goal is to provide a dependable entry point for PDF documents that can be safely processed through the sanitization pipeline.

## Story 4.1 PDF Upload and Validation

As a content curator, I want to upload PDF documents through a secure API endpoint, so that documents can be validated and prepared for processing.

Acceptance Criteria:
1: POST `/api/documents/upload` endpoint accepts PDF file uploads with multipart/form-data.
2: File validation ensures only PDF files are accepted (MIME type, file extension, magic bytes).
3: File size limits are enforced (configurable, default 25MB per document).
4: Upload progress tracking and status responses are provided to clients.
5: Comprehensive error handling for invalid files, size limits exceeded, and server errors.
6: Request rate limiting prevents abuse of the upload endpoint.
7: File storage is temporary and secure during processing.
