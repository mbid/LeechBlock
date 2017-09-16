'use strict'

function decodeBlockInfo (hash) {
  let [, blockedUrl, unblockingDate, blockSetName] = hash.split('#')

  if (blockedUrl !== '') {
    blockedUrl = decodeURIComponent(blockedUrl)
  } else {
    blockedUrl = undefined
  }

  if (unblockingDate !== '') {
    unblockingDate = new Date(decodeURIComponent(unblockingDate))
  } else {
    unblockingDate = undefined
  }

  if (blockSetName !== '') {
    blockSetName = decodeURIComponent(blockSetName)
  } else {
    blockSetName = undefined
  }

  return {
    blockedUrl,
    unblockingDate,
    blockSetName
  }
}

const {blockedUrl, unblockingDate, blockSetName} =
  decodeBlockInfo(window.location.hash)

const blockedUrlLink = document.getElementById('blocked-url-link')
if (blockedUrl != null) {
  blockedUrlLink.appendChild(document.createTextNode(blockedUrl))
  blockedUrlLink.setAttribute('href', blockedUrl)
} else {
  blockedUrlLink.style.display = 'none'
}

if (unblockingDate != null) {
  const now = new Date()
  if (unblockingDate < now && blockedUrl != null) {
    window.location.href = blockedUrl
  }
  let formatted
  if (unblockingDate.toDateString() === now.toDateString()) {
    formatted = unblockingDate.toLocaleTimeString()
  } else {
    formatted = unblockingDate.toLocaleString()
  }

  document.getElementById('never-unblocked').style.display = 'none'
  document.getElementById('unblock-time')
    .appendChild(document.createTextNode(formatted))
} else {
  document.getElementById('sometime-unblocked').style.display = 'none'
}

if (blockSetName != null) {
  document.getElementById('block-set-name')
    .appendChild(document.createTextNode(blockSetName))
} else {
  document.getElementById('block-set-info').style.display = 'none'
}
