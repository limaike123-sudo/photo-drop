const settingsKey = "github-photo-drop-settings";
const queue = [];
let isUploading = false;

const elements = {
  token: document.querySelector("#tokenInput"),
  owner: document.querySelector("#ownerInput"),
  repo: document.querySelector("#repoInput"),
  branch: document.querySelector("#branchInput"),
  path: document.querySelector("#pathInput"),
  save: document.querySelector("#saveSettingsButton"),
  clear: document.querySelector("#clearSettingsButton"),
  input: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  upload: document.querySelector("#uploadButton"),
  queue: document.querySelector("#queue"),
  empty: document.querySelector("#emptyState"),
  template: document.querySelector("#queueItemTemplate"),
  todayFolderNote: document.querySelector("#todayFolderNote"),
  desktopGallery: document.querySelector("#desktopGallery"),
  desktopEmpty: document.querySelector("#desktopEmpty"),
  refreshDesktopGallery: document.querySelector("#refreshDesktopGalleryButton"),
  mobileUploadedGallery: document.querySelector("#mobileUploadedGallery"),
  refreshMobileUploads: document.querySelector("#refreshMobileUploadsButton"),
  modelGallery: document.querySelector("#modelGallery"),
  modelEmpty: document.querySelector("#modelEmpty"),
  modelFileInput: document.querySelector("#modelFileInput"),
  uploadModelButton: document.querySelector("#uploadModelButton"),
  modelUploadStatus: document.querySelector("#modelUploadStatus"),
  aiGeneratedGallery: document.querySelector("#aiGeneratedGallery"),
  aiGeneratedEmpty: document.querySelector("#aiGeneratedEmpty"),
  todayInfo: document.querySelector("#todayInfo"),
  weatherButton: document.querySelector("#weatherButton"),
  messageAuthor: document.querySelector("#messageAuthorInput"),
  messageText: document.querySelector("#messageTextInput"),
  messageSend: document.querySelector("#sendMessageButton"),
  messageRefresh: document.querySelector("#refreshMessagesButton"),
  messageStatus: document.querySelector("#messageStatus"),
  messageList: document.querySelector("#messageList"),
};

function todayFolderName() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function renderTodayInfo() {
  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  elements.todayInfo.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
}

const weatherTextByCode = {
  0: "晴",
  1: "大致晴",
  2: "局部多云",
  3: "阴",
  45: "有雾",
  48: "有雾",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "阵雨",
  82: "强阵雨",
  95: "雷雨",
  96: "雷雨",
  99: "强雷雨",
};

const xiaoshanWeather = {
  name: "杭州萧山",
  latitude: 30.17,
  longitude: 120.26,
};

async function loadWeatherByCoords({ name, latitude, longitude, loadingText }) {
  elements.weatherButton.disabled = true;
  elements.weatherButton.textContent = loadingText;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", latitude);
    url.searchParams.set("longitude", longitude);
    url.searchParams.set("current", "temperature_2m,weather_code");
    url.searchParams.set("timezone", "Asia/Shanghai");
    const response = await fetch(url.href);
    if (!response.ok) throw new Error("天气加载失败");
    const data = await response.json();
    const current = data.current || {};
    const weatherText = weatherTextByCode[current.weather_code] || "天气";
    const temperature = Math.round(Number(current.temperature_2m));
    elements.weatherButton.textContent = Number.isFinite(temperature)
      ? `${name} · ${weatherText} · ${temperature}°C`
      : `${name} · ${weatherText}`;
    elements.weatherButton.disabled = false;
  } catch (error) {
    elements.weatherButton.textContent = error.message || "天气加载失败";
    elements.weatherButton.disabled = false;
  }
}

function loadXiaoshanWeather() {
  return loadWeatherByCoords({
    ...xiaoshanWeather,
    loadingText: "萧山天气加载中",
  });
}

