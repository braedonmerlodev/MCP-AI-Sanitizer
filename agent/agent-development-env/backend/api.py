# backend/api.py
import os
import sys
import asyncio
import io
import json
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv
import PyPDF2

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.security_agent import SecurityAgent
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import PyPDF2
import io
import json
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
import re
import time
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import psutil
from monitoring.alerting import alert_manager

# Load environment variables
load_dotenv()

# Security constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_TEXT_LENGTH = 1000000  # 1M characters
RATE_LIMIT_REQUESTS = 100  # requests per minute
RATE_LIMIT_WINDOW = 60  # seconds
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
API_KEY = os.getenv("API_KEY")

# In-memory rate limiting (for demo; use Redis in production)
rate_limit_store: Dict[str, list] = {}

# Security middleware
security = HTTPBearer(auto_error=False)

# Performance monitoring metrics
PDF_PROCESSING_REQUESTS = Counter('pdf_processing_requests_total', 'Total PDF processing requests', ['status', 'stage'])
PDF_PROCESSING_DURATION = Histogram('pdf_processing_duration_seconds', 'PDF processing duration', ['stage'])
PDF_PROCESSING_FILE_SIZE = Histogram('pdf_processing_file_size_bytes', 'PDF file sizes processed')
CHAT_REQUESTS = Counter('chat_requests_total', 'Total chat requests', ['status', 'type'])
CHAT_DURATION = Histogram('chat_request_duration_seconds', 'Chat request duration', ['type'])
SYSTEM_CPU_USAGE = Gauge('system_cpu_usage_percent', 'Current CPU usage percentage')
SYSTEM_MEMORY_USAGE = Gauge('system_memory_usage_percent', 'Current memory usage percentage')
ACTIVE_CONNECTIONS = Gauge('active_websocket_connections', 'Number of active WebSocket connections')

# Start Prometheus metrics server on port 8000
try:
    start_http_server(8000)
    logging.info("Prometheus metrics server started on port 8000")
except Exception as e:
    logging.warning(f"Failed to start Prometheus metrics server: {e}")

app = FastAPI(title="MCP Security Backend API")

# Add security middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] if os.getenv("ENV") == "development" else ["your-domain.com"]
)

# Custom security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response

# Security functions
def validate_file_type(file_content: bytes, filename: str) -> bool:
    """Validate file type by checking magic bytes and extension"""
    # Check PDF magic bytes
    if not file_content.startswith(b'%PDF-'):
        return False

    # Check filename extension
    if not filename.lower().endswith('.pdf'):
        return False

    # Additional validation: try to read as PDF
    try:
        PyPDF2.PdfReader(io.BytesIO(file_content))
        return True
    except:
        return False

def sanitize_input(text: str) -> str:
    """Sanitize input text to prevent injection attacks"""
    # Remove potentially dangerous characters
    text = re.sub(r'[<>]', '', text)
    # Limit length
    return text[:MAX_TEXT_LENGTH]

def check_rate_limit(client_ip: str) -> bool:
    """Check if client is within rate limits"""
    now = datetime.now()
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)

    if client_ip not in rate_limit_store:
        rate_limit_store[client_ip] = []

    # Clean old requests
    rate_limit_store[client_ip] = [
        req_time for req_time in rate_limit_store[client_ip]
        if req_time > window_start
    ]

    # Check limit
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False

    # Add current request
    rate_limit_store[client_ip].append(now)
    return True

def authenticate_request(credentials: HTTPAuthorizationCredentials) -> bool:
    """Authenticate API request"""
    if not API_KEY:
        return True  # No auth required in development
    return credentials and secrets.compare_digest(credentials.credentials, API_KEY)

def log_security_event(event_type: str, details: Dict[str, Any], client_ip: Optional[str] = None):
    """Log security events for audit"""
    logging.info(f"SECURITY_EVENT: {event_type} - {json.dumps(details)} - IP: {client_ip}")

