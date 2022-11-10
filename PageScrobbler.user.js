// ==UserScript==
// @name         EH – Page Scrobbler
// @namespace    https://github.com/Meldo-Megimi/EH-Page-Scrobbler/raw/main/PageScrobbler.user.js
// @version      2022.11.10.06
// @description  Visualize GID and add the ability to easily jump or scrobble
// @author       FabulousCupcake, OsenTen, Qserty, Meldo-Megimi
// @license      MIT
// @run-at       document-end
// @match        http://e-hentai.org/*
// @match        https://e-hentai.org/*
// @match        http://exhentai.org/*
// @match        https://exhentai.org/*
// @match        http://exhentai55ld2wyap5juskbm67czulomrouspdacjamjeloj7ugjbsad.onion/*
// @grant        GM_addStyle
// ==/UserScript==

const defaultBarWidth = 730;

const stylesheet = `
.search-scrobbler {
  width: ${defaultBarWidth}px;
  outline: 1px cyan dashed;
  margin: 0 auto;
  padding: 20px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.search-scrobbler .bar {
  display: block;
  width: ${defaultBarWidth}px;
  height: 25px;
  border: 2px solid #3c3c3c;
  box-sizing: border-box;
  position: relative;
}
.search-scrobbler .bar .bar-cursor {
  height: 100%;
  background: #5FA9CF;
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
.search-scrobbler .bar-config {
  color: red;
  //pointer-events: none;
  cursor: pointer;
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
.bar-year-labels {
  position:absolute;
  width:inherit;
  opacity:50%;
  pointer-events: none;
}
.bar-year-label {
  position:absolute;
}

.saved-search {
  width: ${defaultBarWidth}px;
  margin: 0 auto;
}

.search-relpager-top {
  width: ${defaultBarWidth}px;
  margin: 0px auto 0px auto;
  text-align: center;
}

.search-scrobbler-config-bg {
  position: fixed;
  z-index: 1;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  display:none;
  backdrop-filter: blur(2px);
}
.search-scrobbler-config-window {
  background-color: #4f535b;
  margin: 15% auto;
  padding: 0px 5px 10px 10px;
  border: 1px solid black;
  width: 20%;
  box-shadow:2px 2px 3px 2px gray;
  border-radius:7px;
}
.search-scrobbler-config-close {
  text-align: right;
  font-size:25px;
  cursor: pointer;
}
`;

const gidYear = {
    74629: 2008,
    190496: 2009,
    321076: 2010,
    449183: 2011,
    553117: 2012,
    660230: 2013,
    771830: 2014,
    888870: 2015,
    1012224: 2016,
    1162942: 2017,
    1338484: 2018,
    1543397: 2019,
    1813647: 2020,
    2100270: 2021
};

const maxPrefetch = 5;

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

const getMaxGID = doc => {
    let maxGID = 0;

    if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
        maxGID = doc.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1];
    } else if (!!doc.querySelector(".itg tr a")) { // Extended
        maxGID = doc.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1];
    } else { // Thumbnail
        maxGID = doc.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1];
    }

    return maxGID;
}

const tryUpdateKnownMaxGID = GID => {
    if (localStorage.getItem("EHPS-maxGID") === null) localStorage.setItem("EHPS-maxGID", -1);
    if (document.querySelector(".searchnav") == null) return;

    const url = new URL(location.href);
    if ((url.pathname !== "/") || (url.search !== "")) {
        if (url.pathname == "/popular") return;

        // not on frontpage or searching
        fetch(location.origin, {
            method: 'get'
        }).then((response) => {
            return response.text()
        }).then((res) => {
            let doc = document.implementation.createHTMLDocument("New Document");
            doc.write(res);
            doc.close();

            let maxGID = getMaxGID(doc);
            let currentMaxGID = localStorage.getItem("EHPS-maxGID");
            if ((currentMaxGID === null) || (currentMaxGID < maxGID)) {
                localStorage.setItem("EHPS-maxGID", maxGID);
            }

            updatePageScrobbler();
        }).catch((error) => {
            console.log(error)
        });
    } else {
        // we are on the frontpage
        let maxGID = getMaxGID(document);
        let currentMaxGID = localStorage.getItem("EHPS-maxGID");
        if ((currentMaxGID === null) || (currentMaxGID < maxGID)) {
            localStorage.setItem("EHPS-maxGID", maxGID);
        }
    }
}

