const previewText = document.getElementById("previewText");
const fontSize = document.getElementById("fontSize");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const results = document.getElementById("results");
const cardBox = document.querySelector(".card");
const nameBox = document.querySelector(".name-box");

/* ---------- 글자 입력 ---------- */

previewText.addEventListener("input", function () {
  if (previewText.textContent.trim() === "") {
    previewText.innerHTML = "";
  }
});

previewText.addEventListener("paste", function (e) {
  e.preventDefault();
  const text = e.clipboardData.getData("text/plain");
  document.execCommand("insertText", false, text);
});

nameBox.addEventListener("click", function () {
  previewText.focus();
});

function updateFontSize() {
  const size = Number(fontSize.value);
  if (size > 0) {
    previewText.style.fontSize = size + "px";
  }
}
fontSize.addEventListener("input", updateFontSize);
updateFontSize();

/* ---------- 카드 검색 ---------- */

let allCards = [];

fetch("./cards.json")
  .then(function (r) { return r.json(); })
  .then(function (data) { allCards = data; })
  .catch(function () {
    results.innerHTML = '<div class="msg">cards.json을 불러오지 못했어요. Live Server로 열었는지 확인하세요.</div>';
  });

function searchCards() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return;

  const found = allCards
    .filter(function (c) {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.ko && c.ko.toLowerCase().includes(q))
      );
    })
    .slice(0, 60);

  if (found.length === 0) {
    results.innerHTML = '<div class="msg">검색 결과가 없어요.</div>';
    return;
  }
  renderResults(found);
}

function renderResults(cards) {
  results.innerHTML = "";

  cards.forEach(function (c) {
    const src = "./images/" + c.id + ".webp";

    const img = document.createElement("img");
    img.src = src;
    img.alt = c.name;
    img.title = c.ko ? c.ko + " (" + c.name + ")" : c.name;
    img.loading = "lazy";

    img.addEventListener("click", function () {
      fillSlot(src);
    });

    results.appendChild(img);
  });
}

searchBtn.addEventListener("click", searchCards);
searchInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") searchCards();
});

/* ---------- 이미지로 저장 ---------- */

const downloadBtn = document.getElementById("downloadBtn");
const EXPORT_SCALE = 2;          // 1 = 514px, 2 = 약 1028px
const EXPORT_W = 514;            // 테두리를 뺀 저장 크기
const EXPORT_H = 512;
const CARD_COLOR = "#e8d3a0";

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// 사진 칸을 캔버스에 직접 그림 (도형 오리기 + 늘려서 채우기)
async function drawSlotsToCanvas(ctx, k) {
  const shapes = getSlotShapes(layout, EXPORT_W, EXPORT_H);

  for (let i = 0; i < shapes.length; i++) {
    if (!slotImages[i]) continue;
    const sh = shapes[i];
    const img = await loadImage(slotImages[i]);

    ctx.save();
    ctx.beginPath();
    sh.poly.forEach(function (p, idx) {
      if (idx === 0) ctx.moveTo(p[0] * k, p[1] * k);
      else ctx.lineTo(p[0] * k, p[1] * k);
    });
    ctx.closePath();
    ctx.clip();

    if (layout === 1) {
      // 1장 모드: 꽉 채우기 (cover)
      const r = Math.max(sh.w / img.width, sh.h / img.height);
      const dw = img.width * r;
      const dh = img.height * r;
      ctx.drawImage(img, (sh.x + (sh.w - dw) / 2) * k, (sh.y + (sh.h - dh) / 2) * k, dw * k, dh * k);
    } else {
      // 분할 모드: 칸 전체에 늘려서 채우기
      ctx.drawImage(img, sh.x * k, sh.y * k, sh.w * k, sh.h * k);
    }
    ctx.restore();
  }
}

