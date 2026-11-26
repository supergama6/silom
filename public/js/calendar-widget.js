(() => {
  const widget = document.querySelector("[data-economic-calendar]");
  if (!widget) return;

  const moduleScript = widget.querySelector('script[type="module"]');
  const status = widget.querySelector("[data-calendar-status]");
  const title = widget.querySelector("[data-calendar-title]");
  const message = widget.querySelector("[data-calendar-message]");
  const retry = widget.querySelector("[data-calendar-retry]");
  let timeoutId = window.setTimeout(setErrorState, 18000);

  function setErrorState() {
    window.clearTimeout(timeoutId);
    widget.dataset.state = "error";
    status.hidden = false;
    title.textContent = "财经日历暂时无法加载";
    message.textContent = "当前环境可能无法连接 TradingView。你可以重试，或直接前往 TradingView 查看财经日历。";
  }

  function setReadyState() {
    window.clearTimeout(timeoutId);
    widget.dataset.state = "ready";
    status.hidden = true;
  }

  moduleScript.addEventListener("error", setErrorState, { once: true });
  if (widget.dataset.state === "module-error") setErrorState();

  customElements.whenDefined("tv-economic-calendar").then(() => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(setReadyState));
  });

  retry.addEventListener("click", () => window.location.reload());
})();
