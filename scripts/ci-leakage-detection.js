#!/usr/bin/env node

/**
 * CI/CD Leakage Detection Script
 *
 * This script performs automated metadata leakage detection as part of the CI/CD pipeline.
 * It scans build artifacts, test outputs, and deployment packages for sanitization metadata leakage.
 *
 * Usage:
 *   node scripts/ci-leakage-detection.js [options]
 *
 * Options:
 *   --scan-path <path>     Path to scan (default: current directory)
 *   --output-format <fmt>  Output format: json, text, junit (default: text)
 *   --fail-on-findings     Exit with error code if findings are detected
 *   --severity-threshold   Minimum severity to report: low, medium, high, critical (default: low)
 *   --exclude-patterns     Comma-separated patterns to exclude from scanning
 */

const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`),
  ),
  transports: [new winston.transports.Console()],
});

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  scanPath: '.',
  outputFormat: 'text',
  failOnFindings: false,
  severityThreshold: 'low',
  excludePatterns: [],
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--scan-path':
      options.scanPath = args[++i];
      break;
    case '--output-format':
      options.outputFormat = args[++i];
      break;
    case '--fail-on-findings':
      options.failOnFindings = true;
      break;
    case '--severity-threshold':
      options.severityThreshold = args[++i];
      break;
    case '--exclude-patterns':
      options.excludePatterns = args[++i].split(',');
      break;
  }
}

/**
 * Leakage detection patterns for CI/CD artifacts
 */
const ciLeakagePatterns = [
  // Sanitization test results in logs
  {
    name: 'sanitizationTests-in-logs',
    pattern: /"sanitizationTests"\s*:/gi,
    severity: 'high',
    description: 'Sanitization test results found in log files',
    fileTypes: ['.log', '.txt', '.out'],
  },
  // Threat classification in build artifacts
  {
    name: 'threatClassification-in-artifacts',
    pattern: /"threatClassification"\s*:\s*"[^"]*"/gi,
    severity: 'critical',
    description: 'Threat classification data found in build artifacts',
    fileTypes: ['.json', '.js', '.ts', '.txt'],
  },
  // HITL escalation IDs in any files
  {
    name: 'hitl-escalation-ids',
    pattern: /"hitl_[^"]*"/gi,
    severity: 'critical',
    description: 'HITL escalation identifiers found in artifacts',
    fileTypes: ['*'],
  },
  // Trust tokens in configuration
  {
    name: 'trust-tokens-in-config',
    pattern: /"trustToken"\s*:\s*{[^}]*}/gi,
    severity: 'high',
    description: 'Trust token data found in configuration files',
    fileTypes: ['.json', '.yaml', '.yml', '.config', '.env'],
  },
  // Audit trail data in public files
  {
    name: 'audit-trails-in-public',
    pattern: /"auditId"\s*:\s*"[^"]*"/gi,
    severity: 'medium',
    description: 'Audit trail identifiers found in potentially public files',
    fileTypes: ['.js', '.ts', '.json', '.html', '.css'],
  },
  // Data integrity validation in client code
  {
    name: 'data-integrity-in-client',
    pattern: /"validationId"\s*:\s*"[^"]*"/gi,
    severity: 'medium',
    description: 'Data integrity validation IDs found in client-side code',
    fileTypes: ['.js', '.ts', '.html'],
  },
  // Sanitization pipeline steps in bundles
  {
    name: 'pipeline-steps-in-bundles',
    pattern: /"appliedRules"\s*:\s*\[[^\]]*\]/gi,
    severity: 'high',
    description: 'Sanitization pipeline steps found in bundled code',
    fileTypes: ['.js', '.min.js', '.bundle.js'],
  },
];

/**
 * Check if file should be excluded based on patterns
 */
function shouldExcludeFile(filePath, excludePatterns) {
  return excludePatterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(filePath);
    } catch (e) {
      // Invalid regex pattern, skip
      return false;
    }
  });
}

/**
 * Check if file matches the pattern's file types
 */
function matchesFileType(filePath, fileTypes) {
  if (fileTypes.includes('*')) return true;

  const ext = path.extname(filePath).toLowerCase();
  return fileTypes.some((type) => type.toLowerCase() === ext);
}

/**
 * Scan a single file for leakage patterns
 */
async function scanFile(filePath, patterns) {
  const findings = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    patterns.forEach((pattern) => {
      if (!matchesFileType(filePath, pattern.fileTypes)) return;

      let match;
      const regex = new RegExp(pattern.pattern);

      // Reset regex lastIndex for global patterns
      if (regex.global) {
        regex.lastIndex = 0;
      }

      let lineNumber = 1;
      for (const line of lines) {
        regex.lastIndex = 0; // Reset for each line
        if ((match = regex.exec(line)) !== null) {
          findings.push({
            file: filePath,
            line: lineNumber,
            pattern: pattern.name,
            severity: pattern.severity,
            description: pattern.description,
            match: match[0].substring(0, 100), // First 100 chars of match
          });
        }
        lineNumber++;
      }
    });
  } catch (error) {
    if (error.code !== 'EISDIR') {
      // Ignore directory errors
      logger.warn(`Error scanning file ${filePath}: ${error.message}`);
    }
  }

  return findings;
}

/**
 * Recursively scan directory for leakage
 */
async function scanDirectory(dirPath, patterns, excludePatterns) {
  const findings = [];

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);

      if (shouldExcludeFile(fullPath, excludePatterns)) {
        continue;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip common directories that shouldn't contain sensitive data
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.nyc_output'];
        if (!skipDirs.includes(item)) {
          const subFindings = await scanDirectory(fullPath, patterns, excludePatterns);
          findings.push(...subFindings);
        }
      } else if (stat.isFile()) {
        const fileFindings = await scanFile(fullPath, patterns);
        findings.push(...fileFindings);
      }
    }
  } catch (error) {
    logger.warn(`Error scanning directory ${dirPath}: ${error.message}`);
  }

  return findings;
}

/**
 * Filter findings by severity threshold
 */
function filterBySeverity(findings, threshold) {
  const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
  const minLevel = severityLevels[threshold] || 1;

  return findings.filter((finding) => severityLevels[finding.severity] >= minLevel);
}

/**
 * Output findings in specified format
 */
function outputFindings(findings, format) {
  switch (format) {
    case 'json':
      console.log(
        JSON.stringify(
          {
            summary: {
              total: findings.length,
              bySeverity: findings.reduce((acc, f) => {
                acc[f.severity] = (acc[f.severity] || 0) + 1;
                return acc;
              }, {}),
            },
            findings: findings,
          },
          null,
          2,
        ),
      );
      break;

    case 'junit':
      console.log('<?xml version="1.0" encoding="UTF-8"?>');
      console.log('<testsuites>');
      console.log(
        `  <testsuite name="leakage-detection" tests="${findings.length}" failures="${findings.length}">`,
      );

      findings.forEach((finding, index) => {
        console.log(`    <testcase name="leakage-${index}" classname="${finding.pattern}">`);
        console.log(`      <failure message="${finding.description}" type="${finding.severity}">`);
        console.log(`        File: ${finding.file}:${finding.line}`);
        console.log(`        Match: ${finding.match}`);
        console.log(`      </failure>`);
        console.log(`    </testcase>`);
      });

      console.log('  </testsuite>');
      console.log('</testsuites>');
      break;

    default: // text
      console.log(`\n🔍 Leakage Detection Results`);
      console.log(`==========================`);
      console.log(`Total findings: ${findings.length}`);

      if (findings.length > 0) {
        const bySeverity = findings.reduce((acc, f) => {
          acc[f.severity] = (acc[f.severity] || 0) + 1;
          return acc;
        }, {});

        console.log(`By severity: ${JSON.stringify(bySeverity, null, 2)}`);

        console.log(`\n📋 Detailed Findings:`);
        findings.forEach((finding, index) => {
          console.log(`\n${index + 1}. ${finding.severity.toUpperCase()}: ${finding.description}`);
          console.log(`   File: ${finding.file}:${finding.line}`);
          console.log(`   Pattern: ${finding.pattern}`);
          console.log(`   Match: ${finding.match}`);
        });
      } else {
        console.log(`✅ No leakage findings detected`);
      }
      break;
  }
}

/**
 * Main execution function
 */
async function main() {
  logger.info(`Starting CI/CD leakage detection scan`);
  logger.info(`Scan path: ${options.scanPath}`);
  logger.info(`Output format: ${options.outputFormat}`);
  logger.info(`Severity threshold: ${options.severityThreshold}`);
  logger.info(`Fail on findings: ${options.failOnFindings}`);

  try {
    // Perform the scan
    const allFindings = await scanDirectory(
      options.scanPath,
      ciLeakagePatterns,
      options.excludePatterns,
    );

    // Filter by severity
    const filteredFindings = filterBySeverity(allFindings, options.severityThreshold);

    // Output results
    outputFindings(filteredFindings, options.outputFormat);

    // Exit with appropriate code
    if (options.failOnFindings && filteredFindings.length > 0) {
      logger.error(`Leakage detection failed: ${filteredFindings.length} findings detected`);
      process.exit(1);
    } else {
      logger.info(`Leakage detection completed successfully`);
      process.exit(0);
    }
  } catch (error) {
    logger.error(`Leakage detection failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  scanDirectory,
  scanFile,
  ciLeakagePatterns,
  filterBySeverity,
};
