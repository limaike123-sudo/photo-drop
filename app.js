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
  aiGeneratedGallery: document.querySelector("#aiGeneratedGallery"),
  aiGeneratedEmpty: document.querySelector("#aiGeneratedEmpty"),
  todayInfo: document.querySelector("#todayInfo"),
  weatherButton: document.querySelector("#weatherButton"),
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

async function loadWeather() {
  elements.weatherButton.disabled = true;
  elements.weatherButton.textContent = "萧山天气加载中";

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", xiaoshanWeather.latitude);
    url.searchParams.set("longitude", xiaoshanWeather.longitude);
    url.searchParams.set("current", "temperature_2m,weather_code");
    url.searchParams.set("timezone", "Asia/Shanghai");
    const response = await fetch(url.href);
    if (!response.ok) throw new Error("天气加载失败");
    const data = await response.json();
    const current = data.current || {};
    const weatherText = weatherTextByCode[current.weather_code] || "天气";
    const temperature = Math.round(Number(current.temperature_2m));
    elements.weatherButton.textContent = Number.isFinite(temperature)
      ? `${xiaoshanWeather.name} · ${weatherText} · ${temperature}°C`
      : `${xiaoshanWeather.name} · ${weatherText}`;
    elements.weatherButton.disabled = false;
  } catch (error) {
    elements.weatherButton.textContent = error.message || "天气加载失败";
    elements.weatherButton.disabled = false;
  }
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

function galleryLimit() {
  return window.matchMedia("(max-width: 680px)").matches ? 4 : 6;
}

function applyGalleryLimit(container) {
  const cards = [...container.children];
  const limit = galleryLimit();
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
  [
    elements.mobileUploadedGallery,
    elements.desktopGallery,
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
elements.weatherButton.addEventListener("click", loadWeather);
window.addEventListener("resize", refreshGalleryLimits);
renderTodayInfo();
loadWeather();
loadSettings();
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

    items.forEach((item, index) => {
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

      const link = document.createElement("a");
      link.href = new URL(downloadUrl, document.baseURI).href;
      link.download = displayName;
      link.textContent = "下载原图";

      card.append(image, name, link);
      elements.desktopGallery.appendChild(card);
    });
    applyGalleryLimit(elements.desktopGallery);
  } catch (error) {
    elements.desktopEmpty.hidden = false;
    elements.desktopEmpty.textContent = `图片加载失败：${error.message}`;
  }
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

function renderLocalCards(container, emptyElement, items, label) {
  container.innerHTML = "";
  container.dataset.expanded = "false";
  emptyElement.hidden = items.length > 0;
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "local-card";

    const image = document.createElement("img");
    image.src = new URL(item.url, document.baseURI).href;
    image.alt = item.name || `${label} ${index + 1}`;
    image.loading = "lazy";

    const name = document.createElement("strong");
    name.textContent = `${label} ${String(index + 1).padStart(3, "0")}`;

    const link = document.createElement("a");
    link.href = image.src;
    link.download = item.name || `${label}-${index + 1}`;
    link.textContent = "下载";

    card.append(image, name, link);
    container.appendChild(card);
  });
  applyGalleryLimit(container);
}