const resetPageCounter = () => {
    let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
    pageInfo.current = 0;
    pageInfo.knownPages = { "min": 0, "max": 0 };
    pageInfo.endLow = null;
    pageInfo.endHigh = null;
    sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
}

const updatePageInfo = async () => {
    let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
    if (pageInfo == null) {
        pageInfo = {};
        pageInfo.current = 0;
        pageInfo.knownPages = { "min": 0, "max": 0 };
        pageInfo.endLow = null;
        pageInfo.endHigh = null;
    } else {
        pageInfo.current = parseInt(pageInfo.current);
        pageInfo.knownPages.min = parseInt(pageInfo.knownPages.min);
        pageInfo.knownPages.max = parseInt(pageInfo.knownPages.max);
    }

    if (document.querySelector(".searchnav #uprev").localName === "span") pageInfo.endLow = pageInfo.current;
    if (document.querySelector(".searchnav #unext").localName === "span") pageInfo.endHigh = pageInfo.current;

    // do we know the current page?
    if (pageInfo.knownPages[`P${pageInfo.current}`] == null) {
        if (window.location.search != "") {
            pageInfo.knownPages[`P${pageInfo.current}`] = `${window.location.search}`;
        } else {
            let maxGID = parseInt(getMaxGID(document), 10) + 1;
            pageInfo.knownPages[`P${pageInfo.current}`] = `?next=${maxGID}`;
        }

        if (pageInfo.knownPages.min > pageInfo.current) pageInfo.knownPages.min = pageInfo.current;
        if (pageInfo.knownPages.max < pageInfo.current) pageInfo.knownPages.max = pageInfo.current;
    }

    // look if next page announced is known
    if ((pageInfo.knownPages[`P${pageInfo.current + 1}`] == null) && (document.querySelector(".searchnav #unext").localName === "a")) {
        pageInfo.knownPages[`P${pageInfo.current + 1}`] = `${(new URL(document.querySelector(".searchnav #unext").href)).search}`;

        if (pageInfo.knownPages.min > pageInfo.current + 1) pageInfo.knownPages.min = pageInfo.current + 1;
        if (pageInfo.knownPages.max < pageInfo.current + 1) pageInfo.knownPages.max = pageInfo.current + 1;
    }

    // look if previous page announced is known
    if ((pageInfo.knownPages[`P${pageInfo.current - 1}`] == null) && (document.querySelector(".searchnav #uprev").localName === "a")) {
        pageInfo.knownPages[`P${pageInfo.current - 1}`] = `${(new URL(document.querySelector(".searchnav #uprev").href)).search}`;

        if (pageInfo.knownPages.min > pageInfo.current - 1) pageInfo.knownPages.min = pageInfo.current - 1;
        if (pageInfo.knownPages.max < pageInfo.current - 1) pageInfo.knownPages.max = pageInfo.current - 1;
    }

    if (localStorage.getItem("EHPS-EnablePageinatorPrefetch") == "true") pageInfo = await prefetchPageInfo(pageInfo);

    sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
    return pageInfo;
}

const fetchDocument = async (url) => {
    try {
        let res = await fetch(url);
        let doc = document.implementation.createHTMLDocument("New Document");
        doc.write(await res.text());
        doc.close();
        return doc;
    } catch (error) {
        console.log(error);
        return document.implementation.createHTMLDocument("New Document");
    }
}

const prefetchPrev = async (pageInfo, count) => {
    for (let i = pageInfo.current; i > pageInfo.current - count; i--) {
        if ((pageInfo.knownPages[`P${i}`] == null) && (i > (pageInfo.endLow ?? Number.MIN_SAFE_INTEGER))) {
            if (pageInfo.knownPages[`P${i + 1}`] != null) {
                let doc = await fetchDocument(`${location.origin}${location.pathname}${pageInfo.knownPages[`P${i + 1}`]}`);
                let jumpElement = doc.querySelector(".searchnav #uprev");
                if (jumpElement != null) {
                    if (jumpElement.localName === "span") pageInfo.endLow = i;
                    if (jumpElement.localName === "a") {
                        pageInfo.knownPages[`P${i}`] = `${(new URL(jumpElement.href)).search}`;

                        if (pageInfo.knownPages.min > i) pageInfo.knownPages.min = i;
                        if (pageInfo.knownPages.max < i) pageInfo.knownPages.max = i;
                    }
                }
            }
        }
    }

    return pageInfo;
}

