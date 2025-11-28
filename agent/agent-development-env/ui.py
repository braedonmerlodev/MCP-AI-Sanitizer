# ui.py - Simple Streamlit UI for testing the MCP Security Agent
import streamlit as st
import asyncio
from agent.security_agent import SecurityAgent
from agent.monitoring_tools import MonitoringTools
from agent.response_tools import ResponseTools
from agent.job_tools import JobTools
import PyPDF2
import io

# Global agent instance (will be initialized when needed)
agent = None


async def get_agent():
    """Initialize agent asynchronously"""
    global agent
    if agent is None:
        agent = SecurityAgent()
        monitoring_tools = MonitoringTools(agent)
        response_tools = ResponseTools(agent)
        job_tools = JobTools(agent)

        agent.add_tools(
            [
                monitoring_tools.create_monitoring_tool(),
                monitoring_tools.create_learning_tool(),
                response_tools.create_orchestration_tool(),
                response_tools.create_admin_tool(),
                job_tools.create_job_management_tool(),
            ]
        )
    return agent


def extract_pdf_text(uploaded_file):
    """Extract text from uploaded PDF"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(uploaded_file.getvalue()))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        return f"Error extracting PDF text: {str(e)}"


async def process_agent_request(agent, user_input):
    """Process user input through the agent"""
    try:
        result = await agent.run(user_input)
        return result
    except Exception as e:
        return f"Error: {str(e)}"


async def main():
    st.title("🛡️ MCP Security Agent - Test Interface")
    st.markdown("Upload PDFs and chat with the autonomous security agent!")

    # Initialize agent
    agent = await get_agent()

    try:
        # PDF Upload Section
        st.header("📄 PDF Upload")
        uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")

        if uploaded_file is not None:
            st.success(f"Uploaded: {uploaded_file.name}")

            if st.button("Extract & Analyze PDF"):
                with st.spinner("Extracting text and analyzing..."):
                    pdf_text = extract_pdf_text(uploaded_file)

                    if pdf_text and not pdf_text.startswith("Error"):
                        st.text_area(
                            "Extracted Text Preview",
                            (
                                pdf_text[:1000] + "..."
                                if len(pdf_text) > 1000
                                else pdf_text
                            ),
                            height=200,
                        )

                        # Analyze with AI
                        analysis_prompt = f"Analyze this PDF content for security risks and provide a summary: {pdf_text[:2000]}"
                        analysis_result = await process_agent_request(
                            agent, analysis_prompt
                        )
                        st.subheader("🤖 AI Analysis")
                        st.write(analysis_result)
                    else:
                        st.error(pdf_text)

        # Chat Interface
        st.header("💬 Chat with Agent")

        # Initialize chat history
        if "messages" not in st.session_state:
            st.session_state.messages = []

        # Display chat history
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        # Chat input
        if prompt := st.chat_input("Ask the agent anything..."):
            # Add user message to history
            st.session_state.messages.append({"role": "user", "content": prompt})

            # Display user message
            with st.chat_message("user"):
                st.markdown(prompt)

            # Get agent response
            with st.chat_message("assistant"):
                with st.spinner("Agent is thinking..."):
                    response = await process_agent_request(agent, prompt)
                    st.markdown(response)

            # Add assistant response to history
            st.session_state.messages.append({"role": "assistant", "content": response})

        # Quick Action Buttons
        st.header("⚡ Quick Actions")
        col1, col2, col3 = st.columns(3)

        with col1:
            if st.button("🔍 Health Check"):
                with st.spinner("Checking system health..."):
                    result = await process_agent_request(
                        agent, "Perform system health check"
                    )
                    st.success("Health Check Complete")
                    st.write(result)

        with col2:
            if st.button("📊 Monitor System"):
                with st.spinner("Monitoring system..."):
                    result = await process_agent_request(agent, "Monitor system status")
                    st.info("Monitoring Complete")
                    st.write(result)

        with col3:
            if st.button("🧠 Learn from Data"):
                with st.spinner("Analyzing recent incidents..."):
                    result = await process_agent_request(
                        agent, "Analyze recent security incidents"
                    )
                    st.info("Learning Complete")
                    st.write(result)

        # Footer
        st.markdown("---")
        st.markdown("*Built with Streamlit for testing the MCP Security Agent*")
    finally:
        # Ensure the agent session is closed
        await agent.close()


if __name__ == "__main__":
    asyncio.run(main())
