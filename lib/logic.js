'use strict'

const {matchPatternToRegExp} = require('./match-pattern')
const moment = require('moment');
const {parseISOTime, parseISODateTime, formatISODateTime} = require('./state')

/**
 * @typedef DailyInterval
 * @type {object}
 * @property {DayTime} startTime
 * @property {DayTime} endTime
 * @property {Array.<boolean>} days
 */

/**
 * Whether a moment is inside a daily interval.
 * @param {moment}
 * @param {DailyInterval}
 * @return {boolean}
 */
function isInsideDailyInterval(m, {startTime, endTime, days}) {
  if (!days[m.day()]) {
    return false
  }

  const startm = m.clone().set(startTime);
  const endm = m.clone().set(endTime);

  return startm <= m && m < endm;
}

/**
 * @param {moment}
 * @param {DailyInterval}
 * @return {moment}
 */
function nextMomentInsideDailyInterval(m, dailyInterval) {
  if (isInsideDailyInterval(m, dailyInterval)) {
    return m.clone()
  }
  const {startTime, endTime, days} = dailyInterval;

  if (
    moment.duration(endTime).valueOf() === moment.duration(startTime).valueOf()
  ) {
    return undefined;
  }

  if (days[m.day()]) {
    const startToday = m.clone().set(startTime)
    if (m <= startToday) {
      return startToday
    }
  }

  for (const i of [1, 2, 3, 4, 5, 6, 7]) {
    const n = m.clone().add(i, 'days')
    if (days[n.day()]) {
      return n.set(startTime)
    }
  }

  return undefined
}

/**
 * @param {moment}
 * @param {DailyInterval}
 * @return {moment}
 */
function nextMomentOutsideDailyInterval(m, dailyInterval) {
  if (!isInsideDailyInterval(m, dailyInterval)) {
    return m.clone();
  }
  const {startTime, endTime, days} = dailyInterval;

  if (
    moment.duration(startTime).valueOf() === 0 &&
    moment.duration(endTime).valueOf() === moment.duration(24, 'hours').valueOf()
  ) {
    for (const i of [1, 2, 3, 4, 5, 6]) {
      const n = m.clone().add(i, 'days')
      if (!days[n.day()]) {
        return n.set(startTime)
      }
    }
    return undefined
  }

  return m.clone().set(endTime)
}

function nextIntervalBoundary(now, start, duration) {
  const result = start.clone()
  if (start <= now) {
    while (result < now) {
      result.add(duration)
    }
  } else {
    while (result > now) {
      result.subtract(duration)
    }
    result.add(duration)
  }
  return result
}

function previousIntervalBoundary(now, start, duration) {
  return nextIntervalBoundary(now.clone().subtract(duration), start, duration)
}

function affectsUrl(url, {blockedUrlPatterns}, {taintedUrls}) {
  const patterns = blockedUrlPatterns.concat(taintedUrls)

  return patterns.some(pattern => matchPatternToRegExp(pattern).test(url))
}

function currentStatus(
  now,
  {startTime, endTime, days, quotaInterval, quotaAllowed},
  {quotaUsed, lastQuotaReset}
) {
  startTime = parseISOTime(startTime)
  endTime = parseISOTime(endTime)
  quotaInterval = moment.duration(quotaInterval)
  quotaAllowed = moment.duration(quotaAllowed)

  quotaUsed = moment.duration(quotaUsed)
  lastQuotaReset = parseISODateTime(lastQuotaReset)

  if (!isInsideDailyInterval(now, {startTime, endTime, days})) {
    return "inactive"
  }

  const nextQuotaReset = nextIntervalBoundary(now, lastQuotaReset, quotaInterval)
  if (nextQuotaReset <= now && quotaAllowed > moment.duration(0)) {
    return "tracking"
  }

  if (nextQuotaReset > now && quotaAllowed > quotaUsed) {
    return "tracking"
  }

  return "blocking"
}

function nextNonBlockingMoment(now, settings, data) {
  if (currentStatus(now, settings, data) !== "blocking") {
    return now;
  }

  const startTime = parseISOTime(settings.startTime)
  const endTime = parseISOTime(settings.endTime)
  const nextInactive =
    nextMomentOutsideDailyInterval(now, {startTime, endTime, days: settings.days})

  const quotaAllowed = moment.duration(settings.quotaAllowed)
  const quotaReset = parseISODateTime(settings.quotaReset)
  const quotaInterval = moment.duration(settings.quotaInterval)

  let nextReset = undefined
  if (quotaAllowed > moment.duration(0)) {
    nextReset = nextIntervalBoundary(now, quotaReset, quotaInterval)
  }

  if (nextInactive == undefined) {
    return nextReset;
  }
  if (nextReset == undefined) {
    return nextInactive;
  }
  return moment.min([nextInactive, nextReset]);
}

function quotaTick(getActiveUrl, getAllUrls, now, settings, data) {
  // reset the quota usage if next reset moment is not in the future anymore
  const quotaReset = parseISODateTime(settings.quotaReset)
  const lastQuotaReset = parseISODateTime(data.lastQuotaReset)
  const quotaInterval = moment.duration(settings.quotaInterval)
  const lastQuotaReset_ = previousIntervalBoundary(now, quotaReset, quotaInterval)

  if (lastQuotaReset.valueOf() !== lastQuotaReset_.valueOf()) {
    data.lastQuotaReset = formatISODateTime(lastQuotaReset_)
    data.quotaUsed = String(moment.duration(0))
    settings.quotaReset = lastQuotaReset_
  }

  // increase quotaUsed if the blockset is currenlty in tracking status
  if (currentStatus(now, settings, data) === "tracking") {
    return getActiveUrl().then(url => {
      if (url != undefined && affectsUrl(url, settings, data)) {
        data.quotaUsed = String(moment.duration(data.quotaUsed).add(1, 'seconds'))
      }
      return data
    })
  }

  return Promise.resolve();
}

module.exports = {
  isInsideDailyInterval,
  nextMomentInsideDailyInterval,
  nextMomentOutsideDailyInterval,
  nextIntervalBoundary,
  previousIntervalBoundary,
  affectsUrl,
  currentStatus,
  nextNonBlockingMoment,
  quotaTick
}
