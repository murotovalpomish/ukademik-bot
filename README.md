# 🎓 Ukademik — Ukademiklar kanali uchun Telegram bot va Mini App

Bo'limlar:

- 🧠 **Kunlik Zakovat savoli** — har kuni kanalga chiqadi, savol ochilgach 1 daqiqa + 10 soniya; eng tez to'g'ri javob berganlar ko'proq ball oladi (10 / 8 / 6 / 4 / 2). Kechqurun javob va eng tezkorlar kanalga e'lon qilinadi. Apellyatsiya ham bor.
- ⏱ **Zakovat soati** — Savol (60 s), Dublet (2×30 s), Blits (3×20 s), 10 soniya signali, javob yozish vaqti, qo'lda rejim, kunduzgi/tungi rejim.
- 📚 **Zakovat savollari** — savollar bazasi (yopilgan kunlik savollar + admin qo'shgan to'plamlar), javob yozib tekshirish.
- 🎯 **Shaxsiy o'yin** (Svoyak) — ochiq/yopiq turnirlar, 6 xonali kod, boshlovchi tasdiqlaydi; tugma bosilgach boshqalarga qulflanadi, 7 soniya sanoq, +/− ball, tahrirlash, ixcham jonli jadval (sariq miltillash), chat (matn + ovozli xabar, tahrirlash/o'chirish/pin), Telegram ovozli chati havolasi, qidiruv va filtrlar.
- 🧱 **To'siq** — WallRush (Quoridor) uslubidagi o'yin: tezkor o'yin (onlayn raqib bo'lmasa reytingga mos AI, AI 70–90% hollarda yutqazadi, hissiyot bildiradi, insondek o'ylab yuradi), do'st bilan kod orqali, AI bilan mashq (4 daraja), Elo reyting, 5:00 soat.
- ⚽ **Penalti** — darvoza 6 qismga bo'lingan, ikkala tomonga 7 soniya; tezkor onlayn o'yin, do'st bilan (kod/havola), AI bilan, Telegram guruhida /penalti; turnirlar: guruh bosqichi (8/16) yoki play-off (1/32 … final), bo'sh o'rinlarni AI bilan to'ldirish.
- 👑 **Bosh admin** — barcha turnirlar, obunachilar ro'yxati, bot qo'shilgan guruhlar.
- 👤 Kanalga obuna tekshiruvi, "bot emasman" tekshiruvi, Telegram rasmi va ismi bilan akkaunt, profilni tahrirlash, reytinglar.
- ⚙️ **Admin panel** (Ukademiklar kanali adminlari uchun avtomatik): savollar, futbol o'yinlari, vaqt sozlamalari.

## Ishga tushirish (Render.com, bepul)

1. @BotFather → `/newbot` → token oling.
2. Botni **@ukademiklar** kanaliga admin qiling.
3. Render → **New → Web Service → Public Git Repository** → shu repozitoriy havolasi.
   - Build Command: `npm install`, Start Command: `npm start`, Instance: **Free**
   - Environment: `BOT_TOKEN` = BotFather bergan token
4. Deploy tugagach botga `/start` yozing — tayyor! Menyu tugmasi va webhook avtomatik sozlanadi.

Kutubxonalar talab qilinmaydi (faqat Node.js 18+).

### Ixtiyoriy: istalgan chatdan o'yinga chaqirish
@BotFather → `/setinline` → botni tanlang → masalan «O'yin tanlang». Shundan so'ng istalgan chatda `@Ukademik_bot` deb yozib, Penalti yoki To'siq taklifini yuborish mumkin.

### Ma'lumotlar saqlanishi
Bepul serverda disk vaqtinchalik bo'lgani uchun bot barcha ma'lumotlarni har 3 daqiqada kanal adminining bot bilan shaxsiy chatiga **pin qilingan fayl** sifatida saqlaydi va qayta ishga tushganda o'sha yerdan tiklaydi. Bu faylni o'chirmang.

### Ixtiyoriy sozlamalar (Environment)
- `CHANNEL` — kanal (standart: `@ukademiklar`)
- `ADMIN_IDS` — qo'shimcha adminlar Telegram ID lari (vergul bilan)
- `SUPER_ADMIN_IDS` — bosh admin(lar) Telegram ID si (aks holda admin panelda «Men bosh adminman» tugmasi bilan belgilanadi)
- `PUBLIC_URL` — Render'dan boshqa joyda ishlatilsa, saytning to'liq manzili
- `DATA_DIR` — doimiy disk bo'lsa, ma'lumotlar papkasi
