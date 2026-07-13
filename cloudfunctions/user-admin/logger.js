const LOG_LEVELS = { info: "info", warn: "warn", error: "error" };

function formatLog(level, payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  };
  return JSON.stringify(entry);
}

function logRequest(action, uid, result, durationMs, extra = {}) {
  const level = result === "error" ? LOG_LEVELS.error : LOG_LEVELS.info;
  console.log(formatLog(level, {
    action,
    uid: uid || "anonymous",
    result,
    durationMs,
    ...extra,
  }));
}

function logError(action, uid, error, extra = {}) {
  console.error(formatLog(LOG_LEVELS.error, {
    action,
    uid: uid || "unknown",
    result: "error",
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  }));
}

function logInfo(action, uid, message, extra = {}) {
  console.log(formatLog(LOG_LEVELS.info, {
    action,
    uid: uid || "system",
    result: "info",
    message,
    ...extra,
  }));
}

function withTiming(action, uid) {
  const start = Date.now();
  return {
    end(result, extra = {}) {
      logRequest(action, uid, result, Date.now() - start, extra);
    },
  };
}

module.exports = { logRequest, logError, logInfo, withTiming, formatLog };
