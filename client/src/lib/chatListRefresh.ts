const CHAT_LIST_REFRESH_EVENT = 'chat-list:refresh';
 
export function requestChatListRefresh() {
  window.dispatchEvent(new Event(CHAT_LIST_REFRESH_EVENT));
}
 
export function onChatListRefreshRequested(handler: () => void) {
  window.addEventListener(CHAT_LIST_REFRESH_EVENT, handler);
  return () => window.removeEventListener(CHAT_LIST_REFRESH_EVENT, handler);
}
 