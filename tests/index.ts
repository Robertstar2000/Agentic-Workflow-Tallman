import { runUnitTests } from './unit.tests';
import { runIntegrationTests } from './integration.tests';

/**
 * An array containing all test suite functions to be executed by the test runner.
 */
export const allTestSuites = [
    runUnitTests,
    runIntegrationTests
];
