// ==UserScript==
// @name         EH – Page Scrobbler
// @namespace    https://github.com/Meldo-Megimi/EH-Page-Scrobbler/raw/main/PageScrobbler.user.js
// @version      2022.11.04.3
// @description  Visualize GID and add the ability to easily jump or scrobble
// @author       FabulousCupcake, OsenTen, Qserty, Meldo-Megimi
// @license      MIT
// @run-at       document-end
// @match        http*://e-hentai.org/*
// @match        http*://exhentai.org/*
// @grant        GM_addStyle
// ==/UserScript==

const stylesheet = `
.search-scrobbler {
  width: 730px;
  outline: 1px cyan dashed;
  margin: 0 auto;
  padding: 20px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.search-scrobbler .bar {
  display: block;
  width: 730px;
  height: 25px;
  border: 1px solid red;
  box-sizing: border-box;
  position: relative;
}
.search-scrobbler .bar .bar-cursor {
  height: 100%;
  background: #0f0;
}
.search-scrobbler .bar-wrapper {
  display: flex;
  flex-direction: column;
}
.search-scrobbler .bar-labels {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.search-scrobbler .bar-hover {
  display: block;
  width: 1px;
  height: 100%;
  background: #f0f;
  position: absolute;
}
.search-scrobbler .bar-hovertext {
  position: absolute;
  outline: 1px solid #f0f;
  top: -1.5em;
}
.search-scrobbler,
.search-scrobbler * {
  outline: 0px none !important;
}

.saved-search {
  width: 730px;
  margin: 0 auto;
}
`;

const injectStylesheet = () => {
    if (typeof GM_addStyle != "undefined") {
        GM_addStyle(stylesheet);
    } else if (typeof addStyle != "undefined") {
        addStyle(stylesheet);
    } else {
        const stylesheetEl = document.createElement("style");
        stylesheetEl.innerHTML = stylesheet;
        document.body.appendChild(stylesheetEl);
    }
}

const hasGalleryListTable = () => {
    return !!document.querySelector(".itg.gltm, .itg.gltc, .itg.glte, .itg.gld");
}

const tryUpdateKnownMaxGID = GID => {
    if (localStorage.getItem("EHPS-maxGID") === null) {localStorage.setItem("EHPS-maxGID", -1)}
    const url = new URL(location.href);
    if (url.pathname !== "/") return;
    if (url.search !== "") return;

    let maxGID = 0;

    if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
        maxGID = document.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1];
    } else if (!!document.querySelector(".itg tr a")) { // Extended
        maxGID = document.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1];
    } else { // Thumbnail
        maxGID = document.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1];
    }

    localStorage.setItem("EHPS-maxGID", maxGID);
}

const addPageScrobbler = () => {
    const url = new URL(location.href);
    if (url.pathname == "/popular") return;

    const insertInitialElement = () => {
        const hook = document.querySelector(".searchnav");

        const maxGID = localStorage.getItem("EHPS-maxGID");
        let firstGID = maxGID, lastGID = 1;
        if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
            firstGID = document.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1];
            lastGID = document.querySelector(".itg tr:last-child .glname a").href.match(/\/(\d+)\//)?.[1];
        } else if (!!document.querySelector(".itg tr a")) { // Extended
            firstGID = document.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1];
            lastGID = document.querySelector(".itg tr:last-child a").href.match(/\/(\d+)\//)?.[1];
        } else { // Thumbnail
            firstGID = document.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1];
            lastGID = document.querySelector(".itg .gl1t:last-child a").href.match(/\/(\d+)\//)?.[1];
        }
        const cursorLeftMargin = (1.0 - firstGID / maxGID) * 100;
        let cursorWidth = ((firstGID - lastGID) / maxGID) * 100;
        if (cursorWidth < 0.2) cursorWidth = 0.2;

        const el1 = `
<div class="search-scrobbler">
  <div class="bar-wrapper bar-full">
    <div class="bar">
      <div class="bar-cursor" style="width: ${cursorWidth}%; margin-left: ${cursorLeftMargin}% ">
        <div class="bar-hovertext">${firstGID}</div>
      </div>
    </div>
    <div class="bar-labels">
      <div class="bar-max">${maxGID}</div>
      <div class="bar-min">1</div>
    </div>
  </div>
</div>`;
        hook.insertAdjacentHTML("beforebegin", el1);

        const el2 = `
<div class="saved-search">
  <input class="search-save-button" type="button" value="Save" onclick="saveCurrentGID()"></input>
  <label class="search-list">Saved searches:</label>
  <select class="search-list" id="search-select">
  </select>
  <input class="search-load-button" type="button" value="Load" onclick="loadSavedGID()"></input>
  <input class="search-load-button" type="button" value="Remove" onclick="deleteSavedGID()"></input>
  <span id="current_bookmark"></span>&nbsp&nbsp&nbsp<span id="save_load_text"></span>
</div>`;
        hook.insertAdjacentHTML("beforebegin", el2);
    }

    const addEventListeners = () => {
        const addHoverElement = offset => {
            if (offset < 2) return;
            document.querySelector(".bar-hover")?.remove();

            const maxGID = localStorage.getItem("EHPS-maxGID");
            const width = 730;
            const hoverGID = ((1.0 - offset / 730) * maxGID).toFixed(0);

            const url = new URL(location.href);
            url.searchParams.set("next", hoverGID);

            const hook = document.querySelector(".bar-full .bar");
            const el = `
<a class="bar-hover" href="${url}" style="left: ${offset - 2}px; width: 2px">
  <div class="bar-hovertext">${hoverGID}</div>
</a>`;
            hook.insertAdjacentHTML("afterbegin", el);
        }

        const handler = e => {
            addHoverElement(e.layerX);
        }

        const el = document.querySelector(".bar-full .bar");
        el.addEventListener("mousemove", handler);
    }

    insertInitialElement();
    addEventListeners();
}

