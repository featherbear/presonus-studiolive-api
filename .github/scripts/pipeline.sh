#!/bin/bash

scriptDir="$(dirname $0)"
pushd $scriptDir > /dev/null

sourceFile=$(./merge-markdown.sh)

if [ $? -ne 0 ]; then
    echo $0 failed
    exit $?
fi

#  /usr/bin/docker run --name slatedocsslatev2120_d40c33 --label 6a6825 --workdir /github/workspace --rm -e INPUT_ENTRYPOINT -e HOME -e GITHUB_JOB -e GITHUB_REF -e GITHUB_SHA -e GITHUB_REPOSITORY -e GITHUB_REPOSITORY_OWNER -e GITHUB_RUN_ID -e GITHUB_RUN_NUMBER -e GITHUB_RETENTION_DAYS -e GITHUB_RUN_ATTEMPT -e GITHUB_ACTOR -e GITHUB_WORKFLOW -e GITHUB_HEAD_REF -e GITHUB_BASE_REF -e GITHUB_EVENT_NAME -e GITHUB_SERVER_URL -e GITHUB_API_URL -e GITHUB_GRAPHQL_URL -e GITHUB_REF_NAME -e GITHUB_REF_PROTECTED -e GITHUB_REF_TYPE -e GITHUB_WORKSPACE -e GITHUB_ACTION -e GITHUB_EVENT_PATH -e GITHUB_ACTION_REPOSITORY -e GITHUB_ACTION_REF -e GITHUB_PATH -e GITHUB_ENV -e RUNNER_OS -e RUNNER_ARCH -e RUNNER_NAME -e RUNNER_TOOL_CACHE -e RUNNER_TEMP -e RUNNER_WORKSPACE -e ACTIONS_RUNTIME_URL -e ACTIONS_RUNTIME_TOKEN -e ACTIONS_CACHE_URL -e GITHUB_ACTIONS=true -e CI=true --entrypoint "/github/workspace/.github/pipeline.sh" -v "/var/run/docker.sock":"/var/run/docker.sock" -v "/home/runner/work/_temp/_github_home":"/github/home" -v "/home/runner/work/_temp/_github_workflow":"/github/workflow" -v "/home/runner/work/_temp/_runner_file_commands":"/github/file_commands" -v "/home/runner/work/presonus-studiolive-api-docs-test/presonus-studiolive-api-docs-test":"/github/workspace" slatedocs/slate:v2.12.0

echo "Building $sourceFile"

cp $sourceFile /srv/slate/source/index.html.md
pushd /srv/slate > /dev/null
bundler exec middleman build
popd > /dev/null
cp -R /srv/slate/build/ /github/workspace

popd > /dev/null