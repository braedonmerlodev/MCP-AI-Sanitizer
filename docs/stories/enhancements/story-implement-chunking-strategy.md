# Story: Implement Chunking Strategy for Large PDF Processing to Prevent JSON Truncation

## 1. Background & Problem

The current implementation of the `SecurityAgent` processes entire PDF documents in a single LLM call. When processing large documents (e.g., "Maker Paper.pdf"), the generated JSON output often exceeds the model's **Maximum Output Token Limit** (typically 4k or 8k tokens).

This results in:

- **Hard Truncation:** The JSON string is cut off mid-stream (e.g., at 32,078 characters).
- **Parsing Failures:** Even with robust repair logic, recovering data from a file cut in half is error-prone and results in data loss.
- **User Frustration:** Users receive "Invalid JSON structure" errors or incomplete data.

## 2. Proposed Solution

Instead of sending the entire document at once, we will implement a **Chunking Strategy**. The system will split the input text into manageable segments, process them in parallel or sequence, and then aggregate the results.

### Key Features

1.  **Smart Text Chunking:**
    - Split raw PDF text into chunks (e.g., 4000-6000 characters or by page boundaries).
    - Ensure chunks respect sentence/paragraph boundaries to avoid context loss.
2.  **Orchestrated Processing:**
    - The `ai_pdf_enhancement` tool will iterate through chunks.
    - Send each chunk to the LLM with a prompt to "Extract/Enhance this section".
3.  **Result Aggregation:**
    - Collect the JSON output from each chunk.
    - Merge them into a single cohesive JSON structure (e.g., combining `pages` arrays or `sections`).
4.  **Model Awareness:**
    - (Optional) Dynamically adjust chunk size based on the selected model's limits.

## 3. Technical Implementation Plan

### Phase 1: Chunking Utility

- Create `src/utils/textChunker.js` (or Python equivalent in `agent/`).
- Implement `splitTextByTokenLimit(text, limit)` using a tokenizer or character count approximation.

### Phase 2: Update `SecurityAgent`

- Modify `_create_ai_pdf_tool` in `agent/security_agent.py`.
- Add logic to check content length.
- If `len(content) > THRESHOLD`:
  - Call `chunk_text()`.
  - Loop through chunks and invoke the LLM chain.
  - Merge the resulting JSONs.

### Phase 3: Aggregation Logic

- Define how to merge different transformation types:
  - `structure`: Concatenate the `content` or `sections`.
  - `summarize`: Summarize the summaries (Map-Reduce).
  - `extract_entities`: Deduplicate and merge entity lists.

## 4. Acceptance Criteria

- [ ] System can process a PDF > 50 pages without JSON truncation errors.
- [ ] `original_length` of the final JSON output can exceed the single-call LLM limit (e.g., > 50k chars).
- [ ] No "Unable to repair JSON structure" errors appear in logs for valid large files.
- [ ] Processing time remains reasonable (consider parallel execution for chunks).

## 5. Priority

- **Medium/High** (Critical for scalability, but current "Repair" fix provides a temporary workaround).