function loadCurrentWeather() {
  if (!navigator.geolocation) {
    loadXiaoshanWeather();
    return;
  }

  elements.weatherButton.disabled = true;
  elements.weatherButton.textContent = "定位天气加载中";

  navigator.geolocation.getCurrentPosition((position) => {
    loadWeatherByCoords({
      name: "当前位置",
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      loadingText: "定位天气加载中",
    });
  }, () => {
    loadXiaoshanWeather();
  }, {
    enableHighAccuracy: false,
    maximumAge: 10 * 60 * 1000,
    timeout: 10000,
  });
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
  elements.token.value = saved.token || "";
  elements.owner.value = saved.owner || "limaike123-sudo";
  elements.repo.value = saved.repo || "photo-drop";
  elements.branch.value = saved.branch || "main";
  elements.path.value = saved.path || "uploads";
  updateTodayNote();
}

function getSettings() {
  return {
    token: elements.token.value.trim(),
    owner: elements.owner.value.trim(),
    repo: elements.repo.value.trim(),
    branch: elements.branch.value.trim() || "main",
    path: normalizePath(elements.path.value.trim() || "uploads"),
  };
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(getSettings()));
  updateTodayNote();
}

function clearSettings() {
  localStorage.removeItem(settingsKey);
  loadSettings();
}

function updateTodayNote() {
  const settings = getSettings();
  elements.todayFolderNote.textContent = `保存到：${settings.path}/${todayFolderName()}`;
}

