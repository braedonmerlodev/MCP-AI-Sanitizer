const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Agent Authentication Middleware
 * Detects and validates agent requests for synchronous processing modes
 */
const agentAuth = (req, res, next) => {
  try {
    // Check for agent identification via header or API key
    const agentKey = req.get('X-Agent-Key');
    const userAgent = req.get('User-Agent');
    const apiKey = req.get('X-API-Key');

    // Agent identification logic
    const isAgentRequest =
      // Direct agent key header
      (agentKey && agentKey.startsWith('agent-')) ||
      // API key with agent prefix
      (apiKey && apiKey.startsWith('agent-')) ||
      // User agent string indicating agent
      (userAgent &&
        (userAgent.includes('BMad-Agent') ||
          userAgent.includes('SecurityAgent') ||
          userAgent.includes('AutonomousAgent')));

    if (isAgentRequest) {
      // Mark request as agent request for downstream processing
      req.isAgentRequest = true;
      req.agentKey = agentKey || apiKey;
      req.agentType = determineAgentType(req);

      logger.info('Agent request detected', {
        agentKey: req.agentKey ? 'present' : 'none',
        agentType: req.agentType,
        userAgent: userAgent,
        ip: req.ip,
        path: req.path,
      });

      // Set headers for agent-specific processing
      res.set('X-Agent-Request', 'true');
      res.set('X-Agent-Type', req.agentType);
    } else {
      req.isAgentRequest = false;
    }

    next();
  } catch (error) {
    logger.error('Agent authentication middleware error', {
      error: error.message,
      path: req.path,
      ip: req.ip,
    });
    // Don't fail the request, just mark as non-agent
    req.isAgentRequest = false;
    next();
  }
};

/**
 * Determines the type of agent making the request
 * @param {Object} req - Express request object
 * @returns {string} - Agent type classification
 */
function determineAgentType(req) {
  const userAgent = req.get('User-Agent') || '';
  const agentKey = req.get('X-Agent-Key') || req.get('X-API-Key') || '';

  // Classification logic based on headers
  if (agentKey.includes('security') || userAgent.includes('SecurityAgent')) {
    return 'security';
  } else if (agentKey.includes('monitor') || userAgent.includes('MonitorAgent')) {
    return 'monitoring';
  } else if (userAgent.includes('BMad-Agent')) {
    return 'bmad-framework';
  } else {
    return 'generic';
  }
}

/**
 * Middleware to enforce sync mode for agent requests
 * Can be used to override async preferences for agents
 */
const enforceAgentSync = (req, res, next) => {
  if (req.isAgentRequest && req.query.async !== 'true') {
    // Force sync mode for agent requests unless explicitly overridden
    req.query.sync = 'true';
    req.forceSync = true;

    logger.debug('Enforcing sync mode for agent request', {
      agentType: req.agentType,
      originalQuery: req.originalUrl,
    });
  }
  next();
};

module.exports = {
  agentAuth,
  enforceAgentSync,
  determineAgentType,
};
