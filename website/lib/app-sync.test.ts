import { test } from "node:test";
import assert from "node:assert/strict";
import * as web from "./limits-config";
import * as webLabels from "./ratings/labels";
import * as app from "../../app/src/limits";
import { T as webT } from "./i18n";
import { T as appT } from "../../app/src/i18n";

// The Expo app keeps its own copy of these (separate package). They must match the website.
test("app limits and texts match the website", () => {
  assert.deepEqual(app.CHAT_ERRORS, { tooLong: web.CHAT_ERRORS.tooLong, photo: web.CHAT_ERRORS.photo, tooManyPhotos: web.CHAT_ERRORS.tooManyPhotos });
  assert.equal(app.LIMITS.messageChars, web.LIMITS.messageChars);
  assert.equal(app.LIMITS.messagesPerRequest, web.LIMITS.messagesPerRequest);
  assert.equal(app.LIMITS.photosPerRequest, web.LIMITS.photo.maxPerRequest);
  assert.equal(app.LIMITS.commentChars, webLabels.MAX_COMMENT);
  assert.deepEqual([...app.LABELS], [...webLabels.LABELS]);
  assert.deepEqual(app.LABEL_NAMES, webLabels.LABEL_NAMES);
});

test("app strings for ratings and limits are the same as the website's (numbers included)", () => {
  for (const lang of ["en", "ar"] as const)
    for (const k of ["rateNeedVisit", "rateComment", "rateCommentNote", "rateChange", "rateError", "tooManyMessages", "tooManyRatings", "tooManyFeedback", "tooLarge", "msgTooLong", "photoBad", "feedbackError", "tooManyToday", "tooManyPhotos", "genericError"] as const)
      assert.equal(appT[lang][k], webT[lang][k], `${lang}.${k}`);
  assert.match(webT.en.msgTooLong, new RegExp(web.LIMITS.messageChars.toLocaleString("en-US")));
  assert.match(webT.en.tooManyPhotos, new RegExp(`at most ${web.LIMITS.photo.maxPerRequest}`));
  assert.match(webT.en.photoBad, new RegExp(`up to ${web.LIMITS.photo.maxBytes / 1024 / 1024} MB`));
  assert.equal(app.LIMITS.historyChars, web.LIMITS.historyChars);
  assert.equal(app.LIMITS.photoMaxBytes, web.LIMITS.photo.maxBytes);
  assert.equal(app.LIMITS.minuteWindowSec, web.LIMITS.chatPerMinute.windowMs / 1000);
});

test("app: history drops errors, caps old answers; photo size check", () => {
  const h = app.historyForRequest([
    { role: "user", content: "a" },
    { role: "assistant", content: "Too many messages", error: true },
    { role: "assistant", content: "x".repeat(25000) },
    { role: "user", content: "b" },
  ]);
  assert.deepEqual(h.map((m) => m.content.length), [1, 20000, 1]);
  assert.equal(app.photoFits("data:image/jpeg;base64," + "A".repeat(1000)), true);
  assert.equal(app.photoFits("data:image/jpeg;base64," + "A".repeat(2_200_000)), false);
});

test("app: chat error messages and photo trimming", () => {
  assert.equal(app.chatErrorKey(429, "", "30"), "tooManyMessages");
  assert.equal(app.chatErrorKey(429, "", "7200"), "tooManyToday");
  assert.equal(app.chatErrorKey(429, "", null), "tooManyMessages");
  assert.equal(app.chatErrorKey(413, "", null), "tooLarge");
  assert.equal(app.chatErrorKey(400, web.CHAT_ERRORS.tooLong, null), "msgTooLong");
  assert.equal(app.chatErrorKey(400, web.CHAT_ERRORS.tooManyPhotos, null), "tooManyPhotos");
  assert.equal(app.chatErrorKey(400, web.CHAT_ERRORS.photo, null), "photoBad");
  assert.equal(app.chatErrorKey(400, "Bad request", null), "genericError");
  assert.equal(app.chatErrorKey(500, "", null), "genericError");
  const p = "data:image/png;base64,AAAA";
  const out = app.withLatestPhotos([{ image: p }, { image: "attached" }, { image: p }, { image: p }]);
  assert.deepEqual(out.map((m) => m.image), [undefined, "attached", p, p]);
});