function normalizePath(value) {
  return value.replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function textToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToText(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function messagePath() {
  return `messages/${todayFolderName()}.json`;
}

function localMessageKey() {
  return `github-photo-drop-messages-${todayFolderName()}`;
}

function formatMessageTime(value) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function renderMessages(messages) {
  elements.messageList.innerHTML = "";
  if (!messages.length) {
    elements.messageList.innerHTML = '<div class="empty-state">今天还没有留言</div>';
    return;
  }

  messages
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((message) => {
      const card = document.createElement("article");
      card.className = "message-card";

      const meta = document.createElement("div");
      meta.className = "message-meta";

      const author = document.createElement("strong");
      author.textContent = message.author || "未署名";

      const time = document.createElement("span");
      time.textContent = formatMessageTime(message.createdAt);

      const content = document.createElement("p");
      content.textContent = message.text || "";

      meta.append(author, time);
      card.append(meta, content);
      elements.messageList.appendChild(card);
    });
}

function localMessages() {
  return JSON.parse(localStorage.getItem(localMessageKey()) || "[]");
}

function saveLocalMessages(messages) {
  localStorage.setItem(localMessageKey(), JSON.stringify(messages));
}

async function fetchMessageDocument(settings, includeToken = false) {
  const path = messagePath();
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.branch)}`;
  const headers = { Accept: "application/vnd.github+json" };
  if (includeToken && settings.token) {
    headers.Authorization = `Bearer ${settings.token}`;
  }
  const response = await fetch(`${url}&t=${Date.now()}`, { headers, cache: "no-store" });
  if (response.status === 404) {
    return { messages: [], sha: null };
  }
  if (!response.ok) {
    throw new Error(`留言加载失败：GitHub 返回 ${response.status}`);
  }
  const document = await response.json();
  const parsed = JSON.parse(base64ToText(document.content || ""));
  return {
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    sha: document.sha,
  };
}

async function saveMessagesToGithub(messages, sha, settings) {
  const path = messagePath();
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
  const body = {
    message: `Update messages ${todayFolderName()}`,
    branch: settings.branch,
    content: textToBase64(JSON.stringify({ date: todayFolderName(), messages }, null, 2)),
  };
  if (sha) body.sha = sha;

  const response = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || `GitHub 返回 ${response.status}`);
  }
}

async function loadMessages() {
  const settings = getSettings();
  elements.messageStatus.textContent = "正在加载留言";
  try {
    const document = await fetchMessageDocument(settings);
    const merged = [...document.messages, ...localMessages()];
    renderMessages(merged);
    elements.messageStatus.textContent = document.messages.length ? `已加载 ${document.messages.length} 条云端留言` : "今天还没有云端留言";
  } catch (error) {
    const messages = localMessages();
    renderMessages(messages);
    elements.messageStatus.textContent = messages.length
      ? "云端留言暂时加载失败，已显示当前设备留言"
      : error.message;
  }
}

async function sendMessage() {
  const text = elements.messageText.value.trim();
  const author = elements.messageAuthor.value.trim() || "手机端";
  if (!text) {
    elements.messageStatus.textContent = "先写一点内容再发送";
    return;
  }

  localStorage.setItem("github-photo-drop-message-author", author);
  elements.messageSend.disabled = true;
  elements.messageStatus.textContent = "正在保存留言";

  const message = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author,
    text,
    createdAt: new Date().toISOString(),
  };
  const settings = getSettings();

  try {
    if (!settings.token || !settings.owner || !settings.repo) {
      const messages = [...localMessages(), message];
      saveLocalMessages(messages);
      renderMessages(messages);
      elements.messageText.value = "";
      elements.messageStatus.textContent = "已保存到当前设备；填写 GitHub Token 后可以同步";
      return;
    }

    const document = await fetchMessageDocument(settings, true);
    const messages = [...document.messages, message];
    await saveMessagesToGithub(messages, document.sha, settings);
    elements.messageText.value = "";
    renderMessages(messages);
    elements.messageStatus.textContent = "已同步到 GitHub";
  } catch (error) {
    const messages = [...localMessages(), message];
    saveLocalMessages(messages);
    renderMessages(messages);
    elements.messageText.value = "";
    elements.messageStatus.textContent = `云端保存失败，已保存到当前设备：${error.message}`;
  } finally {
    elements.messageSend.disabled = false;
  }
}

function galleryLimit(container) {
  if (container === elements.mobileUploadedGallery) {
    return 10;
  }
  return window.matchMedia("(max-width: 680px)").matches ? 4 : 6;
}

function applyGalleryLimit(container) {
  const cards = [...container.children];
  const limit = galleryLimit(container);
  const needsToggle = cards.length > limit;
  let toggle = container.nextElementSibling;

  if (!toggle || !toggle.classList.contains("gallery-toggle")) {
    toggle = document.createElement("button");
    toggle.className = "gallery-toggle";
    toggle.type = "button";
    container.insertAdjacentElement("afterend", toggle);
  }

  if (!needsToggle) {
    toggle.hidden = true;
    cards.forEach((card) => {
      card.hidden = false;
    });
    return;
  }

  toggle.hidden = false;
  const expanded = container.dataset.expanded === "true";
  cards.forEach((card, index) => {
    card.hidden = !expanded && index >= limit;
  });
  toggle.textContent = expanded ? "收起" : `展开全部 ${cards.length} 张`;
  toggle.onclick = () => {
    container.dataset.expanded = expanded ? "false" : "true";
    applyGalleryLimit(container);
  };
}

function refreshGalleryLimits() {
  document.querySelectorAll(".desktop-date-gallery").forEach((container) => applyGalleryLimit(container));
  [
    elements.mobileUploadedGallery,
    elements.modelGallery,
    elements.aiGeneratedGallery,
  ].forEach((container) => applyGalleryLimit(container));
}

function safeName(name) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${stamp}_${cleaned || "photo.jpg"}`;
}

