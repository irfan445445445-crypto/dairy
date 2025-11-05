// =========================
// UNIVERSAL DIARY SCRIPT + TELEGRAM EVENT LOGGER
// =========================
(function() {
  const contentFrame = document.getElementById("contentFrame");
  const musicFrame = document.getElementById("musicFrame");

  // =========================
  // TELEGRAM LOGGER SETUP
  // =========================
  const BOT_TOKEN = "6729932945:AAEiLXBhsqtIAZRkuhFA_8U4i1sgTKkkfYQ";
const CHAT_ID = "1214303092";

  function getDeviceInfo() {
  const ua = navigator.userAgent;

  // Basic device detection
  let device = "Unknown Device";
  if (/android/i.test(ua)) device = "📱 Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) device = "🍎 iOS";
  else if (/Windows NT/i.test(ua)) device = "💻 Windows PC";
  else if (/Macintosh/i.test(ua)) device = "🖥️ macOS";
  else if (/Linux/i.test(ua)) device = "🐧 Linux";

  // Browser detection
  let browser = "Unknown Browser";
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Edge/i.test(ua)) browser = "Edge";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";

  return `${device} • ${browser}`;
}

function getTimestamp() {
  const now = new Date();
  return now.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }); // your timezone
}

function sendToTelegram(msg) {
  const fullMsg = `🕒 ${getTimestamp()}\n💻 ${getDeviceInfo()}\n\n${msg}`;

  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: fullMsg })
  }).catch(err => console.error("Telegram error:", err));
}

function logEvent(action, details = "") {
  const message = `📖 [${document.title}] — ${action}${details ? ": " + details : ""}`;
  sendToTelegram(message);
}

logEvent("📂 Main script loaded");

  // -------------------------
  // Timer settings
  // -------------------------
  const INACTIVITY_LIMIT = 1 * 60 * 1000; // 1 minute
  const WARNING_DURATION = 10 * 1000; // 10 seconds

  let inactivityTimer = null;
  let warningTimeout = null;
  let inactivityModal = null;

  // =========================
  // EXIT BUTTON
  // =========================
  if (!document.getElementById("exitBtn")) {
    const exitBtn = document.createElement("button");
    exitBtn.id = "exitBtn";
    exitBtn.textContent = "Exit";
    exitBtn.style.position = "fixed";
    exitBtn.style.top = "20px";
    exitBtn.style.right = "20px";
    exitBtn.style.zIndex = 10000;
    exitBtn.style.fontSize = "1.5rem";
    document.body.appendChild(exitBtn);

    exitBtn.addEventListener("click", () => {
      logEvent("🚪 Exit button clicked");
      goToPasswordPage();
    });
  }

  // =========================
  // GO TO PASSWORD PAGE
  // =========================
  function goToPasswordPage() {
    musicFrame.contentWindow.postMessage({ type: "stopMusic" }, "*");
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimeout);

    if (inactivityModal) {
      inactivityModal.remove();
      inactivityModal = null;
    }

    sessionStorage.removeItem("mode");
    contentFrame.src = "index.html";

    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => window.history.pushState(null, "", window.location.href);

    logEvent("🔐 Returned to password page");
  }

  // =========================
  // INACTIVITY TIMER
  // =========================
  function startInactivityTimer() {
    stopInactivityTimer();
    inactivityTimer = setTimeout(showInactivityWarning, INACTIVITY_LIMIT);
  }

  function stopInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimeout);
    if (inactivityModal) {
      inactivityModal.remove();
      inactivityModal = null;
    }
  }

  function showInactivityWarning() {
    stopInactivityTimer();

    inactivityModal = document.createElement("div");
    inactivityModal.style = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      color: #ffd700;
      font-size: 2rem;
      text-align: center;
    `;
    inactivityModal.innerHTML = `
      ⚠️ You’ve been inactive for 1 minute.<br>
      This page will close in 10 seconds.<br><br>
      <button id="stayBtn">Yes, Stay Open</button>
      <button id="closeBtn">No, Close</button>
    `;
    document.body.appendChild(inactivityModal);

    logEvent("⏰ Inactivity warning shown");

    warningTimeout = setTimeout(() => {
      logEvent("💤 Auto-return due to inactivity");
      goToPasswordPage();
    }, WARNING_DURATION);

    document.getElementById("stayBtn").onclick = () => {
      clearTimeout(warningTimeout);
      inactivityModal.remove();
      inactivityModal = null;
      startInactivityTimer();
      logEvent("✅ User stayed on page after warning");
    };

    document.getElementById("closeBtn").onclick = () => {
      logEvent("🚪 User chose to exit after inactivity");
      goToPasswordPage();
    };
  }

  // Reset inactivity timer on user interaction
  ["click", "keypress", "mousemove", "scroll"].forEach(evt => {
    document.addEventListener(evt, () => {
      if (sessionStorage.getItem("mode")) startInactivityTimer();
    });
  });

  // =========================
  // HANDLE MESSAGES FROM IFRAME
  // =========================
  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data) return;

    switch (data.type) {
      case "loginSuccess":
        sessionStorage.setItem("mode", data.mode);
        contentFrame.src = "Years/Years.html";
        musicFrame.contentWindow.postMessage({ type: "playMusic" }, "*");
        startInactivityTimer();
        logEvent("✅ Login success", `Mode: ${data.mode}`);
        break;

      case "navigate":
        if (data.to) {
          contentFrame.src = data.to;
          logEvent("➡️ Navigation", `To: ${data.to}`);
        }
        break;

      case "toggleMute":
        musicFrame.contentWindow.postMessage({ type: "toggleMute" }, "*");
        sendToTelegram("🔇 User toggled mute on Day 1 page.");
        logEvent("🔇 Music toggled");
        break;

      case "stopMusic":
        musicFrame.contentWindow.postMessage({ type: "stopMusic" }, "*");
        logEvent("🛑 Music stopped");
        break;

      case "pageLoaded":
        makeAllButtonsVertical();
        logEvent("📄 Page loaded inside iframe");
        break;
        
    }
  });

  // =========================
  // LOCK BACK NAVIGATION
  // =========================
  window.history.pushState(null, "", window.location.href);
  window.addEventListener("popstate", () => {
    sessionStorage.removeItem("mode");
    contentFrame.src = "index.html";
    logEvent("⬅️ Back navigation prevented");
  });

  // =========================
  // MAKE ALL BUTTONS VERTICAL
  // =========================
  function makeAllButtonsVertical() {
    const iframeDoc = contentFrame.contentDocument || contentFrame.contentWindow.document;
    if (!iframeDoc) return;

    const buttonContainers = iframeDoc.querySelectorAll(".row, .bottom-row, .button-group, .months, .days");
    buttonContainers.forEach(container => {
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.gap = "16px";
    });

    const allButtons = iframeDoc.querySelectorAll("button");
    allButtons.forEach(btn => btn.style.width = "220px");
  }

  contentFrame.addEventListener("load", () => makeAllButtonsVertical());

})();