const prefetchNext = async (pageInfo, count) => {
    for (let i = pageInfo.current; i < pageInfo.current + count; i++) {
        if ((pageInfo.knownPages[`P${i}`] == null) && (i < (pageInfo.endHigh ?? Number.MAX_SAFE_INTEGER))) {
            if (pageInfo.knownPages[`P${i - 1}`] != null) {
                let doc = await fetchDocument(`${location.origin}${location.pathname}${pageInfo.knownPages[`P${i - 1}`]}`);
                let jumpElement = doc.querySelector(".searchnav #unext");
                if (jumpElement != null) {
                    if (jumpElement.localName === "span") pageInfo.endHigh = i;
                    if (jumpElement.localName === "a") {
                        pageInfo.knownPages[`P${i}`] = `${(new URL(jumpElement.href)).search}`;

                        if (pageInfo.knownPages.min > i) pageInfo.knownPages.min = i;
                        if (pageInfo.knownPages.max < i) pageInfo.knownPages.max = i;
                    }
                }
            }
        }
    }

    return pageInfo;
}

const prefetchPageInfo = async (pageInfo) => {
    // prefetch prev pagees
    pageInfo = await prefetchPrev(pageInfo, maxPrefetch + 1);

    let nextCount = maxPrefetch + 1;
    let knownCount = pageInfo.knownPages.max - pageInfo.knownPages.min + 1;
    if (knownCount <= maxPrefetch + 1) nextCount += maxPrefetch + pageInfo.knownPages.min;

    // prefetch next pages to fill pages
    pageInfo = await prefetchNext(pageInfo, nextCount);

    // we do not have enough next pages, try with more prev again
    knownCount = pageInfo.knownPages.max - pageInfo.knownPages.min + 1;
    if (knownCount < (maxPrefetch * 2) + 1) {
        pageInfo = await prefetchPrev(pageInfo, maxPrefetch + (((maxPrefetch * 2) + 1) - knownCount) + 1);
    }

    return pageInfo;
}

