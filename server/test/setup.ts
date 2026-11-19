// Imported first by tests that load the app: ES imports are hoisted, so env vars
// must be set in a separate module that is evaluated before config.ts.
process.env.JWT_SECRET ||= 'test-secret-for-node-test-runner';
