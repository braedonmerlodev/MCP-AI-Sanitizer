# backend/api.py
import os
import sys
import asyncio
import io
import json
from typing import Optional, Dict, Any
import hashlib
import secrets
import time

from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    WebSocket,
    WebSocketDisconnect,
    Request,
    Depends,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv
import PyPDF2

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.security_agent import SecurityAgent
import logging
from datetime import datetime, timedelta
import re
import bleach
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
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174"
).split(",")
API_KEY = os.getenv("API_KEY")

# In-memory rate limiting (for demo; use Redis in production)
rate_limit_store: Dict[str, list] = {}

# Security middleware
security = HTTPBearer(auto_error=False)

# Performance monitoring metrics
PDF_PROCESSING_REQUESTS = Counter(
    "pdf_processing_requests_total",
    "Total PDF processing requests",
    ["status", "stage"],
)
PDF_PROCESSING_DURATION = Histogram(
    "pdf_processing_duration_seconds", "PDF processing duration", ["stage"]
)
PDF_PROCESSING_FILE_SIZE = Histogram(
    "pdf_processing_file_size_bytes", "PDF file sizes processed"
)
CHAT_REQUESTS = Counter(
    "chat_requests_total", "Total chat requests", ["status", "type"]
)
CHAT_DURATION = Histogram(
    "chat_request_duration_seconds", "Chat request duration", ["type"]
)
SYSTEM_CPU_USAGE = Gauge("system_cpu_usage_percent", "Current CPU usage percentage")
SYSTEM_MEMORY_USAGE = Gauge(
    "system_memory_usage_percent", "Current memory usage percentage"
)
ACTIVE_CONNECTIONS = Gauge(
    "active_websocket_connections", "Number of active WebSocket connections"
)

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
    allowed_hosts=["*"] if os.getenv("ENV") == "development" else ["localhost", "127.0.0.1", "localhost:8001", "127.0.0.1:8001", "your-domain.com"],
)


# Custom security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self' ws: wss: https: http://localhost:8000"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response


# Security functions
def validate_file_type(file_content: bytes, filename: str) -> bool:
    """Validate file type by checking magic bytes and extension"""
    # Check PDF magic bytes
    if not file_content.startswith(b"%PDF-"):
        return False

    # Check filename extension
    if not filename.lower().endswith(".pdf"):
        return False

    # Additional validation: try to read as PDF
    try:
        PyPDF2.PdfReader(io.BytesIO(file_content))
        return True
    except Exception:
        return False


def sanitize_input(text: str) -> str:
    """Sanitize input text using the full pipeline like Node.js"""
    import unicodedata

    # Ensure it's a string
    if not isinstance(text, str):
        text = str(text or '')

    # 1. Unicode normalization
    text = unicodedata.normalize('NFC', text)

    # 2. Escape neutralization - remove ANSI escape sequences (before symbol stripping)
    text = re.sub(r'\x1b\[[^A-Za-z]*[A-Za-z]', '', text)

    # 3. Symbol stripping - remove zero-width and control characters
    zero_width_chars = '\u200B\u200C\u200D\u200E\u200F\u2028\u2029\uFEFF'
    control_chars = ''.join(chr(i) for i in range(0, 32)) + ''.join(chr(i) for i in range(127, 160))
    text = re.sub(f'[{re.escape(zero_width_chars + control_chars)}]', '', text)

    # 4. HTML sanitization - hybrid approach for performance
    # Use fast regex for most cases, bleach only for complex content
    if '<' in text and '>' in text:
        # Use bleach only for content with script tags (most security-critical)
        if '<script' in text.lower():
            # First remove script tags and content (critical for security)
            text = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', text, flags=re.IGNORECASE)
            # Then use bleach for remaining HTML
            text = bleach.clean(text, tags=[], strip=True)
        else:
            # Use fast regex for non-script HTML
            # Remove HTML tags
            text = re.sub(r'<[^>]*>', '', text)
            # Remove event handlers
            text = re.sub(r'on\w+\s*=', '', text, flags=re.IGNORECASE)

    # Always apply non-HTML XSS protection
    # Remove javascript: URLs
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    # Remove data URLs that might contain scripts
    text = re.sub(r'data:\s*text\/html[^,]+,', '', text, flags=re.IGNORECASE)
    # Remove potential XSS keywords
    text = re.sub(r'\b(alert|img|src|javascript|script|onerror|onload)\b', '', text, flags=re.IGNORECASE)

    # Remove specific bad characters and symbols
    text = re.sub(r'[`©®™€£¥§¶†‡‹›Øß²³´]', '', text)

    # Remove potential XSS keywords
    text = re.sub(r'\b(alert|img|src|javascript|script|onerror|onload)\b', '', text, flags=re.IGNORECASE)

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
        req_time for req_time in rate_limit_store[client_ip] if req_time > window_start
    ]

    # Check limit
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False

    # Add current request
    rate_limit_store[client_ip].append(now)
    return True


