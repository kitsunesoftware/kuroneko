import { readInstallJob } from '../../../utils/module-install-job'

export default defineEventHandler((event) => {
  const jobId = getRouterParam(event, 'jobId')
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Job inválido.' })
  }

  const job = readInstallJob(jobId)
  if (!job) {
    throw createError({ statusCode: 404, message: 'Job não encontrado.' })
  }

  return job
})
