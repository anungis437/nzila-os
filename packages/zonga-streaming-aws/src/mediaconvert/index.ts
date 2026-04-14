/**
 * AWS MediaConvert — VOD transcoding for Zonga audio/video assets.
 *
 * Submits transcoding jobs, queries status, and maps output paths.
 * Zonga's processing-pipeline.ts orchestrates when jobs are submitted;
 * this module only talks to the AWS MediaConvert API.
 */
import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  CancelJobCommand,
  type JobSettings,
  type OutputGroup,
} from '@aws-sdk/client-mediaconvert'
import type { MediaConvertConfig, MediaJobStatus, MediaJobType } from '../types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TranscodeJobInput {
  assetId: string
  orgId: string
  inputStorageKey: string
  inputBucket: string
  jobType: MediaJobType
  /** Quality presets to produce */
  qualities: TranscodePreset[]
}

export interface TranscodePreset {
  label: string
  bitrate: number
  codec: 'aac' | 'opus' | 'flac'
  container: 'mp4' | 'webm' | 'fmp4'
  sampleRate: number
}

export interface TranscodeJobResult {
  providerJobId: string
  status: MediaJobStatus
  outputPrefix: string
}

export interface TranscodeJobStatus {
  providerJobId: string
  status: MediaJobStatus
  progress: number
  errorMessage?: string
  outputKeys: string[]
}

// ── Client Factory ──────────────────────────────────────────────────────────

function createMediaConvertClient(config: MediaConvertConfig): MediaConvertClient {
  return new MediaConvertClient({
    region: config.region,
    endpoint: config.endpoint,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
          },
        }
      : {}),
  })
}

// ── Job Submission ──────────────────────────────────────────────────────────

/**
 * Submit a transcode job to AWS MediaConvert.
 */
export async function submitTranscodeJob(
  config: MediaConvertConfig,
  input: TranscodeJobInput,
): Promise<TranscodeJobResult> {
  const client = createMediaConvertClient(config)
  const outputPrefix = `${config.outputPrefix}${input.orgId}/${input.assetId}/`

  const outputGroups: OutputGroup[] = []

  // HLS output group (for streaming)
  if (input.jobType === 'transcode_hls') {
    outputGroups.push({
      Name: 'HLS Group',
      OutputGroupSettings: {
        Type: 'HLS_GROUP_SETTINGS',
        HlsGroupSettings: {
          Destination: `s3://${config.outputBucket}/${outputPrefix}hls/`,
          SegmentLength: 6,
          MinSegmentLength: 0,
        },
      },
      Outputs: input.qualities.map((q) => ({
        NameModifier: `-${q.bitrate}kbps`,
        ContainerSettings: {
          Container: 'M3U8',
        },
        AudioDescriptions: [
          {
            CodecSettings: {
              Codec: q.codec === 'aac' ? 'AAC' : 'OPUS',
              AacSettings:
                q.codec === 'aac'
                  ? {
                      Bitrate: q.bitrate * 1000,
                      SampleRate: q.sampleRate,
                      CodingMode: 'CODING_MODE_2_0',
                      RawFormat: 'NONE',
                    }
                  : undefined,
            },
          },
        ],
      })),
    })
  }

  // File output group (for direct download / audio-only)
  if (input.jobType === 'transcode_audio') {
    outputGroups.push({
      Name: 'Audio File Group',
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: {
          Destination: `s3://${config.outputBucket}/${outputPrefix}audio/`,
        },
      },
      Outputs: input.qualities.map((q) => ({
        NameModifier: `-${q.bitrate}kbps`,
        ContainerSettings: {
          Container: q.container === 'webm' ? 'WEBM' : 'MP4',
        },
        AudioDescriptions: [
          {
            CodecSettings: {
              Codec: q.codec === 'aac' ? 'AAC' : 'OPUS',
              AacSettings:
                q.codec === 'aac'
                  ? {
                      Bitrate: q.bitrate * 1000,
                      SampleRate: q.sampleRate,
                      CodingMode: 'CODING_MODE_2_0',
                      RawFormat: 'NONE',
                    }
                  : undefined,
            },
          },
        ],
      })),
    })
  }

  // Thumbnail output group
  if (input.jobType === 'thumbnail' || input.jobType === 'poster') {
    outputGroups.push({
      Name: 'Thumbnail Group',
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: {
          Destination: `s3://${config.outputBucket}/${outputPrefix}thumbs/`,
        },
      },
      Outputs: [
        {
          NameModifier: '-thumb',
          ContainerSettings: { Container: 'RAW' },
          VideoDescription: {
            Width: 640,
            Height: 640,
            CodecSettings: {
              Codec: 'FRAME_CAPTURE',
              FrameCaptureSettings: {
                FramerateNumerator: 1,
                FramerateDenominator: 10,
                MaxCaptures: 1,
                Quality: 80,
              },
            },
          },
        },
      ],
    })
  }

  const settings: JobSettings = {
    Inputs: [
      {
        FileInput: `s3://${input.inputBucket}/${input.inputStorageKey}`,
        AudioSelectors: {
          'Audio Selector 1': { DefaultSelection: 'DEFAULT' },
        },
      },
    ],
    OutputGroups: outputGroups,
  }

  const resp = await client.send(
    new CreateJobCommand({
      Role: config.roleArn,
      Settings: settings,
      Tags: {
        'zonga:asset_id': input.assetId,
        'zonga:org_id': input.orgId,
        'zonga:job_type': input.jobType,
      },
    }),
  )

  if (!resp.Job?.Id) {
    throw new Error('MediaConvert job creation returned no job ID')
  }

  return {
    providerJobId: resp.Job.Id,
    status: mapMediaConvertStatus(resp.Job.Status),
    outputPrefix,
  }
}

// ── Job Status ──────────────────────────────────────────────────────────────

/**
 * Query the status of a MediaConvert job.
 */
export async function getTranscodeJobStatus(
  config: MediaConvertConfig,
  providerJobId: string,
): Promise<TranscodeJobStatus> {
  const client = createMediaConvertClient(config)
  const resp = await client.send(new GetJobCommand({ Id: providerJobId }))

  const job = resp.Job
  if (!job) {
    throw new Error(`MediaConvert job ${providerJobId} not found`)
  }

  const outputKeys: string[] = []
  if (job.OutputGroupDetails) {
    for (const group of job.OutputGroupDetails) {
      if (group.OutputDetails) {
        for (const output of group.OutputDetails) {
          if (output.OutputFilePaths) {
            outputKeys.push(...output.OutputFilePaths)
          }
        }
      }
    }
  }

  return {
    providerJobId: job.Id ?? providerJobId,
    status: mapMediaConvertStatus(job.Status),
    progress: job.JobPercentComplete ?? 0,
    errorMessage: job.ErrorMessage,
    outputKeys,
  }
}

// ── Job Cancellation ────────────────────────────────────────────────────────

/**
 * Cancel a pending/processing MediaConvert job.
 */
export async function cancelTranscodeJob(
  config: MediaConvertConfig,
  providerJobId: string,
): Promise<void> {
  const client = createMediaConvertClient(config)
  await client.send(new CancelJobCommand({ Id: providerJobId }))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapMediaConvertStatus(status: string | undefined): MediaJobStatus {
  switch (status) {
    case 'SUBMITTED':
      return 'submitted'
    case 'PROGRESSING':
      return 'processing'
    case 'COMPLETE':
      return 'completed'
    case 'CANCELED':
      return 'cancelled'
    case 'ERROR':
      return 'failed'
    default:
      return 'pending'
  }
}
