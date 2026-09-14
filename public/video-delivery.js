(() => {
  let ready = false;
  let preparation;
  function prepare() {
    if (ready) return null;
    if (preparation) return preparation;
    preparation = (async () => {
      if (!("serviceWorker" in navigator)) throw new Error("This browser does not support the video player");
      await navigator.serviceWorker.register("media-worker.js", { scope: "./", updateViaCache: "none" });
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve, reject) => {
          const done = () => {
            if (!navigator.serviceWorker.controller) return;
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("controllerchange", done);
            resolve();
          };
          const timeout = setTimeout(() => {
            navigator.serviceWorker.removeEventListener("controllerchange", done);
            reject(new Error("The video player could not start"));
          }, 10000);
          navigator.serviceWorker.addEventListener("controllerchange", done);
          done();
        });
      }
      ready = true;
    })().catch((error) => { preparation = null; throw error; });
    return preparation;
  }
  window.prepareRhodoVideo = prepare;
  // Prepare the small worker at page load; video bytes still load on demand.
  prepare()?.catch(() => {});
})();
