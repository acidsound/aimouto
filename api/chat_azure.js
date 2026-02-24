import chatHandler from "./chat.js";

// Backward-compatible route alias.
// Uses the same provider-agnostic handler to avoid SDK-specific runtime issues.
export default chatHandler;
