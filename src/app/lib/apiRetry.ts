type RetryOptions = {
  retries?: number;
  retryDelayMs?: number;
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const fetchJsonWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {},
) => {
  const retries = Math.max(0, options.retries ?? 2);
  const retryDelayMs = Math.max(100, options.retryDelayMs ?? 350);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const json = await response.json().catch(() => null);

      if (response.ok) {
        return { response, json };
      }

      if (attempt < retries && response.status >= 500) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return { response, json };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw error;
      }
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed.");
};