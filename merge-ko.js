const fs = require("fs");

// 따옴표/쉼표/줄바꿈이 섞인 CSV 읽기
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* 무시 */ }
      else field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  fs.copyFileSync("cards.json", "cards.backup.json"); // 백업
  const cards = JSON.parse(fs.readFileSync("cards.json", "utf8"));

  // 코나미 번호 → 내 cards.json의 id
  console.log("코나미 번호 목록 받는 중...");
  const res = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes");
  const json = await res.json();

  const konamiToId = {};
  json.data.forEach(function (c) {
    const kid = c.misc_info && c.misc_info[0] && c.misc_info[0].konami_id;
    if (kid) konamiToId[String(kid)] = String(c.card_images[0].id);
  });

  // 한국어 CSV 읽기
  const text = fs.readFileSync("ko.csv", "utf8").replace(/^\uFEFF/, "");
  const rows = parseCSV(text);

  const koById = {};
  rows.forEach(function (r) {
    const key = (r[0] || "").trim();
    const name = (r[1] || "").trim();
    if (!/^\d+$/.test(key) || !name) return; // 헤더나 빈 줄은 건너뜀
    const id = konamiToId[key];
    if (id) koById[id] = name;
  });

  // cards.json에 합치기
  let matched = 0;
  cards.forEach(function (c) {
    if (koById[c.id]) { c.ko = koById[c.id]; matched++; }
  });

  fs.writeFileSync("cards.json", JSON.stringify(cards));
  console.log("한국어 이름 연결: " + matched + " / " + cards.length + "장");

  // 확인용: "A" 세포 배양 장치
  const test = cards.find(function (c) { return String(c.id) === "64163367"; });
  console.log("확인:", test ? test.ko : "해당 카드 없음");
}

main();