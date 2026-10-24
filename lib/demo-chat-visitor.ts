import { CHAT_VISITOR_UUID } from "./demo-api";

export const CHAT_VISITOR_KEY = "nexo.chat.visitor.v1";

/** Necessary chat quota identity only. Never reuse the optional analytics identity. */
export function getChatVisitorId(
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = storage.getItem(CHAT_VISITOR_KEY);
  if (existing !== null) {
    if (!CHAT_VISITOR_UUID.test(existing)) throw new Error("Chat visitor storage is invalid");
    return existing;
  }
  const id = createId();
  if (!CHAT_VISITOR_UUID.test(id)) throw new Error("Chat visitor creation failed");
  storage.setItem(CHAT_VISITOR_KEY, id);
  const persisted = storage.getItem(CHAT_VISITOR_KEY);
  if (!persisted || !CHAT_VISITOR_UUID.test(persisted)) throw new Error("Chat visitor storage is unavailable");
  return persisted;
}
