const settingsKey = "github-photo-drop-settings";
const queue = [];

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
};

function todayFolderName() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
  elements.token.value = saved.token || "";
  elements.owner.value = saved.owner || "";
  elements.repo.value = saved.repo || "";
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
  saveSettings();
  const settings = getSettings();
  if (!settings.token || !settings.owner || !settings.repo) {
    alert("请先展开上传设置，填写 GitHub Token、仓库拥有者和仓库名。");
    return;
  }

  const pending = queue.filter((item) => !item.done);
  for (const item of pending) {
    try {
      await uploadItem(item, settings);
      item.done = true;
    } catch (error) {
      const status = item.element.querySelector(".item-status");
      status.className = "item-status error";
      status.textContent = error.message;
    }
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
loadSettings();
loadDesktopGallery();

async function loadDesktopGallery() {
  try {
    const response = await fetch(`desktop-gallery/manifest.json?t=${Date.now()}`);
    if (!response.ok) return;
    const manifest = await response.json();
    const items = Array.isArray(manifest.items) ? manifest.items : [];
    elements.desktopEmpty.hidden = items.length > 0;
    elements.desktopGallery.innerHTML = "";

    items.forEach((item) => {
      const displayName = decodeURIComponent(String(item.url).split("/").pop() || item.name || "图片");
      const card = document.createElement("article");
      card.className = "desktop-card";

      const image = document.createElement("img");
      image.src = item.url;
      image.alt = displayName;
      image.loading = "lazy";

      const name = document.createElement("strong");
      name.textContent = displayName;

      const link = document.createElement("a");
      link.href = item.url;
      link.download = displayName;
      link.textContent = "下载到手机";

      card.append(image, name, link);
      elements.desktopGallery.appendChild(card);
    });
  } catch {
    elements.desktopEmpty.hidden = false;
  }
}
