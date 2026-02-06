const PLAYWRIGHT_POLICY = {
  common: {
    navigationTimeoutMs: 30000,
    postNavigationWaitMs: 2000,
    clickTimeoutMs: 1200,
  },
  amazon: {
    pincodeApplyRetries: 3,
    pincodeTriggerClickTimeoutMs: 1000,
    pincodeTriggerSettleMs: 400,
    pincodeInputRetryWaitMs: 500,
    pincodeVerifyTimeoutMs: 6000,
    pincodePostApplyWaitMs: 700,
  },
  flipkart: {
    pincodePostApplyWaitMs: 1500,
  },
};

module.exports = { PLAYWRIGHT_POLICY };
