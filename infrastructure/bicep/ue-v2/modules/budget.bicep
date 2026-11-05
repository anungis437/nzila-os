// Monthly cost budget for the deployment's resource group: actual-spend alerts at three thresholds
// and one forecast alert at 100 %. Consumption budgets do not support tags.
targetScope = 'resourceGroup'

param name string
@minValue(1)
param amount int
@description('First day of a month, yyyy-MM-01. A budget cannot start before the current month.')
param startDate string
@description('Three actual-spend alert thresholds, percent of amount.')
@minLength(3)
@maxLength(3)
param thresholds array = [50, 80, 100]
param contactEmails array = []
@description('Action group notified at every threshold. Empty = email recipients only.')
param actionGroupId string = ''

var contactGroups = empty(actionGroupId) ? [] : [actionGroupId]
var actual = {
  enabled: true
  operator: 'GreaterThan'
  thresholdType: 'Actual'
  contactEmails: contactEmails
  contactGroups: contactGroups
}

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: name
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: { startDate: startDate }
    notifications: {
      actual_1: union(actual, { threshold: thresholds[0] })
      actual_2: union(actual, { threshold: thresholds[1] })
      actual_3: union(actual, { threshold: thresholds[2] })
      forecast_100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
        contactGroups: contactGroups
      }
    }
  }
}

output id string = budget.id
