const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = "images";
const CONCURRENCY = 3; // 동시에 받는 개수 (서버 부담 줄이려고 낮게)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function downloadOne(card) {
  const id = card.card_images[0].id;
  const file = path.join(OUT, id + ".webp");
  if (fs.existsSync(file)) return; // 이미 받은 건 건너뛰기

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(card.card_images[0].image_url_cropped);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());

      await sharp(buf)
        .resize(300)            // 가로 300px
        .webp({ quality: 80 })  // WebP 변환
        .toFile(file);
      return;
    } catch (e) {
      if (attempt === 3) console.log("실패:", card.name, e.message);
      else await sleep(1000 * attempt);
    }
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  console.log("카드 목록 받는 중...");
  const res = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php");
  const json = await res.json();
  const cards = json.data;

  // 검색용 가벼운 목록 저장
  const slim = cards.map((c) => ({ id: c.card_images[0].id, name: c.name }));
  fs.writeFileSync("cards.json", JSON.stringify(slim));
  console.log("cards.json 저장 완료:", slim.length + "장");

  // 이미지 다운로드 (CONCURRENCY개씩 병렬)
  let index = 0;
  let done = 0;

  async function worker() {
    while (index < cards.length) {
      const card = cards[index++];
      await downloadOne(card);
      await sleep(50); // 요청 사이 간격
      done++;
      if (done % 200 === 0) console.log(done + " / " + cards.length);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log("끝!");
}

main();