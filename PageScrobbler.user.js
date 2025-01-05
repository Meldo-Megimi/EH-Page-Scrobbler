// ==UserScript==
// @name         EH – Page Scrobbler
// @namespace    https://github.com/Meldo-Megimi/EH-Page-Scrobbler/raw/main/PageScrobbler.user.js
// @version      2024.01.01.01
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

.search-scrobbler-altcfg {
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
  .search-scrobbler-altcfg .bar-config {
    color: red;
    cursor: pointer;
  }

.saved-search {
  width: ${defaultBarWidth}px;
  margin: 0 auto;
  font-size: 10pt;
}

.search-relpager-top {
  width: ${defaultBarWidth}px;
  margin: 0px auto 0px auto;
  text-align: center;
}

.pg-jump {
  width: fit-content !important;
  padding: 0px 5px;
}

.search-scrobbler-config-bg {
  position: fixed;
  z-index: 100;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  display:none;
  backdrop-filter: blur(2px);
}
.search-scrobbler-config-window {
  margin: 15% auto !important;
  padding: 0px 5px 10px 10px !important;
  min-width: 300px !important;
  width: min-content;
  box-shadow:2px 2px 3px 2px gray;
  border-radius:7px;
}
.search-scrobbler-config-close {
  text-align: right;
  font-size:25px;
  cursor: pointer;
  white-space: nowrap;
  display: block ruby;
}
.search-scrobbler-config-title {
  font-size:16px;
  font-weight: bold;
  white-space: nowrap;
  margin: 4px 10px 0px 0px;
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
    2100270: 2021,
    2419586: 2022,
    2783947: 2023,
    3178469: 2024
};

const defaultMaxPrefetch = 5;

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

const resetPageCounter = (pageInfo) => {
    if (pageInfo == null) pageInfo = {};
    pageInfo.path = null;
    pageInfo.last = null;
    pageInfo.knownPages = { "min": 0, "max": 0 };
    pageInfo.endLow = null;
    pageInfo.endHigh = null;
    return pageInfo;
}

const updatePageInfo = async () => {
    let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
    if (pageInfo == null) {
        pageInfo = resetPageCounter(pageInfo);
    } else {
        pageInfo.knownPages.min = parseInt(pageInfo.knownPages.min);
        pageInfo.knownPages.max = parseInt(pageInfo.knownPages.max);
    }

    // get current page nr.
    const parser = new URL(window.location);
    for (let i = pageInfo.knownPages.min; i <= pageInfo.knownPages.max; i++) {
        if (decodeURIComponent(pageInfo.knownPages[`P${i}`]) == decodeURIComponent(`${parser.search}`)) {
            window.currentPage = i;
            break;
        }
    }

    // current page is unknown, reset paginator
    if (isNaN(window.currentPage)) {
        pageInfo = resetPageCounter(pageInfo);
        window.currentPage = 0;
    }

    // check path
    if (pageInfo.path == null) pageInfo.path = location.pathname;
    else if (pageInfo.path != location.pathname) {
        pageInfo = resetPageCounter(pageInfo);
        pageInfo.path = location.pathname;
    }

    if (document.querySelector("#uprev").localName === "span") pageInfo.endLow = window.currentPage;
    if (document.querySelector("#unext").localName === "span") pageInfo.endHigh = window.currentPage;

    // do we know the current page?
    if (pageInfo.knownPages[`P${window.currentPage}`] == null) {
        if (window.location.search != "") {
            pageInfo.knownPages[`P${window.currentPage}`] = `${parser.search}`;
        } else {
            let maxGID = parseInt(getMaxGID(document), 10) + 1;
            pageInfo.knownPages[`P${window.currentPage}`] = `?next=${maxGID}`;

            // fix reload page
            window.history.pushState('forward', null, pageInfo.knownPages[`P${window.currentPage}`]);
        }

        if (pageInfo.knownPages.min > window.currentPage) pageInfo.knownPages.min = window.currentPage;
        if (pageInfo.knownPages.max < window.currentPage) pageInfo.knownPages.max = window.currentPage;
    }

    pageInfo.last = location.href;

    // look if next page announced is known
    if ((pageInfo.knownPages[`P${window.currentPage + 1}`] == null) && (document.querySelector("#unext").localName === "a")) {
        pageInfo.knownPages[`P${window.currentPage + 1}`] = `${(new URL(document.querySelector("#unext").href)).search}`;

        if (pageInfo.knownPages.min > window.currentPage + 1) pageInfo.knownPages.min = window.currentPage + 1;
        if (pageInfo.knownPages.max < window.currentPage + 1) pageInfo.knownPages.max = window.currentPage + 1;
    } else {
        // look if new or deleted entries have shifted the pages
        if ((pageInfo.knownPages[`P${window.currentPage + 1}`] != null) && (document.querySelector("#unext").href != null))
            if (pageInfo.knownPages[`P${window.currentPage + 1}`] != `${(new URL(document.querySelector("#unext").href)).search}`) {
                pageInfo.knownPages[`P${window.currentPage + 1}`] = `${(new URL(document.querySelector("#unext").href)).search}`;
            }
    }

    // look if previous page announced is known
    if ((pageInfo.knownPages[`P${window.currentPage - 1}`] == null) && (document.querySelector("#uprev").localName === "a")) {
        pageInfo.knownPages[`P${window.currentPage - 1}`] = `${(new URL(document.querySelector("#uprev").href)).search}`;

        if (pageInfo.knownPages.min > window.currentPage - 1) pageInfo.knownPages.min = window.currentPage - 1;
        if (pageInfo.knownPages.max < window.currentPage - 1) pageInfo.knownPages.max = window.currentPage - 1;
    } else {
        // look if new or deleted entries have shifted the pages
        if ((pageInfo.knownPages[`P${window.currentPage - 1}`] != null) && (document.querySelector("#uprev").href != null))
            if (pageInfo.knownPages[`P${window.currentPage - 1}`] != `${(new URL(document.querySelector("#uprev").href)).search}`) {
                pageInfo.knownPages[`P${window.currentPage - 1}`] = `${(new URL(document.querySelector("#uprev").href)).search}`;
            }
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
    for (let i = window.currentPage; i > window.currentPage - count; i--) {
        if ((pageInfo.knownPages[`P${i}`] == null) && (i > (pageInfo.endLow ?? Number.MIN_SAFE_INTEGER))) {
            if (pageInfo.knownPages[`P${i + 1}`] != null) {
                let doc = await fetchDocument(`${location.origin}${location.pathname}${pageInfo.knownPages[`P${i + 1}`]}`);
                let jumpElement = doc.querySelector("#uprev");
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
    for (let i = window.currentPage; i < window.currentPage + count; i++) {
        if ((pageInfo.knownPages[`P${i}`] == null) && (i < (pageInfo.endHigh ?? Number.MAX_SAFE_INTEGER))) {
            if (pageInfo.knownPages[`P${i - 1}`] != null) {
                let doc = await fetchDocument(`${location.origin}${location.pathname}${pageInfo.knownPages[`P${i - 1}`]}`);
                let jumpElement = doc.querySelector("#unext");
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
    let maxPrefetch = parseInt(localStorage.getItem("EHPS-EnablePageinatorPrefetchSize") ?? defaultMaxPrefetch);
    if (isNaN(maxPrefetch)) maxPrefetch = defaultMaxPrefetch;
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
        const nav = document.querySelectorAll('.searchnav');
        if (nav.length < 2) return false;

        if (!document.querySelector(".search-scrobbler")) {
            nav[0].insertAdjacentHTML("beforebegin", `<div class="search-scrobbler"></div><div class="search-scrobbler-altcfg"></div>`);
            nav[1].insertAdjacentHTML("afterend", `<div class="search-scrobbler"></div>`);
        }

        if (!document.querySelector(".saved-search")) {
            nav[0].insertAdjacentHTML("beforebegin", `
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
            nav[0].insertAdjacentHTML("afterend", `<div class="search-relpager"><span class="search-relpager-num"></span</div>`);
            nav[1].insertAdjacentHTML("beforebegin", `<div class="search-relpager"><span class="search-relpager-num"></span</div>`);
        }

        if (!document.querySelector(".search-scrobbler-config-bg")) {
            nav[0].insertAdjacentHTML("beforebegin", `<div class="search-scrobbler-config-bg"></div>`);
        }

        return true;
    }

    const addEventListeners = () => {
        // bookmark buttons
        document.getElementById("search-save-button")?.addEventListener("click", function () {
            let searchParams = new URLSearchParams(window.location.search);
            if (searchParams.has('f_search')) {
                let f_search = searchParams.get('f_search');
                if (searchParams.has('next') && !searchParams.has('jump') && !searchParams.has('seek')) {
                    let next = searchParams.get('next');
                    localStorage.setItem(f_search, "&next=" + next);
                    document.getElementById('save_load_text').innerHTML = "Saved (next) GID " + next + " for search " + f_search;
                } else if (searchParams.has('prev') && !searchParams.has('jump') && !searchParams.has('seek')) {
                    let prev = searchParams.get('prev');
                    localStorage.setItem(f_search, "&prev=" + prev);
                    document.getElementById('save_load_text').innerHTML = "Saved (prev) GID " + prev + " for search " + f_search;
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
                    document.getElementById('save_load_text').innerHTML = "Saved (next) GID " + next + " for search " + f_search;
                }

                updateBookmark();
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
                    parser.searchParams.delete("jump");
                    parser.searchParams.delete("seek");
                    parser.searchParams.delete("range");
                    parser.searchParams.delete("f_search");
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

        document.querySelectorAll(".search-scrobbler").forEach((s) => {
            s.addEventListener("mouseleave", function () {
                document.querySelector(".bar-hover")?.remove();
            }, false);
        });
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

        const scrobbler = document.querySelectorAll('.search-scrobbler');
        scrobbler[0].innerHTML = `
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

        scrobbler[1].innerHTML = `
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
  <div class="bar-year-labels">
${yearDiv}
  </div>`;

        document.querySelector('.search-scrobbler-altcfg').innerHTML = `<div class="bar-max"></div><div class="bar-config" title="EH-Page-Scrobbler settings">&#x2699;</div><div class="bar-min"></div>`;

        if (localStorage.getItem("EHPS-FullWidthBar") == "true") {
            scrobbler[0].style.width = "100%";
            scrobbler[0].querySelector(".bar").style.width = "100%";

            scrobbler[1].style.width = "100%";
            scrobbler[1].querySelector(".bar").style.width = "100%";
        } else {
            scrobbler[0].style.width = null;
            scrobbler[0].querySelector(".bar").style.width = null;

            scrobbler[1].style.width = null;
            scrobbler[1].querySelector(".bar").style.width = null;
        }

        if (localStorage.getItem("EHPS-HidePageScrobbler") == "true") {
            let hidePageScrobblerType = localStorage.getItem("EHPS-HidePageScrobblerType") ?? 0;
            document.querySelector('.search-scrobbler-altcfg').style.display = "none";

            if ((hidePageScrobblerType == 0) || (hidePageScrobblerType == 2)) {
                scrobbler[0].style.display = "none";
                document.querySelector('.search-scrobbler-altcfg').style.display = "flex";
            } else scrobbler[0].style.display = "";

            if ((hidePageScrobblerType == 1) || (hidePageScrobblerType == 2)) scrobbler[1].style.display = "none";
            else scrobbler[1].style.display = "";
        } else {
            document.querySelector('.search-scrobbler-altcfg').style.display = "none";
            scrobbler[0].style.display = "";
            scrobbler[1].style.display = "";
        }
    }

    const addEventListeners = () => {
        const addHoverElement = (e, n) => {
            const offset = e.layerX;
            if (offset < 2) return;
            document.querySelector(".bar-hover")?.remove();

            const maxGID = localStorage.getItem("EHPS-maxGID");
            const width = e.target.clientWidth;
            if (width == 0) return;
            const hoverGID = ((1.0 - offset / width) * maxGID).toFixed(0);

            const url = new URL(location.href);
            url.searchParams.set("next", hoverGID);

            document.querySelectorAll(".bar-full .bar")[n].insertAdjacentHTML("afterbegin", `
<a class="bar-hover" href="${url}" style="left: ${offset - 2}px; width: 2px">
  <div class="bar-hovertext">${hoverGID}</div>
</a>`);
        }

        const handler0 = e => {
            addHoverElement(e, 0);
        }

        const handler1 = e => {
            addHoverElement(e, 1);
        }

        const el = document.querySelectorAll(".bar-full .bar");
        if (el !== null) {
            el[0].addEventListener("mousemove", handler0);
            el[1].addEventListener("mousemove", handler1);
        }

        // config open button
        document.querySelector(".search-scrobbler .bar-config")?.addEventListener("click", function () {
            document.querySelector(".search-scrobbler-config-bg").style.display = "block";
        }, false);

        document.querySelector(".search-scrobbler-altcfg .bar-config")?.addEventListener("click", function () {
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
        else document.querySelector('.search-save-button').value = 'Update';

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
        if ((window.currentPage - pageInfo.knownPages.min) > (pageInfo.knownPages.max - window.currentPage)) {
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
            if (i == window.currentPage) pages += `<td class="ptds"><a>${i}</a></td>`;
            else pages += `<td><a href=${pageInfo.knownPages[`P${i}`]}>${i}</a></td>`;
        }
    }

    if (pageInfo.endHigh == null) pages += "<td>?</td>";
    if (localStorage.getItem("EHPS-DisableIntegrationJump2Page") != "true") {
        pages = '<td id="pg-prev" class="pg-jump"></td>' + pages;
        pages = '<td id="pg-first" class="pg-jump"></td>' + pages;

        pages += '<td id="pg-next" class="pg-jump"></td>';
        pages += '<td id="pg-last" class="pg-jump"></td>';
        pages += '<td id="pg-jump" class="pg-jump"></td>';
    }

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

    if (localStorage.getItem("EHPS-DisableIntegrationJump2Page") != "true") {
        // move top jump buttons
        document.querySelector(".ptt #pg-first").appendChild(document.querySelector("#ufirst"));
        document.querySelector(".ptt #pg-prev").appendChild(document.querySelector("#uprev"));
        document.querySelector(".ptt #pg-next").appendChild(document.querySelector("#unext"));
        document.querySelector(".ptt #pg-last").appendChild(document.querySelector("#ulast"));
        document.querySelector(".ptt #pg-jump").appendChild(document.querySelector("#ujumpbox"));

        // move bottom jump buttons
        document.querySelector(".ptb #pg-first").appendChild(document.querySelector("#dfirst"));
        document.querySelector(".ptb #pg-prev").appendChild(document.querySelector("#dprev"));
        document.querySelector(".ptb #pg-next").appendChild(document.querySelector("#dnext"));
        document.querySelector(".ptb #pg-last").appendChild(document.querySelector("#dlast"));
        document.querySelector(".ptb #pg-jump").appendChild(document.querySelector("#djumpbox"));

        // merge bookmarks and viewstyle
        document.querySelector(".searchnav").appendChild(document.querySelector(".saved-search"));
        document.querySelector(".searchnav").appendChild(document.querySelector(".searchnav div:nth-child(6)"));
        document.querySelector(".searchnav div:nth-child(1)").remove();
        document.querySelector(".searchnav div:nth-child(1)").remove();
        document.querySelector(".searchnav div:nth-child(1)").remove();
        document.querySelector(".searchnav div:nth-child(1)").remove();
        document.querySelector(".saved-search").style.width = "auto";
    }

    // patch prev and next jumps
    if (prevurl) prevurl = pageInfo.knownPages[`P${window.currentPage - 1}`];
    if (nexturl) nexturl = pageInfo.knownPages[`P${window.currentPage + 1}`];

    let uprev = document.querySelector("#uprev");
    if (uprev.localName !== "span") uprev.href = prevurl;

    let dprev = document.querySelector("#dprev");
    if (dprev.localName !== "span") dprev.href = prevurl;

    let unext = document.querySelector("#unext");
    if (unext.localName !== "span") unext.href = nexturl;

    let dnext = document.querySelector("#dnext");
    if (dnext.localName !== "span") dnext.href = nexturl;

    // add tab click event handler for page buttons
    document.querySelectorAll('.search-relpager-num td').forEach(function (nav) {
        nav.addEventListener("click", function (ev) {
            if (ev.target.innerText == "...") {
                let pageInfo = JSON.parse(sessionStorage.getItem("EHPS-Paginator"));
                let page = prompt(`Jump to page: (between ${pageInfo.knownPages.min} and ${pageInfo.knownPages.max})`, 0);
                if (page != null) {
                    page = parseInt(page);

                    if ((page >= parseInt(pageInfo.knownPages.min)) && (page <= parseInt(pageInfo.knownPages.max))) {
                        document.location = pageInfo.knownPages[`P${page}`];
                    }
                }
            } else if (ev.target.id.startsWith("pg-") || ev.target.id.startsWith("u") || ev.target.id.startsWith("d")) {
                if (ev.target.id.startsWith("pg-")) ev.target.firstChild.click();
            } else if (ev.target.innerText != "?") {
                if (ev.target.localName === "td") document.location = ev.target.firstChild.href;
            }
        }, false);
    });
}

const updateConfig = () => {
    if (document.querySelector(".search-scrobbler-config-bg") === null) return;

    document.querySelector('.search-scrobbler-config-bg').innerHTML = `
  <div class="search-scrobbler-config-window ido">
    <div class="search-scrobbler-config-close"><div class="search-scrobbler-config-title">${GM.info.script.name} v${GM.info.script.version}</div>&nbsp;&nbsp;&times;</div>
    <div>
      <input type="checkbox" id="search-scrobbler-config-disBookmark"><label for="search-scrobbler-config-disBookmark"> Disable bookmarks</label><br>
      <input type="checkbox" id="search-scrobbler-config-disPageinator"><label for="search-scrobbler-config-disPageinator"> Disable pages</label><br>
      <input type="checkbox" id="search-scrobbler-config-disMoveJump2Page"><label for="search-scrobbler-config-disMoveJump2Page"> Disable integration Jump/Seek into paginator</label><br>
      <input type="checkbox" id="search-scrobbler-config-disPageScrobbler"><label for="search-scrobbler-config-disPageScrobbler"> Hide <select id="search-scrobbler-config-disPageScrobbler-type"></select> bar</label><br>
      <input type="checkbox" id="search-scrobbler-config-fullWidthBar"><label for="search-scrobbler-config-fullWidthBar"> Use full width for bar</label><br>
      <input type="checkbox" id="search-scrobbler-config-enlPageprefetch"><label for="search-scrobbler-config-enlPageprefetch"> Enable page prefetch (+/- <select id="search-scrobbler-config-enlPageprefetch-size"></select> pages)</label><br>
      <div style="padding: 2px 20px 2px 30px;color:red;font-weight:bold;">Be careful with prefetch as it creates a lot of page requests and the server will block you for some time if you reaches a certain limit in a timeframe</div>
    </div>
  </div>`;

    let disPageScrobblerType = document.getElementById('search-scrobbler-config-disPageScrobbler-type');
    let hidePageScrobblerType = localStorage.getItem("EHPS-HidePageScrobblerType") ?? 0;
    for (let i = 0; i < 3; i++) {
        let opt = document.createElement('option');
        switch (i) {
            case 0:
                opt.text = "top";
                break;
            case 1:
                opt.text = "bottom";
                break;
            case 2:
                opt.text = "top and bottom";
                break;
            default:
                opt.text = i;
                break;
        }
        opt.value = i;
        if (hidePageScrobblerType == i) opt.selected = true;

        disPageScrobblerType.add(opt);
    }

    let enlPageprefetchSize = document.getElementById('search-scrobbler-config-enlPageprefetch-size');
    let selSize = localStorage.getItem("EHPS-EnablePageinatorPrefetchSize") ?? defaultMaxPrefetch;
    for (let i = 2; i < 6; i++) {
        let opt = document.createElement('option');
        opt.text = i;
        opt.value = i;
        if (selSize == i) opt.selected = true;

        enlPageprefetchSize.add(opt);
    }

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

        if (localStorage.getItem("EHPS-DisableIntegrationJump2Page") != "true") {
            if (!e.target.checked) updatePageCounter();
            else location.reload();
        } else updatePageCounter();
    }, false);

    document.getElementById("search-scrobbler-config-disMoveJump2Page").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-DisableIntegrationJump2Page", e.target.checked);
        if (!e.target.checked) updatePageCounter();
        else location.reload();
    }, false);

    document.getElementById("search-scrobbler-config-disPageScrobbler").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-HidePageScrobbler", e.target.checked);
        updatePageScrobbler();
    }, false);

    document.getElementById("search-scrobbler-config-disPageScrobbler-type").addEventListener("change", function (e) {
        localStorage.setItem("EHPS-HidePageScrobblerType", e.target.value);
        updatePageScrobbler();
    }, false);

    document.getElementById("search-scrobbler-config-fullWidthBar").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-FullWidthBar", e.target.checked);
        updatePageScrobbler();
    }, false);

    document.getElementById("search-scrobbler-config-enlPageprefetch").addEventListener("click", function (e) {
        localStorage.setItem("EHPS-EnablePageinatorPrefetch", e.target.checked);
        if (localStorage.getItem("EHPS-DisableIntegrationJump2Page") != "true") location.reload();
        else updatePageCounter();
    }, false);

    document.getElementById("search-scrobbler-config-enlPageprefetch-size").addEventListener("change", function (e) {
        localStorage.setItem("EHPS-EnablePageinatorPrefetchSize", e.target.value);
        if (localStorage.getItem("EHPS-EnablePageinatorPrefetch") == "true") {
            if (localStorage.getItem("EHPS-DisableIntegrationJump2Page") != "true") location.reload();
            else updatePageCounter();
        }
    }, false);

    if (localStorage.getItem("EHPS-DisableBookmark") == "true") document.getElementById("search-scrobbler-config-disBookmark").checked = true;
    if (localStorage.getItem("EHPS-DisablePageinator") == "true") document.getElementById("search-scrobbler-config-disPageinator").checked = true;
    if (localStorage.getItem("EHPS-DisableIntegrationJump2Page") == "true") document.getElementById("search-scrobbler-config-disMoveJump2Page").checked = true;
    if (localStorage.getItem("EHPS-HidePageScrobbler") == "true") document.getElementById("search-scrobbler-config-disPageScrobbler").checked = true;
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