const showBookmark = GID => {
    let searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('f_search')) {
        let gid = localStorage.getItem(searchParams.get('f_search'));
        if (gid) {
            document.getElementById('current_bookmark').innerHTML = "Bookmark: " + gid;
        } else {
            document.getElementById('current_bookmark').innerHTML = "No bookmark found for this search.";
        }
        document.querySelectorAll('.search-save-button').forEach(function(key){key.style.display='';});
    } else {
        document.querySelectorAll('.search-save-button').forEach(function(key){key.style.display='none';});
    }

    if (localStorage.length > 1)
    {
        let f_search = searchParams.get('f_search');
        let searchSelect = document.getElementById('search-select');
        searchSelect.options.length=0
        Object.keys(localStorage).forEach(function(key){
            console.log(localStorage.getItem(key));
            if (key != "EHPS-maxGID") {
                let opt = document.createElement('option');
                opt.text = key;
                if (key == f_search) {
                    opt.selected = true;
                }

                searchSelect.add(opt);
            }
        });

        document.querySelectorAll('.search-list').forEach(function(key){key.style.display='';});
        document.querySelectorAll('.search-load-button').forEach(function(key){key.style.display='';});
    } else {
        document.querySelectorAll('.search-list').forEach(function(key){key.style.display='none';});
        document.querySelectorAll('.search-load-button').forEach(function(key){key.style.display='none';});
    }
}

const main = () => {
    if (!hasGalleryListTable()) return;
    tryUpdateKnownMaxGID();
    injectStylesheet();
    addPageScrobbler();
    showBookmark();
}

unsafeWindow.saveCurrentGID = function () {
    let searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('f_search')) {
        let f_search = searchParams.get('f_search');
        if (searchParams.has('next')) {
            let next = searchParams.get('next');
            localStorage.setItem(f_search, "&next=" + next);
            document.getElementById('save_load_text').innerHTML = "Saved (next) GID " + next + " for search " + f_search;
            document.getElementById('current_bookmark').innerHTML = "Bookmark: " + next + "  ";

            showBookmark();
        } else if (searchParams.has('prev')) {
            let prev = searchParams.get('prev');
            localStorage.setItem(f_search, "&prev=" + prev);
            document.getElementById('save_load_text').innerHTML = "Saved (prev) GID " + prev + " for search " + f_search;
            document.getElementById('current_bookmark').innerHTML = "Bookmark: " + prev + "  ";

            showBookmark();
        } else {
            let next;
            if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
                next = document.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1];
            } else if (!!document.querySelector(".itg tr a")) { // Extended
                next = document.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1];
            } else { // Thumbnail
                next = document.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1];
            }
            localStorage.setItem(f_search, "&next=" + (parseInt(next,10)+1));

            showBookmark();
        }
    }
}

unsafeWindow.loadSavedGID = function () {
    let searchParams = new URLSearchParams(window.location.search);
    let searchSelect = document.getElementById('search-select').value;
    if (searchSelect != null) {
        let gid = localStorage.getItem(searchSelect);
        if (gid) {
            const parser = new URL(window.location);
            parser.searchParams.delete("next");
            parser.searchParams.delete("prev");
            parser.searchParams.delete("f_search");
            window.location = parser.href + "?f_search=" + encodeURIComponent(searchSelect) + gid;
        } else {
            document.getElementById('save_load_text').innerHTML = "Nothing to load";
        }
    }
}

unsafeWindow.deleteSavedGID = function () {
    let searchSelect = document.getElementById('search-select').value;
    if (searchSelect != null) {
        let gid = localStorage.getItem(searchSelect);
        if (gid) {
            localStorage.removeItem(searchSelect);
            showBookmark();
        }
    }
}

main();
