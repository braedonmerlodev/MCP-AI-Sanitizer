# Infrastructure and Deployment

## Infrastructure as Code

- **Tool:** Azure Bicep 0.22.6
- **Location:** `infrastructure/azure-bicep`
- **Approach:** Declarative templates for Azure resources (Functions, Storage, etc.)

## Deployment Strategy

- **Strategy:** Blue-green deployment for zero-downtime updates
- **CI/CD Platform:** GitHub Actions
- **Pipeline Configuration:** `.github/workflows/deploy.yml`

## Environments

- **dev:** Development environment for testing - Local or Azure free tier
- **staging:** Pre-production for integration testing - Azure with limited resources
- **prod:** Production environment - Full Azure setup with monitoring

## Environment Promotion Flow

dev -> staging -> prod (automated via CI/CD on successful tests)

## Rollback Strategy

- **Primary Method:** Quick rollback to previous deployment version via Azure portal or CLI
- **Trigger Conditions:** Failed health checks or high error rates
- **Recovery Time Objective:** <5 minutes for critical issues
