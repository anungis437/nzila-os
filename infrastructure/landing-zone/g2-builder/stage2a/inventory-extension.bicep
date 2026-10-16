param vmName string = 'nzila-g2-builder-y3koaeijzi6mu'
param extensionName string = 'nzila-g2-stage2a-inventory'
param location string = 'canadacentral'

var script = '#!/bin/sh\nset -eu\nexec python3 - <<\'NZILA_STAGE2A_PYTHON\'\n${loadTextContent('inventory.py')}\nNZILA_STAGE2A_PYTHON\n'

resource vm 'Microsoft.Compute/virtualMachines@2024-11-01' existing = {
  name: vmName
}

resource inventoryExtension 'Microsoft.Compute/virtualMachines/extensions@2024-11-01' = {
  parent: vm
  name: extensionName
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
