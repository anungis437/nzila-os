var script = '#!/bin/sh\nset -eu\nexec python3 - <<\'NZILA_EMPTY_PATH\'\n${loadTextContent('../private-import/verifier.py')}\n${loadTextContent('../blob-readback/observer.py')}\n${loadTextContent('validator.py')}\n${loadTextContent('observer.py')}\nraise SystemExit(run_readback())\nNZILA_EMPTY_PATH\n'

resource vm 'Microsoft.Compute/virtualMachines@2024-11-01' existing = {
  name: 'nzila-g2-builder-y3koaeijzi6mu'
}

resource observer 'Microsoft.Compute/virtualMachines/extensions@2024-11-01' = {
  parent: vm
  name: 'nzila-g2-empty-path'
  location: 'canadacentral'
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
