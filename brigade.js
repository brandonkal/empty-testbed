//@ts-nocheck
const { events, Job } = require('brigadier')

// GitHub Check events to watch for
//
// Note that a GitHub App will automatically generate these events
// from a `push` event, so we don't need an explicit push event handler any longer
events.on('check_suite:requested', checkRequested)
events.on('check_suite:rerequested', checkRequested)
events.on('check_run:rerequested', checkRequested)

// Our main test logic, refactored into a function that returns the job
function runTests(e, project) {
  // Create a new job
  var testRunner = new Job('test-runner')

  // We want our job to run the stock Docker Python 3 image
  testRunner.image = 'python:3'

  // Now we want it to run these commands in order:
  testRunner.tasks = [
    'cd /src',
    'pip install -r requirements.txt',
    'python setup.py test',
  ]

  // Display logs from the job Pod
  testRunner.streamLogs = true

  return testRunner
}

// This runs our main test job, updating GitHub along the way
function checkRequested(e, p) {
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

  // Now we run the jobs in order:
  // - Notify GitHub of start
  // - Run the tests
  // - Notify GitHub of completion
  //
  // On error, we catch the error and notify GitHub of a failure.
  start
    .run()
    .then(() => {
      return runTests(e, p).run()
    })
    .then((result) => {
      end.env.CHECK_CONCLUSION = 'success'
      end.env.CHECK_SUMMARY = 'Build completed'
      end.env.CHECK_TEXT = result.toString()
      return end.run()
    })
    .catch((err) => {
      // In this case, we mark the ending failed.
      end.env.CHECK_CONCLUSION = 'failure'
      end.env.CHECK_SUMMARY = 'Build failed'
      end.env.CHECK_TEXT = `Error: ${err}`
      return end.run()
    })
}
