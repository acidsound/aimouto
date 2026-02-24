const DEFAULT_GEMINI_GENERATION_CONFIG = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

const DEFAULT_OPENAI_TOOL_MAX_ROUNDS = 3;

const OPENAI_WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_web",
    description: "Searches the web for up-to-date information and returns concise results with links.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query text",
        },
        max_results: {
          type: "integer",
          description: "Maximum number of results to return",
          minimum: 1,
          maximum: 8,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      resolve(body);
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function extractTextFromParts(parts) {
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("\n")
    .trim();
}

function extractLastMessageText(dialogs) {
  const lastDialog = dialogs[dialogs.length - 1];
  const messageText = extractTextFromParts(lastDialog?.parts);
  if (!messageText) {
    throw new Error("Last dialog message text is missing");
  }
  return messageText;
}

function mapDialogRoleToOpenAI(role) {
  if (role === "model" || role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "user";
}

function toOpenAIMessages(dialogs) {
  return dialogs
    .map((dialog) => {
      const content = extractTextFromParts(dialog?.parts);
      if (!content) return null;
      return {
        role: mapDialogRoleToOpenAI(dialog?.role),
        content,
      };
    })
    .filter(Boolean);
}

function resolveProvider() {
  const explicit = String(process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.OPENAI_API_KEY) return "openai_compat";
  return "gemini";
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseBooleanEnv(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeOpenAIMessageContent(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.text?.value === "string") return item.text.value;
      if (typeof item?.output_text === "string") return item.output_text;
      return "";
    })
    .join("")
    .trim();
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return fallback;
  }
}

function stripHtmlTags(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenDuckDuckGoTopics(items, collector) {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    if (Array.isArray(item?.Topics)) {
      flattenDuckDuckGoTopics(item.Topics, collector);
      continue;
    }
    if (item?.FirstURL && item?.Text) {
      collector.push({
        title: stripHtmlTags(item.Text).slice(0, 200),
        url: item.FirstURL,
        snippet: stripHtmlTags(item.Text),
        source: "duckduckgo",
      });
    }
  }
}

function pushUniqueResult(result, output, seenKeys, limit) {
  if (!result || output.length >= limit) return;
  const key = `${result.url || ""}::${result.title || ""}`;
  if (!key.trim() || seenKeys.has(key)) return;
  seenKeys.add(key);
  output.push(result);
}

