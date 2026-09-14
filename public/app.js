/* Rhodo marketing site. No dependencies. Set contactEmail to enable mail drafts. */
(() => {
  "use strict";
  const config = { contactEmail: "" };
  const header = document.querySelector(".site-header");
  const updateHeader = () =>
    header?.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
  const menuButton = document.querySelector(".menu-toggle");
  const menu = document.querySelector("#mobile-menu");
  function closeMenu() {
    if (!menuButton) return;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    menu.hidden = true;
  }
  menuButton?.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    menu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  menu
    ?.querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      closeMenu();
      menuButton.focus();
    }
  });
  window.matchMedia("(min-width: 801px)").addEventListener("change", (e) => {
    if (e.matches) closeMenu();
  });

  const tabs = [...document.querySelectorAll("[data-product]")];
  function selectTab(tab, focus = false) {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden =
        !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      let next = i;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft")
        next = (i + tabs.length - 1) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      selectTab(tabs[next], true);
    });
  });

  const dialog = document.querySelector("#trailer-dialog");
  const video = document.querySelector("#full-video");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let lastFocus = null;
  if (dialog) {
    let pendingStart = null;
    let startRequest = 0;
    const chapterButtons = [...dialog.querySelectorAll("[data-time]")];
    const featurePosition = dialog.querySelector("#feature-position");
    const featureTitle = dialog.querySelector("#feature-title");
    const previousFeature = dialog.querySelector("[data-feature-previous]");
    const nextFeature = dialog.querySelector("[data-feature-next]");
    let activeChapter = -1;
    function updateFeature(time) {
      let index = 0;
      chapterButtons.forEach((button, i) => {
        if (time >= Number(button.dataset.time)) index = i;
      });
      if (index === activeChapter || !chapterButtons.length) return;
      activeChapter = index;
      chapterButtons.forEach((button, i) => {
        if (i === index) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      });
      const title = chapterButtons[index].textContent
        .trim()
        .replace(/^\d+:\d+\s+/, "");
      if (featurePosition)
        featurePosition.textContent = `Feature ${index + 1} of ${chapterButtons.length}`;
      if (featureTitle) featureTitle.textContent = title;
      if (previousFeature) previousFeature.disabled = index === 0;
      if (nextFeature)
        nextFeature.disabled = index === chapterButtons.length - 1;
    }
    function cancelPendingStart() {
      startRequest += 1;
      if (pendingStart)
        video.removeEventListener("loadedmetadata", pendingStart);
      pendingStart = null;
    }
    function playVideo() {
      video.play().catch(() => {
        /* Native controls remain available if autoplay is blocked. */
      });
    }
    function startVideo(time, scrollBehavior) {
      cancelPendingStart();
      if (!dialog.open) return;
      updateFeature(time);
      const request = startRequest;
      const begin = () => {
        if (!dialog.open || request !== startRequest) return;
        pendingStart = null;
        video.currentTime = time;
        dialog.scrollTo({ top: 0, behavior: scrollBehavior });
        playVideo();
      };
      const status = dialog.querySelector("#video-status");
      const load = () => {
        if (!dialog.open || request !== startRequest) return;
        if (status) status.hidden = true;
        if (video.readyState >= 1) begin();
        else {
          pendingStart = begin;
          video.addEventListener("loadedmetadata", begin, { once: true });
          playVideo();
        }
      };
      const preparation = window.prepareRhodoVideo?.();
      if (preparation) {
        pendingStart = begin;
        if (status) {
          status.textContent = "Loading the walkthrough…";
          status.hidden = false;
        }
        preparation.then(load).catch(() => {
          if (!dialog.open || request !== startRequest) return;
          pendingStart = null;
          if (status) {
            status.textContent = "The video couldn’t load. Choose a feature to try again, or read the transcript below.";
            status.hidden = false;
          }
        });
      } else load();
    }
    function closeTrailer() {
      cancelPendingStart();
      video.pause();
      dialog.close();
    }
    document.querySelectorAll("[data-trailer]").forEach((button) =>
      button.addEventListener("click", () => {
        lastFocus = button;
        dialog.showModal();
        document.body.classList.add("modal-open");
        startVideo(Number(button.dataset.start || 0), "instant");
      }),
    );
    dialog
      .querySelector(".dialog-close")
      .addEventListener("click", closeTrailer);
    dialog.addEventListener("click", (e) => {
      const r = dialog.getBoundingClientRect();
      if (
        e.target === dialog &&
        (e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom)
      )
        closeTrailer();
    });
    dialog.addEventListener("close", () => {
      cancelPendingStart();
      video.pause();
      document.body.classList.remove("modal-open");
      lastFocus?.focus();
    });
    chapterButtons.forEach((button) =>
      button.addEventListener("click", () => {
        startVideo(
          Number(button.dataset.time),
          reducedMotion.matches ? "auto" : "smooth",
        );
      }),
    );
    function moveFeature(direction) {
      const button = chapterButtons[activeChapter + direction];
      if (button)
        startVideo(
          Number(button.dataset.time),
          reducedMotion.matches ? "auto" : "smooth",
        );
    }
    previousFeature?.addEventListener("click", () => moveFeature(-1));
    nextFeature?.addEventListener("click", () => moveFeature(1));
    const syncFeature = () => {
      if (!pendingStart) updateFeature(video.currentTime);
    };
    video.addEventListener("timeupdate", syncFeature);
    video.addEventListener("seeking", syncFeature);
    updateFeature(0);
  }

  const form = document.querySelector("#callform");
  if (form) {
    const result = document.querySelector("#form-result");
    const request = document.querySelector("#request-text");
    const validEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contactEmail) &&
      !config.contactEmail.endsWith(".example");
    if (validEmail)
      document.querySelector("#delivery-note").textContent =
        "We’ll prepare an email in your mail app. Review it and send when you’re ready.";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = new FormData(form);
      const text = `Rhodo walkthrough request\n\nName: ${d.get("name")}\nEmail: ${d.get("email")}\nFirm: ${d.get("firm")}\nTeam size: ${d.get("team_size") || "Not specified"}\nDiscipline: ${d.get("discipline") || "Not specified"}\n\nCurrent challenge:\n${d.get("workflow")}`;
      request.value = text;
      result.hidden = false;
      if (validEmail) {
        const a = document.createElement("a");
        a.href = `mailto:${config.contactEmail}?subject=${encodeURIComponent("Rhodo walkthrough: " + d.get("firm"))}&body=${encodeURIComponent(text)}`;
        a.click();
        document.querySelector("#result-message").textContent =
          "Your mail app should open with a draft. Review and send it there. If it does not open, copy or save the request below.";
      }
      result.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "nearest",
      });
    });
    const copy = document.querySelector("#copy-request");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(request.value);
        copy.textContent = "Copied";
        setTimeout(() => (copy.textContent = "Copy request"), 2500);
      } catch {
        request.focus();
        request.select();
        copy.textContent = "Select and copy the text";
      }
    });
    document.querySelector("#save-request").addEventListener("click", () => {
      const url = URL.createObjectURL(
        new Blob([request.value], { type: "text/plain;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "rhodo-walkthrough-request.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
})();
