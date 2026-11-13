import { test } from "node:test";
import assert from "node:assert/strict";
import { asksMusic, blockedReply, noMusicCountries, noMusicReply } from "./rules";

test("asksMusic: English and Arabic music words; oud perfume is not music", () => {
  for (const q of ["What music can I enjoy in Riyadh?", "Concerts in Doha", "Any opera in Kuwait City?", "Where can I hear singing in Jeddah", "Musical events in AlUla", "ما هي الموسيقى في الرياض؟", "أين أسمع الأغاني في الدوحة", "حفلة موسيقية في الكويت"])
    assert.equal(asksMusic(q), true, q);
  for (const q of ["Where can I buy oud in Doha?", "Tell me about Riyadh", "Museums in Jeddah", "ماذا أشتري في الدوحة؟", "Is Singapore in the guide?"])
    assert.equal(asksMusic(q), false, q);
});

test("noMusicCountries: only Saudi Arabia, Qatar, Kuwait", () => {
  assert.deepEqual(noMusicCountries(["Saudi Arabia", "UAE"]), ["Saudi Arabia"]);
  assert.deepEqual(noMusicCountries(["Türkiye", "UAE"]), []);
  assert.deepEqual(noMusicCountries(["Qatar", "Kuwait"]), ["Qatar", "Kuwait"]);
});

test("fixed replies in English and Arabic", () => {
  assert.match(blockedReply(["Lahore"], "en"), /does not cover Lahore/);
  assert.match(blockedReply(["Erbil"], "ar"), /لا يغطي Ummah One Erbil/);
  assert.match(noMusicReply("en"), /does not cover music/);
  assert.match(noMusicReply("ar"), /الموسيقى/);
});
