'use strict'
/* globals browser */

// Utilities for handling persistent state
const moment = require('moment')

// parse and format day time in format HH:mm:ss
function parseISOTime (str) {
  if (str === '24:00:00') {
    // moment would say that this is 00:00:00 on the next day
    return {
      hours: 24,
      minutes: 0,
      seconds: 0,
      milliseconds: 0
    }
  } else {
    const m = moment(str, 'HH:mm:ss')
    return {
      hours: m.hours(),
      minutes: m.minutes(),
      seconds: m.seconds(),
      milliseconds: 0
    }
  }
}
function formatISOTime (t) {
  if (t.hours === 24) {
    return '24:00:00'
  } else {
    return moment(t).format('HH:mm:ss')
  }
}
// parse and format an ISO date and time without time zone into a moment (local time)
function parseISODateTime (str) {
  return moment(str)
}
function formatISODateTime (m) {
  // TODO: make more robust
  return m.format().slice(0, -6)
}

/**
 * @typedef BlockSetSettings
 * @type {object}
 * @property {string} id - an UUID4 string
 * @property {string} name - any string
 *
 * @property {Array.<String>} blockedUrlPatterns - valid match patterns only
 *
 * @property {string} startTime - format HH:mm:ss
 * @property {string} endTime - format HH:mm:ss
 * @property {Array.<boolean>} days - always of length 7
 *
 * @property {string} quotaInterval - an ISO 8601 duration
 * @property {string} quotaReset - an ISO 8601 date and time, without time zone
 * @property {string} quotaAllowed - an ISO 8601 duration
 */

const exampleBlockSetSettings = {
  id: 'cee7cf25-6513-4281-9e32-9ed464d96614',
  name: 'My block set',

  blockedUrlPatterns: ['*://does-not-exist.com/*', '*://www.heise.de/*'],

  startTime: '00:00:00',
  endTime: '24:00:00',
  days: [true, true, true, true, true, true, true],

  quotaInterval: 'P1Y',
  quotaReset: '2017-09-14T10:27:22',
  quotaAllowed: 'PT1H30M'
}

// courtesy https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuidv4 () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function emptyBlockSetSettings () {
  return {
    id: uuidv4(),
    name: '',

    blockedUrlPatterns: [],
    startTime: '09:00:00',
    endTime: '17:00:00',
    days: [false, true, true, true, true, true, false],

    quotaInterval: 'P1D',
    quotaReset: '2017-09-14T00:00:00',
    quotaAllowed: 'PT10M'
  }
}

/**
 * @typedef BlockSetData
 * @property {string} quotaUsed - an ISO 8601 duration
 * @property {string} lastQuotaReset - an ISO 8601 date and time, without time zone
 * @property {Array.<string>} taintedUrls
 */

const exampleBlockSetData = {
  quotaUsed: 'PT1H29M58S',
  lastQuotaReset: '2017-09-14T10:27:22',
  taintedUrls: ['http://visited-from-does-not-exist.com']
}

/**
 * @typedef State
 * @property {Array.<BlockSetSettings>} blockSets
 * @property {object} blockSetData - maps ids to BlockSetData`s
 */

const exampleState = {
  blockSetSettings: [exampleBlockSetSettings],
  blockSetData: {}
}
exampleState.blockSetData[exampleBlockSetSettings.id] = exampleBlockSetData

function defaultState () {
  return {
    blockSetSettings: [emptyBlockSetSettings()],
    blockSetData: {}
  }
}

function setState (state) {
  return browser.storage.local.set(state)
}

function insertMissingBlockSetData (state) {
  for (const settings of state.blockSetSettings) {
    if (!(settings.id in state.blockSetData)) {
      state.blockSetData[settings.id] = {
        lastQuotaReset: settings.quotaReset,
        quotaUsed: String(moment.duration(0)),
        taintedUrls: []
      }
    }
  }
}

function getState () {
  const keys = ['blockSetSettings', 'blockSetData']
  return browser.storage.local.get(keys).then(
    state => {
      if (keys.some(key => !(key in state))) {
        return defaultState()
      } else {
        return state
      }
    },
    err => {
      console.log(err)
      return defaultState()
    }
  ).then(state => {
    insertMissingBlockSetData(state)
    return state
  })
}

function syncState (state) {
  browser.storage.onChanged.addListener(changes => {
    for (const key in changes) {
      state[key] = changes[key].newValue
    }
    insertMissingBlockSetData(state)
  })
}

module.exports = {
  parseISOTime,
  formatISOTime,
  parseISODateTime,
  formatISODateTime,
  getState,
  setState,
  exampleState,
  emptyBlockSetSettings,
  defaultState,
  syncState
}
