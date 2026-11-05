const fs = require('fs')
const f = 'app/api/ml/predictions/sla-breach-risk/feedback/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }

swap(
  "            eq(modelMetadata.version, body.modelVersion),\n          ),\n        )\n        .limit(1);\n\n      const activeModel = model\n        ? model\n        : (\n            await tx\n              .insert(modelMetadata)\n              .values({\n                organizationId,\n                modelType: 'sla_breach_risk',\n                version: body.modelVersion,\n                parameters: {},\n              })\n              .returning()\n          )[0];\n",
  "            eq(modelMetadata.version, body.modelVersion),\n          ),\n        )\n        // The statistics are read, changed and written back, so the row is held for the duration: two feedbacks no longer overwrite each other.\n        .for('update')\n        .limit(1);\n\n      // Feedback scores a model that exists. It no longer creates one under a version the caller names, and a prediction that records its\n      // own model version can only be scored against that version.\n      if (!model) throw ApiError.notFound('Model version');\n      const recordedVersion = (prediction as { modelVersion?: string | null }).modelVersion;\n      if (recordedVersion && recordedVersion !== model.version) {\n        throw ApiError.conflict('The prediction was made by a different model version');\n      }\n      const activeModel = model;\n",
)
swap(
  "      const previousObs = Number(currentStats.observations ?? 0);",
  "      // One outcome per prediction: a repeated submission would count the same case again and drag the error statistics.\n      const scoredIds = Array.isArray(currentParams.scoredPredictionIds) ? (currentParams.scoredPredictionIds as string[]) : [];\n      const queued = Array.isArray(currentParams.trainingDataQueue) ? (currentParams.trainingDataQueue as Array<{ predictionId?: string }>) : [];\n      if (scoredIds.includes(prediction.id) || queued.some((entry) => entry.predictionId === prediction.id)) {\n        throw ApiError.conflict('An outcome has already been recorded for this prediction');\n      }\n\n      const previousObs = Number(currentStats.observations ?? 0);",
)
swap(
  "        trainingDataQueue,\n        retrainSignal: {",
  "        trainingDataQueue,\n        scoredPredictionIds: [...scoredIds, prediction.id].slice(-5000),\n        retrainSignal: {",
)
fs.writeFileSync(f, s)
console.log('ok')
