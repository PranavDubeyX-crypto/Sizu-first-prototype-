
const API_URL = "YOUR_BACKEND_URL/chat";

const sizu = document.getElementById("sizu");
const emotionLabel = document.getElementById("emotionLabel");
const characterMessage = document.getElementById("characterMessage");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const statusText = document.getElementById("statusText");
const hint = document.getElementById("hint");

let conversation = [];
let recognition = null;

function setEmotion(emotion, message = "") {
  const allowed = [
    "normal", "listening", "happy",
    "sad", "angry", "sarcastic", "thinking"
  ];

  if (!allowed.includes(emotion)) emotion = "normal";

  sizu.className = "sizu " + emotion;
  emotionLabel.textContent = emotion.toUpperCase();
  characterMessage.textContent = message || "I'm listening.";
}

function addMessage(sender, text) {
  const item = document.createElement("div");
  item.className = "message " + sender;

  const label = document.createElement("b");
  label.textContent = sender === "bot" ? "SIZU" : "YOU";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  item.append(label, paragraph);
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    hint.textContent = "Speech playback isn't supported in this browser.";
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 0.95;
  utterance.pitch = 1.12;

  utterance.onstart = () => {
    statusText.textContent = "SPEAKING";
  };

  utterance.onend = () => {
    statusText.textContent = "ONLINE";
    setEmotion("normal", "What shall we talk about?");
  };

  window.speechSynthesis.speak(utterance);
}

async function sendMessage(text) {
  text = text.trim();
  if (!text || sendButton.disabled) return;

  addMessage("user", text);
  userInput.value = "";
  sendButton.disabled = true;

  setEmotion("thinking", "Let me think...");
  statusText.textContent = "THINKING";

  conversation.push({ role: "user", content: text });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversation.slice(-12)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI request failed.");
    }

    const reply = data.reply || "I couldn't form a response.";
    const emotion = data.emotion || "normal";

    conversation.push({ role: "assistant", content: reply });
    addMessage("bot", reply);

    setEmotion(emotion, reply.slice(0, 65));
    speak(reply);

  } catch (error) {
    console.error(error);

    const errorText =
      "Sorry! I couldn't connect to my AI brain. Please check the connection.";

    addMessage("bot", errorText);
    setEmotion("sad", "Connection problem.");
    hint.textContent = error.message;
    statusText.textContent = "ERROR";

  } finally {
    sendButton.disabled = false;
  }
}

sendButton.addEventListener("click", () => {
  sendMessage(userInput.value);
});

userInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    sendMessage(userInput.value);
  }
});

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    setEmotion("listening", "I'm listening...");
    statusText.textContent = "LISTENING";
    hint.textContent = "SIZU is listening. Speak now.";
    micButton.disabled = true;
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
    sendMessage(transcript);
  };

  recognition.onerror = event => {
    hint.textContent = "Voice error: " + event.error;
    setEmotion("normal", "Try speaking again.");
    statusText.textContent = "ONLINE";
  };

  recognition.onend = () => {
    micButton.disabled = false;

    if (statusText.textContent === "LISTENING") {
      statusText.textContent = "ONLINE";
      setEmotion("normal");
    }
  };

  micButton.addEventListener("click", () => {
    try {
      recognition.start();
    } catch (error) {
      hint.textContent = "Please wait a moment and try again.";
    }
  });

} else {
  micButton.disabled = true;
  hint.textContent =
    "Voice input isn't supported here. Try a compatible browser.";
}

setEmotion("happy", "Hello! I'm SIZU.");