def authenticate_request(credentials: HTTPAuthorizationCredentials) -> bool:
    """Authenticate API request"""
    print(f"DEBUG: API_KEY = {repr(API_KEY)}, credentials = {credentials}")
    if not API_KEY:
        print("DEBUG: No API_KEY, allowing request")
        return True  # No auth required in development
    result = credentials and secrets.compare_digest(credentials.credentials, API_KEY)
    print(f"DEBUG: Auth result = {result}")
    return result


def log_security_event(
    event_type: str, details: Dict[str, Any], client_ip: Optional[str] = None
):
    """Log security events for audit"""
    logging.info(
        f"SECURITY_EVENT: {event_type} - {json.dumps(details)} - IP: {client_ip}"
    )


def generate_trust_token(content: str, rules_applied: list = None) -> dict:
    """Generate a trust token for sanitized content"""
    if rules_applied is None:
        rules_applied = ["UnicodeNormalization", "SymbolStripping", "BleachSanitization"]

    # Generate content hash
    content_hash = hashlib.sha256(content.encode('utf-8')).digest().hex()

    # Generate original hash (simulated)
    original_hash = hashlib.sha256((content + "original").encode('utf-8')).digest().hex()

    # Generate signature using HMAC with a secret
    secret = os.getenv("TRUST_TOKEN_SECRET", "default-secret-key")
    signature_data = f"{content_hash}.{original_hash}.1.0.{','.join(rules_applied)}.{int(time.time())}"
    signature = hashlib.sha256((signature_data + secret).encode('utf-8')).digest().hex()

    nonce = secrets.token_hex(16)

    return {
        "contentHash": content_hash,
        "originalHash": original_hash,
        "sanitizationVersion": "1.0",
        "rulesApplied": rules_applied,
        "timestamp": datetime.now().isoformat(),
        "expiresAt": (datetime.now() + timedelta(hours=1)).isoformat(),
        "signature": signature,
        "nonce": nonce
    }


def validate_trust_token(trust_token: dict) -> bool:
    """Validate trust token signature"""
    try:
        secret = os.getenv("TRUST_TOKEN_SECRET", "default-secret-key")
        signature_data = f"{trust_token['contentHash']}.{trust_token['originalHash']}.{trust_token['sanitizationVersion']}.{','.join(trust_token['rulesApplied'])}.{int(datetime.fromisoformat(trust_token['timestamp'].replace('Z', '+00:00')).timestamp())}"
        expected_signature = hashlib.sha256((signature_data + secret).encode('utf-8')).digest().hex()
        return secrets.compare_digest(trust_token['signature'], expected_signature)
    except Exception as e:
        logging.error(f"Trust token validation failed: {e}")
        return False


