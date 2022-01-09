#!/bin/bash

# https://www.npmjs.com/package/concat-md
#
# Usage
#   $ concat-md [options] <dir>
#
# Options
#   --ignore <globs csv>              - Glob patterns to exclude in 'dir'.
#   --toc                             - Adds table of the contents at the beginning of file.
#   --decrease-title-levels           - Whether to decrease levels of all titles in markdown file to set them below file and directory title levels.
#   --start-title-level-at <level no> - Level to start file and directory levels. Default: 1
#   --join-string <string>            - String to be used to join concatenated files. Default: new line
#   --title-key <key name>            - Key name to get title in 'FrontMatter' meta data in markdown headers.
#   --file-name-as-title              - Whether to use file names as titles.
#   --dir-name-as-title               - Whether to use directory names as titles.
#   --debug                           - Print stack trace in errors.
#
# Examples
#   If files have titles in markdown already:
#     $ npx concat-md --toc --decrease-title-levels --dir-name-as-title typedoc-api-docs > README.md
#
#   If files have titles in FrontMatter meta data:
#     $ npx concat-md --toc --decrease-title-levels --title-key title --file-name-as-title --dir-name-as-title docs > README.md
#
#   If files don't have titles:
#     $ npx concat-md --toc --decrease-title-levels --file-name-as-title --dir-name-as-title docs > README.md

scriptDir="$(dirname $0)"
outFile=__BUILD_SOURCE.MD
pushd $scriptDir/../.. > /dev/null

rm -f $outFile
npx concat-md --ignore README.md --decrease-title-levels --file-name-as-title docs > $outFile

if [ $? -ne 0 ]; then
    echo $0 failed
    exit $?
fi

popd > /dev/null

echo `realpath $outFile`
exit 0