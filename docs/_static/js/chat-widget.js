
(function() {
  if (window.__CHATBOT_WIDGET_INITIALIZED__) return;
  window.__CHATBOT_WIDGET_INITIALIZED__ = true;
  const EMBED_URL = "http://localhost:5174"; // iframe chat app
  const BACKEND_URL = "http://localhost:8000";
  const CHATBOT_ID = 3;
  const TOKEN_ENDPOINT = "/api/bot/chatbot_token"; // backend endpoint to get short-lived token
  const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min auto-refresh
  const TOKEN_KEY = "beacon-token";
  const CHAT_STATE_KEY = "chatbot_state";
  const CHATBOT_HEADER = "MKDocs Chatbot";

  // --- Inject styles ---
  const style = document.createElement("style");
  style.textContent = `
    .chat-widget-btn {
      position: fixed; right: 20px; bottom: 20px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #4f46e5; color: white; font-size: 14px; font-weight: bold;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      cursor: pointer;
    }
    .chat-widget-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.3);
      backdrop-filter: blur(6px);
      z-index: 99998;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .chat-widget-modal {
      background: white;
      width: 80%;
      max-width: 700px;
      height: 60vh;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 8px 30px rgba(0,0,0,0.25);
      display: flex;
      flex-direction: column;
    }
    .chat-widget-close {
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 20px;
      background: transparent;
      border: none;
      cursor: pointer;
    }
    .chat-widget-iframe {
      flex: 1;
      border: none;
      width: 100%;
      height: 100%;
    }
  `;
  document.head.appendChild(style);

  // --- Floating button ---
  const btn = document.createElement("button");
  btn.className = "chat-widget-btn";
  btn.innerText = "Chat";
  document.body.appendChild(btn);

  // --- Overlay + modal + iframe ---
  const overlay = document.createElement("div");
  overlay.className = "chat-widget-overlay";

  const modal = document.createElement("div");
  modal.className = "chat-widget-modal";

  const closeBtn = document.createElement("button");
  closeBtn.className = "chat-widget-close";
  closeBtn.innerHTML = "&times;";

  const iframe = document.createElement("iframe");
  iframe.className = "chat-widget-iframe";
  iframe.src = EMBED_URL;

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // --- Toggle modal ---
  btn.addEventListener("click", () => {
    overlay.style.display = "flex";
  });
  closeBtn.addEventListener("click", () => {
    overlay.style.display = "none";
  });

  // --- Token management ---
  // token related tasks: get from backend, get from session, pass to iframe.
  //
  // get token will check session storage first
  async function getToken() {
    let token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      return token;
    }
    token = await fetchNewToken();
    return token;
  }

  async function fetchNewToken() {
    try {
      const getTokenBody = {
        "bot_id": CHATBOT_ID
      }
      const resp = await fetch(`${BACKEND_URL}${TOKEN_ENDPOINT}`, {
        method: "POST",
        body: JSON.stringify(getTokenBody),
        headers: {
          "Content-Type": "application/json"
        },
      });
      if (!resp.ok) throw new Error("Failed to fetch token");
      const data = await resp.json();
      sessionStorage.setItem(TOKEN_KEY, data.token);
      return data.token;
    } catch (err) {
      console.error("Widget: token fetch error", err);
      return null;
    }
  }

  function sendToken(token) {
    if (token) {
      iframe.contentWindow.postMessage({ type: "SET_TOKEN", payload: { token } }, "*");
    }
  }

  // function sendChatbotState() {
  //   const chatbot_state = sessionStorage.getItem(CHAT_STATE_KEY);
  //   if (chatbot_state) {
  //     iframe.contentWindow.postMessage({ type: "SET_CHATBOT_STATE", payload: { chatbot_state } }, "*");
  //     return;
  //   }
  // }

  async function loadWidget() {
    // NOTE: we want to send the token as well as chat state if available
    // get token as well as chatbot state. pass the message together
    const token = await getToken();
    let chatbot_state = sessionStorage.getItem(CHAT_STATE_KEY);
    if (!chatbot_state) {
      chatbot_state = {
        header: CHATBOT_HEADER,
        conversation_id: null,
        messages: [
          {
            role: "assistant",
            message: "This is the MKDocs chatbot. How can we help you?"
          }
        ]
      };
    }
    const init_payload = {
      token: token,
      chatbot_state: chatbot_state,
      parent_origin: window.origin
    }

    iframe.contentWindow.postMessage({ type: "init", payload: init_payload }, "*");

  }

  function saveChatbotState(chatbotState) {
    try {
      const serialized = JSON.stringify(chatbotState);
      const size = new Blob([serialized]).size;

      if (size > 4.5 * 1024 * 1024) {
        // state is getting too long, we need to truncate it
        chatbotState.slice(-20);
      }
      sessionStorage.setItem(CHAT_STATE_KEY, JSON.stringify(chatbotState));
    } catch {
      console.log("Unable to save chatbot state");
    }
  }

  // --- Listen for iframe messages ---
  window.addEventListener("message", async (event) => {
    // Optional: validate origin if known
    // if (event.origin !== "https://your-widget-host.com") return;

    const { type } = event.data || {};
    if (!type) return;

    switch (type) {
      case "REFRESH_TOKEN":
        console.log("Refresh Token requested!");
        const token = await fetchNewToken();
        sendToken(token);
        break;
      case "LOG":
        console.log("Iframe:", event.data.data?.message);
        break;
      case "ERROR":
        console.error("Iframe error:", event.data.data?.message);
        break;
      case "SAVE_STATE":
        saveChatbotState(event.data?.message);
      default:
        console.warn("Unknown message from iframe:", type, event.data);
    }
  });

  // --- Send token when iframe loads ---
  iframe.onload = () => loadWidget();

  // --- Optional: auto-refresh token every interval ---
  // setInterval(() => sendToken(), TOKEN_REFRESH_INTERVAL);
})();
