/**
 * @fileoverview A simple, lightweight, in-browser test runner.
 */

/**
 * Defines the structure for a single test result.
 */
export interface TestResult {
    /** The name of the test suite. */
    suite: string;
    /** The name of the specific test case. */
    name: string;
    /** Whether the test passed. */
    passed: boolean;
    /** The error message if the test failed. */
    error?: string;
}

const results: TestResult[] = [];
let currentSuite = 'Default';
let asyncTests: Promise<any>[] = [];

/**
 * Groups related tests into a suite.
 * @param {string} suiteName - The name of the test suite.
 * @param {function} fn - The function containing the tests for this suite.
 */
export const describe = (suiteName: string, fn: () => void) => {
    currentSuite = suiteName;
    fn();
};

/**
 * Defines a single test case.
 * @param {string} testName - The name of the test.
 * @param {function} fn - The function containing the test logic and assertions.
 */
export const it = (testName: string, fn: () => Promise<void> | void) => {
    try {
        const result = fn();
        if (result instanceof Promise) {
            const asyncTest = result.then(() => {
                results.push({ suite: currentSuite, name: testName, passed: true });
            }).catch(e => {
                 results.push({ suite: currentSuite, name: testName, passed: false, error: (e as Error).message });
            });
            asyncTests.push(asyncTest);
        } else {
            results.push({ suite: currentSuite, name: testName, passed: true });
        }
    } catch (e) {
        results.push({ suite: currentSuite, name: testName, passed: false, error: (e as Error).message });
    }
};

/**
 * Creates an assertion.
 * @param {*} actual - The actual value produced by the code under test.
 * @returns {object} An object with assertion methods.
 */
export const expect = (actual: any) => ({
    toBe: (expected: any) => {
        if (actual !== expected) {
            throw new Error(`Expected "${actual}" to be "${expected}"`);
        }
    },
    toEqual: (expected: any) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
    },
    toBeTruthy: () => {
        if (!actual) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
        }
    },
    toBeUndefined: () => {
        if (typeof actual !== 'undefined') {
            throw new Error(`Expected ${JSON.stringify(actual)} to be undefined`);
        }
    },
    not: {
        toBe: (expected: any) => {
            if (actual === expected) {
                throw new Error(`Expected "${actual}" not to be "${expected}"`);
            }
        }
    }
});

/**
 * Runs a collection of test suites and returns the results.
 * @param {Array<function>} testSuites - An array of functions, where each function executes a test suite.
 * @returns {Promise<TestResult[]>} A promise that resolves to an array of test results.
 */
export const runTests = async (testSuites: (() => void)[]): Promise<TestResult[]> => {
    // Clear previous results
    results.length = 0;
    asyncTests = [];
    
    for(const suite of testSuites) {
        suite();
    }

    await Promise.all(asyncTests);
    
    return [...results];
};
