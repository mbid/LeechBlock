'use strict'
/* globals describe, it */

const assert = require('assert')
const moment = require('moment')
const {
  isInsideDailyInterval,
  nextMomentInsideDailyInterval,
  nextMomentOutsideDailyInterval,
  nextIntervalBoundary,
  previousIntervalBoundary
} = require('../lib/logic.js')

moment.utc()

describe('*dailyInterval', () => {
  const friday = moment.utc('2017-09-08T12:34:56.789Z') // a Friday

  it('should work for a standard interval', () => {
    const interval = {
      startTime: {
        hour: 4,
        minute: 59,
        second: 0,
        millisecond: 0
      },
      endTime: {
        hour: 6,
        minute: 3,
        second: 0,
        millisecond: 0
      },
      days: [false, false, false, false, true, false, true] // Thursday and Saturday
    }
    let m

    // Friday
    m = friday.clone()
    assert(!isInsideDailyInterval(m, interval))
    assert.equal(
      nextMomentInsideDailyInterval(m, interval).toISOString(),
      '2017-09-09T04:59:00.000Z'
    )
    assert.equal(
      nextMomentOutsideDailyInterval(m, interval).toISOString(),
      m.toISOString()
    )

    // Saturday between 5 and 6
    m = friday.clone().day(6).hour(5)
    assert(isInsideDailyInterval(m, interval))
    assert.equal(
      nextMomentInsideDailyInterval(m, interval).toISOString(),
      m.toISOString()
    )
    assert.equal(
      nextMomentOutsideDailyInterval(m, interval).toISOString(),
      '2017-09-09T06:03:00.000Z'
    )

    // Saturday exactly when the time interval ends
    m = friday.clone().day(6).hour(6).minute(3).second(0).milliseconds(0)
    assert(!isInsideDailyInterval(m, interval))
    assert.equal(
      nextMomentInsideDailyInterval(m, interval).toISOString(),
      '2017-09-14T04:59:00.000Z'
    )
    assert.equal(
      nextMomentOutsideDailyInterval(m, interval).toISOString(),
      m.toISOString()
    )

    // Saturday exactly when the time interval begins
    m = friday.clone().day(6).hour(4).minute(59).second(0).millisecond(0)
    assert(isInsideDailyInterval(m, interval))
    assert.equal(
      nextMomentInsideDailyInterval(m, interval).toISOString(),
      m.toISOString()
    )
    assert.equal(
      nextMomentOutsideDailyInterval(m, interval).toISOString(),
      '2017-09-09T06:03:00.000Z'
    )
  })

  it('should work for an interval with no days at all', () => {
    const interval = {
      startTime: {
        hour: 4,
        minute: 59,
        second: 0,
        millisecond: 0
      },
      endTime: {
        hour: 6,
        minute: 3,
        second: 0,
        millisecond: 0
      },
      days: [false, false, false, false, false, false, false]
    }

    assert(!isInsideDailyInterval(friday, interval))
    assert.equal(
      nextMomentInsideDailyInterval(friday, interval),
      undefined
    )
    assert.equal(
      nextMomentOutsideDailyInterval(friday, interval).toISOString(),
      friday.toISOString()
    )
  })

  it('should work when time interval is empty', () => {
    const interval = {
      startTime: {
        hour: 4,
        minute: 59,
        second: 0,
        millisecond: 0
      },
      endTime: {
        hour: 4,
        minute: 59,
        second: 0,
        millisecond: 0
      },
      days: [0, 1, 2, 3, 4, 5, 6]
    }

    assert(!isInsideDailyInterval(friday, interval))
    assert.equal(
      nextMomentInsideDailyInterval(friday, interval),
      undefined
    )
    assert.equal(
      nextMomentOutsideDailyInterval(friday, interval).toISOString(),
      friday.toISOString()
    )
  })

  it('should work when time interval is 24h', () => {
    const interval = {
      startTime: {
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0
      },
      endTime: {
        hour: 24,
        minute: 0,
        second: 0,
        millisecond: 0
      },
      // days: [0, 1, 3, 4, 6]
      days: [true, true, false, true, true, false, true]
    }
    let m

    m = friday.clone().day(2)
    assert(!isInsideDailyInterval(m, interval))
    assert.equal(
      nextMomentInsideDailyInterval(m, interval).toISOString(),
      m.clone().day(3).set(interval.startTime).toISOString()
    )
    assert.equal(
      nextMomentOutsideDailyInterval(m, interval).toISOString(),
      m.toISOString()
    )

    m = friday.clone().day(3)
    assert(isInsideDailyInterval(m, interval))
    assert.equal(
      nextMomentInsideDailyInterval(m, interval).toISOString(),
      m.toISOString()
    )
    assert.equal(
      nextMomentOutsideDailyInterval(m, interval).toISOString(),
      m.clone().day(5).set(interval.startTime).toISOString()
    )

    m = friday.clone().day(6)
    assert(isInsideDailyInterval(m, interval))
    assert.equal(
      nextMomentInsideDailyInterval(m, interval).toISOString(),
      m.toISOString()
    )
    assert.equal(
      nextMomentOutsideDailyInterval(m, interval).toISOString(),
      m.clone().day(7 + 2).set(interval.startTime).toISOString()
    )
  })
})

describe('[next|previous]Multiple', function () {
  it('should work for start=now', () => {
    const now = moment.utc('2017-09-08T12:34:56.789Z')
    const start = now
    const duration = moment.duration(123)

    assert.equal(
      nextIntervalBoundary(now, start, duration).toISOString(),
      now.toISOString()
    )
    assert.equal(
      previousIntervalBoundary(now, start, duration).toISOString(),
      now.toISOString()
    )
  })
  it('should work for start < now', () => {
    const now = moment.utc('2017-09-08T12:34:56.789Z')
    const start = now.clone().subtract({days: 123, hours: 5})
    const interval = moment.duration(2, 'hours')

    assert.equal(
      nextIntervalBoundary(now, start, interval).toISOString(),
      now.clone().add(1, 'hours').toISOString()
    )
    assert.equal(
      previousIntervalBoundary(now, start, interval).toISOString(),
      now.clone().subtract(1, 'hours').toISOString()
    )
  })
  it('should work for start > now', () => {
    const now = moment.utc('2017-09-08T12:34:56.789Z')
    const start = now.clone().add({days: 123, hours: 5})
    const interval = moment.duration(2, 'hours')

    assert.equal(
      nextIntervalBoundary(now, start, interval).toISOString(),
      now.clone().add(1, 'hours').toISOString()
    )
    assert.equal(
      previousIntervalBoundary(now, start, interval).toISOString(),
      now.clone().subtract(1, 'hours').toISOString()
    )
  })
})
