'use strict'

/* globals browser, location */

const {
  getState,
  setState,
  formatISOTime,
  exampleState
} = require('../lib/state.js')
const moment = require('moment')
const {matchPatternToRegExp} = require('../lib/match-pattern.js')

function setIdPostfix (postfix, node) {
  const ids = [...node.querySelectorAll('[id]')].map(n => n.getAttribute('id'))

  for (const id of ids) {
    for (const attr of ['id', 'for', 'aria-describedby']) {
      for (const n of node.querySelectorAll('[' + attr + '=' + id + ']')) {
        n.setAttribute(attr, id + '-' + postfix)
      }
      if (node.getAttribute(attr) === id) {
        node.setAttribute(attr, id + '-' + postfix)
      }
    }
  }
}

function setParse (node, parse, parsedValue) {
  node.parse = () => {
    const parsedValue = parse(node.value)
    if (parsedValue != null) {
      node.removeAttribute('aria-invalid')
    } else {
      node.setAttribute('aria-invalid', true)
    }
    return parsedValue
  }
}

function expandTemplateChild (template) {
  console.assert(template.content.children.length === 1)
  const child = template.content.children[0].cloneNode(true)
  if (template.parentNode != null) {
    template.parentNode.insertBefore(child, template.nextSibling)
  }
  return child
}

function parseTime (str) {
  const formats = [
    'hh:mm:ss a', 'HH:mm:ss', 'hh:mm a', 'HH:mm', 'hh a',
    'h:mm:ss a', 'h:mm a', 'h a'
  ]
  const m = moment(str, formats, true)

  if (m.isValid()) {
    const time = {
      hours: m.hours(),
      minutes: m.minutes(),
      seconds: m.seconds(),
      milliseconds: m.milliseconds()
    }
    if (Object.values(time).every(t => t === 0)) {
      if (m > moment()) {
        time.hours = 24
      }
    }
    return time
  } else {
    return undefined
  }
}

function parseMatchPattern0 (str) {
  const trimmed = str.trim()
  if (trimmed === '' || matchPatternToRegExp(trimmed) != null) {
    return trimmed
  } else {
    return undefined
  }
}