const addBaseUIElements = () => {
    if ((new URL(location.href)).pathname == "/popular") return false;

    const addInitialElement = () => {
        const hook = document.querySelector(".searchnav");
        if (hook == null) return false;

        if (!document.querySelector(".search-scrobbler")) {
            hook.insertAdjacentHTML("beforebegin", `<div class="search-scrobbler"></div>`);
        }

        if (!document.querySelector(".saved-search")) {
            hook.insertAdjacentHTML("beforebegin", `
<div class="saved-search">
  <input class="search-save-button" id="search-save-button" type="button" value="Save"></input>
  <label class="search-list">Saved searches:</label>
  <select class="search-list" id="search-select">
  </select>
  <input class="search-load-button" id="search-load-button" type="button" value="Load"></input>
  <input class="search-load-button" id="search-delete-button" type="button" value="Remove"></input>
  <span id="save_load_text"></span>
</div>`);
        }

        if (!document.querySelector(".search-relpager")) {
            let nav = document.querySelectorAll('.searchnav');
            nav[0].insertAdjacentHTML("afterend", `<div class="search-relpager"><span class="search-relpager-num"></span</div>`);
            nav[1].insertAdjacentHTML("beforebegin", `<div class="search-relpager"><span class="search-relpager-num"></span</div>`);
        }

        if (!document.querySelector(".search-scrobbler-config-bg")) {
            hook.insertAdjacentHTML("beforebegin", `<div class="search-scrobbler-config-bg"></div>`);
        }

        return true;
    }

    const addEventListeners = () => {
        // bookmark buttons
        document.getElementById("search-save-button")?.addEventListener("click", function () {
            let searchParams = new URLSearchParams(window.location.search);
            if (searchParams.has('f_search')) {
                let f_search = searchParams.get('f_search');
                if (searchParams.has('next')) {
                    let next = searchParams.get('next');
                    localStorage.setItem(f_search, "&next=" + next);
                    document.getElementById('save_load_text').innerHTML = "Saved (next) GID " + next + " for search " + f_search;

                    updateBookmark();
                } else if (searchParams.has('prev')) {
                    let prev = searchParams.get('prev');
                    localStorage.setItem(f_search, "&prev=" + prev);
                    document.getElementById('save_load_text').innerHTML = "Saved (prev) GID " + prev + " for search " + f_search;

                    updateBookmark();
                } else {
                    let next;
                    if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
                        next = document.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1];
                    } else if (!!document.querySelector(".itg tr a")) { // Extended
                        next = document.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1];
                    } else { // Thumbnail
                        next = document.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1];
                    }
                    localStorage.setItem(f_search, "&next=" + (parseInt(next, 10) + 1));

                    updateBookmark();
                }
            }
        }, false);
        document.getElementById("search-load-button")?.addEventListener("click", function () {
            let searchSelect = decodeURIComponent(document.getElementById('search-select').value);
            if (searchSelect != null) {
                let gid = localStorage.getItem(searchSelect);
                if (gid) {
                    const parser = new URL(window.location);
                    parser.searchParams.delete("next");
                    parser.searchParams.delete("prev");
                    parser.searchParams.delete("f_search");
                    resetPageCounter();
                    window.location = parser.href + "?f_search=" + encodeURIComponent(searchSelect) + gid;
                } else {
                    document.getElementById('save_load_text').innerHTML = "Nothing to load";
                }
            }
        }, false);
        document.getElementById("search-delete-button")?.addEventListener("click", function () {
            let searchSelect = decodeURIComponent(document.getElementById('search-select').value);
            if (searchSelect != null) {
                let gid = localStorage.getItem(searchSelect);
                if (gid) {
                    localStorage.removeItem(searchSelect);
                    updateBookmark();
                }
            }
        }, false);
    }

    if (addInitialElement()) {
        addEventListeners();
        return true;
    } else return false;
}

