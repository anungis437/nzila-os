param provisioningSshPublicKey string
param imageVersion string
param runtimeIdentityId string
param subnetId string
param nsgId string
param tags object

var adminUsername = 'nzila${uniqueString(resourceGroup().id, 'runtime-proof')}'
var payload = loadFileAsBase64('../../../../.azure/evidence/G2_SYNTHETIC_PRODUCTION_PAYLOAD.json')
var script = '#!/bin/sh\nset -eu\nif ! command -v python3 >/dev/null 2>&1; then printf \'NZILA_G2_STAGE2B_PRECHECK=PYTHON3_UNAVAILABLE\\n\'; exit 78; fi\nexec python3 - <<\'NZILA_RUNTIME_ONCE\'\n${loadTextContent('../stage2a/private-import/verifier.py')}\n${loadTextContent('../stage2a/blob-readback/observer.py')}\n${loadTextContent('../stage2a/empty-path/validator.py')}\n${loadTextContent('../stage2a/empty-path/observer.py')}\n${loadTextContent('../stage2a/local-oci-repair/validator.py')}\nBOUND_PAYLOAD_BASE64 = \'${payload}\'\n${loadTextContent('runtime.py')}\nraise SystemExit(runtime_main())\nNZILA_RUNTIME_ONCE\n'

resource nic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: 'nzila-g2-runtime-proof-nic'
  location: 'canadacentral'
  tags: tags
  properties: {
    enableAcceleratedNetworking: false
    enableIPForwarding: false
    networkSecurityGroup: {
      id: nsgId
    }
    ipConfigurations: [
      {
        name: 'primary'
        properties: {
          primary: true
          privateIPAllocationMethod: 'Dynamic'
          privateIPAddressVersion: 'IPv4'
          subnet: {
            id: subnetId
          }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2024-11-01' = {
  name: 'nzila-g2-runtime-proof'
  location: 'canadacentral'
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${runtimeIdentityId}': {}
    }
  }
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_B2s'
    }
    osProfile: {
      computerName: 'g2-runtime-proof'
      adminUsername: adminUsername
      customData: base64('#cloud-config\npackage_update: false\npackage_upgrade: false\n')
      linuxConfiguration: {
        disablePasswordAuthentication: true
        provisionVMAgent: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: provisioningSshPublicKey
            }
          ]
        }
      }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: imageVersion
      }
      osDisk: {
        name: 'nzila-g2-runtime-proof-osdisk'
        createOption: 'FromImage'
        deleteOption: 'Detach'
        diskSizeGB: 32
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
          properties: {
            primary: true
            deleteOption: 'Detach'
          }
        }
      ]
    }
    diagnosticsProfile: {
      bootDiagnostics: {
        enabled: false
      }
    }
  }
}

resource proof 'Microsoft.Compute/virtualMachines/extensions@2024-11-01' = {
  parent: vm
  name: 'nzila-g2-runtime-once'
  location: 'canadacentral'
  tags: tags
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
