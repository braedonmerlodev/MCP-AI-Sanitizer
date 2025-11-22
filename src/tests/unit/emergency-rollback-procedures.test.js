const fs = require('node:fs');
const path = require('node:path');

describe('Emergency Rollback Procedures', () => {
  const rollbackDocPath = path.resolve(
    __dirname,
    '../../../docs/security/emergency-rollback-procedures.md',
  );

  test('rollback procedures document exists', () => {
    console.log('Resolved path:', rollbackDocPath);
    console.log('__dirname:', __dirname);
    expect(fs.existsSync(rollbackDocPath)).toBe(true);
  });

  test('document contains required sections', () => {
    const content = fs.readFileSync(rollbackDocPath, 'utf8');

    expect(content).toContain('# Emergency Rollback Procedures for Security Hardening Changes');
    expect(content).toContain('## Overview');
    expect(content).toContain('## Prerequisites');
    expect(content).toContain('## Security Changes to be Reverted');
    expect(content).toContain('## Step-by-Step Rollback Procedure');
    expect(content).toContain('## Validation Checks');
    expect(content).toContain('## Risk Assessment');
    expect(content).toContain('## Recovery Plan');
  });

  test('document includes package rollback steps', () => {
    const content = fs.readFileSync(rollbackDocPath, 'utf8');

    expect(content).toContain('express: 4.21.2 → 4.18.2');
    expect(content).toContain('body-parser: 1.20.3 → 1.19.0');
    expect(content).toContain('cookie: 0.7.1 → 0.6.0');
    expect(content).toContain('path-to-regexp: 0.1.12 → 0.1.7');
    expect(content).toContain('send: 0.19.0 → 0.18.0');
  });

  test('document includes validation checklist', () => {
    const content = fs.readFileSync(rollbackDocPath, 'utf8');

    expect(content).toContain('### Pre-Rollback Validation');
    expect(content).toContain('### Package Rollback Validation');
    expect(content).toContain('### Code Rollback Validation');
    expect(content).toContain('### Functional Validation');
    expect(content).toContain('### Post-Restart Validation');
  });

  test('document includes risk assessment', () => {
    const content = fs.readFileSync(rollbackDocPath, 'utf8');

    expect(content).toContain('### Immediate Risks After Rollback');
    expect(content).toContain('### Mitigation Measures');
  });

  test('document includes recovery procedures', () => {
    const content = fs.readFileSync(rollbackDocPath, 'utf8');

    expect(content).toContain('### If Rollback Fails');
    expect(content).toContain('### Forward Recovery');
  });
});
