#!/bin/bash

cp README.md /srv/slate/source/index.html.md
cd /srv/slate
bundler exec middleman build
cp -R build /github/workspace