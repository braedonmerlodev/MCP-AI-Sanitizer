# backend/api.py
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from agent.security_agent import SecurityAgent
import asyncio
import os
from typing import Optional
from dotenv import load_dotenv
import PyPDF2
import io

# Load environment variables
load_dotenv()

app = FastAPI(title="MCP Security Backend API")

# Global agent instance
agent = None

async def get_agent():
    global agent
    if agent is None:
        # Initialize agent with LLM config
        llm_config = {
            "model": os.getenv("AGENT_LLM_MODEL", "gemini-1.5-flash"),
            "temperature": 0.1,
            "max_tokens": 2000,
            "api_key": os.getenv("GEMINI_API_KEY"),
            "base_url": os.getenv("AGENT_LLM_BASE_URL")
        }
        agent = SecurityAgent(llm_config=llm_config)
    return agent

def extract_pdf_text(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract PDF text: {str(e)}")

class SanitizeRequest(BaseModel):
    content: str
    classification: str = "general"

class SanitizeResponse(BaseModel):
    success: bool
    sanitized_content: Optional[str] = None
    processing_time: Optional[str] = None
    error: Optional[str] = None

class ProcessPdfResponse(BaseModel):
    success: bool
    sanitized_content: Optional[str] = None
    enhanced_content: Optional[str] = None
    structured_output: Optional[dict] = None
    processing_time: Optional[str] = None
    error: Optional[str] = None
    extracted_text_length: Optional[int] = None
    processing_stages: Optional[list] = None

@app.post("/api/process-pdf", response_model=ProcessPdfResponse)
async def process_pdf(file: UploadFile = File(...)):
    """Process uploaded PDF: extract text, sanitize content, and enhance with AI"""
    processing_stages = []

    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

        processing_stages.append({"stage": "file_validation", "status": "completed", "timestamp": "now"})

        # Read file content
        file_content = await file.read()

        # Extract text from PDF
        processing_stages.append({"stage": "text_extraction", "status": "in_progress", "timestamp": "now"})
        extracted_text = extract_pdf_text(file_content)

        if not extracted_text:
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")

        processing_stages[-1]["status"] = "completed"
        processing_stages.append({"stage": "sanitization", "status": "in_progress", "timestamp": "now"})

        # Get agent and sanitize content
        agent = await get_agent()

        # Find the sanitize_content tool
        sanitize_tool = None
        for tool in agent.tools:
            if tool.name == "sanitize_content":
                sanitize_tool = tool
                break

        if not sanitize_tool:
            raise HTTPException(status_code=500, detail="Sanitize tool not found")

        # Call the sanitize tool
        sanitize_result = await sanitize_tool.function(
            content=extracted_text,
            classification="general"
        )

        if not sanitize_result.get("success", False):
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = sanitize_result.get("error")
            return ProcessPdfResponse(
                success=False,
                error=sanitize_result.get("error"),
                processing_stages=processing_stages,
                extracted_text_length=len(extracted_text)
            )

        processing_stages[-1]["status"] = "completed"
        processing_stages.append({"stage": "ai_enhancement", "status": "in_progress", "timestamp": "now"})

        # Find the ai_pdf_enhancement tool
        enhance_tool = None
        for tool in agent.tools:
            if tool.name == "ai_pdf_enhancement":
                enhance_tool = tool
                break

        if not enhance_tool:
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = "Enhancement tool not found"
            return ProcessPdfResponse(
                success=False,
                sanitized_content=sanitize_result.get("sanitized_content"),
                error="Enhancement tool not found",
                processing_stages=processing_stages,
                extracted_text_length=len(extracted_text)
            )

        # Call the enhance tool with json_schema transformation
        enhance_result = await enhance_tool.function(
            content=sanitize_result.get("sanitized_content", ""),
            transformation_type="json_schema"
        )

        processing_stages[-1]["status"] = "completed" if enhance_result.get("success", False) else "failed"
        if not enhance_result.get("success", False):
            processing_stages[-1]["error"] = enhance_result.get("error")

        return ProcessPdfResponse(
            success=enhance_result.get("success", False),
            sanitized_content=sanitize_result.get("sanitized_content"),
            enhanced_content=enhance_result.get("enhanced_content"),
            structured_output=enhance_result.get("structured_output"),
            processing_time=enhance_result.get("processing_metadata", {}).get("processing_time"),
            error=enhance_result.get("error"),
            extracted_text_length=len(extracted_text),
            processing_stages=processing_stages
        )

    except HTTPException:
        raise
    except Exception as e:
        # Update the current stage to failed
        if processing_stages:
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = str(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sanitize/json", response_model=SanitizeResponse)
async def sanitize_content(request: SanitizeRequest):
    """Sanitize content using the security agent"""
    try:
        agent = await get_agent()

        # Find the sanitize_content tool
        sanitize_tool = None
        for tool in agent.tools:
            if tool.name == "sanitize_content":
                sanitize_tool = tool
                break

        if not sanitize_tool:
            raise HTTPException(status_code=500, detail="Sanitize tool not found")

        # Call the sanitize tool
        result = await sanitize_tool.function(
            content=request.content,
            classification=request.classification
        )

        return SanitizeResponse(
            success=result.get("success", False),
            sanitized_content=result.get("sanitized_content"),
            processing_time=result.get("processing_time"),
            error=result.get("error")
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)