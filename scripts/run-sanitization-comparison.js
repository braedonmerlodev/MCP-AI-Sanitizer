#!/usr/bin/env node

/**
 * Sanitization Library Comparison Test Runner
 *
 * Runs comprehensive comparison between Node.js sanitization libraries
 * and Python bleach equivalent functionality.
 */

const BleachNodeComparison = require('../src/utils/bleach-nodejs-comparison');
const fs = require('fs');
const path = require('path');

async function runComparison() {
  console.log('🔬 Starting Node.js Sanitization Library Comparison\n');

  const comparator = new BleachNodeComparison();

  // Run all comparison tests
  console.log('📊 Running comparison tests...');
  const results = comparator.runAllTests();

  // Display results summary
  console.log('\n📈 Comparison Results Summary:');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.summary.totalTests}`);
  console.log('');

  results.summary.libraries.forEach((lib) => {
    const agg = results.aggregateScores[lib];
    console.log(`${lib}:`);
    console.log(`  Successful Tests: ${agg.successfulTests}/${results.summary.totalTests}`);
    console.log(`  Average Accuracy: ${agg.averageAccuracy}%`);
    console.log('');
  });

  // Display detailed test results
  console.log('📋 Detailed Test Results:');
  console.log('='.repeat(50));

  Object.entries(results.tests).forEach(([testName, testResult]) => {
    console.log(`\n${testName}: ${testResult.description}`);
    console.log('-'.repeat(40));

    results.summary.libraries.forEach((lib) => {
      const libResult = testResult.libraries[lib];
      const accuracy = testResult.accuracy[lib];
      const status = libResult.success ? '✅' : '❌';

      console.log(`${lib}: ${status} (${accuracy}% accuracy)`);
      if (!libResult.success) {
        console.log(`  Error: ${libResult.error}`);
      }
    });
  });

  // Generate feature comparison
  console.log('\n🔍 Feature Comparison:');
  console.log('='.repeat(50));

  const features = comparator.generateFeatureComparison();
  Object.entries(features).forEach(([lib, featureData]) => {
    console.log(`\n${lib} (${featureData.type}):`);
    console.log(`  Performance: ${featureData.performance}`);
    console.log(`  Security: ${featureData.security}`);
    console.log(`  Configurability: ${featureData.configurability}`);
    console.log(`  Learning Curve: ${featureData.learningCurve}`);
    console.log(`  Maintenance: ${featureData.maintenance}`);

    console.log('  Pros:');
    featureData.pros.forEach((pro) => console.log(`    • ${pro}`));

    console.log('  Cons:');
    featureData.cons.forEach((con) => console.log(`    • ${con}`));
  });

  // Generate recommendations
  console.log('\n💡 Recommendations:');
  console.log('='.repeat(50));

  const recommendations = comparator.generateRecommendations(results);

  console.log(`Primary Recommendation: ${recommendations.primaryRecommendation}`);
  console.log(`Alternatives: ${recommendations.alternatives.join(', ')}`);

  console.log('\nMigration Strategy:');
  recommendations.migrationStrategy.phases.forEach((phase, index) => {
    console.log(`  ${index + 1}. ${phase}`);
  });
  console.log(`Estimated Effort: ${recommendations.migrationStrategy.estimatedEffort}`);
  console.log(`Risk Level: ${recommendations.migrationStrategy.riskLevel}`);

  console.log('\nRisk Assessment:');
  Object.entries(recommendations.riskAssessment).forEach(([area, risk]) => {
    console.log(`  ${area}: ${risk}`);
  });

  // Save results to file
  const outputDir = path.join(__dirname, '..', 'research');
  const outputFile = path.join(outputDir, 'sanitization-libraries-comparison.json');

  const outputData = {
    timestamp: new Date().toISOString(),
    summary: results.summary,
    aggregateScores: results.aggregateScores,
    featureComparison: features,
    recommendations: recommendations,
    detailedResults: results.tests,
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  // Generate markdown report
  const markdownFile = path.join(outputDir, 'sanitization-libraries-comparison.md');
  const markdownContent = generateMarkdownReport(results, features, recommendations);
  fs.writeFileSync(markdownFile, markdownContent);
  console.log(`📄 Markdown report saved to: ${markdownFile}`);

  console.log('\n✅ Comparison complete!');
}

function generateMarkdownReport(results, features, recommendations) {
  let markdown = `# Node.js Sanitization Libraries Comparison Report