def sanitize_dict(data):
    """Recursively sanitize string values in a dict using the main sanitize_input function"""
    if isinstance(data, dict):
        return {k: sanitize_dict(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_dict(item) for item in data]
    elif isinstance(data, str):
        # Use the main sanitize_input function for consistent sanitization
        return sanitize_input(data)
    else:
        return data


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
        asyncio.create_task(
            alert_manager.process_metrics_and_alert(
                {
                    "cpu_usage": cpu_usage,
                    "memory_usage": memory_usage,
                    "active_connections": active_conns,
                }
            )
        )
    except Exception as e:
        logging.warning(f"Failed to update system metrics: {e}")


def log_performance_event(
    event_type: str,
    duration: float,
    details: Dict[str, Any],
    client_ip: Optional[str] = None,
):
    """Log performance events with timing data"""
    logging.info(
        f"PERFORMANCE_EVENT: {event_type} - Duration: {duration:.3f}s - {json.dumps(details)} - IP: {client_ip}"
    )


# Global agent instance
agent = None  # Can be SecurityAgent or MockAgent

# In-memory storage for processing jobs
processing_jobs: Dict[str, Dict[str, Any]] = {}


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
        try:
            # Initialize real SecurityAgent
            llm_config = {
                "model": os.getenv("AGENT_LLM_MODEL", "gemini-2.0-flash"),
                "temperature": 0.1,
                "max_tokens": 8000,
                "api_key": os.getenv("GEMINI_API_KEY"),
                "base_url": os.getenv("AGENT_LLM_BASE_URL"),
            }
            print(f"LLM config: model={llm_config['model']}, api_key={'***' if llm_config['api_key'] else 'None'}")

            try:
                agent = SecurityAgent(llm_config=llm_config)
                print("SecurityAgent created")
            except Exception as e2:
                print(f"SecurityAgent creation failed: {e2}")
                raise

            # Add specialized tool sets
            from agent.monitoring_tools import MonitoringTools
            from agent.response_tools import ResponseTools
            from agent.job_tools import JobTools

            monitoring_tools = MonitoringTools(agent)
            response_tools = ResponseTools(agent)
            job_tools = JobTools(agent)

            agent.add_tools([
                monitoring_tools.create_monitoring_tool(),
                monitoring_tools.create_learning_tool(),
                response_tools.create_orchestration_tool(),
                response_tools.create_admin_tool(),
                job_tools.create_job_management_tool(),
            ])

            # Configure agent
            from config.agent_prompts import AGENT_SYSTEM_PROMPT
            agent.set_system_prompt(AGENT_SYSTEM_PROMPT)

            print(f"Initialized real SecurityAgent with {llm_config['model']}")
        except Exception as e:
            print(f"Failed to initialize real agent: {e}, falling back to mock")
            # Fallback to mock agent
            class MockTool:
                def __init__(self, name, func):
                    self.name = name
                    self.function = func

            class MockAgent:
                def __init__(self):
                    self.tools = [
                        MockTool('chat_response', self.chat_response),
                        MockTool('sanitize_content', self.sanitize_content),
                        MockTool('ai_pdf_enhancement', self.ai_pdf_enhancement)
                    ]

                async def chat_response(self, **kwargs):
                    message = kwargs.get('message', 'unknown')
                    return {
                        "success": True,
                        "response": f"Mock Agent: I received your message '{message}'. The real AI agent failed to initialize.",
                        "processing_time": "0.001"
                    }

                async def sanitize_content(self, **kwargs):
                    content = kwargs.get('content', '')
                    # Use bleach for consistent sanitization with main implementation
                    import bleach
                    sanitized = bleach.clean(content, tags=[], strip=True)
                    return {
                        "success": True,
                        "sanitized_content": sanitized,
                        "processing_time": "0.001"
                    }

                async def ai_pdf_enhancement(self, **kwargs):
                    content = kwargs.get('content', '')
                    return {
                        "success": True,
                        "enhanced_content": content,
                        "structured_output": {"mock": "data"},
                        "processing_time": "0.001"
                    }

            agent = MockAgent()
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
        raise HTTPException(
            status_code=400, detail=f"Failed to extract PDF text: {str(e)}"
        )


class SanitizeRequest(BaseModel):
    content: str
    classification: str = "general"

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError("Content too long")
        return sanitize_input(v)

    @field_validator("classification")
    @classmethod
    def validate_classification(cls, v):
        allowed = ["general", "llm", "api"]
        if v not in allowed:
            raise ValueError(f"Classification must be one of: {allowed}")
        return v


class SanitizeResponse(BaseModel):
    success: bool
    sanitized_content: Optional[str] = None
    trustToken: Optional[dict] = None
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


class ProcessPdfJobResponse(BaseModel):
    job_id: str
    status: str
    message: str


async def process_pdf_background(job_id: str, file_content: bytes, filename: str, client_ip: str):
    """Background task to process PDF"""
    processing_stages = []
    file_size = len(file_content)
    start_time = time.time()

    try:
        # Update job status
        processing_jobs[job_id]["status"] = "processing"
        processing_jobs[job_id]["stages"] = processing_stages

        # Validate file type
        validation_start = time.time()
        if not validate_file_type(file_content, filename):
            processing_jobs[job_id]["status"] = "failed"
            processing_jobs[job_id]["error"] = "Invalid file type. Only PDF files are allowed"
            return

        validation_duration = time.time() - validation_start
        PDF_PROCESSING_DURATION.labels(stage="validation").observe(validation_duration)
        PDF_PROCESSING_FILE_SIZE.observe(file_size)
        processing_stages.append(
            {
                "stage": "file_validation",
                "status": "completed",
                "timestamp": datetime.now().isoformat(),
                "duration": validation_duration,
            }
        )
        processing_jobs[job_id]["stages"] = processing_stages

        # Extract text from PDF
        processing_stages.append(
            {
                "stage": "text_extraction",
                "status": "in_progress",
                "timestamp": datetime.now().isoformat(),
            }
        )
        processing_jobs[job_id]["stages"] = processing_stages

        extraction_start = time.time()
        extracted_text = extract_pdf_text(file_content)
        extraction_duration = time.time() - extraction_start

        if not extracted_text:
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = "No text could be extracted from the PDF"
            processing_jobs[job_id]["status"] = "failed"
            processing_jobs[job_id]["stages"] = processing_stages
            return

        # Sanitize extracted text
        extracted_text = sanitize_input(extracted_text)

        processing_stages[-1]["status"] = "completed"
        processing_stages[-1]["duration"] = extraction_duration
        processing_stages.append(
            {
                "stage": "sanitization",
                "status": "in_progress",
                "timestamp": datetime.now().isoformat(),
            }
        )
        processing_jobs[job_id]["stages"] = processing_stages

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
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = "Sanitize tool not found"
            processing_jobs[job_id]["status"] = "failed"
            processing_jobs[job_id]["stages"] = processing_stages
            return

        # Call the sanitize tool
        sanitize_result = await sanitize_tool.function(
            content=extracted_text, classification="general"
        )

        sanitization_duration = time.time() - sanitization_start
        PDF_PROCESSING_DURATION.labels(stage="sanitization").observe(
            sanitization_duration
        )

        if not sanitize_result.get("success", False):
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = sanitize_result.get("error")
            processing_stages[-1]["duration"] = sanitization_duration
            processing_jobs[job_id]["status"] = "failed"
            processing_jobs[job_id]["stages"] = processing_stages
            return

        processing_stages[-1]["status"] = "completed"
        processing_stages[-1]["duration"] = sanitization_duration
        processing_stages.append(
            {
                "stage": "ai_enhancement",
                "status": "in_progress",
                "timestamp": datetime.now().isoformat(),
            }
        )
        processing_jobs[job_id]["stages"] = processing_stages

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
            processing_jobs[job_id]["status"] = "failed"
            processing_jobs[job_id]["stages"] = processing_stages
            return

        # Call the enhance tool with json_schema transformation
        enhance_result = await enhance_tool.function(
            content=sanitize_result.get("sanitized_content", ""),
            transformation_type="json_schema",
        )

        enhancement_duration = time.time() - enhancement_start
        PDF_PROCESSING_DURATION.labels(stage="enhancement").observe(
            enhancement_duration
        )

        processing_stages[-1]["status"] = (
            "completed" if enhance_result.get("success", False) else "failed"
        )
        processing_stages[-1]["duration"] = enhancement_duration
        if not enhance_result.get("success", False):
            processing_stages[-1]["error"] = enhance_result.get("error")

        # Record final metrics
        total_duration = time.time() - start_time
        success = enhance_result.get("success", False)
        PDF_PROCESSING_REQUESTS.labels(
            status="success" if success else "failed", stage="total"
        ).inc()
        PDF_PROCESSING_DURATION.labels(stage="total").observe(total_duration)

        # Log performance event
        log_performance_event(
            "PDF_PROCESSING_COMPLETED",
            total_duration,
            {
                "success": success,
                "file_size": file_size,
                "extracted_text_length": len(extracted_text),
                "stages": len(processing_stages),
            },
            client_ip,
        )

        # Generate trust token for the enhanced content
        trust_token = None
        structured_output = enhance_result.get("structured_output")
        if success and enhance_result.get("enhanced_content"):
            trust_token = generate_trust_token(enhance_result["enhanced_content"], ["PDFProcessing", "AIEnhancement", "BleachSanitization"])
            # Add trust token to structured output if it exists
            if structured_output and isinstance(structured_output, dict):
                structured_output["trustToken"] = trust_token
                # Sanitize the structured output
                structured_output = sanitize_dict(structured_output)

        # Sanitize enhanced content
        enhanced_content = enhance_result.get("enhanced_content")
        if enhanced_content:
            enhanced_content = sanitize_input(enhanced_content)

        # Update job with results
        processing_jobs[job_id]["status"] = "completed" if success else "failed"
        processing_jobs[job_id]["result"] = {
            "success": success,
            "sanitized_content": sanitize_result.get("sanitized_content"),
            "enhanced_content": enhanced_content,
            "structured_output": structured_output,
            "trustToken": trust_token,
            "processing_time": enhance_result.get("processing_metadata", {}).get(
                "processing_time"
            ),
            "error": enhance_result.get("error"),
            "extracted_text_length": len(extracted_text),
        }
        processing_jobs[job_id]["stages"] = processing_stages

    except Exception as e:
        # Log error securely
        log_security_event(
            "PROCESSING_ERROR", {"error_type": type(e).__name__}, client_ip
        )
        processing_jobs[job_id]["status"] = "failed"
        processing_jobs[job_id]["error"] = "Internal processing error"
        if processing_stages:
            processing_stages[-1]["status"] = "failed"
            processing_stages[-1]["error"] = "Internal processing error"
        processing_jobs[job_id]["stages"] = processing_stages

        # Record metrics
        total_duration = time.time() - start_time
        PDF_PROCESSING_REQUESTS.labels(status="internal_error", stage="total").inc()
        PDF_PROCESSING_DURATION.labels(stage="total").observe(total_duration)


@app.post("/api/documents/upload", response_model=ProcessPdfJobResponse)
async def process_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Start PDF processing job and return job ID"""
    print(f"Processing PDF upload: {file.filename}")
    client_ip = request.client.host if request.client else "unknown"

    # Update system metrics at start
    update_system_metrics()

    # Rate limiting
    if not check_rate_limit(client_ip):
        PDF_PROCESSING_REQUESTS.labels(status="rate_limited", stage="rate_limit").inc()
        log_security_event(
            "RATE_LIMIT_EXCEEDED", {"endpoint": "/api/process-pdf"}, client_ip
        )
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Authentication
    if not authenticate_request(credentials):
        PDF_PROCESSING_REQUESTS.labels(status="unauthorized", stage="auth").inc()
        log_security_event("AUTH_FAILED", {"endpoint": "/api/process-pdf"}, client_ip)
        raise HTTPException(status_code=401, detail="Invalid API key")

    file_size = 0
    file_content = b""

    try:
        # Read file in chunks to check size
        while chunk := await file.read(8192):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                log_security_event(
                    "FILE_TOO_LARGE",
                    {"size": file_size, "max": MAX_FILE_SIZE},
                    client_ip,
                )
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size: {MAX_FILE_SIZE} bytes",
                )
            file_content += chunk

        print(f"File read: size={file_size}, filename={file.filename}")

        # Validate file type
        if not validate_file_type(file_content, file.filename or "unknown.pdf"):
            print(f"Invalid file type: {file.filename}")
            log_security_event(
                "INVALID_FILE_TYPE",
                {"filename": file.filename, "size": file_size},
                client_ip,
            )
            raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are accepted.")

        # Generate job ID
        job_id = f"pdf_{secrets.token_hex(8)}"
        filename = file.filename or "unknown.pdf"

        # Initialize job
        processing_jobs[job_id] = {
            "status": "queued",
            "filename": filename,
            "file_size": file_size,
            "client_ip": client_ip,
            "created_at": datetime.now().isoformat(),
            "stages": [],
        }

        # Start background processing
        background_tasks.add_task(
            process_pdf_background, job_id, file_content, filename, client_ip
        )

        log_security_event(
            "PDF_PROCESSING_STARTED",
            {"job_id": job_id, "filename": filename, "size": file_size},
            client_ip,
        )

        return ProcessPdfJobResponse(
            job_id=job_id,
            status="queued",
            message="PDF processing job started successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in process_pdf: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/documents/{job_id}/status")
async def get_processing_status(
    job_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get processing status for a job"""
    print(f"Getting status for job: {job_id}")
    # Check authentication
    if not authenticate_request(credentials):
        raise HTTPException(status_code=401, detail="Invalid API key")

    if job_id not in processing_jobs:
        print(f"Job not found: {job_id}")
        raise HTTPException(status_code=404, detail="Job not found")

    job = processing_jobs[job_id]

    # Calculate progress percentage with weighted stages
    stages = job.get("stages", [])
    stage_weights = {
        "file_validation": 0.1,    # 10%
        "text_extraction": 0.3,    # 30%
        "sanitization": 0.3,       # 30%
        "ai_enhancement": 0.3      # 30%
    }
    progress_percentage = 0
    completed_stages = 0
    for stage in stages:
        if stage["status"] == "completed":
            progress_percentage += stage_weights.get(stage["stage"], 0) * 100
            completed_stages += 1
        elif stage["status"] == "in_progress":
            # Add half the weight for in-progress stages
            progress_percentage += stage_weights.get(stage["stage"], 0) * 50

    # Estimate time remaining (simple heuristic: assume 10s per stage)
    total_stages = 4
    remaining_stages = total_stages - completed_stages
    estimated_time_remaining = max(0, remaining_stages * 10)  # seconds

    response = {
        "job_id": job_id,
        "status": job["status"],
        "progress_percentage": progress_percentage,
        "estimated_time_remaining": estimated_time_remaining,
        "stages": stages,
        "filename": job.get("filename"),
        "file_size": job.get("file_size"),
        "created_at": job.get("created_at"),
    }

    if job["status"] == "completed":
        response["result"] = job.get("result")
    elif job["status"] == "failed":
        response["error"] = job.get("error")

    return response


@app.post("/api/sanitize/json", response_model=SanitizeResponse)
async def sanitize_content(
    request: Request,
    req: SanitizeRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Sanitize content using the security agent"""
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting
    if not check_rate_limit(client_ip):
        log_security_event(
            "RATE_LIMIT_EXCEEDED", {"endpoint": "/api/sanitize/json"}, client_ip
        )
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
            content=req.content, classification=req.classification
        )

        # Generate trust token if sanitization was successful
        trust_token = None
        if result.get("success", False) and result.get("sanitized_content"):
            trust_token = generate_trust_token(result["sanitized_content"])

        return SanitizeResponse(
            success=result.get("success", False),
            sanitized_content=result.get("sanitized_content"),
            trustToken=trust_token,
            processing_time=result.get("processing_time"),
            error=result.get("error"),
        )

    except Exception as e:
        log_security_event(
            "SANITIZE_ERROR", {"error_type": type(e).__name__}, client_ip
        )
        raise HTTPException(status_code=500, detail="Internal server error")


# Store active WebSocket connections and their associated data
active_connections: Dict[str, Dict[str, Any]] = {}


class ChatMessage(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

    @field_validator("message")
    @classmethod
    def validate_message(cls, v):
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError("Message too long")
        return sanitize_input(v)


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for real-time chat with streaming responses"""
    # Check origin for security
    # origin = websocket.headers.get("origin", "")
    # if origin not in ALLOWED_ORIGINS and ALLOWED_ORIGINS != ["*"]:
    #     await websocket.close(code=1008, reason="Origin not allowed")
    #     return

    await websocket.accept()

    # Generate connection ID
    connection_id = f"conn_{id(websocket)}"
    client_ip = websocket.client.host if websocket.client else "unknown"

    active_connections[connection_id] = {
        "websocket": websocket,
        "agent": None,
        "context": {},
        "connected_at": datetime.now(),
        "client_ip": client_ip,
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

            # Handle ping messages
            if message_data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            user_message = message_data.get("message", "")
            context = message_data.get("context", {})

            # Validate input
            if len(user_message) > MAX_TEXT_LENGTH:
                await websocket.send_json(
                    {"type": "error", "error": "Message too long"}
                )
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
            await websocket.send_json(
                {"type": "error", "error": "Internal server error"}
            )
        except Exception:
            pass
    finally:
        # Clean up connection
        if connection_id in active_connections:
            del active_connections[connection_id]


async def stream_chat_response(
    websocket: WebSocket, agent, message: str, context: Dict[str, Any]
):
    """Stream chat response using the security agent"""
    try:
        # Send typing indicator
        await websocket.send_json({"type": "typing", "status": True})

        # Use the agent's chat tool
        chat_tool = None
        for tool in agent.tools:
            if tool.name == "chat_response":
                chat_tool = tool
                break

        if not chat_tool:
            await websocket.send_json(
                {"type": "error", "error": "Chat tool not available"}
            )
            return

        # Call the chat tool
        result = await chat_tool.function(message=message, context=context)

        if not result.get("success", False):
            await websocket.send_json(
                {"type": "error", "error": result.get("error", "Failed to generate response")}
            )
            return

        response = result.get("response", "")

        # Split response into chunks for streaming effect
        words = response.split()
        chunk_size = 10

        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i : i + chunk_size])
            await websocket.send_json({"type": "chunk", "content": chunk + " "})
            await asyncio.sleep(0.1)  # Small delay for streaming effect

        # Send completion
        await websocket.send_json({"type": "complete"})

    except Exception as e:
        logging.error(f"Error in stream_chat_response: {e}")
        await websocket.send_json(
            {"type": "error", "error": "Failed to generate response"}
        )
    finally:
        # Stop typing indicator
        await websocket.send_json({"type": "typing", "status": False})


@app.post("/api/chat")
async def http_chat(
    request: Request,
    chat_request: ChatMessage,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
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
        log_security_event(
            "INPUT_TOO_LARGE", {"length": len(chat_request.message)}, client_ip
        )
        raise HTTPException(status_code=413, detail="Message too long")

    # Sanitize input
    chat_request.message = sanitize_input(chat_request.message)

    try:
        agent = await get_agent()

        # Use the agent's chat tool
        chat_tool = None
        for tool in agent.tools:
            if tool.name == "chat_response":
                chat_tool = tool
                break

        if not chat_tool:
            raise HTTPException(status_code=500, detail="Chat tool not available")

        # Call the chat tool
        result = await chat_tool.function(
            message=chat_request.message, context=chat_request.context
        )
        print(f"Chat tool result: {result}")

        if not result.get("success", False):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to generate response")
            )

        response = result.get("response", "")

        # Record success metrics
        duration = time.time() - start_time
        CHAT_REQUESTS.labels(status="success", type="http").inc()
        CHAT_DURATION.labels(type="http").observe(duration)
        log_performance_event(
            "CHAT_COMPLETED",
            duration,
            {
                "message_length": len(chat_request.message),
                "response_length": len(response),
            },
            client_ip,
        )

        return {
            "success": True,
            "response": response,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        # Record error metrics
        duration = time.time() - start_time
        CHAT_REQUESTS.labels(status="error", type="http").inc()
        CHAT_DURATION.labels(type="http").observe(duration)
        log_performance_event(
            "CHAT_ERROR",
            duration,
            {
                "error_type": type(e).__name__,
                "message_length": len(chat_request.message),
            },
            client_ip,
        )
        log_security_event("CHAT_ERROR", {"error_type": type(e).__name__}, client_ip)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/validate-key")
async def validate_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate API key"""
    if authenticate_request(credentials):
        return {"valid": True}
    else:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
