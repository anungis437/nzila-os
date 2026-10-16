param vmName string = 'nzila-g2-builder-y3koaeijzi6mu'
param location string = 'canadacentral'
@allowed([
  'pre'
  'post'
])
param mode string = 'pre'
param expectedManifestDigest string = ''

var script = '#!/bin/sh\nset -eu\nexec python3 - <<\'NZILA_PRIVATE_VERIFIER\'\n${loadTextContent('verifier.py')}\nraise SystemExit(main("${mode}", "${expectedManifestDigest}"))\nNZILA_PRIVATE_VERIFIER\n'

resource vm 'Microsoft.Compute/virtualMachines@2024-11-01' existing = {
  name: vmName
}

resource verifier 'Microsoft.Compute/virtualMachines/extensions@2024-11-01' = {
  parent: vm
  name: 'nzila-g2-private-import-verifier'
  location: location
  properties: {
    publisher: 'Microsoft.Azure.Extensions'
    type: 'CustomScript'
    typeHandlerVersion: '2.1'
    autoUpgradeMinorVersion: false
    enableAutomaticUpgrade: false
    suppressFailures: false
    settings: {
      script: base64(script)
      skipDos2Unix: true
    }
  }
}
