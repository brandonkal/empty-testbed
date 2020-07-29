/**
 * Example brigade project for testing
 */
import { events, Job, init, msg } from 'brig'

// GitHub Check events to watch for
// Note that a GitHub App will automatically generate these events
// from a `push` event, so we don't need an explicit push event handler any longer
events.on('check_suite:requested', checkRequested)
events.on('check_suite:rerequested', checkRequested)
events.on('check_run:rerequested', checkRequested)
events.on('exec', localDev)

// Our main test logic, refactored into a function that returns the job
function runTests() {
  console.log('Running runTests')
  let testRunner = new Job('test-runner', 'python:3', [
    'cd /src',
    'pip install -r requirements.txt',
    'python setup.py test',
  ])
  // Display logs from the job Pod
  testRunner.streamLogs = true
  testRunner.timeout = 60e3
  return testRunner
}

function localDev([e]: msg) {
  // Common configuration
  const env: any = {
    CHECK_PAYLOAD: e.payload,
    CHECK_NAME: 'Brigade',
    CHECK_TITLE: 'Run Tests',
  }
  return runTests()
    .run()
    .then((result) => {
      env.CHECK_CONCLUSION = 'success'
      env.CHECK_SUMMARY = 'Build completed'
      env.CHECK_TEXT = result.toString()
      console.log('Printing test environment results')
      console.log(JSON.stringify(env))
    })
}

async function checkRequested([e]: msg) {
  console.log('check requested')

  // This Check Run image handles updating GitHub
  const checkRunImage = 'brigadecore/brigade-github-check-run:latest'

  // Common configuration
  const env = {
    CHECK_PAYLOAD: e.payload,
    CHECK_NAME: 'Brigade',
    CHECK_TITLE: 'Run Tests',
  }

  // For convenience, we'll create three jobs: one for each GitHub Check
  // stage.
  const start = new Job('start-run', checkRunImage)
  start.imageForcePull = false
  start.env = env
  start.env.CHECK_SUMMARY = 'Beginning test run'

  const end = new Job('end-run', checkRunImage)
  end.imageForcePull = false
  end.env = env

  try {
    let r = await start.run().then(() => runTests().run())
    end.env.CHECK_CONCLUSION = 'success'
    end.env.CHECK_SUMMARY = 'Build completed'
    end.env.CHECK_TEXT = r.toString()
    return end.run()
  } catch (err) {
    end.env.CHECK_CONCLUSION = 'failure'
    end.env.CHECK_SUMMARY = 'Build failed'
    end.env.CHECK_TEXT = `Error: ${err}`.replace('Error: Error:', 'Error:')
    return end.run()
  }
}

init(import.meta)