const updatePageScrobbler = () => {
    if (document.querySelector(".searchnav") == null) return false;

    const updateInitialElement = () => {
        let maxGID = localStorage.getItem("EHPS-maxGID");
        let firstGID = maxGID, lastGID = maxGID;
        if (!!document.querySelector(".itg tr .glname a")) { // Minimal and Compact
            firstGID = parseInt(document.querySelector(".itg tr:nth-child(2) .glname a").href.match(/\/(\d+)\//)?.[1], 10);
            lastGID = parseInt(document.querySelector(".itg tr:last-child .glname a").href.match(/\/(\d+)\//)?.[1], 10);
        } else if (!!document.querySelector(".itg tr a")) { // Extended
            firstGID = parseInt(document.querySelector(".itg tr:first-child a").href.match(/\/(\d+)\//)?.[1], 10);
            lastGID = parseInt(document.querySelector(".itg tr:last-child a").href.match(/\/(\d+)\//)?.[1], 10);
        } else if (!!document.querySelector(".itg .gl1t a")) { // Thumbnail
            firstGID = parseInt(document.querySelector(".itg .gl1t:first-child a").href.match(/\/(\d+)\//)?.[1], 10);
            lastGID = parseInt(document.querySelector(".itg .gl1t:last-child a").href.match(/\/(\d+)\//)?.[1], 10);
        }

        if (maxGID < firstGID) {
            maxGID = firstGID;
            localStorage.setItem("EHPS-maxGID", maxGID);
        }

        const cursorLeftMargin = (1.0 - firstGID / maxGID) * 100;
        let cursorWidth = ((firstGID - lastGID) / maxGID) * 100;
        if (cursorWidth < 0.2) cursorWidth = 0.2;

        let yearDiv = ``;
        for (let key in gidYear) {
            yearDiv += `<div class="bar-year-label" style="left: ${(1.0 - key / maxGID) * 100}% ">|${gidYear[key]}</div>`;
        }

        document.querySelector(".search-scrobbler").innerHTML = `
  <div class="bar-wrapper bar-full">
    <div class="bar">
      <div class="bar-cursor" style="width: ${cursorWidth}%; margin-left: ${cursorLeftMargin}% ">
        <div class="bar-hovertext">${firstGID}</div>
      </div>
    </div>
    <div class="bar-labels">
      <div class="bar-max">${maxGID}</div>
      <div class="bar-config" title="EH-Page-Scrobbler settings">&#x2699;</div><div class="bar-min">1</div>
    </div>
  </div>
  <div class="bar-year-labels">
${yearDiv}
  </div>`;

        if (localStorage.getItem("EHPS-FullWidthBar") == "true") {
            document.querySelector(".search-scrobbler").style.width = "100%";
            document.querySelector(".search-scrobbler .bar").style.width = "100%";
        } else {
            document.querySelector(".search-scrobbler").style.width = null;
            document.querySelector(".search-scrobbler .bar").style.width = null;
        }
    }

    const addEventListeners = () => {
        const addHoverElement = offset => {
            if (offset < 2) return;
            document.querySelector(".bar-hover")?.remove();

            const maxGID = localStorage.getItem("EHPS-maxGID");
            const width = document.querySelector(".search-scrobbler .bar").clientWidth;
            const hoverGID = ((1.0 - offset / width) * maxGID).toFixed(0);

            const url = new URL(location.href);
            url.searchParams.set("next", hoverGID);

            document.querySelector(".bar-full .bar").insertAdjacentHTML("afterbegin", `
<a class="bar-hover" href="${url}" style="left: ${offset - 2}px; width: 2px">
  <div class="bar-hovertext">${hoverGID}</div>
</a>`);
        }

        const handler = e => {
            addHoverElement(e.layerX);

            document.querySelector(".bar-hover").addEventListener("click", function (ev) {
                resetPageCounter();
            }, false);
        }

        const el = document.querySelector(".bar-full .bar");
        if (el !== null) el.addEventListener("mousemove", handler);

        // config open button
        document.querySelector(".search-scrobbler .bar-config")?.addEventListener("click", function () {
            document.querySelector(".search-scrobbler-config-bg").style.display = "block";
        }, false);
    }

    updateInitialElement();
    addEventListeners();
}

const updateBookmark = () => {
    const url = new URL(location.href);

    let searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('f_search') && (localStorage.getItem("EHPS-DisableBookmark") != "true")) {
        let gid = localStorage.getItem(searchParams.get('f_search'));
        if (!gid) document.getElementById('save_load_text').innerHTML = "No bookmark found for this search.";

        document.querySelectorAll('.search-save-button').forEach(function (key) { key.style.display = ''; });
    } else {
        document.querySelectorAll('.search-save-button').forEach(function (key) { key.style.display = 'none'; });
    }

    if ((localStorage.length > 1) && (localStorage.getItem("EHPS-DisableBookmark") != "true")) {
        let f_search = searchParams.get('f_search');
        let searchSelect = document.getElementById('search-select');
        searchSelect.options.length = 0
        Object.keys(localStorage).forEach(function (key) {
            let value = localStorage.getItem(key);
            if (value.startsWith("&next") || value.startsWith("&prev")) {
                let opt = document.createElement('option');
                opt.text = key;
                opt.value = encodeURIComponent(key);
                if (key == f_search) opt.selected = true;

                searchSelect.add(opt);
            }
        });

        if (searchSelect.options.length !== 0) {
            document.querySelectorAll('.search-list').forEach(function (key) { key.style.display = ''; });
            document.querySelectorAll('.search-load-button').forEach(function (key) { key.style.display = ''; });
        } else {
            document.querySelectorAll('.search-list').forEach(function (key) { key.style.display = 'none'; });
            document.querySelectorAll('.search-load-button').forEach(function (key) { key.style.display = 'none'; });
        }
    } else {
        document.querySelectorAll('.search-list').forEach(function (key) { key.style.display = 'none'; });
        document.querySelectorAll('.search-load-button').forEach(function (key) { key.style.display = 'none'; });
    }

    if (localStorage.getItem("EHPS-DisableBookmark") == "true") document.getElementById('save_load_text').style.display = 'none'
    else document.getElementById('save_load_text').style.display = ''
}

const updatePageCounter = async () => {
    if (document.querySelector(".search-relpager-num") === null) return;
    if (localStorage.getItem("EHPS-DisablePageinator") == "true") {
        document.querySelectorAll('.search-relpager-num').forEach(function (nav) {
            nav.innerHTML = null;
        });
        return;
    }

    let pageInfo = await updatePageInfo();

    // calc the pages not to show to limit visible pages
    let knownCount = pageInfo.knownPages.max - pageInfo.knownPages.min;
    let hideStart = pageInfo.knownPages.max + 1, hideStop = pageInfo.knownPages.min - 1;

    if (knownCount > 10) {
        if ((pageInfo.current - pageInfo.knownPages.min) > (pageInfo.knownPages.max - pageInfo.current)) {
            hideStart = pageInfo.knownPages.min + 1;
            hideStop = hideStart + (knownCount - 10);
        } else {
            hideStop = pageInfo.knownPages.max - 1;
            hideStart = hideStop - (knownCount - 10);
        }
    }

    // build paginator html code
    let pages = "";
    if (pageInfo.endLow == null) pages += "<td>?</td>";

    for (let i = pageInfo.knownPages.min; i <= pageInfo.knownPages.max; i++) {
        if ((i >= hideStart) && (i <= hideStop)) {
            if (i == hideStart) pages += `<td><a>...</a></td>`;
        } else {
            if (i == pageInfo.current) pages += `<td class="ptds" onclick="document.location=this.firstChild.href"><a>${i}</a></td>`;
            else pages += `<td onclick="document.location=this.firstChild.href"><a href=${pageInfo.knownPages[`P${i}`]}>${i}</a></td>`;
        }
    }

    if (pageInfo.endHigh == null) pages += "<td>?</td>";

    let relpagerdivs = document.querySelectorAll('.search-relpager-num');
    relpagerdivs[0].innerHTML = `
  <table class="ptt" style="margin:2px auto 0px">
    <tbody>
      <tr>${pages}</tr>
    </tbody>
  </table>`;

    relpagerdivs[1].innerHTML = `
  <table class="ptb" style="margin:1px auto 10px">
    <tbody>
      <tr>${pages}</tr>
    </tbody>
  </table>`;

    // add tab click event handler ...
    // ... for page buttons
    document.querySelectorAll('.search-relpager-num td').forEach(function (nav) {
        nav.addEventListener("click", function (ev) {
            if (ev.target.innerText == "...") {
                let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
                let page = prompt(`Jump to page: (between ${pageInfo.knownPages.min} and ${pageInfo.knownPages.max})`, 0);
                if (page != null) {
                    page = parseInt(page);

                    if ((page >= parseInt(pageInfo.knownPages.min)) && (page <= parseInt(pageInfo.knownPages.max))) {
                        pageInfo.current = page;
                        sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
                        document.location = pageInfo.knownPages[`P${page}`];
                    }
                }
            } else if (ev.target.innerText != "?") {
                let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
                pageInfo.current = ev.target.innerText;
                sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
            }
        }, false);
    });

    // add generic click event handler ...
    // ... for jump buttons
    document.querySelector(".searchnav #uprev").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) resetPageCounter();
        else {
            let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
            pageInfo.current = parseInt(pageInfo.current) - 1;
            sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
        }
    }, false);

    document.querySelector(".searchnav #dprev").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) resetPageCounter();
        else {
            let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
            pageInfo.current = parseInt(pageInfo.current) - 1;
            sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
        }
    }, false);

    document.querySelector(".searchnav #unext").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) resetPageCounter();
        else {
            let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
            pageInfo.current = parseInt(pageInfo.current) + 1;
            sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
        }
    }, false);

    document.querySelector(".searchnav #dnext").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        if ((new URLSearchParams(ev.target.href)).has("jump")) resetPageCounter();
        else {
            let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
            pageInfo.current = parseInt(pageInfo.current) + 1;
            sessionStorage.setItem("EHPS-Paginator", JSON.stringify(pageInfo));
        }
    }, false);

    document.querySelector(".searchnav #ufirst").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    document.querySelector(".searchnav #dfirst").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    document.querySelector(".searchnav #ulast").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    document.querySelector(".searchnav #dlast").addEventListener("click", function (ev) {
        if (ev.target.localName === "span") return
        resetPageCounter();
    }, false);

    // ... for search button
    let searchButton = document.querySelector("#searchbox form div input:nth-child(2)");
    if (searchButton !== null) {
        searchButton.addEventListener("click", function (ev) {
            resetPageCounter();
        }, false);
    }

    // ... for site nav
    document.querySelectorAll('#nb a').forEach(function (nav) {
        nav.addEventListener("click", function (ev) {
            resetPageCounter();
        }, false);
    });

    document.querySelectorAll('.dp a').forEach(function (nav) {
        nav.addEventListener("click", function (ev) {
            resetPageCounter();
        }, false);
    });
}