Generated: ${new Date().toISOString()}

## Executive Summary

This report compares Node.js sanitization libraries (DOMPurify, sanitize-html) against Python bleach equivalent functionality to determine the best replacement for comprehensive HTML sanitization.

## Test Results Summary

| Library | Successful Tests | Average Accuracy |
|---------|------------------|------------------|
`;

  results.summary.libraries.forEach((lib) => {
    const agg = results.aggregateScores[lib];
    markdown += `| ${lib} | ${agg.successfulTests}/${results.summary.totalTests} | ${agg.averageAccuracy}% |\n`;
  });

  markdown += `

## Feature Comparison

`;

  Object.entries(features).forEach(([lib, featureData]) => {
    markdown += `### ${lib}

- **Type**: ${featureData.type}
- **Server Compatible**: ${featureData.serverCompatible ? '✅' : '❌'}
- **Client Compatible**: ${featureData.clientCompatible ? '✅' : '❌'}
- **Performance**: ${featureData.performance}
- **Security**: ${featureData.security}
- **Configurability**: ${featureData.configurability}
- **Learning Curve**: ${featureData.learningCurve}
- **Maintenance**: ${featureData.maintenance}

#### Pros
${featureData.pros.map((pro) => `- ${pro}`).join('\n')}

#### Cons
${featureData.cons.map((con) => `- ${con}`).join('\n')}

`;
  });

  markdown += `## Recommendations

### Primary Recommendation
**${recommendations.primaryRecommendation}**

### Alternative Options
${recommendations.alternatives.map((alt) => `- ${alt}`).join('\n')}

### Migration Strategy

#### Phases
${recommendations.migrationStrategy.phases.map((phase, index) => `${index + 1}. ${phase}`).join('\n')}

#### Implementation Details
- **Estimated Effort**: ${recommendations.migrationStrategy.estimatedEffort}
- **Risk Level**: ${recommendations.migrationStrategy.riskLevel}
- **Rollback Plan**: ${recommendations.migrationStrategy.rollbackPlan}

### Risk Assessment
${Object.entries(recommendations.riskAssessment)
  .map(([area, risk]) => `- **${area}**: ${risk}`)
  .join('\n')}

## Detailed Test Results

`;

  Object.entries(results.tests).forEach(([testName, testResult]) => {
    markdown += `### ${testName}
${testResult.description}

| Library | Success | Accuracy | Notes |
|---------|---------|----------|-------|
`;

    results.summary.libraries.forEach((lib) => {
      const libResult = testResult.libraries[lib];
      const accuracy = testResult.accuracy[lib];
      const success = libResult.success ? '✅' : '❌';
      const notes = libResult.success ? '' : libResult.error || 'Failed';

      markdown += `| ${lib} | ${success} | ${accuracy}% | ${notes} |\n`;
    });

    markdown += '\n';
  });

  markdown += `## Conclusion

Based on comprehensive testing and feature analysis, **${recommendations.primaryRecommendation}** is recommended as the primary Node.js sanitization library to replace Python bleach functionality. The library provides excellent security, performance, and configurability while maintaining compatibility with existing Node.js ecosystems.

The migration can be accomplished with ${recommendations.migrationStrategy.estimatedEffort} of development effort and ${recommendations.migrationStrategy.riskLevel} risk level.

## Appendices

### Test Cases
- Basic HTML sanitization
- Script injection prevention
- Event handler removal
- Malicious attribute filtering
- Nested content sanitization
- Protocol validation
- Complex HTML processing
- Unicode attack prevention
- CSS injection protection

### Configuration Used
All libraries were tested with bleach-equivalent configurations allowing common HTML tags (p, br, strong, em, u, h1-h3, ol, ul, li, a) and safe attributes (href, title for links; src, alt, title for images).
`;

  return markdown;
}

// Run the comparison if this script is executed directly
if (require.main === module) {
  runComparison().catch((error) => {
    console.error('Comparison failed:', error);
    process.exit(1);
  });
}

module.exports = { runComparison, generateMarkdownReport };
