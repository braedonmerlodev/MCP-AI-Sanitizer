const fs = require('node:fs');
const path = require('node:path');

describe('CI/CD Configuration', () => {
  test('Dockerfile exists and has correct base image', () => {
    const dockerfilePath = path.join(__dirname, '../../../Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
    expect(dockerfileContent).toContain('FROM node:20.11.0');
  });

  test('GitHub Actions workflow exists', () => {
    const workflowPath = path.join(__dirname, '../../../.github/workflows/deploy.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    expect(workflowContent).toContain('CI/CD Pipeline');
    expect(workflowContent).toContain('node-version: "20.11.0"');
  });
});
