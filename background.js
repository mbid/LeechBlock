'use strict'

const {
  formatISODateTime,
  getState,
  setState,
  syncState
} = require('./lib/state')
const moment = require('moment')
const {
  quotaTick,
  currentStatus,
  affectsUrl,
  nextNonBlockingMoment
} = require('./lib/logic')

function getActiveUrl() {
  return browser.windows.getLastFocused({populate: true, windowTypes: ['normal']}).then(activeWindow => {
    if (activeWindow.focused === true) {
      const activeTab = activeWindow.tabs.find(tab => tab.active);
      if (activeTab != undefined) {
        return activeTab.url;
      }
    }

    return undefined;
  })
}

function getAllTabs() {
  return browser.tabs.query({windowType: 'normal'})
}

function getAllUrls() {
  return getAllTabs().then(tabs => tabs.map(tab => tab.url).filter(url => url != undefined))
}
function encodeBlockInfo(now, blockSet, blockedUrl) {
  let hash = "#";

  if (blockedUrl != undefined) {
    hash += encodeURIComponent(blockedUrl)
  }

  hash += "#";

  const unblockingMoment = nextNonBlockingMoment(now, blockSet);
  if (unblockingMoment != undefined) {
    hash += encodeURIComponent(unblockingMoment.toISOString());
  }

  hash += "#"

  if (blockSet.name != undefined) {
    hash += encodeURIComponent(blockSet.name)
  }

  return hash;
}

function blockTab(now, settings, data, tab) {
  const blockPageUrl = browser.extension.getURL("block/en-US.html")
  let hash = "#"
  if (tab.url != undefined) {
    hash += encodeURIComponent(tab.url)
  }

  hash += "#"
  const unblockingMoment = nextNonBlockingMoment(now, settings, data)
  if (unblockingMoment != undefined) {
    hash += formatISODateTime(unblockingMoment)
  }

  hash += "#"
  if (settings.name.trim() !== "") {
    hash += settings.name
  }

  browser.tabs.update(tab.id, {url: blockPageUrl + hash})
}

function main() {
  getState().then(state => {
    syncState(state)

    const lastStatuses = {}

    setInterval(() => {
      const now = moment()
      // quotaTick for all block sets
      Promise.all(state.blockSetSettings.map(settings => {
        const data = state.blockSetData[settings.id]
        return quotaTick(getActiveUrl, getAllUrls, now, settings, data)
      })).then(() => {
        // then: check if their status changed to "blocking", and block all
        // tabs with affected urls
        for (const settings of state.blockSetSettings) {
          const id = settings.id
          const data = state.blockSetData[id]
          const newStatus = currentStatus(now, settings, data)
          if (newStatus === "blocking" && lastStatuses[id] !== "blocking") {
            getAllTabs().then(tabs => {
              Promise.all(tabs.map(tab => {
                if (tab.url != undefined && affectsUrl(tab.url, settings, data)) {
                  blockTab(now, settings, data, tab)
                }
              }))
            })
          }
          lastStatuses[id] = newStatus
        }
      })
    }, 1000)

    // save block set data every minute
    setInterval(
      () => setState({blockSetData: state.blockSetData}),
      60 * 1000
    )

    // block a tab if its url changed to something blocked
    browser.tabs.onUpdated.addListener((tabId, {url}, tab) => {
      if (url == undefined) {
        return
      }

      const now = moment();
      for (const settings of state.blockSetSettings) {
        const data = state.blockSetData[settings.id]
        if (
          currentStatus(now, settings, data) === "blocking" &&
          affectsUrl(url, settings, data)
        ) {
          blockTab(now, settings, data, tab)
        }
      }
    });
  })
}

module.exports = {main}

if (typeof browser !== "undefined") {
  // only executed in browser
  main()
}
