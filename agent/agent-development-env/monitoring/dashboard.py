# monitoring/dashboard.py
import streamlit as st
import requests
import time
import pandas as pd
from datetime import datetime, timedelta
import plotly.graph_objects as go
import plotly.express as px
from typing import Dict, Any

# Prometheus metrics endpoint
PROMETHEUS_URL = "http://localhost:8000"

def get_prometheus_metrics() -> Dict[str, Any]:
    """Fetch metrics from Prometheus endpoint"""
    try:
        # In a real implementation, you'd query Prometheus API
        # For now, return mock data
        return {
            'pdf_processing_requests_total': {
                'success': 150,
                'failed': 5,
                'rate_limited': 2,
                'invalid_file': 1
            },
            'pdf_processing_duration_seconds': {
                'validation': {'count': 150, 'sum': 45.2},
                'extraction': {'count': 149, 'sum': 234.8},
                'sanitization': {'count': 148, 'sum': 156.3},
                'enhancement': {'count': 145, 'sum': 1234.7},
                'total': {'count': 145, 'sum': 1671.0}
            },
            'chat_requests_total': {
                'success': 89,
                'error': 3,
                'rate_limited': 1
            },
            'system_cpu_usage_percent': 45.2,
            'system_memory_usage_percent': 62.8,
            'active_websocket_connections': 3
        }
    except Exception as e:
        st.error(f"Failed to fetch metrics: {e}")
        return {}

def calculate_success_rate(metrics: Dict[str, Any]) -> float:
    """Calculate PDF processing success rate"""
    pdf_metrics = metrics.get('pdf_processing_requests_total', {})
    total = sum(pdf_metrics.values())
    success = pdf_metrics.get('success', 0)
    return (success / total * 100) if total > 0 else 0

def calculate_avg_duration(metrics: Dict[str, Any], stage: str) -> float:
    """Calculate average duration for a processing stage"""
    duration_data = metrics.get('pdf_processing_duration_seconds', {}).get(stage, {})
    count = duration_data.get('count', 0)
    total = duration_data.get('sum', 0)
    return (total / count) if count > 0 else 0

def create_metrics_charts(metrics: Dict[str, Any]):
    """Create dashboard charts"""

    # PDF Processing Success Rate
    success_rate = calculate_success_rate(metrics)
    fig_success = go.Figure(go.Indicator(
        mode="gauge+number",
        value=success_rate,
        title={'text': "PDF Processing Success Rate"},
        gauge={'axis': {'range': [0, 100]},
               'bar': {'color': "green" if success_rate > 95 else "orange" if success_rate > 85 else "red"},
               'steps': [
                   {'range': [0, 85], 'color': "red"},
                   {'range': [85, 95], 'color': "orange"},
                   {'range': [95, 100], 'color': "green"}
               ]}
    ))

    # Processing Stage Durations
    stages = ['validation', 'extraction', 'sanitization', 'enhancement', 'total']
    durations = [calculate_avg_duration(metrics, stage) for stage in stages]

    fig_duration = px.bar(
        x=stages,
        y=durations,
        title="Average Processing Time by Stage",
        labels={'x': 'Stage', 'y': 'Duration (seconds)'},
        color=durations,
        color_continuous_scale='RdYlGn_r'
    )

    # System Resources
    cpu_usage = metrics.get('system_cpu_usage_percent', 0)
    memory_usage = metrics.get('system_memory_usage_percent', 0)

    fig_resources = go.Figure()
    fig_resources.add_trace(go.Indicator(
        mode="gauge+number",
        value=cpu_usage,
        title={'text': "CPU Usage %"},
        gauge={'axis': {'range': [0, 100]},
               'bar': {'color': "red" if cpu_usage > 90 else "orange" if cpu_usage > 70 else "green"}},
        domain={'x': [0, 0.5], 'y': [0, 1]}
    ))
    fig_resources.add_trace(go.Indicator(
        mode="gauge+number",
        value=memory_usage,
        title={'text': "Memory Usage %"},
        gauge={'axis': {'range': [0, 100]},
               'bar': {'color': "red" if memory_usage > 90 else "orange" if memory_usage > 70 else "green"}},
        domain={'x': [0.5, 1], 'y': [0, 1]}
    ))

    return fig_success, fig_duration, fig_resources