function fillBlockSet (blockSetNode, blockSetSettings) {
  const node = blockSetNode
  node.blockSetSettings = blockSetSettings
  const settings = blockSetSettings

  const name = node.querySelector('#block-set-name')
  name.value = settings.name
  name.addEventListener('change', () => {
    settings.name = name.value.trim()
  })

  const editBlockedPageTemplate =
    node.querySelector('#edit-blocked-page-template')
  function addBlockedUrlPattern (pattern) {
    const container = expandTemplateChild(editBlockedPageTemplate)
    const input = container.querySelector('input')
    input.value = pattern
    setParse(input, parseMatchPattern0)
    input.addEventListener('change', () => {
      // index in editBlockedPageTemplate this element corresponds to
      const i = [...container.parentNode.children].indexOf(container) - 2
      if (input.parse() != null) {
        settings.blockedUrlPatterns[i] = input.parse()
      }
      if (input.parse() === '') {
        settings.blockedUrlPatterns.splice(i, 1)
        container.parentNode.removeChild(container)
      }
    })
  }

  const newBlockedPage = node.querySelector('#new-blocked-page')
  newBlockedPage.value = ''
  setParse(newBlockedPage, parseMatchPattern0)
  newBlockedPage.addEventListener('change', () => {
    if (
      newBlockedPage.parse() != null &&
      newBlockedPage.parse() !== ''
    ) {
      addBlockedUrlPattern(newBlockedPage.parse())
      settings.blockedUrlPatterns.unshift(newBlockedPage.parse())
      newBlockedPage.value = ''
    }
  })

  for (const pattern of [...blockSetSettings.blockedUrlPatterns].reverse()) {
    addBlockedUrlPattern(pattern)
  }

  const startTime = node.querySelector('#start-time')
  startTime.value = settings.startTime // TODO: localize
  setParse(startTime, parseTime)

  const endTime = node.querySelector('#end-time')
  endTime.value = settings.endTime // TODO: localize
  setParse(endTime, parseTime)

  for (const time of [startTime, endTime]) {
    time.addEventListener('change', () => {
      if (startTime.parse() != null && endTime.parse() != null) {
        if (moment(startTime.parse()) < moment(endTime.parse())) {
          settings.startTime = formatISOTime(startTime.parse())
          settings.endTime = formatISOTime(endTime.parse())
          startTime.removeAttribute('aria-invalid')
          endTime.removeAttribute('aria-invalid')
        } else {
          startTime.setAttribute('aria-invalid', true)
          endTime.setAttribute('aria-invalid', true)
        }
      } else {
        startTime.parse()
        endTime.parse()
      }
    })
  }

  for (const i of [0, 1, 2, 3, 4, 5, 6]) {
    const day = node.querySelector('#day' + i)
    day.checked = settings.days[i]
    day.addEventListener('change', () => {
      settings.days[i] = day.checked
    })
  }

  const quotaAllowedNumber = node.querySelector('#quota-allowed-number')
  setParse(quotaAllowedNumber, s => {
    const i = parseInt(s)
    if (isNaN(i) || i < 0) {
      return undefined
    } else {
      return i
    }
  })
  const quotaAllowedUnit = node.querySelector('#quota-allowed-unit')
  const quotaAllowed = moment.duration(settings.quotaAllowed)
  console.assert(moment.isDuration(quotaAllowed))
  quotaAllowedUnit.value =
    ['hours', 'minutes']
    .find(unit => Number.isInteger(quotaAllowed.as(unit)))
  quotaAllowedNumber.value = quotaAllowed.as(quotaAllowedUnit.value)
  for (const quotaAllowedNode of [quotaAllowedNumber, quotaAllowedUnit]) {
    quotaAllowedNode.addEventListener('change', () => {
      const number = quotaAllowedNumber.parse()
      if (number != null) {
        const unit = quotaAllowedUnit.value
        settings.quotaAllowed = moment.duration(number, unit).toISOString()
      }
    })
  }

  const quotaIntervalNumber = node.querySelector('#quota-interval-number')
  setParse(quotaIntervalNumber, s => {
    const i = parseInt(s)
    if (isNaN(i) || i <= 0) {
      return undefined
    } else {
      return i
    }
  })
  const quotaIntervalUnit = node.querySelector('#quota-interval-unit')
  const quotaInterval = moment.duration(settings.quotaInterval)
  quotaIntervalUnit.value =
    ['months', 'weeks', 'days', 'hours', 'minutes']
    .find(unit => Number.isInteger(quotaInterval.as(unit)))
  quotaIntervalNumber.value = quotaInterval.as(quotaIntervalUnit.value)
  for (const quotaIntervalNode of [quotaIntervalNumber, quotaIntervalUnit]) {
    quotaIntervalNode.addEventListener('change', () => {
      const number = quotaIntervalNumber.parse()
      if (number != null) {
        const unit = quotaIntervalUnit.value
        settings.quotaInterval = moment.duration(number, unit).toISOString()
      }
    })
  }
}

function fillBody (body, state) {
  const blockSetTemplate = body.querySelector('#block-set-template')
  for (const blockSetSettings of [...state.blockSetSettings].reverse()) {
    const blockSetNode = expandTemplateChild(blockSetTemplate)
    fillBlockSet(blockSetNode, blockSetSettings)
    setIdPostfix(blockSetSettings.id, blockSetNode)
  }
}

const settingsKeys = ['blockSetSettings']
function getSettingsState () {
  return getState().then(state => {
    for (const key in state) {
      if (settingsKeys.indexOf(key) === -1) {
        delete state[key]
      }
    }
    return state
  })
}

if (typeof browser !== 'undefined') {
  getSettingsState().then(state => {
    fillBody(document.body, state)
    document.body.addEventListener('change', changes => {
      setState(state)
    })

    // reload the settings page if the settings state has changed on disk
    browser.storage.onChanged.addListener(changes => {
      if (settingsKeys.some(key => key in changes)) {
        // so some key that affects settings has changed
        getSettingsState().then(state_ => {
          if (JSON.stringify(state_) !== JSON.stringify(state)) {
            // the data is actually different, reload the settings page
            location.reload()
          }
        })
      }
    })
  })
} else {
  const state = {
    blockSetSettings: exampleState.blockSetSettings
  }
  fillBody(document.body, state)
  document.body.addEventListener('change', () => {
    console.log(JSON.stringify(state))
  })
}