downloadBtn.addEventListener("click", async function () {
  previewText.blur();
  cardBox.classList.add("exporting");
  window.scrollTo(0, 0);

  try {
    await document.fonts.ready;

    // 1) 검은 상자 + 글자만 캡처 (사진 칸과 카드 배경은 숨김)
    const overlay = await html2canvas(cardBox, {
      scale: EXPORT_SCALE,
      backgroundColor: null,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      onclone: function (clonedDoc) {
        const c = clonedDoc.querySelector(".card");
        c.style.border = "none";
        c.style.background = "none";
        c.style.position = "fixed";
        c.style.top = "0";
        c.style.left = "0";
        c.style.margin = "0";
        c.style.width = EXPORT_W + "px";
        c.style.height = EXPORT_H + "px";
        clonedDoc.getElementById("slots").style.display = "none";
      }
    });

    // 2) 바닥 캔버스: 배경색 + 사진 칸
    const out = document.createElement("canvas");
    out.width = overlay.width;
    out.height = overlay.height;
    const ctx = out.getContext("2d");
    const k = overlay.width / EXPORT_W;

    ctx.fillStyle = CARD_COLOR;
    ctx.fillRect(0, 0, out.width, out.height);
    await drawSlotsToCanvas(ctx, k);

    // 3) 검은 상자 + 글자를 위에 얹기
    ctx.drawImage(overlay, 0, 0);

    out.toBlob(function (blob) {
      const name = previewText.textContent.trim().replace(/[\\/:*?"<>|]/g, "") || "card";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name + ".png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  } catch (e) {
    alert("저장에 실패했어요. F12 → Console의 에러를 확인하세요.");
    console.error(e);
  } finally {
    cardBox.classList.remove("exporting");
  }
});
/* ---------- 분할 레이아웃 ---------- */

/* ---------- 분할 레이아웃 ---------- */

const slotsEl = document.getElementById("slots");
const layoutButtons = document.querySelectorAll("[data-layout]");

// 3분할 삼각형의 옆면 기울기 (가로로 퍼지는 정도 / 세로 길이)
// 0.45 = 보내주신 이미지와 비슷한 모양, 0.577 = 꼭짓점 각도 60°의 정삼각형
const TRI_SLOPE = 0.45;

let layout = 1;
let activeSlot = 0;
const slotImages = [null, null, null];

// 각 칸의 위치/크기(x, y, w, h)와 모양(poly: 꼭짓점 좌표)을 계산
function getSlotShapes(n, W, H) {
  if (n === 1) {
    return [{ x: 0, y: 0, w: W, h: H, poly: [[0, 0], [W, 0], [W, H], [0, H]] }];
  }

  if (n === 2) {
    const m = W / 2;
    return [
      { x: 0, y: 0, w: m, h: H, poly: [[0, 0], [m, 0], [m, H], [0, H]] },
      { x: m, y: 0, w: W - m, h: H, poly: [[m, 0], [W, 0], [W, H], [m, H]] }
    ];
  }

  // 3분할: 왼쪽 / 가운데 삼각형 / 오른쪽
  const cx = W / 2;
  const dx = Math.min(TRI_SLOPE * H, W / 2); // 아래쪽에서 삼각형이 좌우로 퍼지는 폭
  return [
    { x: 0, y: 0, w: cx, h: H, poly: [[0, 0], [cx, 0], [cx - dx, H], [0, H]] },
    { x: cx - dx, y: 0, w: 2 * dx, h: H, poly: [[cx, 0], [cx + dx, H], [cx - dx, H]] },
    { x: cx, y: 0, w: W - cx, h: H, poly: [[cx, 0], [W, 0], [W, H], [cx + dx, H]] }
  ];
}

function renderSlots() {
  slotsEl.innerHTML = "";
  slotsEl.classList.toggle("split", layout > 1);

  const shapes = getSlotShapes(layout, slotsEl.clientWidth, slotsEl.clientHeight);

  shapes.forEach(function (sh, i) {
    const slot = document.createElement("div");
    slot.className = "slot";
    if (i === activeSlot) slot.classList.add("active");
    if (slotImages[i]) {
      slot.classList.add("filled");
      slot.style.backgroundImage = "url('" + slotImages[i] + "')";
    }
    slot.dataset.n = i + 1;

    slot.style.left = sh.x + "px";
    slot.style.top = sh.y + "px";
    slot.style.width = sh.w + "px";
    slot.style.height = sh.h + "px";

    // 3분할만 도형으로 오려냄 (칸 안쪽 기준 좌표)
    if (layout === 3) {
      slot.style.clipPath =
        "polygon(" +
        sh.poly.map(function (p) { return (p[0] - sh.x) + "px " + (p[1] - sh.y) + "px"; }).join(",") +
        ")";
    }

    slot.addEventListener("click", function () {
      activeSlot = i;
      renderSlots();
    });

    slotsEl.appendChild(slot);
  });
}

function setLayout(n) {
  layout = n;
  if (activeSlot >= n) activeSlot = 0;

  layoutButtons.forEach(function (b) {
    b.classList.toggle("active", Number(b.dataset.layout) === n);
  });
  renderSlots();
}

function fillSlot(src) {
  const wasEmpty = !slotImages[activeSlot];
  slotImages[activeSlot] = src;

  // 빈 칸을 채운 경우에만 다음 빈 칸으로 이동
  if (wasEmpty) {
    const next = slotImages.slice(0, layout).findIndex(function (v) { return !v; });
    if (next !== -1) activeSlot = next;
  }
  renderSlots();
}

layoutButtons.forEach(function (b) {
  b.addEventListener("click", function () {
    setLayout(Number(b.dataset.layout));
  });
});

// 선택한 칸만 비우기
document.getElementById("clearSlotBtn").addEventListener("click", function () {
  slotImages[activeSlot] = null;
  renderSlots();
});

// 사진 전체 초기화 (덱 이름 글자는 유지)
document.getElementById("clearAllBtn").addEventListener("click", function () {
  slotImages.fill(null);
  activeSlot = 0;
  renderSlots();
});

renderSlots();