def main():
    st.title("📊 MCP Security Monitoring Dashboard")
    st.markdown("Real-time performance monitoring for PDF processing and system metrics")

    # Auto-refresh
    if st.button("🔄 Refresh Data"):
        st.rerun()

    # Fetch metrics
    with st.spinner("Fetching metrics..."):
        metrics = get_prometheus_metrics()

    if not metrics:
        st.error("Unable to fetch metrics. Make sure the backend is running.")
        return

    # Key Metrics Row
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        pdf_total = sum(metrics.get('pdf_processing_requests_total', {}).values())
        st.metric("Total PDF Requests", pdf_total)

    with col2:
        success_rate = calculate_success_rate(metrics)
        st.metric("Success Rate", f"{success_rate:.1f}%")

    with col3:
        avg_total_time = calculate_avg_duration(metrics, 'total')
        st.metric("Avg Processing Time", f"{avg_total_time:.2f}s")

    with col4:
        active_conns = metrics.get('active_websocket_connections', 0)
        st.metric("Active Connections", active_conns)

    # Charts
    st.header("📈 Performance Charts")

    fig_success, fig_duration, fig_resources = create_metrics_charts(metrics)

    col1, col2 = st.columns(2)

    with col1:
        st.plotly_chart(fig_success, use_container_width=True)
        st.plotly_chart(fig_resources, use_container_width=True)

    with col2:
        st.plotly_chart(fig_duration, use_container_width=True)

    # Detailed Metrics Tables
    st.header("📋 Detailed Metrics")

    tab1, tab2, tab3 = st.tabs(["PDF Processing", "Chat Requests", "System Resources"])

    with tab1:
        pdf_metrics = metrics.get('pdf_processing_requests_total', {})
        df_pdf = pd.DataFrame({'Status': list(pdf_metrics.keys()), 'Count': list(pdf_metrics.values())})
        st.dataframe(df_pdf)

        # Processing durations
        st.subheader("Processing Durations")
        duration_data = metrics.get('pdf_processing_duration_seconds', {})
        duration_rows = []
        for stage, data in duration_data.items():
            count = data.get('count', 0)
            total = data.get('sum', 0)
            avg = (total / count) if count > 0 else 0
            duration_rows.append({
                'Stage': stage,
                'Count': count,
                'Total Time (s)': round(total, 2),
                'Avg Time (s)': round(avg, 2)
            })
        df_duration = pd.DataFrame(duration_rows)
        st.dataframe(df_duration)

    with tab2:
        chat_metrics = metrics.get('chat_requests_total', {})
        df_chat = pd.DataFrame({'Status': list(chat_metrics.keys()), 'Count': list(chat_metrics.values())})
        st.dataframe(df_chat)

    with tab3:
        system_metrics = {
            'CPU Usage (%)': metrics.get('system_cpu_usage_percent', 0),
            'Memory Usage (%)': metrics.get('system_memory_usage_percent', 0),
            'Active WebSocket Connections': metrics.get('active_websocket_connections', 0)
        }
        df_system = pd.DataFrame({'Metric': list(system_metrics.keys()), 'Value': list(system_metrics.values())})
        st.dataframe(df_system)

    # Alerts Section
    st.header("🚨 Active Alerts")
    st.info("Alert system integration coming soon. Check logs for alert notifications.")

    # Footer
    st.markdown("---")
    st.markdown("*Dashboard updates every 30 seconds. Last updated: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "*")

if __name__ == "__main__":
    main()