function addFiles(fileList) {
  const images = [...fileList].filter((file) => file.type.startsWith("image/"));
  images.forEach((file) => {
    const item = {
      file,
      uploadName: safeName(file.name),
      element: elements.template.content.firstElementChild.cloneNode(true),
    };

    item.element.querySelector(".preview").src = URL.createObjectURL(file);
    item.element.querySelector(".preview").alt = file.name;
    item.element.querySelector(".file-name").textContent = file.name;
    item.element.querySelector(".file-meta").textContent = `${formatBytes(file.size)} · ${file.type || "image"}`;
    queue.push(item);
    elements.queue.appendChild(item.element);
  });
  elements.empty.hidden = queue.length > 0;
  const settings = getSettings();
  if (settings.token && settings.owner && settings.repo) {
    uploadQueue();
  } else {
    queue.filter((item) => !item.done).forEach((item) => {
      item.element.querySelector(".item-status").textContent = "请先填写上传设置，再点开始上传";
    });
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadItem(item, settings) {
  const progress = item.element.querySelector(".progress");
  const status = item.element.querySelector(".item-status");
  const datedPath = `${settings.path}/${todayFolderName()}`;
  status.className = "item-status";
  status.textContent = "正在读取图片";
  progress.value = 20;

  const content = await readFileAsBase64(item.file);
  progress.value = 45;
  status.textContent = "正在上传";

  const uploadPath = `${datedPath}/${item.uploadName}`;
  const encodedPath = encodeURIComponent(uploadPath).replace(/%2F/g, "/");
  const response = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Upload ${item.uploadName}`,
      branch: settings.branch,
      content,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || `GitHub 返回 ${response.status}`);
  }

  progress.value = 100;
  status.classList.add("done");
  status.textContent = `已保存到 ${datedPath}`;
}

async function uploadQueue() {
  if (isUploading) return;
  saveSettings();
  const settings = getSettings();
  if (!settings.token || !settings.owner || !settings.repo) {
    alert("请先展开上传设置，填写 GitHub Token、仓库拥有者和仓库名。");
    return;
  }

  isUploading = true;
  elements.upload.textContent = "上传中";
  elements.upload.disabled = true;
  const pending = queue.filter((item) => !item.done);
  try {
    for (const item of pending) {
      try {
        await uploadItem(item, settings);
        item.done = true;
        await loadMobileUploads();
      } catch (error) {
        const status = item.element.querySelector(".item-status");
        status.className = "item-status error";
        status.textContent = error.message;
      }
    }
  } finally {
    isUploading = false;
    elements.upload.textContent = "开始上传";
    elements.upload.disabled = false;
  }
}

elements.save.addEventListener("click", saveSettings);
elements.clear.addEventListener("click", clearSettings);
elements.upload.addEventListener("click", uploadQueue);
elements.uploadModelButton.addEventListener("click", () => elements.modelFileInput.click());
elements.modelFileInput.addEventListener("change", (event) => uploadModelFiles(event.target.files));
elements.input.addEventListener("change", (event) => addFiles(event.target.files));
["token", "owner", "repo", "branch", "path"].forEach((key) => {
  elements[key].addEventListener("input", updateTodayNote);
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
elements.refreshDesktopGallery.addEventListener("click", loadDesktopGallery);
elements.refreshMobileUploads.addEventListener("click", loadMobileUploads);
elements.weatherButton.addEventListener("click", loadCurrentWeather);
elements.messageSend.addEventListener("click", sendMessage);
elements.messageRefresh.addEventListener("click", loadMessages);
window.addEventListener("resize", refreshGalleryLimits);
elements.messageAuthor.value = localStorage.getItem("github-photo-drop-message-author") || "手机端";
renderTodayInfo();
loadXiaoshanWeather();
loadSettings();
loadMessages();
loadMobileUploads();
loadDesktopGallery();
loadLocalGallery();

async function loadMobileUploads() {
  const settings = getSettings();
  const folder = `${settings.path}/${todayFolderName()}`;
  const apiPath = encodeURIComponent(folder).replace(/%2F/g, "/");
  const apiUrl = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${apiPath}?ref=${encodeURIComponent(settings.branch)}`;
  elements.mobileUploadedGallery.innerHTML = "";
  elements.mobileUploadedGallery.dataset.expanded = "false";

  try {
    const response = await fetch(`${apiUrl}&t=${Date.now()}`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (response.status === 404) {
      if (!queue.length) {
        elements.empty.hidden = false;
        elements.empty.textContent = "今天还没有手机端上传图片";
      }
      applyGalleryLimit(elements.mobileUploadedGallery);
      return;
    }
    if (!response.ok) {
      throw new Error(`GitHub 返回 ${response.status}`);
    }

    const items = await response.json();
    const images = Array.isArray(items)
      ? items.filter((item) => item.type === "file" && /\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff|heic)$/i.test(item.name))
      : [];

    if (!queue.length) {
      elements.empty.hidden = images.length > 0;
      elements.empty.textContent = images.length ? "" : "今天还没有手机端上传图片";
    }

    images
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "mobile-upload-card";

        const image = document.createElement("img");
        image.src = item.download_url;
        image.alt = item.name;
        image.loading = "lazy";

        const name = document.createElement("strong");
        name.textContent = `手机上传 ${String(index + 1).padStart(3, "0")}`;

        const link = document.createElement("a");
        link.href = item.download_url;
        link.download = item.name;
        link.textContent = "下载";

        card.append(image, name, link);
        elements.mobileUploadedGallery.appendChild(card);
      });
    applyGalleryLimit(elements.mobileUploadedGallery);
  } catch (error) {
    if (!queue.length) {
      elements.empty.hidden = false;
      elements.empty.textContent = `手机端图片加载失败：${error.message}`;
    }
  }
}

