const { runTests } = require('./testRunner.ts');
const { allTestSuites } = require('../tests/index.ts');

(async () => {
  const results = await runTests(allTestSuites);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);
  console.log(`${passed} passed, ${failed.length} failed`);
  if (failed.length > 0) {
    console.log('Failures:');
    failed.forEach(f => console.log(`- ${f.suite}: ${f.name}`));
    process.exit(1);
  }
})();
