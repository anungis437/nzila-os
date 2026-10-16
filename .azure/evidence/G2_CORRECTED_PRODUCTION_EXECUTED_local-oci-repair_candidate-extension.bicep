var payload = loadFileAsBase64('../../../../../.azure/evidence/G2_SYNTHETIC_PRODUCTION_PAYLOAD.json')
var script = '#!/bin/sh\nset -eu\nexec python3 - <<\'NZILA_OCI_REPAIRED\'\n${loadTextContent('../private-import/verifier.py')}\n${loadTextContent('../blob-readback/observer.py')}\n${loadTextContent('../empty-path/validator.py')}\n${loadTextContent('../empty-path/observer.py')}\nBOUND_PAYLOAD_BASE64 = \'${payload}\'\n${loadTextContent('../synthetic-revised/production.py')}\n${loadTextContent('validator.py')}\n${loadTextContent('adapter.py')}\nraise SystemExit(production_main())\nNZILA_OCI_REPAIRED\n'

resource vm 'Microsoft.Compute/virtualMachines@2024-11-01' existing = {
  name: 'nzila-g2-builder-y3koaeijzi6mu'
}

resource candidate 'Microsoft.Compute/virtualMachines/extensions@2024-11-01' = {
  parent: vm
  name: 'nzila-g2-oci-repaired'
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