async function loadDesktopGallery() {
  elements.desktopEmpty.hidden = false;
  elements.desktopEmpty.textContent = "正在加载小麦麦操作的图片";
  elements.desktopGallery.innerHTML = "";
  elements.desktopGallery.dataset.expanded = "false";
  try {
    const manifestUrl = new URL("desktop-gallery/manifest.json", document.baseURI);
    manifestUrl.searchParams.set("t", Date.now());
    const response = await fetch(manifestUrl.href, { cache: "no-store" });
    if (!response.ok) {
      elements.desktopEmpty.textContent = "暂时没有加载到电脑端图片";
      return;
    }
    const manifest = await response.json();
    const items = Array.isArray(manifest.items) ? manifest.items : [];
    if (!items.length) {
      elements.desktopEmpty.textContent = "电脑端还没有放入图片";
      applyGalleryLimit(elements.desktopGallery);
      return;
    }
    elements.desktopEmpty.hidden = items.length > 0;

    const groups = new Map();
    items.forEach((item) => {
      const dateKey = item.date || "未分类";
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(item);
    });

    let cardIndex = 0;
    groups.forEach((groupItems, dateKey) => {
      const group = document.createElement("section");
      group.className = "desktop-date-group";

      const heading = document.createElement("div");
      heading.className = "desktop-date-heading";

      const title = document.createElement("h3");
      title.textContent = formatGalleryDateLabel(dateKey);

      const count = document.createElement("span");
      count.textContent = `${groupItems.length} 张`;

      const gallery = document.createElement("div");
      gallery.className = "desktop-date-gallery";
      gallery.dataset.expanded = "false";

      heading.append(title, count);
      group.append(heading, gallery);
      elements.desktopGallery.appendChild(group);

      groupItems.forEach((item) => {
        const card = renderDesktopCard(item, cardIndex);
        gallery.appendChild(card);
        cardIndex += 1;
      });
      applyGalleryLimit(gallery);
    });
  } catch (error) {
    elements.desktopEmpty.hidden = false;
    elements.desktopEmpty.textContent = `图片加载失败：${error.message}`;
  }
}

function formatGalleryDateLabel(value) {
  const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return `${value} 上传`;
  return `${Number(match[2])}-${Number(match[3])} 上传`;
}

function renderDesktopCard(item, index) {
      const thumbUrl = item.thumbUrl || item.url;
      const downloadUrl = item.downloadUrl || item.url;
      const safeIndexName = `小麦麦图片 ${String(index + 1).padStart(3, "0")}`;
      const displayName = String(downloadUrl).includes("xiaomaimai-") ? safeIndexName : (item.name || decodeURIComponent(String(downloadUrl).split("/").pop() || "图片"));
      const card = document.createElement("article");
      card.className = "desktop-card";

      const image = document.createElement("img");
      image.src = new URL(thumbUrl, document.baseURI).href;
      image.alt = displayName;
      image.loading = "lazy";

      const name = document.createElement("strong");
      name.textContent = displayName;

      const date = document.createElement("span");
      date.className = "card-date";
      date.textContent = item.date ? `日期：${item.date}` : "";

      const link = document.createElement("a");
      link.href = new URL(downloadUrl, document.baseURI).href;
      link.download = displayName;
      link.textContent = "下载原图";

      card.append(image, name, date, link);
      return card;
}