async function runWebSearch(query, maxResults) {
  const normalizedQuery = String(query || "").trim();
  const limit = clamp(parseNumber(maxResults, 5), 1, 8);
  if (!normalizedQuery) {
    return {
      query: "",
      results: [],
      warnings: ["query is empty"],
      timestamp: new Date().toISOString(),
    };
  }

  const results = [];
  const warnings = [];
  const seenKeys = new Set();

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(normalizedQuery)}&format=json&no_html=1&skip_disambig=1`;
    const ddgResponse = await fetch(ddgUrl);
    if (ddgResponse.ok) {
      const ddg = await ddgResponse.json();

      if (ddg?.AbstractURL && ddg?.AbstractText) {
        pushUniqueResult(
          {
            title: ddg.Heading || normalizedQuery,
            url: ddg.AbstractURL,
            snippet: stripHtmlTags(ddg.AbstractText),
            source: "duckduckgo",
          },
          results,
          seenKeys,
          limit,
        );
      }

      const topicResults = [];
      flattenDuckDuckGoTopics(ddg?.RelatedTopics, topicResults);
      for (const topic of topicResults) {
        pushUniqueResult(topic, results, seenKeys, limit);
      }
    } else {
      warnings.push(`duckduckgo request failed: ${ddgResponse.status}`);
    }
  } catch (err) {
    warnings.push(`duckduckgo request error: ${err?.message || "unknown error"}`);
  }

  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=${limit}&srsearch=${encodeURIComponent(normalizedQuery)}`;
    const wikiResponse = await fetch(wikiUrl);
    if (wikiResponse.ok) {
      const wiki = await wikiResponse.json();
      const wikiResults = Array.isArray(wiki?.query?.search) ? wiki.query.search : [];
      for (const item of wikiResults) {
        const title = String(item?.title || "").trim();
        const url = title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}` : "";
        pushUniqueResult(
          {
            title,
            url,
            snippet: stripHtmlTags(item?.snippet || ""),
            source: "wikipedia",
          },
          results,
          seenKeys,
          limit,
        );
      }
    } else {
      warnings.push(`wikipedia request failed: ${wikiResponse.status}`);
    }
  } catch (err) {
    warnings.push(`wikipedia request error: ${err?.message || "unknown error"}`);
  }

  return {
    query: normalizedQuery,
    results: results.slice(0, limit),
    warnings,
    timestamp: new Date().toISOString(),
  };
}

async function executeToolCall(toolCall) {
  const name = toolCall?.function?.name;
  const args = safeJsonParse(toolCall?.function?.arguments || "{}", {});

  if (name === "search_web") {
    const query = typeof args?.query === "string" ? args.query : "";
    const maxResults = clamp(parseNumber(args?.max_results, 5), 1, 8);
    return runWebSearch(query, maxResults);
  }

  return {
    error: `Unsupported tool: ${name || "unknown"}`,
  };
}

function isLikelyToolUseUnsupportedError(message) {
  const text = String(message || "").toLowerCase();
  if (!text) return false;
  if (text.includes("tool") && text.includes("unsupported")) return true;
  if (text.includes("tool_choice") && text.includes("invalid")) return true;
  if (text.includes("tool_calls") && text.includes("invalid")) return true;
  if (text.includes("tools") && text.includes("not allowed")) return true;
  return false;
}

async function requestOpenAICompletion(endpoint, headers, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  const data = safeJsonParse(raw, null);

  if (!response.ok) {
    throw new Error(`openai_compat request failed (${response.status}): ${raw.slice(0, 500)}`);
  }

  return data;
}

function extractOpenAIOutputText(data) {
  const directOutputText = typeof data?.output_text === "string" ? data.output_text.trim() : "";
  if (directOutputText) return directOutputText;

  const outputItems = Array.isArray(data?.output) ? data.output : [];
  const chunks = [];
  for (const item of outputItems) {
    if (typeof item?.output_text === "string") {
      chunks.push(item.output_text);
    }
    if (Array.isArray(item?.content)) {
      for (const contentItem of item.content) {
        const text =
          (typeof contentItem?.text === "string" && contentItem.text) ||
          (typeof contentItem?.text?.value === "string" && contentItem.text.value) ||
          (typeof contentItem?.output_text === "string" && contentItem.output_text) ||
          "";
        if (text) chunks.push(text);
      }
    }
  }
  return chunks.join("").trim();
}

function extractAssistantMessageData(data) {
  const choice = data?.choices?.[0] || {};
  const message = choice?.message || {};
  const toolCallsFromMessage = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const toolCallsFromChoice = Array.isArray(choice?.tool_calls) ? choice.tool_calls : [];
  const toolCalls = toolCallsFromMessage.length > 0 ? toolCallsFromMessage : toolCallsFromChoice;

  const fallbackTextCandidates = [
    normalizeOpenAIMessageContent(message?.content),
    typeof message?.refusal === "string" ? message.refusal.trim() : "",
    typeof choice?.text === "string" ? choice.text.trim() : "",
    extractOpenAIOutputText(data),
  ];

  const content = fallbackTextCandidates.find((text) => typeof text === "string" && text.length > 0) || "";
  return { content, toolCalls, rawChoice: choice };
}

function buildOpenAIHeaders(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENAI_HTTP_REFERER) {
    headers["HTTP-Referer"] = process.env.OPENAI_HTTP_REFERER;
  }
  if (process.env.OPENAI_X_TITLE) {
    headers["X-Title"] = process.env.OPENAI_X_TITLE;
  }

  return headers;
}

async function runOpenAICompat(dialogs) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  const apiBase = String(process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = `${apiBase}/chat/completions`;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for openai_compat provider");
  }
  if (!model) {
    throw new Error("OPENAI_MODEL is required for openai_compat provider");
  }

  const temperature = parseNumber(process.env.OPENAI_TEMPERATURE, 0.8);
  const topP = parseNumber(process.env.OPENAI_TOP_P, 1);
  const maxTokens = parseNumber(process.env.OPENAI_MAX_TOKENS, 1024);
  const maxToolRounds = clamp(parseNumber(process.env.OPENAI_TOOL_MAX_ROUNDS, DEFAULT_OPENAI_TOOL_MAX_ROUNDS), 1, 6);
  const enableTools = parseBooleanEnv(process.env.OPENAI_ENABLE_TOOLS, true);
  const enableWebSearch = parseBooleanEnv(process.env.OPENAI_ENABLE_WEB_SEARCH, true);

  let toolUseEnabled = enableTools && enableWebSearch;
  let attemptedNoToolsRetry = false;
  const headers = buildOpenAIHeaders(apiKey);
  const messages = toOpenAIMessages(dialogs);

  if (toolUseEnabled) {
    messages.unshift({
      role: "system",
      content:
        "You may call search_web for up-to-date or factual lookup tasks. Prefer searching when user asks for recent information, external facts, or references.",
    });
  }

  for (let round = 0; round <= maxToolRounds; round += 1) {
    const payload = {
      model,
      messages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
    };

    if (toolUseEnabled) {
      payload.tools = [OPENAI_WEB_SEARCH_TOOL];
      payload.tool_choice = "auto";
    }

    let data;
    try {
      data = await requestOpenAICompletion(endpoint, headers, payload);
    } catch (err) {
      if (toolUseEnabled && isLikelyToolUseUnsupportedError(err?.message)) {
        toolUseEnabled = false;
        round -= 1;
        continue;
      }
      throw err;
    }

    const { content, toolCalls, rawChoice } = extractAssistantMessageData(data);

    if (!toolUseEnabled || toolCalls.length === 0) {
      if (content) return content;

      if (toolUseEnabled && !attemptedNoToolsRetry) {
        // Some providers return empty content when tool mode is enabled.
        toolUseEnabled = false;
        attemptedNoToolsRetry = true;
        round -= 1;
        continue;
      }

      const finishReason = typeof rawChoice?.finish_reason === "string" ? rawChoice.finish_reason : "unknown";
      throw new Error(`openai_compat response has empty text output (finish_reason=${finishReason})`);
    }

    if (round >= maxToolRounds) {
      throw new Error("openai_compat tool loop exceeded OPENAI_TOOL_MAX_ROUNDS");
    }

    messages.push({
      role: "assistant",
      content: content || "",
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const toolResult = await executeToolCall(toolCall);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  throw new Error("openai_compat did not produce a final response");
}

async function runGemini(dialogs) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL_NAME;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for gemini provider");
  }
  if (!modelName) {
    throw new Error("GEMINI_MODEL_NAME is required for gemini provider");
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const history = dialogs.slice(0, -1);
  const messageText = extractLastMessageText(dialogs);
  const chatSession = model.startChat({
    generationConfig: DEFAULT_GEMINI_GENERATION_CONFIG,
    history,
  });

  const result = await chatSession.sendMessage(messageText);
  return result.response.text();
}

async function runChat(dialogs) {
  const provider = resolveProvider();
  if (provider === "openai_compat") {
    return runOpenAICompat(dialogs);
  }
  if (provider === "gemini") {
    return runGemini(dialogs);
  }
  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}

export default async function handler(req, res) {
  try {
    const requestBody = await readRequestBody(req);
    if (!requestBody) {
      return sendErrorResponse(res, 400, "Request body is required");
    }

    const body = JSON.parse(requestBody);
    if (!body.dialogs || !Array.isArray(body.dialogs) || body.dialogs.length === 0) {
      return sendErrorResponse(res, 400, "dialogs must be a non-empty array");
    }

    const message = await runChat(body.dialogs);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ message }));
  } catch (err) {
    console.error("Error:", err);
    if (err instanceof SyntaxError) {
      return sendErrorResponse(res, 400, "Invalid JSON in request body");
    }
    return sendErrorResponse(res, 500, "Internal server error");
  }
}

function sendErrorResponse(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  return res.end(JSON.stringify({ error: message }));
}
