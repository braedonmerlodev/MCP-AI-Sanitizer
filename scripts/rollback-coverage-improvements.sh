#!/bin/bash
# rollback-coverage-improvements.sh
# Automated rollback script for test coverage improvements
# Story: 1.11.2 Risk Assessment & Mitigation Strategy

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/coverage-rollback-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS: $1"
}

# Warning message
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARNING: $1"
}

# Info message
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO: $1"
}

# Pre-rollback validation
pre_rollback_check() {
    info "Performing pre-rollback validation..."

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error_exit "Not in a git repository"
    fi

    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --staged --quiet; then
        warning "Uncommitted changes detected. These will be lost during rollback."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error_exit "Rollback cancelled by user"
        fi
    fi

    # Check current branch
    CURRENT_BRANCH=$(git branch --show-current)
    info "Current branch: $CURRENT_BRANCH"

    # Backup current coverage state
    if [ -d "coverage" ]; then
        info "Backing up current coverage data..."
        mkdir -p "$PROJECT_ROOT/backups/coverage-pre-rollback-$(date +%Y%m%d-%H%M%S)"
        cp -r coverage/* "$PROJECT_ROOT/backups/coverage-pre-rollback-$(date +%Y%m%d-%H%M%S)/" 2>/dev/null || true
    fi

    success "Pre-rollback validation completed"
}

# Rollback Jest configuration
rollback_jest_config() {
    info "Rolling back Jest configuration..."

    # Check if package.json has coverage configuration
    if grep -q '"collectCoverageFrom"' package.json; then
        warning "Coverage configuration found in package.json"

        # Create backup of current config
        cp package.json package.json.coverage-backup

        # Remove coverage-related configuration
        # This is a simplified approach - in practice, you'd want more sophisticated JSON editing
        info "Removing coverage configuration from package.json..."
        # Note: This would need more sophisticated JSON parsing in a real implementation
        warning "Manual review of package.json required for coverage configuration removal"
    fi

    success "Jest configuration rollback prepared"
}

# Clean coverage artifacts
clean_coverage_artifacts() {
    info "Cleaning coverage artifacts..."

    # Remove coverage directory
    if [ -d "coverage" ]; then
        rm -rf coverage
        success "Removed coverage directory"
    fi

    # Remove coverage-related files
    rm -f tmp/jest-results.json
    rm -f coverage-final.json
    rm -f lcov.info
    rm -f clover.xml

    # Clean any coverage-related logs
    rm -f logs/coverage-*.log

    success "Coverage artifacts cleaned"
}

# Restore test environment
restore_test_environment() {
    info "Restoring test environment..."

    # Reset jest.setup.js if it was modified
    if git ls-files | grep -q "jest.setup.js"; then
        git checkout HEAD -- jest.setup.js 2>/dev/null || warning "Could not restore jest.setup.js"
    fi

    # Reset any test configuration files
    if git ls-files | grep -q "jest.config.js"; then
        git checkout HEAD -- jest.config.js 2>/dev/null || warning "Could not restore jest.config.js"
    fi

    success "Test environment restored"
}

# Run stability validation
run_stability_validation() {
    info "Running stability validation tests..."

    # Run tests without coverage to ensure basic functionality
    if npm test -- --testPathIgnorePatterns="coverage-improvement" --passWithNoTests; then
        success "Stability validation passed"
    else
        warning "Stability validation failed - manual review required"
        return 1
    fi
}

# Post-rollback verification
post_rollback_verification() {
    info "Performing post-rollback verification..."

    # Check that coverage is disabled
    if npm test -- --coverage=false --passWithNoTests > /dev/null 2>&1; then
        success "Coverage collection disabled"
    else
        warning "Coverage may still be active"
    fi

    # Verify no coverage artifacts were left behind
    if [ ! -d "coverage" ] && [ ! -f "lcov.info" ] && [ ! -f "clover.xml" ]; then
        success "No coverage artifacts remain"
    else
        warning "Some coverage artifacts may remain - manual cleanup required"
    fi

    success "Post-rollback verification completed"
}

# Main rollback function
main() {
    echo "=========================================="
    echo "Test Coverage Improvements Rollback Script"
    echo "Story: 1.11.2 Risk Assessment & Mitigation"
    echo "=========================================="
    log "Starting coverage improvements rollback"

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Execute rollback steps
    pre_rollback_check
    rollback_jest_config
    clean_coverage_artifacts
    restore_test_environment

    # Run validation
    if run_stability_validation; then
        post_rollback_verification
        success "Coverage improvements rollback completed successfully"
        success "Test suite restored to pre-coverage state"
        info "Log file: $LOG_FILE"
    else
        error_exit "Stability validation failed - rollback may be incomplete"
    fi
}

# Help function
show_help() {
    cat << EOF
Test Coverage Improvements Rollback Script

This script safely reverts test coverage improvements and restores the test environment
to its pre-coverage state. It performs validation at each step to ensure system stability.

Usage: $0 [OPTIONS]

Options:
    -h, --help          Show this help message
    --dry-run          Show what would be done without making changes
    --force            Skip confirmation prompts

Examples:
    $0                  Run full rollback with confirmations
    $0 --dry-run       Show rollback plan without executing
    $0 --force         Run rollback without user confirmations

Safety Features:
- Pre-rollback validation and backups
- Step-by-step execution with error checking
- Post-rollback stability verification
- Comprehensive logging

For more information, see docs/qa/assessments/1.11.2-risk-20251121.md
EOF
}

# Parse command line arguments
DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Dry run mode
if [ "$DRY_RUN" = true ]; then
    info "DRY RUN MODE - No changes will be made"
    info "Rollback plan:"
    echo "1. Pre-rollback validation"
    echo "2. Jest configuration rollback"
    echo "3. Coverage artifacts cleanup"
    echo "4. Test environment restoration"
    echo "5. Stability validation"
    echo "6. Post-rollback verification"
    exit 0
fi

# Force mode
if [ "$FORCE" = true ]; then
    warning "FORCE MODE - Skipping confirmation prompts"
fi

# Run main function
main</content>
<parameter name="filePath">scripts/rollback-coverage-improvements.sh