const updateConfig = () => {
    if (document.querySelector(".search-scrobbler-config-bg") === null) return;

    document.querySelector('.search-scrobbler-config-bg').innerHTML = `
  <div class="search-scrobbler-config-window">
    <div class="search-scrobbler-config-close">&times;</div>
    <div>
      <input type="checkbox" id="search-scrobbler-config-disBookmark"><label for="search-scrobbler-config-disBookmark"> Disable bookmarks</label><br>
      <input type="checkbox" id="search-scrobbler-config-disPageinator"><label for="search-scrobbler-config-disPageinator"> Disable pages</label><br>
      <input type="checkbox" id="search-scrobbler-config-fullWidthBar"><label for="search-scrobbler-config-fullWidthBar"> Use full width for bar</label><br>
      <input type="checkbox" id="search-scrobbler-config-enlPageprefetch"><label for="search-scrobbler-config-enlPageprefetch"> Enable page prefetch (+/- ${maxPrefetch} pages)</label><br>
      <div style="padding: 2px 30px;color:red;font-weight:bold;">Be careful with prefetch as it creates a lot of page requests and the server will block you for some time if you reaches a certain limit in a timeframe</div>
    </div>
  </div>`;

    // config close button
    document.querySelector(".search-scrobbler-config-close").addEventListener("click", function () {
        document.querySelector(".search-scrobbler-config-bg").style.display = "none";
    }, false);

    document.querySelector(".search-scrobbler-config-bg").addEventListener("click", function () {
        document.querySelector(".search-scrobbler-config-bg").style.display = "none";
    }, false);

    document.querySelector(".search-scrobbler-config-window").addEventListener("click", function (e) {
        e.stopPropagation();
    }, false);

    // config buttons
    document.getElementById("search-scrobbler-config-disBookmark").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-DisableBookmark", e.target.checked);
        updateBookmark();
    }, false);

    document.getElementById("search-scrobbler-config-disPageinator").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-DisablePageinator", e.target.checked);
        updatePageCounter();
    }, false);

    document.getElementById("search-scrobbler-config-fullWidthBar").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-FullWidthBar", e.target.checked);
        updatePageScrobbler();
    }, false);

    document.getElementById("search-scrobbler-config-enlPageprefetch").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-EnablePageinatorPrefetch", e.target.checked);
        updatePageCounter();
    }, false);

    if (localStorage.getItem("EHPS-DisableBookmark") == "true") document.getElementById("search-scrobbler-config-disBookmark").checked = true;
    if (localStorage.getItem("EHPS-DisablePageinator") == "true") document.getElementById("search-scrobbler-config-disPageinator").checked = true;
    if (localStorage.getItem("EHPS-FullWidthBar") == "true") document.getElementById("search-scrobbler-config-fullWidthBar").checked = true;
    if (localStorage.getItem("EHPS-EnablePageinatorPrefetch") == "true") document.getElementById("search-scrobbler-config-enlPageprefetch").checked = true;
}

const main = () => {
    if (!hasGalleryListTable()) return;
    tryUpdateKnownMaxGID();
    injectStylesheet();
    if (addBaseUIElements()) {
        updatePageScrobbler();
        updateConfig();
        updateBookmark();
        updatePageCounter();
    }
}

main();
