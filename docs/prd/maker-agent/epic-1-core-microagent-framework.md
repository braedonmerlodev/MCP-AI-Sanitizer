# Epic 1: BMAD Maker Extension Setup

Configure the existing BMAD framework to explicitly support MAKER principles. This epic establishes the foundation by customizing BMAD's agent architecture for microagent decomposition and error correction.

## Story 1.1: BMAD Configuration for MAKER

As a developer, I want to configure BMAD core settings for MAKER principles, so that the framework supports microagent patterns.

**Acceptance Criteria**

1. Update core-config.yaml with MAKER-specific settings
2. Enable MAKER mode in BMAD agent configurations
3. Configure agent dependencies for microagent workflows
4. Validate BMAD setup against MAKER requirements

## Story 1.2: Agent Directory Analysis

As a developer, I want to analyze existing BMAD agents for MAKER alignment, so that I can identify extension points.

**Acceptance Criteria**

1. Review all agents in .bmad-core/agents/ for microagent potential
2. Document current voting/consensus capabilities in QA agents
3. Identify red-flagging opportunities in risk profiles
4. Create mapping of BMAD agents to MAKER roles

## Story 1.3: MAKER Template Creation

As a developer, I want to create BMAD templates for MAKER workflows, so that new agents follow MAKER patterns.

**Acceptance Criteria**

1. Create maker-agent-tmpl.yaml in .bmad-core/templates/
2. Define microagent interface standards
3. Include voting and red-flagging sections
4. Ensure compatibility with existing BMAD structure
