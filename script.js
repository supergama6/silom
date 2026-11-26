const header = document.querySelector("[data-site-header]");
const drawer = document.querySelector(".mobile-drawer");
const overlay = document.querySelector(".mobile-drawer__overlay");
const menuToggle = document.querySelector(".site-header__menu-toggle");
const drawerClose = document.querySelector(".mobile-drawer__close");
const mobileLanguageTrigger = document.querySelector("[data-mobile-language-trigger]");
const mobileLanguageMenu = document.querySelector(".mobile-drawer__language-menu");
const scrollTopButton = document.querySelector("[data-scroll-top]");
let lastFocusedElement = null;

function setDrawer(open) {
  drawer.classList.toggle("is-open", open);
  overlay.classList.toggle("is-open", open);
  document.body.classList.toggle("is-drawer-open", open);
  drawer.setAttribute("aria-hidden", String(!open));
  drawer.inert = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  if (open) {
    lastFocusedElement = document.activeElement;
    drawerClose.focus();
  } else if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
}

function closeDesktopMenus(except) {
  document.querySelectorAll(".site-header__item--dropdown.is-open, .site-header__language.is-open, .site-header__submenu-item--nested.is-open").forEach((item) => {
    if (item === except) return;
    item.classList.remove("is-open");
    item.querySelector(":scope > [aria-expanded]")?.setAttribute("aria-expanded", "false");
  });
}

document.querySelectorAll(".site-header__trigger, .site-header__submenu-trigger").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const owner = trigger.parentElement;
    const open = !owner.classList.contains("is-open");
    closeDesktopMenus(owner);
    owner.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", String(open));
  });
});

document.addEventListener("click", () => closeDesktopMenus());

menuToggle.addEventListener("click", () => setDrawer(!drawer.classList.contains("is-open")));
drawerClose.addEventListener("click", () => setDrawer(false));
overlay.addEventListener("click", () => setDrawer(false));

document.querySelectorAll(".mobile-nav__trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const submenu = trigger.nextElementSibling;
    const open = trigger.getAttribute("aria-expanded") !== "true";
    trigger.setAttribute("aria-expanded", String(open));
    submenu.hidden = !open;
  });
});

mobileLanguageTrigger.addEventListener("click", () => {
  const open = mobileLanguageTrigger.getAttribute("aria-expanded") !== "true";
  mobileLanguageTrigger.setAttribute("aria-expanded", String(open));
  mobileLanguageMenu.hidden = !open;
});

function setLanguage(language) {
  const key = language === "en" ? "i18nEn" : "i18nCn";
  document.documentElement.lang = language === "en" ? "en" : "zh-Hans";
  document.querySelectorAll("[data-i18n-cn]").forEach((element) => {
    element.textContent = element.dataset[key];
  });
  document.querySelectorAll("[data-language-label]").forEach((element) => {
    element.textContent = language === "en" ? "English" : "中文简体";
  });
  sessionStorage.setItem("silom-language", language);
  mobileLanguageTrigger.setAttribute("aria-expanded", "false");
  mobileLanguageMenu.hidden = true;
  closeDesktopMenus();
}

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});

scrollTopButton.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", () => {
  header.classList.toggle("is-sticky", window.scrollY > 250);
}, { passive: true });

window.addEventListener("resize", () => {
  if (window.innerWidth >= 1200 && drawer.classList.contains("is-open")) setDrawer(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (drawer.classList.contains("is-open")) setDrawer(false);
  closeDesktopMenus();
});

setLanguage(sessionStorage.getItem("silom-language") || "cn");
setDrawer(false);