def update_system_metrics():
    """Update system resource metrics and check for alerts"""
    try:
        cpu_usage = psutil.cpu_percent(interval=1)
        memory_usage = psutil.virtual_memory().percent
        active_conns = len(active_connections)

        SYSTEM_CPU_USAGE.set(cpu_usage)
        SYSTEM_MEMORY_USAGE.set(memory_usage)
        ACTIVE_CONNECTIONS.set(active_conns)

        # Check for system alerts
        asyncio.create_task(alert_manager.process_metrics_and_alert({
            'cpu_usage': cpu_usage,
            'memory_usage': memory_usage,
            'active_connections': active_conns
        }))
    except Exception as e:
        logging.warning(f"Failed to update system metrics: {e}")

def log_performance_event(event_type: str, duration: float, details: Dict[str, Any], client_ip: Optional[str] = None):
    """Log performance events with timing data"""
    logging.info(f"PERFORMANCE_EVENT: {event_type} - Duration: {duration:.3f}s - {json.dumps(details)} - IP: {client_ip}")

# Global agent instance
agent = None

# Background task for system monitoring
async def system_monitoring_task():
    """Background task to periodically update system metrics"""
    while True:
        try:
            update_system_metrics()
            await asyncio.sleep(30)  # Update every 30 seconds
        except Exception as e:
            logging.warning(f"System monitoring task error: {e}")
            await asyncio.sleep(60)

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

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError('Content too long')
        return sanitize_input(v)

    @field_validator('classification')
    @classmethod
    def validate_classification(cls, v):
        allowed = ['general', 'llm', 'api']
        if v not in allowed:
            raise ValueError(f'Classification must be one of: {allowed}')
        return v

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
async def process_pdf(request: Request, file: UploadFile = File(...), credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Process uploaded PDF: extract text, sanitize content, and enhance with AI"""
    client_ip = request.client.host if request.client else "unknown"
    start_time = time.time()

    # Update system metrics at start
    update_system_metrics()

    # Rate limiting
    if not check_rate_limit(client_ip):
        PDF_PROCESSING_REQUESTS.labels(status="rate_limited", stage="rate_limit").inc()
        log_security_event("RATE_LIMIT_EXCEEDED", {"endpoint": "/api/process-pdf"}, client_ip)
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Authentication
    if not authenticate_request(credentials):
        PDF_PROCESSING_REQUESTS.labels(status="unauthorized", stage="auth").inc()
        log_security_event("AUTH_FAILED", {"endpoint": "/api/process-pdf"}, client_ip)
        raise HTTPException(status_code=401, detail="Invalid API key")

    processing_stages = []
    file_size = 0

    try:
        # Validate file size
        file_content = b""

        # Read file in chunks to check size
        while chunk := await file.read(8192):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                log_security_event("FILE_TOO_LARGE", {"size": file_size, "max": MAX_FILE_SIZE}, client_ip)
                raise HTTPException(status_code=413, detail=f"File too large. Maximum size: {MAX_FILE_SIZE} bytes")
            file_content += chunk

        # Validate file type
        validation_start = time.time()
        if not validate_file_type(file_content, file.filename):
            PDF_PROCESSING_REQUESTS.labels(status="invalid_file", stage="validation").inc()
            log_security_event("INVALID_FILE_TYPE", {"filename": file.filename}, client_ip)
            raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed")

        validation_duration = time.time() - validation_start
        PDF_PROCESSING_DURATION.labels(stage="validation").observe(validation_duration)
        PDF_PROCESSING_FILE_SIZE.observe(file_size)
        processing_stages.append({"stage": "file_validation", "status": "completed", "timestamp": datetime.now().isoformat(), "duration": validation_duration})

        log_security_event("PDF_UPLOAD", {"filename": file.filename, "size": file_size}, client_ip)

        # Extract text from PDF
        processing_stages.append({"stage": "text_extraction", "status": "in_progress", "timestamp": datetime.now().isoformat()})
        extraction_start = time.time()
        extracted_text = extract_pdf_text(file_content)
        extraction_duration = time.time() - extraction_start

        if not extracted_text:
            PDF_PROCESSING_REQUESTS.labels(status="no_text", stage="extraction").inc()
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")

        # Sanitize extracted text
        extracted_text = sanitize_input(extracted_text)

        processing_stages[-1]["status"] = "completed"
        processing_stages.append({"stage": "sanitization", "status": "in_progress", "timestamp": datetime.now().isoformat()})

        # Get agent and sanitize content
        sanitization_start = time.time()
        agent = await get_agent()

        # Find the sanitize_content tool
        sanitize_tool = None
        for tool in agent.tools:
            if tool.name == "sanitize_content":
                sanitize_tool = tool
                break

        if not sanitize_tool:
            PDF_PROCESSING_REQUESTS.labels(status="tool_not_found", stage="sanitization").inc()
            raise HTTPException(status_code=500, detail="Sanitize tool not found")

        # Call the sanitize tool
        sanitize_result = await sanitize_tool.function(
            content=extracted_text,
            classification="general"
        )

        sanitization_duration = time.time() - sanitization_start
        PDF_PROCESSING_DURATION.labels(stage="sanitization").observe(sanitization_duration)

        if not sanitize_result.get("success", False):
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = sanitize_result.get("error")
            processing_stages[-1]["duration"] = sanitization_duration
            PDF_PROCESSING_REQUESTS.labels(status="sanitization_failed", stage="sanitization").inc()
            return ProcessPdfResponse(
                success=False,
                error=sanitize_result.get("error"),
                processing_stages=processing_stages,
                extracted_text_length=len(extracted_text)
            )

        processing_stages[-1]["status"] = "completed"
        processing_stages[-1]["duration"] = sanitization_duration
        processing_stages.append({"stage": "ai_enhancement", "status": "in_progress", "timestamp": datetime.now().isoformat()})

        # Find the ai_pdf_enhancement tool
        enhancement_start = time.time()
        enhance_tool = None
        for tool in agent.tools:
            if tool.name == "ai_pdf_enhancement":
                enhance_tool = tool
                break

        if not enhance_tool:
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = "Enhancement tool not found"
            processing_stages[-1]["duration"] = time.time() - enhancement_start
            PDF_PROCESSING_REQUESTS.labels(status="tool_not_found", stage="enhancement").inc()
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

        enhancement_duration = time.time() - enhancement_start
        PDF_PROCESSING_DURATION.labels(stage="enhancement").observe(enhancement_duration)

        processing_stages[-1]["status"] = "completed" if enhance_result.get("success", False) else "failed"
        processing_stages[-1]["duration"] = enhancement_duration
        if not enhance_result.get("success", False):
            processing_stages[-1]["error"] = enhance_result.get("error")
            PDF_PROCESSING_REQUESTS.labels(status="enhancement_failed", stage="enhancement").inc()

        # Record final metrics
        total_duration = time.time() - start_time
        success = enhance_result.get("success", False)
        PDF_PROCESSING_REQUESTS.labels(status="success" if success else "failed", stage="total").inc()
        PDF_PROCESSING_DURATION.labels(stage="total").observe(total_duration)

        # Log performance event
        log_performance_event("PDF_PROCESSING_COMPLETED", total_duration, {
            "success": success,
            "file_size": file_size,
            "extracted_text_length": len(extracted_text),
            "stages": len(processing_stages)
        }, client_ip)

        # Update system metrics at end
        update_system_metrics()

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
        # Record metrics for HTTP exceptions
        total_duration = time.time() - start_time
        PDF_PROCESSING_REQUESTS.labels(status="http_error", stage="total").inc()
        PDF_PROCESSING_DURATION.labels(stage="total").observe(total_duration)
        log_performance_event("PDF_PROCESSING_HTTP_ERROR", total_duration, {
            "error_type": "HTTPException",
            "file_size": file_size if 'file_size' in locals() else 0
        }, client_ip)
        update_system_metrics()
        raise
    except Exception as e:
        # Log error securely without exposing details
        log_security_event("PROCESSING_ERROR", {"error_type": type(e).__name__}, client_ip)
        # Update the current stage to failed
        if processing_stages:
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = "Internal processing error"

        # Record metrics for general exceptions
        total_duration = time.time() - start_time
        PDF_PROCESSING_REQUESTS.labels(status="internal_error", stage="total").inc()
        PDF_PROCESSING_DURATION.labels(stage="total").observe(total_duration)
        log_performance_event("PDF_PROCESSING_INTERNAL_ERROR", total_duration, {
            "error_type": type(e).__name__,
            "file_size": file_size if 'file_size' in locals() else 0
        }, client_ip)
        update_system_metrics()
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/sanitize/json", response_model=SanitizeResponse)
async def sanitize_content(request: Request, req: SanitizeRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Sanitize content using the security agent"""
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting
    if not check_rate_limit(client_ip):
        log_security_event("RATE_LIMIT_EXCEEDED", {"endpoint": "/api/sanitize/json"}, client_ip)
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Authentication
    if not authenticate_request(credentials):
        log_security_event("AUTH_FAILED", {"endpoint": "/api/sanitize/json"}, client_ip)
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Validate input
    if len(req.content) > MAX_TEXT_LENGTH:
        log_security_event("INPUT_TOO_LARGE", {"length": len(req.content)}, client_ip)
        raise HTTPException(status_code=413, detail="Input too large")

    # Sanitize input
    req.content = sanitize_input(req.content)

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
        log_security_event("SANITIZE_ERROR", {"error_type": type(e).__name__}, client_ip)
        raise HTTPException(status_code=500, detail="Internal server error")

# Store active WebSocket connections and their associated data
active_connections: Dict[str, Dict[str, Any]] = {}

class ChatMessage(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError('Message too long')
        return sanitize_input(v)

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for real-time chat with streaming responses"""
    # Check origin for security
    origin = websocket.headers.get("origin", "")
    if origin not in ALLOWED_ORIGINS and ALLOWED_ORIGINS != ["*"]:
        await websocket.close(code=1008, reason="Origin not allowed")
        return

    await websocket.accept()

    # Generate connection ID
    connection_id = f"conn_{id(websocket)}"
    client_ip = websocket.client.host if websocket.client else "unknown"

    active_connections[connection_id] = {
        "websocket": websocket,
        "agent": None,
        "context": {},
        "connected_at": datetime.now(),
        "client_ip": client_ip
    }

    log_security_event("WEBSOCKET_CONNECT", {"connection_id": connection_id}, client_ip)

    try:
        # Initialize agent for this connection
        agent = await get_agent()
        active_connections[connection_id]["agent"] = agent

        while True:
            # Receive message from client
            data = await websocket.receive_text()

            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "error": "Invalid JSON"})
                continue

            user_message = message_data.get("message", "")
            context = message_data.get("context", {})

            # Validate input
            if len(user_message) > MAX_TEXT_LENGTH:
                await websocket.send_json({"type": "error", "error": "Message too long"})
                continue

            # Sanitize input
            user_message = sanitize_input(user_message)

            # Update connection context
            active_connections[connection_id]["context"] = context

            # Generate streaming response
            await stream_chat_response(websocket, agent, user_message, context)

    except WebSocketDisconnect:
        logging.info(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "error": "Internal server error"
            })
        except:
            pass
    finally:
        # Clean up connection
        if connection_id in active_connections:
            del active_connections[connection_id]

async def stream_chat_response(websocket: WebSocket, agent: SecurityAgent, message: str, context: Dict[str, Any]):
    """Stream chat response using the security agent"""
    try:
        # Send typing indicator
        await websocket.send_json({"type": "typing", "status": True})

        # Prepare context for the agent
        system_context = ""
        if context.get("processed_data"):
            system_context = f"You have access to processed PDF data: {json.dumps(context['processed_data'])}. Use this to answer questions about the content."

        # For now, use a simple LLM call. In a full implementation, you'd use the agent's LLM capabilities
        # Since the agent uses Langchain, we can create a simple chat tool

        from langchain.chains import LLMChain
        from langchain.prompts import PromptTemplate
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm_config = {
            "model": os.getenv("AGENT_LLM_MODEL", "gemini-1.5-flash"),
            "temperature": 0.1,
            "max_tokens": 2000,
            "api_key": os.getenv("GEMINI_API_KEY"),
            "base_url": os.getenv("AGENT_LLM_BASE_URL")
        }

        llm = ChatGoogleGenerativeAI(
            temperature=0.1,
            model=llm_config["model"],
            google_api_key=llm_config["api_key"]
        )

        prompt = PromptTemplate(
            template="""{system_context}

User: {message}

Assistant: """,
            input_variables=["system_context", "message"]
        )

        chain = LLMChain(llm=llm, prompt=prompt)

        # For streaming, we'll simulate it by sending chunks
        # In a real implementation, you'd use the LLM's streaming capabilities
        response = chain.run(system_context=system_context, message=message)

        # Split response into chunks for streaming effect
        words = response.split()
        chunk_size = 10

        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i+chunk_size])
            await websocket.send_json({
                "type": "chunk",
                "content": chunk + " "
            })
            await asyncio.sleep(0.1)  # Small delay for streaming effect

        # Send completion
        await websocket.send_json({"type": "complete"})

    except Exception as e:
        logging.error(f"Error in stream_chat_response: {e}")
        await websocket.send_json({
            "type": "error",
            "error": "Failed to generate response"
        })
    finally:
        # Stop typing indicator
        await websocket.send_json({"type": "typing", "status": False})

@app.post("/api/chat")
async def http_chat(request: Request, chat_request: ChatMessage, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """HTTP fallback endpoint for chat (non-streaming)"""
    client_ip = request.client.host if request.client else "unknown"
    start_time = time.time()

    # Rate limiting
    if not check_rate_limit(client_ip):
        CHAT_REQUESTS.labels(status="rate_limited", type="http").inc()
        log_security_event("RATE_LIMIT_EXCEEDED", {"endpoint": "/api/chat"}, client_ip)
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Authentication
    if not authenticate_request(credentials):
        CHAT_REQUESTS.labels(status="unauthorized", type="http").inc()
        log_security_event("AUTH_FAILED", {"endpoint": "/api/chat"}, client_ip)
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Validate input
    if len(chat_request.message) > MAX_TEXT_LENGTH:
        CHAT_REQUESTS.labels(status="input_too_large", type="http").inc()
        log_security_event("INPUT_TOO_LARGE", {"length": len(chat_request.message)}, client_ip)
        raise HTTPException(status_code=413, detail="Message too long")

    # Sanitize input
    chat_request.message = sanitize_input(chat_request.message)

    try:
        agent = await get_agent()

        # Simple response generation (same as WebSocket but non-streaming)
        from langchain.chains import LLMChain
        from langchain.prompts import PromptTemplate
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm_config = {
            "model": os.getenv("AGENT_LLM_MODEL", "gemini-1.5-flash"),
            "temperature": 0.1,
            "max_tokens": 2000,
            "api_key": os.getenv("GEMINI_API_KEY"),
            "base_url": os.getenv("AGENT_LLM_BASE_URL")
        }

        llm = ChatGoogleGenerativeAI(
            temperature=0.1,
            model=llm_config["model"],
            google_api_key=llm_config["api_key"]
        )

        system_context = ""
        if chat_request.context and chat_request.context.get("processed_data"):
            system_context = f"You have access to processed PDF data: {json.dumps(chat_request.context['processed_data'])}. Use this to answer questions about the content."

        prompt = PromptTemplate(
            template="""{system_context}

User: {message}

Assistant: """,
            input_variables=["system_context", "message"]
        )

        chain = LLMChain(llm=llm, prompt=prompt)
        response = chain.run(system_context=system_context, message=chat_request.message)

        # Record success metrics
        duration = time.time() - start_time
        CHAT_REQUESTS.labels(status="success", type="http").inc()
        CHAT_DURATION.labels(type="http").observe(duration)
        log_performance_event("CHAT_COMPLETED", duration, {
            "message_length": len(chat_request.message),
            "response_length": len(response)
        }, client_ip)

        return {
            "success": True,
            "response": response,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        # Record error metrics
        duration = time.time() - start_time
        CHAT_REQUESTS.labels(status="error", type="http").inc()
        CHAT_DURATION.labels(type="http").observe(duration)
        log_performance_event("CHAT_ERROR", duration, {
            "error_type": type(e).__name__,
            "message_length": len(chat_request.message)
        }, client_ip)
        log_security_event("CHAT_ERROR", {"error_type": type(e).__name__}, client_ip)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)