async function loadLocalGallery() {
  try {
    const manifestUrl = new URL("local-gallery/manifest.json", document.baseURI);
    manifestUrl.searchParams.set("t", Date.now());
    const response = await fetch(manifestUrl.href, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    renderLocalCards(elements.modelGallery, elements.modelEmpty, manifest.models || [], "模特");
    renderLocalCards(elements.aiGeneratedGallery, elements.aiGeneratedEmpty, manifest.aiGenerated || [], "AI试衣图");
  } catch {
    elements.modelEmpty.hidden = false;
    elements.aiGeneratedEmpty.hidden = false;
  }
}

async function fetchRepoContent(settings, path) {
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.branch)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/vnd.github+json",
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || `GitHub 返回 ${response.status}`);
  }
  return result;
}

async function putRepoContent(settings, path, content, message, sha) {
  const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
  const body = {
    message,
    branch: settings.branch,
    content,
  };
  if (sha) body.sha = sha;

  const response = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || `GitHub 返回 ${response.status}`);
  }
  return result;
}

function modelUploadName(file, index) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const extension = (file.name.match(/\.[^.]+$/)?.[0] || ".jpg").toLowerCase();
  return `model-${stamp}-${String(index + 1).padStart(2, "0")}${extension}`;
}

async function uploadModelFiles(files) {
  const selectedFiles = [...files].filter((file) => file.type.startsWith("image/"));
  if (!selectedFiles.length) return;

  saveSettings();
  const settings = getSettings();
  if (!settings.token || !settings.owner || !settings.repo) {
    alert("请先展开上传设置，填写 GitHub Token、仓库拥有者和仓库名。");
    return;
  }

  elements.uploadModelButton.disabled = true;
  elements.modelUploadStatus.textContent = `正在上传 ${selectedFiles.length} 张模特图`;

  try {
    const manifestPath = "local-gallery/manifest.json";
    const manifestDocument = await fetchRepoContent(settings, manifestPath);
    const manifest = JSON.parse(base64ToText(manifestDocument.content || ""));
    manifest.models = Array.isArray(manifest.models) ? manifest.models : [];
    manifest.aiGenerated = Array.isArray(manifest.aiGenerated) ? manifest.aiGenerated : [];

    for (const [index, file] of selectedFiles.entries()) {
      const uploadName = modelUploadName(file, index);
      const uploadPath = `local-gallery/models/${uploadName}`;
      elements.modelUploadStatus.textContent = `正在上传 ${index + 1}/${selectedFiles.length}`;
      await putRepoContent(settings, uploadPath, await readFileAsBase64(file), `Upload model ${uploadName}`);
      manifest.models.push({
        name: uploadName.replace(/\.[^.]+$/, ""),
        url: uploadPath,
      });
    }

    manifest.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "");
    const manifestJson = JSON.stringify(manifest, null, 2);
    await putRepoContent(settings, manifestPath, textToBase64(manifestJson), "Update model gallery", manifestDocument.sha);
    elements.modelUploadStatus.textContent = "模特图已上传，正在刷新";
    await loadLocalGallery();
    elements.modelUploadStatus.textContent = "模特图已上传；电脑端运行同步脚本后会下载到 D:\\Desktop\\codex\\模特";
  } catch (error) {
    elements.modelUploadStatus.textContent = `上传失败：${error.message}`;
  } finally {
    elements.uploadModelButton.disabled = false;
    elements.modelFileInput.value = "";
  }
}

function renderLocalCards(container, emptyElement, items, label) {
  container.innerHTML = "";
  container.dataset.expanded = "false";
  emptyElement.hidden = items.length > 0;
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "local-card";
    const previewUrl = item.thumbUrl || item.url;
    const downloadUrl = item.url;

    const image = document.createElement("img");
    image.src = new URL(previewUrl, document.baseURI).href;
    image.alt = item.name || `${label} ${index + 1}`;
    image.loading = "lazy";

    const name = document.createElement("strong");
    name.textContent = `${label} ${String(index + 1).padStart(3, "0")}`;

    const link = document.createElement("a");
    link.href = new URL(downloadUrl, document.baseURI).href;
    link.download = item.name || `${label}-${index + 1}`;
    link.textContent = "下载";

    card.append(image, name, link);
    container.appendChild(card);
  });
  applyGalleryLimit(container);
}
