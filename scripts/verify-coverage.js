#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.join(__dirname, '..', 'coverage', 'coverage-final.json');
const THRESHOLD = 80; // 80%

function calculateCoverage(data) {
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalBranches = 0;
  let coveredBranches = 0;

  // Track lines covered
  const linesCovered = new Set();
  const linesTotal = new Set();

  for (const filePath in data) {
    const fileData = data[filePath];

    // Statements
    for (const stmtId in fileData.s) {
      totalStatements++;
      if (fileData.s[stmtId] > 0) {
        coveredStatements++;
        // Add line to covered
        const stmt = fileData.statementMap[stmtId];
        linesCovered.add(`${filePath}:${stmt.start.line}`);
      }
      // Add to total lines
      const stmt = fileData.statementMap[stmtId];
      linesTotal.add(`${filePath}:${stmt.start.line}`);
    }

    // Functions
    for (const fnId in fileData.f) {
      totalFunctions++;
      if (fileData.f[fnId] > 0) {
        coveredFunctions++;
      }
    }

    // Branches
    for (const branchId in fileData.b) {
      const branch = fileData.b[branchId];
      for (let i = 0; i < branch.length; i++) {
        totalBranches++;
        if (branch[i] > 0) {
          coveredBranches++;
        }
      }
    }
  }

  const statementsPct = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;
  const functionsPct = totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0;
  const branchesPct = totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0;
  const linesPct = linesTotal.size > 0 ? (linesCovered.size / linesTotal.size) * 100 : 0;

  return {
    statements: { covered: coveredStatements, total: totalStatements, pct: statementsPct },
    functions: { covered: coveredFunctions, total: totalFunctions, pct: functionsPct },
    branches: { covered: coveredBranches, total: totalBranches, pct: branchesPct },
    lines: { covered: linesCovered.size, total: linesTotal.size, pct: linesPct },
  };
}

function main() {
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error(`Coverage file not found: ${COVERAGE_FILE}`);
    console.error('Run "npm run test:coverage" first to generate coverage reports.');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
  } catch (err) {
    console.error(`Error reading coverage file: ${err.message}`);
    process.exit(1);
  }

  const coverage = calculateCoverage(data);

  console.log('Coverage Verification Results:');
  console.log('==============================');

  const metrics = ['statements', 'branches', 'functions', 'lines'];
  let allPass = true;

  for (const metric of metrics) {
    const { covered, total, pct } = coverage[metric];
    const pass = pct >= THRESHOLD;
    const status = pass ? 'PASS' : 'FAIL';
    console.log(
      `${metric.charAt(0).toUpperCase() + metric.slice(1)}: ${pct.toFixed(2)}% (${covered}/${total}) - ${status}`,
    );
    if (!pass) allPass = false;
  }

  console.log('');

  if (allPass) {
    console.log('✅ All coverage metrics meet the 80% threshold.');
    process.exit(0);
  } else {
    console.log('❌ Some coverage metrics are below the 80% threshold.');
    console.log('Please improve test coverage and run again.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { calculateCoverage };
