const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");

function player({ readyState = 0, reducedMotion = false, delivery = null } = {}) {
  class Element extends EventTarget {
    constructor(dataset = {}) {
      super();
      this.dataset = dataset;
      this.focused = false;
      this.attributes = new Map();
      this.disabled = false;
      this.textContent = "";
    }
    click() {
      if (!this.disabled) this.dispatchEvent(new Event("click"));
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    focus() {
      this.focused = true;
    }
    querySelectorAll() {
      return [];
    }
  }
  const openers = [new Element(), new Element({ start: "31.199" })];
  const chapters = [
    ["0.0", "0:00 SAM.gov"],
    ["17.743", "0:17 Pipeline"],
    ["31.199", "\n          0:31 AI fit analysis\n        "],
    ["184.482", "3:04 Supporting tools"],
    ["197.328", "3:17 Summary"],
  ].map(([time, textContent]) =>
    Object.assign(new Element({ time }), { textContent }),
  );
  const closeButton = new Element();
  const previousFeature = new Element();
  const nextFeature = new Element();
  const featureTitle = new Element();
  const featurePosition = new Element();
  const video = Object.assign(new Element(), {
    readyState,
    currentTime: 0,
    plays: 0,
    pauses: 0,
    play() {
      this.plays += 1;
      return Promise.resolve();
    },
    pause() {
      this.pauses += 1;
    },
  });
  const dialog = Object.assign(new Element(), {
    open: false,
    scrolls: [],
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
    scrollTo(options) {
      this.scrolls.push(options);
    },
    querySelector(selector) {
      return (
        {
          ".dialog-close": closeButton,
          "[data-feature-previous]": previousFeature,
          "[data-feature-next]": nextFeature,
          "#feature-title": featureTitle,
          "#feature-position": featurePosition,
        }[selector] || null
      );
    },
    querySelectorAll() {
      return chapters;
    },
  });
  const classes = new Set();
  const selectors = {
    "#mobile-menu": new Element(),
    "#trailer-dialog": dialog,
    "#full-video": video,
  };
  const document = Object.assign(new Element(), {
    body: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
    querySelector: (selector) => selectors[selector] || null,
    querySelectorAll: (selector) =>
      selector === "[data-trailer]" ? openers : [],
  });
  const matchMedia = () => ({ matches: reducedMotion, addEventListener() {} });
  vm.runInNewContext(source, {
    document,
    window: { scrollY: 0, addEventListener() {}, matchMedia, prepareRhodoVideo: () => delivery },
    matchMedia,
  });
  const metadata = () => {
    video.readyState = 1;
    video.dispatchEvent(new Event("loadedmetadata"));
  };
  return {
    openers,
    chapters,
    closeButton,
    video,
    dialog,
    classes,
    metadata,
    previousFeature,
    nextFeature,
    featureTitle,
    featurePosition,
  };
}

test("closing during the first load cannot restart hidden playback", () => {
  const p = player();
  p.openers[1].click();
  assert.equal(p.video.plays, 1, "loading begins in the click gesture");
  p.closeButton.click();
  const playsBeforeMetadata = p.video.plays;
  p.metadata();
  assert.equal(p.video.plays, playsBeforeMetadata);
  assert.equal(p.video.currentTime, 0);
  assert.equal(p.dialog.open, false);
  assert.equal(p.openers[1].focused, true);
  assert.equal(p.classes.has("modal-open"), false);
});

test("native dialog closure also cancels a pending seek", () => {
  const p = player();
  p.openers[1].click();
  p.dialog.close();
  p.metadata();
  assert.equal(p.video.plays, 1);
  assert.equal(p.video.currentTime, 0);
  assert.ok(p.video.pauses > 0);
});

test("only the latest chapter request runs when metadata arrives", () => {
  const p = player();
  p.openers[1].click();
  p.chapters[1].click();
  p.chapters[3].click();
  const playsBeforeMetadata = p.video.plays;
  p.metadata();
  assert.equal(p.video.plays, playsBeforeMetadata + 1);
  assert.equal(p.video.currentTime, 184.482);
  assert.equal(p.dialog.scrolls.at(-1).top, 0);
  assert.equal(p.dialog.scrolls.at(-1).behavior, "smooth");
});

test("reopening before metadata uses the new opener and cancels the old request", () => {
  const p = player();
  p.openers[1].click();
  p.dialog.close();
  p.openers[0].click();
  const playsBeforeMetadata = p.video.plays;
  p.metadata();
  assert.equal(p.video.currentTime, 0);
  assert.equal(p.video.plays, playsBeforeMetadata + 1);
  assert.equal(p.dialog.scrolls.at(-1).behavior, "instant");
});

test("loaded video seeks immediately and honors reduced motion", () => {
  const p = player({ readyState: 1, reducedMotion: true });
  p.openers[1].click();
  assert.equal(p.video.currentTime, 31.199);
  assert.equal(p.video.plays, 1);
  p.chapters[3].click();
  assert.equal(p.video.currentTime, 184.482);
  assert.equal(p.dialog.scrolls.at(-1).behavior, "auto");
  p.dialog.close();
  p.openers[0].click();
  assert.equal(p.video.currentTime, 0);
});

test("feature label and active chapter follow playback and native seeking", () => {
  const p = player({ readyState: 1 });
  p.openers[0].click();
  assert.equal(p.featureTitle.textContent, "SAM.gov");
  assert.equal(p.previousFeature.disabled, true);
  p.video.currentTime = 31.2;
  p.video.dispatchEvent(new Event("timeupdate"));
  assert.equal(p.featureTitle.textContent, "AI fit analysis");
  assert.equal(p.featurePosition.textContent, "Feature 3 of 5");
  assert.equal(p.chapters[2].getAttribute("aria-current"), "true");
  assert.equal(p.chapters[0].getAttribute("aria-current"), null);
  p.video.currentTime = 22;
  p.video.dispatchEvent(new Event("seeking"));
  assert.equal(p.featureTitle.textContent, "Pipeline");
  assert.equal(
    p.chapters.filter((c) => c.getAttribute("aria-current") === "true").length,
    1,
  );
});

test("previous and next features seek adjacent chapters and stop at both ends", () => {
  const p = player({ readyState: 1 });
  p.openers[0].click();
  p.previousFeature.click();
  assert.equal(p.video.currentTime, 0);
  p.nextFeature.click();
  assert.equal(p.video.currentTime, 17.743);
  assert.equal(p.previousFeature.disabled, false);
  p.previousFeature.click();
  assert.equal(p.video.currentTime, 0);
  p.chapters[4].click();
  assert.equal(p.featureTitle.textContent, "Summary");
  assert.equal(p.nextFeature.disabled, true);
  p.nextFeature.click();
  assert.equal(p.video.currentTime, 197.328);
  p.previousFeature.click();
  assert.equal(p.video.currentTime, 184.482);
  assert.equal(p.nextFeature.disabled, false);
});

test("successive feature navigation before metadata keeps the latest selection", () => {
  const p = player();
  p.openers[0].click();
  p.nextFeature.click();
  p.nextFeature.click();
  assert.equal(p.featureTitle.textContent, "AI fit analysis");
  p.video.dispatchEvent(new Event("timeupdate"));
  assert.equal(p.featureTitle.textContent, "AI fit analysis");
  p.metadata();
  assert.equal(p.video.currentTime, 31.199);
  assert.equal(p.featureTitle.textContent, "AI fit analysis");
});

test("both pages expose every approved chapter at its original timestamp", () => {
  const sceneTimes = JSON.parse(
    fs.readFileSync(path.join(__dirname, "demo-scenes.json"), "utf8"),
  ).map((scene) => scene.start);
  for (const page of ["index.html", "system.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "public", page), "utf8");
    const times = [...html.matchAll(/data-time="([0-9.]+)"/g)].map((match) =>
      Number(match[1]),
    );
    assert.deepEqual(
      times,
      sceneTimes,
      `${page} stays in sync with the narration chapters`,
    );
  }
});


test("closing during delivery preparation cannot start hidden video", async () => {
  let complete;
  const delivery = new Promise((resolve) => { complete = resolve; });
  const p = player({ readyState: 1, delivery });
  p.openers[0].click();
  assert.equal(p.video.plays, 0);
  p.closeButton.click();
  complete();
  await new Promise(setImmediate);
  assert.equal(p.video.plays, 0);
});

test("delivery preparation preserves the latest chapter request", async () => {
  let complete;
  const delivery = new Promise((resolve) => { complete = resolve; });
  const p = player({ readyState: 1, delivery });
  p.openers[0].click();
  p.chapters[2].click();
  complete();
  await new Promise(setImmediate);
  assert.equal(p.video.plays, 1);
  assert.equal(p.video.currentTime, 31.199);
});
